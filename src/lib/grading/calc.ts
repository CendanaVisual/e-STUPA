/**
 * Kalkulasi nilai akhir rapor.
 * NA = (rata2 Harian × bobotHarian + UTS × bobotUts + UAS × bobotUas) / 100
 * Komponen yang kosong diabaikan dan bobotnya dinormalisasi ulang.
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
      : round2(aktif.reduce((s, [v, w]) => s + v * w, 0) / totalBobot);

  return { rataHarian, nilaiUts: k.uts, nilaiUas: k.uas, nilaiAkhir };
}
