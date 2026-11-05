import "server-only";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";

export async function buildRekapPresensiWorkbook(rombelId: string) {
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

  // Ambil seluruh data presensi pada rombel dan semester ini
  const presensiRecords = await db.presensi.findMany({
    where: {
      rombelId: rombel.id,
      semesterId: semester?.id,
    },
  });

  // Agregasi per siswa
  const siswaStats = new Map<
    string,
    { hadir: number; sakit: number; izin: number; alpa: number }
  >();

  for (const agg of rombel.anggota) {
    siswaStats.set(agg.siswaId, { hadir: 0, sakit: 0, izin: 0, alpa: 0 });
  }

  for (const p of presensiRecords) {
    const stats = siswaStats.get(p.siswaId);
    if (stats) {
      if (p.status === "HADIR") stats.hadir++;
      else if (p.status === "SAKIT") stats.sakit++;
      else if (p.status === "IZIN") stats.izin++;
      else if (p.status === "ALPA") stats.alpa++;
    }
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "e-STUPA";
  wb.created = new Date();

  const ws = wb.addWorksheet("Rekap_Absensi", {
    views: [{ showGridLines: true }],
  });

  // Set lebar kolom
  ws.columns = [
    { key: "no", width: 6 },
    { key: "nisn", width: 16 },
    { key: "nama", width: 34 },
    { key: "jk", width: 8 },
    { key: "h", width: 12 },
    { key: "s", width: 12 },
    { key: "i", width: 12 },
    { key: "a", width: 12 },
    { key: "total", width: 14 },
    { key: "persen", width: 16 },
  ];

  // Header Title
  ws.mergeCells("A1:J1");
  const titleRow = ws.getCell("A1");
  titleRow.value = "REKAPITULASI PRESENSI / KEHADIRAN SISWA";
  titleRow.font = { name: "Arial", size: 14, bold: true, color: { argb: "FF0F172A" } };
  titleRow.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 25;

  // Nama Sekolah & Info
  ws.mergeCells("A2:J2");
  const subTitle = ws.getCell("A2");
  subTitle.value = `${sekolah?.nama || "SD Negeri 7 Pedungan"} • NPSN: ${sekolah?.npsn || "50103069"}`;
  subTitle.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF475569" } };
  subTitle.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 20;

  // Baris Info Rombel & Semester
  ws.mergeCells("A4:D4");
  ws.getCell("A4").value = `Kelas: ${rombel.nama} (Tingkat ${rombel.tingkat})`;
  ws.getCell("A4").font = { name: "Arial", size: 10, bold: true };

  ws.mergeCells("E4:J4");
  ws.getCell("E4").value = `Tahun Ajaran: ${semester?.tahunAjaran?.nama || "2026/2027"} • Semester: ${semester?.tipe || "GANJIL"}`;
  ws.getCell("E4").font = { name: "Arial", size: 10, bold: true };
  ws.getCell("E4").alignment = { horizontal: "right" };

  ws.mergeCells("A5:D5");
  ws.getCell("A5").value = `Wali Kelas: ${rombel.waliKelas?.nama || "Belum Ditentukan"}`;
  ws.getCell("A5").font = { name: "Arial", size: 10, italic: true };

  ws.mergeCells("E5:J5");
  ws.getCell("E5").value = `Dicetak pada: ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`;
  ws.getCell("E5").font = { name: "Arial", size: 9, italic: true, color: { argb: "FF64748B" } };
  ws.getCell("E5").alignment = { horizontal: "right" };

  // Table Header (Baris 7)
  const headerRow = ws.getRow(7);
  headerRow.values = [
    "No",
    "NISN",
    "Nama Peserta Didik",
    "L/P",
    "Hadir (H)",
    "Sakit (S)",
    "Izin (I)",
    "Alpa (A)",
    "Total Hari",
    "% Kehadiran",
  ];
  headerRow.height = 24;

  const headerFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F172A" }, // Dark Navy
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

  for (let c = 1; c <= 10; c++) {
    const cell = headerRow.getCell(c);
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { horizontal: c === 3 ? "left" : "center", vertical: "middle" };
    cell.border = borderStyle;
  }

  // Isi Data Siswa
  let totalHadirKelas = 0;
  let totalSakitKelas = 0;
  let totalIzinKelas = 0;
  let totalAlpaKelas = 0;
  let currentRowNum = 8;

  rombel.anggota.forEach((agg, idx) => {
    const stats = siswaStats.get(agg.siswaId) || { hadir: 0, sakit: 0, izin: 0, alpa: 0 };
    const totalHari = stats.hadir + stats.sakit + stats.izin + stats.alpa;
    const persen = totalHari > 0 ? Math.round((stats.hadir / totalHari) * 100) : 100;

    totalHadirKelas += stats.hadir;
    totalSakitKelas += stats.sakit;
    totalIzinKelas += stats.izin;
    totalAlpaKelas += stats.alpa;

    const row = ws.getRow(currentRowNum);
    row.values = [
      agg.noAbsen || idx + 1,
      agg.siswa.nisn,
      agg.siswa.nama,
      agg.siswa.jenisKelamin,
      stats.hadir,
      stats.sakit,
      stats.izin,
      stats.alpa,
      totalHari,
      `${persen}%`,
    ];
    row.height = 20;

    const isEven = idx % 2 === 0;
    const rowFill: ExcelJS.Fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: isEven ? "FFFFFFFF" : "FFF8FAFC" },
    };

    for (let c = 1; c <= 10; c++) {
      const cell = row.getCell(c);
      cell.fill = rowFill;
      cell.font = { name: "Arial", size: 9 };
      cell.border = borderStyle;

      if (c === 1 || c === 2 || c === 4) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else if (c === 3) {
        cell.alignment = { horizontal: "left", vertical: "middle" };
        cell.font = { name: "Arial", size: 9, bold: true };
      } else if (c >= 5 && c <= 8) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.font = {
          name: "Arial",
          size: 9,
          bold: true,
          color: {
            argb:
              c === 5 ? "FF10B981" : c === 6 ? "FFF59E0B" : c === 7 ? "FF00BCD4" : "FFE11D48",
          },
        };
      } else {
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.font = { name: "Arial", size: 9, bold: true };
      }
    }

    currentRowNum++;
  });

  // Summary Row Total
  const totalRow = ws.getRow(currentRowNum);
  const totalPertemuanSemua = totalHadirKelas + totalSakitKelas + totalIzinKelas + totalAlpaKelas;
  const persenTotalKelas =
    totalPertemuanSemua > 0 ? Math.round((totalHadirKelas / totalPertemuanSemua) * 100) : 100;

  totalRow.values = [
    "",
    "",
    "TOTAL KESELURUHAN",
    "",
    totalHadirKelas,
    totalSakitKelas,
    totalIzinKelas,
    totalAlpaKelas,
    totalPertemuanSemua,
    `${persenTotalKelas}%`,
  ];
  totalRow.height = 22;

  ws.mergeCells(`A${currentRowNum}:D${currentRowNum}`);
  const totalCell = totalRow.getCell(1);
  totalCell.alignment = { horizontal: "center", vertical: "middle" };

  for (let c = 1; c <= 10; c++) {
    const cell = totalRow.getCell(c);
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
  const signRowNum = currentRowNum + 3;
  ws.getRow(signRowNum).values = [
    "",
    "Mengetahui,",
    "",
    "",
    "",
    "",
    "",
    `${sekolah?.desaKelurahan || "Denpasar"}, ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`,
  ];
  ws.mergeCells(`B${signRowNum}:D${signRowNum}`);
  ws.mergeCells(`H${signRowNum}:J${signRowNum}`);

  const signTitleRow = signRowNum + 1;
  ws.getRow(signTitleRow).values = [
    "",
    "Kepala Sekolah",
    "",
    "",
    "",
    "",
    "",
    "Wali Kelas",
  ];
  ws.mergeCells(`B${signTitleRow}:D${signTitleRow}`);
  ws.mergeCells(`H${signTitleRow}:J${signTitleRow}`);

  const nameRow = signRowNum + 4;
  ws.getRow(nameRow).values = [
    "",
    sekolah?.namaKepsek || "Drs. I Made Sujana, M.Pd.",
    "",
    "",
    "",
    "",
    "",
    rombel.waliKelas?.nama || "Wali Kelas",
  ];
  ws.mergeCells(`B${nameRow}:D${nameRow}`);
  ws.mergeCells(`H${nameRow}:J${nameRow}`);
  ws.getCell(`B${nameRow}`).font = { name: "Arial", size: 9, bold: true, underline: true };
  ws.getCell(`H${nameRow}`).font = { name: "Arial", size: 9, bold: true, underline: true };

  const nipRow = nameRow + 1;
  ws.getRow(nipRow).values = [
    "",
    `NIP. ${sekolah?.nipKepsek || "196805121992031008"}`,
    "",
    "",
    "",
    "",
    "",
    `NIP. ${rombel.waliKelas?.nip || "-"}`,
  ];
  ws.mergeCells(`B${nipRow}:D${nipRow}`);
  ws.mergeCells(`H${nipRow}:J${nipRow}`);
  ws.getCell(`B${nipRow}`).font = { name: "Arial", size: 8 };
  ws.getCell(`H${nipRow}`).font = { name: "Arial", size: 8 };

  const buffer = await wb.xlsx.writeBuffer();
  const safeName = rombel.nama.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `Rekap_Presensi_Kelas_${safeName}_${semester?.tipe || "Semester"}.xlsx`;

  return { buffer, fileName };
}
