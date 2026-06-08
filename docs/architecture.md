# Architecture

## Current Architecture

```text
GitHub Pages frontend
  -> Cloud Run API
     -> Google Sheet
     -> Stripe Checkout / webhook
  -> Apps Script fetch/JSONP fallback
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

Stripe payment uses hosted Checkout and writes to the sheet only after payment
success:

```text
GitHub Pages frontend
  -> Cloud Run createCheckoutSession
  -> Stripe Checkout
  -> Cloud Run /stripe/webhook
  -> Google Sheet RAW_ADD
```

## Components

| Component | Location | Purpose |
|---|---|---|
| Frontend | Repo root: `index.html`, `app.js`, `styles.css` | Static user-facing web app served by GitHub Pages |
| Frontend copy | `frontend/` | Local/source copy kept in sync with root files |
| Apps Script source | `apps-script/AddonTrialWebApp.gs` | Legacy/reference API plus Drive upload bridge |
| Apps Script deploy copy | `.clasp-deploy/AddonTrialWebApp.js` | File pushed by clasp to the bound Apps Script project |
| Cloud Run API | `cloud-run-upload/` | Config/products/lookup/amend/submit APIs, multipart upload bridge for payment slips, Stripe Checkout creation, Stripe webhook fulfillment |
| Stripe | Stripe Dashboard | Hosted credit card / Alipay China / WeChat Pay China payment gateway |
| Database | Google Sheet tabs | Lookup data, product config, webapp config, and submissions |

## Layer Ownership

| Layer | Owns |
|---|---|
| Google Sheet | `_CLEAN`, `PRODUCT LIST`, `WEBAPP_CONFIG`, `RAW_ADD` |
| Apps Script | Drive file creation for payment slips |
| Cloud Run | Config/product APIs, lookup validation, signed lookup tokens, signed amendment tokens, direct/manual submission writes, multipart payment-slip upload endpoint and server-to-server forwarding to Apps Script, Stripe session creation and paid webhook writes |
| GitHub Pages | Static UI, frontend validation, cart calculation, payment-method rules, local Stripe draft restore, API orchestration |
| Stripe | Hosted Checkout page, payment receipt, `checkout.session.completed` webhook |

## Why JSONP

GitHub Pages is a static frontend on a different origin from Cloud Run. The
app tries Cloud Run with normal `fetch` first. The frontend keeps the legacy
Apps Script API as a fetch/JSONP fallback for:

- config
- lookup
- products
- submit, only as fallback; normal submit uses POST

Final submit uses POST to Cloud Run, then falls back to the legacy Apps Script
route if the Cloud Run action API is unavailable. File uploads always use Cloud
Run.

## Security Model

1. User performs lookup using entry number, name, and year of birth.
2. Cloud Run verifies the user against `_CLEAN`.
3. Cloud Run returns a signed one-hour `lookupToken`.
4. Submit requires the `lookupToken`.
5. Manual/no-payment submit writes to `RAW_ADD` directly.
6. Stripe submit creates a Checkout Session and writes to `RAW_ADD` only after
   successful Stripe confirmation.
7. `lookupToken` is never recorded in `RAW_ADD`.
8. Successful submit returns a signed non-expiring `amendToken`.
9. Amendment URLs use `?amend=<signed-token>` to reopen the same `SubmissionId`
   and overwrite its `RAW_ADD` row on resubmit.

Lookup and amendment tokens are verified with `LOOKUP_TOKEN_SECRET`.

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
https://hkycaa-add-on-upload-965808237264.asia-east2.run.app
```

Stripe webhook:

```text
https://hkycaa-add-on-upload-965808237264.asia-east2.run.app/stripe/webhook
```
