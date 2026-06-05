# Deployment and Operations

## GitHub Pages

Production frontend:

```text
https://hkycaa.github.io/yc-add-on-items/
```

The repo is pushed to:

```text
https://github.com/HKYCAA/yc-add-on-items
```

GitHub Pages publishes from the root of `main`.

## Apps Script

Bound project deploy directory:

```text
.clasp-deploy
```

Push Apps Script:

```bash
npx --yes @google/clasp push --force
```

Deploy to the existing web app deployment:

```bash
npx --yes @google/clasp deploy \
  --deploymentId AKfycbzYPo_Yix46JXfEM1nXSXffo7UFO7XfPwyE4S6raf8GVmgRCKHdbt1E3ZAvU1Lwh2Hg \
  --description "Describe the change"
```

Do not create a new deployment ID unless intentionally changing the public web
app URL.

## Cloud Run Upload API

Cloud Run is only needed for payment slip uploads. The service source is:

```text
cloud-run-upload/
```

Production service:

```text
Project: singular-agent-498311-n7
Region: asia-east2
Service: hkycaa-add-on-upload
URL: https://hkycaa-add-on-upload-difkgqkl2q-df.a.run.app
Runtime service account: 965808237264-compute@developer.gserviceaccount.com
```

Deploy after `gcloud` is installed and authenticated as `info@hkycaa.org`:

```bash
gcloud auth login info@hkycaa.org
gcloud config set project singular-agent-498311-n7
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com drive.googleapis.com
gcloud run deploy hkycaa-add-on-upload \
  --source ./cloud-run-upload \
  --region asia-east2 \
  --allow-unauthenticated \
  --set-env-vars DRIVE_FOLDER_ID=1OhhgPtIIsPlezjTrzVlnNKQwaMR0nAB7,APPS_SCRIPT_UPLOAD_URL=https://script.google.com/macros/s/AKfycbzYPo_Yix46JXfEM1nXSXffo7UFO7XfPwyE4S6raf8GVmgRCKHdbt1E3ZAvU1Lwh2Hg/exec,ALLOWED_ORIGINS=https://hkycaa.github.io,MAX_UPLOAD_BYTES=10485760
```

After deployment:

- copy the Cloud Run service URL into `CLOUD_RUN_UPLOAD_URL` in `app.js`
- confirm Apps Script can write to the Drive upload folder
- push the frontend again

Current Apps Script deployment was updated to version `@15` for Cloud Run
payment slip upload bridge support.

## Syncing Files Before Deploy

When changing Apps Script source:

```bash
cp apps-script/AddonTrialWebApp.gs .clasp-deploy/AddonTrialWebApp.js
```

When changing frontend source:

```bash
cp app.js frontend/app.js
cp index.html frontend/index.html
cp styles.css frontend/styles.css
```

## Verification

Check JavaScript syntax:

```bash
node --check app.js
node --check cloud-run-upload/server.js
```

Check Apps Script route:

```bash
curl -L 'https://script.google.com/macros/s/AKfycbzYPo_Yix46JXfEM1nXSXffo7UFO7XfPwyE4S6raf8GVmgRCKHdbt1E3ZAvU1Lwh2Hg/exec'
```

Check GitHub Pages source:

```bash
curl -L 'https://hkycaa.github.io/yc-add-on-items/'
```

GitHub Pages can lag behind `main` for a short time after pushing.

## Common Issues

### Submit Fails with File Upload

Do not re-enable base64 upload through browser JSONP. If Cloud Run upload fails,
check the Cloud Run logs, the Apps Script upload bridge, Drive folder access,
and `ALLOWED_ORIGINS`.

### Cloud Run CLI Not Available

Install the Google Cloud CLI first, then authenticate with:

```bash
gcloud auth login info@hkycaa.org
```

### Production Shows Old JS/CSS

Update cache-busting query strings in `index.html`, then push again.

### Apps Script Logs

`clasp logs` may require a GCP project ID. If not configured, use frontend
messages, route checks, and sheet output for immediate debugging.
