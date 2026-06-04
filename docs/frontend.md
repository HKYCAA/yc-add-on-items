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

Payment slip file is not required while upload is on hold.

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
<script src="./app.js?v=20260604-uploadhold"></script>
```
