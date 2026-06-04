# User Workflow and Sections

## Section Visibility

| State | Visible Sections |
|---|---|
| Initial page load | Section 0, Section 1 |
| Lookup success | Section 0, Section 1, Section 2, Section 3, Section 5 |
| Add-on total greater than HK$0 | Section 4 also becomes visible |
| Submit success | Section 0 and Section 6 only |
| Register another winner | Reset and return to Section 1 |
| Edit just-submitted data | Return to unlocked Sections 2, 3, 4 if needed, and 5 |

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

- Apps Script returns contestant fields.
- Apps Script returns `lookupToken`.
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

Required when visible:

- Method of payment
- Full name of payee account

Payment slip upload is on hold. The file input remains visible but disabled.

## Section 5: Submission

Mandatory validation:

- lookup is completed
- contact number is not blank
- email has a valid format
- payment method is filled if total payable is greater than HK$0
- payee name is filled if total payable is greater than HK$0
- terms checkbox is checked

Submit writes to `RAW_ADD`.

## Section 6: Summary

Shown after successful submission.

Displays:

- `已成功遞交`
- Submission ID
- contestant number/name
- contact number/email
- optional enquiry
- total payable
- add-on summary

Buttons:

- `報名另一位得獎者`
- `修改剛才提交之資料`

## Amendment Behavior

If the user clicks `修改剛才提交之資料`, the next submit does not overwrite the
previous record. It appends a new `RAW_ADD` row with:

- new `Timestamp`
- new `SubmissionId`
- `PreviousSubmissionId` pointing to the previous record
