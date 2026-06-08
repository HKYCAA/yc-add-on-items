# Documentation Index

This folder documents the current Add-On Trial web app implementation.

## Core Documents

- [Architecture](./architecture.md)
- [User Workflow and Sections](./workflow-and-sections.md)
- [Google Sheet Schema](./google-sheet-schema.md)
- [Apps Script API](./apps-script-api.md)
- [Frontend Implementation](./frontend.md)
- [Deployment and Operations](./deployment-and-operations.md)
- [Upload Decision](./upload-decision.md)
- [Stripe Payment Logic](./stripe-payment-logic.md)

## Current Production

- Frontend: `https://hkycaa.github.io/yc-add-on-items/`
- Cloud Run API:
  `https://hkycaa-add-on-upload-965808237264.asia-east2.run.app`
- Legacy Apps Script fallback / Drive upload bridge:
  `https://script.google.com/macros/s/AKfycbzYPo_Yix46JXfEM1nXSXffo7UFO7XfPwyE4S6raf8GVmgRCKHdbt1E3ZAvU1Lwh2Hg/exec`
- Latest local spec workbook:
  `/Users/hkycaa/Downloads/Add-On Trial Planning_v0.13.xlsx`

Use the `.xlsx` spec for Google Drive / Google Sheets upload. The `.xlsm` copy
is not needed because the workbook has no macros.

## Important Constraint

Do not amend the original Apps Script files:

- `Code.gs`
- `Code v2.gs`
- `Code add.gs`

The legacy Apps Script API / Drive bridge code lives in:

- `apps-script/AddonTrialWebApp.gs`

The primary Cloud Run API code lives in:

- `cloud-run-upload/server.js`
