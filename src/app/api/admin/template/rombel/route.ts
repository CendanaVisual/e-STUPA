import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

/**
 * Route handler untuk mengunduh template impor Rombel & Kelas.
 * Format referensi EduGuru / STUPA:
 * Nama Kelas, Nama Wali Kelas (opsional)
 * Mendukung format: .xlsx (?format=xlsx) atau .csv (?format=csv)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") || "xlsx").toLowerCase();

  const columns = [
    { key: "namaKelas", header: "Nama Kelas", width: 18 },
    { key: "waliKelas", header: "Nama Wali Kelas (opsional)", width: 34 },
  ];

  const sampleData = [
    { namaKelas: "1A", waliKelas: "" },
    { namaKelas: "1B", waliKelas: "" },
    { namaKelas: "2A", waliKelas: "" },
    { namaKelas: "3A", waliKelas: "" },
    { namaKelas: "4A", waliKelas: "" },
    { namaKelas: "5A", waliKelas: "Budi Santoso, S.Pd." },
    { namaKelas: "5B", waliKelas: "Siti Aminah, S.Pd." },
    { namaKelas: "6A", waliKelas: "I Kadek Yoga, S.Pd." },
  ];

  if (format === "csv") {
    const csvHeader = columns.map((c) => `"${c.header}"`).join(",");
    const csvRows = sampleData.map((row) =>
      [`"${row.namaKelas}"`, `"${row.waliKelas}"`].join(",")
    );
    const csvContent = "\uFEFF" + [csvHeader, ...csvRows].join("\r\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="Template_Rombel_Kelas.csv"',
        "Cache-Control": "no-store",
      },
    });
  }

  // Format XLSX menggunakan ExcelJS
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "STUPA - Sistem Penilaian Terpadu";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Master_Rombel", {
    views: [{ showGridLines: true }],
  });

  // Header kolom
  sheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width,
  }));

  // Styling baris header (Emerald Theme)
  const headerRow = sheet.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F766E" }, // Teal 700
    };
    cell.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FF0D9488" } },
      left: { style: "thin", color: { argb: "FF0D9488" } },
      bottom: { style: "medium", color: { argb: "FF115E59" } },
      right: { style: "thin", color: { argb: "FF0D9488" } },
    };
  });

  // Tambahkan baris contoh data
  sampleData.forEach((item) => {
    sheet.addRow(item);
  });

  // Styling isi data
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.height = 22;
    row.eachCell((cell, colNumber) => {
      cell.font = { name: "Calibri", size: 10 };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
      if (colNumber === 1) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else {
        cell.alignment = { vertical: "middle", horizontal: "left" };
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="Template_Rombel_Kelas.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
