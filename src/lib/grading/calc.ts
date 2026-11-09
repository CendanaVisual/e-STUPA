/**
 * Kalkulasi nilai akhir rapor & deskripsi capaian TP Kurikulum Merdeka.
 * Komponen yang belum memiliki nilai diabaikan dan bobotnya dinormalisasi secara proporsional
 * sehingga hasil realtime maupun hasil simpan akhir selalu akurat.
 */

export interface Bobot {
  bobotHarian: number;
  bobotUts: number;
  bobotUas: number;
}

export interface KomponenNilai {
  harian: (number | null)[];
  uts: number | null;
  uas: number | null;
}

export interface KomponenNilaiLengkap {
  harian: (number | null)[];
  slm: (number | null)[];
  uts: (number | null)[];
  uas: (number | null)[];
}

export interface TpScoreEntry {
  kode: string;
  deskripsi: string;
  nilai: number;
}

export interface MasterTpItem {
  kodeTp: string;
  tujuanPembelajaran: string;
  ruangLingkupMateri?: string | null;
  urutan: number;
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function rataRata(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null && !Number.isNaN(v));
  if (valid.length === 0) return null;
  return round2(valid.reduce((a, b) => a + b, 0) / valid.length);
}

export function hitungNilaiAkhir(k: KomponenNilai, b: Bobot) {
  const rataHarian = rataRata(k.harian);
  const parts: [number | null, number][] = [
    [rataHarian, b.bobotHarian],
    [k.uts, b.bobotUts],
    [k.uas, b.bobotUas],
  ];
  const aktif = parts.filter(([v]) => v !== null) as [number, number][];
  const totalBobot = aktif.reduce((s, [, w]) => s + w, 0);
  const nilaiAkhir =
    totalBobot === 0
      ? null
      : Math.round(aktif.reduce((s, [v, w]) => s + v * w, 0) / totalBobot);

  return { rataHarian, nilaiUts: k.uts, nilaiUas: k.uas, nilaiAkhir };
}

/**
 * Kalkulasi lengkap mencakup Formatif/TP (HARIAN), Sumatif Lingkup Materi (SLM),
 * STS (UTS), dan SAS (UAS). Hasil Nilai Akhir selalu bilangan bulat (Math.round).
 */
export function hitungNilaiAkhirLengkap(k: KomponenNilaiLengkap, b: Bobot) {
  const rataHarian = rataRata(k.harian);
  const rataSlm = rataRata(k.slm);
  const nilaiUts = rataRata(k.uts);
  const nilaiUas = rataRata(k.uas);

  const parts: [number, number][] = [];

  if (rataHarian !== null && b.bobotHarian > 0) {
    parts.push([rataHarian, b.bobotHarian]);
  }

  if (rataSlm !== null && nilaiUts !== null && b.bobotUts > 0) {
    parts.push([rataSlm, b.bobotUts / 2]);
    parts.push([nilaiUts, b.bobotUts / 2]);
  } else if (rataSlm !== null && b.bobotUts > 0) {
    parts.push([rataSlm, b.bobotUts]);
  } else if (nilaiUts !== null && b.bobotUts > 0) {
    parts.push([nilaiUts, b.bobotUts]);
  }

  if (nilaiUas !== null && b.bobotUas > 0) {
    parts.push([nilaiUas, b.bobotUas]);
  }

  // Fallback jika semua bobot diset 0 tetapi ada komponen berisi nilai
  if (parts.length === 0) {
    const rawAvailable = [rataHarian, rataSlm, nilaiUts, nilaiUas].filter(
      (v): v is number => v !== null
    );
    const avgRaw = rawAvailable.length > 0 ? rataRata(rawAvailable) : null;
    const fallbackAkhir = avgRaw !== null ? Math.round(avgRaw) : null;
    return { rataHarian, rataSlm, nilaiUts, nilaiUas, nilaiAkhir: fallbackAkhir };
  }

  const totalBobot = parts.reduce((s, [, w]) => s + w, 0);
  const nilaiAkhir =
    totalBobot === 0
      ? null
      : Math.round(parts.reduce((s, [v, w]) => s + v * w, 0) / totalBobot);

  return { rataHarian, rataSlm, nilaiUts, nilaiUas, nilaiAkhir };
}

function normalizeKodeTp(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cleanTpSentence(text: string): string {
  return text.trim().replace(/\.+$/, "");
}

/**
 * Mencocokkan kolom Penilaian TP dengan daftar Tujuan Pembelajaran pada tingkat & mapel terkait.
 */
export function resolveTpDeskripsiText(
  col: { nama: string; urutan: number; tujuanPembelajaran?: string | null },
  masterTps: MasterTpItem[]
): string {
  const normCol = normalizeKodeTp(col.nama);
  const exactTp = masterTps.find((tp) => {
    const normMaster = normalizeKodeTp(tp.kodeTp);
    return (
      normMaster === normCol ||
      `tp${normMaster}` === normCol ||
      normMaster === `tp${normCol}`
    );
  });

  if (exactTp) {
    return exactTp.tujuanPembelajaran;
  }

  const byOrder = masterTps.find((tp) => tp.urutan === col.urutan);
  if (byOrder) {
    return byOrder.tujuanPembelajaran;
  }

  if (col.tujuanPembelajaran && col.tujuanPembelajaran.trim() !== "") {
    return col.tujuanPembelajaran.trim();
  }

  return col.nama;
}

/**
 * Menghasilkan teks deskripsi TP Tercapai (tertinggi) dan TP Perlu Bimbingan (terendah)
 * berdasarkan daftar nilai TP siswa yang sudah terisi.
 */
export function buildDeskripsiCapaianTp(entries: TpScoreEntry[], kktp: number = 75) {
  if (entries.length === 0) {
    return {
      tpTertinggiKode: "",
      tpTerendahKode: "",
      capaianTertinggi: null as string | null,
      capaianTerendah: null as string | null,
      deskripsiGabungan: "",
    };
  }

  if (entries.length === 1) {
    const single = entries[0];
    const desc = cleanTpSentence(single.deskripsi);
    if (single.nilai >= kktp) {
      const capMax = `Menunjukkan penguasaan yang baik dalam ${desc}.`;
      return {
        tpTertinggiKode: single.kode,
        tpTerendahKode: "",
        capaianTertinggi: capMax,
        capaianTerendah: null,
        deskripsiGabungan: capMax,
      };
    } else {
      const capMin = `Perlu bimbingan lebih lanjut dalam ${desc}.`;
      return {
        tpTertinggiKode: "",
        tpTerendahKode: single.kode,
        capaianTertinggi: null,
        capaianTerendah: capMin,
        deskripsiGabungan: capMin,
      };
    }
  }

  let maxIdx = 0;
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].nilai > entries[maxIdx].nilai) {
      maxIdx = i;
    }
  }

  let minIdx = -1;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (i === maxIdx) continue;
    if (minIdx === -1 || entries[i].nilai < entries[minIdx].nilai) {
      minIdx = i;
    }
  }

  const maxItem = entries[maxIdx];
  const minItem = minIdx !== -1 ? entries[minIdx] : entries[entries.length - 1];

  const capaianTertinggi = `Menunjukkan penguasaan yang baik dalam ${cleanTpSentence(maxItem.deskripsi)}.`;
  const capaianTerendah = `Perlu bimbingan lebih lanjut dalam ${cleanTpSentence(minItem.deskripsi)}.`;

  return {
    tpTertinggiKode: maxItem.kode,
    tpTerendahKode: minItem.kode,
    capaianTertinggi,
    capaianTerendah,
    deskripsiGabungan: `${capaianTertinggi} ${capaianTerendah}`,
  };
}

export function getFaseByTingkat(tingkat: number): string {
  if (tingkat <= 2) return "Fase A";
  if (tingkat <= 4) return "Fase B";
  if (tingkat <= 6) return "Fase C";
  if (tingkat <= 9) return "Fase D";
  if (tingkat === 10) return "Fase E";
  return "Fase F";
}
