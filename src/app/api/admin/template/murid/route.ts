import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

const MM_HEADERS = [
  "No Urut",
  "NIS",
  "NISN",
  "Nama",
  "L/P",
  "Agama",
  "Kelas",
  "Tempat Lahir",
  "Tanggal Lahir (YYYY-MM-DD)",
  "Alamat",
  "Anak Ke",
  "Tahun Masuk",
  "Nama Ayah",
  "Pekerjaan Ayah",
  "Nama Ibu",
  "Pekerjaan Ibu",
  "KJP (Ya/Tidak)",
  "PIP (Ya/Tidak)",
  "Bantuan Lain",
  "Status",
];

const SAMPLE_ROWS = [
  [
    1,
    "2400123",
    "0151234567",
    "Aisyah Putri",
    "P",
    "Islam",
    "5A",
    "Jakarta",
    "2015-04-21",
    "Jl. Pulau Moyo No. 10",
    "2",
    "2021",
    "Budi Hartono",
    "Karyawan Swasta",
    "Sri Rahayu",
    "Ibu Rumah Tangga",
    "Ya",
    "Tidak",
    "",
    "Aktif",
  ],
  [
    2,
    "2400124",
    "0151234568",
    "I Kadek Artawan",
    "L",
    "Hindu",
    "5A",
    "Denpasar",
    "2015-06-14",
    "Jl. Pulau Moyo No. 25",
    "1",
    "2021",
    "I Wayan Suweta",
    "Wiraswasta",
    "Ni Made Asri",
    "Pedagang",
    "Tidak",
    "Ya",
    "",
    "Aktif",
  ],
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") || "xlsx";

  if (format === "csv") {
    // Generate CSV
    const csvContent = [
      MM_HEADERS.join(","),
      ...SAMPLE_ROWS.map((row) =>
        row
          .map((cell) => {
            const val = String(cell ?? "");
            if (val.includes(",") || val.includes('"') || val.includes("\n")) {
              return `"${val.replace(/"/g, '""')}"`;
            }
            return val;
          })
          .join(",")
      ),
    ].join("\r\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="Template_Master_Data_Murid.csv"',
      },
    });
  }

  // Generate Excel (.xlsx) using ExcelJS
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "STUPA - Sistem Penilaian Akademik";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Master Murid", {
    views: [{ showGridLines: true }],
  });

  // Set Columns with width
  worksheet.columns = [
    { header: "No Urut", key: "noUrut", width: 10 },
    { header: "NIS", key: "nis", width: 14 },
    { header: "NISN", key: "nisn", width: 16 },
    { header: "Nama", key: "nama", width: 28 },
    { header: "L/P", key: "jk", width: 8 },
    { header: "Agama", key: "agama", width: 14 },
    { header: "Kelas", key: "kelas", width: 10 },
    { header: "Tempat Lahir", key: "tempatLahir", width: 18 },
    { header: "Tanggal Lahir (YYYY-MM-DD)", key: "tanggalLahir", width: 25 },
    { header: "Alamat", key: "alamat", width: 32 },
    { header: "Anak Ke", key: "anakKe", width: 10 },
    { header: "Tahun Masuk", key: "tahunMasuk", width: 14 },
    { header: "Nama Ayah", key: "namaAyah", width: 22 },
    { header: "Pekerjaan Ayah", key: "pekerjaanAyah", width: 20 },
    { header: "Nama Ibu", key: "namaIbu", width: 22 },
    { header: "Pekerjaan Ibu", key: "pekerjaanIbu", width: 20 },
    { header: "KJP (Ya/Tidak)", key: "kjp", width: 16 },
    { header: "PIP (Ya/Tidak)", key: "pip", width: 16 },
    { header: "Bantuan Lain", key: "bantuanLain", width: 18 },
    { header: "Status", key: "status", width: 12 },
  ];

  // Style Header Row
  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2563EB" }, // Blue-600
    };
    cell.font = {
      bold: true,
      color: { argb: "FFFFFFFF" },
      size: 11,
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "medium", color: { argb: "FF1E40AF" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  });

  // Add Sample Rows
  SAMPLE_ROWS.forEach((sample) => {
    const row = worksheet.addRow(sample);
    row.height = 22;
    row.eachCell((cell, colNumber) => {
      cell.alignment = {
        vertical: "middle",
        horizontal: [1, 5, 7, 9, 11, 12, 17, 18, 20].includes(colNumber)
          ? "center"
          : "left",
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="Template_Master_Data_Murid.xlsx"',
    },
  });
}
