"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { getSemesterAktif } from "@/lib/services/semester";

export type ActionResponse = {
  success: boolean;
  message: string;
  data?: any;
};

/**
 * 1. BACKUP 1 SEMESTER PENUH
 * Mengambil seluruh data pada semester aktif ke paket JSON terstruktur
 */
export async function backupSemesterFull(targetSemesterId?: string): Promise<ActionResponse> {
  try {
    const session = await requireRole("SUPERADMIN");
    const activeSem = await getSemesterAktif();
    const semesterId = targetSemesterId || activeSem?.id;

    if (!semesterId) {
      return { success: false, message: "Tidak ada semester aktif untuk dicadangkan." };
    }

    const semester = await db.semester.findUnique({
      where: { id: semesterId },
      include: { tahunAjaran: true },
    });

    if (!semester) {
      return { success: false, message: "Data semester tidak ditemukan." };
    }

    // Ambil data seluruh entitas semester
    const [
      rombels,
      pembelajarans,
      presensis,
      jurnals,
      bks,
      prestasis,
      nilaiEkskuls,
      kalenders,
      arsips,
    ] = await Promise.all([
      db.rombel.findMany({
        where: { semesterId },
        include: {
          anggota: {
            include: {
              siswa: true,
            },
          },
        },
      }),
      db.pembelajaran.findMany({
        where: { semesterId },
        include: {
          mapel: true,
          gtk: true,
          penilaian: {
            include: {
              nilai: true,
            },
          },
          nilaiRapor: true,
        },
      }),
      db.presensi.findMany({ where: { semesterId } }),
      db.jurnalPerkembangan.findMany({ where: { semesterId } }),
      db.bimbinganKonseling.findMany({ where: { semesterId } }),
      db.prestasiSiswa.findMany({ where: { semesterId } }),
      db.nilaiEkskul.findMany({ where: { semesterId } }),
      db.kalenderAkademik.findMany({ where: { semesterId } }),
      db.arsipNilai.findMany({ where: { semesterId } }),
    ]);

    const totalBaris =
      rombels.length +
      pembelajarans.length +
      presensis.length +
      jurnals.length +
      bks.length +
      prestasis.length +
      nilaiEkskuls.length +
      kalenders.length +
      arsips.length;

    const backupPackage = {
      app: "e-STUPA",
      version: "2.0",
      type: "SEMESTER_FULL",
      createdAt: new Date().toISOString(),
      createdByName: session.username,
      semester: {
        id: semester.id,
        kode: semester.kode,
        tipe: semester.tipe,
        tahunAjaran: semester.tahunAjaran.nama,
      },
      counts: {
        rombel: rombels.length,
        pembelajaran: pembelajarans.length,
        presensi: presensis.length,
        jurnal: jurnals.length,
        bk: bks.length,
        prestasi: prestasis.length,
        nilaiEkskul: nilaiEkskuls.length,
        kalender: kalenders.length,
        arsipNilai: arsips.length,
      },
      data: {
        rombels,
        pembelajarans,
        presensis,
        jurnals,
        bks,
        prestasis,
        nilaiEkskuls,
        kalenders,
        arsips,
      },
    };

    // Catat ke log backup
    await db.backupLog.create({
      data: {
        jenis: "EKSPOR_FILE",
        semesterId,
        status: "BERHASIL",
        jumlahBaris: totalBaris,
        catatan: `[BACKUP_FULL] Cadangan 1 semester penuh (${semester.tahunAjaran.nama} ${semester.tipe}) - ${totalBaris} entitas data`,
        createdById: session.userId,
      },
    });

    revalidatePath("/admin/backup");

    return {
      success: true,
      message: `Cadangan 1 semester penuh (${semester.tahunAjaran.nama} ${semester.tipe}) berhasil dibuat (${totalBaris} data)!`,
      data: backupPackage,
    };
  } catch (err: unknown) {
    console.error("[backupSemesterFull Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal membuat cadangan semester.",
    };
  }
}

/**
 * 2. RESTORE 1 SEMESTER PENUH
 * Memulihkan seluruh data dari berkas/payload JSON cadangan
 */
export async function restoreSemesterFull(backupPayload: any): Promise<ActionResponse> {
  try {
    const session = await requireRole("SUPERADMIN");

    if (!backupPayload || typeof backupPayload !== "object") {
      return { success: false, message: "Berkas/payload data cadangan tidak valid." };
    }

    if (backupPayload.app !== "e-STUPA" || backupPayload.type !== "SEMESTER_FULL") {
      return { success: false, message: "Format cadangan tidak kompatibel (Harus cadangan SEMESTER_FULL e-STUPA)." };
    }

    const activeSem = await getSemesterAktif();
    const targetSemesterId = activeSem?.id || backupPayload.semester?.id;

    if (!targetSemesterId) {
      return { success: false, message: "Tidak ada semester aktif untuk tujuan pemulihan (restore)." };
    }

    const { data } = backupPayload;
    if (!data) {
      return { success: false, message: "Bagian data cadangan kosong." };
    }

    let restoredCount = 0;

    // 1. Restore Kalender Akademik
    if (Array.isArray(data.kalenders)) {
      for (const k of data.kalenders) {
        await db.kalenderAkademik.upsert({
          where: { id: k.id },
          update: {
            judulKegiatan: k.judulKegiatan,
            kategori: k.kategori,
            tanggalMulai: new Date(k.tanggalMulai),
            tanggalSelesai: k.tanggalSelesai ? new Date(k.tanggalSelesai) : null,
            keterangan: k.keterangan,
          },
          create: {
            id: k.id,
            semesterId: targetSemesterId,
            judulKegiatan: k.judulKegiatan,
            kategori: k.kategori,
            tanggalMulai: new Date(k.tanggalMulai),
            tanggalSelesai: k.tanggalSelesai ? new Date(k.tanggalSelesai) : null,
            keterangan: k.keterangan,
          },
        });
        restoredCount++;
      }
    }

    // 2. Restore Rombel & Siswa
    if (Array.isArray(data.rombels)) {
      for (const r of data.rombels) {
        const rombelRec = await db.rombel.upsert({
          where: {
            semesterId_nama: {
              semesterId: targetSemesterId,
              nama: r.nama,
            },
          },
          update: {
            tingkat: r.tingkat,
            kurikulum: r.kurikulum,
            waliKelasId: r.waliKelasId,
          },
          create: {
            id: r.id,
            semesterId: targetSemesterId,
            nama: r.nama,
            tingkat: r.tingkat,
            kurikulum: r.kurikulum,
            waliKelasId: r.waliKelasId,
          },
        });
        restoredCount++;

        // Restore Anggota Rombel & Siswa
        if (Array.isArray(r.anggota)) {
          for (const agg of r.anggota) {
            if (agg.siswa) {
              const siswaRec = await db.siswa.upsert({
                where: { nisn: agg.siswa.nisn },
                update: {
                  nis: agg.siswa.nis,
                  nama: agg.siswa.nama,
                  jenisKelamin: agg.siswa.jenisKelamin,
                  agama: agg.siswa.agama,
                  tempatLahir: agg.siswa.tempatLahir,
                  tanggalLahir: agg.siswa.tanggalLahir ? new Date(agg.siswa.tanggalLahir) : null,
                  alamat: agg.siswa.alamat,
                  status: agg.siswa.status || "AKTIF",
                },
                create: {
                  id: agg.siswa.id,
                  nisn: agg.siswa.nisn,
                  nis: agg.siswa.nis,
                  nama: agg.siswa.nama,
                  jenisKelamin: agg.siswa.jenisKelamin,
                  agama: agg.siswa.agama,
                  tempatLahir: agg.siswa.tempatLahir,
                  tanggalLahir: agg.siswa.tanggalLahir ? new Date(agg.siswa.tanggalLahir) : null,
                  alamat: agg.siswa.alamat,
                  status: agg.siswa.status || "AKTIF",
                },
              });

              await db.anggotaRombel.upsert({
                where: {
                  semesterId_siswaId: {
                    semesterId: targetSemesterId,
                    siswaId: siswaRec.id,
                  },
                },
                update: {
                  rombelId: rombelRec.id,
                  noAbsen: agg.noAbsen,
                },
                create: {
                  semesterId: targetSemesterId,
                  rombelId: rombelRec.id,
                  siswaId: siswaRec.id,
                  noAbsen: agg.noAbsen,
                },
              });
              restoredCount++;
            }
          }
        }
      }
    }

    // 3. Restore Pembelajaran & Penilaian
    if (Array.isArray(data.pembelajarans)) {
      for (const p of data.pembelajarans) {
        const pRec = await db.pembelajaran.upsert({
          where: {
            rombelId_mapelId: {
              rombelId: p.rombelId,
              mapelId: p.mapelId,
            },
          },
          update: {
            gtkId: p.gtkId,
            kktp: p.kktp,
            bobotHarian: p.bobotHarian,
            bobotUts: p.bobotUts,
            bobotUas: p.bobotUas,
          },
          create: {
            id: p.id,
            semesterId: targetSemesterId,
            rombelId: p.rombelId,
            mapelId: p.mapelId,
            gtkId: p.gtkId,
            kktp: p.kktp,
            bobotHarian: p.bobotHarian,
            bobotUts: p.bobotUts,
            bobotUas: p.bobotUas,
          },
        });
        restoredCount++;

        // Restore Nilai Rapor
        if (Array.isArray(p.nilaiRapor)) {
          for (const nr of p.nilaiRapor) {
            await db.nilaiRapor.upsert({
              where: {
                pembelajaranId_siswaId: {
                  pembelajaranId: pRec.id,
                  siswaId: nr.siswaId,
                },
              },
              update: {
                rataHarian: nr.rataHarian,
                nilaiUts: nr.nilaiUts,
                nilaiUas: nr.nilaiUas,
                nilaiAkhir: nr.nilaiAkhir,
                capaianTertinggi: nr.capaianTertinggi,
                capaianTerendah: nr.capaianTerendah,
              },
              create: {
                pembelajaranId: pRec.id,
                siswaId: nr.siswaId,
                rataHarian: nr.rataHarian,
                nilaiUts: nr.nilaiUts,
                nilaiUas: nr.nilaiUas,
                nilaiAkhir: nr.nilaiAkhir,
                capaianTertinggi: nr.capaianTertinggi,
                capaianTerendah: nr.capaianTerendah,
              },
            });
            restoredCount++;
          }
        }
      }
    }

    // 4. Restore Presensi
    if (Array.isArray(data.presensis)) {
      for (const pr of data.presensis) {
        await db.presensi.upsert({
          where: {
            semesterId_siswaId_tanggal: {
              semesterId: targetSemesterId,
              siswaId: pr.siswaId,
              tanggal: new Date(pr.tanggal),
            },
          },
          update: {
            status: pr.status,
            keterangan: pr.keterangan,
          },
          create: {
            semesterId: targetSemesterId,
            rombelId: pr.rombelId,
            siswaId: pr.siswaId,
            tanggal: new Date(pr.tanggal),
            status: pr.status,
            keterangan: pr.keterangan,
          },
        });
        restoredCount++;
      }
    }

    // 5. Restore Kesiswaan (Jurnal, BK, Prestasi)
    if (Array.isArray(data.jurnals)) {
      for (const j of data.jurnals) {
        await db.jurnalPerkembangan.upsert({
          where: { id: j.id },
          update: {
            mapel: j.mapel,
            dimensiProfil: j.dimensiProfil,
            catatan: j.catatan,
            butirSikap: j.butirSikap,
            tindakLanjut: j.tindakLanjut,
          },
          create: {
            id: j.id,
            semesterId: targetSemesterId,
            rombelId: j.rombelId,
            siswaId: j.siswaId,
            tanggal: new Date(j.tanggal),
            mapel: j.mapel,
            dimensiProfil: j.dimensiProfil,
            catatan: j.catatan,
            butirSikap: j.butirSikap,
            tindakLanjut: j.tindakLanjut,
          },
        });
        restoredCount++;
      }
    }

    if (Array.isArray(data.bks)) {
      for (const b of data.bks) {
        await db.bimbinganKonseling.upsert({
          where: { id: b.id },
          update: {
            kategori: b.kategori,
            permasalahan: b.permasalahan,
            tindakLanjut: b.tindakLanjut,
            status: b.status,
          },
          create: {
            id: b.id,
            semesterId: targetSemesterId,
            siswaId: b.siswaId,
            tanggal: new Date(b.tanggal),
            kategori: b.kategori,
            permasalahan: b.permasalahan,
            tindakLanjut: b.tindakLanjut,
            status: b.status,
            guruBkId: b.guruBkId,
          },
        });
        restoredCount++;
      }
    }

    if (Array.isArray(data.prestasis)) {
      for (const pr of data.prestasis) {
        await db.prestasiSiswa.upsert({
          where: { id: pr.id },
          update: {
            namaPrestasi: pr.namaPrestasi,
            kategori: pr.kategori,
            tingkat: pr.tingkat,
            peringkat: pr.peringkat,
            penyelenggara: pr.penyelenggara,
          },
          create: {
            id: pr.id,
            semesterId: targetSemesterId,
            siswaId: pr.siswaId,
            namaPrestasi: pr.namaPrestasi,
            kategori: pr.kategori,
            tingkat: pr.tingkat,
            peringkat: pr.peringkat,
            penyelenggara: pr.penyelenggara,
            tanggal: pr.tanggal ? new Date(pr.tanggal) : null,
          },
        });
        restoredCount++;
      }
    }

    // Catat log aktivitas restore
    await db.backupLog.create({
      data: {
        jenis: "SNAPSHOT_ARSIP",
        semesterId: targetSemesterId,
        status: "BERHASIL",
        jumlahBaris: restoredCount,
        catatan: `[RESTORE_FULL] Berhasil memulihkan ${restoredCount} entitas data dari cadangan`,
        createdById: session.userId,
      },
    });

    revalidatePath("/admin/backup");
    revalidatePath("/admin/master/siswa");
    revalidatePath("/admin/master/rombel");
    revalidatePath("/admin/pembelajaran");
    revalidatePath("/admin/leger");
    revalidatePath("/admin/presensi");
    revalidatePath("/admin");

    return {
      success: true,
      message: `Pemulihan (restore) data 1 semester berhasil dilakukan (${restoredCount} entitas data dipulihkan)!`,
    };
  } catch (err: unknown) {
    console.error("[restoreSemesterFull Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal memulihkan data semester.",
    };
  }
}

/**
 * 3. BACKUP PER MENU UTAMA
 * Opsi membuat cadangan khusus untuk modul menu tertentu:
 * - SISWA_ROMBEL: Data Murid & Rombel Kelas
 * - GTK_USER: Data GTK & Akun Pengguna
 * - PEMBELAJARAN_NILAI: Data Pembelajaran & Nilai Rapor
 * - PRESENSI: Presensi Harian Siswa
 * - KESISWAAN: Jurnal Perkembangan, BK, Prestasi
 * - EKSKUL_KALENDER: Ekstrakurikuler & Kalender Pendidikan
 */
export async function backupPerMenu(menuKey: string): Promise<ActionResponse> {
  try {
    const session = await requireRole("SUPERADMIN");
    const activeSem = await getSemesterAktif();
    const semesterId = activeSem?.id;

    let payload: any = {};
    let count = 0;

    switch (menuKey) {
      case "SISWA_ROMBEL": {
        const [siswas, rombels] = await Promise.all([
          db.siswa.findMany(),
          semesterId
            ? db.rombel.findMany({
                where: { semesterId },
                include: { anggota: true },
              })
            : db.rombel.findMany({ include: { anggota: true } }),
        ]);
        payload = { siswas, rombels };
        count = siswas.length + rombels.length;
        break;
      }

      case "GTK_USER": {
        const [gtks, users] = await Promise.all([
          db.gtk.findMany(),
          db.user.findMany({
            select: {
              id: true,
              username: true,
              role: true,
              gtkId: true,
              isActive: true,
              createdAt: true,
            },
          }),
        ]);
        payload = { gtks, users };
        count = gtks.length + users.length;
        break;
      }

      case "PEMBELAJARAN_NILAI": {
        const [pembelajarans, mapels] = await Promise.all([
          semesterId
            ? db.pembelajaran.findMany({
                where: { semesterId },
                include: { nilaiRapor: true, penilaian: { include: { nilai: true } } },
              })
            : db.pembelajaran.findMany({
                include: { nilaiRapor: true, penilaian: { include: { nilai: true } } },
              }),
          db.mapel.findMany(),
        ]);
        payload = { pembelajarans, mapels };
        count = pembelajarans.length + mapels.length;
        break;
      }

      case "PRESENSI": {
        const presensis = semesterId
          ? await db.presensi.findMany({ where: { semesterId } })
          : await db.presensi.findMany();
        payload = { presensis };
        count = presensis.length;
        break;
      }

      case "KESISWAAN": {
        const [jurnals, bks, prestasis] = await Promise.all([
          semesterId ? db.jurnalPerkembangan.findMany({ where: { semesterId } }) : db.jurnalPerkembangan.findMany(),
          semesterId ? db.bimbinganKonseling.findMany({ where: { semesterId } }) : db.bimbinganKonseling.findMany(),
          semesterId ? db.prestasiSiswa.findMany({ where: { semesterId } }) : db.prestasiSiswa.findMany(),
        ]);
        payload = { jurnals, bks, prestasis };
        count = jurnals.length + bks.length + prestasis.length;
        break;
      }

      case "EKSKUL_KALENDER": {
        const [ekskuls, nilaiEkskuls, kalenders] = await Promise.all([
          db.ekstrakurikuler.findMany(),
          semesterId ? db.nilaiEkskul.findMany({ where: { semesterId } }) : db.nilaiEkskul.findMany(),
          semesterId ? db.kalenderAkademik.findMany({ where: { semesterId } }) : db.kalenderAkademik.findMany(),
        ]);
        payload = { ekskuls, nilaiEkskuls, kalenders };
        count = ekskuls.length + nilaiEkskuls.length + kalenders.length;
        break;
      }

      default:
        return { success: false, message: `Menu "${menuKey}" tidak dikenali.` };
    }

    const backupPackage = {
      app: "e-STUPA",
      version: "2.0",
      type: "MENU_BACKUP",
      menuKey,
      createdAt: new Date().toISOString(),
      createdByName: session.username,
      count,
      data: payload,
    };

    await db.backupLog.create({
      data: {
        jenis: "EKSPOR_FILE",
        semesterId: semesterId || null,
        status: "BERHASIL",
        jumlahBaris: count,
        catatan: `[BACKUP_MENU:${menuKey}] Cadangan modul ${menuKey} (${count} data)`,
        createdById: session.userId,
      },
    });

    revalidatePath("/admin/backup");

    return {
      success: true,
      message: `Cadangan modul ${menuKey} berhasil dibuat (${count} entitas data)!`,
      data: backupPackage,
    };
  } catch (err: unknown) {
    console.error("[backupPerMenu Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal membuat cadangan per menu.",
    };
  }
}

/**
 * 4. SNAPSHOT ARSIP HISTORIS NILAI
 */
export async function actionSnapshotArsip(): Promise<ActionResponse> {
  try {
    const session = await requireRole("SUPERADMIN");
    const semester = await getSemesterAktif();

    if (!semester) {
      return { success: false, message: "Tidak ada semester aktif." };
    }

    const nilaiRapors = await db.nilaiRapor.findMany({
      where: { pembelajaran: { semesterId: semester.id } },
      include: {
        siswa: true,
        pembelajaran: {
          include: {
            mapel: true,
            gtk: true,
            rombel: true,
          },
        },
      },
    });

    if (nilaiRapors.length === 0) {
      return { success: false, message: "Belum ada data nilai rapor untuk diarsipkan pada semester ini." };
    }

    let count = 0;
    for (const nr of nilaiRapors) {
      await db.arsipNilai.upsert({
        where: {
          semesterId_nisn_kodeMapel: {
            semesterId: semester.id,
            nisn: nr.siswa.nisn,
            kodeMapel: nr.pembelajaran.mapel.kode,
          },
        },
        update: {
          nilaiAkhir: nr.nilaiAkhir,
          rataHarian: nr.rataHarian,
          nilaiUts: nr.nilaiUts,
          nilaiUas: nr.nilaiUas,
          capaianTertinggi: nr.capaianTertinggi,
          capaianTerendah: nr.capaianTerendah,
        },
        create: {
          semesterId: semester.id,
          tahunAjaran: semester.tahunAjaran.nama,
          tipeSemester: semester.tipe,
          nisn: nr.siswa.nisn,
          namaSiswa: nr.siswa.nama,
          namaRombel: nr.pembelajaran.rombel.nama,
          tingkat: nr.pembelajaran.rombel.tingkat,
          kodeMapel: nr.pembelajaran.mapel.kode,
          namaMapel: nr.pembelajaran.mapel.nama,
          namaGuru: nr.pembelajaran.gtk.nama,
          nuptkGuru: nr.pembelajaran.gtk.nuptk,
          rataHarian: nr.rataHarian,
          nilaiUts: nr.nilaiUts,
          nilaiUas: nr.nilaiUas,
          nilaiAkhir: nr.nilaiAkhir,
          capaianTertinggi: nr.capaianTertinggi,
          capaianTerendah: nr.capaianTerendah,
        },
      });
      count++;
    }

    await db.backupLog.create({
      data: {
        jenis: "SNAPSHOT_ARSIP",
        semesterId: semester.id,
        status: "BERHASIL",
        jumlahBaris: count,
        catatan: `[SNAPSHOT_ARSIP] Snapshot ${count} nilai akhir semester ${semester.tahunAjaran.nama} ${semester.tipe}`,
        createdById: session.userId,
      },
    });

    revalidatePath("/admin/backup");

    return {
      success: true,
      message: `Snapshot arsip berhasil disimpan (${count} nilai dibekukan secara permanen)!`,
    };
  } catch (err: unknown) {
    console.error("[actionSnapshotArsip Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal menjalankan snapshot arsip.",
    };
  }
}

/**
 * 5. RESTORE PER MENU UTAMA
 */
export async function restorePerMenu(backupPayload: any): Promise<ActionResponse> {
  try {
    const session = await requireRole("SUPERADMIN");
    if (!backupPayload || typeof backupPayload !== "object") {
      return { success: false, message: "Payload data tidak valid." };
    }
    if (backupPayload.app !== "e-STUPA" || backupPayload.type !== "MENU_BACKUP") {
      return { success: false, message: "Berkas bukan format cadangan menu e-STUPA (MENU_BACKUP)." };
    }

    const { menuKey, data } = backupPayload;
    if (!data) {
      return { success: false, message: "Data cadangan kosong." };
    }

    const activeSem = await getSemesterAktif();
    const targetSemesterId = activeSem?.id;
    let count = 0;

    switch (menuKey) {
      case "SISWA_ROMBEL": {
        if (Array.isArray(data.siswas)) {
          for (const s of data.siswas) {
            await db.siswa.upsert({
              where: { nisn: s.nisn },
              update: {
                nis: s.nis,
                nama: s.nama,
                jenisKelamin: s.jenisKelamin,
                agama: s.agama,
                tempatLahir: s.tempatLahir,
                tanggalLahir: s.tanggalLahir ? new Date(s.tanggalLahir) : null,
                alamat: s.alamat,
                status: s.status || "AKTIF",
              },
              create: {
                id: s.id,
                nisn: s.nisn,
                nis: s.nis,
                nama: s.nama,
                jenisKelamin: s.jenisKelamin,
                agama: s.agama,
                tempatLahir: s.tempatLahir,
                tanggalLahir: s.tanggalLahir ? new Date(s.tanggalLahir) : null,
                alamat: s.alamat,
                status: s.status || "AKTIF",
              },
            });
            count++;
          }
        }
        if (Array.isArray(data.rombels) && targetSemesterId) {
          for (const r of data.rombels) {
            const rombelRec = await db.rombel.upsert({
              where: {
                semesterId_nama: {
                  semesterId: targetSemesterId,
                  nama: r.nama,
                },
              },
              update: {
                tingkat: r.tingkat,
                kurikulum: r.kurikulum,
                waliKelasId: r.waliKelasId,
              },
              create: {
                id: r.id,
                semesterId: targetSemesterId,
                nama: r.nama,
                tingkat: r.tingkat,
                kurikulum: r.kurikulum,
                waliKelasId: r.waliKelasId,
              },
            });
            count++;
            if (Array.isArray(r.anggota)) {
              for (const a of r.anggota) {
                await db.anggotaRombel.upsert({
                  where: {
                    semesterId_siswaId: {
                      semesterId: targetSemesterId,
                      siswaId: a.siswaId,
                    },
                  },
                  update: {
                    rombelId: rombelRec.id,
                    noAbsen: a.noAbsen,
                  },
                  create: {
                    semesterId: targetSemesterId,
                    rombelId: rombelRec.id,
                    siswaId: a.siswaId,
                    noAbsen: a.noAbsen,
                  },
                });
                count++;
              }
            }
          }
        }
        break;
      }
      case "GTK_USER": {
        if (Array.isArray(data.gtks)) {
          for (const g of data.gtks) {
            await db.gtk.upsert({
              where: { nuptk: g.nuptk },
              update: {
                nip: g.nip,
                nama: g.nama,
                jenisKelamin: g.jenisKelamin,
                jenisPtk: g.jenisPtk,
                statusKepegawaian: g.statusKepegawaian,
                isAktif: g.isAktif !== undefined ? g.isAktif : true,
              },
              create: {
                id: g.id,
                nuptk: g.nuptk,
                nip: g.nip,
                nama: g.nama,
                jenisKelamin: g.jenisKelamin,
                jenisPtk: g.jenisPtk,
                statusKepegawaian: g.statusKepegawaian,
                isAktif: g.isAktif !== undefined ? g.isAktif : true,
              },
            });
            count++;
          }
        }
        break;
      }
      case "PEMBELAJARAN_NILAI": {
        if (Array.isArray(data.mapels)) {
          for (const m of data.mapels) {
            await db.mapel.upsert({
              where: { kode: m.kode },
              update: {
                nama: m.nama,
                kelompok: m.kelompok,
                urutan: m.urutan ?? 0,
              },
              create: {
                id: m.id,
                kode: m.kode,
                nama: m.nama,
                kelompok: m.kelompok,
                urutan: m.urutan ?? 0,
              },
            });
            count++;
          }
        }
        if (Array.isArray(data.pembelajarans) && targetSemesterId) {
          for (const p of data.pembelajarans) {
            const pRec = await db.pembelajaran.upsert({
              where: {
                rombelId_mapelId: {
                  rombelId: p.rombelId,
                  mapelId: p.mapelId,
                },
              },
              update: {
                gtkId: p.gtkId,
                kktp: p.kktp,
                bobotHarian: p.bobotHarian,
                bobotUts: p.bobotUts,
                bobotUas: p.bobotUas,
              },
              create: {
                id: p.id,
                semesterId: targetSemesterId,
                rombelId: p.rombelId,
                mapelId: p.mapelId,
                gtkId: p.gtkId,
                kktp: p.kktp,
                bobotHarian: p.bobotHarian,
                bobotUts: p.bobotUts,
                bobotUas: p.bobotUas,
              },
            });
            count++;
            if (Array.isArray(p.nilaiRapor)) {
              for (const nr of p.nilaiRapor) {
                await db.nilaiRapor.upsert({
                  where: {
                    pembelajaranId_siswaId: {
                      pembelajaranId: pRec.id,
                      siswaId: nr.siswaId,
                    },
                  },
                  update: {
                    rataHarian: nr.rataHarian,
                    nilaiUts: nr.nilaiUts,
                    nilaiUas: nr.nilaiUas,
                    nilaiAkhir: nr.nilaiAkhir,
                    capaianTertinggi: nr.capaianTertinggi,
                    capaianTerendah: nr.capaianTerendah,
                  },
                  create: {
                    pembelajaranId: pRec.id,
                    siswaId: nr.siswaId,
                    rataHarian: nr.rataHarian,
                    nilaiUts: nr.nilaiUts,
                    nilaiUas: nr.nilaiUas,
                    nilaiAkhir: nr.nilaiAkhir,
                    capaianTertinggi: nr.capaianTertinggi,
                    capaianTerendah: nr.capaianTerendah,
                  },
                });
                count++;
              }
            }
          }
        }
        break;
      }
      case "PRESENSI": {
        if (Array.isArray(data.presensis) && targetSemesterId) {
          for (const pr of data.presensis) {
            await db.presensi.upsert({
              where: {
                semesterId_siswaId_tanggal: {
                  semesterId: targetSemesterId,
                  siswaId: pr.siswaId,
                  tanggal: new Date(pr.tanggal),
                },
              },
              update: {
                status: pr.status,
                keterangan: pr.keterangan,
              },
              create: {
                semesterId: targetSemesterId,
                rombelId: pr.rombelId,
                siswaId: pr.siswaId,
                tanggal: new Date(pr.tanggal),
                status: pr.status,
                keterangan: pr.keterangan,
              },
            });
            count++;
          }
        }
        break;
      }
      case "KESISWAAN": {
        if (Array.isArray(data.jurnals) && targetSemesterId) {
          for (const j of data.jurnals) {
            await db.jurnalPerkembangan.upsert({
              where: { id: j.id },
              update: {
                mapel: j.mapel,
                dimensiProfil: j.dimensiProfil,
                catatan: j.catatan,
                butirSikap: j.butirSikap,
                tindakLanjut: j.tindakLanjut,
              },
              create: {
                id: j.id,
                semesterId: targetSemesterId,
                rombelId: j.rombelId,
                siswaId: j.siswaId,
                tanggal: new Date(j.tanggal),
                mapel: j.mapel,
                dimensiProfil: j.dimensiProfil,
                catatan: j.catatan,
                butirSikap: j.butirSikap,
                tindakLanjut: j.tindakLanjut,
              },
            });
            count++;
          }
        }
        if (Array.isArray(data.bks) && targetSemesterId) {
          for (const b of data.bks) {
            await db.bimbinganKonseling.upsert({
              where: { id: b.id },
              update: {
                kategori: b.kategori,
                permasalahan: b.permasalahan,
                tindakLanjut: b.tindakLanjut,
                status: b.status,
              },
              create: {
                id: b.id,
                semesterId: targetSemesterId,
                siswaId: b.siswaId,
                tanggal: new Date(b.tanggal),
                kategori: b.kategori,
                permasalahan: b.permasalahan,
                tindakLanjut: b.tindakLanjut,
                status: b.status,
                guruBkId: b.guruBkId,
              },
            });
            count++;
          }
        }
        if (Array.isArray(data.prestasis) && targetSemesterId) {
          for (const pr of data.prestasis) {
            await db.prestasiSiswa.upsert({
              where: { id: pr.id },
              update: {
                namaPrestasi: pr.namaPrestasi,
                kategori: pr.kategori,
                tingkat: pr.tingkat,
                peringkat: pr.peringkat,
                penyelenggara: pr.penyelenggara,
              },
              create: {
                id: pr.id,
                semesterId: targetSemesterId,
                siswaId: pr.siswaId,
                namaPrestasi: pr.namaPrestasi,
                kategori: pr.kategori,
                tingkat: pr.tingkat,
                peringkat: pr.peringkat,
                penyelenggara: pr.penyelenggara,
                tanggal: pr.tanggal ? new Date(pr.tanggal) : null,
              },
            });
            count++;
          }
        }
        break;
      }
      case "EKSKUL_KALENDER": {
        if (Array.isArray(data.ekskuls)) {
          for (const e of data.ekskuls) {
            await db.ekstrakurikuler.upsert({
              where: { nama: e.nama },
              update: {
                pembina: e.pembina,
                deskripsi: e.deskripsi,
              },
              create: {
                id: e.id,
                nama: e.nama,
                pembina: e.pembina,
                deskripsi: e.deskripsi,
              },
            });
            count++;
          }
        }
        if (Array.isArray(data.kalenders) && targetSemesterId) {
          for (const k of data.kalenders) {
            await db.kalenderAkademik.upsert({
              where: { id: k.id },
              update: {
                judulKegiatan: k.judulKegiatan,
                kategori: k.kategori,
                tanggalMulai: new Date(k.tanggalMulai),
                tanggalSelesai: k.tanggalSelesai ? new Date(k.tanggalSelesai) : null,
                keterangan: k.keterangan,
              },
              create: {
                id: k.id,
                semesterId: targetSemesterId,
                judulKegiatan: k.judulKegiatan,
                kategori: k.kategori,
                tanggalMulai: new Date(k.tanggalMulai),
                tanggalSelesai: k.tanggalSelesai ? new Date(k.tanggalSelesai) : null,
                keterangan: k.keterangan,
              },
            });
            count++;
          }
        }
        break;
      }
      default:
        return { success: false, message: `Menu "${menuKey}" tidak didukung untuk pemulihan.` };
    }

    await db.backupLog.create({
      data: {
        jenis: "SNAPSHOT_ARSIP",
        semesterId: targetSemesterId || null,
        status: "BERHASIL",
        jumlahBaris: count,
        catatan: `[RESTORE_MENU:${menuKey}] Berhasil memulihkan ${count} entitas data dari cadangan modul ${menuKey}`,
        createdById: session.userId,
      },
    });

    revalidatePath("/admin/backup");
    return {
      success: true,
      message: `Pemulihan data modul ${menuKey} berhasil (${count} data dipulihkan)!`,
    };
  } catch (err: unknown) {
    console.error("[restorePerMenu Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal memulihkan modul menu.",
    };
  }
}
