# Architecture

## Current Architecture

```text
GitHub Pages frontend
  -> Cloud Run API
     -> Google Sheet
  -> Apps Script fetch/JSONP fallback during rollout
     -> Google Sheet
```

Payment slip upload uses Cloud Run for browser multipart transport, then Apps
Script writes the file to Drive:

```text
GitHub Pages frontend
  -> Cloud Run multipart upload endpoint
  -> Apps Script uploadPaymentSlip POST
  -> Google Drive upload folder
  -> Cloud Run submit request with returned file metadata
  -> Google Sheet RAW_ADD
```

## Components

| Component | Location | Purpose |
|---|---|---|
| Frontend | Repo root: `index.html`, `app.js`, `styles.css` | Static user-facing web app served by GitHub Pages |
| Frontend copy | `frontend/` | Local/source copy kept in sync with root files |
| Apps Script source | `apps-script/AddonTrialWebApp.gs` | Legacy/reference API plus Drive upload bridge |
| Apps Script deploy copy | `.clasp-deploy/AddonTrialWebApp.js` | File pushed by clasp to the bound Apps Script project |
| Cloud Run API | `cloud-run-upload/` | Config/products/lookup/submit APIs plus multipart upload bridge for payment slips |
| Database | Google Sheet tabs | Lookup data, product config, webapp config, and submissions |

## Layer Ownership

| Layer | Owns |
|---|---|
| Google Sheet | `_CLEAN`, `PRODUCT LIST`, `WEBAPP_CONFIG`, `RAW_ADD` |
| Apps Script | Drive file creation for payment slips |
| Cloud Run | Config/product APIs, lookup validation, signed lookup tokens, submission writes, multipart payment-slip upload endpoint and server-to-server forwarding to Apps Script |
| GitHub Pages | Static UI, frontend validation, cart calculation, API orchestration |

## Why JSONP

GitHub Pages is a static frontend on a different origin from Cloud Run. The
app tries Cloud Run with normal `fetch` first. Until the deployed Cloud Run
revision is verified for all action routes, the frontend falls back to the
legacy Apps Script API with fetch/JSONP for:

- config
- lookup
- products
- submit, only as fallback; normal submit uses POST

Final submit uses POST to Cloud Run when available, then falls back to the
legacy Apps Script route if the Cloud Run action API is not live. File uploads
always use Cloud Run.

## Security Model

1. User performs lookup using entry number, name, and year of birth.
2. Cloud Run verifies the user against `_CLEAN`.
3. Cloud Run returns a short-lived signed `lookupToken`.
4. Submit requires the `lookupToken`.
5. `lookupToken` is never recorded in `RAW_ADD`.

The token expires after one hour and is verified with `LOOKUP_TOKEN_SECRET`.

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
