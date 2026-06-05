# Apps Script API

Source file:

```text
apps-script/AddonTrialWebApp.gs
```

Deploy copy:

```text
.clasp-deploy/AddonTrialWebApp.js
```

## Endpoints

All endpoints use the same web app URL with an `action` parameter.

### Health / Routes

Request:

```text
GET ?action=
```

Response includes available routes:

```json
{
  "success": true,
  "service": "add-on-trial-web-app",
  "routes": ["?action=lookup", "?action=products", "?action=config", "?action=submit"]
}
```

### Config

Request:

```text
GET ?action=config
```

Returns `WEBAPP_CONFIG` values, with defaults if missing.

### Lookup

Request:

```text
GET ?action=lookup&name=...&yob=...&entryNo=...
```

Validation:

- `entryNo` matches `_CLEAN.IND_CODE`
- `yob` matches the same row
- `name` matches either `NAME_CHI` or `NAME_EN`

Response:

- `success`
- `mode: "lookup"`
- `lookupToken`
- `contestant`

The lookup token is stored in `CacheService` for one hour.

### Products

Request:

```text
GET ?action=products
```

Returns normalized products from `PRODUCT LIST`.

Product object:

- `code`
- `name`
- `description`
- `photo`
- `shelfStatus`
- `price`

### Submit

Request:

```text
GET ?action=submit&payload=<JSON string>
```

Payload includes:

- `lookupToken`
- `previousSubmissionId`
- contestant info
- contact number
- contact email
- enquiry text
- payment method
- payee name
- total payable
- selected cart items

Submit requires a valid `lookupToken`.

Submit always appends a new `RAW_ADD` row. It does not overwrite previous rows.

## JSONP

The frontend sets a `callback` parameter. If valid, Apps Script returns
JavaScript:

```js
callbackName({...});
```

Without a callback, Apps Script returns JSON.

## Upload Helper

`aotNormalizePaymentSlipMetadata_` accepts Cloud Run upload metadata from the
frontend and writes it to `RAW_ADD`.

`aotSavePaymentSlip_` remains as a legacy helper for direct base64 upload, but
the GitHub Pages frontend should not use it. JSONP cannot reliably carry base64
file payloads.
