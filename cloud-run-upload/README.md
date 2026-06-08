# Cloud Run API

This service handles the public Add-On Trial APIs from the GitHub Pages
frontend:

- `GET /?action=config`
- `GET /?action=lookup`
- `GET /?action=amend`
- `GET /?action=products`
- `POST /?action=submit`
- `POST /?action=createCheckoutSession`
- `GET /?action=stripeCheckoutResult`
- `POST /stripe/webhook`
- `POST /upload`

Payment slip files are still forwarded to Apps Script because Apps Script writes
the files to Google Drive as `info@hkycaa.org`.

Stripe Checkout is used for credit card / Alipay China / WeChat Pay China. The
service creates dynamic Stripe Checkout line items from Google Sheet
`PRODUCT LIST`, adds the 4% surcharge line, verifies Stripe webhooks, and writes
`RAW_ADD` only after successful payment.

The frontend keeps `LEGACY_WEB_APP_URL` as a fallback so users can continue
through the Apps Script action API if Cloud Run action routes are temporarily
unavailable.

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
| `LOOKUP_TOKEN_SECRET` | long random string | Signs one-hour lookup tokens and non-expiring amendment tokens |
| `TZ` | `Asia/Hong_Kong` | Timestamp timezone |
| `DRIVE_FOLDER_ID` | `1OhhgPtIIsPlezjTrzVlnNKQwaMR0nAB7` | Google Drive destination folder |
| `APPS_SCRIPT_UPLOAD_URL` | Apps Script web app URL | Server-side upload bridge |
| `ALLOWED_ORIGINS` | `https://hkycaa.github.io` | Comma-separated browser origins allowed to upload |
| `MAX_UPLOAD_BYTES` | `10485760` | Max upload size in bytes |
| `STRIPE_SECRET_KEY` | `sk_test_...` or `sk_live_...` | Stripe API key for Checkout Session creation |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Stripe webhook signing secret |
| `PUBLIC_SITE_URL` | `https://hkycaa.github.io/yc-add-on-items/` | Stripe success/cancel return URL base |
| `STRIPE_CURRENCY` | `hkd` | Optional Checkout currency override |
| `STRIPE_HANDLING_FEE_RATE` | `0.04` | Optional surcharge rate |
| `STRIPE_PAYMENT_METHOD_TYPES` | `card,link,alipay,wechat_pay` | Optional comma-separated Checkout payment methods to request |

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

Validates the signed `lookupToken` and writes no-payment/manual-payment
submissions to `RAW_ADD`. Initial submit appends a row. When the frontend sends
the current submission ID from the Section 6 edit/amend flow, the service
overwrites the existing `RAW_ADD` row for that `SubmissionId`.

The response includes `amendToken`, a signed non-expiring token used by the
frontend to generate the Section 6 amendment URL.

Stripe submissions do not use this endpoint to write `RAW_ADD` before payment.

### `POST /?action=createCheckoutSession`

Validates the signed `lookupToken`, recalculates selected products from
`PRODUCT LIST`, adds `手續費 Surcharge (+4%)`, stores signed/compressed metadata
in the Stripe Checkout Session, and returns the hosted Checkout URL.

Stripe line item names include `WEBAPP_CONFIG.competitionName` so Stripe
receipts show the competition context. Product descriptions are intentionally
not sent to Stripe to avoid duplicated text on Checkout.

The default requested methods are `card`, `link`, `alipay`, and `wechat_pay`.
Apple Pay and Google Pay are wallet options under card payments; Stripe shows
them only when the account settings, registered domain, customer browser/device,
and wallet setup are eligible.

### `GET /?action=stripeCheckoutResult`

Used when the browser returns from Stripe. Confirms the Checkout Session result
and returns the Section 6 submission summary when the payment is paid.

### `POST /stripe/webhook`

Receives Stripe webhook events. The required event is
`checkout.session.completed`. The service verifies `STRIPE_WEBHOOK_SECRET` and
writes the final paid submission to `RAW_ADD`.

### `GET /?action=amend`

Validates `token`, reads the matching `RAW_ADD` row, and returns contestant
data plus saved contact/payment/cart values so the frontend can reopen the form
in resubmit mode.

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
  --set-env-vars SHEET_ID=1ZY23Cx5PYEQ5GSc_VrXBIMnHirLhh6F0uFsUtCt2Eqo,LOOKUP_TOKEN_SECRET=<long-random-secret>,TZ=Asia/Hong_Kong,DRIVE_FOLDER_ID=1OhhgPtIIsPlezjTrzVlnNKQwaMR0nAB7,APPS_SCRIPT_UPLOAD_URL=https://script.google.com/macros/s/AKfycbzYPo_Yix46JXfEM1nXSXffo7UFO7XfPwyE4S6raf8GVmgRCKHdbt1E3ZAvU1Lwh2Hg/exec,ALLOWED_ORIGINS=https://hkycaa.github.io,MAX_UPLOAD_BYTES=10485760,PUBLIC_SITE_URL=https://hkycaa.github.io/yc-add-on-items/,STRIPE_CURRENCY=hkd,STRIPE_HANDLING_FEE_RATE=0.04,STRIPE_PAYMENT_METHOD_TYPES=card\\,link\\,alipay\\,wechat_pay
```

Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` separately with
`gcloud run services update` or Secret Manager. Do not commit Stripe keys.

After deploy:

1. Share the Google Sheet with the Cloud Run runtime service account.
2. Copy the Cloud Run service URL into `WEB_APP_URL` and `CLOUD_RUN_UPLOAD_URL` in `app.js`.
3. Keep `LEGACY_WEB_APP_URL` as the legacy action API fallback.
4. Redeploy GitHub Pages if the frontend URL changes.

The upload input is disabled in HTML by default. Frontend JavaScript enables it
automatically when `CLOUD_RUN_UPLOAD_URL` is not empty.

Direct local `file://` testing sends `Origin: null`; this service permits that
origin in code so local `index.html` can call the API during development.

Cloud Run intentionally does not write directly to Drive. Google Drive service
accounts do not have storage quota for ordinary My Drive folders, so Apps Script
performs the actual Drive write.
