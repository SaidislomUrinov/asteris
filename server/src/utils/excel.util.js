const ExcelJS = require("exceljs");

// Har modul uchun alohida rang (frontend navbar ikonkalari bilan mos) —
// "turli ranglar bilan" talabiga ko'ra har export faylining sarlavha
// (header) qatori shu rangda bo'ladi, jadval ichidagi qatorlar oq/och-kulrang
// navbatlashib chiqadi (o'qishga qulay bo'lishi uchun).
const THEME = {
  student: "FF0E7490", // cyan-700
  group: "FFDB2777", // pink-600
  room: "FF0D9488", // teal-600
  subject: "FFEA580C", // orange-600
  staff: "FF7C3AED", // violet-600
  salary: "FF65A30D", // lime-600
  expense: "FFE11D48", // rose-600
  report: "FF2563EB", // blue-600
  audit: "FF475569", // slate-600
};

const THIN_BORDER = {
  top: { style: "thin", color: { argb: "FFE2E8F0" } },
  left: { style: "thin", color: { argb: "FFE2E8F0" } },
  bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
  right: { style: "thin", color: { argb: "FFE2E8F0" } },
};

// Bitta jadval qismini (sarlavha + ustunlar + qatorlar) bitta varaqqa chizadi.
// `columns`: [{ header, key, width, align, numFmt, value: (row) => any }]
function writeSheet(workbook, { sheetName, color, title, subtitle, columns, rows }) {
  const ws = workbook.addWorksheet(sheetName.slice(0, 31)); // Excel varaq nomi <=31 belgi

  let cursor = 1;

  if (title) {
    ws.mergeCells(cursor, 1, cursor, columns.length);
    const titleCell = ws.getCell(cursor, 1);
    titleCell.value = title;
    titleCell.font = { bold: true, size: 14, color: { argb: "FF1E293B" } };
    titleCell.alignment = { vertical: "middle", horizontal: "left" };
    ws.getRow(cursor).height = 26;
    cursor += 1;
  }

  if (subtitle) {
    ws.mergeCells(cursor, 1, cursor, columns.length);
    const subCell = ws.getCell(cursor, 1);
    subCell.value = subtitle;
    subCell.font = { italic: true, size: 10, color: { argb: "FF64748B" } };
    ws.getRow(cursor).height = 18;
    cursor += 1;
  }

  if (title || subtitle) cursor += 1; // bo'sh qator — ajratish uchun

  const headerRowIndex = cursor;
  const headerRow = ws.getRow(headerRowIndex);
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = THIN_BORDER;
  });
  headerRow.height = 24;

  rows.forEach((row, rIdx) => {
    const excelRow = ws.getRow(headerRowIndex + 1 + rIdx);
    columns.forEach((col, cIdx) => {
      const cell = excelRow.getCell(cIdx + 1);
      cell.value = col.value(row);
      if (col.numFmt) cell.numFmt = col.numFmt;
      cell.border = THIN_BORDER;
      cell.alignment = { vertical: "middle", horizontal: col.align || "left", wrapText: true };
      if (rIdx % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      }
    });
  });

  columns.forEach((col, i) => {
    ws.getColumn(i + 1).width = col.width || 18;
  });

  ws.views = [{ state: "frozen", ySplit: headerRowIndex, xSplit: 0 }];
  ws.autoFilter = {
    from: { row: headerRowIndex, column: 1 },
    to: { row: headerRowIndex, column: columns.length },
  };

  if (rows.length === 0) {
    const emptyRow = ws.getRow(headerRowIndex + 1);
    ws.mergeCells(headerRowIndex + 1, 1, headerRowIndex + 1, columns.length);
    emptyRow.getCell(1).value = "Ma'lumot topilmadi";
    emptyRow.getCell(1).font = { italic: true, color: { argb: "FF94A3B8" } };
    emptyRow.getCell(1).alignment = { horizontal: "center" };
  }
}

// `sheets`: [{ sheetName, color, title, subtitle, columns, rows }, ...]
// Bir nechta varaq bo'lishi mumkin (masalan "Statistika" + "Tranzaksiyalar").
const buildWorkbook = async (sheets) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Asteris";
  workbook.created = new Date();
  sheets.forEach((sheet) => writeSheet(workbook, sheet));
  return workbook.xlsx.writeBuffer();
};

// Excel faylni HTTP javob sifatida yuboradi — barcha export controller'lar
// shu bitta funksiyani chaqiradi.
const sendExcel = async (res, filename, sheets) => {
  const buffer = await buildWorkbook(sheets);
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.xlsx"`);
  res.send(Buffer.from(buffer));
};

module.exports = { THEME, buildWorkbook, sendExcel };
