// XLSX export utility menggunakan ExcelJS (aman, tanpa vulnerability)
// Pengganti xlsx/SheetJS yang punya security issue

export async function exportXLSX(sheets, filename) {
  try {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Bronet';
    wb.created = new Date();

    sheets.forEach(({ name, headers, rows, colWidths }) => {
      const ws = wb.addWorksheet(name.substring(0, 31));

      // ── Header row ──────────────────────────────────────────────────
      const headerRow = ws.addRow(headers);
      headerRow.eachCell(cell => {
        cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Arial' };
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A7BB5' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
        cell.border    = { bottom: { style: 'thin', color: { argb: 'FF000000' } } };
      });
      headerRow.height = 22;

      // ── Data rows ────────────────────────────────────────────────────
      rows.forEach((row, ri) => {
        const dataRow = ws.addRow(row);
        dataRow.eachCell({ includeEmpty: true }, cell => {
          cell.font      = { size: 10, name: 'Arial' };
          cell.alignment = { vertical: 'middle' };
          // Alternating row color
          if (ri % 2 === 1) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F9FC' } };
          }
        });
        dataRow.height = 18;
      });

      // ── Column widths ────────────────────────────────────────────────
      if (colWidths) {
        ws.columns = headers.map((h, i) => ({
          key:   String(i),
          width: colWidths[i] || 15,
        }));
      } else {
        ws.columns = headers.map((h, i) => {
          const maxLen = Math.max(
            String(h).length,
            ...rows.map(r => String(r[i] ?? '').length)
          );
          return { key: String(i), width: Math.min(Math.max(maxLen + 3, 10), 45) };
        });
      }

      // ── Freeze top row ───────────────────────────────────────────────
      ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1, topLeftCell: 'A2' }];

      // ── Auto filter on header ────────────────────────────────────────
      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to:   { row: 1, column: headers.length },
      };
    });

    // ── Download ──────────────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer();
    const blob   = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = filename.endsWith('.xlsx') ? filename : filename + '.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

  } catch (e) {
    console.error('Export error:', e);
    // Fallback ke CSV jika ExcelJS gagal
    exportCSVFallback(sheets[0], filename.replace('.xlsx', '.csv'));
  }
}

// Fallback CSV sederhana jika ada masalah
function exportCSVFallback(sheet, filename) {
  if (!sheet) return;
  const rows  = [sheet.headers, ...sheet.rows];
  const csv   = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob  = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement('a');
  a.href      = url;
  a.download  = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  alert('Export XLSX gagal, file disimpan sebagai CSV.');
}

export function fmtRp(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
}

export function fmtDate(d) {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleDateString('id-ID', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
  } catch { return d; }
}
