# RAW_IND2 Import Helper

`apps-script/RawIndImport.gs` adds a Google Sheets menu action for importing
new registration rows from `RAW_IND2` into `RAW_IND`.

## Purpose

Use this helper when a teammate prepares new registration data in `RAW_IND2`
and operations needs to append those rows into the existing `RAW_IND` sheet.

The helper does not replace or clear existing `RAW_IND` rows.

## Apps Script Function

Main function:

```js
importRawInd2ToRawIndAppendMode()
```

In the target Apps Script project, the current menu wiring adds:

```text
HKYCAA Tools -> Import RAW_IND2 -> RAW_IND
```

Do not add a separate global `onOpen(e)` or `onEdit(e)` for this helper. The
target Apps Script project already has existing lifecycle functions.

## Behavior

The import reads:

- source sheet: `RAW_IND2`
- target sheet: `RAW_IND`
- header row: row 1 in both sheets

For each non-empty data row in `RAW_IND2`:

1. Match `RAW_IND2` headers to existing `RAW_IND` headers by trimmed text.
2. Append the row to the first visually empty row under the `RAW_IND` header.
3. Preserve all existing `RAW_IND` data rows.
4. Leave unmatched `RAW_IND` target columns blank.

The append start row is found with `getDisplayValues()`, not only
`getLastRow()`. This avoids appending at the bottom of a sheet when blank
formula rows or residual content make Google Sheets report a much later last
row.

## Unmatched Headers

If `RAW_IND2` has a header that does not exist in `RAW_IND`, the helper adds a
new column at the far right of `RAW_IND`.

The new header format is:

```text
Original Header (umatched header)
```

The header cell is highlighted with background color `#fff2cc`.

If the same import is run again, the helper recognizes existing marked headers
and does not create duplicate unmatched columns.

## Operational Checks

Before running:

- confirm `RAW_IND2` exists
- confirm `RAW_IND` exists
- confirm both sheets have row 1 headers
- confirm `RAW_IND2` contains only rows intended for import
- duplicate or back up the workbook before first production use

After running:

- confirm the new rows were appended directly after existing visible data
- confirm unmatched columns were added only once
- confirm highlighted unmatched headers are expected
- remove or archive imported rows from `RAW_IND2` if the same rows should not be
  appended again

## Deployment Notes

The repo source file is:

```text
apps-script/RawIndImport.gs
```

When pushing to Apps Script with `clasp`, copy it into the deployment directory
as:

```text
RawIndImport.js
```

The current target Apps Script ID is:

```text
1M_65qzKClILXYfcU-moxgAa-lWerurVkglEFtR9rUU7ivN_dRqFIBKuY
```
