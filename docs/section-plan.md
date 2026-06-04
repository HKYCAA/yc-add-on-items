# Section Plan

## Architecture

This version intentionally ignores Cloud Run.

```text
GitHub static frontend
-> Google Apps Script Web App
-> Google Sheet
```

Because the frontend is hosted on GitHub and Apps Script cannot reliably set
custom CORS headers for `ContentService`, Section 1 uses a JSONP GET request.
The Apps Script module also exposes JSON responses for future same-origin or
server-side callers.

## Section 1: Result Check

Inputs:

- `1a` contestant Chinese or English name
- `1b` year of birth
- `1c` entry number

Validation:

- entry number must match `_CLEAN!IND_CODE`
- name and year of birth must match the same `_CLEAN` row
- name may match either `NAME_CHI` or `NAME_EN`

Success:

- returns Section 2 display fields
- returns a hidden `lookupToken` for future submission validation
- deployed to the Apps Script web app URL provided by HKYCAA

Failure:

- wrong entry number returns the Jotform-specified entry-number error
- mismatched name/year returns the Jotform-specified identity error

## Section 2: Candidate Verification

Pending implementation.

The frontend currently unlocks and previews read-only candidate fields after a
successful Section 1 lookup.

## Section 3: Add-On Items

Pending implementation.

`3l` Total Payable is a calculated field, not a product.

## Section 4: Payment

Pending implementation.

Payment slip upload is on hold.

## Section 5: Submission

Pending implementation.

Hidden backend fields required:

- `SubmissionId`
- `Timestamp`

## Section 6: Summary

Pending implementation.

Shown after user clicks submit. It summarizes updated fields and purchased
items.
