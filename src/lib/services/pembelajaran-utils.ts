export type Fase = "FASE_A" | "FASE_B" | "FASE_C";

export function getFaseByTingkat(tingkat: number): { fase: Fase; label: string } {
  if (tingkat <= 2) return { fase: "FASE_A", label: "Fase A (Kelas 1 & 2)" };
  if (tingkat <= 4) return { fase: "FASE_B", label: "Fase B (Kelas 3 & 4)" };
  return { fase: "FASE_C", label: "Fase C (Kelas 5 & 6)" };
}

/**
 * Pemetaan mata pelajaran Kurikulum Merdeka untuk Guru Kelas:
 * A. Fase A (Kelas 1 dan Kelas 2):
 *    - Pendidikan Pancasila (PP)
 *    - Bahasa Indonesia (BIND)
 *    - Matematika (MTK)
 *    - Seni dan Budaya (SB)
 *    - Bahasa Inggris (BING)
 *
 * B. Fase B (Kelas 3 dan Kelas 4):
 *    - Pendidikan Pancasila (PP)
 *    - Bahasa Indonesia (BIND)
 *    - Matematika (MTK)
 *    - Ilmu Pengetahuan Alam dan Sosial (IPAS)
 *    - Seni dan Budaya (SB)
 *    - Bahasa Inggris (BING)
 *
 * C. Fase C (Kelas 5 dan Kelas 6):
 *    - Pendidikan Pancasila (PP)
 *    - Bahasa Indonesia (BIND)
 *    - Matematika (MTK)
 *    - Ilmu Pengetahuan Alam dan Sosial (IPAS)
 *    - Seni dan Budaya (SB)
 *    - Bahasa Inggris (BING)
 */
export const MAPEL_GURU_KELAS_BY_FASE: Record<
  Fase,
  Array<{ kode: string; nama: string; keywords: string[] }>
> = {
  FASE_A: [
    { kode: "PP", nama: "Pendidikan Pancasila", keywords: ["pancasila", "pendidikan pancasila"] },
    { kode: "BIND", nama: "Bahasa Indonesia", keywords: ["indonesia", "bahasa indonesia"] },
    { kode: "MTK", nama: "Matematika", keywords: ["matematika", "mtk"] },
    { kode: "SB", nama: "Seni dan Budaya", keywords: ["seni dan budaya", "seni budaya", "seni"] },
    { kode: "BING", nama: "Bahasa Inggris", keywords: ["inggris", "bahasa inggris"] },
  ],
  FASE_B: [
    { kode: "PP", nama: "Pendidikan Pancasila", keywords: ["pancasila", "pendidikan pancasila"] },
    { kode: "BIND", nama: "Bahasa Indonesia", keywords: ["indonesia", "bahasa indonesia"] },
    { kode: "MTK", nama: "Matematika", keywords: ["matematika", "mtk"] },
    { kode: "IPAS", nama: "Ilmu Pengetahuan Alam dan Sosial (IPAS)", keywords: ["ipas", "alam dan sosial"] },
    { kode: "SB", nama: "Seni dan Budaya", keywords: ["seni dan budaya", "seni budaya", "seni"] },
    { kode: "BING", nama: "Bahasa Inggris", keywords: ["inggris", "bahasa inggris"] },
  ],
  FASE_C: [
    { kode: "PP", nama: "Pendidikan Pancasila", keywords: ["pancasila", "pendidikan pancasila"] },
    { kode: "BIND", nama: "Bahasa Indonesia", keywords: ["indonesia", "bahasa indonesia"] },
    { kode: "MTK", nama: "Matematika", keywords: ["matematika", "mtk"] },
    { kode: "IPAS", nama: "Ilmu Pengetahuan Alam dan Sosial (IPAS)", keywords: ["ipas", "alam dan sosial"] },
    { kode: "SB", nama: "Seni dan Budaya", keywords: ["seni dan budaya", "seni budaya", "seni"] },
    { kode: "BING", nama: "Bahasa Inggris", keywords: ["inggris", "bahasa inggris"] },
  ],
};
