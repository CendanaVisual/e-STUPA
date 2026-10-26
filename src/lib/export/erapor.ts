import "server-only";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";

/**
 * Ekspor nilai ke format Template Nilai E-Rapor.
 *
 * ⚠️ PENTING: Struktur di bawah adalah PLACEHOLDER. Format template E-Rapor
 * berbeda antar jenjang (SD/SMP/SMA/SMK) dan versi aplikasi. Unduh template
 * asli dari E-Rapor sekolah, lalu sesuaikan `ERAPOR_TEMPLATE` agar nama sheet,
 * baris header, dan urutan kolom SAMA PERSIS.
 */
export const ERAPOR_TEMPLATE = {
  sheetName: "Nilai", // TODO: ganti sesuai template asli
  headerRow: 1,
  columns: [
    { header: "No", key: "no", width: 5 },
    { header: "NISN", key: "nisn", width: 14 },
    { header: "Nama Peserta Didik", key: "nama", width: 32 },
    { header: "Nilai Akhir", key: "nilaiAkhir", width: 12 },
    { header: "Capaian Kompetensi Tertinggi", key: "capaianTertinggi", width: 50 },
    { header: "Capaian Kompetensi Terendah", key: "capaianTerendah", width: 50 },
  ],
} as const;

export async function buildEraporWorkbook(pembelajaranId: string) {
  const p = await db.pembelajaran.findUniqueOrThrow({
    where: { id: pembelajaranId },
    include: {
      mapel: true,
      rombel: { include: { anggota: { include: { siswa: true }, orderBy: { siswa: { nama: "asc" } } } } },
      nilaiRapor: true,
    },
  });

  const raporBySiswa = new Map(p.nilaiRapor.map((n) => [n.siswaId, n]));
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(ERAPOR_TEMPLATE.sheetName);
  ws.columns = ERAPOR_TEMPLATE.columns.map((c) => ({ ...c }));

  p.rombel.anggota.forEach((a, i) => {
    const n = raporBySiswa.get(a.siswaId);
    ws.addRow({
      no: i + 1,
      nisn: a.siswa.nisn,
      nama: a.siswa.nama,
      nilaiAkhir: n?.nilaiAkhir ? Math.round(Number(n.nilaiAkhir)) : null,
      capaianTertinggi: n?.capaianTertinggi ?? "",
      capaianTerendah: n?.capaianTerendah ?? "",
    });
  });

  const fileName = `Nilai_${p.mapel.kode}_${p.rombel.nama}.xlsx`.replace(/\s+/g, "_");
  return { buffer: await wb.xlsx.writeBuffer(), fileName };
}
