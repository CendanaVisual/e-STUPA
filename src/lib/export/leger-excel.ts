import "server-only";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";

export async function buildLegerWorkbook(rombelId: string, selectedAgamaKode: string = "PAH") {
  const [rombel, sekolah, activeSemester] = await Promise.all([
    db.rombel.findUnique({
      where: { id: rombelId },
      include: {
        waliKelas: true,
        semester: { include: { tahunAjaran: true } },
        anggota: {
          include: { siswa: true },
          orderBy: [{ noAbsen: "asc" }, { siswa: { nama: "asc" } }],
        },
        pembelajaran: {
          include: { mapel: true },
        },
      },
    }),
    db.sekolah.findFirst(),
    db.semester.findFirst({
      where: { isAktif: true },
      include: { tahunAjaran: true },
    }),
  ]);

  if (!rombel) {
    throw new Error("Rombel tidak ditemukan");
  }

  const semester = rombel.semester || activeSemester;

  // Urutkan mata pelajaran sesuai instruksi resmi:
  // 1. Pendidikan Agama (kiri PP)
  // 2. PP (Pendidikan Pancasila)
  // 3. BIND (Bahasa Indonesia)
  // 4. MTK (Matematika)
  // 5. IPAS (Ilmu Pengetahuan Alam dan Sosial)
  // 6. PJOK (kiri SB)
  // 7. SB (Seni dan Budaya)
  // 8. BING (Bahasa Inggris)
  // 9. MULOK (kanan BING)
  const mapelOrderKeys = ["AGAMA", "PP", "BIND", "MTK", "IPAS", "PJOK", "SB", "BING", "MULOK"];

  const getMapelCategoryKey = (kode: string) => {
    const k = kode.toUpperCase();
    if (k.startsWith("PA") || k === "PAB" || k === "PAH" || k === "PAI" || k === "PAK" || k === "PAKAT" || k === "PABUD") {
      return "AGAMA";
    }
    if (k === "PP") return "PP";
    if (k === "BIND") return "BIND";
    if (k === "MTK") return "MTK";
    if (k === "IPAS") return "IPAS";
    if (k === "PJOK") return "PJOK";
    if (k === "SB") return "SB";
    if (k === "BING") return "BING";
    if (k === "MULOK" || k === "BB") return "MULOK";
    return "OTHER";
  };

  const sortedPembelajaran = [...rombel.pembelajaran].sort((a, b) => {
    const keyA = getMapelCategoryKey(a.mapel.kode);
    const keyB = getMapelCategoryKey(b.mapel.kode);
    const idxA = mapelOrderKeys.indexOf(keyA);
    const idxB = mapelOrderKeys.indexOf(keyB);
    const posA = idxA !== -1 ? idxA : 99;
    const posB = idxB !== -1 ? idxB : 99;
    if (posA !== posB) return posA - posB;
    return a.mapel.nama.localeCompare(b.mapel.nama);
  });

  // Ambil semua NilaiRapor untuk pembelajaran di rombel ini
  const pembelajaranIds = sortedPembelajaran.map((p) => p.id);
  const nilaiRaporList =
    pembelajaranIds.length > 0
      ? await db.nilaiRapor.findMany({
          where: { pembelajaranId: { in: pembelajaranIds } },
        })
      : [];

  const nilaiMap = new Map<string, number>();
  nilaiRaporList.forEach((nr) => {
    if (nr.nilaiAkhir !== null) {
      nilaiMap.set(`${nr.siswaId}_${nr.pembelajaranId}`, Number(nr.nilaiAkhir));
    }
  });

  // Hitung total dan rata-rata per siswa
  const siswaStats = (rombel.anggota || []).map((agg) => {
    let total = 0;
    let count = 0;
    sortedPembelajaran.forEach((p) => {
      const val = nilaiMap.get(`${agg.siswaId}_${p.id}`);
      if (val !== undefined) {
        total += val;
        count++;
      }
    });
    const avg = count > 0 ? Math.round((total / count) * 100) / 100 : 0;
    return {
      siswaId: agg.siswaId,
      total,
      avg,
    };
  });

  // Hitung ranking
  const sortedStats = [...siswaStats].sort((a, b) => b.avg - a.avg);
  const rankMap = new Map<string, number>();
  sortedStats.forEach((s, idx) => {
    rankMap.set(s.siswaId, idx + 1);
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "e-STUPA";
  wb.created = new Date();

  const ws = wb.addWorksheet("Leger_Nilai", {
    views: [{ showGridLines: true }],
    pageSetup: {
      orientation: "landscape",
      paperSize: 14 as any, // F4 / Folio (215 x 330 mm)
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      verticalCentered: false,
      margins: {
        left: 0.4,
        right: 0.4,
        top: 0.5,
        bottom: 0.5,
        header: 0.2,
        footer: 0.2,
      },
    },
  });

  // Hitung total kolom
  // Col 1: No, Col 2: NISN, Col 3: Nama, Col 4: L/P
  // Col 5..(4 + mapels.length): Mapel
  // Col (5 + mapels.length): Total
  // Col (6 + mapels.length): Rata-rata
  // Col (7 + mapels.length): Rank
  const totalCols = 4 + sortedPembelajaran.length + 3;

  // Set widths
  const colWidths: { width: number }[] = [
    { width: 5 }, // No
    { width: 14 }, // NISN
    { width: 28 }, // Nama Siswa
    { width: 6 }, // L/P
  ];
  sortedPembelajaran.forEach(() => {
    colWidths.push({ width: 9 }); // Mapel cols
  });
  colWidths.push({ width: 10 }); // Total
  colWidths.push({ width: 10 }); // Rata2
  colWidths.push({ width: 8 }); // Rank
  ws.columns = colWidths;

  const lastColLetter = ws.getColumn(totalCols).letter;

  // Baris 1: Judul Utama
  ws.mergeCells(`A1:${lastColLetter}1`);
  const titleCell = ws.getCell("A1");
  titleCell.value = "LEGER NILAI HASIL BELAJAR (KURIKULUM MERDEKA)";
  titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FF0F172A" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 24;

  // Baris 2: Nama Sekolah
  ws.mergeCells(`A2:${lastColLetter}2`);
  const subTitleCell = ws.getCell("A2");
  subTitleCell.value = `${(sekolah?.nama || "SD NEGERI 7 PEDUNGAN").toUpperCase()} • NPSN: ${sekolah?.npsn || "50103069"}`;
  subTitleCell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF334155" } };
  subTitleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 18;

  // Baris 4: Informasi Kelas & Semester
  ws.mergeCells(`A4:D4`);
  ws.getCell("A4").value = `Kelas: ${rombel.nama} (Tingkat ${rombel.tingkat})  |  Wali Kelas: ${rombel.waliKelas?.nama || "-"}`;
  ws.getCell("A4").font = { name: "Arial", size: 10, bold: true };
  ws.getCell("A4").alignment = { horizontal: "left", vertical: "middle" };

  ws.mergeCells(`E4:${lastColLetter}4`);
  const metaRight = ws.getCell("E4");
  metaRight.value = `T.A.: ${semester?.tahunAjaran?.nama || "2026/2027"}  |  Semester: ${semester?.tipe || "GANJIL"}  |  Kertas: F4 Landscape`;
  metaRight.font = { name: "Arial", size: 10, bold: true };
  metaRight.alignment = { horizontal: "right", vertical: "middle" };

  // Baris 6: Table Header 1
  const headerRow1 = ws.getRow(6);
  const headerVals1 = ["No", "NISN", "Nama Peserta Didik", "L/P"];
  sortedPembelajaran.forEach((p) => {
    headerVals1.push(p.mapel.kode);
  });
  headerVals1.push("Total", "Rata²", "Rank");
  headerRow1.values = headerVals1;
  headerRow1.height = 22;

  // Baris 7: Table Header 2 (KKTP)
  const headerRow2 = ws.getRow(7);
  const headerVals2 = ["", "", "", ""];
  sortedPembelajaran.forEach((p) => {
    headerVals2.push(`KKTP ${p.kktp || 75}`);
  });
  headerVals2.push("", "", "");
  headerRow2.values = headerVals2;
  headerRow2.height = 16;

  // Merge headers for fixed columns
  ws.mergeCells("A6:A7");
  ws.mergeCells("B6:B7");
  ws.mergeCells("C6:C7");
  ws.mergeCells("D6:D7");
  ws.mergeCells(`${ws.getColumn(totalCols - 2).letter}6:${ws.getColumn(totalCols - 2).letter}7`);
  ws.mergeCells(`${ws.getColumn(totalCols - 1).letter}6:${ws.getColumn(totalCols - 1).letter}7`);
  ws.mergeCells(`${ws.getColumn(totalCols).letter}6:${ws.getColumn(totalCols).letter}7`);

  const headerFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F172A" },
  };

  const headerFont: Partial<ExcelJS.Font> = {
    name: "Arial",
    size: 9,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };

  const borderStyle: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFCBD5E1" } },
    left: { style: "thin", color: { argb: "FFCBD5E1" } },
    bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
    right: { style: "thin", color: { argb: "FFCBD5E1" } },
  };

  for (let r = 6; r <= 7; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= totalCols; c++) {
      const cell = row.getCell(c);
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = borderStyle;
    }
  }

  // Isi Data Siswa
  let currentRowNum = 8;
  const colTotals = new Array(sortedPembelajaran.length).fill(0);
  const colCounts = new Array(sortedPembelajaran.length).fill(0);

  rombel.anggota.forEach((agg, idx) => {
    const stat = siswaStats.find((s) => s.siswaId === agg.siswaId);
    const rank = rankMap.get(agg.siswaId) || "-";

    const row = ws.getRow(currentRowNum);
    const rowValues: any[] = [
      agg.noAbsen || idx + 1,
      agg.siswa.nisn,
      agg.siswa.nama,
      agg.siswa.jenisKelamin,
    ];

    sortedPembelajaran.forEach((p, pIdx) => {
      const score = nilaiMap.get(`${agg.siswaId}_${p.id}`);
      if (score !== undefined) {
        rowValues.push(score);
        colTotals[pIdx] += score;
        colCounts[pIdx]++;
      } else {
        rowValues.push("-");
      }
    });

    rowValues.push(stat?.total || 0);
    rowValues.push(stat?.avg || 0);
    rowValues.push(rank);

    row.values = rowValues;
    row.height = 20;

    const isEven = idx % 2 === 0;
    const rowFill: ExcelJS.Fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: isEven ? "FFFFFFFF" : "FFF8FAFC" },
    };

    for (let c = 1; c <= totalCols; c++) {
      const cell = row.getCell(c);
      cell.fill = rowFill;
      cell.font = { name: "Arial", size: 9 };
      cell.border = borderStyle;

      if (c === 3) {
        cell.alignment = { horizontal: "left", vertical: "middle" };
        cell.font = { name: "Arial", size: 9, bold: true };
      } else if (c >= 5 && c <= 4 + sortedPembelajaran.length) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.font = { name: "Arial", size: 9, bold: true };
      } else if (c > 4 + sortedPembelajaran.length) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.font = { name: "Arial", size: 9, bold: true, color: { argb: c === totalCols ? "FFD97706" : "FF1E40AF" } };
      } else {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      }
    }

    currentRowNum++;
  });

  // Summary Row (Rata-rata Kelas per Mata Pelajaran)
  const avgRow = ws.getRow(currentRowNum);
  const avgVals: any[] = ["", "", "RATA-RATA KELAS", ""];
  let grandTotalAvg = 0;
  let countAvg = 0;

  colTotals.forEach((tot, pIdx) => {
    const cnt = colCounts[pIdx];
    const avg = cnt > 0 ? Math.round((tot / cnt) * 10) / 10 : 0;
    avgVals.push(avg);
    if (cnt > 0) {
      grandTotalAvg += avg;
      countAvg++;
    }
  });

  const finalClassAvg = countAvg > 0 ? Math.round((grandTotalAvg / countAvg) * 10) / 10 : 0;
  avgVals.push("-", finalClassAvg, "-");
  avgRow.values = avgVals;
  avgRow.height = 22;

  ws.mergeCells(`A${currentRowNum}:D${currentRowNum}`);
  avgRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };

  for (let c = 1; c <= totalCols; c++) {
    const cell = avgRow.getCell(c);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" },
    };
    cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF0F172A" } };
    cell.border = {
      top: { style: "medium", color: { argb: "FF64748B" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "medium", color: { argb: "FF64748B" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
    if (c >= 5) cell.alignment = { horizontal: "center", vertical: "middle" };
  }

  // Tanda Tangan
  const signRow = currentRowNum + 3;
  ws.mergeCells(`B${signRow}:D${signRow}`);
  ws.getCell(`B${signRow}`).value = "Mengetahui,";
  ws.getCell(`B${signRow}`).alignment = { horizontal: "center" };

  const rightSignCol = ws.getColumn(totalCols - 3).letter;
  const rightSignEnd = ws.getColumn(totalCols).letter;
  ws.mergeCells(`${rightSignCol}${signRow}:${rightSignEnd}${signRow}`);
  ws.getCell(`${rightSignCol}${signRow}`).value = `${sekolah?.desaKelurahan || "Denpasar"}, ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`;
  ws.getCell(`${rightSignCol}${signRow}`).alignment = { horizontal: "center" };

  const signTitleRow = signRow + 1;
  ws.mergeCells(`B${signTitleRow}:D${signTitleRow}`);
  ws.getCell(`B${signTitleRow}`).value = "Kepala Sekolah";
  ws.getCell(`B${signTitleRow}`).alignment = { horizontal: "center" };

  ws.mergeCells(`${rightSignCol}${signTitleRow}:${rightSignEnd}${signTitleRow}`);
  ws.getCell(`${rightSignCol}${signTitleRow}`).value = "Wali Kelas";
  ws.getCell(`${rightSignCol}${signTitleRow}`).alignment = { horizontal: "center" };

  const nameRow = signRow + 4;
  ws.mergeCells(`B${nameRow}:D${nameRow}`);
  ws.getCell(`B${nameRow}`).value = sekolah?.namaKepsek || "Drs. I Made Sujana, M.Pd.";
  ws.getCell(`B${nameRow}`).font = { name: "Arial", size: 9, bold: true, underline: true };
  ws.getCell(`B${nameRow}`).alignment = { horizontal: "center" };

  ws.mergeCells(`${rightSignCol}${nameRow}:${rightSignEnd}${nameRow}`);
  ws.getCell(`${rightSignCol}${nameRow}`).value = rombel.waliKelas?.nama || "Wali Kelas";
  ws.getCell(`${rightSignCol}${nameRow}`).font = { name: "Arial", size: 9, bold: true, underline: true };
  ws.getCell(`${rightSignCol}${nameRow}`).alignment = { horizontal: "center" };

  const nipRow = nameRow + 1;
  ws.mergeCells(`B${nipRow}:D${nipRow}`);
  ws.getCell(`B${nipRow}`).value = `NIP. ${sekolah?.nipKepsek || "196805121992031008"}`;
  ws.getCell(`B${nipRow}`).font = { name: "Arial", size: 8 };
  ws.getCell(`B${nipRow}`).alignment = { horizontal: "center" };

  ws.mergeCells(`${rightSignCol}${nipRow}:${rightSignEnd}${nipRow}`);
  ws.getCell(`${rightSignCol}${nipRow}`).value = `NIP. ${rombel.waliKelas?.nip || "-"}`;
  ws.getCell(`${rightSignCol}${nipRow}`).font = { name: "Arial", size: 8 };
  ws.getCell(`${rightSignCol}${nipRow}`).alignment = { horizontal: "center" };

  const buffer = await wb.xlsx.writeBuffer();
  const safeRombelNama = rombel.nama.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `Leger_Nilai_Kelas_${safeRombelNama}_F4_Landscape.xlsx`;

  return { buffer, fileName };
}
