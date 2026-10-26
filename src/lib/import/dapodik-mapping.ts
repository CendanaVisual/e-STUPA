/**
 * Pemetaan header kolom file ekspor Dapodik → field database.
 * Header dinormalisasi (lowercase, tanpa spasi/tanda baca) sehingga variasi
 * seperti "NISN", "N I S N", "nisn" dianggap sama.
 *
 * TODO: sesuaikan alias dengan file ekspor Dapodik versi sekolah Anda.
 */

export function normalizeHeader(h: string) {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

type FieldMap = Record<string, string[]>;

export const SISWA_MAP: FieldMap = {
  dapodikId: ["pesertadidikid"],
  nisn: ["nisn"],
  nis: ["nipd", "nis"],
  nik: ["nik"],
  nama: ["nama", "namapesertadidik"],
  jenisKelamin: ["jk", "jeniskelamin"],
  tempatLahir: ["tempatlahir"],
  tanggalLahir: ["tanggallahir"],
  agama: ["agama"],
  alamat: ["alamat"],
  namaAyah: ["namaayah"],
  namaIbu: ["namaibu"],
  namaWali: ["namawali"],
  rombel: ["rombelsaatini", "rombel", "namarombel"],
};

export const GTK_MAP: FieldMap = {
  dapodikId: ["ptkid"],
  nuptk: ["nuptk"],
  nik: ["nik"],
  nip: ["nip"],
  nama: ["nama", "namaptk"],
  jenisKelamin: ["jk", "jeniskelamin"],
  tempatLahir: ["tempatlahir"],
  tanggalLahir: ["tanggallahir"],
  jenisPtk: ["jenisptk"],
  statusKepegawaian: ["statuskepegawaian"],
  email: ["email"],
  noHp: ["hp", "nohp"],
};

export const ROMBEL_MAP: FieldMap = {
  dapodikId: ["rombonganbelajarid"],
  nama: ["namarombel", "nama"],
  tingkat: ["tingkatpendidikan", "tingkat"],
  kurikulum: ["kurikulum"],
  waliKelas: ["walikelas", "namawalikelas"],
};

/** Ubah header asli menjadi { field: indexKolom } berdasarkan map */
export function resolveColumns(headers: string[], map: FieldMap) {
  const norm = headers.map(normalizeHeader);
  const result: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(map)) {
    const idx = norm.findIndex((h) => aliases.includes(h));
    if (idx >= 0) result[field] = idx;
  }
  return result;
}
