# Google Sheet Schema

## Tabs

| Tab | Purpose |
|---|---|
| `_CLEAN` | Contestant lookup and existing purchase totals |
| `PRODUCT LIST` | Add-on product catalog |
| `WEBAPP_CONFIG` | Header/title/photo/runtime configuration |
| `RAW_ADD` | Submission records |

## `WEBAPP_CONFIG`

Expected layout:

| CONFIG_KEY | CONFIG_VALUE | CONFIG_GROUP | NOTES |
|---|---|---|---|
| `competitionName` | Competition name shown above the form title | `site` | Public display text |
| `formTitle` | Main form title | `site` | Public display text |
| `formIntro` | Short intro below the title | `site` | Public display text |
| `competitionPhotoUrl` | Public image URL for the competition photo | `site` | Use blank or `NA` to hide |
| `publicSiteUrl` | GitHub Pages public URL used as Stripe return/cancel fallback | `endpoint` | Safe runtime ID |
| `appsScriptUploadUrl` | Apps Script web app URL used by Cloud Run as the Drive upload bridge | `endpoint` | Safe runtime ID |
| `stripePaymentMethodConfiguration` | Stripe Payment Method Configuration ID; this is not a secret | `payment` | Safe runtime ID |
| `uploadFolderId` | Google Drive folder ID for payment slip uploads | `drive` | Safe runtime ID |

`competitionName` is also appended to Stripe Checkout line item names so the
Stripe receipt summary includes the competition context. Stripe line item
descriptions are intentionally not used because they duplicate the Checkout
display but do not appear in the receipt summary.

Do not store true secrets in `WEBAPP_CONFIG`. `SHEET_ID`, Stripe secret keys,
webhook secrets, and token signing secrets remain deployment/bootstrap settings.

## `_CLEAN`

Required for lookup:

- `IND_CODE`
- `NAME_CHI`
- `NAME_EN`
- `YOB`

Displayed in Section 2 when available:

- `YOB_GROUP`
- `AWARD_CHI`
- `AWARD_ENG`
- `STATUS_MYFAV`
- `SHIP_ADDR`
- `STATUS_RETURN`
- `ART_SIGNATURE_EN`
- `ART_DESC`
- `EDU_SCH`
- `PURCHASE_STATUS`

Existing purchase total fields:

- `ECERT_TTL`
- `NOTEBOOK_TTL`
- `TOTE_A_TTL`
- `TOTE_B_TTL`
- `TOTE_C_TTL`
- `BAG_A_TTL`
- `BAG_B_TTL`
- `BAG_C_TTL`
- `CASE_A_TTL`
- `CASE_B_TTL`
- `CASE_C_TTL`
- `CASE_D_TTL`
- `ADJ_TTL`
- `PARIS_TTL`
- `HKAC_TTL`

All corresponding fields should use `TTL`, not `TLL`.
Apps Script currently keeps a fallback alias for `_TLL`, but the specification
expects `_TTL`.

## `PRODUCT LIST`

Apps Script accepts multiple possible header aliases, but the recommended
headers are:

- `PRODUCT_CODE`
- `PRODUCT_NAME`
- `PRODUCT_DESC`
- `PRODUCT_PHOTO`
- `SHELF_STATUS`
- `PRICE_TAG`
- `PRODUCT_TYPE`
- `GROUP_ID`
- `GROUP_LABEL`
- `VARIANT_LABEL`
- `ADD_COLUMN`
- `TTL_FIELD`
- `PURCHASED_MODE`
- `RULE`
- `MAX_QTY`
- `DISPLAY_ORDER`

Shelf status behavior:

| SHELF_STATUS | Behavior |
|---|---|
| `OFF` | Product/variant is hidden |
| `GREY OUT` | Product/variant is shown but disabled |
| blank/other | Product/variant is available |

Product type behavior:

| PRODUCT_TYPE | Behavior |
|---|---|
| `single` | One checkbox, quantity is 1 when selected |
| `quantity` | One quantity dropdown |
| `variantQuantity` | Product rows with the same `GROUP_ID` are grouped; each variant has its own quantity dropdown |

Purchase mode behavior:

| PURCHASED_MODE | Behavior |
|---|---|
| blank / `any` | Disable if any referenced `TTL_FIELD` value is greater than 0 |
| `all` | Disable only if all referenced `TTL_FIELD` values are greater than 0 |
| `REPEAT`, `ALLOW_REPEAT`, `REPURCHASE`, `CAN_REPURCHASE` | Allow repurchase even if existing totals are greater than 0 |

Rule behavior:

| RULE | Behavior |
|---|---|
| blank | No extra eligibility rule beyond shelf status and purchase mode |
| `AWARDED_ONLY` | Product is available only when `_CLEAN.AWARD_CHI` is `冠軍`, `亞軍`, `季軍`, or `殿軍`; other contestants see the item disabled |

`RULE` is the business-facing name for the eligibility column. The current code
also accepts the aliases `DISABLED_RULE`, `DISABLED RULE`, `ELIGIBILITY_RULE`,
and `ELIGIBILITY RULE`.

## `RAW_ADD`

Generated record fields:

- `Submission Timestamp`
- `Last Update Timestamp`
- `SubmissionId`

Contestant fields:

- `IND_CODE`
- `YOB`
- `NAME_CHI`
- `NAME_EN`

Contact and enquiry:

- `重新輸入家長/聯絡人WhatsApp號碼 Contact Number`; digits only, no fixed length
- `重新輸入家長/聯絡人電郵地址 Email Address of Contact Person`
- `更正參賽者資料 / 收貨地址 / 其他查詢 Edit participant's information or other enquiries（ 請輸入完整句子 Please write in complete sentences）`

Payment:

- `本人將會以下列方式向本會付款 Method of Payment`
- `付款帳戶之英文姓名 Name of Payee Account`
- `應付總數 Total Payable`
- `手續費 Surcharge (+4%)`

Payment slip metadata columns:

- `PAYMENT_SLIP_FILE_ID`
- `PAYMENT_SLIP_FILE_NAME`
- `PAYMENT_SLIP_FILE_URL`
- `PAYMENT_SLIP_MIME_TYPE`
- `PAYMENT_SLIP_UPLOADED_AT`
- `PAYMENT_SLIP_UPLOAD_STATUS`

Current upload status behavior:

| Situation | Status |
|---|---|
| Total payable is HK$0 | `NOT_REQUIRED` |
| Manual payment selected and Cloud Run upload succeeds | `UPLOADED` |
| Stripe payment selected | `NOT_REQUIRED` |

Payment status columns:

- `PAYMENT_PROVIDER`
- `PAYMENT_STATUS`
- `STRIPE_CHECKOUT_SESSION_ID`
- `STRIPE_PAYMENT_INTENT_ID`
- `STRIPE_AMOUNT`
- `STRIPE_CURRENCY`
- `STRIPE_PAID_AT`

Payment status behavior:

| Situation | `PAYMENT_PROVIDER` | `PAYMENT_STATUS` | Sheet Write Timing |
|---|---|---|---|
| No product selected | `NONE` | `NOT_REQUIRED` | Direct submit writes `RAW_ADD` |
| Manual payment selected | `MANUAL` | `PENDING_MANUAL_VERIFICATION` | Direct submit writes `RAW_ADD` after required slip upload |
| Stripe payment selected and paid | `STRIPE` | `PAID` | Stripe webhook / paid result writes `RAW_ADD` |
| Stripe payment cancelled or failed | none | none | No `RAW_ADD` row is written |

Do not add a staging table for first launch. Failed/cancelled Stripe attempts
are recoverable only from the user's browser `localStorage` draft, and the
backend must still recalculate product totals from `PRODUCT LIST`.

Product add columns:

- `ECERT_ADD`
- `NOTEBOOK_ADD`
- `TOTE_A_ADD`
- `TOTE_B_ADD`
- `TOTE_C_ADD`
- `BAG_A_ADD`
- `BAG_B_ADD`
- `BAG_C_ADD`
- `CASE_A_ADD`
- `CASE_B_ADD`
- `CASE_C_ADD`
- `CASE_D_ADD`
- `ADJ_ADD`
- `PARIS_EARLY_ADD`
- `PARIS_ADD`
- `HKAC_EARLY_ADD`
- `HKAC_ADD`
- `DOUBLE_EXHIT_ADD`

Other:

- `ADD_ON_SUMMARY`

Do not record `lookupToken`. If an old `lookupToken` header exists, the backend
writes it as blank. Cloud Run signs lookup tokens with `LOOKUP_TOKEN_SECRET`;
Apps Script only remains as legacy fallback and Drive upload bridge.

Do not use `PreviousSubmissionId` for the overwrite flow. Resubmits keep the
same `SubmissionId`, preserve `Submission Timestamp`, and refresh
`Last Update Timestamp`.

Amendment links do not add a sheet column. The signed token carries the
`SubmissionId`; Cloud Run validates the signature and reads the matching
`RAW_ADD` row.
