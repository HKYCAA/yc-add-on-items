import express from "express";
import multer from "multer";
const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.MAX_UPLOAD_BYTES || 10 * 1024 * 1024),
  },
});

const driveFolderId = process.env.DRIVE_FOLDER_ID;
const appsScriptUploadUrl = process.env.APPS_SCRIPT_UPLOAD_URL;
const allowedOrigins = new Set(
  String(process.env.ALLOWED_ORIGINS || "https://hkycaa.github.io")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

app.use((req, res, next) => {
  const origin = req.get("origin");
  if (origin && allowedOrigins.has(origin)) {
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
    service: "hkycaa-add-on-upload-api",
    driveFolderConfigured: Boolean(driveFolderId),
    appsScriptUploadConfigured: Boolean(appsScriptUploadUrl),
  });
});

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!appsScriptUploadUrl) {
      res.status(500).json({
        success: false,
        code: "MISSING_APPS_SCRIPT_UPLOAD_URL",
        message: "Upload bridge is not configured.",
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        success: false,
        code: "MISSING_FILE",
        message: "No file was uploaded.",
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
      message: "Unable to upload file.",
      detail: String(error && error.message ? error.message : error),
    });
  }
});

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
  console.log(`Upload API listening on ${port}`);
});

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
