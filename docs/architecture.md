# Architecture

## Current Architecture

```text
GitHub Pages frontend
  -> fetch request, with JSONP fallback
  -> Google Apps Script Web App
  -> Google Sheet
```

Payment slip upload uses Cloud Run for browser multipart transport, then Apps
Script writes the file to Drive:

```text
GitHub Pages frontend
  -> Cloud Run multipart upload endpoint
  -> Apps Script uploadPaymentSlip POST
  -> Google Drive upload folder
  -> Apps Script submit request with returned file metadata
  -> Google Sheet RAW_ADD
```

## Components

| Component | Location | Purpose |
|---|---|---|
| Frontend | Repo root: `index.html`, `app.js`, `styles.css` | Static user-facing web app served by GitHub Pages |
| Frontend copy | `frontend/` | Local/source copy kept in sync with root files |
| Apps Script source | `apps-script/AddonTrialWebApp.gs` | Source copy of the web app API |
| Apps Script deploy copy | `.clasp-deploy/AddonTrialWebApp.js` | File pushed by clasp to the bound Apps Script project |
| Cloud Run upload API | `cloud-run-upload/` | Multipart upload bridge for payment slips |
| Database | Google Sheet tabs | Lookup data, product config, webapp config, and submissions |

## Layer Ownership

| Layer | Owns |
|---|---|
| Google Sheet | `_CLEAN`, `PRODUCT LIST`, `WEBAPP_CONFIG`, `RAW_ADD` |
| Apps Script | Lookup validation, short-lived lookup tokens, config/product APIs, submission writes, Drive file creation |
| Cloud Run | Multipart payment-slip upload endpoint and server-to-server forwarding to Apps Script |
| GitHub Pages | Static UI, frontend validation, cart calculation, API orchestration |

## Why JSONP

GitHub Pages is a static frontend on a different origin from Apps Script. The
app now tries normal `fetch` first because Apps Script returns
`access-control-allow-origin: *` for the current web app response. JSONP remains
as a fallback for:

- config
- lookup
- products
- submit

This is acceptable for small form payloads, but not for file uploads. File
uploads use Cloud Run instead.

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

Cloud Run:

```text
https://hkycaa-add-on-upload-difkgqkl2q-df.a.run.app
```
