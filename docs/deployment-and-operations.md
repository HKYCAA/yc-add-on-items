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

Upload is on hold. Do not re-enable base64 upload through JSONP.

### Production Shows Old JS/CSS

Update cache-busting query strings in `index.html`, then push again.

### Apps Script Logs

`clasp logs` may require a GCP project ID. If not configured, use frontend
messages, route checks, and sheet output for immediate debugging.
