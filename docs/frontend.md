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
- `previousSubmissionId`
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
- email format required
- payment method required if total payable > HK$0
- payee name required if total payable > HK$0
- terms checkbox required

Payment slip file is required when total payable is greater than HK$0.

## Cloud Run Upload Switch

`app.js` contains:

```js
const CLOUD_RUN_UPLOAD_URL = "";
```

Production value:

```js
const CLOUD_RUN_UPLOAD_URL = "https://hkycaa-add-on-upload-difkgqkl2q-df.a.run.app";
```

When this URL is configured, the frontend will:

- enable the payment slip file input
- validate file type and 10MB size limit
- upload the file to Cloud Run before Apps Script submission
- include `paymentSlipUpload` metadata in the Apps Script payload

## Summary Actions

`報名另一位得獎者`:

- clears lookup token
- clears contestant
- clears cart
- resets form
- returns to Section 1

`修改剛才提交之資料`:

- stores current submission ID as `previousSubmissionId`
- hides Section 6
- reopens Sections 2, 3, 5, and Section 4 if payable
- next submit appends a new `RAW_ADD` row

## Cache Busting

`index.html` uses query strings for JS/CSS cache busting.
Update the query string after frontend changes, for example:

```html
<script src="./app.js?v=20260605-cloudrun-live"></script>
```
