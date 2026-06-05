# Google Sheet Schema

## Tabs

| Tab | Purpose |
|---|---|
| `_CLEAN` | Contestant lookup and existing purchase totals |
| `PRODUCT LIST` | Add-on product catalog |
| `WEBAPP_CONFIG` | Header/title/photo configuration |
| `RAW_ADD` | Submission records |

## `WEBAPP_CONFIG`

Expected two-column layout:

| CONFIG_KEY | CONFIG_VALUE |
|---|---|
| `competitionName` | Competition name shown above the form title |
| `formTitle` | Main form title |
| `formIntro` | Short intro below the title |
| `competitionPhotoUrl` | Public image URL for the competition photo |

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

Shelf status behavior:

| SHELF_STATUS | Behavior |
|---|---|
| `OFF` | Product/variant is hidden |
| `GREY OUT` | Product/variant is shown but disabled |
| blank/other | Product/variant is available |

## `RAW_ADD`

Generated record fields:

- `Timestamp`
- `SubmissionId`
- `PreviousSubmissionId`; populated on resubmit with the overwritten
  `SubmissionId`

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

Payment slip metadata columns are reserved:

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
| Cloud Run upload succeeds | `UPLOADED` |

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
