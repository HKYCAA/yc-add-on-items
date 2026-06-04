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

## Current Production

- Frontend: `https://hkycaa.github.io/yc-add-on-items/`
- Apps Script web app:
  `https://script.google.com/macros/s/AKfycbzYPo_Yix46JXfEM1nXSXffo7UFO7XfPwyE4S6raf8GVmgRCKHdbt1E3ZAvU1Lwh2Hg/exec`
- Latest local spec workbook:
  `/Users/hkycaa/Downloads/Add-On Trial Planning_v0.9.xlsx`

## Important Constraint

Do not amend the original Apps Script files:

- `Code.gs`
- `Code v2.gs`
- `Code add.gs`

The web app API code for this project lives in:

- `apps-script/AddonTrialWebApp.gs`
