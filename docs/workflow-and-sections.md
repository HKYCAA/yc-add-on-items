# User Workflow and Sections

## Section Visibility

| State | Visible Sections |
|---|---|
| Initial page load | Section 0, Section 1 |
| Lookup success | Section 0, Section 1, Section 2, Section 3, Section 5 |
| Add-on total greater than HK$0 | Section 4 also becomes visible |
| Manual payment method selected | Section 4 payee-account and payment-slip upload fields become visible and required |
| Stripe payment method selected | Section 4 payee-account and payment-slip upload fields remain hidden; submit button becomes `遞交並付款 Submit and Pay` |
| Submit success | Section 0 and Section 6 only |
| Query another winner | Reset and return to Section 1 |
| Edit just-submitted data | Redirect to the signed amendment URL, then return to unlocked Sections 2, 3, 4 if needed, and 5 |

## Section 0: Header Config

Values are read from `WEBAPP_CONFIG`:

- `competitionName`
- `formTitle`
- `formIntro`
- `competitionPhotoUrl`

If the photo URL is blank, the image is hidden.

## Section 1: Result Check

User inputs:

- Contestant Chinese or English name
- Year of birth
- Entry number

Validation:

- Entry number must match `_CLEAN.IND_CODE`.
- Name must match either `_CLEAN.NAME_CHI` or `_CLEAN.NAME_EN`.
- Year of birth must match the same row.

Success:

- Cloud Run returns contestant fields and `lookupToken`.
- Apps Script can return the same response through the rollout fallback.
- Sections 2, 3, and 5 unlock.

## Section 2: Candidate Information Verification

Read-only data from `_CLEAN`:

- Chinese name
- English name
- Year of birth
- Age group
- Award Chinese
- Award English/French title
- Most Favorite status
- Shipping address
- Artwork return/status
- Artist signature
- Artwork description
- School name
- Existing purchased totals

Manual user inputs:

- WhatsApp/contact number
- Contact email
- Correction/enquiry textarea

Contact number and email are mandatory before submit.

## Section 3: Add-On Items

Products are loaded from `PRODUCT LIST`.

Supported shopping cart controls:

- Single checkbox
- Quantity dropdown
- Variant quantity dropdowns

Total payable is calculated client-side:

```text
sum(selected quantity x product price)
```

Variant products can have multiple variants selected at once.

Shelf status rules:

- `OFF`: hide product/variant
- `GREY OUT`: show but disable
- unavailable variants show `此項目暫時不能加購。`

## Section 4: Payment

Section 4 appears only when total payable is greater than HK$0.

Payment method options:

- `PayMe / AlipayHK 港版`
- `信用卡 / Alipay 內地版 / WeChat Pay 內地版 (+4% 手續費)`
- `轉數快 FPS`
- `HSBC 銀行轉賬`

Manual payment behavior:

- Applies to PayMe/AlipayHK 港版, FPS, and HSBC transfer.
- Payee account name and payment slip upload are visible and mandatory.
- Payment slip upload is enabled through Cloud Run.
- The user must upload a PDF/JPG/PNG/HEIC payment slip.
- Cloud Run forwards the file to Apps Script, and Apps Script creates the Drive file.
- Final submission writes `RAW_ADD` immediately after validation and upload.

Stripe behavior:

- Applies to credit card / Alipay China / WeChat Pay China.
- Payee account name and payment slip upload remain hidden and are not required.
- The button changes to `遞交並付款 Submit and Pay`.
- Cloud Run recalculates the product total from `PRODUCT LIST`, adds the 4% surcharge line, and creates a Stripe Checkout Session.
- Stripe item names include `WEBAPP_CONFIG.competitionName` so Stripe receipts show the competition context.
- Stripe `product_data.description` is intentionally omitted to avoid duplicated description text on the Checkout page.
- `RAW_ADD` is not written unless Stripe payment is successfully confirmed.

## Section 5: Submission

Mandatory validation:

- lookup is completed
- contact number is not blank
- email has a valid format
- payment method is filled if total payable is greater than HK$0
- payee name is filled only for manual payment methods
- payment slip is uploaded only for manual payment methods
- terms checkbox is checked

No-product and manual-payment submissions write to `RAW_ADD` through
`action=submit`. Stripe submissions call `action=createCheckoutSession` first
and redirect to Stripe Checkout.

If a Stripe payment is cancelled or fails, no `RAW_ADD` row is created. The
browser restores the user's draft from `localStorage` so the user can retry.

## Section 6: Summary

Shown after successful submission.

Displays:

- `已成功遞交`
- `以下為今次提交的摘要，請保留此頁作參考。`
- Submission ID
- amendment URL
- contestant number/name
- contact number/email
- optional enquiry
- total payable
- add-on summary

Buttons:

- `下載付款摘要 PDF`
- `查詢另一位得獎者`
- `修改剛才提交之資料`

## Amendment Behavior

If the user clicks `修改剛才提交之資料`, the frontend redirects to the
corresponding signed amendment URL. Section 5 then changes the submit button to
`重新遞交 Resubmit`. The next submit overwrites the existing `RAW_ADD` row for
the current `SubmissionId` with the updated timestamp, contact, payment, upload,
and cart values. The row keeps the same `SubmissionId`, preserves
`Submission Timestamp`, and refreshes `Last Update Timestamp`.

The Section 6 amendment URL uses a signed token without expiry management. The
link can reopen the submission later, restore editable fields and selected cart
items, then resubmit to overwrite the same row.
