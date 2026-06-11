/**
 * RAW_IND2 -> RAW_IND append-mode import helper.
 *
 * This file is safe to add beside existing Apps Script files. It intentionally
 * does not define global onOpen(e) or onEdit(e), because older bound projects
 * may already have them. Add a menu item from the existing onOpen(e) that calls
 * importRawInd2ToRawIndAppendMode().
 */

const RAW_IND_IMPORT_SOURCE_SHEET = 'RAW_IND2';
const RAW_IND_IMPORT_TARGET_SHEET = 'RAW_IND';
const RAW_IND_IMPORT_UNMATCHED_SUFFIX = ' (umatched header)';
const RAW_IND_IMPORT_UNMATCHED_HEADER_COLOR = '#fff2cc';

function importRawInd2ToRawIndAppendMode() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const src = ss.getSheetByName(RAW_IND_IMPORT_SOURCE_SHEET);
  const dst = ss.getSheetByName(RAW_IND_IMPORT_TARGET_SHEET);

  if (!src || !dst) {
    throw new Error('找不到 RAW_IND2 或 RAW_IND');
  }

  const srcData = src.getDataRange().getValues();
  const dstLastColumn = dst.getLastColumn();

  if (srcData.length < 1 || !rawIndImportRowHasValue_(srcData[0])) {
    throw new Error('RAW_IND2 沒有 header');
  }

  if (dstLastColumn < 1) {
    throw new Error('RAW_IND 沒有 header');
  }

  const srcHeader = srcData[0];
  const dstHeader = dst.getRange(1, 1, 1, dstLastColumn).getValues()[0];

  if (!rawIndImportRowHasValue_(dstHeader)) {
    throw new Error('RAW_IND 沒有 header');
  }

  const srcRows = srcData.slice(1).filter(rawIndImportRowHasValue_);
  if (srcRows.length === 0) {
    rawIndImportToast_('RAW_IND2 沒有可匯入資料列');
    return {
      success: true,
      appendedRows: 0,
      matchedHeaders: 0,
      addedUnmatchedColumns: 0,
      startRow: rawIndImportFindAppendStartRow_(dst, dstLastColumn),
    };
  }

  const columnPlan = rawIndImportBuildColumnPlan_(srcHeader, dstHeader);
  rawIndImportEnsureUnmatchedColumns_(dst, dstLastColumn, columnPlan.unmatchedToAdd);

  const finalColumnCount = dstLastColumn + columnPlan.unmatchedToAdd.length;
  const output = srcRows.map(function(srcRow) {
    const row = Array(finalColumnCount).fill('');

    columnPlan.sourceColumns.forEach(function(plan) {
      if (plan.targetIndex >= 0) {
        row[plan.targetIndex] = srcRow[plan.sourceIndex];
      }
    });

    return row;
  });

  const startRow = rawIndImportFindAppendStartRow_(dst, finalColumnCount);
  rawIndImportEnsureSheetSize_(dst, startRow + output.length - 1, finalColumnCount);
  dst.getRange(startRow, 1, output.length, finalColumnCount).setValues(output);

  const result = {
    success: true,
    appendedRows: output.length,
    matchedHeaders: columnPlan.matchedCount,
    addedUnmatchedColumns: columnPlan.unmatchedToAdd.length,
    startRow: startRow,
  };

  rawIndImportToast_(
    '完成：append ' + result.appendedRows +
    ' rows，由第 ' + result.startRow +
    ' 行開始；matched headers ' + result.matchedHeaders +
    '；新增 unmatched columns ' + result.addedUnmatchedColumns
  );

  return result;
}

function rawIndImportBuildColumnPlan_(srcHeader, dstHeader) {
  const dstMap = rawIndImportBuildHeaderMap_(dstHeader);
  const sourceColumns = [];
  const unmatchedToAdd = [];
  let matchedCount = 0;

  srcHeader.forEach(function(header, sourceIndex) {
    const key = rawIndImportNormalizeHeader_(header);
    if (!key) return;

    let targetIndex = dstMap[key];

    if (targetIndex !== undefined) {
      matchedCount++;
    } else {
      const markedKey = rawIndImportNormalizeHeader_(rawIndImportMarkedHeader_(header));
      targetIndex = dstMap[markedKey];

      if (targetIndex === undefined) {
        targetIndex = dstHeader.length + unmatchedToAdd.length;
        unmatchedToAdd.push({
          sourceHeader: String(header).trim(),
          targetIndex: targetIndex,
        });
        dstMap[markedKey] = targetIndex;
      }
    }

    sourceColumns.push({
      sourceIndex: sourceIndex,
      targetIndex: targetIndex,
    });
  });

  return {
    sourceColumns: sourceColumns,
    matchedCount: matchedCount,
    unmatchedToAdd: unmatchedToAdd,
  };
}

function rawIndImportEnsureUnmatchedColumns_(sheet, currentLastColumn, unmatchedToAdd) {
  if (unmatchedToAdd.length === 0) return;

  const finalColumnCount = currentLastColumn + unmatchedToAdd.length;
  rawIndImportEnsureSheetSize_(sheet, sheet.getMaxRows(), finalColumnCount);

  unmatchedToAdd.forEach(function(item) {
    const column = item.targetIndex + 1;
    const cell = sheet.getRange(1, column);
    cell.setValue(rawIndImportMarkedHeader_(item.sourceHeader));
    cell.setBackground(RAW_IND_IMPORT_UNMATCHED_HEADER_COLOR);
  });
}

function rawIndImportEnsureSheetSize_(sheet, neededRows, neededColumns) {
  if (sheet.getMaxRows() < neededRows) {
    sheet.insertRowsAfter(sheet.getMaxRows(), neededRows - sheet.getMaxRows());
  }

  if (sheet.getMaxColumns() < neededColumns) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), neededColumns - sheet.getMaxColumns());
  }
}

function rawIndImportFindAppendStartRow_(sheet, columnCount) {
  const firstDataRow = 2;
  const scanLastRow = Math.max(sheet.getLastRow(), firstDataRow);
  const rowCount = scanLastRow - firstDataRow + 1;
  const displayRows = sheet.getRange(firstDataRow, 1, rowCount, columnCount).getDisplayValues();

  for (let index = 0; index < displayRows.length; index++) {
    if (!rawIndImportRowHasValue_(displayRows[index])) {
      return firstDataRow + index;
    }
  }

  return scanLastRow + 1;
}

function rawIndImportBuildHeaderMap_(headers) {
  const map = {};

  headers.forEach(function(header, index) {
    const key = rawIndImportNormalizeHeader_(header);
    if (key && map[key] === undefined) {
      map[key] = index;
    }
  });

  return map;
}

function rawIndImportMarkedHeader_(header) {
  return String(header).trim() + RAW_IND_IMPORT_UNMATCHED_SUFFIX;
}

function rawIndImportNormalizeHeader_(header) {
  return String(header || '').trim();
}

function rawIndImportRowHasValue_(row) {
  return row.some(function(value) {
    return String(value || '').trim() !== '';
  });
}

function rawIndImportToast_(message) {
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast(message, 'RAW_IND2 Import', 10);
  } catch (error) {
    // Toast is best-effort only; command-line/unit checks do not have UI.
  }
}
