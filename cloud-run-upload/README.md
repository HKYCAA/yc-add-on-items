# Cloud Run API

This service handles the public Add-On Trial APIs from the GitHub Pages
frontend:

- `GET /?action=config`
- `GET /?action=lookup`
- `GET /?action=products`
- `POST /?action=submit`
- `POST /upload`

Payment slip files are still forwarded to Apps Script because Apps Script writes
the files to Google Drive as `info@hkycaa.org`.

During rollout, the frontend keeps `LEGACY_WEB_APP_URL` as a fallback. If the
deployed Cloud Run revision still returns `404` for `/?action=lookup`, users can
continue through the Apps Script fallback until this service is redeployed.

## Required Google Cloud Setup

1. Google Cloud account: `info@hkycaa.org`
2. A Google Cloud project with Cloud Run enabled
3. A Cloud Run service account
4. Apps Script web app deployed with access to the Drive upload folder

Drive folder currently reserved for uploads:

```text
1OhhgPtIIsPlezjTrzVlnNKQwaMR0nAB7
```

## Environment Variables

| Variable | Example | Purpose |
|---|---|---|
| `SHEET_ID` | `1ZY23Cx5PYEQ5GSc_VrXBIMnHirLhh6F0uFsUtCt2Eqo` | Google Sheet database |
| `LOOKUP_TOKEN_SECRET` | long random string | Signs one-hour lookup tokens |
| `TZ` | `Asia/Hong_Kong` | Timestamp timezone |
| `DRIVE_FOLDER_ID` | `1OhhgPtIIsPlezjTrzVlnNKQwaMR0nAB7` | Google Drive destination folder |
| `APPS_SCRIPT_UPLOAD_URL` | Apps Script web app URL | Server-side upload bridge |
| `ALLOWED_ORIGINS` | `https://hkycaa.github.io` | Comma-separated browser origins allowed to upload |
| `MAX_UPLOAD_BYTES` | `10485760` | Max upload size in bytes |

## Endpoints

### `GET /health`

Returns service health and configured route checks.

### `GET /?action=config`

Reads `WEBAPP_CONFIG` and returns section 0 content.

### `GET /?action=lookup`

Validates `entryNo`, `name`, and `yob` against `_CLEAN`, then returns public
contestant fields and a signed one-hour `lookupToken`.

### `GET /?action=products`

Reads normalized product rows from `PRODUCT LIST`.

### `POST /?action=submit`

Validates the signed `lookupToken` and appends a row to `RAW_ADD`.

### `POST /upload`

Multipart form-data fields:

- `file`: uploaded file
- `entryNo`: contestant entry number
- `uploadType`: usually `payment-slip`

Response:

```json
{
  "success": true,
  "file": {
    "fileId": "...",
    "fileName": "...",
    "fileUrl": "...",
    "mimeType": "...",
    "size": "...",
    "uploadedAt": "..."
  }
}
```

Cloud Run gets this metadata from Apps Script. The frontend passes it back to
Cloud Run during final submit, then Cloud Run writes the metadata to `RAW_ADD`.

## Deploy

Install and authenticate Google Cloud CLI first:

```bash
gcloud auth login info@hkycaa.org
gcloud config set project <PROJECT_ID>
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com drive.googleapis.com
```

Deploy:

```bash
gcloud run deploy hkycaa-add-on-upload \
  --source ./cloud-run-upload \
  --region asia-east2 \
  --allow-unauthenticated \
  --set-env-vars SHEET_ID=1ZY23Cx5PYEQ5GSc_VrXBIMnHirLhh6F0uFsUtCt2Eqo,LOOKUP_TOKEN_SECRET=<long-random-secret>,TZ=Asia/Hong_Kong,DRIVE_FOLDER_ID=1OhhgPtIIsPlezjTrzVlnNKQwaMR0nAB7,APPS_SCRIPT_UPLOAD_URL=https://script.google.com/macros/s/AKfycbzYPo_Yix46JXfEM1nXSXffo7UFO7XfPwyE4S6raf8GVmgRCKHdbt1E3ZAvU1Lwh2Hg/exec,ALLOWED_ORIGINS=https://hkycaa.github.io,MAX_UPLOAD_BYTES=10485760
```

After deploy:

1. Share the Google Sheet with the Cloud Run runtime service account.
2. Copy the Cloud Run service URL into `WEB_APP_URL` and `CLOUD_RUN_UPLOAD_URL` in `app.js`.
3. Keep `LEGACY_WEB_APP_URL` until `config`, `lookup`, `products`, and `submit`
   are verified on the deployed Cloud Run URL.
4. Redeploy GitHub Pages if the frontend URL changes.

The upload input is disabled in HTML by default. Frontend JavaScript enables it
automatically when `CLOUD_RUN_UPLOAD_URL` is not empty.

Cloud Run intentionally does not write directly to Drive. Google Drive service
accounts do not have storage quota for ordinary My Drive folders, so Apps Script
performs the actual Drive write.
