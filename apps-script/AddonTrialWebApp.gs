/**
 * Add-On Trial dynamic web app API.
 *
 * This file is intended to be ADDED to the bound Apps Script project.
 * Do not edit existing files such as Code.gs, Code v2.gs, or Code add.gs.
 */

const AOT_SHEET_ID = '1ZY23Cx5PYEQ5GSc_VrXBIMnHirLhh6F0uFsUtCt2Eqo';
const AOT_CLEAN_SHEET = '_CLEAN';
const AOT_LOOKUP_TOKEN_TTL_SECONDS = 60 * 60;

const AOT_PUBLIC_FIELDS = [
  'IND_CODE',
  'NAME_CHI',
  'NAME_EN',
  'YOB',
  'YOB_GROUP',
  'AWARD_CHI',
  'AWARD_ENG',
  'STATUS_MYFAV',
  'SHIP_ADDR',
  'STATUS_RETURN',
  'ART_SIGNATURE_EN',
  'ECERT_TLL',
  'NOTEBOOK_TLL',
  'TOTE_A_TLL',
  'TOTE_B_TLL',
  'TOTE_C_TLL',
  'BAG_A_TLL',
  'BAG_B_TLL',
  'BAG_C_TLL',
  'CASE_A_TLL',
  'CASE_B_TLL',
  'CASE_C_TLL',
  'CASE_D_TLL',
  'ADJ_TLL',
  'PARIS_TTL',
  'HKAC_TTL',
  'PURCHASE_STATUS',
  'ART_DESC',
  'EDU_SCH',
];

function doGet(e) {
  return aotRoute_(e, 'GET');
}

function doPost(e) {
  return aotRoute_(e, 'POST');
}

function aotRoute_(e, method) {
  try {
    const payload = method === 'POST'
      ? aotParsePostBody_(e)
      : Object.assign({}, (e && e.parameter) || {});

    const action = aotSafeText_(payload.action);

    if (action === 'lookup') {
      return aotRespond_(aotLookupContestant_(payload), payload.callback);
    }

    return aotRespond_({
      success: true,
      service: 'add-on-trial-web-app',
      routes: ['?action=lookup'],
    }, payload.callback);
  } catch (err) {
    return aotRespond_({
      success: false,
      code: 'INTERNAL_ERROR',
      message: '系統暫時未能處理查詢，請稍後再試。',
      detail: String(err && err.message ? err.message : err),
    }, e && e.parameter && e.parameter.callback);
  }
}

function aotLookupContestant_(payload) {
  const entryNo = aotNormalizeCode_(payload.entryNo || payload.indCode || payload.IND_CODE);
  const yob = aotNormalizeYear_(payload.yob || payload.yearOfBirth || payload.YOB);
  const name = aotNormalizeName_(payload.name || payload.contestantName || payload.NAME);

  if (!entryNo || !yob || !name) {
    return {
      success: false,
      code: 'MISSING_REQUIRED_FIELDS',
      message: '請輸入參賽者名字、出生年份及得獎者編號。',
    };
  }

  const sheet = SpreadsheetApp.openById(AOT_SHEET_ID).getSheetByName(AOT_CLEAN_SHEET);
  if (!sheet) {
    throw new Error('Missing sheet: ' + AOT_CLEAN_SHEET);
  }

  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) {
    throw new Error(AOT_CLEAN_SHEET + ' has no data rows');
  }

  const headers = values[0].map(aotNormalizeHeader_);
  const idx = aotBuildHeaderIndex_(headers);
  ['IND_CODE', 'NAME_CHI', 'NAME_EN', 'YOB'].forEach(function(header) {
    if (idx[header] === undefined) {
      throw new Error('Missing required header in ' + AOT_CLEAN_SHEET + ': ' + header);
    }
  });

  let matchedRow = null;
  let matchedRowNumber = 0;

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (aotNormalizeCode_(row[idx.IND_CODE]) === entryNo) {
      matchedRow = row;
      matchedRowNumber = r + 1;
      break;
    }
  }

  if (!matchedRow) {
    return {
      success: false,
      code: 'ENTRY_NOT_FOUND',
      message: '錯誤：所輸入的得獎者編號錯誤<br>如需求助，請WhatsApp我們 +852 64180925 查詢。',
    };
  }

  const rowYob = aotNormalizeYear_(matchedRow[idx.YOB]);
  const nameChi = aotNormalizeName_(matchedRow[idx.NAME_CHI]);
  const nameEn = aotNormalizeName_(matchedRow[idx.NAME_EN]);
  const nameMatches = name === nameChi || name === nameEn;

  if (rowYob !== yob || !nameMatches) {
    return {
      success: false,
      code: 'IDENTITY_MISMATCH',
      message: '錯誤：參賽者名字或出生年份與參賽記錄不符，請重新輸入。<br>如需求助，請WhatsApp我們 +852 64180925 查詢。',
    };
  }

  const contestant = {};
  AOT_PUBLIC_FIELDS.forEach(function(field) {
    contestant[field] = idx[field] === undefined ? '' : aotSafeText_(matchedRow[idx[field]]);
  });

  const lookupToken = aotCreateLookupToken_(entryNo, yob, matchedRowNumber);

  return {
    success: true,
    mode: 'lookup',
    lookupToken: lookupToken,
    contestant: contestant,
  };
}

function aotCreateLookupToken_(entryNo, yob, rowNumber) {
  const nonce = Utilities.getUuid();
  const tokenSource = [entryNo, yob, rowNumber, nonce, Date.now()].join('|');
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, tokenSource);
  const token = Utilities.base64EncodeWebSafe(digest).replace(/=+$/, '');

  CacheService.getScriptCache().put(
    'lookup:' + token,
    JSON.stringify({
      entryNo: entryNo,
      yob: yob,
      rowNumber: rowNumber,
      createdAt: new Date().toISOString(),
    }),
    AOT_LOOKUP_TOKEN_TTL_SECONDS
  );

  return token;
}

function aotRespond_(payload, callback) {
  const json = JSON.stringify(payload);
  const cb = aotSafeText_(callback);

  if (cb && /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(cb)) {
    return ContentService
      .createTextOutput(cb + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function aotParsePostBody_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};

  try {
    return JSON.parse(e.postData.contents);
  } catch (err) {
    return {};
  }
}

function aotBuildHeaderIndex_(headers) {
  const idx = {};
  headers.forEach(function(header, index) {
    if (header && idx[header] === undefined) {
      idx[header] = index;
    }
  });
  return idx;
}

function aotNormalizeHeader_(value) {
  return aotSafeText_(value).replace(/\s+/g, ' ');
}

function aotSafeText_(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/\u00A0/g, ' ')
    .trim();
}

function aotNormalizeCode_(value) {
  return aotSafeText_(value).replace(/\s+/g, '').toUpperCase();
}

function aotNormalizeYear_(value) {
  const match = aotSafeText_(value).match(/\d{4}/);
  return match ? match[0] : '';
}

function aotNormalizeName_(value) {
  return aotSafeText_(value)
    .replace(/\s+/g, '')
    .toLowerCase();
}

