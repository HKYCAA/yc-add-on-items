# Frontend Implementation

## Files

Root files served by GitHub Pages:

- `index.html`
- `app.js`
- `styles.css`

Synced source copy:

- `frontend/index.html`
- `frontend/app.js`
- `frontend/styles.css`

Keep root and `frontend/` copies in sync when editing.

## State Variables

Important state in `app.js`:

- `lookupToken`
- `currentSubmissionId`
- `previousSubmissionId`; frontend edit-target state only, not written to
  `RAW_ADD`
- `contestant`
- `products`
- `productMap`
- `cart`

## Product Specification

`PRODUCT_SPECS` in `app.js` maps frontend product behavior to product codes and
RAW_ADD columns.

Supported types:

- `single`
- `quantity`
- `variantQuantity`

## Validation

Lookup:

- name required
- YOB required and must be four digits
- entry number required

Submit:

- lookup must be completed
- contact number required
- contact number accepts digits only; international lengths are allowed
- email format required
- payment method required if total payable > HK$0
- payee name required only for manual payment methods
- payment slip file required only for manual payment methods
- terms checkbox required

For Stripe payment, payee name and payment slip upload stay hidden and are not
required.

## Cloud Run Upload Switch

`app.js` contains:

```js
const WEB_APP_URL = "https://hkycaa-add-on-upload-965808237264.asia-east2.run.app";
const LEGACY_WEB_APP_URL = "https://script.google.com/macros/s/.../exec";
const CLOUD_RUN_UPLOAD_URL = "https://hkycaa-add-on-upload-965808237264.asia-east2.run.app";
```

`WEB_APP_URL` is the primary Cloud Run action API. `LEGACY_WEB_APP_URL` is the
Apps Script fallback used if Cloud Run config, lookup, products, or submit
routes are temporarily unavailable.

When this URL is configured, the frontend will:

- enable the payment slip file input only for manual payment methods
- validate file type and 10MB size limit
- upload the file to Cloud Run before final submission
- include `paymentSlipUpload` metadata in the Cloud Run submit payload

Action API calls use this order:

1. Cloud Run fetch.
2. Apps Script fetch fallback.
3. Apps Script JSONP fallback.

## Payment Method Behavior

No products selected:

- Section 4 is not required.
- Button text is `遞交 Submit`.
- Submit writes directly to `RAW_ADD`.

Manual payment methods:

- PayMe/AlipayHK 港版, FPS, and HSBC transfer.
- Payee account name and payment slip upload are visible and required.
- Button text is `遞交 Submit`.
- Upload succeeds before final submit writes `RAW_ADD`.

Stripe payment method:

- `信用卡 / Alipay 內地版 / WeChat Pay 內地版 (+4% 手續費)`.
- Payee account name and payment slip upload remain hidden.
- Button text is `遞交並付款 Submit and Pay`.
- Frontend saves a 24-hour localStorage draft before redirecting to Stripe.
- Cancelled/failed Stripe payment restores the draft and does not create
  `RAW_ADD`.
- Successful Stripe payment clears the draft and shows Section 6.

## Summary Actions

`查詢另一位得獎者`:

- clears lookup token
- clears contestant
- clears cart
- resets form
- returns to Section 1

`修改剛才提交之資料`:

- redirects to the corresponding signed amendment URL
- hides Section 6 after amendment data is restored
- reopens Sections 2, 3, 5, and Section 4 if payable
- changes the Section 5 button to `重新遞交 Resubmit`
- next submit overwrites the existing `RAW_ADD` row for that `SubmissionId`
- keeps the same `SubmissionId`
- preserves `Submission Timestamp` and refreshes `Last Update Timestamp`

Amendment URL flow:

- backend returns a signed amend token after successful submit
- Section 6 shows an amendment URL containing `?amend=<signed-token>`
- opening the amendment URL validates the token, reads the matching `RAW_ADD`
  row, and restores Sections 2-5 in resubmit mode
- amend tokens do not expire; anyone with the link can reopen the submitted form
- resubmit keeps using overwrite mode so the same `SubmissionId` row is updated
- file inputs cannot be restored by browsers, so payment slips must be uploaded
  again unless a future reuse-existing-slip flow is added

## Cache Busting

`index.html` uses query strings for JS/CSS cache busting.
Update the query string after frontend changes, for example:

```html
<script src="./app.js?v=20260605-cloudrun-live"></script>
```
