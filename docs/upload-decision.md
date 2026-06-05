# Upload Decision

## Current Decision

Payment slip upload is enabled through Cloud Run in production.

The file input appears in Section 4 when total payable is greater than HK$0.
Users must upload a payment slip before submission.

## Why Cloud Run Is Needed

The frontend is hosted on GitHub Pages and calls Apps Script with `fetch`, with
JSONP kept as a fallback. JSONP works by adding a script tag whose `src`
contains the full request.

That is suitable for normal form data but unsuitable for file uploads. A file
would need to be converted to base64 and placed inside the URL, which quickly
makes the request too long and causes submit failures.

Cloud Run solves this by accepting a normal multipart upload. The frontend first
uploads the payment slip to Cloud Run. Cloud Run then forwards the file
server-to-server to Apps Script, Apps Script stores the file in Google Drive as
`info@hkycaa.org`, and the frontend receives small metadata fields for the final
submission.

## Prepared Upload Flow

```text
GitHub Pages frontend
  -> POST /upload on Cloud Run
  -> Apps Script uploadPaymentSlip POST
  -> Google Drive folder
  -> Apps Script submit request with paymentSlipUpload metadata
  -> RAW_ADD payment slip columns
```

Cloud Run service scaffold:

```text
cloud-run-upload/
```

Cloud Run production URL:

```text
https://hkycaa-add-on-upload-difkgqkl2q-df.a.run.app
```

Drive folder reserved for uploads:

```text
1OhhgPtIIsPlezjTrzVlnNKQwaMR0nAB7
```

## Current RAW_ADD Behavior

| Case | `PAYMENT_SLIP_UPLOAD_STATUS` |
|---|---|
| Total payable is HK$0 | `NOT_REQUIRED` |
| Cloud Run upload succeeds | `UPLOADED` |

The following metadata columns are supported:

- `PAYMENT_SLIP_FILE_ID`
- `PAYMENT_SLIP_FILE_NAME`
- `PAYMENT_SLIP_FILE_URL`
- `PAYMENT_SLIP_MIME_TYPE`
- `PAYMENT_SLIP_UPLOADED_AT`
- `PAYMENT_SLIP_UPLOAD_STATUS`

## Production Setup

1. Cloud Run project: `singular-agent-498311-n7`
2. Cloud Run region: `asia-east2`
3. Cloud Run service: `hkycaa-add-on-upload`
4. Runtime service account: `965808237264-compute@developer.gserviceaccount.com`
5. `APPS_SCRIPT_UPLOAD_URL` points to the Apps Script web app URL.
6. `CLOUD_RUN_UPLOAD_URL` in `app.js` points to the production Cloud Run URL.
7. `ALLOWED_ORIGINS` is restricted to `https://hkycaa.github.io`.

Cloud Run does not write to Drive directly. Google Drive service accounts have
no personal storage quota for ordinary My Drive folders, so Apps Script performs
the actual Drive write.

Do not re-enable base64 file upload through Apps Script JSONP.
