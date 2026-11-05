import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("🚀 Memulai seeding master data e-STUPA...");

  // Pastikan constraint users_guru_gtk_chk dicabut agar akun guru fleksibel
  try {
    await db.$executeRawUnsafe(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_guru_gtk_chk";`);
  } catch {
    // Abaikan jika tabel belum ada atau constraint sudah terhapus
  }

  // 1. DATA SEKOLAH (Jaga agar tetap singleton 1 baris sekolah)
  const existingSekolah = await db.sekolah.findFirst();
  const sekolahData = {
    npsn: existingSekolah?.npsn || "50103069",
    nama: existingSekolah?.nama || "SD Negeri 7 Pedungan",
    bentukPendidikan: "SD",
    alamat: existingSekolah?.alamat || "Jl. Pulau Moyo No. 63 Pedungan",
    desaKelurahan: "Pedungan",
    kecamatan: "Denpasar Selatan",
    kabupatenKota: "Kota Denpasar",
    provinsi: "Bali",
    kodePos: "80222",
    telepon: "(0361) 720123",
    email: existingSekolah?.email || "sdn7pedungan63@gmail.com",
    namaKepsek: "Drs. I Made Sujana, M.Pd.",
    nipKepsek: "196805121992031008",
  };

  const sekolah = existingSekolah
    ? await db.sekolah.update({
        where: { id: existingSekolah.id },
        data: sekolahData,
      })
    : await db.sekolah.create({
        data: sekolahData,
      });
  console.log(`✅ Sekolah: ${sekolah.nama} (NPSN: ${sekolah.npsn})`);

  // 2. TAHUN AJARAN & SEMESTER
  const ta = await db.tahunAjaran.upsert({
    where: { nama: "2026/2027" },
    update: { isAktif: true, tahunMulai: 2026 },
    create: { nama: "2026/2027", tahunMulai: 2026, isAktif: true },
  });

  const semGanjil = await db.semester.upsert({
    where: { kode: "20261" },
    update: {
      status: "AKTIF",
      isAktif: true,
      tanggalMulai: new Date("2026-07-13"),
      tanggalSelesai: new Date("2026-12-18"),
      tanggalRapor: new Date("2026-12-18"),
    },
    create: {
      tahunAjaranId: ta.id,
      tipe: "GANJIL",
      kode: "20261",
      status: "AKTIF",
      isAktif: true,
      tanggalMulai: new Date("2026-07-13"),
      tanggalSelesai: new Date("2026-12-18"),
      tanggalRapor: new Date("2026-12-18"),
    },
  });

  await db.semester.upsert({
    where: { kode: "20262" },
    update: {
      status: "DRAFT",
      isAktif: false,
      tanggalMulai: new Date("2027-01-04"),
      tanggalSelesai: new Date("2027-06-18"),
      tanggalRapor: new Date("2027-06-18"),
    },
    create: {
      tahunAjaranId: ta.id,
      tipe: "GENAP",
      kode: "20262",
      status: "DRAFT",
      isAktif: false,
      tanggalMulai: new Date("2027-01-04"),
      tanggalSelesai: new Date("2027-06-18"),
      tanggalRapor: new Date("2027-06-18"),
    },
  });
  console.log(`✅ Tahun Ajaran: ${ta.nama}, Semester Aktif: ${semGanjil.kode}`);

  // 3. PENGGUNA SUPERADMIN
  const superadminUsername = (process.env.SEED_SUPERADMIN_USERNAME ?? "superadmin").trim().toLowerCase();
  const superadminPassword = process.env.SEED_SUPERADMIN_PASSWORD || "admin123";

  await db.user.upsert({
    where: { username: superadminUsername },
    update: {
      role: "SUPERADMIN",
      isActive: true,
    },
    create: {
      username: superadminUsername,
      passwordHash: await bcrypt.hash(superadminPassword, 12),
      role: "SUPERADMIN",
      isActive: true,
    },
  });
  console.log(`✅ Superadmin: ${superadminUsername}`);

  // 4. MATA PELAJARAN (MAPEL RESMI KURIKULUM MERDEKA)
  const mapels = [
    { kode: "PAB", nama: "Pendidikan Agama dan Budi Pekerti", urutan: 1, kelompok: "Agama" },
    { kode: "PAH", nama: "Pendidikan Agama Hindu dan Budi Pekerti", urutan: 1, kelompok: "Agama" },
    { kode: "PAI", nama: "Pendidikan Agama Islam dan Budi Pekerti", urutan: 1, kelompok: "Agama" },
    { kode: "PAK", nama: "Pendidikan Agama Kristen dan Budi Pekerti", urutan: 1, kelompok: "Agama" },
    { kode: "PAKAT", nama: "Pendidikan Agama Katolik dan Budi Pekerti", urutan: 1, kelompok: "Agama" },
    { kode: "PABUD", nama: "Pendidikan Agama Buddha dan Budi Pekerti", urutan: 1, kelompok: "Agama" },
    { kode: "PP", nama: "Pendidikan Pancasila", urutan: 2, kelompok: "Umum" },
    { kode: "BIND", nama: "Bahasa Indonesia", urutan: 3, kelompok: "Umum" },
    { kode: "MTK", nama: "Matematika", urutan: 4, kelompok: "Umum" },
    { kode: "IPAS", nama: "Ilmu Pengetahuan Alam dan Sosial (IPAS)", urutan: 5, kelompok: "Umum" },
    { kode: "PJOK", nama: "Pendidikan Jasmani, Olahraga, dan Kesehatan", urutan: 6, kelompok: "Umum" },
    { kode: "SB", nama: "Seni dan Budaya", urutan: 7, kelompok: "Umum" },
    { kode: "BING", nama: "Bahasa Inggris", urutan: 8, kelompok: "Umum" },
    { kode: "MULOK", nama: "Muatan Lokal (Bahasa Bali)", urutan: 9, kelompok: "Muatan Lokal" },
  ];

  for (const m of mapels) {
    await db.mapel.upsert({
      where: { kode: m.kode },
      update: { nama: m.nama, urutan: m.urutan, kelompok: m.kelompok, isAktif: true },
      create: { kode: m.kode, nama: m.nama, urutan: m.urutan, kelompok: m.kelompok, isAktif: true },
    });
  }
  console.log(`✅ Mapel: ${mapels.length} mata pelajaran resmi`);

  // 5. MASTER EKSTRAKURIKULER
  const masterEkskul = [
    {
      nama: "Praja Muda Karana (Pramuka)",
      kategori: "Kepanduan",
      pembina: "Pembina Pramuka",
      hari: "Jumat",
      jam: "14:30 - 16:30",
    },
    {
      nama: "Palang Merah Remaja (PMR)",
      kategori: "Kemanusiaan / Kesehatan",
      pembina: "Pembina PMR",
      hari: "Sabtu",
      jam: "08:00 - 10:00",
    },
    {
      nama: "Seni Tari Tradisional Bali",
      kategori: "Kesenian",
      pembina: "Pembina Seni Tari",
      hari: "Kamis",
      jam: "15:00 - 17:00",
    },
    {
      nama: "Futsal & Kebugaran Jasmani",
      kategori: "Olahraga",
      pembina: "Pembina Olahraga",
      hari: "Rabu",
      jam: "15:30 - 17:00",
    },
    {
      nama: "Robotik & Koding Dasar",
      kategori: "Sains",
      pembina: "Pembina Sains",
      hari: "Selasa",
      jam: "14:00 - 15:30",
    },
  ];

  for (const e of masterEkskul) {
    await db.ekstrakurikuler.upsert({
      where: { nama: e.nama },
      update: {
        kategori: e.kategori,
        pembina: e.pembina,
        hari: e.hari,
        jam: e.jam,
        isAktif: true,
      },
      create: {
        nama: e.nama,
        kategori: e.kategori,
        pembina: e.pembina,
        hari: e.hari,
        jam: e.jam,
        isAktif: true,
      },
    });
  }
  console.log(`✅ Master Ekstrakurikuler: ${masterEkskul.length} ekstrakurikuler aktif`);

  // 6. AGENDA KALENDER PENDIDIKAN
  const kalenderList = [
    {
      judulKegiatan: "Masa Pengenalan Lingkungan Sekolah (MPLS)",
      kategori: "Kegiatan Sekolah",
      tanggalMulai: new Date("2026-07-13"),
      tanggalSelesai: new Date("2026-07-15"),
      keterangan: "Orientasi siswa baru dan pengenalan budaya sekolah ramah anak.",
    },
    {
      judulKegiatan: "Peringatan Hari Pramuka ke-65",
      kategori: "Kegiatan Sekolah",
      tanggalMulai: new Date("2026-08-14"),
      tanggalSelesai: null,
      keterangan: "Upacara bendera dan apel besar gerakan kepanduan sekolah.",
    },
    {
      judulKegiatan: "HUT Proklamasi Kemerdekaan RI ke-81",
      kategori: "Libur",
      tanggalMulai: new Date("2026-08-17"),
      tanggalSelesai: null,
      keterangan: "Upacara kemerdekaan dan aneka perlombaan ketangkasan tradisional.",
    },
    {
      judulKegiatan: "Penilaian Tengah Semester (PTS) Ganjil",
      kategori: "Ujian",
      tanggalMulai: new Date("2026-09-14"),
      tanggalSelesai: new Date("2026-09-18"),
      keterangan: "Asesmen sumatif tengah semester untuk seluruh mata pelajaran.",
    },
    {
      judulKegiatan: "Rapat Evaluasi Tengah Semester & Parenting Komite",
      kategori: "Rapat",
      tanggalMulai: new Date("2026-09-25"),
      tanggalSelesai: null,
      keterangan: "Pertemuan pleno dewan guru dengan wali murid komite sekolah.",
    },
    {
      judulKegiatan: "Pekan Kreativitas & Gelar Karya P5",
      kategori: "Kegiatan Sekolah",
      tanggalMulai: new Date("2026-10-26"),
      tanggalSelesai: new Date("2026-10-28"),
      keterangan: "Pameran hasil karya Projek Penguatan Profil Pelajar Pancasila.",
    },
    {
      judulKegiatan: "Penilaian Akhir Semester (PAS) / Sumatif Akhir Ganjil",
      kategori: "Ujian",
      tanggalMulai: new Date("2026-12-01"),
      tanggalSelesai: new Date("2026-12-11"),
      keterangan: "Asesmen sumatif akhir semester ganjil.",
    },
    {
      judulKegiatan: "Pengolahan Nilai & Rapat Pleno Rapor Ganjil",
      kategori: "Rapat",
      tanggalMulai: new Date("2026-12-14"),
      tanggalSelesai: new Date("2026-12-16"),
      keterangan: "Finalisasi nilai rapor, deskripsi capaian kompetensi, dan ekstrakurikuler.",
    },
    {
      judulKegiatan: "Pembagian Laporan Hasil Belajar (Rapor) Semester Ganjil",
      kategori: "Akademik",
      tanggalMulai: new Date("2026-12-18"),
      tanggalSelesai: null,
      keterangan: "Penyerahan rapor semester ganjil kepada orang tua/wali murid.",
    },
    {
      judulKegiatan: "Libur Akhir Semester Ganjil",
      kategori: "Libur",
      tanggalMulai: new Date("2026-12-21"),
      tanggalSelesai: new Date("2026-12-31"),
      keterangan: "Libur jeda semester ganjil tahun ajaran 2026/2027.",
    },
    {
      judulKegiatan: "Tahun Baru Masehi 2027",
      kategori: "Libur",
      tanggalMulai: new Date("2027-01-01"),
      tanggalSelesai: null,
      keterangan: "Tahun baru masehi.",
    },
    {
      judulKegiatan: "Awal Masuk Sekolah Semester Genap",
      kategori: "Akademik",
      tanggalMulai: new Date("2027-01-04"),
      tanggalSelesai: null,
      keterangan: "Hari pertama proses belajar mengajar efektif semester genap.",
    },
  ];

  try {
    const existingKalender = await db.kalenderAkademik.count({
      where: { semesterId: semGanjil.id },
    });
    if (existingKalender === 0) {
      for (const k of kalenderList) {
        await db.kalenderAkademik.create({
          data: {
            semesterId: semGanjil.id,
            judulKegiatan: k.judulKegiatan,
            kategori: k.kategori,
            tanggalMulai: k.tanggalMulai,
            tanggalSelesai: k.tanggalSelesai,
            keterangan: k.keterangan,
          },
        });
      }
      console.log(`✅ Kalender Pendidikan: ${kalenderList.length} agenda kegiatan berhasil dibuat`);
    }
  } catch (kErr) {
    console.warn("⚠️ Warning saat seeding Kalender Pendidikan (dilewati):", kErr);
  }

  console.log("\n🎉 SEEDING MASTER DATA SELESAI (Bersih dari data dummy siswa, nilai, prestasi & BK)!");
}

main()
  .catch((e) => {
    console.error("⚠️ Catatan saat seeding:", e);
    process.exit(0);
  })
  .finally(() => db.$disconnect());
