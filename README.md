# Add-On Trial Web App

Dynamic replacement for the existing Jotform result-check and add-on purchase flow.

## Current Scope

- Frontend: static GitHub Pages web app at repo root
- Backend: Google Apps Script web app connected to the Google Sheet
- Database: Google Sheet `_CLEAN`, `PRODUCT LIST`, `WEBAPP_CONFIG`, and `RAW_ADD` tabs
- Cloud Run: intentionally not used in this version
- File upload: on hold in the GitHub Pages + JSONP version

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
| 4c. Payment Slip Upload | On hold | Disabled in UI. `RAW_ADD` records `PENDING_MANUAL_UPLOAD` when payment exists |
| 5. Submission | Implemented | Validates mandatory fields and writes to `RAW_ADD` |
| 6. Summary | Implemented | Shows success page, summary, “another winner”, and “edit submitted data” actions |

## Current Upload Decision

Payment slip upload is intentionally on hold.

The frontend is hosted on GitHub Pages and calls Apps Script through JSONP.
JSONP sends data through a script URL, so base64 file data quickly makes the URL
too long and causes submit failures. The current production build therefore
does not transmit files. The disabled upload field remains visible so users know
the intended future flow.

Current behavior:

- If `Total Payable` is `HK$0`, `RAW_ADD.PAYMENT_SLIP_UPLOAD_STATUS` is `NOT_REQUIRED`.
- If `Total Payable` is greater than `HK$0`, `RAW_ADD.PAYMENT_SLIP_UPLOAD_STATUS` is `PENDING_MANUAL_UPLOAD`.
- File metadata columns are kept in `RAW_ADD` for future upload implementation.

Recommended future upload options:

- Cloud Run upload API while keeping GitHub Pages frontend.
- Apps Script `HtmlService` hosted frontend so upload can use server-side Apps Script directly.
- Temporary manual workflow, such as separate Google Form/Drive collection, if speed matters more than integrated UX.

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
