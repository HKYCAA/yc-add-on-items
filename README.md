# Add-On Trial Web App

Dynamic replacement for the existing Jotform result-check and add-on purchase flow.

## Current Scope

- Frontend: static GitHub Pages web app at repo root
- Backend: Google Apps Script web app connected to the Google Sheet
- Database: Google Sheet `_CLEAN`, `PRODUCT LIST`, `WEBAPP_CONFIG`, and `RAW_ADD` tabs
- Cloud Run: upload API deployed for payment slip upload; files are saved to Drive through Apps Script
- File upload: enabled when total payable is greater than HK$0

## Section 0 Config

Create a `WEBAPP_CONFIG` tab in the Google Sheet with two columns:

| CONFIG_KEY | CONFIG_VALUE |
|---|---|
| `competitionName` | Competition name shown above the form title |
| `formTitle` | Main form title |
| `formIntro` | Short intro below the title |
| `competitionPhotoUrl` | Public image URL for the competition photo |

## Section Status

| Section | Status | Notes |
|---|---|---|
| 0. Header Config | Implemented | Reads title, intro, competition name, and photo URL from `WEBAPP_CONFIG` |
| 1. Result Check | Implemented | Lookup by contestant name, year of birth, and entry number |
| 2. Candidate Verification | Implemented | Shows candidate/award data and existing purchase totals from `_CLEAN` |
| 3. Add-On Items | Implemented | Dynamic product list from `PRODUCT LIST`; quantity and variant totals are calculated |
| 4. Payment | Implemented except upload | Payment method and payee name are required only when total payable is greater than HK$0 |
| 4c. Payment Slip Upload | Implemented | Uploads to Cloud Run, Cloud Run passes the file to Apps Script, Apps Script stores it in Drive, then metadata is written to `RAW_ADD` |
| 5. Submission | Implemented | Validates mandatory fields and writes to `RAW_ADD` |
| 6. Summary | Implemented | Shows success page, summary, “another winner”, and “edit submitted data” actions |

## Current Upload Decision

Payment slip upload is handled by Cloud Run in production.

The frontend is hosted on GitHub Pages and calls Apps Script through JSONP.
JSONP sends data through a script URL, so base64 file data quickly makes the URL
too long and causes submit failures. Files should therefore go to the dedicated
Cloud Run upload API, while Apps Script only receives the returned file metadata.

The current production build sends payment slip files to Cloud Run before the
Apps Script submission. Cloud Run then calls Apps Script server-to-server so the
file is created in Drive by `info@hkycaa.org`, avoiding Google Drive service
account storage quota limitations.

Current behavior:

- If `Total Payable` is `HK$0`, `RAW_ADD.PAYMENT_SLIP_UPLOAD_STATUS` is `NOT_REQUIRED`.
- If `Total Payable` is greater than `HK$0`, the frontend requires a payment slip upload.
- When Cloud Run upload succeeds, `RAW_ADD.PAYMENT_SLIP_UPLOAD_STATUS` becomes `UPLOADED` and the file metadata columns are populated.

Cloud Run production URL:

```text
https://hkycaa-add-on-upload-difkgqkl2q-df.a.run.app
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

The same file now also contains lookup, product/config reads, submission writes,
and future Drive upload helpers. Existing Apps Script files should still remain
unchanged.

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
/Users/hkycaa/Downloads/Add-On Trial Planning_v0.9.xlsx
```

## Documentation

Detailed handover documentation is available in [`docs/`](./docs/):

- [`docs/architecture.md`](./docs/architecture.md)
- [`docs/workflow-and-sections.md`](./docs/workflow-and-sections.md)
- [`docs/google-sheet-schema.md`](./docs/google-sheet-schema.md)
- [`docs/apps-script-api.md`](./docs/apps-script-api.md)
- [`docs/frontend.md`](./docs/frontend.md)
- [`docs/deployment-and-operations.md`](./docs/deployment-and-operations.md)
- [`docs/upload-decision.md`](./docs/upload-decision.md)
