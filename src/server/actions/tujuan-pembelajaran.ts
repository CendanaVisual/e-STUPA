"use server";

import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { getSemesterAktif } from "@/lib/services/semester";
import type { SessionPayload } from "@/lib/auth/jwt";

export type TpActionResponse = {
  success: boolean;
  message: string;
  count?: number;
};

async function checkTpAccess(
  session: SessionPayload,
  semesterId: string,
  tingkat: number,
  mapelId: string,
): Promise<boolean> {
  if (session.role === "SUPERADMIN") return true;
  if (!session.gtkId) return false;

  const assigned = await db.pembelajaran.findFirst({
    where: {
      semesterId,
      gtkId: session.gtkId,
      mapelId,
      rombel: { tingkat },
    },
    select: { id: true },
  });

  if (assigned) return true;

  // Fallback wali kelas pada tingkat tersebut
  const waliRombel = await db.rombel.findFirst({
    where: {
      semesterId,
      waliKelasId: session.gtkId,
      tingkat,
    },
    select: { id: true },
  });

  return Boolean(waliRombel);
}

function revalidateTpPaths() {
  revalidatePath("/admin/tujuan-pembelajaran");
  revalidatePath("/guru/tujuan-pembelajaran");
  revalidatePath("/admin/tahun-ajaran");
}

function cellToString(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "object") {
    if ("richText" in (val as Record<string, unknown>) && Array.isArray((val as { richText: Array<{ text?: string }> }).richText)) {
      return (val as { richText: Array<{ text?: string }> }).richText
        .map((r) => r.text || "")
        .join("")
        .trim();
    }
    if ("text" in (val as Record<string, unknown>)) {
      return String((val as { text: unknown }).text || "").trim();
    }
    if ("result" in (val as Record<string, unknown>)) {
      return String((val as { result: unknown }).result || "").trim();
    }
  }
  return String(val).trim();
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((ch === "," || ch === ";") && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * 1. Simpan 1 atau beberapa baris input manual Tujuan Pembelajaran & Ruang Lingkup Materi
 */
export async function simpanTpManualBatch(payload: {
  tingkat: number;
  mapelId: string;
  items: Array<{
    kodeTp: string;
    tujuanPembelajaran: string;
    ruangLingkupMateri: string;
  }>;
}): Promise<TpActionResponse> {
  try {
    const session = await requireAuth();
    const semester = await getSemesterAktif();

    if (!semester) {
      return {
        success: false,
        message: "Belum ada semester aktif. Silakan aktifkan semester terlebih dahulu.",
      };
    }

    const tingkat = Number(payload.tingkat);
    const mapelId = String(payload.mapelId || "").trim();

    if (!tingkat || tingkat < 1 || tingkat > 6 || !mapelId) {
      return {
        success: false,
        message: "Tingkat kelas (1–6) dan mata pelajaran wajib dipilih.",
      };
    }

    const allowed = await checkTpAccess(session, semester.id, tingkat, mapelId);
    if (!allowed) {
      return {
        success: false,
        message: "Anda tidak memiliki akses penugasan pada tingkat kelas dan mata pelajaran ini.",
      };
    }

    const validItems = (payload.items || [])
      .map((it) => ({
        kodeTp: String(it.kodeTp || "").trim(),
        tujuanPembelajaran: String(it.tujuanPembelajaran || "").trim(),
        ruangLingkupMateri: String(it.ruangLingkupMateri || "").trim(),
      }))
      .filter((it) => it.kodeTp && it.tujuanPembelajaran);

    if (validItems.length === 0) {
      return {
        success: false,
        message: "Mohon isi minimal Kode TP dan Tujuan Pembelajaran.",
      };
    }

    const lastTp = await db.tujuanPembelajaran.findFirst({
      where: { semesterId: semester.id, tingkat, mapelId },
      orderBy: { urutan: "desc" },
      select: { urutan: true },
    });

    let nextUrutan = (lastTp?.urutan || 0) + 1;
    let saved = 0;

    for (const item of validItems) {
      await db.tujuanPembelajaran.upsert({
        where: {
          semesterId_tingkat_mapelId_kodeTp: {
            semesterId: semester.id,
            tingkat,
            mapelId,
            kodeTp: item.kodeTp,
          },
        },
        update: {
          tujuanPembelajaran: item.tujuanPembelajaran,
          ruangLingkupMateri: item.ruangLingkupMateri || "-",
        },
        create: {
          semesterId: semester.id,
          tingkat,
          mapelId,
          kodeTp: item.kodeTp,
          tujuanPembelajaran: item.tujuanPembelajaran,
          ruangLingkupMateri: item.ruangLingkupMateri || "-",
          urutan: nextUrutan++,
        },
      });
      saved++;
    }

    revalidateTpPaths();

    return {
      success: true,
      message: `Berhasil menyimpan ${saved} baris Tujuan Pembelajaran & Ruang Lingkup Materi!`,
      count: saved,
    };
  } catch (err: unknown) {
    console.error("[simpanTpManualBatch Error]:", err);
    return {
      success: false,
      message:
        err instanceof Error
          ? err.message
          : "Gagal menyimpan Tujuan Pembelajaran.",
    };
  }
}

/**
 * 2. Edit baris Tujuan Pembelajaran & Ruang Lingkup Materi
 */
export async function updateTpItem(
  id: string,
  payload: {
    kodeTp: string;
    tujuanPembelajaran: string;
    ruangLingkupMateri: string;
  },
): Promise<TpActionResponse> {
  try {
    const session = await requireAuth();
    const existing = await db.tujuanPembelajaran.findUnique({ where: { id } });

    if (!existing) {
      return { success: false, message: "Data Tujuan Pembelajaran tidak ditemukan." };
    }

    const allowed = await checkTpAccess(
      session,
      existing.semesterId,
      existing.tingkat,
      existing.mapelId,
    );
    if (!allowed) {
      return {
        success: false,
        message: "Anda tidak berhak mengubah data pada tingkat & mapel ini.",
      };
    }

    const kodeTp = String(payload.kodeTp || "").trim();
    const tujuanPembelajaran = String(payload.tujuanPembelajaran || "").trim();
    const ruangLingkupMateri = String(payload.ruangLingkupMateri || "").trim();

    if (!kodeTp || !tujuanPembelajaran) {
      return {
        success: false,
        message: "Kode TP dan Tujuan Pembelajaran tidak boleh kosong.",
      };
    }

    if (kodeTp !== existing.kodeTp) {
      const conflict = await db.tujuanPembelajaran.findUnique({
        where: {
          semesterId_tingkat_mapelId_kodeTp: {
            semesterId: existing.semesterId,
            tingkat: existing.tingkat,
            mapelId: existing.mapelId,
            kodeTp,
          },
        },
      });
      if (conflict) {
        return {
          success: false,
          message: `Kode TP "${kodeTp}" sudah digunakan pada mata pelajaran di tingkat ini.`,
        };
      }
    }

    await db.tujuanPembelajaran.update({
      where: { id },
      data: {
        kodeTp,
        tujuanPembelajaran,
        ruangLingkupMateri: ruangLingkupMateri || "-",
      },
    });

    revalidateTpPaths();

    return {
      success: true,
      message: `Data Tujuan Pembelajaran (${kodeTp}) berhasil diperbarui!`,
    };
  } catch (err: unknown) {
    console.error("[updateTpItem Error]:", err);
    return {
      success: false,
      message:
        err instanceof Error
          ? err.message
          : "Gagal memperbarui Tujuan Pembelajaran.",
    };
  }
}

/**
 * 3. Hapus baris Tujuan Pembelajaran & Ruang Lingkup Materi
 */
export async function hapusTpItem(id: string): Promise<TpActionResponse> {
  try {
    const session = await requireAuth();
    const existing = await db.tujuanPembelajaran.findUnique({ where: { id } });

    if (!existing) {
      return { success: false, message: "Data Tujuan Pembelajaran tidak ditemukan." };
    }

    const allowed = await checkTpAccess(
      session,
      existing.semesterId,
      existing.tingkat,
      existing.mapelId,
    );
    if (!allowed) {
      return {
        success: false,
        message: "Anda tidak berhak menghapus data pada tingkat & mapel ini.",
      };
    }

    await db.tujuanPembelajaran.delete({ where: { id } });
    revalidateTpPaths();

    return {
      success: true,
      message: `Tujuan Pembelajaran (${existing.kodeTp}) berhasil dihapus dari database!`,
    };
  } catch (err: unknown) {
    console.error("[hapusTpItem Error]:", err);
    return {
      success: false,
      message:
        err instanceof Error
          ? err.message
          : "Gagal menghapus Tujuan Pembelajaran.",
    };
  }
}

/**
 * 4. Impor Tujuan Pembelajaran dari Excel (.xlsx) atau CSV (.csv)
 */
export async function imporTpExcel(formData: FormData): Promise<TpActionResponse> {
  try {
    const session = await requireAuth();
    const semester = await getSemesterAktif();

    if (!semester) {
      return {
        success: false,
        message: "Belum ada semester aktif. Silakan aktifkan semester terlebih dahulu.",
      };
    }

    const file = formData.get("file") as File | null;
    const defaultTingkat = parseInt(String(formData.get("tingkat") || "1")) || 1;
    const defaultMapelId = String(formData.get("mapelId") || "").trim();

    if (!file || file.size === 0) {
      return { success: false, message: "Pilih berkas Excel (.xlsx) atau .csv terlebih dahulu." };
    }

    const allMapels = await db.mapel.findMany({
      where: { isAktif: true },
      select: { id: true, kode: true, nama: true },
    });

    const mapelByKode = new Map<string, string>();
    const mapelByNama = new Map<string, string>();
    for (const m of allMapels) {
      mapelByKode.set(m.kode.toUpperCase(), m.id);
      mapelByNama.set(m.nama.toLowerCase(), m.id);
    }

    type RawRow = {
      tingkatStr?: string;
      mapelStr?: string;
      kodeTp: string;
      tujuanPembelajaran: string;
      ruangLingkupMateri: string;
    };

    const parsedRows: RawRow[] = [];
    const fileNameLower = file.name.toLowerCase();

    if (fileNameLower.endsWith(".csv")) {
      const text = await file.text();
      const lines = text
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      if (lines.length < 2) {
        return { success: false, message: "Berkas CSV kosong atau tidak memiliki baris data." };
      }

      const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
      const idxTingkat = headers.findIndex((h) => h.includes("tingkat") || h === "kelas");
      const idxMapel = headers.findIndex((h) => h.includes("mapel") || h.includes("pelajaran"));
      const idxKode = headers.findIndex(
        (h) => h.includes("kode tp") || h === "kode" || h.includes("no tp"),
      );
      const idxTp = headers.findIndex(
        (h) => h.includes("tujuan") || h === "tp" || h.includes("capaian") || h.includes("deskripsi"),
      );
      const idxMateri = headers.findIndex(
        (h) => h.includes("lingkup") || h.includes("materi"),
      );

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        const kodeTp = idxKode >= 0 ? cols[idxKode] || "" : cols[0] || "";
        const tujuanPembelajaran = idxTp >= 0 ? cols[idxTp] || "" : cols[1] || "";
        const ruangLingkupMateri = idxMateri >= 0 ? cols[idxMateri] || "" : cols[2] || "";
        if (!kodeTp && !tujuanPembelajaran) continue;
        parsedRows.push({
          tingkatStr: idxTingkat >= 0 ? cols[idxTingkat] : undefined,
          mapelStr: idxMapel >= 0 ? cols[idxMapel] : undefined,
          kodeTp,
          tujuanPembelajaran,
          ruangLingkupMateri,
        });
      }
    } else {
      const arrayBuf = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuf);

      const sheet = workbook.worksheets[0];
      if (!sheet) {
        return { success: false, message: "Lembar kerja (worksheet) Excel tidak ditemukan." };
      }

      // Cari baris header (baris 1 s/d 5)
      let headerRowNum = 1;
      let idxTingkat = -1;
      let idxMapel = -1;
      let idxKode = -1;
      let idxTp = -1;
      let idxMateri = -1;

      for (let r = 1; r <= Math.min(5, sheet.rowCount); r++) {
        const row = sheet.getRow(r);
        const vals: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          vals[colNumber] = cellToString(cell.value).toLowerCase();
        });

        const foundTp = vals.findIndex(
          (v) => v && (v.includes("tujuan") || v === "tp" || v.includes("capaian")),
        );
        const foundKode = vals.findIndex(
          (v) => v && (v.includes("kode tp") || v === "kode" || v.includes("no tp")),
        );

        if (foundTp > 0 || foundKode > 0) {
          headerRowNum = r;
          idxTingkat = vals.findIndex((v) => v && (v.includes("tingkat") || v === "kelas"));
          idxMapel = vals.findIndex(
            (v) => v && (v.includes("kode mapel") || v.includes("mapel") || v.includes("pelajaran")),
          );
          idxKode = foundKode;
          idxTp = foundTp;
          idxMateri = vals.findIndex(
            (v) => v && (v.includes("lingkup") || v.includes("materi")),
          );
          break;
        }
      }

      // Fallback posisi kolom standar jika header kustom
      if (idxKode < 1 && idxTp < 1) {
        idxKode = 1;
        idxTp = 2;
        idxMateri = 3;
      }

      for (let r = headerRowNum + 1; r <= sheet.rowCount; r++) {
        const row = sheet.getRow(r);
        const kodeTp = idxKode > 0 ? cellToString(row.getCell(idxKode).value) : "";
        const tujuanPembelajaran = idxTp > 0 ? cellToString(row.getCell(idxTp).value) : "";
        const ruangLingkupMateri = idxMateri > 0 ? cellToString(row.getCell(idxMateri).value) : "";
        const tingkatStr = idxTingkat > 0 ? cellToString(row.getCell(idxTingkat).value) : undefined;
        const mapelStr = idxMapel > 0 ? cellToString(row.getCell(idxMapel).value) : undefined;

        if (!kodeTp && !tujuanPembelajaran) continue;
        parsedRows.push({
          tingkatStr,
          mapelStr,
          kodeTp,
          tujuanPembelajaran,
          ruangLingkupMateri,
        });
      }
    }

    if (parsedRows.length === 0) {
      return {
        success: false,
        message: "Tidak ditemukan baris Tujuan Pembelajaran yang valid di dalam berkas.",
      };
    }

    let imported = 0;
    let skipped = 0;
    const accessCache = new Map<string, boolean>();
    const urutanCache = new Map<string, number>();

    for (const row of parsedRows) {
      if (!row.kodeTp || !row.tujuanPembelajaran) {
        skipped++;
        continue;
      }

      // Tentukan tingkat (1-6)
      let targetTingkat = defaultTingkat;
      if (row.tingkatStr) {
        const numMatch = row.tingkatStr.match(/\d+/);
        if (numMatch) {
          const parsedT = parseInt(numMatch[0]);
          if (parsedT >= 1 && parsedT <= 6) {
            targetTingkat = parsedT;
          }
        }
      }

      // Tentukan mapelId
      let targetMapelId = defaultMapelId;
      if (row.mapelStr) {
        const cleanM = row.mapelStr.trim();
        const byKode = mapelByKode.get(cleanM.toUpperCase());
        const byNama = mapelByNama.get(cleanM.toLowerCase());
        if (byKode) {
          targetMapelId = byKode;
        } else if (byNama) {
          targetMapelId = byNama;
        } else if (cleanM.toUpperCase() === "BB") {
          targetMapelId = mapelByKode.get("MULOK") || defaultMapelId;
        }
      }

      if (!targetMapelId || targetTingkat < 1 || targetTingkat > 6) {
        skipped++;
        continue;
      }

      const accessKey = `${targetTingkat}_${targetMapelId}`;
      let hasAccess = accessCache.get(accessKey);
      if (hasAccess === undefined) {
        hasAccess = await checkTpAccess(session, semester.id, targetTingkat, targetMapelId);
        accessCache.set(accessKey, hasAccess);
      }

      if (!hasAccess) {
        skipped++;
        continue;
      }

      let curUrutan = urutanCache.get(accessKey);
      if (curUrutan === undefined) {
        const last = await db.tujuanPembelajaran.findFirst({
          where: {
            semesterId: semester.id,
            tingkat: targetTingkat,
            mapelId: targetMapelId,
          },
          orderBy: { urutan: "desc" },
          select: { urutan: true },
        });
        curUrutan = (last?.urutan || 0) + 1;
      }

      await db.tujuanPembelajaran.upsert({
        where: {
          semesterId_tingkat_mapelId_kodeTp: {
            semesterId: semester.id,
            tingkat: targetTingkat,
            mapelId: targetMapelId,
            kodeTp: row.kodeTp,
          },
        },
        update: {
          tujuanPembelajaran: row.tujuanPembelajaran,
          ruangLingkupMateri: row.ruangLingkupMateri || "-",
        },
        create: {
          semesterId: semester.id,
          tingkat: targetTingkat,
          mapelId: targetMapelId,
          kodeTp: row.kodeTp,
          tujuanPembelajaran: row.tujuanPembelajaran,
          ruangLingkupMateri: row.ruangLingkupMateri || "-",
          urutan: curUrutan,
        },
      });

      urutanCache.set(accessKey, curUrutan + 1);
      imported++;
    }

    revalidateTpPaths();

    if (imported === 0) {
      return {
        success: false,
        message:
          skipped > 0
            ? `Seluruh ${skipped} baris dilewati (pastikan Kode TP, Tujuan Pembelajaran, dan hak akses mapel sesuai).`
            : "Tidak ada data yang berhasil diimpor.",
      };
    }

    return {
      success: true,
      message: `Impor selesai: ${imported} baris Tujuan Pembelajaran berhasil disimpan${
        skipped > 0 ? ` (${skipped} baris dilewati)` : ""
      }!`,
      count: imported,
    };
  } catch (err: unknown) {
    console.error("[imporTpExcel Error]:", err);
    return {
      success: false,
      message:
        err instanceof Error
          ? err.message
          : "Gagal memproses berkas impor Excel Tujuan Pembelajaran.",
    };
  }
}
