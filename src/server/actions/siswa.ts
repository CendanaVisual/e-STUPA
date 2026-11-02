"use server";

import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { getSemesterAktif } from "@/lib/services/semester";

export type ActionResponse = {
  success: boolean;
  message: string;
};

export type MuridInput = {
  id?: string;
  noUrut?: number | null;
  nis?: string | null;
  nisn: string;
  nama: string;
  jenisKelamin: "L" | "P";
  agama?: string | null;
  rombelId?: string | null;
  kelasNama?: string | null;
  tempatLahir?: string | null;
  tanggalLahir?: string | null; // format YYYY-MM-DD
  alamat?: string | null;
  anakKe?: string | null;
  tahunMasuk?: string | null;
  namaAyah?: string | null;
  pekerjaanAyah?: string | null;
  namaIbu?: string | null;
  pekerjaanIbu?: string | null;
  namaWali?: string | null;
  kjp?: boolean;
  pip?: boolean;
  bantuanLain?: string | null;
  status?: "AKTIF" | "LULUS" | "PINDAH" | "KELUAR";
};

/**
 * Tambah Murid Manual
 */
export async function createMurid(input: MuridInput): Promise<ActionResponse> {
  try {
    await requireRole("SUPERADMIN");

    const nisn = String(input.nisn || "").trim();
    const nama = String(input.nama || "").trim();

    if (!nisn) {
      return { success: false, message: "NISN wajib diisi (10 digit)." };
    }
    if (!nama) {
      return { success: false, message: "Nama lengkap murid wajib diisi." };
    }

    // Cek duplikasi NISN
    const existing = await db.siswa.findUnique({
      where: { nisn },
      select: { id: true, nama: true },
    });
    if (existing) {
      return {
        success: false,
        message: `Murid dengan NISN ${nisn} sudah terdaftar atas nama "${existing.nama}".`,
      };
    }

    // Parsing tanggal lahir
    let tanggalLahirDate: Date | null = null;
    if (input.tanggalLahir) {
      const parsed = new Date(input.tanggalLahir);
      if (!isNaN(parsed.getTime())) {
        tanggalLahirDate = parsed;
      }
    }

    const jk: "L" | "P" =
      String(input.jenisKelamin || "L").toUpperCase().startsWith("P") ? "P" : "L";

    const statusMurid =
      input.status && ["AKTIF", "LULUS", "PINDAH", "KELUAR"].includes(input.status)
        ? input.status
        : "AKTIF";

    // Simpan ke db.siswa
    const newSiswa = await db.siswa.create({
      data: {
        nisn,
        nis: input.nis ? String(input.nis).trim() : null,
        nama,
        jenisKelamin: jk,
        agama: input.agama ? String(input.agama).trim() : null,
        tempatLahir: input.tempatLahir ? String(input.tempatLahir).trim() : null,
        tanggalLahir: tanggalLahirDate,
        alamat: input.alamat ? String(input.alamat).trim() : null,
        anakKe: input.anakKe ? String(input.anakKe).trim() : null,
        tahunMasuk: input.tahunMasuk ? String(input.tahunMasuk).trim() : null,
        namaAyah: input.namaAyah ? String(input.namaAyah).trim() : null,
        pekerjaanAyah: input.pekerjaanAyah ? String(input.pekerjaanAyah).trim() : null,
        namaIbu: input.namaIbu ? String(input.namaIbu).trim() : null,
        pekerjaanIbu: input.pekerjaanIbu ? String(input.pekerjaanIbu).trim() : null,
        namaWali: input.namaWali ? String(input.namaWali).trim() : null,
        kjp: Boolean(input.kjp),
        pip: Boolean(input.pip),
        bantuanLain: input.bantuanLain ? String(input.bantuanLain).trim() : null,
        status: statusMurid,
        isAktif: statusMurid === "AKTIF",
      },
    });

    // Hubungkan ke Rombel di semester aktif jika ada pilihan kelas
    const semesterAktif = await getSemesterAktif();
    if (semesterAktif && (input.rombelId || input.kelasNama)) {
      let targetRombelId = input.rombelId ? String(input.rombelId).trim() : null;

      if (!targetRombelId && input.kelasNama) {
        const cleanKelas = String(input.kelasNama).trim();
        let rombel = await db.rombel.findFirst({
          where: {
            semesterId: semesterAktif.id,
            nama: { equals: cleanKelas, mode: "insensitive" },
          },
        });

        if (!rombel) {
          const matchNum = cleanKelas.match(/\d+/);
          const tingkat = matchNum ? parseInt(matchNum[0], 10) : 1;
          rombel = await db.rombel.create({
            data: {
              semesterId: semesterAktif.id,
              nama: cleanKelas,
              tingkat: Math.min(Math.max(tingkat, 1), 12),
              kurikulum: "Kurikulum Merdeka",
            },
          });
        }
        targetRombelId = rombel.id;
      }

      if (targetRombelId) {
        await db.anggotaRombel.upsert({
          where: {
            semesterId_siswaId: {
              semesterId: semesterAktif.id,
              siswaId: newSiswa.id,
            },
          },
          update: {
            rombelId: targetRombelId,
            noAbsen: input.noUrut ? Number(input.noUrut) : null,
          },
          create: {
            semesterId: semesterAktif.id,
            rombelId: targetRombelId,
            siswaId: newSiswa.id,
            noAbsen: input.noUrut ? Number(input.noUrut) : null,
          },
        });
      }
    }

    revalidatePath("/admin/master/siswa");
    revalidatePath("/admin/master/rombel");
    return { success: true, message: `Data murid "${nama}" berhasil disimpan.` };
  } catch (err: unknown) {
    console.error("[createMurid Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal menambahkan murid.",
    };
  }
}

/**
 * Edit Data Murid
 */
export async function updateMurid(input: MuridInput): Promise<ActionResponse> {
  try {
    await requireRole("SUPERADMIN");

    if (!input.id) {
      return { success: false, message: "ID murid tidak valid." };
    }

    const nisn = String(input.nisn || "").trim();
    const nama = String(input.nama || "").trim();

    if (!nisn) {
      return { success: false, message: "NISN wajib diisi." };
    }
    if (!nama) {
      return { success: false, message: "Nama lengkap murid wajib diisi." };
    }

    // Pastikan NISN tidak konflik dengan murid lain
    const conflict = await db.siswa.findFirst({
      where: {
        nisn,
        id: { not: input.id },
      },
    });
    if (conflict) {
      return {
        success: false,
        message: `NISN ${nisn} sudah digunakan oleh murid lain ("${conflict.nama}").`,
      };
    }

    let tanggalLahirDate: Date | null = null;
    if (input.tanggalLahir) {
      const parsed = new Date(input.tanggalLahir);
      if (!isNaN(parsed.getTime())) {
        tanggalLahirDate = parsed;
      }
    }

    const jk: "L" | "P" =
      String(input.jenisKelamin || "L").toUpperCase().startsWith("P") ? "P" : "L";

    const statusMurid =
      input.status && ["AKTIF", "LULUS", "PINDAH", "KELUAR"].includes(input.status)
        ? input.status
        : "AKTIF";

    await db.siswa.update({
      where: { id: input.id },
      data: {
        nisn,
        nis: input.nis ? String(input.nis).trim() : null,
        nama,
        jenisKelamin: jk,
        agama: input.agama ? String(input.agama).trim() : null,
        tempatLahir: input.tempatLahir ? String(input.tempatLahir).trim() : null,
        tanggalLahir: tanggalLahirDate,
        alamat: input.alamat ? String(input.alamat).trim() : null,
        anakKe: input.anakKe ? String(input.anakKe).trim() : null,
        tahunMasuk: input.tahunMasuk ? String(input.tahunMasuk).trim() : null,
        namaAyah: input.namaAyah ? String(input.namaAyah).trim() : null,
        pekerjaanAyah: input.pekerjaanAyah ? String(input.pekerjaanAyah).trim() : null,
        namaIbu: input.namaIbu ? String(input.namaIbu).trim() : null,
        pekerjaanIbu: input.pekerjaanIbu ? String(input.pekerjaanIbu).trim() : null,
        namaWali: input.namaWali ? String(input.namaWali).trim() : null,
        kjp: Boolean(input.kjp),
        pip: Boolean(input.pip),
        bantuanLain: input.bantuanLain ? String(input.bantuanLain).trim() : null,
        status: statusMurid,
        isAktif: statusMurid === "AKTIF",
      },
    });

    // Update AnggotaRombel jika ada rombel yang dipilih
    const semesterAktif = await getSemesterAktif();
    if (semesterAktif) {
      let targetRombelId = input.rombelId ? String(input.rombelId).trim() : null;

      if (!targetRombelId && input.kelasNama) {
        const cleanKelas = String(input.kelasNama).trim();
        let rombel = await db.rombel.findFirst({
          where: {
            semesterId: semesterAktif.id,
            nama: { equals: cleanKelas, mode: "insensitive" },
          },
        });

        if (!rombel) {
          const matchNum = cleanKelas.match(/\d+/);
          const tingkat = matchNum ? parseInt(matchNum[0], 10) : 1;
          rombel = await db.rombel.create({
            data: {
              semesterId: semesterAktif.id,
              nama: cleanKelas,
              tingkat: Math.min(Math.max(tingkat, 1), 12),
              kurikulum: "Kurikulum Merdeka",
            },
          });
        }
        targetRombelId = rombel.id;
      }

      if (targetRombelId) {
        await db.anggotaRombel.upsert({
          where: {
            semesterId_siswaId: {
              semesterId: semesterAktif.id,
              siswaId: input.id,
            },
          },
          update: {
            rombelId: targetRombelId,
            noAbsen: input.noUrut ? Number(input.noUrut) : null,
          },
          create: {
            semesterId: semesterAktif.id,
            rombelId: targetRombelId,
            siswaId: input.id,
            noAbsen: input.noUrut ? Number(input.noUrut) : null,
          },
        });
      } else if (input.rombelId === "") {
        // Hapus keanggotaan rombel semester ini jika dikosongkan
        await db.anggotaRombel.deleteMany({
          where: {
            semesterId: semesterAktif.id,
            siswaId: input.id,
          },
        });
      }
    }

    revalidatePath("/admin/master/siswa");
    revalidatePath("/admin/master/rombel");
    return { success: true, message: `Data murid "${nama}" berhasil diperbarui.` };
  } catch (err: unknown) {
    console.error("[updateMurid Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal memperbarui data murid.",
    };
  }
}

/**
 * Hapus Data Murid dari Database
 */
export async function deleteMurid(siswaId: string): Promise<ActionResponse> {
  try {
    await requireRole("SUPERADMIN");

    if (!siswaId) {
      return { success: false, message: "ID murid tidak valid." };
    }

    const target = await db.siswa.findUnique({
      where: { id: siswaId },
      select: { id: true, nama: true, nisn: true },
    });
    if (!target) {
      return { success: false, message: "Data murid tidak ditemukan." };
    }

    await db.siswa.delete({
      where: { id: siswaId },
    });

    revalidatePath("/admin/master/siswa");
    revalidatePath("/admin/master/rombel");
    return {
      success: true,
      message: `Data murid "${target.nama}" (NISN: ${target.nisn}) berhasil dihapus dari database.`,
    };
  } catch (err: unknown) {
    console.error("[deleteMurid Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal menghapus murid.",
    };
  }
}

/**
 * Impor Murid Batch dari data Excel / CSV
 */
export async function importMuridBatch(
  rows: Array<Record<string, unknown>>
): Promise<{
  success: boolean;
  message: string;
  total: number;
  added: number;
  updated: number;
  failed: number;
  errors: string[];
}> {
  try {
    await requireRole("SUPERADMIN");

    if (!rows || rows.length === 0) {
      return {
        success: false,
        message: "Tidak ada baris data yang ditemukan.",
        total: 0,
        added: 0,
        updated: 0,
        failed: 0,
        errors: ["File tidak memiliki baris data."],
      };
    }

    const semesterAktif = await getSemesterAktif();
    let added = 0;
    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    // Helper boolean parsing ("Ya", "Y", "1", "true")
    const isYa = (v: unknown) =>
      ["ya", "y", "true", "1", "yes"].includes(String(v ?? "").trim().toLowerCase());

    // Cache rombel agar hemat query
    const rombelMap = new Map<string, string>();
    if (semesterAktif) {
      const existingRombels = await db.rombel.findMany({
        where: { semesterId: semesterAktif.id },
      });
      existingRombels.forEach((r) => rombelMap.set(r.nama.toLowerCase(), r.id));
    }

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const barisNum = i + 2;

      // Pencocokan kolom fleksibel (mendukung berbagai format penulisan header)
      const findVal = (possibleKeys: string[]) => {
        for (const k of possibleKeys) {
          if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== "") {
            return String(r[k]).trim();
          }
          // Cek case-insensitive
          const foundKey = Object.keys(r).find(
            (actualKey) => actualKey.toLowerCase() === k.toLowerCase()
          );
          if (
            foundKey &&
            r[foundKey] !== undefined &&
            r[foundKey] !== null &&
            String(r[foundKey]).trim() !== ""
          ) {
            return String(r[foundKey]).trim();
          }
        }
        return "";
      };

      const nisn = findVal(["NISN", "nisn"]);
      const nama = findVal(["Nama", "Nama Murid", "Nama Lengkap", "nama"]);
      const nis = findVal(["NIS", "nis", "NIPD"]);
      const noUrutStr = findVal(["No Urut", "No", "No.", "No Absen", "Nomor Absen"]);
      const noUrut = noUrutStr ? parseInt(noUrutStr, 10) : null;
      const jkStr = findVal(["L/P", "Jenis Kelamin", "JK"]);
      const jk: "L" | "P" = jkStr.toUpperCase().startsWith("P") ? "P" : "L";
      const agama = findVal(["Agama", "agama"]);
      const kelas = findVal(["Kelas", "Rombel", "Rombongan Belajar"]);
      const tempatLahir = findVal(["Tempat Lahir", "tempat_lahir"]);
      const tglLahirStr = findVal([
        "Tanggal Lahir (YYYY-MM-DD)",
        "Tanggal Lahir",
        "Tgl Lahir",
        "tanggal_lahir",
      ]);
      const alamat = findVal(["Alamat", "alamat", "Alamat Tinggal"]);
      const anakKe = findVal(["Anak Ke", "Anak Ke-", "anak_ke"]);
      const tahunMasuk = findVal(["Tahun Masuk", "tahun_masuk"]);
      const namaAyah = findVal(["Nama Ayah", "Ayah"]);
      const pekerjaanAyah = findVal(["Pekerjaan Ayah"]);
      const namaIbu = findVal(["Nama Ibu", "Ibu"]);
      const pekerjaanIbu = findVal(["Pekerjaan Ibu"]);
      const kjpVal = findVal(["KJP (Ya/Tidak)", "KJP", "kjp"]);
      const pipVal = findVal(["PIP (Ya/Tidak)", "PIP", "pip"]);
      const bantuanLain = findVal(["Bantuan Lain", "Bantuan Lainnya"]);
      const statusRaw = findVal(["Status", "status"]).toUpperCase();

      if (!nama) {
        failed++;
        errors.push(`Baris ${barisNum}: Nama murid kosong, baris dilewati.`);
        continue;
      }

      if (!nisn) {
        failed++;
        errors.push(`Baris ${barisNum}: NISN untuk "${nama}" kosong.`);
        continue;
      }

      // Parsing Tanggal Lahir
      let tanggalLahirDate: Date | null = null;
      if (tglLahirStr) {
        const parsed = new Date(tglLahirStr);
        if (!isNaN(parsed.getTime())) {
          tanggalLahirDate = parsed;
        }
      }

      let statusMurid: "AKTIF" | "LULUS" | "PINDAH" | "KELUAR" = "AKTIF";
      if (statusRaw.includes("LULUS")) statusMurid = "LULUS";
      else if (statusRaw.includes("PINDAH") || statusRaw.includes("MUTASI")) statusMurid = "PINDAH";
      else if (statusRaw.includes("KELUAR") || statusRaw.includes("NONAKTIF")) statusMurid = "KELUAR";

      const payload = {
        nama,
        nis: nis || null,
        jenisKelamin: jk,
        agama: agama || null,
        tempatLahir: tempatLahir || null,
        tanggalLahir: tanggalLahirDate,
        alamat: alamat || null,
        anakKe: anakKe || null,
        tahunMasuk: tahunMasuk || null,
        namaAyah: namaAyah || null,
        pekerjaanAyah: pekerjaanAyah || null,
        namaIbu: namaIbu || null,
        pekerjaanIbu: pekerjaanIbu || null,
        kjp: isYa(kjpVal),
        pip: isYa(pipVal),
        bantuanLain: bantuanLain || null,
        status: statusMurid,
        isAktif: statusMurid === "AKTIF",
      };

      const existing = await db.siswa.findUnique({
        where: { nisn },
        select: { id: true },
      });

      let siswaId: string;
      if (existing) {
        const updatedSiswa = await db.siswa.update({
          where: { nisn },
          data: payload,
        });
        siswaId = updatedSiswa.id;
        updated++;
      } else {
        const newSiswa = await db.siswa.create({
          data: {
            nisn,
            ...payload,
          },
        });
        siswaId = newSiswa.id;
        added++;
      }

      // Hubungkan ke Rombel jika kelas ditentukan dan ada semester aktif
      if (semesterAktif && kelas) {
        const kelasLower = kelas.toLowerCase();
        let targetRombelId = rombelMap.get(kelasLower);

        if (!targetRombelId) {
          const matchNum = kelas.match(/\d+/);
          const tingkat = matchNum ? parseInt(matchNum[0], 10) : 1;
          const newRombel = await db.rombel.create({
            data: {
              semesterId: semesterAktif.id,
              nama: kelas,
              tingkat: Math.min(Math.max(tingkat, 1), 12),
              kurikulum: "Kurikulum Merdeka",
            },
          });
          targetRombelId = newRombel.id;
          rombelMap.set(kelasLower, newRombel.id);
        }

        await db.anggotaRombel.upsert({
          where: {
            semesterId_siswaId: {
              semesterId: semesterAktif.id,
              siswaId,
            },
          },
          update: {
            rombelId: targetRombelId,
            noAbsen: noUrut || null,
          },
          create: {
            semesterId: semesterAktif.id,
            rombelId: targetRombelId,
            siswaId,
            noAbsen: noUrut || null,
          },
        });
      }
    }

    revalidatePath("/admin/master/siswa");
    revalidatePath("/admin/master/rombel");

    return {
      success: added > 0 || updated > 0,
      message: `Proses impor selesai: ${added} murid baru ditambahkan, ${updated} diperbarui, ${failed} gagal/dilewati.`,
      total: rows.length,
      added,
      updated,
      failed,
      errors: errors.slice(0, 10),
    };
  } catch (err: unknown) {
    console.error("[importMuridBatch Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal mengimpor data murid.",
      total: rows.length,
      added: 0,
      updated: 0,
      failed: rows.length,
      errors: [err instanceof Error ? err.message : "Terjadi kesalahan internal server."],
    };
  }
}

/**
 * Impor File Excel (.xlsx) atau CSV (.csv) langsung dari FormData
 */
export async function importMuridFromFile(formData: FormData): Promise<{
  success: boolean;
  message: string;
  total: number;
  added: number;
  updated: number;
  failed: number;
  errors: string[];
}> {
  try {
    await requireRole("SUPERADMIN");

    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) {
      return {
        success: false,
        message: "Pilih file Excel (.xlsx) atau CSV (.csv) terlebih dahulu.",
        total: 0,
        added: 0,
        updated: 0,
        failed: 0,
        errors: ["Tidak ada file yang diunggah."],
      };
    }

    const fileName = file.name.toLowerCase();
    const buffer = await file.arrayBuffer();
    const rows: Array<Record<string, unknown>> = [];

    if (fileName.endsWith(".csv")) {
      const text = new TextDecoder("utf-8").decode(buffer);
      const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
      if (lines.length <= 1) {
        return {
          success: false,
          message: "File CSV tidak memiliki baris data.",
          total: 0,
          added: 0,
          updated: 0,
          failed: 0,
          errors: ["File CSV hanya berisi header atau kosong."],
        };
      }

      // Simple CSV parser supporting quotes
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let cur = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
              cur += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === "," && !inQuotes) {
            result.push(cur.trim());
            cur = "";
          } else {
            cur += char;
          }
        }
        result.push(cur.trim());
        return result;
      };

      const headers = parseCSVLine(lines[0]);
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const rowObj: Record<string, unknown> = {};
        headers.forEach((h, idx) => {
          rowObj[h] = values[idx] || "";
        });
        rows.push(rowObj);
      }
    } else {
      // Excel .xlsx / .xls
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        return {
          success: false,
          message: "Lembar kerja Excel kosong.",
          total: 0,
          added: 0,
          updated: 0,
          failed: 0,
          errors: ["Worksheet pertama tidak ditemukan."],
        };
      }

      let headers: string[] = [];
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        const values = (row.values as unknown[]) || [];
        // ExcelJS row.values is 1-indexed (index 0 is empty)
        const cleanValues = values.slice(1).map((v) => {
          if (v === null || v === undefined) return "";
          if (v instanceof Date) return v.toISOString().slice(0, 10);
          if (typeof v === "object" && "text" in v) return String((v as { text: unknown }).text).trim();
          if (typeof v === "object" && "result" in v) return String((v as { result: unknown }).result ?? "").trim();
          return String(v).trim();
        });

        if (rowNumber === 1) {
          headers = cleanValues;
        } else if (headers.length > 0) {
          const rowObj: Record<string, unknown> = {};
          headers.forEach((h, idx) => {
            rowObj[h] = cleanValues[idx] || "";
          });
          rows.push(rowObj);
        }
      });
    }

    return await importMuridBatch(rows);
  } catch (err: unknown) {
    console.error("[importMuridFromFile Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal memproses file.",
      total: 0,
      added: 0,
      updated: 0,
      failed: 0,
      errors: [err instanceof Error ? err.message : "Format file tidak valid atau rusak."],
    };
  }
}

