import crypto from "node:crypto";
import express from "express";
import { google } from "googleapis";
import multer from "multer";

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.MAX_UPLOAD_BYTES || 10 * 1024 * 1024),
  },
});

const SHEET_ID = process.env.SHEET_ID || "1ZY23Cx5PYEQ5GSc_VrXBIMnHirLhh6F0uFsUtCt2Eqo";
const CLEAN_SHEET = "_CLEAN";
const PRODUCT_SHEET = "PRODUCT LIST";
const CONFIG_SHEET = "WEBAPP_CONFIG";
const RAW_ADD_SHEET = "RAW_ADD";
const LOOKUP_TOKEN_TTL_SECONDS = Number(process.env.LOOKUP_TOKEN_TTL_SECONDS || 60 * 60);
const LOOKUP_TOKEN_SECRET =
  process.env.LOOKUP_TOKEN_SECRET ||
  process.env.TOKEN_SECRET ||
  "change-me-before-production";
const TZ = process.env.TZ || "Asia/Hong_Kong";

const driveFolderId = process.env.DRIVE_FOLDER_ID;
const appsScriptUploadUrl = process.env.APPS_SCRIPT_UPLOAD_URL;
const allowedOrigins = new Set(
  String(process.env.ALLOWED_ORIGINS || "https://hkycaa.github.io")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

const DEFAULT_CONFIG = {
  competitionName: "SHOW YOUR COLOURS! 當代兒童繪畫大賽 2026",
  formTitle: "比賽成績查閱及加購表格",
  formIntro: "請先完成比賽成績查閱，再核對資料及選擇加購項目。",
  competitionPhotoUrl: "",
};

const PUBLIC_FIELDS = [
  "IND_CODE",
  "NAME_CHI",
  "NAME_EN",
  "YOB",
  "YOB_GROUP",
  "AWARD_CHI",
  "AWARD_ENG",
  "STATUS_MYFAV",
  "SHIP_ADDR",
  "STATUS_RETURN",
  "ART_SIGNATURE_EN",
  "ECERT_TTL",
  "NOTEBOOK_TTL",
  "TOTE_A_TTL",
  "TOTE_B_TTL",
  "TOTE_C_TTL",
  "BAG_A_TTL",
  "BAG_B_TTL",
  "BAG_C_TTL",
  "CASE_A_TTL",
  "CASE_B_TTL",
  "CASE_C_TTL",
  "CASE_D_TTL",
  "ADJ_TTL",
  "PARIS_TTL",
  "HKAC_TTL",
  "PURCHASE_STATUS",
  "ART_DESC",
  "EDU_SCH",
];

const PRODUCT_COLUMNS = [
  "ECERT_ADD",
  "NOTEBOOK_ADD",
  "TOTE_A_ADD",
  "TOTE_B_ADD",
  "TOTE_C_ADD",
  "BAG_A_ADD",
  "BAG_B_ADD",
  "BAG_C_ADD",
  "CASE_A_ADD",
  "CASE_B_ADD",
  "CASE_C_ADD",
  "CASE_D_ADD",
  "ADJ_ADD",
  "PARIS_EARLY_ADD",
  "PARIS_ADD",
  "HKAC_EARLY_ADD",
  "HKAC_ADD",
  "DOUBLE_EXHIT_ADD",
];

const REQUIRED_RAW_ADD_HEADERS = [
  "Timestamp",
  "SubmissionId",
  "PreviousSubmissionId",
  "IND_CODE",
  "YOB",
  "NAME_CHI",
  "NAME_EN",
  "重新輸入家長/聯絡人WhatsApp號碼 Contact Number",
  "重新輸入家長/聯絡人電郵地址 Email Address of Contact Person",
  "更正參賽者資料 / 收貨地址 / 其他查詢 Edit participant's information or other enquiries（ 請輸入完整句子 Please write in complete sentences）",
  "本人將會以下列方式向本會付款 Method of Payment",
  "付款帳戶之英文姓名 Name of Payee Account",
  "應付總數 Total Payable",
  "PAYMENT_SLIP_FILE_ID",
  "PAYMENT_SLIP_FILE_NAME",
  "PAYMENT_SLIP_FILE_URL",
  "PAYMENT_SLIP_MIME_TYPE",
  "PAYMENT_SLIP_UPLOADED_AT",
  "PAYMENT_SLIP_UPLOAD_STATUS",
  "ADD_ON_SUMMARY",
  ...PRODUCT_COLUMNS,
];

let sheetsClientPromise;

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

app.use((req, res, next) => {
  const origin = req.get("origin");
  if (origin && isAllowedOrigin(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
  }

  res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  next();
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "hkycaa-add-on-api",
    sheetConfigured: Boolean(SHEET_ID),
    driveFolderConfigured: Boolean(driveFolderId),
    appsScriptUploadConfigured: Boolean(appsScriptUploadUrl),
    routes: ["/?action=config", "/?action=lookup", "/?action=products", "/?action=submit", "/upload"],
  });
});

app.get("/", async (req, res) => {
  await routeAction(req.query || {}, res);
});

app.post("/", async (req, res) => {
  await routeAction(parseBody(req.body), res);
});

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!appsScriptUploadUrl) {
      res.status(500).json({
        success: false,
        code: "MISSING_APPS_SCRIPT_UPLOAD_URL",
        message: "付款記錄上載失敗，請稍後再試。",
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        success: false,
        code: "MISSING_FILE",
        message: "請上載轉帳記錄或截圖。",
      });
      return;
    }

    const entryNo = safeFilePart(req.body.entryNo || "unknown-entry");
    const uploadType = safeFilePart(req.body.uploadType || "payment-slip");
    const originalName = safeFileName(req.file.originalname || "upload");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = [timestamp, entryNo, uploadType, originalName].join("_");
    const uploadResult = await uploadViaAppsScript({
      entryNo,
      uploadId: timestamp,
      fileName,
      mimeType: req.file.mimetype || "application/octet-stream",
      data: req.file.buffer.toString("base64"),
    });

    res.json({
      success: true,
      file: uploadResult.file,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      code: "UPLOAD_FAILED",
      message: "付款記錄上載失敗，請稍後再試。",
      detail: String(error && error.message ? error.message : error),
    });
  }
});

async function routeAction(payload, res) {
  try {
    const action = safeText(payload.action);
    let result;

    if (action === "config") {
      result = await getConfig();
    } else if (action === "products") {
      result = await getProducts();
    } else if (action === "lookup") {
      result = await lookupContestant(payload);
    } else if (action === "submit") {
      result = await submit(payload);
    } else {
      result = {
        success: true,
        service: "add-on-trial-web-app",
        routes: ["?action=lookup", "?action=products", "?action=config", "?action=submit"],
      };
    }

    sendApiResponse(res, result, payload.callback);
  } catch (error) {
    console.error(error);
    sendApiResponse(
      res,
      {
        success: false,
        code: "INTERNAL_ERROR",
        message: "系統暫時未能處理查詢，請稍後再試。",
        detail: String(error && error.message ? error.message : error),
      },
      payload.callback,
      500
    );
  }
}

async function getConfig() {
  const config = { ...DEFAULT_CONFIG };
  const values = await readSheetValues(CONFIG_SHEET);

  if (!values || values.length < 2) {
    return {
      success: true,
      mode: "config",
      config,
      suggestedSheet: CONFIG_SHEET,
      suggestedFields: ["CONFIG_KEY", "CONFIG_VALUE"],
    };
  }

  const headers = values[0].map(normalizeHeader);
  const idx = buildHeaderIndex(headers);
  const keyIndex = idx.CONFIG_KEY !== undefined ? idx.CONFIG_KEY : 0;
  const valueIndex = idx.CONFIG_VALUE !== undefined ? idx.CONFIG_VALUE : 1;

  for (let r = 1; r < values.length; r += 1) {
    const key = safeText(values[r][keyIndex]);
    const value = safeText(values[r][valueIndex]);
    if (key && config[key] !== undefined) {
      config[key] = value;
    }
  }

  return {
    success: true,
    mode: "config",
    config,
  };
}

async function getProducts() {
  const values = await readSheetValues(PRODUCT_SHEET);
  if (!values) throw new Error(`Missing sheet: ${PRODUCT_SHEET}`);

  if (values.length < 2) {
    return {
      success: true,
      mode: "products",
      products: [],
    };
  }

  const headers = values[0].map(normalizeHeader);
  const idx = buildHeaderIndex(headers);
  const products = [];

  for (let r = 1; r < values.length; r += 1) {
    const row = values[r];
    const code =
      firstCell(row, idx, ["PRODUCT_CODE", "PRODUCT ID", "PRODUCT_ID", "SKU", "CODE", "ITEM_CODE", "PRODUCT"]) ||
      safeText(row[0]);

    if (!code) continue;

    products.push({
      code: normalizeCode(code),
      name:
        firstCell(row, idx, [
          "PRODUCT_NAME_CHI",
          "PRODUCT NAME CHI",
          "PRODUCT_NAME_ENG",
          "PRODUCT NAME ENG",
          "PRODUCT_NAME",
          "PRODUCT NAME",
          "ITEM_NAME",
          "ITEM NAME",
          "NAME",
        ]) || code,
      description: firstCell(row, idx, ["PRODUCT_DESC", "PRODUCT DESC", "DESCRIPTION", "DESC"]),
      photo: firstCell(row, idx, ["PRODUCT_PHOTO", "PRODUCT PHOTO", "PHOTO", "IMAGE", "IMAGE_URL"]),
      shelfStatus: firstCell(row, idx, ["SHELF_STATUS", "SHELF STATUS", "STATUS"]),
      price: parsePrice(
        firstCell(row, idx, [
          "PRICE",
          "PRICE_TAG",
          "PRICE TAG",
          "PRODUCT_PRICE",
          "PRODUCT PRICE",
          "PRODUCT_PRICE_HKD",
          "PRODUCT PRICE HKD",
          "PRODUCT_PRICE_HK$",
          "PRODUCT PRICE HK$",
          "UNIT_PRICE",
          "UNIT PRICE",
          "ADD_ON_PRICE",
          "ADD-ON PRICE",
          "加購價",
          "價錢",
          "價格",
          "售價",
          "HKD",
          "AMOUNT",
          "SALE_PRICE",
        ])
      ),
    });
  }

  return {
    success: true,
    mode: "products",
    products,
  };
}

async function lookupContestant(payload) {
  const entryNo = normalizeCode(payload.entryNo || payload.indCode || payload.IND_CODE);
  const yob = normalizeYear(payload.yob || payload.yearOfBirth || payload.YOB);
  const name = normalizeName(payload.name || payload.contestantName || payload.NAME);

  if (!entryNo || !yob || !name) {
    return {
      success: false,
      code: "MISSING_REQUIRED_FIELDS",
      message: "請輸入參賽者名字、出生年份及得獎者編號。",
    };
  }

  const values = await readSheetValues(CLEAN_SHEET);
  if (!values) throw new Error(`Missing sheet: ${CLEAN_SHEET}`);
  if (values.length < 2) throw new Error(`${CLEAN_SHEET} has no data rows`);

  const headers = values[0].map(normalizeHeader);
  const idx = buildHeaderIndex(headers);
  ["IND_CODE", "NAME_CHI", "NAME_EN", "YOB"].forEach((header) => {
    if (idx[header] === undefined) {
      throw new Error(`Missing required header in ${CLEAN_SHEET}: ${header}`);
    }
  });

  let matchedRow = null;
  let matchedRowNumber = 0;

  for (let r = 1; r < values.length; r += 1) {
    const row = values[r];
    if (normalizeCode(row[idx.IND_CODE]) === entryNo) {
      matchedRow = row;
      matchedRowNumber = r + 1;
      break;
    }
  }

  if (!matchedRow) {
    return {
      success: false,
      code: "ENTRY_NOT_FOUND",
      message: "錯誤：所輸入的得獎者編號錯誤<br>如需求助，請WhatsApp我們 +852 64180925 查詢。",
    };
  }

  const rowYob = normalizeYear(matchedRow[idx.YOB]);
  const nameChi = normalizeName(matchedRow[idx.NAME_CHI]);
  const nameEn = normalizeName(matchedRow[idx.NAME_EN]);

  if (rowYob !== yob || (name !== nameChi && name !== nameEn)) {
    return {
      success: false,
      code: "IDENTITY_MISMATCH",
      message: "錯誤：參賽者名字或出生年份與參賽記錄不符，請重新輸入。<br>如需求助，請WhatsApp我們 +852 64180925 查詢。",
    };
  }

  const contestant = {};
  PUBLIC_FIELDS.forEach((field) => {
    contestant[field] = getPublicField(matchedRow, idx, field);
  });

  return {
    success: true,
    mode: "lookup",
    lookupToken: createLookupToken(entryNo, yob, matchedRowNumber),
    contestant,
  };
}

async function submit(payload) {
  const submission = parseSubmissionPayload(payload);
  const token = safeText(submission.lookupToken);

  if (!token) {
    return {
      success: false,
      code: "MISSING_LOOKUP_TOKEN",
      message: "請先完成比賽成績查閱。",
    };
  }

  const lookup = verifyLookupToken(token);
  if (!lookup) {
    return {
      success: false,
      code: "LOOKUP_TOKEN_EXPIRED",
      message: "查閱授權已逾時，請重新查閱後再遞交。",
    };
  }

  const timestamp = new Date();
  const totalPayable = Number(submission.totalPayable) || 0;
  const targetSubmissionId = safeText(submission.previousSubmissionId);
  const submissionId = targetSubmissionId ||
    `AOT-${formatDate(timestamp, "yyyyMMdd-HHmmss")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const contestant = submission.contestant || {};
  const paymentSlipInfo = normalizePaymentSlipMetadata(submission.paymentSlipUpload);

  const headers = await ensureRawAddHeaders();
  const idx = buildHeaderIndex(headers.map(normalizeHeader));
  const row = Array(headers.length).fill("");

  setRowValue(row, idx, "Timestamp", formatDate(timestamp, "yyyy-MM-dd HH:mm:ss"));
  setRowValue(row, idx, "SubmissionId", submissionId);
  setRowValue(row, idx, "PreviousSubmissionId", "");
  setRowValue(row, idx, "lookupToken", "");
  setRowValue(row, idx, "IND_CODE", safeText(contestant.entryNo) || lookup.entryNo);
  setRowValue(row, idx, "YOB", safeText(contestant.yob) || lookup.yob);
  setRowValue(row, idx, "NAME_CHI", safeText(contestant.nameChi));
  setRowValue(row, idx, "NAME_EN", safeText(contestant.nameEn));
  setRowValue(row, idx, "重新輸入家長/聯絡人WhatsApp號碼 Contact Number", safeText(submission.contactNumber));
  setRowValue(row, idx, "重新輸入家長/聯絡人電郵地址 Email Address of Contact Person", safeText(submission.contactEmail));
  setRowValue(
    row,
    idx,
    "更正參賽者資料 / 收貨地址 / 其他查詢 Edit participant's information or other enquiries（ 請輸入完整句子 Please write in complete sentences）",
    safeText(submission.enquiryText)
  );
  setRowValue(row, idx, "本人將會以下列方式向本會付款 Method of Payment", safeText(submission.paymentMethod));
  setRowValue(row, idx, "付款帳戶之英文姓名 Name of Payee Account", safeText(submission.payeeName));
  setRowValue(row, idx, "應付總數 Total Payable", totalPayable);

  if (paymentSlipInfo) {
    setRowValue(row, idx, "PAYMENT_SLIP_FILE_ID", paymentSlipInfo.fileId);
    setRowValue(row, idx, "PAYMENT_SLIP_FILE_NAME", paymentSlipInfo.fileName);
    setRowValue(row, idx, "PAYMENT_SLIP_FILE_URL", paymentSlipInfo.fileUrl);
    setRowValue(row, idx, "PAYMENT_SLIP_MIME_TYPE", paymentSlipInfo.mimeType);
    setRowValue(row, idx, "PAYMENT_SLIP_UPLOADED_AT", paymentSlipInfo.uploadedAt);
    setRowValue(row, idx, "PAYMENT_SLIP_UPLOAD_STATUS", "UPLOADED");
  } else {
    setRowValue(row, idx, "PAYMENT_SLIP_UPLOAD_STATUS", totalPayable > 0 ? "PENDING_MANUAL_UPLOAD" : "NOT_REQUIRED");
  }

  PRODUCT_COLUMNS.forEach((column) => setRowValue(row, idx, column, ""));

  const items = Array.isArray(submission.items) ? submission.items : [];
  setRowValue(
    row,
    idx,
    "ADD_ON_SUMMARY",
    items.map((item) => [item.code, item.name, `x${item.quantity}`, `HK$${item.total}`].join(" ")).join("\n")
  );

  items.forEach((item) => {
    const column = `${normalizeCode(item.code)}_ADD`;
    setRowValue(row, idx, column, Number(item.quantity) || 0);
  });

  if (targetSubmissionId) {
    const rowNumber = await findRawAddRowNumberBySubmissionId(headers, targetSubmissionId);
    if (!rowNumber) {
      return {
        success: false,
        code: "ORIGINAL_SUBMISSION_NOT_FOUND",
        message: "找不到原有提交記錄，請重新查閱後再遞交。",
      };
    }

    await updateSheetRow(RAW_ADD_SHEET, rowNumber, row);
  } else {
    await appendSheetRow(RAW_ADD_SHEET, row);
  }

  return {
    success: true,
    mode: "submit",
    submissionId,
    paymentSlip: paymentSlipInfo || null,
    message: "已成功遞交",
  };
}

async function getSheetsClient() {
  if (!sheetsClientPromise) {
    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    sheetsClientPromise = auth.getClient().then((authClient) => google.sheets({ version: "v4", auth: authClient }));
  }

  return sheetsClientPromise;
}

async function readSheetValues(sheetName, range = "") {
  const sheets = await getSheetsClient();
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${quoteSheetName(sheetName)}${range}`,
      valueRenderOption: "FORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });

    return response.data.values || [];
  } catch (error) {
    if (error?.code === 400 || error?.code === 404) return null;
    throw error;
  }
}

async function ensureRawAddHeaders() {
  await ensureSheetExists(RAW_ADD_SHEET);

  const existingRows = await readSheetValues(RAW_ADD_SHEET, "!1:1");
  const existingHeaders = existingRows?.[0] || [];
  const normalized = buildHeaderIndex(existingHeaders.map(normalizeHeader));
  const missing = REQUIRED_RAW_ADD_HEADERS.filter((header) => normalized[normalizeHeader(header)] === undefined);
  const headers = existingHeaders.concat(missing);

  if (!existingHeaders.length || missing.length) {
    const sheets = await getSheetsClient();
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${quoteSheetName(RAW_ADD_SHEET)}!A1:${columnLetter(headers.length)}1`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [headers],
      },
    });
  }

  return headers;
}

async function ensureSheetExists(sheetName) {
  const sheets = await getSheetsClient();
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
    fields: "sheets.properties.title",
  });
  const exists = (spreadsheet.data.sheets || []).some((sheet) => sheet.properties?.title === sheetName);
  if (exists) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [{ addSheet: { properties: { title: sheetName } } }],
    },
  });
}

async function appendSheetRow(sheetName, row) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${quoteSheetName(sheetName)}!A:ZZ`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [row],
    },
  });
}

async function updateSheetRow(sheetName, rowNumber, row) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${quoteSheetName(sheetName)}!A${rowNumber}:${columnLetter(row.length)}${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [row],
    },
  });
}

async function findRawAddRowNumberBySubmissionId(headers, submissionId) {
  const target = safeText(submissionId);
  if (!target) return 0;

  const idx = buildHeaderIndex(headers.map(normalizeHeader));
  const submissionIdIndex = idx[normalizeHeader("SubmissionId")];
  if (submissionIdIndex === undefined) return 0;

  const rows = await readSheetValues(RAW_ADD_SHEET, `!A2:${columnLetter(headers.length)}`);
  if (!rows || !rows.length) return 0;

  const matchIndex = rows.findIndex((row) => safeText(row[submissionIdIndex]) === target);
  return matchIndex >= 0 ? matchIndex + 2 : 0;
}

async function uploadViaAppsScript({ entryNo, uploadId, fileName, mimeType, data }) {
  const response = await fetch(appsScriptUploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({
      action: "uploadPaymentSlip",
      entryNo,
      uploadId,
      paymentSlip: {
        fileName,
        mimeType,
        data,
      },
    }),
  });

  let result = null;
  try {
    result = await response.json();
  } catch (error) {
    result = null;
  }

  if (!response.ok || !result?.success || !result?.file) {
    const detail = result?.detail || result?.message || response.statusText;
    throw new Error(`Apps Script upload failed: ${detail}`);
  }

  return result;
}

function createLookupToken(entryNo, yob, rowNumber) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    entryNo,
    yob,
    rowNumber,
    iat: now,
    exp: now + LOOKUP_TOKEN_TTL_SECONDS,
    nonce: crypto.randomUUID(),
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = signTokenPayload(encoded);
  return `${encoded}.${signature}`;
}

function verifyLookupToken(token) {
  const [encoded, signature] = String(token).split(".");
  if (!encoded || !signature) return null;

  const expectedSignature = signTokenPayload(encoded);
  if (!timingSafeEqual(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encoded));
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) return null;
    return payload;
  } catch (error) {
    return null;
  }
}

function signTokenPayload(encodedPayload) {
  return crypto.createHmac("sha256", LOOKUP_TOKEN_SECRET).update(encodedPayload).digest("base64url");
}

function timingSafeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function sendApiResponse(res, payload, callback, status = 200) {
  const cb = safeText(callback);
  const json = JSON.stringify(payload);

  if (cb && /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(cb)) {
    res.status(status).type("application/javascript").send(`${cb}(${json});`);
    return;
  }

  res.status(status).json(payload);
}

function parseBody(body) {
  if (!body) return {};
  if (typeof body === "object") return body;

  try {
    return JSON.parse(body);
  } catch (error) {
    return {};
  }
}

function parseSubmissionPayload(payload) {
  if (typeof payload.payload === "object" && payload.payload) return payload.payload;

  try {
    return JSON.parse(safeText(payload.payload));
  } catch (error) {
    return {};
  }
}

function normalizePaymentSlipMetadata(paymentSlipUpload) {
  if (!paymentSlipUpload) return null;

  const fileId = safeText(paymentSlipUpload.fileId);
  const fileName = safeText(paymentSlipUpload.fileName);
  const fileUrl = safeText(paymentSlipUpload.fileUrl);

  if (!fileId || !fileUrl) return null;

  return {
    fileId,
    fileName: fileName || "payment-slip",
    fileUrl,
    mimeType: safeText(paymentSlipUpload.mimeType),
    uploadedAt: safeText(paymentSlipUpload.uploadedAt) || formatDate(new Date(), "yyyy-MM-dd HH:mm:ss"),
  };
}

function getPublicField(row, idx, field) {
  if (idx[field] !== undefined) return safeText(row[idx[field]]);

  const typoAlias = field.replace(/_TTL$/, "_TLL");
  if (idx[typoAlias] !== undefined) return safeText(row[idx[typoAlias]]);

  return "";
}

function buildHeaderIndex(headers) {
  const idx = {};
  headers.forEach((header, index) => {
    if (header && idx[header] === undefined) {
      idx[header] = index;
    }
  });
  return idx;
}

function firstCell(row, idx, headers) {
  for (let i = 0; i < headers.length; i += 1) {
    const key = normalizeHeader(headers[i]);
    if (idx[key] !== undefined) {
      return safeText(row[idx[key]]);
    }
  }

  return "";
}

function setRowValue(row, idx, header, value) {
  const key = normalizeHeader(header);
  if (idx[key] !== undefined) {
    row[idx[key]] = value;
  }
}

function parsePrice(value) {
  const text = safeText(value);
  if (!text) return 0;

  const n = Number(text.replace(/[^\d.-]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

function normalizeHeader(value) {
  return safeText(value).replace(/\s+/g, " ");
}

function safeText(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/\u00A0/g, " ")
    .trim();
}

function normalizeCode(value) {
  return safeText(value).replace(/\s+/g, "").toUpperCase();
}

function normalizeYear(value) {
  const match = safeText(value).match(/\d{4}/);
  return match ? match[0] : "";
}

function normalizeName(value) {
  return safeText(value).replace(/\s+/g, "").toLowerCase();
}

function quoteSheetName(sheetName) {
  return `'${String(sheetName).replace(/'/g, "''")}'`;
}

function columnLetter(index) {
  let text = "";
  let n = index;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    text = String.fromCharCode(65 + remainder) + text;
    n = Math.floor((n - 1) / 26);
  }
  return text || "A";
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function formatDate(date, format) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .formatToParts(date)
    .reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

  if (format === "yyyyMMdd-HHmmss") {
    return `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}${parts.second}`;
  }

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function isAllowedOrigin(origin) {
  return (
    origin === "null" ||
    allowedOrigins.has(origin) ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)
  );
}

function safeFileName(value) {
  return String(value)
    .replace(/[\\/:*?"<>|#%{}^~[\]`]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 140) || "upload";
}

function safeFilePart(value) {
  return safeFileName(value).replace(/\.[A-Za-z0-9]+$/, "");
}

app.use((error, req, res, next) => {
  if (error && error.code === "LIMIT_FILE_SIZE") {
    res.status(413).json({
      success: false,
      code: "FILE_TOO_LARGE",
      message: "Uploaded file is too large.",
    });
    return;
  }

  next(error);
});

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  console.log(`Add-On Trial API listening on ${port}`);
});
