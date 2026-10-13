import writeExcelFile from 'write-excel-file/browser';

const json_to_sheet = (rows = []) => {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return {
    data: [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ''))],
    '!cols': [],
  };
};

const sheet_add_aoa = (sheet, rows, options = {}) => {
  if (options.origin === -1 || options.origin === undefined) {
    sheet.data.push(...rows);
    return sheet;
  }
  if (options.origin !== 'A1') {
    throw new Error(`Unsupported spreadsheet origin: ${options.origin}`);
  }
  rows.forEach((row, rowIndex) => {
    if (!sheet.data[rowIndex]) sheet.data[rowIndex] = [];
    row.forEach((value, columnIndex) => {
      sheet.data[rowIndex][columnIndex] = value;
    });
  });
  return sheet;
};

const book_new = () => ({ sheets: [] });

const book_append_sheet = (workbook, sheet, name) => {
  workbook.sheets.push({ sheet, name });
};

const writeFile = async (workbook, fileName) => {
  if (!workbook?.sheets?.length) throw new Error('Workbook must contain at least one sheet');
  const sheets = workbook.sheets.map(({ sheet, name }) => ({
    data: sheet.data,
    sheet: name,
    columns: (sheet['!cols'] || []).map((column) => ({ width: column.wch || 15 })),
    stickyRowsCount: 1,
  }));
  await writeExcelFile(sheets).toFile(fileName);
};

export const utils = {
  json_to_sheet,
  sheet_add_aoa,
  book_new,
  book_append_sheet,
};

export { writeFile };
