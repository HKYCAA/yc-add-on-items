# Deployment and Operations

## GitHub Pages

Production frontend:

```text
https://hkycaa.github.io/yc-add-on-items/
```

The repo is pushed to:

```text
https://github.com/HKYCAA/yc-add-on-items
```

GitHub Pages publishes from the root of `main`.

## Apps Script

Bound project deploy directory:

```text
.clasp-deploy
```

Push Apps Script:

```bash
npx --yes @google/clasp push --force
```

Deploy to the existing web app deployment:

```bash
npx --yes @google/clasp deploy \
  --deploymentId AKfycbzYPo_Yix46JXfEM1nXSXffo7UFO7XfPwyE4S6raf8GVmgRCKHdbt1E3ZAvU1Lwh2Hg \
  --description "Describe the change"
```

Do not create a new deployment ID unless intentionally changing the public web
app URL.

## Cloud Run API

Cloud Run owns the public action APIs and payment slip upload transport. The service source is:

```text
cloud-run-upload/
```

Production service:

```text
Project: singular-agent-498311-n7
Region: asia-east2
Service: hkycaa-add-on-upload
URL: https://hkycaa-add-on-upload-965808237264.asia-east2.run.app
Runtime service account: 965808237264-compute@developer.gserviceaccount.com
```

The frontend includes an Apps Script fallback so users can keep using
config/lookup/products/submit if Cloud Run action routes are temporarily
unavailable.

Deploy after `gcloud` is installed and authenticated as `info@hkycaa.org`:

```bash
gcloud auth login info@hkycaa.org
gcloud config set project singular-agent-498311-n7
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com drive.googleapis.com
gcloud run deploy hkycaa-add-on-upload \
  --source ./cloud-run-upload \
  --region asia-east2 \
  --allow-unauthenticated \
  --set-env-vars SHEET_ID=1ZY23Cx5PYEQ5GSc_VrXBIMnHirLhh6F0uFsUtCt2Eqo,LOOKUP_TOKEN_SECRET=<long-random-secret>,TZ=Asia/Hong_Kong,ALLOWED_ORIGINS=https://hkycaa.github.io,MAX_UPLOAD_BYTES=10485760,STRIPE_CURRENCY=hkd
```

Safe runtime IDs such as `publicSiteUrl`, `appsScriptUploadUrl`,
`stripePaymentMethodConfiguration`, and `uploadFolderId` are read from
`WEBAPP_CONFIG`, with deployment/script properties kept as fallbacks where the
service needs bootstrap compatibility.

Set payment secrets separately:

```bash
gcloud run services update hkycaa-add-on-upload \
  --region asia-east2 \
  --set-env-vars STRIPE_SECRET_KEY=<sk_test_or_sk_live>,STRIPE_WEBHOOK_SECRET=<whsec>
```

Do not commit Stripe keys or webhook secrets. Use sandbox keys for SIT and live
keys only when production payment testing is intended.

After deployment:

- confirm the Cloud Run runtime service account can read `_CLEAN`, `PRODUCT LIST`, `WEBAPP_CONFIG`, and `UI_TEXT`
- confirm the Cloud Run runtime service account can append to and update `RAW_ADD`
- confirm `LOOKUP_TOKEN_SECRET` is set and stable across deploys
- confirm `/?action=amend&token=bad` returns `INVALID_AMEND_TOKEN`
- confirm `/health` reports `stripeConfigured: true`
- configure Stripe webhook event `checkout.session.completed` to `/stripe/webhook`
- keep the Cloud Run service URL in `WEB_APP_URL` and `CLOUD_RUN_UPLOAD_URL` in `app.js`
- keep `LEGACY_WEB_APP_URL` as the legacy action API fallback
- confirm Apps Script can write to the Drive upload folder
- push the frontend again

For direct local `file://` testing, browsers send `Origin: null`; Cloud Run
allows that origin so local `index.html` can exercise upload and submit without
running a static server.

Current Apps Script deployment was updated to version `@19` for sheet-driven
safe runtime IDs, Drive upload folder configuration, and `PRODUCT LIST.RULE`
header support.

## Syncing Files Before Deploy

When changing Apps Script source:

```bash
cp apps-script/AddonTrialWebApp.gs .clasp-deploy/AddonTrialWebApp.js
```

When changing frontend source:

```bash
cp app.js frontend/app.js
cp index.html frontend/index.html
cp styles.css frontend/styles.css
```

## Verification

Check JavaScript syntax:

```bash
node --check app.js
node --check cloud-run-upload/server.js
```

Check Cloud Run route:

```bash
curl -L 'https://hkycaa-add-on-upload-965808237264.asia-east2.run.app/health'
curl -i -L 'https://hkycaa-add-on-upload-965808237264.asia-east2.run.app/?action=lookup&name=test&yob=2020&entryNo=test'
curl -L 'https://hkycaa-add-on-upload-965808237264.asia-east2.run.app/?action=config'
curl -L 'https://hkycaa-add-on-upload-965808237264.asia-east2.run.app/?action=products'
curl -L 'https://hkycaa-add-on-upload-965808237264.asia-east2.run.app/?action=amend&token=bad'
```

Stripe SIT smoke test:

1. Confirm Stripe Dashboard is in Sandbox mode.
2. Select products and choose `信用卡 / Alipay 內地版 / WeChat Pay 內地版 (+4% 手續費)`.
3. Confirm payee/upload fields remain hidden and button says `遞交並付款 Submit and Pay`.
4. Confirm Checkout uses the configured Stripe Payment Method Configuration and shows eligible methods, normally card, Link, Alipay and WeChat Pay. Apple Pay and Google Pay appear only when Stripe account settings, registered domain, browser/device and wallet setup are eligible.
5. Pay with Stripe test card `4242 4242 4242 4242`, any future expiry, any CVC.
6. Confirm Section 6 appears and `RAW_ADD` has `PAYMENT_PROVIDER=STRIPE`, `PAYMENT_STATUS=PAID`.
7. Confirm a declined card does not write `RAW_ADD` and restores the local draft.

Check GitHub Pages source:

```bash
curl -L 'https://hkycaa.github.io/yc-add-on-items/'
```

GitHub Pages can lag behind `main` for a short time after pushing.

## Common Issues

### Submit Fails with File Upload

Do not re-enable base64 upload through browser JSONP. If Cloud Run upload fails,
check the Cloud Run logs, the Apps Script upload bridge, Drive folder access,
and `ALLOWED_ORIGINS`.

### Cloud Run CLI Not Available

Install the Google Cloud CLI first, then authenticate with:

```bash
gcloud auth login info@hkycaa.org
```

### Production Shows Old JS/CSS

Update cache-busting query strings in `index.html`, then push again.

### Apps Script Logs

`clasp logs` may require a GCP project ID. If not configured, use frontend
messages, route checks, and sheet output for immediate debugging.
