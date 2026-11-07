import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") || "xlsx").toLowerCase();
  const tingkatParam = parseInt(searchParams.get("tingkat") || "1") || 1;
  const tingkat = Math.min(6, Math.max(1, tingkatParam));
  const mapelKode = (searchParams.get("mapelKode") || "MTK").toUpperCase();

  const mapels = await db.mapel.findMany({
    where: { isAktif: true },
    orderBy: [{ urutan: "asc" }, { nama: "asc" }],
    select: { kode: true, nama: true, kelompok: true },
  });

  const currentMapel = mapels.find((m) => m.kode.toUpperCase() === mapelKode);
  const namaMapelLabel = currentMapel?.nama || mapelKode;

  const columns = [
    { key: "tingkat", header: "Tingkat Kelas", width: 15 },
    { key: "kodeMapel", header: "Kode Mapel", width: 16 },
    { key: "kodeTp", header: "Kode TP", width: 16 },
    { key: "tujuanPembelajaran", header: "Tujuan Pembelajaran", width: 54 },
    { key: "ruangLingkupMateri", header: "Ruang Lingkup Materi", width: 38 },
  ];

  const sampleData = [
    {
      tingkat,
      kodeMapel: mapelKode,
      kodeTp: `TP.${tingkat}.1`,
      tujuanPembelajaran: `Peserta didik mampu memahami konsep dasar pada mata pelajaran ${namaMapelLabel} kelas ${tingkat} secara tepat.`,
      ruangLingkupMateri: `Konsep Dasar ${namaMapelLabel}`,
    },
    {
      tingkat,
      kodeMapel: mapelKode,
      kodeTp: `TP.${tingkat}.2`,
      tujuanPembelajaran: `Peserta didik mampu menerapkan keterampilan praktik dan pemecahan masalah sederhana sesuai materi kelas ${tingkat}.`,
      ruangLingkupMateri: `Penerapan & Pemecahan Masalah`,
    },
    {
      tingkat,
      kodeMapel: mapelKode,
      kodeTp: `TP.${tingkat}.3`,
      tujuanPembelajaran: `Peserta didik mampu menyajikan hasil karya atau kesimpulan pembelajaran secara runtut dan percaya diri.`,
      ruangLingkupMateri: `Proyek & Penyajian Hasil Belajar`,
    },
  ];

  if (format === "csv") {
    const csvHeader = columns.map((c) => `"${c.header}"`).join(",");
    const csvRows = sampleData.map((row) =>
      [
        `"${row.tingkat}"`,
        `"${row.kodeMapel}"`,
        `"${row.kodeTp}"`,
        `"${row.tujuanPembelajaran.replace(/"/g, '""')}"`,
        `"${row.ruangLingkupMateri.replace(/"/g, '""')}"`,
      ].join(","),
    );
    const csvContent = "\uFEFF" + [csvHeader, ...csvRows].join("\r\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="Template_TP_Kelas${tingkat}_${mapelKode}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "STUPA - Sistem Penilaian Akademik";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Template_TP", {
    views: [{ showGridLines: true }],
  });

  sheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width,
  }));

  const headerRow = sheet.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1D4ED8" }, // Blue 700
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
      top: { style: "thin", color: { argb: "FF1E40AF" } },
      left: { style: "thin", color: { argb: "FF1E40AF" } },
      bottom: { style: "medium", color: { argb: "FF1E3A8A" } },
      right: { style: "thin", color: { argb: "FF1E40AF" } },
    };
  });

  sampleData.forEach((item) => {
    sheet.addRow(item);
  });

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.height = 28;
    row.eachCell((cell, colNumber) => {
      cell.font = { name: "Calibri", size: 10 };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
      if (colNumber <= 3) {
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      } else {
        cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      }
    });
  });

  // Sheet Referensi Kode Mapel
  const refSheet = workbook.addWorksheet("Referensi_Kode_Mapel", {
    views: [{ showGridLines: true }],
  });
  refSheet.columns = [
    { header: "Kode Mapel", key: "kode", width: 18 },
    { header: "Nama Mata Pelajaran", key: "nama", width: 46 },
    { header: "Kelompok", key: "kelompok", width: 22 },
  ];

  const refHeader = refSheet.getRow(1);
  refHeader.height = 26;
  refHeader.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F766E" },
    };
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  mapels.forEach((m) => {
    refSheet.addRow({
      kode: m.kode,
      nama: m.nama,
      kelompok: m.kelompok || "Umum",
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Template_TP_Kelas${tingkat}_${mapelKode}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
