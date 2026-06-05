# Architecture

## Current Architecture

```text
GitHub Pages frontend
  -> JSONP request
  -> Google Apps Script Web App
  -> Google Sheet
```

Payment slip upload has a prepared Cloud Run path, but it remains disabled
until the Cloud Run service URL is deployed and configured:

```text
GitHub Pages frontend
  -> Cloud Run multipart upload endpoint
  -> Google Drive upload folder
  -> Apps Script submit request with file metadata
  -> Google Sheet RAW_ADD
```

## Components

| Component | Location | Purpose |
|---|---|---|
| Frontend | Repo root: `index.html`, `app.js`, `styles.css` | Static user-facing web app served by GitHub Pages |
| Frontend copy | `frontend/` | Local/source copy kept in sync with root files |
| Apps Script source | `apps-script/AddonTrialWebApp.gs` | Source copy of the web app API |
| Apps Script deploy copy | `.clasp-deploy/AddonTrialWebApp.js` | File pushed by clasp to the bound Apps Script project |
| Cloud Run upload API | `cloud-run-upload/` | Optional multipart upload endpoint for payment slips |
| Database | Google Sheet tabs | Lookup data, product config, webapp config, and submissions |

## Why JSONP

GitHub Pages is a static frontend on a different origin from Apps Script.
Apps Script `ContentService` cannot reliably support custom CORS headers for
all browser cases. The app therefore uses JSONP GET requests for:

- config
- lookup
- products
- submit

This is acceptable for small form payloads, but not for file uploads.

## Security Model

1. User performs lookup using entry number, name, and year of birth.
2. Apps Script verifies the user against `_CLEAN`.
3. Apps Script returns a short-lived `lookupToken`.
4. Submit requires the `lookupToken`.
5. `lookupToken` is never recorded in `RAW_ADD`.

The token is stored in Apps Script `CacheService` for one hour.

## Production URLs

Frontend:

```text
https://hkycaa.github.io/yc-add-on-items/
```

Apps Script:

```text
https://script.google.com/macros/s/AKfycbzYPo_Yix46JXfEM1nXSXffo7UFO7XfPwyE4S6raf8GVmgRCKHdbt1E3ZAvU1Lwh2Hg/exec
```
