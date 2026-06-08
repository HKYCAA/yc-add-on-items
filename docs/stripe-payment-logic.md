# Add-on Item Form Payment Logic

## Principle

For Stripe payment flow, do not write to Google Sheet `RAW_ADD` unless Stripe
payment is successfully confirmed.

Manual payment and no-payment submissions still write directly to `RAW_ADD`
after validation.

## Payment Method Options

The field:

`本人將會以下列方式向本會付款 Method of Payment`

contains:

- `PayMe / AlipayHK 港版`
- `信用卡 / Alipay 內地版 / WeChat Pay 內地版 (+4% 手續費)`
- `轉數快 FPS`
- `HSBC 銀行轉賬`

## Case 1: No Product Selected

Condition:

```text
Total payable = HK$0
```

Behavior:

- Hide or disable payment section
- Button text: `遞交 Submit`
- No payment slip required
- No Stripe redirect
- Submit directly to Cloud Run
- Log to Google Sheet `RAW_ADD`
- Show Section 6 success summary

Suggested Google Sheet status:

```text
PAYMENT_STATUS = NOT_REQUIRED
PAYMENT_PROVIDER = NONE
```

## Case 2: Product Selected + Manual Payment

Manual payment options:

- `PayMe / AlipayHK 港版`
- `轉數快 FPS`
- `HSBC 銀行轉賬`

Behavior:

- Show payment section
- Unhide `付款帳戶之英文姓名 Name of Payee Account`
- Unhide `請上載轉帳記錄或截圖 Upload Payment Slip or Screenshot`
- Payee account name required
- Payment slip required
- Button text: `遞交 Submit`
- No Stripe redirect
- Upload payment slip
- Submit directly to Cloud Run
- Log to Google Sheet `RAW_ADD`
- Show Section 6 success summary

Suggested Google Sheet status:

```text
PAYMENT_PROVIDER = MANUAL
PAYMENT_STATUS = PENDING_MANUAL_VERIFICATION
PAYMENT_SLIP_UPLOAD_STATUS = UPLOADED
```

## Case 3: Product Selected + Credit / China Wallets +4%

Stripe payment option:

- `信用卡 / Alipay 內地版 / WeChat Pay 內地版 (+4% 手續費)`

Behavior:

- Show payment section
- Keep `付款帳戶之英文姓名 Name of Payee Account` hidden
- Keep `請上載轉帳記錄或截圖 Upload Payment Slip or Screenshot` hidden
- Payment slip not required
- Button text: `遞交並付款 Submit and Pay`
- Save form draft to browser `localStorage` with 24-hour expiry
- Cloud Run validates lookup token and recalculates product total
- Cloud Run creates Stripe Checkout Session
- Redirect user to Stripe
- Do not log Google Sheet before payment succeeds

After successful Stripe payment:

- Stripe webhook confirms payment
- Cloud Run writes final record to Google Sheet `RAW_ADD`
- Mark payment as paid
- Frontend clears local draft
- Show Section 6 success page

If Stripe payment fails / user cancels:

- No Google Sheet record
- User returns to form
- Frontend restores draft from `localStorage`
- User can retry payment

Suggested Google Sheet status after successful Stripe payment:

```text
PAYMENT_PROVIDER = STRIPE
PAYMENT_STATUS = PAID
PAYMENT_SLIP_UPLOAD_STATUS = NOT_REQUIRED
```

## Stripe Amount Rule

For Stripe method only:

```text
Stripe payable total = product total + 4% handling fee
```

Use Stripe Checkout item breakdown. Cloud Run should derive the selected add-on
items from the submitted form/cart, recalculate prices from `PRODUCT LIST`, and
send each selected product as a Stripe Checkout line item.

Stripe Checkout item display:

```text
Selected add-on item 1 - {competitionName}      HK$xxx
Selected add-on item 2 - {competitionName}      HK$xxx
手續費 Surcharge (+4%) - {competitionName}      HK$xx
Total                                            HK$xxx
```

Do not create or maintain fixed Stripe Price objects for each add-on item in the
Stripe Dashboard for the first launch. Keep Google Sheet `PRODUCT LIST` as the
single source of truth for product prices, and let Cloud Run create dynamic
Stripe `price_data` line items at checkout time.

`WEBAPP_CONFIG.competitionName` is appended to each Stripe line item name so
both Checkout and Stripe receipts show the competition context. Do not also set
Stripe `product_data.description`; the description duplicates Checkout display
and does not appear in Stripe receipt summaries.

The surcharge line is the surcharge amount only, not the product total after
surcharge.

## Draft Storage Rule

Use browser `localStorage`, not Google Sheet staging table, for the first launch.

Draft should include:

- lookup token
- contestant identity
- contact number
- email
- enquiry text
- selected products and quantities
- selected payment method
- timestamp / expiry time

Draft should be:

- restored if user returns from cancelled/failed Stripe payment
- cleared after successful payment
- cleared if older than 24 hours
- treated as UX recovery only, not trusted by backend

## Staging Table Decision

No staging table for first launch.

Recommended first launch design:

- No staging table
- No `RAW_ADD` record before Stripe success
- Browser draft only for retry
- Stripe webhook is the source of truth for successful paid submission

Add a staging table later only if needed for:

- abandoned payment reporting
- cross-device recovery
- very large metadata
- more complex webhook fulfillment

## Section 6 Rule

Section 6 is shown only after:

- direct no-payment submit succeeds
- direct manual-payment submit succeeds
- Stripe payment is confirmed as paid

The success banner contains:

```text
已成功遞交
以下為今次提交的摘要，請保留此頁作參考。
提交編號 Submission ID: {SubmissionId}
```

The Submission ID line is bold. Section 6 also provides:

- `下載付款摘要 PDF`
- `查詢另一位得獎者`
- `修改剛才提交之資料`

`修改剛才提交之資料` redirects to the corresponding signed amendment URL.

## Cloud Run / Stripe Setup

Required Cloud Run environment variables:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `PUBLIC_SITE_URL`

Optional Cloud Run environment variables:

- `STRIPE_CURRENCY`, defaults to `hkd`
- `STRIPE_HANDLING_FEE_RATE`, defaults to `0.04`
- `STRIPE_PAYMENT_METHOD_CONFIGURATION`, defaults to `pmc_1NbIhWFZL7REtGIoVi7sEbvS`
- `STRIPE_PAYMENT_METHOD_TYPES`, defaults to `card,link,alipay,wechat_pay` only if no payment method configuration is set

The default Checkout Session uses the Stripe Payment Method Configuration shown
in the Dashboard. If no configuration ID is set, the fallback request lists
card, Link, Alipay and WeChat Pay manually. Apple Pay and Google Pay are wallet
options under card payments; Stripe shows them only when the Stripe account
settings, registered domain, customer browser or device, and wallet setup are
eligible.

Stripe webhook endpoint:

```text
https://<cloud-run-service-url>/stripe/webhook
```

Required Stripe event:

```text
checkout.session.completed
```

The frontend returns from Stripe with:

```text
?payment=success&session_id={CHECKOUT_SESSION_ID}
?payment=cancelled
```
