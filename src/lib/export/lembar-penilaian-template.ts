import "server-only";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import {
  hitungNilaiAkhirLengkap,
  resolveTpDeskripsiText,
  getFaseByTingkat,
} from "@/lib/grading/calc";

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFCBD5E1" } },
  left: { style: "thin", color: { argb: "FFCBD5E1" } },
  bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
  right: { style: "thin", color: { argb: "FFCBD5E1" } },
};

function normalizeColCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s._-]+/g, "");
}

export interface TemplateColumnSpec {
  id: string | null;
  kategori: "HARIAN" | "SLM" | "UTS" | "UAS";
  kategoriLabel: string;
  nama: string;
  deskripsiTp: string;
  lingkupMateri: string;
}

/**
 * Membangun berkas Excel (.xlsx) Template Lembar Penilaian Siswa
 * lengkap dengan daftar TP (dari menu Tujuan Pembelajaran & kolom penilaian aktif)
 * serta susunan kolom Lembar Penilaian Siswa (TP, SLM, STS, SAS, Rata TP, Rata SLM, Nilai Akhir, Status).
 */
export async function buildLembarPenilaianTemplateWorkbook(pembelajaranId: string) {
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
    throw new Error("Data pembelajaran tidak ditemukan.");
  }

  const masterTps = await db.tujuanPembelajaran.findMany({
    where: {
      semesterId: p.semesterId,
      tingkat: p.rombel.tingkat,
      mapelId: p.mapelId,
    },
    orderBy: [{ urutan: "asc" }, { kodeTp: "asc" }],
  });

  const kktp = p.kktp ?? 75;
  const bobotHarian = p.bobotHarian ?? 50;
  const bobotUts = p.bobotUts ?? 25;
  const bobotUas = p.bobotUas ?? 25;

  const namaSekolah = sekolah?.nama || "SD Negeri 7 Pedungan";
  const tahunAjaran = p.semester?.tahunAjaran?.nama || "2026/2027";
  const semesterTipe = p.semester?.tipe || "GANJIL";
  const faseStr = getFaseByTingkat(p.rombel.tingkat);
  const guruNama = p.gtk?.nama || "Guru Pengampu";

  // Kelompokkan kolom penilaian yang sudah ada di Lembar Penilaian Siswa
  const existingHarian = p.penilaian
    .filter((c) => c.kategori === "HARIAN")
    .sort((a, b) => a.urutan - b.urutan);
  const existingSlm = p.penilaian
    .filter((c) => c.kategori === "SLM")
    .sort((a, b) => a.urutan - b.urutan);
  const existingUts = p.penilaian
    .filter((c) => c.kategori === "UTS")
    .sort((a, b) => a.urutan - b.urutan);
  const existingUas = p.penilaian
    .filter((c) => c.kategori === "UAS")
    .sort((a, b) => a.urutan - b.urutan);

  // 1. Susun Kolom TP (Formatif / TP)
  // Gabungkan kolom HARIAN yang ada di Lembar Penilaian dengan daftar Kode TP dari menu Tujuan Pembelajaran
  const tpCols: TemplateColumnSpec[] = [];
  const usedTpNorm = new Set<string>();

  for (const col of existingHarian) {
    const norm = normalizeColCode(col.nama);
    usedTpNorm.add(norm);
    const matchedMaster = masterTps.find(
      (m) => normalizeColCode(m.kodeTp) === norm
    );
    tpCols.push({
      id: col.id,
      kategori: "HARIAN",
      kategoriLabel: "TP / Formatif",
      nama: col.nama,
      deskripsiTp:
        matchedMaster?.tujuanPembelajaran ||
        resolveTpDeskripsiText(col, masterTps) ||
        "",
      lingkupMateri: matchedMaster?.ruangLingkupMateri || "",
    });
  }

  for (const m of masterTps) {
    const norm = normalizeColCode(m.kodeTp);
    if (!usedTpNorm.has(norm)) {
      usedTpNorm.add(norm);
      tpCols.push({
        id: null,
        kategori: "HARIAN",
        kategoriLabel: "TP / Formatif",
        nama: m.kodeTp,
        deskripsiTp: m.tujuanPembelajaran || "",
        lingkupMateri: m.ruangLingkupMateri || "",
      });
    }
  }

  if (tpCols.length === 0) {
    tpCols.push(
      {
        id: null,
        kategori: "HARIAN",
        kategoriLabel: "TP / Formatif",
        nama: "TP 1",
        deskripsiTp: "",
        lingkupMateri: "",
      },
      {
        id: null,
        kategori: "HARIAN",
        kategoriLabel: "TP / Formatif",
        nama: "TP 2",
        deskripsiTp: "",
        lingkupMateri: "",
      }
    );
  }

  // 2. Susun Kolom SLM (Sumatif Lingkup Materi)
  const slmCols: TemplateColumnSpec[] =
    existingSlm.length > 0
      ? existingSlm.map((c) => ({
          id: c.id,
          kategori: "SLM",
          kategoriLabel: "SLM",
          nama: c.nama,
          deskripsiTp: c.tujuanPembelajaran || "",
          lingkupMateri: "",
        }))
      : [
          {
            id: null,
            kategori: "SLM",
            kategoriLabel: "SLM",
            nama: "SLM 1",
            deskripsiTp: "",
            lingkupMateri: "",
          },
        ];

  // 3. Susun Kolom STS (Sumatif Tengah Semester)
  const stsCols: TemplateColumnSpec[] =
    existingUts.length > 0
      ? existingUts.map((c) => ({
          id: c.id,
          kategori: "UTS",
          kategoriLabel: "STS",
          nama: c.nama,
          deskripsiTp: "",
          lingkupMateri: "",
        }))
      : [
          {
            id: null,
            kategori: "UTS",
            kategoriLabel: "STS",
            nama: "STS",
            deskripsiTp: "",
            lingkupMateri: "",
          },
        ];

  // 4. Susun Kolom SAS (Sumatif Akhir Semester)
  const sasCols: TemplateColumnSpec[] =
    existingUas.length > 0
      ? existingUas.map((c) => ({
          id: c.id,
          kategori: "UAS",
          kategoriLabel: "SAS",
          nama: c.nama,
          deskripsiTp: "",
          lingkupMateri: "",
        }))
      : [
          {
            id: null,
            kategori: "UAS",
            kategoriLabel: "SAS",
            nama: "SAS",
            deskripsiTp: "",
            lingkupMateri: "",
          },
        ];

  const allAssessmentCols: TemplateColumnSpec[] = [
    ...tpCols,
    ...slmCols,
    ...stsCols,
    ...sasCols,
  ];

  // Peta nilai yang sudah tersimpan di database: `${penilaianId}_${siswaId}` -> number
  const scoreMap = new Map<string, number>();
  p.penilaian.forEach((pen) => {
    pen.nilai.forEach((nv) => {
      if (nv.nilai !== null) {
        scoreMap.set(`${pen.id}_${nv.siswaId}`, Number(nv.nilai));
      }
    });
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "e-STUPA";
  wb.lastModifiedBy = "e-STUPA";
  wb.created = new Date();
  wb.modified = new Date();

  // ===========================================================================
  // SHEET 1: Lembar_Penilaian_Siswa
  // ===========================================================================
  const ws = wb.addWorksheet("Lembar_Penilaian_Siswa", {
    views: [{ state: "frozen", xSplit: 3, ySplit: 9, showGridLines: true }],
  });

  ws.addRow([
    `LEMBAR PENILAIAN SISWA — ${p.mapel.nama.toUpperCase()} (KELAS ${p.rombel.nama.toUpperCase()})`,
  ]);
  ws.addRow([
    "Petunjuk: Isi nilai angka (0 - 100) pada kolom TP, SLM, STS, dan SAS. Anda juga dapat menambah kolom TP/SLM baru. Setelah selesai, simpan dan unggah melalui tombol 'Impor Lembar Penilaian Siswa' di web.",
  ]);
  ws.addRow([]);

  ws.addRow([
    "Nama Sekolah",
    ":",
    namaSekolah,
    "",
    "Kelas / Fase",
    `Kelas ${p.rombel.nama} (Tingkat ${p.rombel.tingkat}) / ${faseStr}`,
  ]);
  ws.addRow([
    "Mata Pelajaran",
    ":",
    `${p.mapel.nama} (${p.mapel.kode})`,
    "",
    "Tahun Ajaran / Semester",
    `${tahunAjaran} - ${semesterTipe}`,
  ]);
  ws.addRow([
    "Guru Pengampu",
    ":",
    guruNama,
    "",
    "KKTP & Bobot",
    `KKTP: ${kktp} | Formatif/TP: ${bobotHarian}% • SLM/STS: ${bobotUts}% • SAS: ${bobotUas}%`,
  ]);
  ws.addRow([]);

  // Baris 8 (Kategori) & Baris 9 (Nama Kolom)
  const headerKategoriRow: string[] = ["No", "NISN", "Nama Siswa"];
  const headerNamaRow: string[] = ["No", "NISN", "Nama Siswa"];

  allAssessmentCols.forEach((col) => {
    headerKategoriRow.push(col.kategoriLabel);
    headerNamaRow.push(col.nama);
  });

  headerKategoriRow.push("Rata TP", "Rata SLM", "Nilai Akhir", "Status");
  headerNamaRow.push("Rata TP", "Rata SLM", "Nilai Akhir", "Status");

  const rKat = ws.addRow(headerKategoriRow); // Row 8
  const rNam = ws.addRow(headerNamaRow); // Row 9

  const totalCols = headerNamaRow.length;
  const firstTpColIdx = 4;
  const lastTpColIdx = firstTpColIdx + tpCols.length - 1;
  const firstSlmColIdx = lastTpColIdx + 1;
  const lastSlmColIdx = firstSlmColIdx + slmCols.length - 1;
  const firstStsColIdx = lastSlmColIdx + 1;
  const lastStsColIdx = firstStsColIdx + stsCols.length - 1;
  const firstSasColIdx = lastStsColIdx + 1;
  const lastSasColIdx = firstSasColIdx + sasCols.length - 1;

  const rataTpColIdx = lastSasColIdx + 1;
  const rataSlmColIdx = rataTpColIdx + 1;
  const nilaiAkhirColIdx = rataSlmColIdx + 1;
  const statusColIdx = nilaiAkhirColIdx + 1;

  // Merge kolom tetap (No, NISN, Nama Siswa) dan kolom kalkulasi (Rata TP, Rata SLM, Nilai Akhir, Status)
  ws.mergeCells(8, 1, 9, 1);
  ws.mergeCells(8, 2, 9, 2);
  ws.mergeCells(8, 3, 9, 3);
  ws.mergeCells(8, rataTpColIdx, 9, rataTpColIdx);
  ws.mergeCells(8, rataSlmColIdx, 9, rataSlmColIdx);
  ws.mergeCells(8, nilaiAkhirColIdx, 9, nilaiAkhirColIdx);
  ws.mergeCells(8, statusColIdx, 9, statusColIdx);

  // Styling Header Baris 8 & 9
  rKat.height = 19;
  rNam.height = 24;

  for (let c = 1; c <= totalCols; c++) {
    const cellKat = rKat.getCell(c);
    const cellNam = rNam.getCell(c);

    let bgArgb = "FFF1F5F9";
    let fontArgb = "FF334155";

    if (c >= firstTpColIdx && c <= lastTpColIdx) {
      bgArgb = "FFEFF6FF"; // Biru muda (TP / Formatif)
      fontArgb = "FF1D4ED8";
    } else if (c >= firstSlmColIdx && c <= lastSlmColIdx) {
      bgArgb = "FFEEF2FF"; // Indigo muda (SLM)
      fontArgb = "FF4338CA";
    } else if (c >= firstStsColIdx && c <= lastStsColIdx) {
      bgArgb = "FFFFFBEB"; // Amber muda (STS)
      fontArgb = "FFB45309";
    } else if (c >= firstSasColIdx && c <= lastSasColIdx) {
      bgArgb = "FFF0FDFA"; // Teal muda (SAS)
      fontArgb = "FF0F766E";
    } else if (c === rataTpColIdx) {
      bgArgb = "FFDBEAFE";
      fontArgb = "FF1E40AF";
    } else if (c === rataSlmColIdx) {
      bgArgb = "FFE0E7FF";
      fontArgb = "FF3730A3";
    } else if (c === nilaiAkhirColIdx) {
      bgArgb = "FFBFDBFE";
      fontArgb = "FF1E3A8A";
    } else if (c === statusColIdx) {
      bgArgb = "FFCCFBF1";
      fontArgb = "FF115E59";
    }

    [cellKat, cellNam].forEach((cell, idx) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: bgArgb },
      };
      cell.border = THIN_BORDER;
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      cell.font = {
        bold: true,
        size: idx === 0 ? 8.5 : 9.5,
        color: { argb: idx === 0 ? fontArgb : "FF0F172A" },
      };
    });

    // Tambahkan catatan/komentar berisi deskripsi TP pada sel header Nama Kolom
    if (c >= firstTpColIdx && c <= lastSasColIdx) {
      const spec = allAssessmentCols[c - firstTpColIdx];
      if (spec?.deskripsiTp) {
        cellNam.note = `${spec.nama}: ${spec.deskripsiTp}${
          spec.lingkupMateri ? `\nLingkup Materi: ${spec.lingkupMateri}` : ""
        }`;
      }
    }
  }

  // Baris Data Siswa (Mulai Baris 10)
  p.rombel.anggota.forEach((agg, idx) => {
    const s = agg.siswa;
    const rowValues: (string | number | null)[] = [
      agg.noAbsen ?? idx + 1,
      s.nisn,
      s.nama,
    ];

    const tpVals: (number | null)[] = [];
    const slmVals: (number | null)[] = [];
    const utsVals: (number | null)[] = [];
    const uasVals: (number | null)[] = [];

    allAssessmentCols.forEach((col) => {
      const val =
        col.id && scoreMap.has(`${col.id}_${s.id}`)
          ? (scoreMap.get(`${col.id}_${s.id}`) ?? null)
          : null;
      rowValues.push(val);

      if (col.kategori === "HARIAN") tpVals.push(val);
      else if (col.kategori === "SLM") slmVals.push(val);
      else if (col.kategori === "UTS") utsVals.push(val);
      else if (col.kategori === "UAS") uasVals.push(val);
    });

    const calc = hitungNilaiAkhirLengkap(
      {
        harian: tpVals,
        slm: slmVals,
        uts: utsVals,
        uas: uasVals,
      },
      {
        bobotHarian,
        bobotUts,
        bobotUas,
      }
    );

    rowValues.push(
      calc.rataHarian,
      calc.rataSlm,
      calc.nilaiAkhir,
      calc.nilaiAkhir !== null
        ? calc.nilaiAkhir >= kktp
          ? "Tuntas"
          : "Remedial"
        : null
    );

    const row = ws.addRow(rowValues);
    row.height = 20;
    const rNum = row.number;

    const tpStartAddr = ws.getCell(rNum, firstTpColIdx).address;
    const tpEndAddr = ws.getCell(rNum, lastTpColIdx).address;
    const slmStartAddr = ws.getCell(rNum, firstSlmColIdx).address;
    const slmEndAddr = ws.getCell(rNum, lastSlmColIdx).address;
    const stsStartAddr = ws.getCell(rNum, firstStsColIdx).address;
    const stsEndAddr = ws.getCell(rNum, lastStsColIdx).address;
    const sasStartAddr = ws.getCell(rNum, firstSasColIdx).address;
    const sasEndAddr = ws.getCell(rNum, lastSasColIdx).address;

    const rataTpCell = row.getCell(rataTpColIdx);
    const rataSlmCell = row.getCell(rataSlmColIdx);
    const naCell = row.getCell(nilaiAkhirColIdx);
    const statusCell = row.getCell(statusColIdx);

    rataTpCell.value = {
      formula: `IF(COUNT(${tpStartAddr}:${tpEndAddr})>0,ROUND(AVERAGE(${tpStartAddr}:${tpEndAddr}),2),"")`,
      result: calc.rataHarian ?? "",
    };

    rataSlmCell.value = {
      formula: `IF(COUNT(${slmStartAddr}:${slmEndAddr})>0,ROUND(AVERAGE(${slmStartAddr}:${slmEndAddr}),2),"")`,
      result: calc.rataSlm ?? "",
    };

    // Rumus Nilai Akhir (Bilangan Bulat) di Excel yang identik dengan hitungNilaiAkhirLengkap
    const stsSlmRangeFormula = `IF(COUNT(${slmStartAddr}:${stsEndAddr})>0,AVERAGE(${slmStartAddr}:${stsEndAddr}),0)`;
    const sasRangeFormula = `IF(COUNT(${sasStartAddr}:${sasEndAddr})>0,AVERAGE(${sasStartAddr}:${sasEndAddr}),0)`;
    const tpRangeFormula = `IF(COUNT(${tpStartAddr}:${tpEndAddr})>0,AVERAGE(${tpStartAddr}:${tpEndAddr}),0)`;
    const totalWeightFormula = `(IF(COUNT(${tpStartAddr}:${tpEndAddr})>0,${bobotHarian},0)+IF(COUNT(${slmStartAddr}:${stsEndAddr})>0,${bobotUts},0)+IF(COUNT(${sasStartAddr}:${sasEndAddr})>0,${bobotUas},0))`;
    const weightedSumFormula = `((${tpRangeFormula}*IF(COUNT(${tpStartAddr}:${tpEndAddr})>0,${bobotHarian},0))+(${stsSlmRangeFormula}*IF(COUNT(${slmStartAddr}:${stsEndAddr})>0,${bobotUts},0))+(${sasRangeFormula}*IF(COUNT(${sasStartAddr}:${sasEndAddr})>0,${bobotUas},0)))`;

    naCell.value = {
      formula: `IF(${totalWeightFormula}>0,ROUND(${weightedSumFormula}/${totalWeightFormula},0),"")`,
      result: calc.nilaiAkhir ?? "",
    };

    statusCell.value = {
      formula: `IF(${naCell.address}="","",IF(${naCell.address}>=${kktp},"Tuntas","Remedial"))`,
      result:
        calc.nilaiAkhir !== null
          ? calc.nilaiAkhir >= kktp
            ? "Tuntas"
            : "Remedial"
          : "",
    };

    for (let c = 1; c <= totalCols; c++) {
      const cell = row.getCell(c);
      cell.border = THIN_BORDER;
      cell.font = {
        size: 9.5,
        bold: c === 3 || c >= rataTpColIdx,
        color: {
          argb:
            c === nilaiAkhirColIdx
              ? "FF1E3A8A"
              : c === rataTpColIdx
              ? "FF1D4ED8"
              : c === rataSlmColIdx
              ? "FF4338CA"
              : "FF1E293B",
        },
      };
      cell.alignment = {
        horizontal: c === 3 ? "left" : "center",
        vertical: "middle",
      };

      if (c >= rataTpColIdx) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FAFC" },
        };
      }
    }
  });

  // Styling Judul & Identitas Sheet 1
  ws.getRow(1).font = { bold: true, size: 12, color: { argb: "FF1E3A8A" } };
  ws.getRow(2).font = { italic: true, size: 9, color: { argb: "FF475569" } };
  [4, 5, 6].forEach((rIdx) => {
    ws.getRow(rIdx).getCell(1).font = { bold: true, size: 9.5 };
    ws.getRow(rIdx).getCell(3).font = { size: 9.5 };
    ws.getRow(rIdx).getCell(5).font = { bold: true, size: 9.5 };
    ws.getRow(rIdx).getCell(6).font = { size: 9.5 };
  });

  // Lebar Kolom Sheet 1
  const colWidths: { width: number }[] = [
    { width: 6 }, // No
    { width: 15 }, // NISN
    { width: 32 }, // Nama Siswa
  ];
  allAssessmentCols.forEach(() => {
    colWidths.push({ width: 11 });
  });
  colWidths.push(
    { width: 11 }, // Rata TP
    { width: 11 }, // Rata SLM
    { width: 12 }, // Nilai Akhir
    { width: 13 } // Status
  );
  ws.columns = colWidths;

  // ===========================================================================
  // SHEET 2: Daftar_Tujuan_Pembelajaran
  // ===========================================================================
  const wsTp = wb.addWorksheet("Daftar_Tujuan_Pembelajaran", {
    views: [{ showGridLines: true }],
  });

  wsTp.addRow([
    `DAFTAR TUJUAN PEMBELAJARAN (TP) & RUANG LINGKUP MATERI — ${p.mapel.nama.toUpperCase()} (KELAS ${p.rombel.nama.toUpperCase()})`,
  ]);
  wsTp.addRow([
    "Daftar Kode TP, Tujuan Pembelajaran, dan Ruang Lingkup Materi ini terhubung langsung dengan kolom TP pada Lembar Penilaian Siswa.",
  ]);
  wsTp.addRow([]);

  const tpHeader = wsTp.addRow([
    "No",
    "Kode TP",
    "Tujuan Pembelajaran",
    "Ruang Lingkup Materi",
  ]);
  tpHeader.height = 22;
  for (let c = 1; c <= 4; c++) {
    const cell = tpHeader.getCell(c);
    cell.font = { bold: true, size: 9.5, color: { argb: "FF1E3A8A" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFDBEAFE" },
    };
    cell.border = THIN_BORDER;
    cell.alignment = { horizontal: "center", vertical: "middle" };
  }

  const tpSourceRows =
    masterTps.length > 0
      ? masterTps.map((m) => ({
          kodeTp: m.kodeTp,
          tujuanPembelajaran: m.tujuanPembelajaran,
          ruangLingkupMateri: m.ruangLingkupMateri || "",
        }))
      : tpCols.map((t) => ({
          kodeTp: t.nama,
          tujuanPembelajaran: t.deskripsiTp || "",
          ruangLingkupMateri: t.lingkupMateri || "",
        }));

  tpSourceRows.forEach((item, idx) => {
    const r = wsTp.addRow([
      idx + 1,
      item.kodeTp,
      item.tujuanPembelajaran,
      item.ruangLingkupMateri,
    ]);
    r.height = 24;
    for (let c = 1; c <= 4; c++) {
      const cell = r.getCell(c);
      cell.border = THIN_BORDER;
      cell.font = {
        size: 9.5,
        bold: c <= 2,
      };
      cell.alignment = {
        horizontal: c <= 2 ? "center" : "left",
        vertical: "middle",
        wrapText: true,
      };
    }
  });

  wsTp.getRow(1).font = { bold: true, size: 11.5, color: { argb: "FF1E3A8A" } };
  wsTp.getRow(2).font = { italic: true, size: 9, color: { argb: "FF475569" } };
  wsTp.columns = [
    { width: 6 },
    { width: 16 },
    { width: 62 },
    { width: 38 },
  ];

  const arrayBuffer = await wb.xlsx.writeBuffer();
  const safeMapel = (p.mapel.kode || p.mapel.nama).replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeKelas = p.rombel.nama.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `Template_Lembar_Penilaian_${safeMapel}_Kelas_${safeKelas}.xlsx`;

  return {
    buffer: arrayBuffer,
    fileName,
  };
}
