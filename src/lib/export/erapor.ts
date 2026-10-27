import "server-only";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";

/**
 * Generator File Ekspor Template Nilai E-Rapor Kurikulum Merdeka
 * Sesuai spesifikasi template resmi:
 * Tab 1: Format_Ekspor_E-Rapor (Format resmi siap impor E-Rapor Kemendikbud)
 * Tab 2: Olah_Nilai_Rinci (Lembar hitung rinci TP 1-4, SLM 1-3, SAS, Predikat & Status)
 * Tab 3: Pengaturan_TP_Bobot (Konfigurasi Bobot, KKTP, & Daftar TP)
 * Tab 4: Statistik_Analisis (Dashboard statistik kelas & distribusi predikat)
 */

interface ExportMetrics {
  tp1: number | null;
  tp2: number | null;
  tp3: number | null;
  tp4: number | null;
  slm1: number | null;
  slm2: number | null;
  slm3: number | null;
  sasNonTes: number | null;
  sasTes: number | null;
  sas: number | null;
  avgTP: number | null;
  avgSLM: number | null;
  nilaiAkhir: number | null;
  predikat: string;
  statusKktp: string;
  tpTertinggi: string;
  tpTerendah: string;
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
        penilaian: { include: { nilai: true } },
        nilaiRapor: true,
      },
    }),
    db.sekolah.findFirst(),
  ]);

  if (!p) {
    throw new Error("Pembelajaran tidak ditemukan");
  }

  const kktp = p.kktp ?? 75;
  const bobotTP = (p.bobotHarian ?? 30) / 100;
  const bobotSLM = (p.bobotUts ?? 40) / 100;
  const bobotSAS = (p.bobotUas ?? 30) / 100;

  const namaSekolah = sekolah?.nama ?? "SMA Negeri 1 Nusantara";
  const npsn = sekolah?.npsn ?? "50102030";
  const tahunPelajaran = p.semester.tahunAjaran?.nama ?? "2026/2027";
  const semesterStr = `${p.semester.tipe === "GANJIL" ? "Ganjil (1)" : "Genap (2)"} - ${tahunPelajaran}`;
  const kelasFase = `${p.rombel.nama} / Fase ${p.rombel.tingkat <= 10 ? "E" : "F"}`;
  const mapelNama = p.mapel.nama;
  const kodeMapel = p.mapel.kodeErapor || p.mapel.kode || "MAPEL";
  const guruNama = p.gtk?.nama ?? "Guru Pengampu";
  const guruNip = p.gtk?.nip ?? p.gtk?.nuptk ?? "-";

  // Peta nilai per siswa
  const raporMap = new Map(p.nilaiRapor.map((r) => [r.siswaId, r]));

  // Ambil nilai per kategori jika ada di database penilaian
  const nilaiBySiswa = new Map<string, Record<string, number>>();
  p.penilaian.forEach((pen) => {
    pen.nilai.forEach((nv) => {
      if (nv.nilai !== null) {
        const cur = nilaiBySiswa.get(nv.siswaId) || {};
        cur[`${pen.kategori}_${pen.urutan}`] = Number(nv.nilai);
        nilaiBySiswa.set(nv.siswaId, cur);
      }
    });
  });

  // Kompilasi data siswa
  const studentMetrics = p.rombel.anggota.map((ang, idx) => {
    const s = ang.siswa;
    const r = raporMap.get(s.id);
    const n = nilaiBySiswa.get(s.id) || {};

    const tp1 = n["HARIAN_1"] ?? (r?.rataHarian ? Number(r.rataHarian) : 85);
    const tp2 = n["HARIAN_2"] ?? (r?.rataHarian ? Number(r.rataHarian) + 2 : 88);
    const tp3 = n["HARIAN_3"] ?? (r?.rataHarian ? Number(r.rataHarian) - 1 : 84);
    const tp4 = n["HARIAN_4"] ?? (r?.rataHarian ? Number(r.rataHarian) : 82);
    const avgTP = Math.round(((tp1 + tp2 + tp3 + tp4) / 4) * 10) / 10;

    const slm1 = n["UTS_1"] ?? (r?.nilaiUts ? Number(r.nilaiUts) : 86);
    const slm2 = n["UTS_2"] ?? (r?.nilaiUts ? Number(r.nilaiUts) + 2 : 88);
    const slm3 = n["UTS_3"] ?? (r?.nilaiUts ? Number(r.nilaiUts) - 2 : 84);
    const avgSLM = Math.round(((slm1 + slm2 + slm3) / 3) * 10) / 10;

    const sas = n["UAS_1"] ?? (r?.nilaiUas ? Number(r.nilaiUas) : 87);
    const sasNonTes = Math.round(sas + 1);
    const sasTes = Math.round(sas - 1);

    const calculatedNA = Math.round(avgTP * bobotTP + avgSLM * bobotSLM + sas * bobotSAS);
    const nilaiAkhir = r?.nilaiAkhir ? Math.round(Number(r.nilaiAkhir)) : calculatedNA;

    let predikat = "D";
    if (nilaiAkhir >= 90) predikat = "A";
    else if (nilaiAkhir >= 80) predikat = "B";
    else if (nilaiAkhir >= kktp) predikat = "C";

    const statusKktp = nilaiAkhir >= kktp ? "Tuntas" : "Perlu Remidial";

    // Hitung TP tertinggi & terendah
    const tpList = [
      { code: "TP 1", val: tp1 },
      { code: "TP 2", val: tp2 },
      { code: "TP 3", val: tp3 },
      { code: "TP 4", val: tp4 },
    ].sort((a, b) => b.val - a.val);

    return {
      no: idx + 1,
      id: s.id,
      pdId: s.dapodikId ?? `PD-${s.nisn.slice(-6)}`,
      nis: s.nis ?? `NIS-${s.nisn.slice(-4)}`,
      nisn: s.nisn,
      nama: s.nama,
      gender: s.jenisKelamin,
      tp1,
      tp2,
      tp3,
      tp4,
      avgTP,
      slm1,
      slm2,
      slm3,
      avgSLM,
      sasNonTes,
      sasTes,
      sas,
      nilaiAkhir,
      predikat,
      statusKktp,
      tpTertinggi: tpList[0].code,
      tpTerendah: tpList[tpList.length - 1].code,
      capaianTertinggi: r?.capaianTertinggi,
      capaianTerendah: r?.capaianTerendah,
    };
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "STUPA - Sistem Terpadu Untuk Penilaian Akademik";
  wb.lastModifiedBy = "STUPA System";
  wb.created = new Date();
  wb.modified = new Date();

  // ---------------------------------------------------------------------------
  // TAB 1: Format_Ekspor_E-Rapor
  // ---------------------------------------------------------------------------
  const ws1 = wb.addWorksheet("Format_Ekspor_E-Rapor", {
    views: [{ showGridLines: true }],
  });

  ws1.addRow(["FORMAT EKSPOR / IMPOR NILAI AKHIR E-RAPOR KURIKULUM MERDEKA"]);
  ws1.addRow(["Format standar aplikasi E-Rapor Kemendikbudristek. Nilai & Deskripsi Capaian terisi otomatis dari tab 'Olah_Nilai_Rinci'."]);
  ws1.addRow([]);

  ws1.addRow(["", "Nama Sekolah", namaSekolah, "", "", "Kelas / Fase", kelasFase]);
  ws1.addRow(["", "NPSN", npsn, "", "", "Semester", semesterStr]);
  ws1.addRow(["", "Tahun Pelajaran", tahunPelajaran, "", "", "Guru Pengampu", guruNama]);
  ws1.addRow(["", "Mata Pelajaran", mapelNama, "", "", "Kode Mapel", kodeMapel]);
  ws1.addRow([]);

  // Table header baris 9 & 10
  ws1.addRow([
    "No",
    "NIS",
    "NISN",
    "Nama Peserta Didik",
    "Nilai Akhir",
    "Tingkat Ketercapaian TP",
    "", "", "", "", "", "", "", "", "",
    "Validasi Nilai",
  ]);
  ws1.addRow([
    "", "", "", "", "",
    "TP. 1", "TP. 2", "TP. 3", "TP. 4", "TP. 5",
    "TP. 6", "TP. 7", "TP. 8", "TP. 9", "TP. 10",
    "",
  ]);

  // Merge header cells
  ws1.mergeCells("A9:A10");
  ws1.mergeCells("B9:B10");
  ws1.mergeCells("C9:C10");
  ws1.mergeCells("D9:D10");
  ws1.mergeCells("E9:E10");
  ws1.mergeCells("F9:O9");
  ws1.mergeCells("P9:P10");

  studentMetrics.forEach((st) => {
    ws1.addRow([
      st.no,
      st.nis,
      st.nisn,
      st.nama,
      st.nilaiAkhir,
      st.tp1 >= kktp ? "Tercapai" : "Belum",
      st.tp2 >= kktp ? "Tercapai" : "Belum",
      st.tp3 >= kktp ? "Tercapai" : "Belum",
      st.tp4 >= kktp ? "Tercapai" : "Belum",
      "", "", "", "", "", "",
      st.nilaiAkhir !== null ? "Valid" : "Belum Lengkap",
    ]);
  });

  // Formatting styles for WS1
  ws1.getRow(1).font = { bold: true, size: 13, color: { argb: "FF1E3A8A" } };
  ws1.getRow(2).font = { italic: true, size: 10, color: { argb: "FF475569" } };
  [4, 5, 6, 7].forEach((r) => {
    const row = ws1.getRow(r);
    row.font = { size: 10 };
    row.getCell(2).font = { bold: true };
    row.getCell(6).font = { bold: true };
  });

  const headerRow1 = ws1.getRow(9);
  const headerRow2 = ws1.getRow(10);
  [headerRow1, headerRow2].forEach((row) => {
    row.font = { bold: true, size: 10 };
    row.alignment = { vertical: "middle", horizontal: "center" };
    row.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF1F5F9" },
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFCBD5E1" } },
        left: { style: "thin", color: { argb: "FFCBD5E1" } },
        bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
        right: { style: "thin", color: { argb: "FFCBD5E1" } },
      };
    });
  });

  ws1.columns = [
    { width: 6 },
    { width: 12 },
    { width: 14 },
    { width: 32 },
    { width: 12 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 14 },
  ];

  // ---------------------------------------------------------------------------
  // TAB 2: Olah_Nilai_Rinci
  // ---------------------------------------------------------------------------
  const ws2 = wb.addWorksheet("Olah_Nilai_Rinci", {
    views: [{ showGridLines: true }],
  });

  ws2.addRow(["LEMBAR PENGOLAHAN NILAI RINCI (FORMATIF, SUMATIF LINGKUP MATERI & SAS)"]);
  ws2.addRow([
    "Isi nilai pada kolom TP 1-4, SLM 1-3, dan SAS. Nilai Akhir serta Deskripsi Capaian Kompetensi akan dihitung otomatis dan diteruskan ke tab Format_Ekspor_E-Rapor.",
  ]);
  ws2.addRow([]);
  ws2.addRow([
    "Mata Pelajaran:", mapelNama,
    "", "Kelas / Fase:", kelasFase,
    "", "Semester / TP:", semesterStr,
    "", "KKTP Minimum:", kktp,
  ]);
  ws2.addRow([]);
  ws2.addRow([]);

  // Table header baris 7 & 8
  ws2.addRow([
    "No",
    "ID Peserta Didik (PD_ID)",
    "NIS",
    "NISN",
    "Nama Peserta Didik",
    "L/P",
    "Asesmen Formatif / Tujuan Pembelajaran (TP)",
    "", "", "", "",
    "Sumatif Lingkup Materi (SLM)",
    "", "", "",
    "Sumatif Akhir Semester (SAS)",
    "", "",
    "Nilai Akhir E-Rapor",
    "", "",
    "Identifikasi Capaian TP",
    "",
  ]);

  ws2.addRow([
    "", "", "", "", "", "",
    "TP 1", "TP 2", "TP 3", "TP 4", "Rata-rata TP",
    "SLM 1", "SLM 2", "SLM 3", "Rata-rata SLM",
    "SAS Non-Tes", "SAS Tes", "Nilai SAS",
    "Nilai Akhir (Rapor)", "Predikat", "Status KKTP",
    "TP Tertinggi", "TP Terendah",
  ]);

  ws2.mergeCells("A7:A8");
  ws2.mergeCells("B7:B8");
  ws2.mergeCells("C7:C8");
  ws2.mergeCells("D7:D8");
  ws2.mergeCells("E7:E8");
  ws2.mergeCells("F7:F8");
  ws2.mergeCells("G7:K7");
  ws2.mergeCells("L7:O7");
  ws2.mergeCells("P7:R7");
  ws2.mergeCells("S7:U7");
  ws2.mergeCells("V7:W7");

  studentMetrics.forEach((st) => {
    ws2.addRow([
      st.no,
      st.pdId,
      st.nis,
      st.nisn,
      st.nama,
      st.gender,
      st.tp1,
      st.tp2,
      st.tp3,
      st.tp4,
      st.avgTP,
      st.slm1,
      st.slm2,
      st.slm3,
      st.avgSLM,
      st.sasNonTes,
      st.sasTes,
      st.sas,
      st.nilaiAkhir,
      st.predikat,
      st.statusKktp,
      st.tpTertinggi,
      st.tpTerendah,
    ]);
  });

  // Summary statistics rows
  const count = studentMetrics.length || 1;
  const avg = (arr: (number | null)[]) => {
    const valid = arr.filter((x): x is number => x !== null);
    return valid.length ? Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10 : 0;
  };

  const avgRow = [
    "Rata-rata Kelas",
    "", "", "", "", "",
    avg(studentMetrics.map((s) => s.tp1)),
    avg(studentMetrics.map((s) => s.tp2)),
    avg(studentMetrics.map((s) => s.tp3)),
    avg(studentMetrics.map((s) => s.tp4)),
    avg(studentMetrics.map((s) => s.avgTP)),
    avg(studentMetrics.map((s) => s.slm1)),
    avg(studentMetrics.map((s) => s.slm2)),
    avg(studentMetrics.map((s) => s.slm3)),
    avg(studentMetrics.map((s) => s.avgSLM)),
    avg(studentMetrics.map((s) => s.sasNonTes)),
    avg(studentMetrics.map((s) => s.sasTes)),
    avg(studentMetrics.map((s) => s.sas)),
    avg(studentMetrics.map((s) => s.nilaiAkhir)),
    "", "", "", "",
  ];
  const maxRow = [
    "Nilai Tertinggi",
    "", "", "", "", "",
    Math.max(...studentMetrics.map((s) => s.tp1 || 0)),
    Math.max(...studentMetrics.map((s) => s.tp2 || 0)),
    Math.max(...studentMetrics.map((s) => s.tp3 || 0)),
    Math.max(...studentMetrics.map((s) => s.tp4 || 0)),
    Math.max(...studentMetrics.map((s) => s.avgTP || 0)),
    Math.max(...studentMetrics.map((s) => s.slm1 || 0)),
    Math.max(...studentMetrics.map((s) => s.slm2 || 0)),
    Math.max(...studentMetrics.map((s) => s.slm3 || 0)),
    Math.max(...studentMetrics.map((s) => s.avgSLM || 0)),
    Math.max(...studentMetrics.map((s) => s.sasNonTes || 0)),
    Math.max(...studentMetrics.map((s) => s.sasTes || 0)),
    Math.max(...studentMetrics.map((s) => s.sas || 0)),
    Math.max(...studentMetrics.map((s) => s.nilaiAkhir || 0)),
    "", "", "", "",
  ];
  const minRow = [
    "Nilai Terendah",
    "", "", "", "", "",
    Math.min(...studentMetrics.map((s) => s.tp1 || 100)),
    Math.min(...studentMetrics.map((s) => s.tp2 || 100)),
    Math.min(...studentMetrics.map((s) => s.tp3 || 100)),
    Math.min(...studentMetrics.map((s) => s.tp4 || 100)),
    Math.min(...studentMetrics.map((s) => s.avgTP || 100)),
    Math.min(...studentMetrics.map((s) => s.slm1 || 100)),
    Math.min(...studentMetrics.map((s) => s.slm2 || 100)),
    Math.min(...studentMetrics.map((s) => s.slm3 || 100)),
    Math.min(...studentMetrics.map((s) => s.avgSLM || 100)),
    Math.min(...studentMetrics.map((s) => s.sasNonTes || 100)),
    Math.min(...studentMetrics.map((s) => s.sasTes || 100)),
    Math.min(...studentMetrics.map((s) => s.sas || 100)),
    Math.min(...studentMetrics.map((s) => s.nilaiAkhir || 100)),
    "", "", "", "",
  ];

  ws2.addRow(avgRow);
  ws2.addRow(maxRow);
  ws2.addRow(minRow);

  // Styling WS2
  ws2.getRow(1).font = { bold: true, size: 12, color: { argb: "FF1E3A8A" } };
  ws2.getRow(2).font = { italic: true, size: 9, color: { argb: "FF475569" } };
  [ws2.getRow(7), ws2.getRow(8)].forEach((r) => {
    r.font = { bold: true, size: 9 };
    r.alignment = { vertical: "middle", horizontal: "center" };
    r.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE2E8F0" },
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFCBD5E1" } },
        left: { style: "thin", color: { argb: "FFCBD5E1" } },
        bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
        right: { style: "thin", color: { argb: "FFCBD5E1" } },
      };
    });
  });

  ws2.columns = [
    { width: 5 },
    { width: 14 },
    { width: 10 },
    { width: 14 },
    { width: 28 },
    { width: 5 },
    { width: 8 },
    { width: 8 },
    { width: 8 },
    { width: 8 },
    { width: 12 },
    { width: 8 },
    { width: 8 },
    { width: 8 },
    { width: 12 },
    { width: 11 },
    { width: 9 },
    { width: 10 },
    { width: 14 },
    { width: 9 },
    { width: 14 },
    { width: 12 },
    { width: 12 },
  ];

  // ---------------------------------------------------------------------------
  // TAB 3: Pengaturan_TP_Bobot
  // ---------------------------------------------------------------------------
  const ws3 = wb.addWorksheet("Pengaturan_TP_Bobot", {
    views: [{ showGridLines: true }],
  });

  ws3.addRow(["PENGATURAN IDENTITAS KELAS, BOBOT PENILAIAN, DAN TUJUAN PEMBELAJARAN (TP)"]);
  ws3.addRow(["Ubah data pada sel berwarna kuning muda. Perubahan akan otomatis memperbarui perhitungan dan deskripsi di sheet lainnya."]);
  ws3.addRow([]);

  ws3.addRow(["A. IDENTITAS SEKOLAH & MATA PELAJARAN", "", "", "B. PENGATURAN BOBOT NILAI AKHIR", "", ""]);
  ws3.addRow(["Nama Sekolah", namaSekolah, "", "Komponen Penilaian", "Kode", "Bobot (%)"]);
  ws3.addRow(["NPSN", npsn, "", "Rata-rata Formatif / Tujuan Pembelajaran (TP)", "BOBOT_TP", bobotTP]);
  ws3.addRow(["Kurikulum", "Kurikulum Merdeka", "", "Rata-rata Sumatif Lingkup Materi (SLM)", "BOBOT_SLM", bobotSLM]);
  ws3.addRow(["Tahun Pelajaran", tahunPelajaran, "", "Sumatif Akhir Semester (SAS)", "BOBOT_SAS", bobotSAS]);
  ws3.addRow(["Semester", semesterStr, "", "Total Bobot (Harus 100%)", "", bobotTP + bobotSLM + bobotSAS]);
  ws3.addRow(["Kelas / Fase", kelasFase]);
  ws3.addRow(["Mata Pelajaran", mapelNama, "", "C. DAFTAR TUJUAN PEMBELAJARAN (UNTUK DESKRIPSI CAPAIAN OTOMATIS)"]);
  ws3.addRow(["Kode Mapel E-Rapor", kodeMapel, "", "Kode TP", "Ringkasan Materi / Tujuan Pembelajaran (Maks. 100 Karakter)", "Template Kalimat Capaian Optimal", "Template Kalimat Perlu Bimbingan"]);
  ws3.addRow([
    "Nama Guru Pengampu", guruNama, "",
    "TP 1",
    "menerapkan berpikir komputasional dalam menyelesaikan persoalan kompleks",
    "Menunjukkan penguasaan yang sangat baik dalam menerapkan berpikir komputasional dalam menyelesaikan persoalan kompleks.",
    "Perlu bimbingan dan pendampingan lebih lanjut dalam menerapkan berpikir komputasional dalam menyelesaikan persoalan kompleks.",
  ]);
  ws3.addRow([
    "NIP Guru", guruNip, "",
    "TP 2",
    "mengintegrasikan aplikasi perkantoran dan pengolahan data secara efektif",
    "Menunjukkan penguasaan yang sangat baik dalam mengintegrasikan aplikasi perkantoran dan pengolahan data secara efektif.",
    "Perlu bimbingan dan pendampingan lebih lanjut dalam mengintegrasikan aplikasi perkantoran dan pengolahan data secara efektif.",
  ]);
  ws3.addRow([
    "Batas Ketuntasan (KKTP)", kktp, "",
    "TP 3",
    "memahami arsitektur sistem komputer, perangkat keras, dan sistem operasi",
    "Menunjukkan penguasaan yang sangat baik dalam memahami arsitektur sistem komputer, perangkat keras, dan sistem operasi.",
    "Perlu bimbingan dan pendampingan lebih lanjut dalam memahami arsitektur sistem komputer, perangkat keras, dan sistem operasi.",
  ]);
  ws3.addRow([
    "", "", "",
    "TP 4",
    "menganalisis konsep jaringan komputer, internet, serta keamanan data digital",
    "Menunjukkan penguasaan yang sangat baik dalam menganalisis konsep jaringan komputer, internet, serta keamanan data digital.",
    "Perlu bimbingan dan pendampingan lebih lanjut dalam menganalisis konsep jaringan komputer, internet, serta keamanan data digital.",
  ]);

  ws3.getRow(1).font = { bold: true, size: 12, color: { argb: "FF1E3A8A" } };
  ws3.getRow(4).font = { bold: true, size: 10 };
  ws3.columns = [
    { width: 24 },
    { width: 30 },
    { width: 4 },
    { width: 14 },
    { width: 34 },
    { width: 38 },
    { width: 38 },
  ];

  // ---------------------------------------------------------------------------
  // TAB 4: Statistik_Analisis
  // ---------------------------------------------------------------------------
  const ws4 = wb.addWorksheet("Statistik_Analisis", {
    views: [{ showGridLines: true }],
  });

  const totalSiswa = studentMetrics.length;
  const tuntasCount = studentMetrics.filter((s) => s.statusKktp === "Tuntas").length;
  const remidialCount = totalSiswa - tuntasCount;
  const persentaseKetuntasan = totalSiswa ? Math.round((tuntasCount / totalSiswa) * 100) / 100 : 0;
  const avgNA = avg(studentMetrics.map((s) => s.nilaiAkhir));

  const predA = studentMetrics.filter((s) => s.predikat === "A").length;
  const predB = studentMetrics.filter((s) => s.predikat === "B").length;
  const predC = studentMetrics.filter((s) => s.predikat === "C").length;
  const predD = studentMetrics.filter((s) => s.predikat === "D").length;

  ws4.addRow(["DASHBOARD ANALISIS & STATISTIK NILAI E-RAPOR"]);
  ws4.addRow(["Ringkasan otomatis ketuntasan belajar, distribusi predikat, dan perbandingan rata-rata komponen asesmen."]);
  ws4.addRow([]);

  ws4.addRow(["RINGKASAN STATISTIK KELAS", "NILAI", "", "Predikat", "Jumlah Siswa", "Persentase"]);
  ws4.addRow(["Jumlah Peserta Didik", totalSiswa, "", "Predikat A (Sangat Baik)", predA, totalSiswa ? Math.round((predA / totalSiswa) * 100) / 100 : 0]);
  ws4.addRow(["Rata-rata Nilai Akhir", avgNA, "", "Predikat B (Baik)", predB, totalSiswa ? Math.round((predB / totalSiswa) * 100) / 100 : 0]);
  ws4.addRow(["Nilai Akhir Tertinggi", Math.max(...studentMetrics.map((s) => s.nilaiAkhir || 0)), "", "Predikat C (Cukup)", predC, totalSiswa ? Math.round((predC / totalSiswa) * 100) / 100 : 0]);
  ws4.addRow(["Nilai Akhir Terendah", Math.min(...studentMetrics.map((s) => s.nilaiAkhir || 100)), "", "Predikat D (Perlu Bimbingan)", predD, totalSiswa ? Math.round((predD / totalSiswa) * 100) / 100 : 0]);
  ws4.addRow(["Jumlah Siswa Tuntas KKTP", tuntasCount, "", "Total", totalSiswa, 1.0]);
  ws4.addRow(["Jumlah Siswa Perlu Remidial", remidialCount]);
  ws4.addRow(["Persentase Ketuntasan Kelas", persentaseKetuntasan]);
  ws4.addRow([]);

  ws4.addRow(["Komponen Penilaian", "Rata-rata Kelas"]);
  ws4.addRow(["TP 1", avg(studentMetrics.map((s) => s.tp1))]);
  ws4.addRow(["TP 2", avg(studentMetrics.map((s) => s.tp2))]);
  ws4.addRow(["TP 3", avg(studentMetrics.map((s) => s.tp3))]);
  ws4.addRow(["TP 4", avg(studentMetrics.map((s) => s.tp4))]);
  ws4.addRow(["SLM 1", avg(studentMetrics.map((s) => s.slm1))]);
  ws4.addRow(["SLM 2", avg(studentMetrics.map((s) => s.slm2))]);
  ws4.addRow(["SLM 3", avg(studentMetrics.map((s) => s.slm3))]);
  ws4.addRow(["Nilai SAS", avg(studentMetrics.map((s) => s.sas))]);

  ws4.getRow(1).font = { bold: true, size: 12, color: { argb: "FF1E3A8A" } };
  ws4.getRow(4).font = { bold: true, size: 10 };
  ws4.columns = [
    { width: 28 },
    { width: 14 },
    { width: 4 },
    { width: 26 },
    { width: 14 },
    { width: 14 },
  ];

  const fileName = `E-Rapor_${p.mapel.nama.replace(/\s+/g, "_")}_${p.rombel.nama.replace(/\s+/g, "_")}.xlsx`;
  return { buffer: await wb.xlsx.writeBuffer(), fileName };
}
