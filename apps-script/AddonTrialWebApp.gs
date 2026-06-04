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
const AOT_RAW_ADD_SHEET = 'RAW_ADD';
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
  'ECERT_TTL',
  'NOTEBOOK_TTL',
  'TOTE_A_TTL',
  'TOTE_B_TTL',
  'TOTE_C_TTL',
  'BAG_A_TTL',
  'BAG_B_TTL',
  'BAG_C_TTL',
  'CASE_A_TTL',
  'CASE_B_TTL',
  'CASE_C_TTL',
  'CASE_D_TTL',
  'ADJ_TTL',
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

    if (action === 'submit') {
      return aotRespond_(aotSubmit_(payload), payload.callback);
    }

    return aotRespond_({
      success: true,
      service: 'add-on-trial-web-app',
      routes: ['?action=lookup', '?action=products', '?action=config', '?action=submit'],
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

function aotSubmit_(payload) {
  const submission = aotParseSubmissionPayload_(payload);
  const token = aotSafeText_(submission.lookupToken);

  if (!token) {
    return {
      success: false,
      code: 'MISSING_LOOKUP_TOKEN',
      message: '請先完成比賽成績查閱。',
    };
  }

  const cached = CacheService.getScriptCache().get('lookup:' + token);
  if (!cached) {
    return {
      success: false,
      code: 'LOOKUP_TOKEN_EXPIRED',
      message: '查閱授權已逾時，請重新查閱後再遞交。',
    };
  }

  const lookup = JSON.parse(cached);
  const timestamp = new Date();
  const submissionId = 'AOT-' + Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') +
    '-' + Utilities.getUuid().slice(0, 8).toUpperCase();

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = aotGetOrCreateSheet_(AOT_RAW_ADD_SHEET);
    const productColumns = [
      'ECERT_ADD', 'NOTEBOOK_ADD',
      'TOTE_A_ADD', 'TOTE_B_ADD', 'TOTE_C_ADD',
      'BAG_A_ADD', 'BAG_B_ADD', 'BAG_C_ADD',
      'CASE_A_ADD', 'CASE_B_ADD', 'CASE_C_ADD', 'CASE_D_ADD',
      'ADJ_ADD', 'PARIS_EARLY_ADD', 'PARIS_ADD',
      'HKAC_EARLY_ADD', 'HKAC_ADD', 'DOUBLE_EXHIT_ADD',
    ];
    const requiredHeaders = [
      'Timestamp',
      'SubmissionId',
      'lookupToken',
      'IND_CODE',
      'YOB',
      'NAME_CHI',
      'NAME_EN',
      '重新輸入家長/聯絡人WhatsApp號碼 Contact Number',
      '重新輸入家長/聯絡人電郵地址 Email Address of Contact Person',
      "更正參賽者資料 / 收貨地址 / 其他查詢 Edit participant's information or other enquiries（ 請輸入完整句子 Please write in complete sentences）",
      '本人將會以下列方式向本會付款 Method of Payment',
      '付款銀行帳戶之英文姓名 (作核對付款紀錄用途) Full Name of Payee Account',
      '應付總數 Total Payable',
      'ADD_ON_SUMMARY',
    ].concat(productColumns);

    const idx = aotEnsureHeaders_(sheet, requiredHeaders);
    const row = Array(sheet.getLastColumn()).fill('');
    const contestant = submission.contestant || {};

    aotSetRowValue_(row, idx, 'Timestamp', timestamp);
    aotSetRowValue_(row, idx, 'SubmissionId', submissionId);
    aotSetRowValue_(row, idx, 'lookupToken', token);
    aotSetRowValue_(row, idx, 'IND_CODE', aotSafeText_(contestant.entryNo) || lookup.entryNo);
    aotSetRowValue_(row, idx, 'YOB', aotSafeText_(contestant.yob) || lookup.yob);
    aotSetRowValue_(row, idx, 'NAME_CHI', aotSafeText_(contestant.nameChi));
    aotSetRowValue_(row, idx, 'NAME_EN', aotSafeText_(contestant.nameEn));
    aotSetRowValue_(row, idx, '重新輸入家長/聯絡人WhatsApp號碼 Contact Number', aotSafeText_(submission.contactNumber));
    aotSetRowValue_(row, idx, '重新輸入家長/聯絡人電郵地址 Email Address of Contact Person', aotSafeText_(submission.contactEmail));
    aotSetRowValue_(row, idx, "更正參賽者資料 / 收貨地址 / 其他查詢 Edit participant's information or other enquiries（ 請輸入完整句子 Please write in complete sentences）", aotSafeText_(submission.enquiryText));
    aotSetRowValue_(row, idx, '本人將會以下列方式向本會付款 Method of Payment', aotSafeText_(submission.paymentMethod));
    aotSetRowValue_(row, idx, '付款銀行帳戶之英文姓名 (作核對付款紀錄用途) Full Name of Payee Account', aotSafeText_(submission.payeeName));
    aotSetRowValue_(row, idx, '應付總數 Total Payable', Number(submission.totalPayable) || 0);

    const items = Array.isArray(submission.items) ? submission.items : [];
    aotSetRowValue_(row, idx, 'ADD_ON_SUMMARY', items.map(function(item) {
      return [item.code, item.name, 'x' + item.quantity, 'HK$' + item.total].join(' ');
    }).join('\n'));

    items.forEach(function(item) {
      const column = aotNormalizeCode_(item.code) + '_ADD';
      aotSetRowValue_(row, idx, column, Number(item.quantity) || 0);
    });

    sheet.appendRow(row);
  } finally {
    lock.releaseLock();
  }

  return {
    success: true,
    mode: 'submit',
    submissionId: submissionId,
    message: '已成功遞交',
  };
}

function aotParseSubmissionPayload_(payload) {
  if (typeof payload.payload === 'object' && payload.payload) {
    return payload.payload;
  }

  try {
    return JSON.parse(aotSafeText_(payload.payload));
  } catch (err) {
    return {};
  }
}

function aotGetOrCreateSheet_(name) {
  const spreadsheet = SpreadsheetApp.openById(AOT_SHEET_ID);
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}

function aotEnsureHeaders_(sheet, requiredHeaders) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
  }

  let headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getDisplayValues()[0];
  const existing = aotBuildHeaderIndex_(headers.map(aotNormalizeHeader_));
  const missing = requiredHeaders.filter(function(header) {
    return existing[aotNormalizeHeader_(header)] === undefined;
  });

  if (missing.length) {
    sheet.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
    headers = headers.concat(missing);
  }

  return aotBuildHeaderIndex_(headers.map(aotNormalizeHeader_));
}

function aotSetRowValue_(row, idx, header, value) {
  const key = aotNormalizeHeader_(header);
  if (idx[key] !== undefined) {
    row[idx[key]] = value;
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
    contestant[field] = aotGetPublicField_(matchedRow, idx, field);
  });

  const lookupToken = aotCreateLookupToken_(entryNo, yob, matchedRowNumber);

  return {
    success: true,
    mode: 'lookup',
    lookupToken: lookupToken,
    contestant: contestant,
  };
}

function aotGetPublicField_(row, idx, field) {
  if (idx[field] !== undefined) {
    return aotSafeText_(row[idx[field]]);
  }

  const typoAlias = field.replace(/_TTL$/, '_TLL');
  if (idx[typoAlias] !== undefined) {
    return aotSafeText_(row[idx[typoAlias]]);
  }

  return '';
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
