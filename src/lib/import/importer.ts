import "server-only";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { resolveColumns, SISWA_MAP } from "./dapodik-mapping";

export interface ImportResult {
  totalBaris: number;
  ditambah: number;
  diperbarui: number;
  gagal: number;
  errors: { baris: number; pesan: string }[];
}

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object" && "text" in v) return String(v.text).trim();
  if (typeof v === "object" && "result" in v) return String(v.result ?? "").trim();
  return String(v).trim();
}

/**
 * Baca sheet pertama → array baris (string[]).
 * `headerRow` = nomor baris header (ekspor Dapodik biasanya punya judul di atas).
 */
export async function readSheet(buffer: ArrayBuffer, headerRow = 1) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const values = (row.values as ExcelJS.CellValue[]).slice(1).map(cellText);
    rows.push(values);
  });
  return { headers: rows[headerRow - 1] ?? [], data: rows.slice(headerRow) };
}

/** UPSERT siswa berbasis NISN — data lama diperbarui, tidak diduplikasi */
export async function importSiswa(buffer: ArrayBuffer, headerRow = 1): Promise<ImportResult> {
  const { headers, data } = await readSheet(buffer, headerRow);
  const col = resolveColumns(headers, SISWA_MAP);
  if (col.nisn === undefined || col.nama === undefined) {
    throw new Error("Kolom wajib NISN dan Nama tidak ditemukan pada file");
  }

  const res: ImportResult = { totalBaris: data.length, ditambah: 0, diperbarui: 0, gagal: 0, errors: [] };
  const get = (r: string[], f: string) => (col[f] !== undefined ? r[col[f]] || null : null);

  for (const [i, r] of data.entries()) {
    const nisn = get(r, "nisn");
    try {
      if (!nisn) throw new Error("NISN kosong");
      const jk = (get(r, "jenisKelamin") ?? "").toUpperCase().startsWith("P") ? "P" : "L";
      const tgl = get(r, "tanggalLahir");
      const payload = {
        dapodikId: get(r, "dapodikId"),
        nis: get(r, "nis"),
        nik: get(r, "nik"),
        nama: get(r, "nama")!,
        jenisKelamin: jk as "L" | "P",
        tempatLahir: get(r, "tempatLahir"),
        tanggalLahir: tgl ? new Date(tgl) : null,
        agama: get(r, "agama"),
        alamat: get(r, "alamat"),
        namaAyah: get(r, "namaAyah"),
        namaIbu: get(r, "namaIbu"),
        namaWali: get(r, "namaWali"),
        status: "AKTIF" as const,
        isAktif: true,
      };
      const existing = await db.siswa.findUnique({ where: { nisn }, select: { id: true } });
      await db.siswa.upsert({ where: { nisn }, update: payload, create: { nisn, ...payload } });
      if (existing) res.diperbarui++;
      else res.ditambah++;
    } catch (e) {
      res.gagal++;
      res.errors.push({ baris: i + headerRow + 1, pesan: (e as Error).message });
    }
  }
  return res;
}

// TODO: importGtk (kunci: ptk_id → NUPTK → NIK), importRombel (kunci: rombongan_belajar_id
// atau semesterId+nama), importAnggotaRombel, importPembelajaran.
