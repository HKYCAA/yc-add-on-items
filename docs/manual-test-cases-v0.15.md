# Manual Test Cases v0.15

This document corresponds to `/Users/hkycaa/Downloads/Add-On Trial Planning_v0.15.xlsx`.

v0.15 separates test coverage into:

- Developer internal testing: technical smoke, integration, security, webhook, configuration, and deployment checks.
- User testing: business-facing SIT/UAT scenarios that can be executed by operations or non-developer testers.

## Developer Internal Testing

| Test ID | Scope | Scenario | Expected Result | Priority |
|---|---|---|---|---|
| DEV-001 | Config API | Call Cloud Run `?action=config`. | Returns `WEBAPP_CONFIG` values including `competitionName`, `formTitle`, `formIntro`, `publicSiteUrl`, `appsScriptUploadUrl`, `stripePaymentMethodConfiguration`, and `uploadFolderId`. | High |
| DEV-002 | Products API | Call Cloud Run `?action=products`. | Returns only valid `PRODUCT LIST` rows; `OFF` rows are hidden; variant rows are grouped correctly. | High |
| DEV-003 | Product metadata | Validate every visible product has product code, name, price, add column, and purchased total field where applicable. | No `PRODUCT LIST metadata is incomplete` error. | High |
| DEV-004 | Product rule | Test a product with `RULE=AWARDED_ONLY` using winner and non-winner lookup rows. | Champion, 1st runner-up, 2nd runner-up, and 3rd runner-up can buy; other awards are disabled with the eligibility message. | High |
| DEV-005 | Repeat purchase mode | Test `PURCHASED_MODE=ALLOW_REPEAT` / `REPURCHASE` products with existing totals. | User can add more quantity even when `_CLEAN` total is already greater than 0. | High |
| DEV-006 | Non-repeat product | Test a product with existing `_CLEAN` purchased total and non-repeat mode. | Product is disabled and cannot be submitted again. | High |
| DEV-007 | Lookup token | Submit with missing, expired, or tampered `lookupToken`. | Backend rejects submission; no `RAW_ADD` write. | High |
| DEV-008 | Amendment token | Open a valid and invalid `?amend=` link. | Valid link restores saved data; invalid link returns `INVALID_AMEND_TOKEN`. | High |
| DEV-009 | Manual upload bridge | Upload PDF/JPG/PNG/HEIC payment slip through Cloud Run. | Apps Script creates the Drive file; Cloud Run returns file metadata; `RAW_ADD` stores upload metadata after submit. | High |
| DEV-010 | Upload limits | Upload unsupported type or oversized file. | Upload is rejected; no incomplete `RAW_ADD` write is created. | Medium |
| DEV-011 | Stripe Checkout | Create Checkout Session for Stripe method. | Session uses sheet-driven payment method configuration, dynamic line items from `PRODUCT LIST`, disabled Adaptive Pricing, and `publicSiteUrl` return URLs. | High |
| DEV-012 | Stripe webhook | Replay `checkout.session.completed`. | Paid submission writes once only; duplicate webhook does not create duplicate operational rows. | High |
| DEV-013 | Stripe cancelled flow | Cancel or fail Checkout. | No `RAW_ADD` row is written; browser draft can be restored. | High |
| DEV-014 | CORS/local smoke | Open production GitHub Pages and local file/server testing paths. | Production origin works; intended local testing path works without exposing extra origins. | Medium |
| DEV-015 | Deployment smoke | Check `/health`, `?action=lookup`, `?action=products`, `?action=config`, and `?action=amend&token=bad`. | Routes return expected status and error codes after each deployment. | High |
| DEV-016 | Sheet write integrity | Submit initial record and then resubmit through amendment. | Same `SubmissionId` row is overwritten; `Submission Timestamp` is preserved; `Last Update Timestamp` changes. | High |

## User Testing

| Test ID | Scope | Scenario | Expected Result | Priority |
|---|---|---|---|---|
| UAT-001 | Page load | Open the public form. | Header shows `WEBAPP_CONFIG` competition name, title, intro, and optional photo; blank or `NA` photo is hidden. | High |
| UAT-002 | Lookup | Enter correct contestant name, birth year, and entry number. | Result check succeeds and unlocks candidate info, add-on items, and submission sections. | High |
| UAT-003 | Lookup validation | Leave required lookup fields blank or enter non-4-digit birth year. | User sees validation message; later sections stay locked. | High |
| UAT-004 | Identity mismatch | Enter wrong entry number, name, or birth year. | User sees entry-not-found or identity-mismatch message; no submission is created. | High |
| UAT-005 | Contact validation | Enter non-digit contact number or invalid email. | Submit is blocked until contact number and email are valid. | High |
| UAT-006 | Quantity product | Select a quantity-based product. | Product line total and total payable equal quantity multiplied by sheet price. | High |
| UAT-007 | Variant product | Select multiple variants of tote, bag, or case. | Each variant can have its own quantity; cart and `RAW_ADD` add columns match selected variants. | High |
| UAT-008 | Repeat purchase | Select a product that can be repurchased. | User can add new quantity even if the item was purchased before. | High |
| UAT-009 | Existing purchase | View a non-repeat product already purchased before. | Product is shown disabled or unavailable according to its sheet status/rules. | Medium |
| UAT-010 | Awarded-only item | Non-awarded contestant views an `AWARDED_ONLY` product. | Product cannot be selected and displays the award eligibility restriction. | High |
| UAT-011 | No add-on submit | Submit only correction/enquiry details without products. | Section 4 is not required; submission succeeds with no payment required. | High |
| UAT-012 | Manual payment | Select PayMe/AlipayHK, FPS, or HSBC transfer. | Payee name and payment slip upload are shown and required. | High |
| UAT-013 | Manual payment submit | Complete manual payment fields and upload slip. | Submission succeeds; Section 6 summary appears; payment status is pending manual verification. | High |
| UAT-014 | Stripe payment | Select credit card / Alipay China / WeChat Pay China. | Payee/upload fields stay hidden; button changes to `Submit and Pay`; Stripe Checkout opens. | High |
| UAT-015 | Stripe amount | Pay through Stripe sandbox. | Checkout amount equals product total plus 4% surcharge; Section 6 appears after payment success. | High |
| UAT-016 | Stripe cancellation | Cancel Stripe Checkout and return to form. | Draft values are restored and user can retry payment. | High |
| UAT-017 | Section 6 summary | Complete a successful submission. | Green success banner, bold Submission ID, product/payment summary, amendment link, PDF print, and query-another-winner actions are visible. | High |
| UAT-018 | PDF print | Click `下載付款摘要 PDF`. | Browser print/save dialog opens with the submission summary. | Medium |
| UAT-019 | Query another winner | Click `查詢另一位得獎者`. | Form resets to lookup state; previous cart and contestant data are cleared. | Medium |
| UAT-020 | Amend submission | Click `修改剛才提交之資料`, edit fields, and resubmit. | Same Submission ID is updated; user sees the resubmitted Section 6 summary. | High |
| UAT-021 | Responsive layout | Test desktop and mobile widths. | Text, controls, product cards, payment fields, and Section 6 do not overlap. | Medium |

## Google Pay Note

Google Pay is not a separate Stripe Checkout `payment_method_type`; it is a wallet under card payments. It appears only when Stripe account settings, registered domain, HTTPS, Chrome/browser, device, and wallet/card eligibility all match.
