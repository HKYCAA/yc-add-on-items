# Add-On Trial Web App

Dynamic replacement for the existing Jotform result-check and add-on purchase flow.

## Current Scope

- Frontend: static GitHub Pages web app at repo root
- Backend: Cloud Run API connected to the Google Sheet
- Database: Google Sheet `_CLEAN`, `PRODUCT LIST`, `WEBAPP_CONFIG`, and `RAW_ADD` tabs
- Cloud Run: main API plus payment slip upload; files are still saved to Drive through Apps Script
- Frontend API fallback: GitHub Pages uses Cloud Run first and keeps the legacy Apps Script API as a fallback for config/lookup/products/submit
- Payment handling: manual transfer slip flow plus Stripe Checkout for credit card / Alipay China / WeChat Pay China
- File upload: enabled only for manual payment methods, not for Stripe
- Test specification: v0.15 workbook separates developer internal tests from user SIT/UAT test cases

## Component Ownership

| Layer | Production Location | Owns | Does Not Own |
|---|---|---|---|
| Google Sheet | `1ZY23Cx5PYEQ5GSc_VrXBIMnHirLhh6F0uFsUtCt2Eqo` | `_CLEAN` lookup data, `PRODUCT LIST` add-on config, `WEBAPP_CONFIG` public/runtime config, `RAW_ADD` submitted records | Business logic, file upload transport, public UI rendering, private secrets |
| Apps Script | Deployment `AKfycbzYPo_Yix46JXfEM1nXSXffo7UFO7XfPwyE4S6raf8GVmgRCKHdbt1E3ZAvU1Lwh2Hg` | Drive file creation for payment slips through the upload bridge | Static frontend hosting, multipart browser upload handling, lookup/product/config/submit APIs |
| Cloud Run | `hkycaa-add-on-upload` in project `singular-agent-498311-n7`, region `asia-east2` | Config/products APIs, contestant lookup, signed lookup tokens, signed amendment tokens, submission validation, `RAW_ADD` append/update writes, browser multipart payment-slip uploads, forwarding files to Apps Script upload bridge, Stripe Checkout creation, Stripe webhook fulfillment | Owning Drive files or storing unpaid Stripe attempts |
| GitHub / GitHub Pages | `HKYCAA/yc-add-on-items`, Pages root of `main` | User-facing HTML/CSS/JS, guided workflow, frontend validation, cart calculation, payment-method display rules, local draft restore, Cloud Run API calls, Section 6 PDF print action | Database storage, private validation authority, Drive file ownership, Stripe secret handling |
| Stripe | Stripe Dashboard | Hosted Checkout page, card/China-wallet collection, receipts, `checkout.session.completed` webhook | Form draft storage or Google Sheet writes |

Cloud Run action APIs are implemented in `cloud-run-upload/server.js`. The
frontend keeps Apps Script fetch/JSONP fallback so lookup and submit can keep
working if Cloud Run action routes are temporarily unavailable.

## Section 0 Config

Create a `WEBAPP_CONFIG` tab in the Google Sheet with these columns:

| CONFIG_KEY | CONFIG_VALUE | CONFIG_GROUP | NOTES |
|---|---|---|---|
| `competitionName` | Competition name shown above the form title | `site` | Public display text |
| `formTitle` | Main form title | `site` | Public display text |
| `formIntro` | Short intro below the title | `site` | Public display text |
| `competitionPhotoUrl` | Public image URL for the competition photo | `site` | Use blank or `NA` to hide |
| `publicSiteUrl` | GitHub Pages public URL | `endpoint` | Stripe return/cancel fallback |
| `appsScriptUploadUrl` | Apps Script upload bridge URL | `endpoint` | Used by Cloud Run server-side upload |
| `stripePaymentMethodConfiguration` | Stripe Payment Method Configuration ID | `payment` | Not a secret |
| `uploadFolderId` | Drive upload folder ID | `drive` | Used by Apps Script upload bridge |

Private secrets such as Stripe secret keys, webhook secrets, lookup-token
signing secrets, and bootstrap `SHEET_ID` remain outside the sheet.

## Section Status

| Section | Status | Notes |
|---|---|---|
| 0. Header Config | Implemented | Reads title, intro, competition name, and photo URL from `WEBAPP_CONFIG` |
| 1. Result Check | Implemented | Lookup by contestant name, year of birth, and entry number |
| 2. Candidate Verification | Implemented | Shows candidate/award data and existing purchase totals from `_CLEAN` |
| 3. Add-On Items | Implemented | Dynamic product list from `PRODUCT LIST`; quantity and variant totals are calculated |
| 4. Payment | Implemented | If products are selected, user chooses manual payment or Stripe. Payee name and slip upload are visible/required only for manual payment methods |
| 4c. Payment Slip Upload | Implemented | Manual payments upload to Cloud Run, Cloud Run passes the file to Apps Script, Apps Script stores it in Drive, then metadata is written to `RAW_ADD` |
| 4s. Stripe Checkout | Implemented | Credit card / Alipay China / WeChat Pay China adds 4% surcharge, uses Stripe Payment Method Configuration, disables Adaptive Pricing, redirects to Stripe, and writes `RAW_ADD` only after successful payment |
| 5. Submission | Implemented | Validates mandatory fields, writes direct/manual submissions, creates Stripe Checkout for Stripe path, and changes to `重新遞交 Resubmit` in amend mode |
| 6. Summary | Implemented | Shows green success banner with bold Submission ID, payment/product summary, PDF print action, signed amendment URL, `查詢另一位得獎者`, and edit action |

## Current Upload Decision

Payment slip upload is handled by Cloud Run in production.

The frontend is hosted on GitHub Pages and calls Cloud Run with `fetch`, with
Apps Script fetch/JSONP kept as a temporary fallback for the action APIs.
Browser-to-Apps-Script base64 upload is avoided because large file data can make
requests fail. Files therefore go to the dedicated Cloud Run upload API, while
final submission sends only returned file metadata to Cloud Run during final
submission.

The current production build sends payment slip files to Cloud Run before the
final submission. Cloud Run then calls Apps Script server-to-server so the file
is created in Drive by `info@hkycaa.org`, avoiding Google Drive service account
storage quota limitations.

Current behavior:

- If `Total Payable` is `HK$0`, `RAW_ADD.PAYMENT_SLIP_UPLOAD_STATUS` is `NOT_REQUIRED`.
- If manual payment is selected, the frontend requires payee account name and a payment slip upload.
- If Stripe payment is selected, payee account name and payment slip upload stay hidden and are not required.
- When manual Cloud Run upload succeeds, `RAW_ADD.PAYMENT_SLIP_UPLOAD_STATUS` becomes `UPLOADED` and the file metadata columns are populated.
- Stripe submissions are not written to `RAW_ADD` until Stripe confirms successful payment.
- Failed or cancelled Stripe payments restore the browser draft from `localStorage`; that draft is only on the user's device and expires after 24 hours.
- Initial submit creates `Submission Timestamp`, `Last Update Timestamp`, and a random `SubmissionId`.
- Resubmit keeps the same `SubmissionId`, preserves `Submission Timestamp`, refreshes `Last Update Timestamp`, and overwrites the existing `RAW_ADD` row.
- Section 6 displays a signed non-expiring amendment URL so the user can reopen the submitted record later, plus a browser print action for saving the payment summary as PDF.

Cloud Run production URL:

```text
https://hkycaa-add-on-upload-965808237264.asia-east2.run.app
```

Stripe webhook endpoint:

```text
https://hkycaa-add-on-upload-965808237264.asia-east2.run.app/stripe/webhook
```

Cloud Run setup files:

- `cloud-run-upload/server.js`
- `cloud-run-upload/Dockerfile`
- `cloud-run-upload/README.md`

## Apps Script Constraint

Do not amend existing Apps Script files:

- `Code.gs`
- `Code v2.gs`
- `Code add.gs`

The Section 1 backend is provided as a new standalone file:

- `apps-script/AddonTrialWebApp.gs`

The same file remains as the legacy/reference action API and Drive upload
bridge. Existing Apps Script files should still remain unchanged.

## Production URL

GitHub Pages should serve the root app at:

```text
https://hkycaa.github.io/yc-add-on-items/
```

The `frontend/` folder is kept as the source copy used during initial
development.

## Reference Spec

Latest local specification workbook:

```text
/Users/hkycaa/Downloads/Add-On Trial Planning_v0.15.xlsx
```

Use the `.xlsx` file for Google Drive / Google Sheets upload. The `.xlsm` copy
is not needed because the spec workbook has no macros, and Google Drive may fail
to open macro-enabled workbooks.

## Documentation

Detailed handover documentation is available in [`docs/`](./docs/):

- [`docs/architecture.md`](./docs/architecture.md)
- [`docs/workflow-and-sections.md`](./docs/workflow-and-sections.md)
- [`docs/google-sheet-schema.md`](./docs/google-sheet-schema.md)
- [`docs/apps-script-api.md`](./docs/apps-script-api.md)
- [`docs/frontend.md`](./docs/frontend.md)
- [`docs/deployment-and-operations.md`](./docs/deployment-and-operations.md)
- [`docs/upload-decision.md`](./docs/upload-decision.md)
- [`docs/manual-test-cases-v0.15.md`](./docs/manual-test-cases-v0.15.md)
