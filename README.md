# Add-On Trial Web App

Dynamic replacement for the existing Jotform result-check and add-on purchase flow.

## Current Scope

- Frontend: static GitHub Pages web app at repo root
- Backend: Google Apps Script web app connected to the Google Sheet
- Database: Google Sheet `_CLEAN`, `PRODUCT LIST`, `WEBAPP_CONFIG`, and `RAW_ADD` tabs
- Cloud Run: intentionally not used in this version

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
| 1. Result Check | Implemented | Lookup by contestant name, year of birth, and entry number |
| 2. Candidate Verification | Planned | Frontend receives Section 2 data from lookup; editable fields pending |
| 3. Add-On Items | Planned | `Total Payable` is a calculated field |
| 4. Payment | On hold | File upload is intentionally deferred |
| 5. Submission | Planned | Writes hidden `SubmissionId` and `Timestamp` |
| 6. Summary | Planned | Shows user-updated and purchased items after submit |

## Apps Script Constraint

Do not amend existing Apps Script files:

- `Code.gs`
- `Code v2.gs`
- `Code add.gs`

The Section 1 backend is provided as a new standalone file:

- `apps-script/AddonTrialWebApp.gs`

## Production URL

GitHub Pages should serve the root app at:

```text
https://hkycaa.github.io/yc-add-on-items/
```

The `frontend/` folder is kept as the source copy used during initial
development.
