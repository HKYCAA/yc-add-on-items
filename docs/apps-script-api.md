# Apps Script API

The public `config`, `lookup`, `products`, and `submit` actions now run on
Cloud Run. This document remains as a legacy/reference map for the Apps Script
implementation and the `uploadPaymentSlip` Drive bridge.

Current Cloud Run source:

```text
cloud-run-upload/server.js
```

Legacy Apps Script source file:

```text
apps-script/AddonTrialWebApp.gs
```

Deploy copy:

```text
.clasp-deploy/AddonTrialWebApp.js
```

## Legacy Endpoints

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

In the legacy Apps Script implementation, the lookup token is stored in
`CacheService` for one hour. In Cloud Run, it is a signed one-hour token verified
with `LOOKUP_TOKEN_SECRET`.

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
POST ?action=submit
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

Submit requires a valid `lookupToken`. The frontend now uses POST for normal
Cloud Run submission.

Submit always appends a new `RAW_ADD` row. It does not overwrite previous rows.

## Fetch and JSONP

The frontend tries Cloud Run first. If Cloud Run action routes are not live, it
falls back to this Apps Script endpoint with normal `fetch`, then JSONP.

When the frontend sets a `callback` parameter, Apps Script returns JavaScript:

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
