"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { getSemesterAktif } from "@/lib/services/semester";

export type ActionResponse = {
  success: boolean;
  message: string;
};

export type RombelInput = {
  id?: string;
  nama: string;
  tingkat?: number;
  kurikulum?: string | null;
  waliKelasId?: string | null;
};

/**
 * Helper untuk menebak tingkat kelas (1 - 12) dari string nama rombel
 * Contoh: "1A" -> 1, "Kelas 5B" -> 5, "VI" -> 6, "XII MIPA 1" -> 12
 */
function extractTingkat(namaKelas: string): number {
  const clean = namaKelas.trim().toUpperCase();

  // Cek angka latin biasa di awal atau setelah kata "KELAS"
  const digitMatch = clean.match(/(?:KELAS\s*)?(\d{1,2})/i);
  if (digitMatch && digitMatch[1]) {
    const val = parseInt(digitMatch[1], 10);
    if (val >= 1 && val <= 12) return val;
  }

  // Cek angka romawi
  if (/^XII/i.test(clean)) return 12;
  if (/^XI/i.test(clean)) return 11;
  if (/^X/i.test(clean)) return 10;
  if (/^IX/i.test(clean)) return 9;
  if (/^VIII/i.test(clean)) return 8;
  if (/^VII/i.test(clean)) return 7;
  if (/^VI/i.test(clean)) return 6;
  if (/^V/i.test(clean)) return 5;
  if (/^IV/i.test(clean)) return 4;
  if (/^III/i.test(clean)) return 3;
  if (/^II/i.test(clean)) return 2;
  if (/^I/i.test(clean)) return 1;

  return 1; // Fallback jika tidak terdeteksi
}

/**
 * Tambah Rombel & Kelas Manual
 */
export async function createRombel(input: RombelInput): Promise<ActionResponse> {
  try {
    await requireRole("SUPERADMIN");

    const semester = await getSemesterAktif();
    if (!semester) {
      return { success: false, message: "Tidak ada semester aktif pada tahun ajaran ini." };
    }

    const nama = String(input.nama || "").trim().toUpperCase();
    if (!nama) {
      return { success: false, message: "Nama rombel / kelas wajib diisi (misal: 1A, 5B)." };
    }

    // Pastikan tidak ada rombel ganda di semester yang sama
    const existing = await db.rombel.findFirst({
      where: {
        semesterId: semester.id,
        nama: { equals: nama, mode: "insensitive" },
      },
    });

    if (existing) {
      return {
        success: false,
        message: `Rombel/Kelas "${nama}" sudah terdaftar pada semester aktif.`,
      };
    }

    const tingkat = input.tingkat && input.tingkat >= 1 && input.tingkat <= 12
      ? input.tingkat
      : extractTingkat(nama);

    const kurikulum = input.kurikulum?.trim() || "Kurikulum Merdeka";
    const waliKelasId = input.waliKelasId?.trim() || null;

    // Jika wali kelas dipilih, pastikan belum menjadi wali di kelas lain pada semester ini
    if (waliKelasId) {
      const existingWali = await db.rombel.findFirst({
        where: {
          semesterId: semester.id,
          waliKelasId,
        },
        include: { waliKelas: true },
      });

      if (existingWali) {
        // Bebaskan wali kelas dari kelas sebelumnya agar tidak bentrok
        await db.rombel.update({
          where: { id: existingWali.id },
          data: { waliKelasId: null },
        });
      }
    }

    await db.rombel.create({
      data: {
        semesterId: semester.id,
        nama,
        tingkat,
        kurikulum,
        waliKelasId,
      },
    });

    revalidatePath("/admin/master/rombel");
    revalidatePath("/admin/master/siswa");
    revalidatePath("/admin");

    return {
      success: true,
      message: `Rombel "${nama}" (Tingkat ${tingkat}) berhasil ditambahkan ke database!`,
    };
  } catch (err: unknown) {
    console.error("[createRombel Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal menambahkan data rombel.",
    };
  }
}

/**
 * Edit / Perbarui Data Rombel & Kelas
 */
export async function updateRombel(input: RombelInput): Promise<ActionResponse> {
  try {
    await requireRole("SUPERADMIN");

    if (!input.id) {
      return { success: false, message: "ID Rombel tidak ditemukan." };
    }

    const current = await db.rombel.findUnique({
      where: { id: input.id },
    });

    if (!current) {
      return { success: false, message: "Data rombel tidak ditemukan." };
    }

    const nama = String(input.nama || "").trim().toUpperCase();
    if (!nama) {
      return { success: false, message: "Nama rombel / kelas wajib diisi." };
    }

    // Periksa duplikasi nama jika nama diubah
    if (nama.toLowerCase() !== current.nama.toLowerCase()) {
      const duplicate = await db.rombel.findFirst({
        where: {
          semesterId: current.semesterId,
          nama: { equals: nama, mode: "insensitive" },
          id: { not: current.id },
        },
      });

      if (duplicate) {
        return {
          success: false,
          message: `Nama rombel "${nama}" sudah digunakan oleh kelas lain pada semester ini.`,
        };
      }
    }

    const tingkat = input.tingkat && input.tingkat >= 1 && input.tingkat <= 12
      ? input.tingkat
      : extractTingkat(nama);

    const kurikulum = input.kurikulum?.trim() || current.kurikulum || "Kurikulum Merdeka";
    const waliKelasId = input.waliKelasId?.trim() || null;

    // Jika wali kelas diubah dan bukan null, pastikan tidak bentrok
    if (waliKelasId && waliKelasId !== current.waliKelasId) {
      const existingWali = await db.rombel.findFirst({
        where: {
          semesterId: current.semesterId,
          waliKelasId,
          id: { not: current.id },
        },
      });

      if (existingWali) {
        await db.rombel.update({
          where: { id: existingWali.id },
          data: { waliKelasId: null },
        });
      }
    }

    await db.rombel.update({
      where: { id: current.id },
      data: {
        nama,
        tingkat,
        kurikulum,
        waliKelasId,
      },
    });

    revalidatePath("/admin/master/rombel");
    revalidatePath("/admin/master/siswa");
    revalidatePath("/admin");

    return {
      success: true,
      message: `Perubahan data rombel "${nama}" berhasil disimpan!`,
    };
  } catch (err: unknown) {
    console.error("[updateRombel Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal memperbarui data rombel.",
    };
  }
}

/**
 * Hapus Rombel & Kelas dari Database
 */
export async function deleteRombel(id: string): Promise<ActionResponse> {
  try {
    await requireRole("SUPERADMIN");

    const target = await db.rombel.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            anggota: true,
            pembelajaran: true,
            presensi: true,
          },
        },
      },
    });

    if (!target) {
      return { success: false, message: "Data rombel tidak ditemukan atau sudah dihapus." };
    }

    // Gunakan transaksi untuk membersihkan dependensi secara aman
    await db.$transaction(async (tx) => {
      // 1. Putuskan keterikatan jurnal jika ada
      await tx.jurnalPerkembangan.updateMany({
        where: { rombelId: id },
        data: { rombelId: null },
      });

      // 2. Hapus rombel (otomatis cascade menghapus anggotaRombel, pembelajaran, penilaian, nilai, dan presensi)
      await tx.rombel.delete({ where: { id } });
    });

    revalidatePath("/admin/master/rombel");
    revalidatePath("/admin/master/siswa");
    revalidatePath("/admin");

    return {
      success: true,
      message: `Rombel "${target.nama}" beserta riwayat kelas terkait berhasil dihapus dari database!`,
    };
  } catch (err: unknown) {
    console.error("[deleteRombel Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal menghapus data rombel.",
    };
  }
}

/**
 * Impor Data Rombel & Kelas dari Berkas Excel (.xlsx, .xls) atau CSV
 * Format kolom yang didukung:
 * Nama Kelas, Nama Wali Kelas (opsional)
 */
export async function importRombelFromFile(formData: FormData): Promise<ActionResponse> {
  try {
    await requireRole("SUPERADMIN");

    const semester = await getSemesterAktif();
    if (!semester) {
      return { success: false, message: "Tidak ada semester aktif pada tahun ajaran ini." };
    }

    const file = formData.get("file") as File | null;
    if (!file) {
      return { success: false, message: "Berkas tidak ditemukan. Silakan pilih berkas Excel atau CSV." };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileName = file.name.toLowerCase();

    // Ambil daftar GTK aktif untuk pencocokan nama wali kelas
    const allGtks = await db.gtk.findMany({
      select: {
        id: true,
        nama: true,
        nip: true,
        nuptk: true,
      },
    });

    type RowData = {
      namaKelas: string;
      waliKelasNama?: string;
    };

    const parsedRows: RowData[] = [];

    if (fileName.endsWith(".csv")) {
      const text = buffer.toString("utf-8");
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        return { success: false, message: "Berkas CSV kosong atau tidak memiliki data baris." };
      }

      // Deteksi separator (, atau ;)
      const firstLine = lines[0];
      const sep = firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";

      const headers = lines[0]
        .split(sep)
        .map((h) => h.replace(/^["'\s]+|["'\s]+$/g, "").toLowerCase().trim());

      const namaIdx = headers.findIndex((h) =>
        h.includes("nama kelas") || h === "kelas" || h.includes("rombel")
      );
      const waliIdx = headers.findIndex((h) =>
        h.includes("wali") || h.includes("nama wali")
      );

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        // Simple CSV splitter yang menghandle tanda kutip
        const cols: string[] = [];
        let curr = "";
        let inQuotes = false;
        for (let c = 0; c < line.length; c++) {
          const char = line[c];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === sep && !inQuotes) {
            cols.push(curr.trim());
            curr = "";
          } else {
            curr += char;
          }
        }
        cols.push(curr.trim());

        const nama = namaIdx >= 0 ? cols[namaIdx] || "" : cols[0] || "";
        const wali = waliIdx >= 0 ? cols[waliIdx] || "" : cols[1] || "";

        if (nama.trim()) {
          parsedRows.push({
            namaKelas: nama.trim().toUpperCase(),
            waliKelasNama: wali.trim(),
          });
        }
      }
    } else {
      // Parse file Excel .xlsx / .xls
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const sheet = workbook.worksheets[0];
      if (!sheet || sheet.rowCount < 2) {
        return { success: false, message: "Lembar kerja Excel kosong atau tidak memiliki data." };
      }

      const headerRow = sheet.getRow(1);
      const colMap: Record<string, number> = {};

      headerRow.eachCell((cell, colNumber) => {
        const val = String(cell.value || "").toLowerCase().trim();
        if (val.includes("nama kelas") || val === "kelas" || val.includes("rombel")) {
          colMap.namaKelas = colNumber;
        } else if (val.includes("wali")) {
          colMap.waliKelas = colNumber;
        }
      });

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;

        const namaRaw = colMap.namaKelas
          ? row.getCell(colMap.namaKelas).value
          : row.getCell(1).value;
        const waliRaw = colMap.waliKelas
          ? row.getCell(colMap.waliKelas).value
          : row.getCell(2).value;

        const nama = String(namaRaw || "").trim().toUpperCase();
        const wali = String(waliRaw || "").trim();

        if (nama) {
          parsedRows.push({
            namaKelas: nama,
            waliKelasNama: wali,
          });
        }
      });
    }

    if (parsedRows.length === 0) {
      return { success: false, message: "Tidak ada data rombel yang valid ditemukan dalam berkas." };
    }

    let createdCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      const nama = row.namaKelas;
      if (!nama) continue;

      const tingkat = extractTingkat(nama);

      // Cari ID Wali Kelas jika diisi
      let waliKelasId: string | null = null;
      if (row.waliKelasNama) {
        const searchWali = row.waliKelasNama.toLowerCase().trim();
        const matchedGtk = allGtks.find(
          (g) =>
            g.nama.toLowerCase().trim() === searchWali ||
            g.nama.toLowerCase().includes(searchWali) ||
            searchWali.includes(g.nama.toLowerCase()) ||
            (g.nip && g.nip === row.waliKelasNama) ||
            (g.nuptk && g.nuptk === row.waliKelasNama)
        );

        if (matchedGtk) {
          waliKelasId = matchedGtk.id;
        }
      }

      try {
        // Cek apakah rombel dengan nama ini sudah ada di semester aktif
        const existing = await db.rombel.findFirst({
          where: {
            semesterId: semester.id,
            nama: { equals: nama, mode: "insensitive" },
          },
        });

        if (existing) {
          await db.rombel.update({
            where: { id: existing.id },
            data: {
              tingkat,
              ...(waliKelasId ? { waliKelasId } : {}),
            },
          });
          updatedCount++;
        } else {
          await db.rombel.create({
            data: {
              semesterId: semester.id,
              nama,
              tingkat,
              kurikulum: "Kurikulum Merdeka",
              waliKelasId,
            },
          });
          createdCount++;
        }
      } catch (rowErr) {
        console.error(`[importRombel] Error on row ${i + 2}:`, rowErr);
        errors.push(`Baris ${i + 2} (${nama}): Gagal diproses`);
      }
    }

    revalidatePath("/admin/master/rombel");
    revalidatePath("/admin/master/siswa");
    revalidatePath("/admin");

    let summaryMsg = `Impor selesai: ${createdCount} rombel baru ditambahkan`;
    if (updatedCount > 0) summaryMsg += `, ${updatedCount} rombel diperbarui`;
    if (errors.length > 0) summaryMsg += `. Terdapat ${errors.length} baris dilewati.`;

    return {
      success: true,
      message: summaryMsg,
    };
  } catch (err: unknown) {
    console.error("[importRombelFromFile Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal mengimpor data rombel dari berkas.",
    };
  }
}
