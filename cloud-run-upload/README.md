# Cloud Run Upload API

This service receives payment slip files from the GitHub Pages frontend and
forwards them to Apps Script. Apps Script then writes the files to Google Drive
as `info@hkycaa.org`.

The current production frontend keeps upload disabled until the Cloud Run URL is
known and configured in `app.js`.

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
| `DRIVE_FOLDER_ID` | `1OhhgPtIIsPlezjTrzVlnNKQwaMR0nAB7` | Google Drive destination folder |
| `APPS_SCRIPT_UPLOAD_URL` | Apps Script web app URL | Server-side upload bridge |
| `ALLOWED_ORIGINS` | `https://hkycaa.github.io` | Comma-separated browser origins allowed to upload |
| `MAX_UPLOAD_BYTES` | `10485760` | Max upload size in bytes |

## Endpoints

### `GET /health`

Returns service health and whether Drive folder env var is configured.

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

Cloud Run gets this metadata from Apps Script. The frontend passes it to Apps
Script during final submit, and Apps Script then writes the metadata to
`RAW_ADD`.

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
  --set-env-vars DRIVE_FOLDER_ID=1OhhgPtIIsPlezjTrzVlnNKQwaMR0nAB7,APPS_SCRIPT_UPLOAD_URL=https://script.google.com/macros/s/AKfycbzYPo_Yix46JXfEM1nXSXffo7UFO7XfPwyE4S6raf8GVmgRCKHdbt1E3ZAvU1Lwh2Hg/exec,ALLOWED_ORIGINS=https://hkycaa.github.io,MAX_UPLOAD_BYTES=10485760
```

After deploy:

1. Copy the Cloud Run service URL into `CLOUD_RUN_UPLOAD_URL` in `app.js`.
2. Redeploy GitHub Pages if the frontend URL changes.

The upload input is disabled in HTML by default. Frontend JavaScript enables it
automatically when `CLOUD_RUN_UPLOAD_URL` is not empty.

Cloud Run intentionally does not write directly to Drive. Google Drive service
accounts do not have storage quota for ordinary My Drive folders, so Apps Script
performs the actual Drive write.
