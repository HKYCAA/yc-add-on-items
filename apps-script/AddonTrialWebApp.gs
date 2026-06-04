/**
 * Add-On Trial dynamic web app API.
 *
 * This file is intended to be ADDED to the bound Apps Script project.
 * Do not edit existing files such as Code.gs, Code v2.gs, or Code add.gs.
 */

const AOT_SHEET_ID = '1ZY23Cx5PYEQ5GSc_VrXBIMnHirLhh6F0uFsUtCt2Eqo';
const AOT_CLEAN_SHEET = '_CLEAN';
const AOT_PRODUCT_SHEET = 'PRODUCT LIST';
const AOT_CONFIG_SHEET = 'WEBAPP_CONFIG';
const AOT_LOOKUP_TOKEN_TTL_SECONDS = 60 * 60;

const AOT_DEFAULT_CONFIG = {
  competitionName: 'SHOW YOUR COLOURS! 當代兒童繪畫大賽 2026',
  formTitle: '比賽成績查閱及加購表格',
  formIntro: '請先完成比賽成績查閱，再核對資料及選擇加購項目。',
  competitionPhotoUrl: '',
};

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

    if (action === 'products') {
      return aotRespond_(aotGetProducts_(payload), payload.callback);
    }

    if (action === 'config') {
      return aotRespond_(aotGetConfig_(), payload.callback);
    }

    return aotRespond_({
      success: true,
      service: 'add-on-trial-web-app',
      routes: ['?action=lookup', '?action=products', '?action=config'],
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

function aotGetConfig_() {
  const config = Object.assign({}, AOT_DEFAULT_CONFIG);
  const sheet = SpreadsheetApp.openById(AOT_SHEET_ID).getSheetByName(AOT_CONFIG_SHEET);

  if (!sheet) {
    return {
      success: true,
      mode: 'config',
      config: config,
      suggestedSheet: AOT_CONFIG_SHEET,
      suggestedFields: ['CONFIG_KEY', 'CONFIG_VALUE'],
    };
  }

  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) {
    return {
      success: true,
      mode: 'config',
      config: config,
    };
  }

  const headers = values[0].map(aotNormalizeHeader_);
  const idx = aotBuildHeaderIndex_(headers);
  const keyIndex = idx.CONFIG_KEY !== undefined ? idx.CONFIG_KEY : 0;
  const valueIndex = idx.CONFIG_VALUE !== undefined ? idx.CONFIG_VALUE : 1;

  for (let r = 1; r < values.length; r++) {
    const key = aotSafeText_(values[r][keyIndex]);
    const value = aotSafeText_(values[r][valueIndex]);
    if (key && config[key] !== undefined) {
      config[key] = value;
    }
  }

  return {
    success: true,
    mode: 'config',
    config: config,
  };
}

function aotGetProducts_(payload) {
  const sheet = SpreadsheetApp.openById(AOT_SHEET_ID).getSheetByName(AOT_PRODUCT_SHEET);
  if (!sheet) {
    throw new Error('Missing sheet: ' + AOT_PRODUCT_SHEET);
  }

  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) {
    return {
      success: true,
      mode: 'products',
      products: [],
    };
  }

  const headers = values[0].map(aotNormalizeHeader_);
  const idx = aotBuildHeaderIndex_(headers);

  const products = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const code = aotFirstCell_(row, idx, [
      'PRODUCT_CODE',
      'PRODUCT ID',
      'PRODUCT_ID',
      'SKU',
      'CODE',
      'ITEM_CODE',
      'PRODUCT',
    ]) || aotSafeText_(row[0]);

    if (!code) continue;

    const product = {
      code: aotNormalizeCode_(code),
      name: aotFirstCell_(row, idx, [
        'PRODUCT_NAME_CHI',
        'PRODUCT NAME CHI',
        'PRODUCT_NAME_ENG',
        'PRODUCT NAME ENG',
        'PRODUCT_NAME',
        'PRODUCT NAME',
        'ITEM_NAME',
        'ITEM NAME',
        'NAME',
      ]) || code,
      description: aotFirstCell_(row, idx, [
        'PRODUCT_DESC',
        'PRODUCT DESC',
        'DESCRIPTION',
        'DESC',
      ]),
      photo: aotFirstCell_(row, idx, [
        'PRODUCT_PHOTO',
        'PRODUCT PHOTO',
        'PHOTO',
        'IMAGE',
        'IMAGE_URL',
      ]),
      shelfStatus: aotFirstCell_(row, idx, [
        'SHELF_STATUS',
        'SHELF STATUS',
        'STATUS',
      ]),
      price: aotParsePrice_(aotFirstCell_(row, idx, [
        'PRICE',
        'PRICE_TAG',
        'PRICE TAG',
        'PRODUCT_PRICE',
        'PRODUCT PRICE',
        'PRODUCT_PRICE_HKD',
        'PRODUCT PRICE HKD',
        'PRODUCT_PRICE_HK$',
        'PRODUCT PRICE HK$',
        'UNIT_PRICE',
        'UNIT PRICE',
        'ADD_ON_PRICE',
        'ADD-ON PRICE',
        '加購價',
        '價錢',
        '價格',
        '售價',
        'HKD',
        'AMOUNT',
        'SALE_PRICE',
      ])),
    };

    products.push(product);
  }

  return {
    success: true,
    mode: 'products',
    products: products,
  };
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

function aotFirstCell_(row, idx, headers) {
  for (let i = 0; i < headers.length; i++) {
    const key = aotNormalizeHeader_(headers[i]);
    if (idx[key] !== undefined) {
      return aotSafeText_(row[idx[key]]);
    }
  }

  return '';
}

function aotParsePrice_(value) {
  const text = aotSafeText_(value);
  if (!text) return 0;

  const n = Number(text.replace(/[^\d.-]/g, ''));
  return isNaN(n) ? 0 : n;
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
