import "server-only";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import {
  hitungNilaiAkhirLengkap,
  buildDeskripsiCapaianTp,
  resolveTpDeskripsiText,
  getFaseByTingkat,
  type TpScoreEntry,
} from "@/lib/grading/calc";
import { addSignatureToWorksheet } from "./signature-helper";

/**
 * Generator File Ekspor Nilai E-Rapor Kurikulum Merdeka (100% Data Realtime)
 * Tab 1: Format_Ekspor_E-Rapor (Nilai Akhir & Tingkat Ketercapaian TP "T" / "R" sesuai nilai nyata)
 * Tab 2: Olah_Nilai_Rinci (Seluruh kolom pengelolaan nilai TP, SLM, STS, SAS, Rata-rata, Nilai Akhir)
 * Tab 3: Pengaturan_TP_Bobot (Identitas, Bobot, & Daftar TP otomatis dari menu Tujuan Pembelajaran di Kolom D)
 * Tab 4: Statistik_Analisis (Statistik kelas berdasarkan data nilai aktual)
 */

function safeAvg(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null && !Number.isNaN(v));
  if (valid.length === 0) return null;
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 100) / 100;
}

function safeMax(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null && !Number.isNaN(v));
  if (valid.length === 0) return null;
  return Math.max(...valid);
}

function safeMin(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null && !Number.isNaN(v));
  if (valid.length === 0) return null;
  return Math.min(...valid);
}

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFCBD5E1" } },
  left: { style: "thin", color: { argb: "FFCBD5E1" } },
  bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
  right: { style: "thin", color: { argb: "FFCBD5E1" } },
};

function appendEraporSignatureBlock(
  wb: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  opts: {
    leftStartCol: number; // 1-based
    leftEndCol: number; // 1-based
    rightStartCol: number; // 1-based
    rightEndCol: number; // 1-based
    desaKelurahan: string;
    namaKepsek: string;
    nipKepsek: string;
    capTtdKepsekUrl?: string | null;
    guruNama: string;
    guruNip: string;
    guruTtdUrl?: string | null;
  }
) {
  ws.addRow([]);
  ws.addRow([]);
  const topRow = ws.addRow([]);
  const rTop = topRow.number;
  const titleRow = ws.addRow([]);
  const rTitle = titleRow.number;

  // 3 baris ruang tanda tangan & stempel
  ws.addRow([]).height = 18;
  ws.addRow([]).height = 18;
  ws.addRow([]).height = 18;

  const nameRow = ws.addRow([]);
  const rName = nameRow.number;
  const nipRow = ws.addRow([]);
  const rNip = nipRow.number;

  const tglCetak = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (opts.leftEndCol > opts.leftStartCol) {
    ws.mergeCells(rTop, opts.leftStartCol, rTop, opts.leftEndCol);
    ws.mergeCells(rTitle, opts.leftStartCol, rTitle, opts.leftEndCol);
    ws.mergeCells(rName, opts.leftStartCol, rName, opts.leftEndCol);
    ws.mergeCells(rNip, opts.leftStartCol, rNip, opts.leftEndCol);
  }

  if (opts.rightEndCol > opts.rightStartCol) {
    ws.mergeCells(rTop, opts.rightStartCol, rTop, opts.rightEndCol);
    ws.mergeCells(rTitle, opts.rightStartCol, rTitle, opts.rightEndCol);
    ws.mergeCells(rName, opts.rightStartCol, rName, opts.rightEndCol);
    ws.mergeCells(rNip, opts.rightStartCol, rNip, opts.rightEndCol);
  }

  const cLeftTop = ws.getRow(rTop).getCell(opts.leftStartCol);
  cLeftTop.value = "Mengetahui,";
  cLeftTop.font = { size: 10 };
  cLeftTop.alignment = { horizontal: "center" };

  const cLeftTitle = ws.getRow(rTitle).getCell(opts.leftStartCol);
  cLeftTitle.value = "Kepala Sekolah";
  cLeftTitle.font = { size: 10, bold: true };
  cLeftTitle.alignment = { horizontal: "center" };

  const cLeftName = ws.getRow(rName).getCell(opts.leftStartCol);
  cLeftName.value = opts.namaKepsek || "-";
  cLeftName.font = { size: 10, bold: true, underline: true };
  cLeftName.alignment = { horizontal: "center" };

  const cLeftNip = ws.getRow(rNip).getCell(opts.leftStartCol);
  cLeftNip.value = `NIP. ${opts.nipKepsek || "-"}`;
  cLeftNip.font = { size: 9 };
  cLeftNip.alignment = { horizontal: "center" };

  const cRightTop = ws.getRow(rTop).getCell(opts.rightStartCol);
  cRightTop.value = `${opts.desaKelurahan}, ${tglCetak}`;
  cRightTop.font = { size: 10 };
  cRightTop.alignment = { horizontal: "center" };

  const cRightTitle = ws.getRow(rTitle).getCell(opts.rightStartCol);
  cRightTitle.value = "Guru Pengampu";
  cRightTitle.font = { size: 10, bold: true };
  cRightTitle.alignment = { horizontal: "center" };

  const cRightName = ws.getRow(rName).getCell(opts.rightStartCol);
  cRightName.value = opts.guruNama || "Guru Pengampu";
  cRightName.font = { size: 10, bold: true, underline: true };
  cRightName.alignment = { horizontal: "center" };

  const cRightNip = ws.getRow(rNip).getCell(opts.rightStartCol);
  cRightNip.value = `NIP. ${opts.guruNip || "-"}`;
  cRightNip.font = { size: 9 };
  cRightNip.alignment = { horizontal: "center" };

  // Sematkan CAP Sekolah & TTD Kepsek serta TTD Guru Pengampu transparan
  addSignatureToWorksheet(wb, ws, opts.capTtdKepsekUrl, {
    col: Math.max(0, opts.leftStartCol - 1 + 0.25),
    row: rTitle - 0.1,
    width: 155,
    height: 64,
  });
  addSignatureToWorksheet(wb, ws, opts.guruTtdUrl, {
    col: Math.max(0, opts.rightStartCol - 1 + 0.25),
    row: rTitle - 0.1,
    width: 135,
    height: 58,
  });
}

export async function buildEraporWorkbook(pembelajaranId: string) {
  const [p, sekolah] = await Promise.all([
    db.pembelajaran.findUnique({
      where: { id: pembelajaranId },
      include: {
        mapel: true,
        gtk: true,
        semester: { include: { tahunAjaran: true } },
        rombel: {
          include: {
            anggota: {
              include: { siswa: true },
              orderBy: [{ noAbsen: "asc" }, { siswa: { nama: "asc" } }],
            },
          },
        },
        penilaian: {
          include: { nilai: true },
          orderBy: [{ urutan: "asc" }],
        },
        nilaiRapor: true,
      },
    }),
    db.sekolah.findFirst(),
  ]);

  if (!p) {
    throw new Error("Pembelajaran tidak ditemukan");
  }

  // Ambil daftar Tujuan Pembelajaran dari menu Tujuan Pembelajaran sesuai tingkat & mapel
  const masterTps = await db.tujuanPembelajaran.findMany({
    where: {
      semesterId: p.semesterId,
      tingkat: p.rombel.tingkat,
      mapelId: p.mapelId,
    },
    orderBy: [{ urutan: "asc" }, { kodeTp: "asc" }],
  });

  const kktp = p.kktp ?? 75;
  const bobotHarianPct = p.bobotHarian ?? 50;
  const bobotUtsPct = p.bobotUts ?? 25;
  const bobotUasPct = p.bobotUas ?? 25;

  const namaSekolah = sekolah?.nama ?? "SD Negeri 7 Pedungan";
  const npsn = sekolah?.npsn ?? "50103069";
  const tahunPelajaran = p.semester.tahunAjaran?.nama ?? "2026/2027";
  const semesterStr = `${p.semester.tipe === "GANJIL" ? "Ganjil (1)" : "Genap (2)"} - ${tahunPelajaran}`;
  const faseStr = getFaseByTingkat(p.rombel.tingkat);
  const kelasFase = `Kelas ${p.rombel.nama} (Tingkat ${p.rombel.tingkat}) / ${faseStr}`;
  const mapelNama = p.mapel.nama;
  const kodeMapel = p.mapel.kodeErapor || p.mapel.kode || "MAPEL";
  const guruNama = p.gtk?.nama ?? "Guru Pengampu";
  const guruNip = p.gtk?.nip ?? p.gtk?.nuptk ?? "-";

  // Kelompokkan seluruh kolom penilaian yang ada di Kelas & Input Nilai
  const harianCols = p.penilaian
    .filter((col) => col.kategori === "HARIAN")
    .sort((a, b) => a.urutan - b.urutan);
  const slmCols = p.penilaian
    .filter((col) => col.kategori === "SLM")
    .sort((a, b) => a.urutan - b.urutan);
  const utsCols = p.penilaian
    .filter((col) => col.kategori === "UTS")
    .sort((a, b) => a.urutan - b.urutan);
  const uasCols = p.penilaian
    .filter((col) => col.kategori === "UAS")
    .sort((a, b) => a.urutan - b.urutan);

  // Peta nilai mentah nyata per sel: `${penilaianId}_${siswaId}` -> number
  const rawScoreMap = new Map<string, number>();
  p.penilaian.forEach((pen) => {
    pen.nilai.forEach((nv) => {
      if (nv.nilai !== null) {
        rawScoreMap.set(`${pen.id}_${nv.siswaId}`, Number(nv.nilai));
      }
    });
  });

  const raporMap = new Map(p.nilaiRapor.map((r) => [r.siswaId, r]));

  // Tentukan kolom TP yang ditampilkan pada Sheet 1 (Format_Ekspor_E-Rapor):
  // Sesuaikan TP yang dimunculkan dengan kolom TP yang sudah diisi nilai!
  // Jika belum ada satu pun TP yang diisi nilai, tampilkan kolom TP yang tersedia (tanpa isi otomatis).
  const scoredHarianCols = harianCols.filter((col) =>
    p.rombel.anggota.some((ang) => rawScoreMap.has(`${col.id}_${ang.siswaId}`))
  );

  const ws1TpCols: Array<{ id: string; nama: string }> =
    scoredHarianCols.length > 0
      ? scoredHarianCols.map((c) => ({ id: c.id, nama: c.nama }))
      : harianCols.length > 0
      ? harianCols.map((c) => ({ id: c.id, nama: c.nama }))
      : masterTps.length > 0
      ? masterTps.map((tp) => ({ id: tp.id, nama: tp.kodeTp }))
      : [{ id: "__empty_tp_1__", nama: "TP 1" }];

  // Kompilasi metrik setiap siswa secara murni dari data database (tanpa nilai dummy!)
  const studentMetrics = p.rombel.anggota.map((ang, idx) => {
    const s = ang.siswa;
    const r = raporMap.get(s.id);

    const tpVals = harianCols.map((col) => rawScoreMap.get(`${col.id}_${s.id}`) ?? null);
    const slmVals = slmCols.map((col) => rawScoreMap.get(`${col.id}_${s.id}`) ?? null);
    const utsVals = utsCols.map((col) => rawScoreMap.get(`${col.id}_${s.id}`) ?? null);
    const uasVals = uasCols.map((col) => rawScoreMap.get(`${col.id}_${s.id}`) ?? null);

    const calc = hitungNilaiAkhirLengkap(
      {
        harian: tpVals,
        slm: slmVals,
        uts: utsVals,
        uas: uasVals,
      },
      {
        bobotHarian: bobotHarianPct,
        bobotUts: bobotUtsPct,
        bobotUas: bobotUasPct,
      }
    );

    const avgTP =
      calc.rataHarian ??
      (r?.rataHarian !== null && r?.rataHarian !== undefined ? Number(r.rataHarian) : null);
    const avgSLM =
      calc.rataSlm ??
      (r?.rataSlm !== null && r?.rataSlm !== undefined ? Number(r.rataSlm) : null);
    const avgSTS =
      calc.nilaiUts ??
      (r?.nilaiUts !== null && r?.nilaiUts !== undefined ? Number(r.nilaiUts) : null);
    const avgSAS =
      calc.nilaiUas ??
      (r?.nilaiUas !== null && r?.nilaiUas !== undefined ? Number(r.nilaiUas) : null);

    const nilaiAkhir: number | null =
      calc.nilaiAkhir !== null
        ? calc.nilaiAkhir
        : r?.nilaiAkhir !== null && r?.nilaiAkhir !== undefined
        ? Number(r.nilaiAkhir)
        : null;

    let predikat = "";
    let statusKktp = "";
    if (nilaiAkhir !== null) {
      if (nilaiAkhir >= 90) predikat = "A";
      else if (nilaiAkhir >= 80) predikat = "B";
      else if (nilaiAkhir >= kktp) predikat = "C";
      else predikat = "D";

      statusKktp = nilaiAkhir >= kktp ? "Tuntas" : "Perlu Bimbingan";
    }

    // Kumpulkan TP yang benar-benar terisi nilai untuk identifikasi TP Tertinggi ("T") & Terendah ("R")
    const tpEntriesForDesc: TpScoreEntry[] = [];
    harianCols.forEach((col) => {
      const val = rawScoreMap.get(`${col.id}_${s.id}`);
      if (val !== undefined) {
        tpEntriesForDesc.push({
          kode: col.nama,
          deskripsi: resolveTpDeskripsiText(col, masterTps),
          nilai: val,
        });
      }
    });

    const descBuilt = buildDeskripsiCapaianTp(tpEntriesForDesc, kktp);
    const savedDesc = [r?.capaianTertinggi, r?.capaianTerendah]
      .filter((x): x is string => Boolean(x && x.trim()))
      .join(" ");
    const deskripsiCapaian = descBuilt.deskripsiGabungan || savedDesc || "";

    // Tanda "T" (Tertinggi) dan "R" (Terendah) pada kolom ws1TpCols di Sheet 1
    const ws1TpMarks: string[] = new Array(ws1TpCols.length).fill("");
    const scoredWs1 = ws1TpCols
      .map((col, cIdx) => {
        const val = rawScoreMap.get(`${col.id}_${s.id}`);
        return val !== undefined ? { cIdx, val } : null;
      })
      .filter((item): item is { cIdx: number; val: number } => item !== null);

    if (scoredWs1.length === 1) {
      ws1TpMarks[scoredWs1[0].cIdx] = scoredWs1[0].val >= kktp ? "T" : "R";
    } else if (scoredWs1.length >= 2) {
      let maxPos = 0;
      for (let i = 1; i < scoredWs1.length; i++) {
        if (scoredWs1[i].val > scoredWs1[maxPos].val) {
          maxPos = i;
        }
      }
      let minPos = -1;
      for (let i = scoredWs1.length - 1; i >= 0; i--) {
        if (i === maxPos) continue;
        if (minPos === -1 || scoredWs1[i].val < scoredWs1[minPos].val) {
          minPos = i;
        }
      }
      ws1TpMarks[scoredWs1[maxPos].cIdx] = "T";
      if (minPos !== -1) {
        ws1TpMarks[scoredWs1[minPos].cIdx] = "R";
      }
    }

    return {
      no: ang.noAbsen ?? idx + 1,
      id: s.id,
      pdId: s.dapodikId ?? "",
      nis: s.nis ?? "",
      nisn: s.nisn,
      nama: s.nama,
      gender: s.jenisKelamin,
      tpVals,
      slmVals,
      utsVals,
      uasVals,
      avgTP,
      avgSLM,
      avgSTS,
      avgSAS,
      nilaiAkhir,
      nilaiAkhirBulat: nilaiAkhir !== null ? Math.round(nilaiAkhir) : null,
      predikat,
      statusKktp,
      tpTertinggi: descBuilt.tpTertinggiKode,
      tpTerendah: descBuilt.tpTerendahKode,
      deskripsiCapaian,
      ws1TpMarks,
    };
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "STUPA - Sistem Terpadu Untuk Penilaian Akademik";
  wb.lastModifiedBy = "STUPA System";
  wb.created = new Date();
  wb.modified = new Date();

  // ===========================================================================
  // TAB 1: Format_Ekspor_E-Rapor
  // ===========================================================================
  const ws1 = wb.addWorksheet("Format_Ekspor_E-Rapor", {
    views: [{ showGridLines: true }],
  });

  ws1.addRow(["FORMAT EKSPOR / IMPOR NILAI AKHIR E-RAPOR KURIKULUM MERDEKA"]);
  ws1.addRow([
    "Data dituangkan secara realtime sesuai kelas/tingkat. Ket. Tingkat Ketercapaian TP: 'T' = TP Nilai Tertinggi (Optimal), 'R' = TP Nilai Terendah (Perlu Bimbingan).",
  ]);
  ws1.addRow([]);

  ws1.addRow(["", "Nama Sekolah", namaSekolah, "", "", "Kelas / Fase", kelasFase]);
  ws1.addRow(["", "NPSN", npsn, "", "", "Semester", semesterStr]);
  ws1.addRow(["", "Tahun Pelajaran", tahunPelajaran, "", "", "Guru Pengampu", guruNama]);
  ws1.addRow(["", "Mata Pelajaran", mapelNama, "", "", "Kode Mapel", kodeMapel]);
  ws1.addRow([]);

  const tpStartColWs1 = 6; // Kolom F
  const tpEndColWs1 = tpStartColWs1 + ws1TpCols.length - 1;
  const descColWs1 = tpEndColWs1 + 1;
  const validColWs1 = descColWs1 + 1;

  const ws1Header1: (string | number)[] = [
    "No",
    "NIS",
    "NISN",
    "Nama Peserta Didik",
    "Nilai Akhir",
    "Tingkat Ketercapaian TP",
  ];
  for (let i = 1; i < ws1TpCols.length; i++) {
    ws1Header1.push("");
  }
  ws1Header1.push("Deskripsi Capaian Kompetensi", "Status Nilai");

  const ws1Header2: (string | number)[] = ["", "", "", "", ""];
  ws1TpCols.forEach((col) => {
    ws1Header2.push(col.nama);
  });
  ws1Header2.push("", "");

  ws1.addRow(ws1Header1); // Baris 9
  ws1.addRow(ws1Header2); // Baris 10

  ws1.mergeCells(9, 1, 10, 1);
  ws1.mergeCells(9, 2, 10, 2);
  ws1.mergeCells(9, 3, 10, 3);
  ws1.mergeCells(9, 4, 10, 4);
  ws1.mergeCells(9, 5, 10, 5);
  if (tpEndColWs1 > tpStartColWs1) {
    ws1.mergeCells(9, tpStartColWs1, 9, tpEndColWs1);
  }
  ws1.mergeCells(9, descColWs1, 10, descColWs1);
  ws1.mergeCells(9, validColWs1, 10, validColWs1);

  studentMetrics.forEach((st) => {
    const rowValues: (string | number | null)[] = [
      st.no,
      st.nis || null,
      st.nisn,
      st.nama,
      st.nilaiAkhirBulat,
      ...st.ws1TpMarks.map((m) => (m === "" ? null : m)),
      st.deskripsiCapaian || null,
      st.nilaiAkhir !== null ? "Lengkap" : null,
    ];
    const added = ws1.addRow(rowValues);
    added.height = 22;

    for (let c = 1; c <= validColWs1; c++) {
      const cell = added.getCell(c);
      cell.border = THIN_BORDER;
      cell.font = { size: 10 };
      if (c === 4 || c === descColWs1) {
        cell.alignment = { horizontal: "left", vertical: "middle", wrapText: c === descColWs1 };
      } else {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      }

      if (c >= tpStartColWs1 && c <= tpEndColWs1) {
        const val = cell.value;
        if (val === "T") {
          cell.font = { bold: true, size: 10, color: { argb: "FF047857" } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFECFDF5" } };
        } else if (val === "R") {
          cell.font = { bold: true, size: 10, color: { argb: "FFB91C1C" } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF2F2" } };
        }
      } else if (c === 5 && st.nilaiAkhirBulat !== null) {
        cell.font = { bold: true, size: 10, color: { argb: "FF1E3A8A" } };
      }
    }
  });

  ws1.getRow(1).font = { bold: true, size: 13, color: { argb: "FF1E3A8A" } };
  ws1.getRow(2).font = { italic: true, size: 10, color: { argb: "FF475569" } };
  [4, 5, 6, 7].forEach((r) => {
    const row = ws1.getRow(r);
    row.font = { size: 10 };
    row.getCell(2).font = { bold: true };
    row.getCell(6).font = { bold: true };
  });

  [ws1.getRow(9), ws1.getRow(10)].forEach((row) => {
    row.height = 20;
    for (let c = 1; c <= validColWs1; c++) {
      const cell = row.getCell(c);
      cell.font = { bold: true, size: 10, color: { argb: "FF0F172A" } };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE2E8F0" },
      };
      cell.border = THIN_BORDER;
    }
  });

  const ws1ColWidths: { width: number }[] = [
    { width: 6 },
    { width: 12 },
    { width: 14 },
    { width: 32 },
    { width: 12 },
  ];
  ws1TpCols.forEach((col) => {
    ws1ColWidths.push({ width: Math.max(10, col.nama.length + 4) });
  });
  ws1ColWidths.push({ width: 50 });
  ws1ColWidths.push({ width: 14 });
  ws1.columns = ws1ColWidths;

  appendEraporSignatureBlock(wb, ws1, {
    leftStartCol: 2,
    leftEndCol: 4,
    rightStartCol: Math.max(5, validColWs1 - 1),
    rightEndCol: validColWs1,
    desaKelurahan: sekolah?.desaKelurahan || "Denpasar",
    namaKepsek: sekolah?.namaKepsek || "-",
    nipKepsek: sekolah?.nipKepsek || "-",
    capTtdKepsekUrl: sekolah?.capTtdKepsekUrl,
    guruNama,
    guruNip,
    guruTtdUrl: p.gtk?.ttdUrl,
  });

  // ===========================================================================
  // TAB 2: Olah_Nilai_Rinci (Keseluruhan Pengelolaan Nilai Realtime)
  // ===========================================================================
  const ws2 = wb.addWorksheet("Olah_Nilai_Rinci", {
    views: [{ showGridLines: true }],
  });

  ws2.addRow(["LEMBAR PENGOLAHAN NILAI RINCI (FORMATIF / TP, SUMATIF LINGKUP MATERI, STS & SAS)"]);
  ws2.addRow([
    "Menampilkan keseluruhan kolom pengelolaan nilai secara realtime sesuai data pada menu Kelas & Input Nilai (kosong apabila belum diinput).",
  ]);
  ws2.addRow([]);
  ws2.addRow([
    "Mata Pelajaran:",
    mapelNama,
    "",
    "Kelas / Fase:",
    kelasFase,
    "",
    "Semester / TP:",
    semesterStr,
    "",
    "KKTP Minimum:",
    kktp,
  ]);
  ws2.addRow([]);
  ws2.addRow([]);

  const tpDisplayCols =
    harianCols.length > 0 ? harianCols.map((c) => c.nama) : ["TP 1"];
  const slmDisplayCols =
    slmCols.length > 0 ? slmCols.map((c) => c.nama) : ["SLM 1"];
  const hasUts = utsCols.length > 0;
  const utsDisplayCols = utsCols.map((c) => c.nama);
  const uasDisplayCols =
    uasCols.length > 0 ? uasCols.map((c) => c.nama) : ["SAS"];

  const ws2TopHeader: string[] = [
    "No",
    "ID Peserta Didik (PD_ID)",
    "NIS",
    "NISN",
    "Nama Peserta Didik",
    "L/P",
  ];
  const ws2SubHeader: string[] = ["", "", "", "", "", ""];

  // Grup TP (+ Rata-rata TP)
  const tpGroupStart = ws2TopHeader.length + 1;
  ws2TopHeader.push("Asesmen Formatif / Tujuan Pembelajaran (TP)");
  for (let i = 0; i < tpDisplayCols.length; i++) {
    if (i > 0) ws2TopHeader.push("");
    ws2SubHeader.push(tpDisplayCols[i]);
  }
  ws2TopHeader.push("");
  ws2SubHeader.push("Rata-rata TP");
  const tpGroupEnd = ws2TopHeader.length;

  // Grup SLM (+ Rata-rata SLM)
  const slmGroupStart = ws2TopHeader.length + 1;
  ws2TopHeader.push("Sumatif Lingkup Materi (SLM)");
  for (let i = 0; i < slmDisplayCols.length; i++) {
    if (i > 0) ws2TopHeader.push("");
    ws2SubHeader.push(slmDisplayCols[i]);
  }
  ws2TopHeader.push("");
  ws2SubHeader.push("Rata-rata SLM");
  const slmGroupEnd = ws2TopHeader.length;

  // Grup STS (jika ada kolom UTS)
  let utsGroupStart = -1;
  let utsGroupEnd = -1;
  if (hasUts) {
    utsGroupStart = ws2TopHeader.length + 1;
    ws2TopHeader.push("Sumatif Tengah Semester (STS)");
    for (let i = 0; i < utsDisplayCols.length; i++) {
      if (i > 0) ws2TopHeader.push("");
      ws2SubHeader.push(utsDisplayCols[i]);
    }
    if (utsDisplayCols.length > 1) {
      ws2TopHeader.push("");
      ws2SubHeader.push("Rata-rata STS");
    }
    utsGroupEnd = ws2TopHeader.length;
  }

  // Grup SAS
  const uasGroupStart = ws2TopHeader.length + 1;
  ws2TopHeader.push("Sumatif Akhir Semester (SAS)");
  for (let i = 0; i < uasDisplayCols.length; i++) {
    if (i > 0) ws2TopHeader.push("");
    ws2SubHeader.push(uasDisplayCols[i]);
  }
  if (uasDisplayCols.length > 1) {
    ws2TopHeader.push("");
    ws2SubHeader.push("Rata-rata SAS");
  }
  const uasGroupEnd = ws2TopHeader.length;

  // Grup Nilai Akhir E-Rapor
  const naGroupStart = ws2TopHeader.length + 1;
  ws2TopHeader.push("Nilai Akhir E-Rapor", "", "");
  ws2SubHeader.push("Nilai Akhir (Rapor)", "Predikat", "Status KKTP");
  const naGroupEnd = ws2TopHeader.length;

  // Grup Identifikasi Capaian TP
  const capGroupStart = ws2TopHeader.length + 1;
  ws2TopHeader.push("Identifikasi & Deskripsi Capaian TP", "", "");
  ws2SubHeader.push("TP Tertinggi (T)", "TP Terendah (R)", "Deskripsi Capaian");
  const capGroupEnd = ws2TopHeader.length;

  const totalWs2Cols = ws2TopHeader.length;

  ws2.addRow(ws2TopHeader); // Baris 7
  ws2.addRow(ws2SubHeader); // Baris 8

  for (let c = 1; c <= 6; c++) {
    ws2.mergeCells(7, c, 8, c);
  }
  if (tpGroupEnd > tpGroupStart) ws2.mergeCells(7, tpGroupStart, 7, tpGroupEnd);
  if (slmGroupEnd > slmGroupStart) ws2.mergeCells(7, slmGroupStart, 7, slmGroupEnd);
  if (hasUts && utsGroupEnd > utsGroupStart) ws2.mergeCells(7, utsGroupStart, 7, utsGroupEnd);
  if (uasGroupEnd > uasGroupStart) ws2.mergeCells(7, uasGroupStart, 7, uasGroupEnd);
  ws2.mergeCells(7, naGroupStart, 7, naGroupEnd);
  ws2.mergeCells(7, capGroupStart, 7, capGroupEnd);

  // Kumpulkan nilai numerik per kolom untuk baris statistik bawah
  const numericColsMatrix: (number | null)[][] = [];

  studentMetrics.forEach((st) => {
    const tpCells = harianCols.length > 0 ? st.tpVals : [null];
    const slmCells = slmCols.length > 0 ? st.slmVals : [null];
    const utsCells = hasUts
      ? utsCols.length > 1
        ? [...st.utsVals, st.avgSTS]
        : st.utsVals
      : [];
    const uasCells =
      uasCols.length > 0
        ? uasCols.length > 1
          ? [...st.uasVals, st.avgSAS]
          : st.uasVals
        : [st.avgSAS];

    const numericPortion: (number | null)[] = [
      ...tpCells,
      st.avgTP,
      ...slmCells,
      st.avgSLM,
      ...utsCells,
      ...uasCells,
      st.nilaiAkhir,
    ];
    numericColsMatrix.push(numericPortion);

    const rowData: (string | number | null)[] = [
      st.no,
      st.pdId || null,
      st.nis || null,
      st.nisn,
      st.nama,
      st.gender,
      ...numericPortion,
      st.predikat || null,
      st.statusKktp || null,
      st.tpTertinggi || null,
      st.tpTerendah || null,
      st.deskripsiCapaian || null,
    ];

    const r = ws2.addRow(rowData);
    r.height = 20;
    for (let c = 1; c <= totalWs2Cols; c++) {
      const cell = r.getCell(c);
      cell.border = THIN_BORDER;
      cell.font = { size: 9.5 };
      if (c === 5 || c === totalWs2Cols) {
        cell.alignment = { horizontal: "left", vertical: "middle", wrapText: c === totalWs2Cols };
      } else {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      }
      if (c === naGroupStart && st.nilaiAkhir !== null) {
        cell.font = { bold: true, size: 9.5, color: { argb: "FF1E3A8A" } };
      }
    }
  });

  // Baris Ringkasan: Rata-rata Kelas, Nilai Tertinggi, Nilai Terendah (hanya atas sel berisi nilai!)
  const numSlotCount = numericColsMatrix[0]?.length ?? 0;
  const colValuesAt = (slotIdx: number) =>
    numericColsMatrix.map((row) => row[slotIdx] ?? null);

  const summarySpecs: Array<{ label: string; fn: (vals: (number | null)[]) => number | null }> = [
    { label: "Rata-rata Kelas", fn: safeAvg },
    { label: "Nilai Tertinggi", fn: safeMax },
    { label: "Nilai Terendah", fn: safeMin },
  ];

  summarySpecs.forEach((spec) => {
    const rowArr: (string | number | null)[] = [spec.label, "", "", "", "", ""];
    for (let sIdx = 0; sIdx < numSlotCount; sIdx++) {
      rowArr.push(spec.fn(colValuesAt(sIdx)));
    }
    rowArr.push(null, null, null, null, null);
    const sr = ws2.addRow(rowArr);
    sr.height = 20;
    ws2.mergeCells(sr.number, 1, sr.number, 6);
    for (let c = 1; c <= totalWs2Cols; c++) {
      const cell = sr.getCell(c);
      cell.border = THIN_BORDER;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      cell.font = { bold: true, size: 9.5 };
      cell.alignment = { horizontal: c === 1 ? "right" : "center", vertical: "middle" };
    }
  });

  ws2.getRow(1).font = { bold: true, size: 12, color: { argb: "FF1E3A8A" } };
  ws2.getRow(2).font = { italic: true, size: 9.5, color: { argb: "FF475569" } };
  [ws2.getRow(7), ws2.getRow(8)].forEach((r) => {
    r.height = 21;
    for (let c = 1; c <= totalWs2Cols; c++) {
      const cell = r.getCell(c);
      cell.font = { bold: true, size: 9 };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE2E8F0" },
      };
      cell.border = THIN_BORDER;
    }
  });

  const ws2Widths: { width: number }[] = [
    { width: 5 },
    { width: 16 },
    { width: 11 },
    { width: 14 },
    { width: 28 },
    { width: 6 },
  ];
  for (let i = 0; i < numSlotCount; i++) {
    ws2Widths.push({ width: 11 });
  }
  ws2Widths.push(
    { width: 9 },
    { width: 15 },
    { width: 14 },
    { width: 14 },
    { width: 46 }
  );
  ws2.columns = ws2Widths;

  appendEraporSignatureBlock(wb, ws2, {
    leftStartCol: 2,
    leftEndCol: 5,
    rightStartCol: Math.max(6, totalWs2Cols - 2),
    rightEndCol: totalWs2Cols,
    desaKelurahan: sekolah?.desaKelurahan || "Denpasar",
    namaKepsek: sekolah?.namaKepsek || "-",
    nipKepsek: sekolah?.nipKepsek || "-",
    capTtdKepsekUrl: sekolah?.capTtdKepsekUrl,
    guruNama,
    guruNip,
    guruTtdUrl: p.gtk?.ttdUrl,
  });

  // ===========================================================================
  // TAB 3: Pengaturan_TP_Bobot (Kolom D otomatis dari menu Tujuan Pembelajaran)
  // ===========================================================================
  const ws3 = wb.addWorksheet("Pengaturan_TP_Bobot", {
    views: [{ showGridLines: true }],
  });

  ws3.addRow(["PENGATURAN IDENTITAS KELAS, BOBOT PENILAIAN, DAN TUJUAN PEMBELAJARAN (TP)"]);
  ws3.addRow([
    "Daftar Tujuan Pembelajaran (Kolom D s.d. H) ditarik otomatis dari menu Tujuan Pembelajaran sesuai tingkat kelas dan mata pelajaran.",
  ]);
  ws3.addRow([]);

  ws3.addRow([
    "A. IDENTITAS SEKOLAH & MATA PELAJARAN",
    "",
    "",
    "B. PENGATURAN BOBOT NILAI AKHIR",
    "",
    "",
  ]);
  ws3.addRow(["Nama Sekolah", namaSekolah, "", "Komponen Penilaian", "Kode", "Bobot (%)"]);
  ws3.addRow([
    "NPSN",
    npsn,
    "",
    "Rata-rata Formatif / Tujuan Pembelajaran (TP)",
    "BOBOT_TP",
    bobotHarianPct,
  ]);
  ws3.addRow([
    "Kurikulum",
    "Kurikulum Merdeka",
    "",
    "Rata-rata Sumatif Lingkup Materi (SLM) / STS",
    "BOBOT_SLM",
    bobotUtsPct,
  ]);
  ws3.addRow([
    "Tahun Pelajaran",
    tahunPelajaran,
    "",
    "Sumatif Akhir Semester (SAS)",
    "BOBOT_SAS",
    bobotUasPct,
  ]);
  ws3.addRow([
    "Semester",
    semesterStr,
    "",
    "Total Bobot (100%)",
    "",
    bobotHarianPct + bobotUtsPct + bobotUasPct,
  ]);
  ws3.addRow(["Kelas / Fase", kelasFase]);
  ws3.addRow([
    "Mata Pelajaran",
    mapelNama,
    "",
    "C. DAFTAR TUJUAN PEMBELAJARAN (UNTUK DESKRIPSI CAPAIAN OTOMATIS)",
  ]);
  ws3.addRow([
    "Kode Mapel E-Rapor",
    kodeMapel,
    "",
    "Kode TP",
    "Tujuan Pembelajaran",
    "Template Kalimat Capaian Optimal",
    "Template Kalimat Perlu Bimbingan",
    "Ruang Lingkup Materi",
  ]);

  // Sumber daftar TP: prioritas utama dari tabel TujuanPembelajaran; fallback dari kolom HARIAN jika ada
  const tpRowsForSheet3 =
    masterTps.length > 0
      ? masterTps.map((tp) => {
          const clean = tp.tujuanPembelajaran.trim().replace(/\.+$/, "");
          return {
            kodeTp: tp.kodeTp,
            tujuanPembelajaran: tp.tujuanPembelajaran,
            optimal: `Menunjukkan penguasaan yang baik dalam ${clean}.`,
            bimbingan: `Perlu bimbingan lebih lanjut dalam ${clean}.`,
            lingkup: tp.ruangLingkupMateri || "",
          };
        })
      : harianCols
          .filter((c) => Boolean(c.nama))
          .map((c) => {
            const rawDesc = (c.tujuanPembelajaran || c.nama).trim().replace(/\.+$/, "");
            return {
              kodeTp: c.nama,
              tujuanPembelajaran: c.tujuanPembelajaran || "",
              optimal: c.tujuanPembelajaran
                ? `Menunjukkan penguasaan yang baik dalam ${rawDesc}.`
                : "",
              bimbingan: c.tujuanPembelajaran
                ? `Perlu bimbingan lebih lanjut dalam ${rawDesc}.`
                : "",
              lingkup: "",
            };
          });

  const leftMetaRows: Array<[string, string | number]> = [
    ["Nama Guru Pengampu", guruNama],
    ["NIP / NUPTK Guru", guruNip],
    ["Batas Ketuntasan (KKTP)", kktp],
  ];

  const maxRowsSectionC = Math.max(leftMetaRows.length, tpRowsForSheet3.length, 1);
  for (let i = 0; i < maxRowsSectionC; i++) {
    const left = leftMetaRows[i] ?? ["", ""];
    const rightTp = tpRowsForSheet3[i];
    const row = ws3.addRow([
      left[0],
      left[1],
      "",
      rightTp ? rightTp.kodeTp : null,
      rightTp ? rightTp.tujuanPembelajaran : null,
      rightTp ? rightTp.optimal : null,
      rightTp ? rightTp.bimbingan : null,
      rightTp ? rightTp.lingkup : null,
    ]);
    row.alignment = { vertical: "middle", wrapText: true };
    if (rightTp) {
      for (let c = 4; c <= 8; c++) {
        row.getCell(c).border = THIN_BORDER;
      }
    }
  }

  ws3.getRow(1).font = { bold: true, size: 12, color: { argb: "FF1E3A8A" } };
  ws3.getRow(2).font = { italic: true, size: 9.5, color: { argb: "FF475569" } };
  ws3.getRow(4).font = { bold: true, size: 10 };
  ws3.getRow(11).getCell(4).font = { bold: true, size: 10, color: { argb: "FF1E3A8A" } };
  const tpHeaderRowWs3 = ws3.getRow(12);
  for (let c = 4; c <= 8; c++) {
    const cell = tpHeaderRowWs3.getCell(c);
    cell.font = { bold: true, size: 9.5 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    cell.border = THIN_BORDER;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  }

  ws3.columns = [
    { width: 24 },
    { width: 32 },
    { width: 4 },
    { width: 14 },
    { width: 42 },
    { width: 44 },
    { width: 44 },
    { width: 28 },
  ];

  appendEraporSignatureBlock(wb, ws3, {
    leftStartCol: 1,
    leftEndCol: 2,
    rightStartCol: 6,
    rightEndCol: 8,
    desaKelurahan: sekolah?.desaKelurahan || "Denpasar",
    namaKepsek: sekolah?.namaKepsek || "-",
    nipKepsek: sekolah?.nipKepsek || "-",
    capTtdKepsekUrl: sekolah?.capTtdKepsekUrl,
    guruNama,
    guruNip,
    guruTtdUrl: p.gtk?.ttdUrl,
  });

  // ===========================================================================
  // TAB 4: Statistik_Analisis (100% Data Aktual)
  // ===========================================================================
  const ws4 = wb.addWorksheet("Statistik_Analisis", {
    views: [{ showGridLines: true }],
  });

  const totalSiswa = studentMetrics.length;
  const gradedList = studentMetrics.filter((s) => s.nilaiAkhir !== null);
  const gradedCount = gradedList.length;
  const ungradedCount = totalSiswa - gradedCount;
  const tuntasCount = gradedList.filter((s) => (s.nilaiAkhir ?? 0) >= kktp).length;
  const remidialCount = gradedCount - tuntasCount;
  const persentaseKetuntasan =
    gradedCount > 0 ? Math.round((tuntasCount / gradedCount) * 10000) / 100 : null;

  const avgNA = safeAvg(studentMetrics.map((s) => s.nilaiAkhir));
  const maxNA = safeMax(studentMetrics.map((s) => s.nilaiAkhir));
  const minNA = safeMin(studentMetrics.map((s) => s.nilaiAkhir));

  const predA = gradedList.filter((s) => s.predikat === "A").length;
  const predB = gradedList.filter((s) => s.predikat === "B").length;
  const predC = gradedList.filter((s) => s.predikat === "C").length;
  const predD = gradedList.filter((s) => s.predikat === "D").length;

  ws4.addRow(["DASHBOARD ANALISIS & STATISTIK NILAI E-RAPOR"]);
  ws4.addRow([
    "Ringkasan ketuntasan belajar, distribusi predikat, dan rata-rata setiap komponen asesmen berdasarkan data aktual yang sudah diinput.",
  ]);
  ws4.addRow([]);

  ws4.addRow(["RINGKASAN STATISTIK KELAS", "NILAI", "", "Distribusi Predikat", "Jumlah Siswa", "Persentase (%)"]);
  ws4.addRow([
    "Jumlah Peserta Didik Rombel",
    totalSiswa,
    "",
    "Predikat A (90 - 100)",
    predA,
    gradedCount > 0 ? Math.round((predA / gradedCount) * 10000) / 100 : null,
  ]);
  ws4.addRow([
    "Jumlah Siswa Sudah Dinilai",
    gradedCount,
    "",
    "Predikat B (80 - 89)",
    predB,
    gradedCount > 0 ? Math.round((predB / gradedCount) * 10000) / 100 : null,
  ]);
  ws4.addRow([
    "Jumlah Siswa Belum Dinilai",
    ungradedCount,
    "",
    `Predikat C (${kktp} - 79)`,
    predC,
    gradedCount > 0 ? Math.round((predC / gradedCount) * 10000) / 100 : null,
  ]);
  ws4.addRow([
    "Rata-rata Nilai Akhir",
    avgNA,
    "",
    `Predikat D (< ${kktp})`,
    predD,
    gradedCount > 0 ? Math.round((predD / gradedCount) * 10000) / 100 : null,
  ]);
  ws4.addRow([
    "Nilai Akhir Tertinggi",
    maxNA,
    "",
    "Total Siswa Dinilai",
    gradedCount,
    gradedCount > 0 ? 100 : null,
  ]);
  ws4.addRow(["Nilai Akhir Terendah", minNA]);
  ws4.addRow(["Jumlah Siswa Tuntas KKTP", gradedCount > 0 ? tuntasCount : null]);
  ws4.addRow(["Jumlah Siswa Perlu Bimbingan", gradedCount > 0 ? remidialCount : null]);
  ws4.addRow([
    "Persentase Ketuntasan (%)",
    persentaseKetuntasan !== null ? `${persentaseKetuntasan}%` : null,
  ]);
  ws4.addRow([]);

  ws4.addRow(["Komponen Penilaian Terdaftar", "Kategori", "Rata-rata Kelas"]);
  p.penilaian.forEach((pen) => {
    const vals = p.rombel.anggota.map((ang) => rawScoreMap.get(`${pen.id}_${ang.siswaId}`) ?? null);
    ws4.addRow([pen.nama, pen.kategori, safeAvg(vals)]);
  });

  ws4.getRow(1).font = { bold: true, size: 12, color: { argb: "FF1E3A8A" } };
  ws4.getRow(2).font = { italic: true, size: 9.5, color: { argb: "FF475569" } };
  ws4.getRow(4).font = { bold: true, size: 10 };
  ws4.getRow(15).font = { bold: true, size: 10 };
  ws4.columns = [
    { width: 30 },
    { width: 16 },
    { width: 16 },
    { width: 28 },
    { width: 16 },
    { width: 16 },
  ];

  appendEraporSignatureBlock(wb, ws4, {
    leftStartCol: 1,
    leftEndCol: 2,
    rightStartCol: 4,
    rightEndCol: 6,
    desaKelurahan: sekolah?.desaKelurahan || "Denpasar",
    namaKepsek: sekolah?.namaKepsek || "-",
    nipKepsek: sekolah?.nipKepsek || "-",
    capTtdKepsekUrl: sekolah?.capTtdKepsekUrl,
    guruNama,
    guruNip,
    guruTtdUrl: p.gtk?.ttdUrl,
  });

  const safeMapel = p.mapel.nama.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeRombel = p.rombel.nama.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `E-Rapor_${safeMapel}_Kelas_${safeRombel}.xlsx`;
  return { buffer: await wb.xlsx.writeBuffer(), fileName };
}
