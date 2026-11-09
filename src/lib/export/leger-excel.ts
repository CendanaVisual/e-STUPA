import "server-only";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import {
  buildDeskripsiCapaianTp,
  resolveTpDeskripsiText,
  type TpScoreEntry,
} from "@/lib/grading/calc";
import { addSignatureToWorksheet } from "./signature-helper";

export async function buildLegerWorkbook(
  rombelId: string,
  _selectedAgamaKode: string = "PAH",
  options?: { mode?: string; pembelajaranId?: string }
) {
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
          include: { mapel: true, gtk: true },
        },
      },
    }),
    db.sekolah.findFirst({ orderBy: { updatedAt: "desc" } }),
    db.semester.findFirst({
      where: { isAktif: true },
      include: { tahunAjaran: true },
    }),
  ]);

  if (!rombel) {
    throw new Error("Rombel tidak ditemukan");
  }

  const semester = rombel.semester || activeSemester;

  // ===========================================================================
  // MODE KHUSUS GURU MAPEL:
  // No | NISN | Nama Peserta Didik | L/P | Nilai (Nilai Akhir) | Rank | Deskripsi
  // ===========================================================================
  if (options?.mode === "mapel" && options.pembelajaranId) {
    const targetP = rombel.pembelajaran.find((p) => p.id === options.pembelajaranId);
    if (!targetP) {
      throw new Error("Data pembelajaran mata pelajaran tidak ditemukan pada rombel ini");
    }

    const [nilaiRaporList, pCols, masterTps] = await Promise.all([
      db.nilaiRapor.findMany({
        where: { pembelajaranId: targetP.id },
      }),
      db.penilaian.findMany({
        where: { pembelajaranId: targetP.id, kategori: "HARIAN" },
        include: { nilai: true },
        orderBy: { urutan: "asc" },
      }),
      semester
        ? db.tujuanPembelajaran.findMany({
            where: {
              semesterId: semester.id,
              tingkat: rombel.tingkat,
              mapelId: targetP.mapelId,
            },
            orderBy: [{ urutan: "asc" }, { kodeTp: "asc" }],
          })
        : Promise.resolve([]),
    ]);

    const kktp = targetP.kktp ?? 75;
    const nilaiMap = new Map<string, number>();
    const deskripsiMap = new Map<string, string>();

    nilaiRaporList.forEach((nr) => {
      if (nr.nilaiAkhir !== null) {
        nilaiMap.set(nr.siswaId, Math.round(Number(nr.nilaiAkhir)));
      }
      const savedDesc = [nr.capaianTertinggi, nr.capaianTerendah]
        .filter((s): s is string => Boolean(s && s.trim()))
        .join(" ");
      if (savedDesc) {
        deskripsiMap.set(nr.siswaId, savedDesc);
      }
    });

    for (const agg of rombel.anggota) {
      if (deskripsiMap.has(agg.siswaId)) continue;
      const entries: TpScoreEntry[] = [];
      for (const col of pCols) {
        const n = col.nilai.find((item) => item.siswaId === agg.siswaId);
        if (n && n.nilai !== null) {
          entries.push({
            kode: col.nama,
            deskripsi: resolveTpDeskripsiText(col, masterTps),
            nilai: Number(n.nilai),
          });
        }
      }
      if (entries.length > 0) {
        const built = buildDeskripsiCapaianTp(entries, kktp);
        if (built.deskripsiGabungan) {
          deskripsiMap.set(agg.siswaId, built.deskripsiGabungan);
        }
      }
    }

    const scoredStudents = rombel.anggota
      .map((agg) => ({ siswaId: agg.siswaId, score: nilaiMap.get(agg.siswaId) }))
      .filter((x): x is { siswaId: string; score: number } => x.score !== undefined)
      .sort((a, b) => b.score - a.score);

    const rankMap = new Map<string, number>();
    scoredStudents.forEach((item, idx) => {
      if (idx > 0 && item.score === scoredStudents[idx - 1].score) {
        rankMap.set(item.siswaId, rankMap.get(scoredStudents[idx - 1].siswaId) ?? idx + 1);
      } else {
        rankMap.set(item.siswaId, idx + 1);
      }
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = "e-STUPA";
    wb.created = new Date();

    const ws = wb.addWorksheet("Leger_Mapel", {
      views: [{ showGridLines: true }],
      pageSetup: {
        orientation: "landscape",
        paperSize: 14 as ExcelJS.PaperSize,
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

    ws.columns = [
      { width: 6 }, // No
      { width: 15 }, // NISN
      { width: 30 }, // Nama Peserta Didik
      { width: 7 }, // L/P
      { width: 16 }, // Nilai (Nilai Akhir)
      { width: 10 }, // Rank
      { width: 65 }, // Deskripsi
    ];

    ws.mergeCells("A1:G1");
    ws.getCell("A1").value = `LEGER NILAI KELAS MATA PELAJARAN ${targetP.mapel.nama.toUpperCase()}`;
    ws.getCell("A1").font = { name: "Arial", size: 13, bold: true, color: { argb: "FF0F172A" } };
    ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 22;

    ws.mergeCells("A2:G2");
    ws.getCell("A2").value = `${(sekolah?.nama || "SD NEGERI 7 PEDUNGAN").toUpperCase()} • NPSN: ${sekolah?.npsn || "50103069"}${sekolah?.telepon ? ` • Telp: ${sekolah.telepon}` : ""}`;
    ws.getCell("A2").font = { name: "Arial", size: 10, bold: true, color: { argb: "FF334155" } };
    ws.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(2).height = 18;

    ws.mergeCells("A4:D4");
    ws.getCell("A4").value = `Kelas: ${rombel.nama} (Tingkat ${rombel.tingkat})  |  Guru Mapel: ${targetP.gtk?.nama || "-"}`;
    ws.getCell("A4").font = { name: "Arial", size: 9.5, bold: true };
    ws.getCell("A4").alignment = { horizontal: "left", vertical: "middle" };

    ws.mergeCells("E4:G4");
    ws.getCell("E4").value = `T.A.: ${semester?.tahunAjaran?.nama || "2026/2027"} (${semester?.tipe || "GANJIL"})  |  KKTP: ${kktp}`;
    ws.getCell("E4").font = { name: "Arial", size: 9.5, bold: true };
    ws.getCell("E4").alignment = { horizontal: "right", vertical: "middle" };

    const headerRow = ws.getRow(6);
    headerRow.values = [
      "No",
      "NISN",
      "Nama Peserta Didik",
      "L/P",
      "Nilai (Nilai Akhir)",
      "Rank",
      "Deskripsi (TP Tercapai & TP Perlu Bimbingan)",
    ];
    headerRow.height = 24;

    const borderStyle: Partial<ExcelJS.Borders> = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };

    for (let c = 1; c <= 7; c++) {
      const cell = headerRow.getCell(c);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
      cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: c === 7 ? "left" : "center", vertical: "middle", wrapText: true };
      cell.border = borderStyle;
    }

    let currentRowNum = 7;
    rombel.anggota.forEach((agg, idx) => {
      const score = nilaiMap.get(agg.siswaId);
      const rank = rankMap.get(agg.siswaId);
      const desc = deskripsiMap.get(agg.siswaId) || "-";

      const row = ws.getRow(currentRowNum);
      row.values = [
        agg.noAbsen || idx + 1,
        agg.siswa.nisn,
        agg.siswa.nama,
        agg.siswa.jenisKelamin,
        score !== undefined ? score : "-",
        rank !== undefined ? `#${rank}` : "-",
        desc,
      ];
      row.height = 26;

      const isEven = idx % 2 === 0;
      for (let c = 1; c <= 7; c++) {
        const cell = row.getCell(c);
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: isEven ? "FFFFFFFF" : "FFF8FAFC" },
        };
        cell.border = borderStyle;
        cell.font = {
          name: "Arial",
          size: 9,
          bold: c === 3 || c === 5 || c === 6,
        };
        cell.alignment = {
          horizontal: c === 3 || c === 7 ? "left" : "center",
          vertical: "middle",
          wrapText: c === 7,
        };
      }
      currentRowNum++;
    });

    const signRow = currentRowNum + 2;
    ws.mergeCells(`B${signRow}:C${signRow}`);
    ws.getCell(`B${signRow}`).value = "Mengetahui,\nKepala Sekolah";
    ws.getCell(`B${signRow}`).alignment = { horizontal: "center", wrapText: true };
    ws.getRow(signRow).height = 26;

    ws.mergeCells(`F${signRow}:G${signRow}`);
    ws.getCell(`F${signRow}`).value = `${sekolah?.desaKelurahan || "Denpasar"}, ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}\nGuru Mata Pelajaran`;
    ws.getCell(`F${signRow}`).alignment = { horizontal: "center", wrapText: true };

    const nameRow = signRow + 4;
    ws.mergeCells(`B${nameRow}:C${nameRow}`);
    ws.getCell(`B${nameRow}`).value = sekolah?.namaKepsek || "-";
    ws.getCell(`B${nameRow}`).font = { name: "Arial", size: 9, bold: true, underline: true };
    ws.getCell(`B${nameRow}`).alignment = { horizontal: "center" };

    ws.mergeCells(`F${nameRow}:G${nameRow}`);
    ws.getCell(`F${nameRow}`).value = targetP.gtk?.nama || "Guru Mata Pelajaran";
    ws.getCell(`F${nameRow}`).font = { name: "Arial", size: 9, bold: true, underline: true };
    ws.getCell(`F${nameRow}`).alignment = { horizontal: "center" };

    const nipRow = nameRow + 1;
    ws.mergeCells(`B${nipRow}:C${nipRow}`);
    ws.getCell(`B${nipRow}`).value = `NIP. ${sekolah?.nipKepsek || "-"}`;
    ws.getCell(`B${nipRow}`).font = { name: "Arial", size: 8 };
    ws.getCell(`B${nipRow}`).alignment = { horizontal: "center" };

    ws.mergeCells(`F${nipRow}:G${nipRow}`);
    ws.getCell(`F${nipRow}`).value = `NIP. ${targetP.gtk?.nip || "-"}`;
    ws.getCell(`F${nipRow}`).font = { name: "Arial", size: 8 };
    ws.getCell(`F${nipRow}`).alignment = { horizontal: "center" };

    // Sematkan CAP Sekolah & TTD Kepsek serta TTD Guru Mapel (transparan)
    addSignatureToWorksheet(wb, ws, sekolah?.capTtdKepsekUrl, {
      col: 1.2,
      row: signRow,
      width: 155,
      height: 64,
    });
    addSignatureToWorksheet(wb, ws, targetP.gtk?.ttdUrl, {
      col: 5.55,
      row: signRow,
      width: 135,
      height: 58,
    });

    const buffer = await wb.xlsx.writeBuffer();
    const safeRombelNama = rombel.nama.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeMapelKode = targetP.mapel.kode.replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `Leger_Mapel_${safeMapelKode}_Kelas_${safeRombelNama}_F4.xlsx`;
    return { buffer, fileName };
  }

  // ===========================================================================
  // MODE LEGER LENGKAP (MATRIKS SELURUH MAPEL)
  // ===========================================================================
  const mapelOrderKeys = ["AGAMA", "PP", "BIND", "MTK", "IPAS", "PJOK", "SB", "BING", "MULOK"];

  const getMapelCategoryKey = (kode: string, nama: string = "") => {
    const k = kode.toUpperCase().trim();
    const nm = nama.toLowerCase();
    if (
      k.startsWith("PA") ||
      k === "PAB" ||
      k === "PAH" ||
      k === "PAI" ||
      k === "PAK" ||
      k === "PAKAT" ||
      k === "PABUD" ||
      nm.includes("agama")
    ) {
      return "AGAMA";
    }
    if (k === "PP") return "PP";
    if (k === "BIND") return "BIND";
    if (k === "MTK") return "MTK";
    if (k === "IPAS") return "IPAS";
    if (k === "PJOK" || nm.includes("jasmani")) return "PJOK";
    if (k === "SB") return "SB";
    if (k === "BING") return "BING";
    if (k === "MULOK" || k === "BB" || nm.includes("bahasa bali") || nm.includes("muatan lokal")) {
      return "MULOK";
    }
    return "OTHER";
  };

  const sortedPembelajaran = [...rombel.pembelajaran].sort((a, b) => {
    const keyA = getMapelCategoryKey(a.mapel.kode, a.mapel.nama);
    const keyB = getMapelCategoryKey(b.mapel.kode, b.mapel.nama);
    const idxA = mapelOrderKeys.indexOf(keyA);
    const idxB = mapelOrderKeys.indexOf(keyB);
    const posA = idxA !== -1 ? idxA : 99;
    const posB = idxB !== -1 ? idxB : 99;
    if (posA !== posB) return posA - posB;
    return a.mapel.nama.localeCompare(b.mapel.nama);
  });

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
      nilaiMap.set(`${nr.siswaId}_${nr.pembelajaranId}`, Math.round(Number(nr.nilaiAkhir)));
    }
  });

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
    const avg = count > 0 ? Math.round((total / count) * 100) / 100 : null;
    return {
      siswaId: agg.siswaId,
      total: count > 0 ? Math.round(total * 100) / 100 : null,
      avg,
    };
  });

  const sortedStats = siswaStats
    .filter((s): s is { siswaId: string; total: number; avg: number } => s.avg !== null)
    .sort((a, b) => b.avg - a.avg);
  const rankMap = new Map<string, number>();
  sortedStats.forEach((s, idx) => {
    if (idx > 0 && s.avg === sortedStats[idx - 1].avg) {
      rankMap.set(s.siswaId, rankMap.get(sortedStats[idx - 1].siswaId) ?? idx + 1);
    } else {
      rankMap.set(s.siswaId, idx + 1);
    }
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "e-STUPA";
  wb.created = new Date();

  const ws = wb.addWorksheet("Leger_Nilai", {
    views: [{ showGridLines: true }],
    pageSetup: {
      orientation: "landscape",
      paperSize: 14 as ExcelJS.PaperSize,
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

  const totalCols = 4 + sortedPembelajaran.length + 3;

  const colWidths: { width: number }[] = [
    { width: 5 },
    { width: 14 },
    { width: 28 },
    { width: 6 },
  ];
  sortedPembelajaran.forEach(() => {
    colWidths.push({ width: 9 });
  });
  colWidths.push({ width: 10 });
  colWidths.push({ width: 10 });
  colWidths.push({ width: 8 });
  ws.columns = colWidths;

  const lastColLetter = ws.getColumn(totalCols).letter;

  ws.mergeCells(`A1:${lastColLetter}1`);
  const titleCell = ws.getCell("A1");
  titleCell.value = "LEGER NILAI HASIL BELAJAR (KURIKULUM MERDEKA)";
  titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FF0F172A" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 24;

  ws.mergeCells(`A2:${lastColLetter}2`);
  const subTitleCell = ws.getCell("A2");
  subTitleCell.value = `${(sekolah?.nama || "SD NEGERI 7 PEDUNGAN").toUpperCase()} • NPSN: ${sekolah?.npsn || "50103069"}${sekolah?.telepon ? ` • Telp: ${sekolah.telepon}` : ""}`;
  subTitleCell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF334155" } };
  subTitleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 18;

  ws.mergeCells(`A4:D4`);
  ws.getCell("A4").value = `Kelas: ${rombel.nama} (Tingkat ${rombel.tingkat})  |  Wali Kelas: ${rombel.waliKelas?.nama || "-"}`;
  ws.getCell("A4").font = { name: "Arial", size: 10, bold: true };
  ws.getCell("A4").alignment = { horizontal: "left", vertical: "middle" };

  ws.mergeCells(`E4:${lastColLetter}4`);
  const metaRight = ws.getCell("E4");
  metaRight.value = `T.A.: ${semester?.tahunAjaran?.nama || "2026/2027"}  |  Semester: ${semester?.tipe || "GANJIL"}  |  Kertas: F4 Landscape`;
  metaRight.font = { name: "Arial", size: 10, bold: true };
  metaRight.alignment = { horizontal: "right", vertical: "middle" };

  const headerRow1 = ws.getRow(6);
  const headerVals1 = ["No", "NISN", "Nama Peserta Didik", "L/P"];
  sortedPembelajaran.forEach((p) => {
    headerVals1.push(p.mapel.kode);
  });
  headerVals1.push("Total", "Rata²", "Rank");
  headerRow1.values = headerVals1;
  headerRow1.height = 22;

  const headerRow2 = ws.getRow(7);
  const headerVals2 = ["", "", "", ""];
  sortedPembelajaran.forEach((p) => {
    headerVals2.push(`KKTP ${p.kktp || 75}`);
  });
  headerVals2.push("", "", "");
  headerRow2.values = headerVals2;
  headerRow2.height = 16;

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

  let currentRowNum = 8;
  const colTotals = new Array(sortedPembelajaran.length).fill(0);
  const colCounts = new Array(sortedPembelajaran.length).fill(0);

  rombel.anggota.forEach((agg, idx) => {
    const stat = siswaStats.find((s) => s.siswaId === agg.siswaId);
    const rank = rankMap.get(agg.siswaId);

    const row = ws.getRow(currentRowNum);
    const rowValues: (string | number)[] = [
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

    rowValues.push(stat?.total !== null && stat?.total !== undefined ? stat.total : "-");
    rowValues.push(stat?.avg !== null && stat?.avg !== undefined ? stat.avg : "-");
    rowValues.push(rank !== undefined ? rank : "-");

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
        cell.font = {
          name: "Arial",
          size: 9,
          bold: true,
          color: { argb: c === totalCols ? "FFD97706" : "FF1E40AF" },
        };
      } else {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      }
    }

    currentRowNum++;
  });

  const avgRow = ws.getRow(currentRowNum);
  const avgVals: (string | number)[] = ["", "", "RATA-RATA KELAS", ""];
  let grandTotalAvg = 0;
  let countAvg = 0;

  colTotals.forEach((tot, pIdx) => {
    const cnt = colCounts[pIdx];
    const avg = cnt > 0 ? Math.round((tot / cnt) * 10) / 10 : null;
    avgVals.push(avg !== null ? avg : "-");
    if (avg !== null) {
      grandTotalAvg += avg;
      countAvg++;
    }
  });

  const finalClassAvg = countAvg > 0 ? Math.round((grandTotalAvg / countAvg) * 10) / 10 : "-";
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
  ws.getCell(`B${nameRow}`).value = sekolah?.namaKepsek || "-";
  ws.getCell(`B${nameRow}`).font = { name: "Arial", size: 9, bold: true, underline: true };
  ws.getCell(`B${nameRow}`).alignment = { horizontal: "center" };

  ws.mergeCells(`${rightSignCol}${nameRow}:${rightSignEnd}${nameRow}`);
  ws.getCell(`${rightSignCol}${nameRow}`).value = rombel.waliKelas?.nama || "Wali Kelas";
  ws.getCell(`${rightSignCol}${nameRow}`).font = { name: "Arial", size: 9, bold: true, underline: true };
  ws.getCell(`${rightSignCol}${nameRow}`).alignment = { horizontal: "center" };

  const nipRow = nameRow + 1;
  ws.mergeCells(`B${nipRow}:D${nipRow}`);
  ws.getCell(`B${nipRow}`).value = `NIP. ${sekolah?.nipKepsek || "-"}`;
  ws.getCell(`B${nipRow}`).font = { name: "Arial", size: 8 };
  ws.getCell(`B${nipRow}`).alignment = { horizontal: "center" };

  ws.mergeCells(`${rightSignCol}${nipRow}:${rightSignEnd}${nipRow}`);
  ws.getCell(`${rightSignCol}${nipRow}`).value = `NIP. ${rombel.waliKelas?.nip || "-"}`;
  ws.getCell(`${rightSignCol}${nipRow}`).font = { name: "Arial", size: 8 };
  ws.getCell(`${rightSignCol}${nipRow}`).alignment = { horizontal: "center" };

  // Sematkan CAP Sekolah & TTD Kepsek serta TTD Wali Kelas (transparan)
  addSignatureToWorksheet(wb, ws, sekolah?.capTtdKepsekUrl, {
    col: 1.35,
    row: signTitleRow - 0.1,
    width: 155,
    height: 64,
  });
  addSignatureToWorksheet(wb, ws, rombel.waliKelas?.ttdUrl, {
    col: Math.max(4, totalCols - 3.3),
    row: signTitleRow - 0.1,
    width: 135,
    height: 58,
  });

  const buffer = await wb.xlsx.writeBuffer();
  const safeRombelNama = rombel.nama.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `Leger_Nilai_Kelas_${safeRombelNama}_F4_Landscape.xlsx`;

  return { buffer, fileName };
}
