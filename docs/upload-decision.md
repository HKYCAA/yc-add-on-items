# Upload Decision

## Current Decision

Payment slip upload is on hold.

The file input remains visible in Section 4 but is disabled. Users can still
submit the form. The association will manually verify payment records outside
the web app for now.

## Why Upload Is On Hold

The current frontend is hosted on GitHub Pages and calls Apps Script through
JSONP. JSONP works by adding a script tag whose `src` contains the full request.

That means a file upload would need to be converted to base64 and placed inside
the URL. Even small receipts can make the URL too long or fail as a script
request.

This caused submit failures, so integrated upload was disabled to keep the main
form submission stable.

## Current RAW_ADD Behavior

| Case | `PAYMENT_SLIP_UPLOAD_STATUS` |
|---|---|
| Total payable is HK$0 | `NOT_REQUIRED` |
| Total payable is greater than HK$0 | `PENDING_MANUAL_UPLOAD` |

The following metadata columns remain reserved for future implementation:

- `PAYMENT_SLIP_FILE_ID`
- `PAYMENT_SLIP_FILE_NAME`
- `PAYMENT_SLIP_FILE_URL`
- `PAYMENT_SLIP_MIME_TYPE`
- `PAYMENT_SLIP_UPLOADED_AT`
- `PAYMENT_SLIP_UPLOAD_STATUS`

## Future Options

### Option 1: Cloud Run Upload API

Recommended for keeping GitHub Pages.

Flow:

```text
GitHub Pages frontend
  -> Cloud Run multipart upload endpoint
  -> Google Drive
  -> Apps Script / Google Sheet metadata write
```

Pros:

- supports normal image/PDF file sizes
- keeps frontend on GitHub
- cleaner upload handling

Cons:

- requires Cloud Run setup and service account permissions

### Option 2: Apps Script HtmlService

Host the frontend inside Apps Script instead of GitHub Pages.

Pros:

- same-origin Apps Script upload flow
- less infrastructure than Cloud Run

Cons:

- frontend deployment moves away from GitHub Pages
- Apps Script UI hosting can be slower and less flexible

### Option 3: Manual Google Form / Drive Workflow

Temporary workaround.

Pros:

- quickest operational setup
- no code needed

Cons:

- split user flow
- manual matching required
