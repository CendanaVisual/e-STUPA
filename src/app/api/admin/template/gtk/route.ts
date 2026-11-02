import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

const GTK_HEADERS = [
  "Nama",
  "NIP",
  "Username",
  "Password",
  "Kelas Diampu (opsional)",
  "Mapel Diampu (pisahkan koma)",
];

const SAMPLE_ROWS = [
  [
    "Budi Santoso, S.Pd.",
    "198501012010011001",
    "budi",
    "budi123",
    "5A",
    "Matematika, IPAS",
  ],
  [
    "Siti Aminah, S.Pd.",
    "198903152012032002",
    "siti",
    "siti123",
    "5B",
    "Bahasa Indonesia",
  ],
  [
    "I Kadek Yoga, S.Pd.",
    "199408102019011004",
    "kadek",
    "kadek123",
    "",
    "Pendidikan Jasmani",
  ],
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") || "xlsx";

  if (format === "csv") {
    const csvContent = [
      GTK_HEADERS.join(","),
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
        "Content-Disposition": 'attachment; filename="Template_Data_GTK_Guru.csv"',
      },
    });
  }

  // Generate Excel (.xlsx) using ExcelJS
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "STUPA - Sistem Penilaian Akademik";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Master GTK & Guru", {
    views: [{ showGridLines: true }],
  });

  worksheet.columns = [
    { header: "Nama", key: "nama", width: 28 },
    { header: "NIP", key: "nip", width: 24 },
    { header: "Username", key: "username", width: 16 },
    { header: "Password", key: "password", width: 16 },
    { header: "Kelas Diampu (opsional)", key: "kelasDiampu", width: 24 },
    { header: "Mapel Diampu (pisahkan koma)", key: "mapelDiampu", width: 32 },
  ];

  // Style Header Row
  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF059669" }, // Emerald-600
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
      bottom: { style: "medium", color: { argb: "FF047857" } },
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
        horizontal: [2, 3, 4, 5].includes(colNumber) ? "center" : "left",
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
      "Content-Disposition": 'attachment; filename="Template_Data_GTK_Guru.xlsx"',
    },
  });
}
