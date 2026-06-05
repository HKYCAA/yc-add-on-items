import express from "express";
import multer from "multer";
import { drive } from "@googleapis/drive";
import { GoogleAuth } from "google-auth-library";
import { Readable } from "node:stream";

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.MAX_UPLOAD_BYTES || 10 * 1024 * 1024),
  },
});

const driveFolderId = process.env.DRIVE_FOLDER_ID;
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
  });
});

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!driveFolderId) {
      res.status(500).json({
        success: false,
        code: "MISSING_DRIVE_FOLDER_ID",
        message: "Upload folder is not configured.",
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

    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });
    const driveClient = drive({ version: "v3", auth });

    const created = await driveClient.files.create({
      requestBody: {
        name: fileName,
        parents: [driveFolderId],
      },
      media: {
        mimeType: req.file.mimetype || "application/octet-stream",
        body: Readable.from(req.file.buffer),
      },
      fields: "id,name,mimeType,webViewLink,size,createdTime",
      supportsAllDrives: true,
    });

    res.json({
      success: true,
      file: {
        fileId: created.data.id,
        fileName: created.data.name,
        fileUrl: created.data.webViewLink,
        mimeType: created.data.mimeType,
        size: created.data.size,
        uploadedAt: created.data.createdTime,
      },
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
