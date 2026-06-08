import crypto from "node:crypto";
import zlib from "node:zlib";
import express from "express";
import { google } from "googleapis";
import multer from "multer";
import Stripe from "stripe";

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.MAX_UPLOAD_BYTES || 10 * 1024 * 1024),
  },
});

const SHEET_ID = process.env.SHEET_ID || "1ZY23Cx5PYEQ5GSc_VrXBIMnHirLhh6F0uFsUtCt2Eqo";
const CLEAN_SHEET = process.env.CLEAN_SHEET || "_CLEAN";
const PRODUCT_SHEET = process.env.PRODUCT_SHEET || "PRODUCT LIST";
const CONFIG_SHEET = process.env.CONFIG_SHEET || "WEBAPP_CONFIG";
const RAW_ADD_SHEET = process.env.RAW_ADD_SHEET || "RAW_ADD";
const LOOKUP_TOKEN_TTL_SECONDS = Number(process.env.LOOKUP_TOKEN_TTL_SECONDS || 60 * 60);
const LOOKUP_TOKEN_SECRET =
  process.env.LOOKUP_TOKEN_SECRET ||
  process.env.TOKEN_SECRET ||
  "change-me-before-production";
const TZ = process.env.TZ || "Asia/Hong_Kong";
const STRIPE_PAYMENT_METHOD = "信用卡 / Alipay 內地版 / WeChat Pay 內地版 (+4% 手續費)";
const STRIPE_CURRENCY = String(process.env.STRIPE_CURRENCY || "hkd").toLowerCase();
const STRIPE_HANDLING_FEE_RATE = Number(process.env.STRIPE_HANDLING_FEE_RATE || 0.04);
const STRIPE_PAYMENT_METHOD_CONFIGURATION =
  process.env.STRIPE_PAYMENT_METHOD_CONFIGURATION || "pmc_1NbIhWFZL7REtGIoVi7sEbvS";
const STRIPE_PAYMENT_METHOD_TYPES = String(process.env.STRIPE_PAYMENT_METHOD_TYPES || "card,link,alipay,wechat_pay")
  .split(",")
  .map((type) => type.trim())
  .filter(Boolean);
const PUBLIC_SITE_URL = process.env.PUBLIC_SITE_URL || "https://hkycaa.github.io/yc-add-on-items/";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

const driveFolderId = process.env.DRIVE_FOLDER_ID;
const appsScriptUploadUrl = process.env.APPS_SCRIPT_UPLOAD_URL;
const allowedOrigins = new Set(
  String(process.env.ALLOWED_ORIGINS || "https://hkycaa.github.io")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

const DEFAULT_CONFIG = {
  competitionName: "HKYCAA",
  formTitle: "比賽成績查閱及加購表格",
  formIntro: "請先完成比賽成績查閱，再核對資料及選擇加購項目。",
  competitionPhotoUrl: "",
  webAppUrl: "",
  legacyWebAppUrl: "",
  cloudRunUploadUrl: "",
};

const BASE_PUBLIC_FIELDS = [
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
  "PURCHASE_STATUS",
  "ART_DESC",
  "EDU_SCH",
];

const LEGACY_PRODUCT_TOTAL_FIELDS = [
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
];

const BASE_RAW_ADD_HEADERS = [
  "Submission Timestamp",
  "Last Update Timestamp",
  "SubmissionId",
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
  "PAYMENT_PROVIDER",
  "PAYMENT_STATUS",
  "PAYMENT_SLIP_FILE_ID",
  "PAYMENT_SLIP_FILE_NAME",
  "PAYMENT_SLIP_FILE_URL",
  "PAYMENT_SLIP_MIME_TYPE",
  "PAYMENT_SLIP_UPLOADED_AT",
  "PAYMENT_SLIP_UPLOAD_STATUS",
  "STRIPE_CHECKOUT_SESSION_ID",
  "STRIPE_PAYMENT_INTENT_ID",
  "STRIPE_AMOUNT",
  "STRIPE_CURRENCY",
  "STRIPE_PAID_AT",
  "ADD_ON_SUMMARY",
];

let sheetsClientPromise;
let stripeClient;

app.post("/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const stripe = getStripeClient();
    const signature = req.get("stripe-signature");
    const event = STRIPE_WEBHOOK_SECRET
      ? stripe.webhooks.constructEvent(req.body, signature, STRIPE_WEBHOOK_SECRET)
      : JSON.parse(req.body.toString("utf8"));

    if (event.type === "checkout.session.completed") {
      await fulfillStripeCheckout(event.data.object);
    }

    res.json({ received: true });
  } catch (error) {
    console.error(error);
    res.status(400).json({
      success: false,
      message: "Stripe webhook handling failed.",
      detail: String(error && error.message ? error.message : error),
    });
  }
});

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
    stripeConfigured: Boolean(STRIPE_SECRET_KEY),
    routes: [
      "/?action=config",
      "/?action=lookup",
      "/?action=products",
      "/?action=amend",
      "/?action=submit",
      "/?action=createCheckoutSession",
      "/?action=stripeCheckoutResult",
      "/stripe/webhook",
      "/upload",
    ],
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
    } else if (action === "amend") {
      result = await lookupAmendment(payload);
    } else if (action === "submit") {
      result = await submit(payload);
    } else if (action === "createCheckoutSession") {
      result = await createCheckoutSession(payload);
    } else if (action === "stripeCheckoutResult") {
      result = await getStripeCheckoutResult(payload);
    } else {
      result = {
        success: true,
        service: "add-on-trial-web-app",
        routes: [
          "?action=lookup",
          "?action=products",
          "?action=config",
          "?action=amend",
          "?action=submit",
          "?action=createCheckoutSession",
          "?action=stripeCheckoutResult",
          "/stripe/webhook",
        ],
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

    const normalizedCode = normalizeCode(code);
    const addColumn =
      normalizeCode(firstCell(row, idx, ["ADD_COLUMN", "ADD COLUMN", "RAW_ADD_COLUMN", "RAW ADD COLUMN"])) ||
      `${normalizedCode}_ADD`;
    const ttlFields = parseConfigList(firstCell(row, idx, ["TTL_FIELD", "TTL_FIELDS", "TOTAL_FIELD", "TOTAL_FIELDS", "PURCHASED_FIELD", "PURCHASED_FIELDS"]));
    const groupId = normalizeCode(firstCell(row, idx, ["GROUP_ID", "GROUP ID", "PRODUCT_GROUP", "PRODUCT GROUP", "GROUP"]));
    const variantLabel = firstCell(row, idx, ["VARIANT_LABEL", "VARIANT LABEL", "VARIANT_NAME", "VARIANT NAME"]);
    const type = safeText(firstCell(row, idx, ["PRODUCT_TYPE", "PRODUCT TYPE", "TYPE", "UI_TYPE", "UI TYPE"]));

    products.push({
      code: normalizedCode,
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
      type,
      groupId,
      groupLabel: firstCell(row, idx, ["GROUP_LABEL", "GROUP LABEL", "GROUP_NAME", "GROUP NAME"]),
      variantLabel,
      addColumn,
      ttlFields,
      purchasedMode: safeText(firstCell(row, idx, ["PURCHASED_MODE", "PURCHASED MODE"])) || "any",
      disabledRule: safeText(firstCell(row, idx, ["DISABLED_RULE", "DISABLED RULE", "ELIGIBILITY_RULE", "ELIGIBILITY RULE"])),
      displayOrder: Number(firstCell(row, idx, ["DISPLAY_ORDER", "DISPLAY ORDER", "SORT_ORDER", "SORT ORDER", "ORDER"])) || r,
      maxQty: Number(firstCell(row, idx, ["MAX_QTY", "MAX QTY", "MAX_QUANTITY", "MAX QUANTITY"])) || 9,
    });
  }

  return {
    success: true,
    mode: "products",
    products,
  };
}

async function getProductColumns() {
  const result = await getProducts();
  return unique(
    (result.products || [])
      .map((product) => normalizeCode(product.addColumn) || `${normalizeCode(product.code)}_ADD`)
      .filter(Boolean)
  );
}

async function getPublicFields() {
  const result = await getProducts();
  const dynamicFields = (result.products || [])
    .flatMap((product) => product.ttlFields || [])
    .map(normalizeHeader)
    .filter(Boolean);

  return unique(BASE_PUBLIC_FIELDS.concat(dynamicFields, LEGACY_PRODUCT_TOTAL_FIELDS));
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
  const publicFields = await getPublicFields();
  publicFields.forEach((field) => {
    contestant[field] = getPublicField(matchedRow, idx, field);
  });

  return {
    success: true,
    mode: "lookup",
    lookupToken: createLookupToken(entryNo, yob, matchedRowNumber),
    contestant,
  };
}

async function getContestantByEntryNo(entryNo) {
  const target = normalizeCode(entryNo);
  if (!target) return null;

  const values = await readSheetValues(CLEAN_SHEET);
  if (!values || values.length < 2) return null;

  const headers = values[0].map(normalizeHeader);
  const idx = buildHeaderIndex(headers);
  if (idx.IND_CODE === undefined) return null;

  for (let r = 1; r < values.length; r += 1) {
    const row = values[r];
    if (normalizeCode(row[idx.IND_CODE]) !== target) continue;

    const data = {};
    const publicFields = await getPublicFields();
    publicFields.forEach((field) => {
      data[field] = getPublicField(row, idx, field);
    });

    return {
      data,
      rowNumber: r + 1,
    };
  }

  return null;
}

async function submit(payload) {
  const submission = parseSubmissionPayload(payload);
  const lookup = validateSubmissionLookup(submission);

  if (lookup.error) {
    return {
      success: false,
      code: lookup.code,
      message: lookup.message,
    };
  }

  if (isStripePaymentMethod(submission.paymentMethod) && Number(submission.totalPayable || 0) > 0) {
    return {
      success: false,
      code: "STRIPE_CHECKOUT_REQUIRED",
      message: "請使用「遞交並付款」完成信用卡 / 內地錢包付款。",
    };
  }

  const prepared = await prepareSubmissionForWrite(submission, lookup.payload, {
    includeStripeFee: false,
  });
  const result = await writeRawAddSubmission(prepared, lookup.payload);

  return {
    success: true,
    mode: "submit",
    submissionId: result.submissionId,
    amendToken: createAmendToken(result.submissionId),
    paymentSlip: result.paymentSlip || null,
    submission: result.submission,
    message: "已成功遞交",
  };
}

async function createCheckoutSession(payload) {
  const stripe = getStripeClient();
  const submission = parseSubmissionPayload(payload);
  const lookup = validateSubmissionLookup(submission);

  if (lookup.error) {
    return {
      success: false,
      code: lookup.code,
      message: lookup.message,
    };
  }

  if (!isStripePaymentMethod(submission.paymentMethod)) {
    return {
      success: false,
      code: "INVALID_PAYMENT_METHOD",
      message: "此付款方式不需要連接 Stripe。",
    };
  }

  const prepared = await prepareSubmissionForWrite(submission, lookup.payload, {
    includeStripeFee: true,
  });

  if (!prepared.items.length || prepared.productTotal <= 0) {
    return {
      success: false,
      code: "EMPTY_CART",
      message: "請先選擇加購項目。",
    };
  }

  const checkoutData = {
    submission: prepared,
    lookup: lookup.payload,
    createdAt: new Date().toISOString(),
  };
  const metadata = packCheckoutMetadata(checkoutData);
  const returnBaseUrl = normalizeReturnUrl(payload.returnUrl);
  const configResult = await getConfig();
  const competitionName = safeText(configResult.config && configResult.config.competitionName);
  const formatStripeItemName = (name) => (competitionName ? `${name} - ${competitionName}` : name);
  const lineItems = prepared.items.map((item) => ({
    price_data: {
      currency: STRIPE_CURRENCY,
      product_data: {
        name: formatStripeItemName(item.name || item.code),
      },
      unit_amount: toStripeAmount(item.unitPrice),
    },
    quantity: item.quantity,
  }));

  if (prepared.stripeHandlingFee > 0) {
    lineItems.push({
      price_data: {
        currency: STRIPE_CURRENCY,
        product_data: {
          name: formatStripeItemName("手續費 Surcharge (+4%)"),
        },
        unit_amount: toStripeAmount(prepared.stripeHandlingFee),
      },
      quantity: 1,
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    adaptive_pricing: {
      enabled: false,
    },
    payment_method_configuration: STRIPE_PAYMENT_METHOD_CONFIGURATION || undefined,
    payment_method_types: STRIPE_PAYMENT_METHOD_CONFIGURATION ? undefined : STRIPE_PAYMENT_METHOD_TYPES,
    payment_method_options: STRIPE_PAYMENT_METHOD_CONFIGURATION || STRIPE_PAYMENT_METHOD_TYPES.includes("wechat_pay")
      ? { wechat_pay: { client: "web" } }
      : undefined,
    customer_email: prepared.contactEmail || undefined,
    client_reference_id: prepared.submissionId,
    success_url: addStripeCheckoutSessionPlaceholder(addQueryParams(returnBaseUrl, {
      payment: "success",
      session_id: "{CHECKOUT_SESSION_ID}",
    })),
    cancel_url: addQueryParams(returnBaseUrl, {
      payment: "cancelled",
    }),
    metadata,
    payment_intent_data: {
      metadata: {
        submissionId: prepared.submissionId,
        entryNo: prepared.contestant.entryNo,
      },
    },
  });

  return {
    success: true,
    mode: "stripe_checkout",
    checkoutUrl: session.url,
    sessionId: session.id,
    submissionId: prepared.submissionId,
    totalPayable: prepared.totalPayable,
    stripeHandlingFee: prepared.stripeHandlingFee,
  };
}

async function getStripeCheckoutResult(payload) {
  const sessionId = safeText(payload.sessionId || payload.session_id);
  if (!sessionId) {
    return {
      success: false,
      code: "MISSING_SESSION_ID",
      message: "未能確認付款狀態，請聯絡本會跟進。",
    };
  }

  const result = await fulfillStripeCheckout(sessionId);
  if (!result || !result.paid) {
    return {
      success: false,
      code: "PAYMENT_NOT_CONFIRMED",
      message: "付款尚未完成，請重新付款或聯絡本會跟進。",
    };
  }

  return {
    success: true,
    mode: "stripe_checkout_result",
    submissionId: result.submissionId,
    amendToken: createAmendToken(result.submissionId),
    submission: result.submission,
    message: "已成功付款及遞交",
  };
}

async function fulfillStripeCheckout(sessionOrId) {
  const stripe = getStripeClient();
  const session = typeof sessionOrId === "string"
    ? await stripe.checkout.sessions.retrieve(sessionOrId)
    : sessionOrId;

  if (!session || session.payment_status !== "paid") {
    return { paid: false };
  }

  const checkoutData = unpackCheckoutMetadata(session.metadata || {});
  const headers = await ensureRawAddHeaders();
  const existing = await findRawAddRowByHeader(headers, "STRIPE_CHECKOUT_SESSION_ID", session.id);
  if (existing) {
    const idx = buildHeaderIndex(headers.map(normalizeHeader));
    const submissionId = getRowValue(existing.row, idx, "SubmissionId");
    return {
      paid: true,
      submissionId,
      submission: checkoutData.submission,
      alreadyFulfilled: true,
    };
  }

  const result = await writeRawAddSubmission(checkoutData.submission, checkoutData.lookup, {
    stripeSession: session,
  });

  return {
    paid: true,
    submissionId: result.submissionId,
    submission: result.submission,
    alreadyFulfilled: false,
  };
}

function validateSubmissionLookup(submission) {
  const token = safeText(submission.lookupToken);

  if (!token) {
    return {
      error: true,
      code: "MISSING_LOOKUP_TOKEN",
      message: "請先完成比賽成績查閱。",
    };
  }

  const payload = verifyLookupToken(token);
  if (!payload) {
    return {
      error: true,
      code: "LOOKUP_TOKEN_EXPIRED",
      message: "查閱授權已逾時，請重新查閱後再遞交。",
    };
  }

  return { payload };
}

async function prepareSubmissionForWrite(submission, lookup, options = {}) {
  const items = await verifyCartItems(submission.items || []);
  const productTotal = roundMoney(items.reduce((sum, item) => sum + item.total, 0));
  const includeStripeFee = Boolean(options.includeStripeFee && productTotal > 0);
  const stripeHandlingFee = includeStripeFee ? calculateStripeHandlingFee(productTotal) : 0;
  const totalPayable = roundMoney(productTotal + stripeHandlingFee);
  const targetSubmissionId = safeText(submission.previousSubmissionId);
  const timestamp = new Date();
  const submissionId = targetSubmissionId ||
    safeText(submission.submissionId) ||
    `AOT-${formatDate(timestamp, "yyyyMMdd-HHmmss")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const contestant = submission.contestant || {};

  return {
    lookupToken: safeText(submission.lookupToken),
    submissionId,
    previousSubmissionId: targetSubmissionId,
    contestant: {
      entryNo: safeText(contestant.entryNo) || lookup.entryNo,
      nameChi: safeText(contestant.nameChi),
      nameEn: safeText(contestant.nameEn),
      yob: safeText(contestant.yob) || lookup.yob,
      awardChi: safeText(contestant.awardChi),
    },
    contactNumber: safeText(submission.contactNumber).replace(/\D/g, ""),
    contactEmail: safeText(submission.contactEmail),
    enquiryText: safeText(submission.enquiryText),
    paymentMethod: safeText(submission.paymentMethod),
    payeeName: includeStripeFee ? "" : safeText(submission.payeeName),
    totalPayable,
    productTotal,
    stripeHandlingFee,
    paymentSlipUpload: includeStripeFee ? null : normalizePaymentSlipMetadata(submission.paymentSlipUpload),
    items,
  };
}

async function verifyCartItems(rawItems) {
  const result = await getProducts();
  const productMap = (result.products || []).reduce((map, product) => {
    map[normalizeCode(product.code)] = product;
    return map;
  }, {});
  const requested = new Map();

  (Array.isArray(rawItems) ? rawItems : []).forEach((item) => {
    const code = normalizeCode(item.code);
    const quantity = Math.floor(Number(item.quantity) || 0);
    if (!code || quantity <= 0) return;
    requested.set(code, (requested.get(code) || 0) + quantity);
  });

  return Array.from(requested.entries()).map(([code, quantity]) => {
    if (quantity > 99) {
      throw new Error("加購項目數量不正確，請重新選擇。");
    }

    const product = productMap[code];
    if (!product || normalizeStatus(product.shelfStatus) === "OFF" || normalizeStatus(product.shelfStatus) === "GREY OUT") {
      throw new Error("部分加購項目暫時不能加購，請重新選擇。");
    }

    const unitPrice = Number(product.price) || 0;
    const total = roundMoney(unitPrice * quantity);
    return {
      code,
      name: safeText(product.name) || code,
      quantity,
      unitPrice,
      total,
      addColumn: normalizeCode(product.addColumn) || `${code}_ADD`,
    };
  });
}

async function writeRawAddSubmission(submission, lookup, options = {}) {
  const timestamp = new Date();
  const totalPayable = Number(submission.totalPayable) || 0;
  const targetSubmissionId = safeText(submission.previousSubmissionId);
  const submissionId = targetSubmissionId ||
    safeText(submission.submissionId) ||
    `AOT-${formatDate(timestamp, "yyyyMMdd-HHmmss")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const contestant = submission.contestant || {};
  const paymentSlipInfo = normalizePaymentSlipMetadata(submission.paymentSlipUpload);
  const stripeSession = options.stripeSession || null;
  const isStripe = Boolean(stripeSession);
  const paymentProvider = isStripe
    ? "STRIPE"
    : (totalPayable > 0 ? "MANUAL" : "NONE");
  const paymentStatus = isStripe
    ? "PAID"
    : (totalPayable > 0 ? "PENDING_MANUAL_VERIFICATION" : "NOT_REQUIRED");

  const headers = await ensureRawAddHeaders();
  const idx = buildHeaderIndex(headers.map(normalizeHeader));
  const row = Array(headers.length).fill("");

  const formattedTimestamp = formatDate(timestamp, "yyyy-MM-dd HH:mm:ss");
  setRowValue(row, idx, "Submission Timestamp", targetSubmissionId
    ? (
        await getExistingRawAddValue(headers, targetSubmissionId, "Submission Timestamp") ||
        await getExistingRawAddValue(headers, targetSubmissionId, "Timestamp")
      )
    : formattedTimestamp);
  setRowValue(row, idx, "Last Update Timestamp", formattedTimestamp);
  setRowValue(row, idx, "SubmissionId", submissionId);
  setRowValue(row, idx, "lookupToken", "");
  setRowValue(row, idx, "IND_CODE", safeText(contestant.entryNo) || lookup.entryNo);
  setRowValue(row, idx, "YOB", safeText(contestant.yob) || lookup.yob);
  setRowValue(row, idx, "NAME_CHI", safeText(contestant.nameChi));
  setRowValue(row, idx, "NAME_EN", safeText(contestant.nameEn));
  setRowValue(row, idx, "重新輸入家長/聯絡人WhatsApp號碼 Contact Number", safeText(submission.contactNumber).replace(/\D/g, ""));
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
  setRowValue(row, idx, "PAYMENT_PROVIDER", paymentProvider);
  setRowValue(row, idx, "PAYMENT_STATUS", paymentStatus);

  if (paymentSlipInfo) {
    setRowValue(row, idx, "PAYMENT_SLIP_FILE_ID", paymentSlipInfo.fileId);
    setRowValue(row, idx, "PAYMENT_SLIP_FILE_NAME", paymentSlipInfo.fileName);
    setRowValue(row, idx, "PAYMENT_SLIP_FILE_URL", paymentSlipInfo.fileUrl);
    setRowValue(row, idx, "PAYMENT_SLIP_MIME_TYPE", paymentSlipInfo.mimeType);
    setRowValue(row, idx, "PAYMENT_SLIP_UPLOADED_AT", paymentSlipInfo.uploadedAt);
    setRowValue(row, idx, "PAYMENT_SLIP_UPLOAD_STATUS", "UPLOADED");
  } else {
    setRowValue(
      row,
      idx,
      "PAYMENT_SLIP_UPLOAD_STATUS",
      isStripe || totalPayable <= 0 ? "NOT_REQUIRED" : "PENDING_MANUAL_UPLOAD"
    );
  }

  if (isStripe) {
    setRowValue(row, idx, "STRIPE_CHECKOUT_SESSION_ID", safeText(stripeSession.id));
    setRowValue(row, idx, "STRIPE_PAYMENT_INTENT_ID", safeText(stripeSession.payment_intent));
    setRowValue(row, idx, "STRIPE_AMOUNT", Number(stripeSession.amount_total || 0) / 100);
    setRowValue(row, idx, "STRIPE_CURRENCY", safeText(stripeSession.currency).toUpperCase());
    setRowValue(row, idx, "STRIPE_PAID_AT", formatDate(timestamp, "yyyy-MM-dd HH:mm:ss"));
  }

  const productColumns = await getProductColumns();
  productColumns.forEach((column) => setRowValue(row, idx, column, ""));

  const items = Array.isArray(submission.items) ? submission.items : [];
  setRowValue(
    row,
    idx,
    "ADD_ON_SUMMARY",
    items.map((item) => [item.code, item.name, `x${item.quantity}`, `HK$${item.total}`].join(" ")).join("\n")
  );

  items.forEach((item) => {
    const column = normalizeCode(item.addColumn) || `${normalizeCode(item.code)}_ADD`;
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
    submissionId,
    paymentSlip: paymentSlipInfo || null,
    submission: {
      ...submission,
      submissionId,
      totalPayable,
      paymentSlipUpload: paymentSlipInfo || null,
    },
  };
}

async function lookupAmendment(payload) {
  const token = safeText(payload.token || payload.amendToken);
  const tokenPayload = verifyAmendToken(token);
  if (!tokenPayload || !tokenPayload.submissionId) {
    return {
      success: false,
      code: "INVALID_AMEND_TOKEN",
      message: "修改連結無效，請重新查閱得獎者資料。",
    };
  }

  const headers = await ensureRawAddHeaders();
  const idx = buildHeaderIndex(headers.map(normalizeHeader));
  const rowNumber = await findRawAddRowNumberBySubmissionId(headers, tokenPayload.submissionId);
  if (!rowNumber) {
    return {
      success: false,
      code: "SUBMISSION_NOT_FOUND",
      message: "找不到提交記錄，請重新查閱得獎者資料。",
    };
  }

  const rows = await readSheetValues(RAW_ADD_SHEET, `!A${rowNumber}:${columnLetter(headers.length)}${rowNumber}`);
  const row = rows?.[0] || [];
  const entryNo = getRowValue(row, idx, "IND_CODE");
  const yob = getRowValue(row, idx, "YOB");
  const contestant = await getContestantByEntryNo(entryNo);
  if (!contestant) {
    return {
      success: false,
      code: "CONTESTANT_NOT_FOUND",
      message: "找不到參賽者資料，請重新查閱得獎者資料。",
    };
  }

  return {
    success: true,
    mode: "amend",
    submissionId: tokenPayload.submissionId,
    lookupToken: createLookupToken(entryNo, yob, contestant.rowNumber || 0),
    contestant: contestant.data,
    submission: await buildAmendSubmissionFromRow(row, idx),
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
  const requiredHeaders = BASE_RAW_ADD_HEADERS.concat(await getProductColumns());
  const missing = requiredHeaders.filter((header) => normalized[normalizeHeader(header)] === undefined);
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

async function getExistingRawAddValue(headers, submissionId, header) {
  const target = safeText(submissionId);
  if (!target) return "";

  const idx = buildHeaderIndex(headers.map(normalizeHeader));
  const submissionIdIndex = idx[normalizeHeader("SubmissionId")];
  const valueIndex = idx[normalizeHeader(header)];
  if (submissionIdIndex === undefined || valueIndex === undefined) return "";

  const rows = await readSheetValues(RAW_ADD_SHEET, `!A2:${columnLetter(headers.length)}`);
  if (!rows || !rows.length) return "";

  const row = rows.find((item) => safeText(item[submissionIdIndex]) === target);
  return row ? safeText(row[valueIndex]) : "";
}

async function findRawAddRowByHeader(headers, header, value) {
  const target = safeText(value);
  if (!target) return null;

  const idx = buildHeaderIndex(headers.map(normalizeHeader));
  const valueIndex = idx[normalizeHeader(header)];
  if (valueIndex === undefined) return null;

  const rows = await readSheetValues(RAW_ADD_SHEET, `!A2:${columnLetter(headers.length)}`);
  if (!rows || !rows.length) return null;

  const matchIndex = rows.findIndex((row) => safeText(row[valueIndex]) === target);
  if (matchIndex < 0) return null;

  return {
    rowNumber: matchIndex + 2,
    row: rows[matchIndex],
  };
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

function getStripeClient() {
  if (!STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(STRIPE_SECRET_KEY);
  }

  return stripeClient;
}

function isStripePaymentMethod(value) {
  const method = safeText(value);
  return method === STRIPE_PAYMENT_METHOD ||
    (/信用卡|WeChat Pay|內地版|\+4%/.test(method) && !/PayMe|AlipayHK|港版/.test(method));
}

function calculateStripeHandlingFee(productTotal) {
  return roundMoney(Number(productTotal || 0) * STRIPE_HANDLING_FEE_RATE);
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function toStripeAmount(value) {
  return Math.round(roundMoney(value) * 100);
}

function packCheckoutMetadata(data) {
  const json = JSON.stringify(data);
  const packed = zlib.deflateRawSync(Buffer.from(json, "utf8")).toString("base64url");
  const signature = crypto
    .createHmac("sha256", LOOKUP_TOKEN_SECRET)
    .update(packed)
    .digest("base64url");
  const chunkSize = 480;
  const chunks = packed.match(new RegExp(`.{1,${chunkSize}}`, "g")) || [];

  if (chunks.length > 45) {
    throw new Error("Checkout payload is too large for Stripe metadata.");
  }

  return chunks.reduce(
    (metadata, chunk, index) => {
      metadata[`aot_${index}`] = chunk;
      return metadata;
    },
    {
      aot_chunks: String(chunks.length),
      aot_sig: signature,
      aot_version: "1",
    }
  );
}

function unpackCheckoutMetadata(metadata) {
  const count = Number(metadata.aot_chunks || 0);
  const signature = safeText(metadata.aot_sig);

  if (!count || !signature) {
    throw new Error("Stripe checkout metadata is missing.");
  }

  const packed = Array.from({ length: count }, (_, index) => safeText(metadata[`aot_${index}`])).join("");
  const expected = crypto
    .createHmac("sha256", LOOKUP_TOKEN_SECRET)
    .update(packed)
    .digest("base64url");

  if (!timingSafeEqual(signature, expected)) {
    throw new Error("Stripe checkout metadata signature is invalid.");
  }

  const json = zlib.inflateRawSync(Buffer.from(packed, "base64url")).toString("utf8");
  return JSON.parse(json);
}

function normalizeReturnUrl(value) {
  const fallback = PUBLIC_SITE_URL;

  try {
    const url = new URL(safeText(value) || fallback);
    if (!/^https?:$/i.test(url.protocol)) return fallback;
    if (!isAllowedOrigin(url.origin)) return fallback;

    url.search = "";
    url.hash = "";
    return url.toString();
  } catch (error) {
    return fallback;
  }
}

function addQueryParams(baseUrl, params) {
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
}

function addStripeCheckoutSessionPlaceholder(url) {
  return url.replace("%7BCHECKOUT_SESSION_ID%7D", "{CHECKOUT_SESSION_ID}");
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

function getRowValue(row, idx, header) {
  const key = normalizeHeader(header);
  return idx[key] === undefined ? "" : safeText(row[idx[key]]);
}

function parseConfigList(value) {
  return safeText(value)
    .split(/[\n,;|]+/)
    .map((item) => normalizeHeader(item))
    .filter(Boolean);
}

function unique(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

async function buildAmendSubmissionFromRow(row, idx) {
  const productResult = await getProducts();
  const addColumnMap = (productResult.products || []).reduce((map, product) => {
    const column = normalizeCode(product.addColumn) || `${normalizeCode(product.code)}_ADD`;
    map[column] = normalizeCode(product.code);
    return map;
  }, {});
  const productColumns = unique(Object.keys(addColumnMap));
  return {
    contactNumber: getRowValue(row, idx, "重新輸入家長/聯絡人WhatsApp號碼 Contact Number"),
    contactEmail: getRowValue(row, idx, "重新輸入家長/聯絡人電郵地址 Email Address of Contact Person"),
    enquiryText: getRowValue(
      row,
      idx,
      "更正參賽者資料 / 收貨地址 / 其他查詢 Edit participant's information or other enquiries（ 請輸入完整句子 Please write in complete sentences）"
    ),
    paymentMethod: getRowValue(row, idx, "本人將會以下列方式向本會付款 Method of Payment"),
    payeeName: getRowValue(row, idx, "付款帳戶之英文姓名 Name of Payee Account"),
    totalPayable: Number(getRowValue(row, idx, "應付總數 Total Payable")) || 0,
    items: productColumns
      .map((column) => {
        const quantity = Number(getRowValue(row, idx, column)) || 0;
        return quantity > 0
          ? { code: addColumnMap[column] || column.replace(/_ADD$/, ""), quantity }
          : null;
      })
      .filter(Boolean),
  };
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

function normalizeStatus(value) {
  return safeText(value).toUpperCase();
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

function createAmendToken(submissionId) {
  const body = base64UrlEncode(JSON.stringify({
    typ: "amend",
    submissionId,
  }));
  const signature = crypto
    .createHmac("sha256", LOOKUP_TOKEN_SECRET)
    .update(body)
    .digest("base64url");

  return `${body}.${signature}`;
}

function verifyAmendToken(token) {
  const [body, signature] = safeText(token).split(".");
  if (!body || !signature) return null;

  const expected = crypto
    .createHmac("sha256", LOOKUP_TOKEN_SECRET)
    .update(body)
    .digest("base64url");

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(body));
    return payload && payload.typ === "amend" ? payload : null;
  } catch (error) {
    return null;
  }
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
