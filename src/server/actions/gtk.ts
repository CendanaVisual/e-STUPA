"use server";

import bcrypt from "bcryptjs";
import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { getSemesterAktif } from "@/lib/services/semester";

export type ActionResponse = {
  success: boolean;
  message: string;
};

export type GtkInput = {
  id?: string;
  nama: string;
  nip?: string | null;
  nuptk?: string | null;
  nik?: string | null;
  jenisKelamin?: "L" | "P" | null;
  jenisPtk?: string | null;
  statusKepegawaian?: string | null;
  email?: string | null;
  noHp?: string | null;
  isAktif?: boolean;
  // Akun Login Opsional
  createAccount?: boolean;
  username?: string | null;
  password?: string | null;
  // Penugasan Mengajar Opsional (Semester Aktif)
  waliKelasRombelId?: string | null;
  mapelIds?: string[];
};

/**
 * Tambah GTK / Guru Manual
 */
export async function createGtk(input: GtkInput): Promise<ActionResponse> {
  try {
    await requireRole("SUPERADMIN");

    const nama = String(input.nama || "").trim();
    if (!nama) {
      return { success: false, message: "Nama lengkap GTK wajib diisi." };
    }

    const nip = input.nip ? String(input.nip).trim() : null;
    const nuptk = input.nuptk ? String(input.nuptk).trim() : null;

    // Cek duplikasi NUPTK / NIP jika diisi
    if (nuptk) {
      const existingNuptk = await db.gtk.findFirst({
        where: { nuptk },
        select: { id: true, nama: true },
      });
      if (existingNuptk) {
        return {
          success: false,
          message: `NUPTK ${nuptk} sudah terdaftar atas nama "${existingNuptk.nama}".`,
        };
      }
    }

    if (nip) {
      const existingNip = await db.gtk.findFirst({
        where: { nip },
        select: { id: true, nama: true },
      });
      if (existingNip) {
        return {
          success: false,
          message: `NIP ${nip} sudah terdaftar atas nama "${existingNip.nama}".`,
        };
      }
    }

    const newGtk = await db.gtk.create({
      data: {
        nama,
        nip,
        nuptk,
        nik: input.nik ? String(input.nik).trim() : null,
        jenisKelamin: input.jenisKelamin || null,
        jenisPtk: input.jenisPtk ? String(input.jenisPtk).trim() : "Guru Mapel",
        statusKepegawaian: input.statusKepegawaian
          ? String(input.statusKepegawaian).trim()
          : "PNS / PPPK",
        email: input.email ? String(input.email).trim() : null,
        noHp: input.noHp ? String(input.noHp).trim() : null,
        isAktif: input.isAktif !== undefined ? input.isAktif : true,
      },
    });

    // Buat Akun Login jika diminta
    if (input.createAccount && input.username && input.password) {
      const username = input.username.trim().toLowerCase();
      const password = input.password.trim();

      if (username.length >= 3 && password.length >= 6) {
        const existingUser = await db.user.findFirst({
          where: { username: { equals: username, mode: "insensitive" } },
        });

        if (!existingUser) {
          const passwordHash = await bcrypt.hash(password, 12);
          await db.user.create({
            data: {
              username,
              passwordHash,
              role: "GURU",
              gtkId: newGtk.id,
              isActive: true,
            },
          });
        }
      }
    }

    // Set Wali Kelas jika ada pilihan rombel
    const semesterAktif = await getSemesterAktif();
    if (semesterAktif && input.waliKelasRombelId) {
      await db.rombel.update({
        where: { id: input.waliKelasRombelId },
        data: { waliKelasId: newGtk.id },
      });
    }

    // Tambah penugasan mapel jika ada
    if (semesterAktif && input.waliKelasRombelId && input.mapelIds && input.mapelIds.length > 0) {
      for (const mapelId of input.mapelIds) {
        await db.pembelajaran.upsert({
          where: {
            rombelId_mapelId: {
              rombelId: input.waliKelasRombelId,
              mapelId,
            },
          },
          update: {
            gtkId: newGtk.id,
          },
          create: {
            semesterId: semesterAktif.id,
            rombelId: input.waliKelasRombelId,
            mapelId,
            gtkId: newGtk.id,
          },
        });
      }
    }

    revalidatePath("/admin/master/gtk");
    revalidatePath("/admin/users");
    return { success: true, message: `Data GTK "${nama}" berhasil disimpan.` };
  } catch (err: unknown) {
    console.error("[createGtk Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal menambahkan data GTK.",
    };
  }
}

/**
 * Edit / Update Data GTK
 */
export async function updateGtk(input: GtkInput): Promise<ActionResponse> {
  try {
    await requireRole("SUPERADMIN");

    if (!input.id) {
      return { success: false, message: "ID GTK tidak valid." };
    }

    const nama = String(input.nama || "").trim();
    if (!nama) {
      return { success: false, message: "Nama lengkap GTK wajib diisi." };
    }

    const nip = input.nip ? String(input.nip).trim() : null;
    const nuptk = input.nuptk ? String(input.nuptk).trim() : null;

    if (nuptk) {
      const conflict = await db.gtk.findFirst({
        where: {
          nuptk,
          id: { not: input.id },
        },
      });
      if (conflict) {
        return {
          success: false,
          message: `NUPTK ${nuptk} sudah digunakan oleh "${conflict.nama}".`,
        };
      }
    }

    if (nip) {
      const conflict = await db.gtk.findFirst({
        where: {
          nip,
          id: { not: input.id },
        },
      });
      if (conflict) {
        return {
          success: false,
          message: `NIP ${nip} sudah digunakan oleh "${conflict.nama}".`,
        };
      }
    }

    await db.gtk.update({
      where: { id: input.id },
      data: {
        nama,
        nip,
        nuptk,
        nik: input.nik ? String(input.nik).trim() : null,
        jenisKelamin: input.jenisKelamin || null,
        jenisPtk: input.jenisPtk ? String(input.jenisPtk).trim() : null,
        statusKepegawaian: input.statusKepegawaian
          ? String(input.statusKepegawaian).trim()
          : null,
        email: input.email ? String(input.email).trim() : null,
        noHp: input.noHp ? String(input.noHp).trim() : null,
        isAktif: input.isAktif !== undefined ? input.isAktif : true,
      },
    });

    // Jika ada update akun login (username / password)
    if (input.username) {
      const username = input.username.trim().toLowerCase();
      const existingUser = await db.user.findFirst({
        where: { gtkId: input.id },
      });

      if (existingUser) {
        const updateData: { username: string; passwordHash?: string } = { username };
        if (input.password && input.password.trim().length >= 6) {
          updateData.passwordHash = await bcrypt.hash(input.password.trim(), 12);
        }
        await db.user.update({
          where: { id: existingUser.id },
          data: updateData,
        });
      } else if (input.password && input.password.trim().length >= 6) {
        const passwordHash = await bcrypt.hash(input.password.trim(), 12);
        await db.user.create({
          data: {
            username,
            passwordHash,
            role: "GURU",
            gtkId: input.id,
            isActive: true,
          },
        });
      }
    }

    // Set / Ubah Wali Kelas jika dipilih
    const semesterAktif = await getSemesterAktif();
    if (semesterAktif && input.waliKelasRombelId !== undefined) {
      // Hapus status wali kelas lama di rombel lain
      await db.rombel.updateMany({
        where: { semesterId: semesterAktif.id, waliKelasId: input.id },
        data: { waliKelasId: null },
      });

      if (input.waliKelasRombelId) {
        await db.rombel.update({
          where: { id: input.waliKelasRombelId },
          data: { waliKelasId: input.id },
        });
      }
    }

    revalidatePath("/admin/master/gtk");
    revalidatePath("/admin/users");
    return { success: true, message: `Data GTK "${nama}" berhasil diperbarui.` };
  } catch (err: unknown) {
    console.error("[updateGtk Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal memperbarui data GTK.",
    };
  }
}

/**
 * Hapus Data GTK dari Database (Beserta Akun & Penugasan Mengajar)
 */
export async function deleteGtk(gtkId: string): Promise<ActionResponse> {
  try {
    await requireRole("SUPERADMIN");

    if (!gtkId) {
      return { success: false, message: "ID GTK tidak valid." };
    }

    const target = await db.gtk.findUnique({
      where: { id: gtkId },
      select: { id: true, nama: true },
    });
    if (!target) {
      return { success: false, message: "Data GTK tidak ditemukan." };
    }

    // 1. Lepaskan jabatan wali kelas
    await db.rombel.updateMany({
      where: { waliKelasId: gtkId },
      data: { waliKelasId: null },
    });

    // 2. Lepaskan guru BK
    await db.bimbinganKonseling.updateMany({
      where: { guruBkId: gtkId },
      data: { guruBkId: null },
    });

    // 3. Hapus penugasan pembelajaran mengajar terlebih dahulu (menghindari Restrict foreign key)
    await db.pembelajaran.deleteMany({
      where: { gtkId },
    });

    // 4. Hapus akun pengguna yang ditautkan ke GTK ini
    await db.user.deleteMany({
      where: { gtkId },
    });

    // 5. Hapus GTK dari database
    await db.gtk.delete({
      where: { id: gtkId },
    });

    revalidatePath("/admin/master/gtk");
    revalidatePath("/admin/users");
    return {
      success: true,
      message: `Data GTK "${target.nama}" beserta akun login terkait berhasil dihapus dari database.`,
    };
  } catch (err: unknown) {
    console.error("[deleteGtk Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal menghapus data GTK.",
    };
  }
}

/**
 * Impor Data GTK / Guru dari File Excel (.xlsx) atau CSV (.csv)
 * Format Kolom: Nama, NIP, Username, Password, Kelas Diampu (opsional), Mapel Diampu (pisahkan koma)
 */
export async function importGtkFromFile(formData: FormData): Promise<{
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
        message: "Pilih berkas Excel (.xlsx) atau CSV (.csv) terlebih dahulu.",
        total: 0,
        added: 0,
        updated: 0,
        failed: 0,
        errors: ["Tidak ada berkas yang diunggah."],
      };
    }

    const fileName = file.name.toLowerCase();
    const buffer = await file.arrayBuffer();
    const rows: Array<Record<string, unknown>> = [];

    if (fileName.endsWith(".csv")) {
      const text = new TextDecoder("utf-8").decode(buffer);
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length <= 1) {
        return {
          success: false,
          message: "Berkas CSV tidak memiliki baris data.",
          total: 0,
          added: 0,
          updated: 0,
          failed: 0,
          errors: ["Berkas kosong."],
        };
      }

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
        const cleanValues = values.slice(1).map((v) => {
          if (v === null || v === undefined) return "";
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

    if (rows.length === 0) {
      return {
        success: false,
        message: "Tidak ada baris data yang ditemukan.",
        total: 0,
        added: 0,
        updated: 0,
        failed: 0,
        errors: ["Data kosong."],
      };
    }

    const semesterAktif = await getSemesterAktif();
    let added = 0;
    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    // Cache Mapel & Rombel
    const allMapels = await db.mapel.findMany();
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

      const findVal = (keys: string[]) => {
        for (const k of keys) {
          if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== "") {
            return String(r[k]).trim();
          }
          const foundKey = Object.keys(r).find((ak) => ak.toLowerCase() === k.toLowerCase());
          if (foundKey && r[foundKey] !== undefined && r[foundKey] !== null && String(r[foundKey]).trim() !== "") {
            return String(r[foundKey]).trim();
          }
        }
        return "";
      };

      const nama = findVal(["Nama", "Nama Lengkap", "Nama Guru"]);
      const nip = findVal(["NIP", "nip"]);
      const username = findVal(["Username", "Akun", "User", "username"]).toLowerCase();
      const password = findVal(["Password", "Kata Sandi", "pass"]) || "guru123456";
      const kelasDiampu = findVal(["Kelas Diampu (opsional)", "Kelas Diampu", "Kelas", "Rombel"]);
      const mapelDiampuStr = findVal(["Mapel Diampu (pisahkan koma)", "Mapel Diampu", "Mapel"]);

      if (!nama) {
        failed++;
        errors.push(`Baris ${barisNum}: Nama guru / GTK kosong.`);
        continue;
      }

      // Upsert GTK berdasarkan NIP (jika ada) atau Nama
      let existingGtk = nip ? await db.gtk.findFirst({ where: { nip } }) : null;
      if (!existingGtk) {
        existingGtk = await db.gtk.findFirst({
          where: { nama: { equals: nama, mode: "insensitive" } },
        });
      }

      let gtkId: string;
      if (existingGtk) {
        const uRecord = await db.gtk.update({
          where: { id: existingGtk.id },
          data: {
            nama,
            nip: nip || existingGtk.nip,
            isAktif: true,
          },
        });
        gtkId = uRecord.id;
        updated++;
      } else {
        const cRecord = await db.gtk.create({
          data: {
            nama,
            nip: nip || null,
            jenisPtk: "Guru Mapel",
            statusKepegawaian: "PNS / PPPK",
            isAktif: true,
          },
        });
        gtkId = cRecord.id;
        added++;
      }

      // Buat atau Update Akun Login User
      if (username) {
        const existingUser = await db.user.findFirst({
          where: { username: { equals: username, mode: "insensitive" } },
        });

        const passwordHash = await bcrypt.hash(password, 12);
        if (existingUser) {
          await db.user.update({
            where: { id: existingUser.id },
            data: {
              gtkId,
              passwordHash,
              isActive: true,
            },
          });
        } else {
          await db.user.create({
            data: {
              username,
              passwordHash,
              role: "GURU",
              gtkId,
              isActive: true,
            },
          });
        }
      }

      // Set Wali Kelas jika kelas diampu diisi
      if (semesterAktif && kelasDiampu) {
        const kelasLower = kelasDiampu.toLowerCase();
        let targetRombelId = rombelMap.get(kelasLower);

        if (!targetRombelId) {
          const matchNum = kelasDiampu.match(/\d+/);
          const tingkat = matchNum ? parseInt(matchNum[0], 10) : 1;
          const newRombel = await db.rombel.create({
            data: {
              semesterId: semesterAktif.id,
              nama: kelasDiampu,
              tingkat: Math.min(Math.max(tingkat, 1), 12),
              waliKelasId: gtkId,
            },
          });
          targetRombelId = newRombel.id;
          rombelMap.set(kelasLower, newRombel.id);
        } else {
          await db.rombel.update({
            where: { id: targetRombelId },
            data: { waliKelasId: gtkId },
          });
        }

        // Hubungkan Penugasan Mapel jika diisi
        if (mapelDiampuStr && targetRombelId) {
          const mapelNames = mapelDiampuStr.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
          for (const mName of mapelNames) {
            const matchedMapel = allMapels.find(
              (m) => m.nama.toLowerCase().includes(mName) || m.kode.toLowerCase() === mName
            );
            if (matchedMapel) {
              await db.pembelajaran.upsert({
                where: {
                  rombelId_mapelId: {
                    rombelId: targetRombelId,
                    mapelId: matchedMapel.id,
                  },
                },
                update: {
                  gtkId,
                },
                create: {
                  semesterId: semesterAktif.id,
                  rombelId: targetRombelId,
                  mapelId: matchedMapel.id,
                  gtkId,
                },
              });
            }
          }
        }
      }
    }

    revalidatePath("/admin/master/gtk");
    revalidatePath("/admin/users");
    revalidatePath("/admin/master/rombel");

    return {
      success: added > 0 || updated > 0,
      message: `Impor GTK selesai: ${added} GTK baru ditambahkan, ${updated} diperbarui, ${failed} dilewati.`,
      total: rows.length,
      added,
      updated,
      failed,
      errors: errors.slice(0, 10),
    };
  } catch (err: unknown) {
    console.error("[importGtkFromFile Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal mengimpor file GTK.",
      total: 0,
      added: 0,
      updated: 0,
      failed: 0,
      errors: [err instanceof Error ? err.message : "Terjadi kesalahan internal server."],
    };
  }
}
