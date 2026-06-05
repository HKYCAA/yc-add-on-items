# Upload Decision

## Current Decision

Payment slip upload is Cloud Run-ready but not enabled in production yet.

The file input remains visible in Section 4 but is disabled while
`CLOUD_RUN_UPLOAD_URL` in `app.js` is empty. Users can still submit the form.
If payment is required, the association manually verifies payment records
outside the web app until the Cloud Run URL is connected.

## Why Cloud Run Is Needed

The frontend is hosted on GitHub Pages and calls Apps Script through JSONP.
JSONP works by adding a script tag whose `src` contains the full request.

That is suitable for normal form data but unsuitable for file uploads. A file
would need to be converted to base64 and placed inside the URL, which quickly
makes the request too long and causes submit failures.

Cloud Run solves this by accepting a normal multipart upload. The frontend first
uploads the payment slip to Cloud Run, Cloud Run stores the file in Google
Drive, and Apps Script receives only small metadata fields during submission.

## Prepared Upload Flow

```text
GitHub Pages frontend
  -> POST /upload on Cloud Run
  -> Google Drive folder
  -> Apps Script submit JSONP with paymentSlipUpload metadata
  -> RAW_ADD payment slip columns
```

Cloud Run service scaffold:

```text
cloud-run-upload/
```

Drive folder reserved for uploads:

```text
1OhhgPtIIsPlezjTrzVlnNKQwaMR0nAB7
```

## Current RAW_ADD Behavior

| Case | `PAYMENT_SLIP_UPLOAD_STATUS` |
|---|---|
| Total payable is HK$0 | `NOT_REQUIRED` |
| Total payable is greater than HK$0 and Cloud Run is not enabled | `PENDING_MANUAL_UPLOAD` |
| Cloud Run upload succeeds | `UPLOADED` |

The following metadata columns are supported:

- `PAYMENT_SLIP_FILE_ID`
- `PAYMENT_SLIP_FILE_NAME`
- `PAYMENT_SLIP_FILE_URL`
- `PAYMENT_SLIP_MIME_TYPE`
- `PAYMENT_SLIP_UPLOADED_AT`
- `PAYMENT_SLIP_UPLOAD_STATUS`

## Enabling Upload

1. Deploy `cloud-run-upload/` to Cloud Run.
2. Share the Drive upload folder with the Cloud Run service account.
3. Copy the Cloud Run service URL into `CLOUD_RUN_UPLOAD_URL` in `app.js`.
4. Keep `ALLOWED_ORIGINS` restricted to `https://hkycaa.github.io`.
5. Push the frontend and Apps Script metadata support.

Do not re-enable base64 file upload through Apps Script JSONP.
