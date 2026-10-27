import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("🚀 Memulai seeding data STUPA & EduGuru...");

  // 1. DATA SEKOLAH
  const sekolah = await db.sekolah.upsert({
    where: { npsn: "50102030" },
    update: {
      nama: "SDN 7 Pedungan",
      bentukPendidikan: "SD",
      alamat: "Jl. Pulau Moyo No. 45",
      desaKelurahan: "Pedungan",
      kecamatan: "Denpasar Selatan",
      kabupatenKota: "Kota Denpasar",
      provinsi: "Bali",
      kodePos: "80222",
      telepon: "(0361) 720123",
      email: "sdn7pedungan@denpasarkota.go.id",
      namaKepsek: "Drs. I Made Sujana, M.Pd.",
      nipKepsek: "196805121992031008",
    },
    create: {
      npsn: "50102030",
      nama: "SDN 7 Pedungan",
      bentukPendidikan: "SD",
      alamat: "Jl. Pulau Moyo No. 45",
      desaKelurahan: "Pedungan",
      kecamatan: "Denpasar Selatan",
      kabupatenKota: "Kota Denpasar",
      provinsi: "Bali",
      kodePos: "80222",
      telepon: "(0361) 720123",
      email: "sdn7pedungan@denpasarkota.go.id",
      namaKepsek: "Drs. I Made Sujana, M.Pd.",
      nipKepsek: "196805121992031008",
    },
  });
  console.log(`✅ Sekolah: ${sekolah.nama}`);

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

  // 4. DATA GTK & AKUN GURU
  const gtks = [
    {
      nik: "5171010101850001",
      nuptk: "198501012010011001",
      nip: "198501012010011001",
      nama: "Budi Santoso, S.Pd.",
      jenisKelamin: "L" as const,
      jenisPtk: "Guru Kelas",
      username: "budi",
    },
    {
      nik: "5171011503890002",
      nuptk: "198903152012032002",
      nip: "198903152012032002",
      nama: "Siti Aminah, S.Pd.",
      jenisKelamin: "P" as const,
      jenisPtk: "Guru BK",
      username: "siti",
    },
    {
      nik: "5171012004920003",
      nuptk: "199204202015022003",
      nip: "199204202015022003",
      nama: "Ni Wayan Dewi, S.Pd.",
      jenisKelamin: "P" as const,
      jenisPtk: "Guru Mapel",
      username: "dewi",
    },
    {
      nik: "5171011008940004",
      nuptk: "199408102019011004",
      nip: "199408102019011004",
      nama: "I Kadek Yoga, S.Pd.",
      jenisKelamin: "L" as const,
      jenisPtk: "Guru Mapel",
      username: "kadek",
    },
  ];

  const gtkMap = new Map<string, string>();
  for (const g of gtks) {
    const gtkRecord = await db.gtk.upsert({
      where: { nuptk: g.nuptk },
      update: {
        nama: g.nama,
        nip: g.nip,
        jenisKelamin: g.jenisKelamin,
        jenisPtk: g.jenisPtk,
        isAktif: true,
      },
      create: {
        nik: g.nik,
        nuptk: g.nuptk,
        nip: g.nip,
        nama: g.nama,
        jenisKelamin: g.jenisKelamin,
        jenisPtk: g.jenisPtk,
        isAktif: true,
      },
    });
    gtkMap.set(g.username, gtkRecord.id);

    // Buat akun user guru
    await db.user.upsert({
      where: { username: g.username },
      update: {
        gtkId: gtkRecord.id,
        role: "GURU",
        isActive: true,
      },
      create: {
        username: g.username,
        passwordHash: await bcrypt.hash(`${g.username}123`, 12),
        role: "GURU",
        gtkId: gtkRecord.id,
        isActive: true,
      },
    });
  }
  console.log(`✅ GTK & Akun Guru: ${gtks.length} personil`);

  // 5. ROMBONGAN BELAJAR (ROMBEL)
  const rombel5A = await db.rombel.upsert({
    where: {
      semesterId_nama: { semesterId: semGanjil.id, nama: "5A" },
    },
    update: {
      tingkat: 5,
      kurikulum: "Kurikulum Merdeka",
      waliKelasId: gtkMap.get("budi") || null,
    },
    create: {
      semesterId: semGanjil.id,
      nama: "5A",
      tingkat: 5,
      kurikulum: "Kurikulum Merdeka",
      waliKelasId: gtkMap.get("budi") || null,
    },
  });

  await db.rombel.upsert({
    where: {
      semesterId_nama: { semesterId: semGanjil.id, nama: "5B" },
    },
    update: {
      tingkat: 5,
      kurikulum: "Kurikulum Merdeka",
      waliKelasId: gtkMap.get("dewi") || null,
    },
    create: {
      semesterId: semGanjil.id,
      nama: "5B",
      tingkat: 5,
      kurikulum: "Kurikulum Merdeka",
      waliKelasId: gtkMap.get("dewi") || null,
    },
  });

  await db.rombel.upsert({
    where: {
      semesterId_nama: { semesterId: semGanjil.id, nama: "6A" },
    },
    update: {
      tingkat: 6,
      kurikulum: "Kurikulum Merdeka",
      waliKelasId: gtkMap.get("kadek") || null,
    },
    create: {
      semesterId: semGanjil.id,
      nama: "6A",
      tingkat: 6,
      kurikulum: "Kurikulum Merdeka",
      waliKelasId: gtkMap.get("kadek") || null,
    },
  });
  console.log(`✅ Rombel: 5A, 5B, 6A`);

  // 6. MATA PELAJARAN (MAPEL)
  const mapels = [
    { kode: "PAB", nama: "Pendidikan Agama dan Budi Pekerti", urutan: 1 },
    { kode: "PP", nama: "Pendidikan Pancasila", urutan: 2 },
    { kode: "BIND", nama: "Bahasa Indonesia", urutan: 3 },
    { kode: "MTK", nama: "Matematika", urutan: 4 },
    { kode: "IPAS", nama: "Ilmu Pengetahuan Alam dan Sosial (IPAS)", urutan: 5 },
    { kode: "SB", nama: "Seni Budaya", urutan: 6 },
    { kode: "PJOK", nama: "Pendidikan Jasmani, Olahraga, dan Kesehatan", urutan: 7 },
    { kode: "BING", nama: "Bahasa Inggris", urutan: 8 },
    { kode: "MULOK", nama: "Muatan Lokal (Bahasa Bali)", urutan: 9 },
  ];

  for (const m of mapels) {
    await db.mapel.upsert({
      where: { kode: m.kode },
      update: { nama: m.nama, urutan: m.urutan, isAktif: true },
      create: { kode: m.kode, nama: m.nama, urutan: m.urutan, isAktif: true },
    });
  }
  console.log(`✅ Mapel: ${mapels.length} mata pelajaran`);

  // 7. SISWA & ANGGOTA ROMBEL
  const students = [
    { nisn: "0012345671", nis: "202501001", nama: "Ahmad Firmansyah", jk: "L" as const, noAbsen: 1 },
    { nisn: "0012345672", nis: "202501002", nama: "Aisyah Nurhaliza", jk: "P" as const, noAbsen: 2 },
    { nisn: "0012345673", nis: "202501003", nama: "Christian Wibowo", jk: "L" as const, noAbsen: 3 },
    { nisn: "0012345674", nis: "202501004", nama: "Dewa Ayu Lestari", jk: "P" as const, noAbsen: 4 },
    { nisn: "0012345675", nis: "202501005", nama: "I Kadek Artawan", jk: "L" as const, noAbsen: 5 },
    { nisn: "0012345676", nis: "202501006", nama: "Ni Putu Ratna", jk: "P" as const, noAbsen: 6 },
  ];

  const studentMap = new Map<string, string>();
  for (const s of students) {
    const sRecord = await db.siswa.upsert({
      where: { nisn: s.nisn },
      update: {
        nis: s.nis,
        nama: s.nama,
        jenisKelamin: s.jk,
        status: "AKTIF",
        isAktif: true,
      },
      create: {
        nisn: s.nisn,
        nis: s.nis,
        nama: s.nama,
        jenisKelamin: s.jk,
        status: "AKTIF",
        isAktif: true,
      },
    });
    studentMap.set(s.nama, sRecord.id);

    // Daftarkan ke Rombel 5A
    await db.anggotaRombel.upsert({
      where: {
        semesterId_siswaId: {
          semesterId: semGanjil.id,
          siswaId: sRecord.id,
        },
      },
      update: {
        rombelId: rombel5A.id,
        noAbsen: s.noAbsen,
      },
      create: {
        semesterId: semGanjil.id,
        rombelId: rombel5A.id,
        siswaId: sRecord.id,
        noAbsen: s.noAbsen,
      },
    });
  }
  console.log(`✅ Siswa & Anggota Rombel: ${students.length} murid di kelas 5A`);

  // 8. KALENDER AKADEMIK (EDUGURU DEFAULT TEMPLATE)
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

  // Bersihkan data kalender lama jika ada sebelum re-seed
  await db.kalenderAkademik.deleteMany({
    where: { semesterId: semGanjil.id },
  });

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

  // 9. MASTER EKSTRAKURIKULER
  const masterEkskul = [
    {
      nama: "Praja Muda Karana (Pramuka)",
      kategori: "Kepanduan",
      pembina: "Budi Santoso, S.Pd.",
      hari: "Jumat",
      jam: "14:30 - 16:30",
    },
    {
      nama: "Palang Merah Remaja (PMR)",
      kategori: "Kemanusiaan / Kesehatan",
      pembina: "Siti Aminah, S.Pd.",
      hari: "Sabtu",
      jam: "08:00 - 10:00",
    },
    {
      nama: "Seni Tari Tradisional Bali",
      kategori: "Kesenian",
      pembina: "Ni Wayan Dewi, S.Pd.",
      hari: "Kamis",
      jam: "15:00 - 17:00",
    },
    {
      nama: "Futsal & Kebugaran Jasmani",
      kategori: "Olahraga",
      pembina: "I Kadek Yoga, S.Pd.",
      hari: "Rabu",
      jam: "15:30 - 17:00",
    },
    {
      nama: "Robotik & Koding Dasar",
      kategori: "Sains",
      pembina: "Admin Pusat",
      hari: "Selasa",
      jam: "14:00 - 15:30",
    },
  ];

  const ekskulMap = new Map<string, string>();
  for (const e of masterEkskul) {
    const eRecord = await db.ekstrakurikuler.upsert({
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
    ekskulMap.set(e.nama, eRecord.id);
  }
  console.log(`✅ Master Ekstrakurikuler: ${masterEkskul.length} ekskul aktif`);

  // 10. PRESTASI MURID
  const ahmadId = studentMap.get("Ahmad Firmansyah");
  const dewaAyuId = studentMap.get("Dewa Ayu Lestari");
  const kadekArtawanId = studentMap.get("I Kadek Artawan");

  if (ahmadId && dewaAyuId && kadekArtawanId) {
    await db.prestasiSiswa.deleteMany({
      where: { semesterId: semGanjil.id },
    });

    const prestasiList = [
      {
        siswaId: ahmadId,
        namaPrestasi: "Olimpiade Sains Nasional (OSN) Matematika SD",
        kategori: "Akademik",
        tingkat: "Kabupaten/Kota",
        peringkat: "Juara 1",
        penyelenggara: "Balai Pengembangan Talenta Indonesia (BPTI)",
        tanggal: new Date("2026-08-20"),
        keterangan: "Meraih medali emas seleksi kota Denpasar dan melaju ke tingkat provinsi.",
      },
      {
        siswaId: dewaAyuId,
        namaPrestasi: "Festival & Lomba Seni Siswa Nasional (FLS2N) Tari",
        kategori: "Non-Akademik",
        tingkat: "Provinsi",
        peringkat: "Juara 2",
        penyelenggara: "Dinas Pendidikan Pemuda & Olahraga Provinsi Bali",
        tanggal: new Date("2026-09-12"),
        keterangan: "Penyaji tari tradisi terbaik mewakili kontingen Kota Denpasar.",
      },
      {
        siswaId: kadekArtawanId,
        namaPrestasi: "Olimpiade Olahraga Siswa Nasional (O2SN) Lari Cepat",
        kategori: "Non-Akademik",
        tingkat: "Kecamatan",
        peringkat: "Juara 1",
        penyelenggara: "KKG PJOK Kecamatan Denpasar Selatan",
        tanggal: new Date("2026-09-28"),
        keterangan: "Juara 1 lari sprint 60 meter putra.",
      },
    ];

    for (const p of prestasiList) {
      await db.prestasiSiswa.create({
        data: {
          semesterId: semGanjil.id,
          siswaId: p.siswaId,
          namaPrestasi: p.namaPrestasi,
          kategori: p.kategori,
          tingkat: p.tingkat,
          peringkat: p.peringkat,
          penyelenggara: p.penyelenggara,
          tanggal: p.tanggal,
          keterangan: p.keterangan,
        },
      });
    }
    console.log(`✅ Data Prestasi Murid: ${prestasiList.length} prestasi berhasil dicatat`);
  }

  // 11. BIMBINGAN & KONSELING (BK)
  const christianId = studentMap.get("Christian Wibowo");
  const guruBkId = gtkMap.get("siti");

  if (christianId && ahmadId) {
    await db.bimbinganKonseling.deleteMany({
      where: { semesterId: semGanjil.id },
    });

    const bkList = [
      {
        siswaId: christianId,
        tanggal: new Date("2026-08-15"),
        kategori: "Belajar",
        permasalahan: "Siswa sering melamun saat pembelajaran Matematika dan tugas formatif sering terlambat dikumpulkan.",
        tindakLanjut: "Konseling individu, bimbingan remedial bertahap, dan koordinasi berkala dengan orang tua murid.",
        status: "Dalam Penanganan",
        guruBkId: guruBkId || null,
      },
      {
        siswaId: ahmadId,
        tanggal: new Date("2026-09-05"),
        kategori: "Perilaku",
        permasalahan: "Perselisihan kecil saat bermain bola di lapangan saat jam istirahat sekolah.",
        tindakLanjut: "Mediasi antar-murid, penanaman nilai Profil Pelajar Pancasila (Gotong Royong & Saling Menghargai), kasus dinyatakan rukun kembali.",
        status: "Selesai",
        guruBkId: guruBkId || null,
      },
    ];

    for (const b of bkList) {
      await db.bimbinganKonseling.create({
        data: {
          semesterId: semGanjil.id,
          siswaId: b.siswaId,
          tanggal: b.tanggal,
          kategori: b.kategori,
          permasalahan: b.permasalahan,
          tindakLanjut: b.tindakLanjut,
          status: b.status,
          guruBkId: b.guruBkId,
        },
      });
    }
    console.log(`✅ Bimbingan & Konseling: ${bkList.length} catatan bimbingan berhasil dicatat`);
  }

  // 12. NILAI EKSTRAKURIKULER (UNTUK E-RAPOR)
  const pramukaId = ekskulMap.get("Praja Muda Karana (Pramuka)");
  const tariId = ekskulMap.get("Seni Tari Tradisional Bali");
  const pmrId = ekskulMap.get("Palang Merah Remaja (PMR)");
  const aisyahId = studentMap.get("Aisyah Nurhaliza");

  if (pramukaId && ahmadId) {
    await db.nilaiEkskul.upsert({
      where: {
        semesterId_ekskulId_siswaId: {
          semesterId: semGanjil.id,
          ekskulId: pramukaId,
          siswaId: ahmadId,
        },
      },
      update: {
        predikat: "Sangat Baik",
        keterangan: "Sangat aktif dan disiplin dalam setiap latihan pramuka, cakap dalam semaphore, sandi kotak, dan pengamalan Dwisatya serta Dwidarma.",
      },
      create: {
        semesterId: semGanjil.id,
        ekskulId: pramukaId,
        siswaId: ahmadId,
        predikat: "Sangat Baik",
        keterangan: "Sangat aktif dan disiplin dalam setiap latihan pramuka, cakap dalam semaphore, sandi kotak, dan pengamalan Dwisatya serta Dwidarma.",
      },
    });
  }

  if (tariId && dewaAyuId) {
    await db.nilaiEkskul.upsert({
      where: {
        semesterId_ekskulId_siswaId: {
          semesterId: semGanjil.id,
          ekskulId: tariId,
          siswaId: dewaAyuId,
        },
      },
      update: {
        predikat: "Sangat Baik",
        keterangan: "Memiliki penguasaan gerak agem, tandang, dan tangkep yang sangat luwes serta ekspresif dalam membawakan tari tradisi Bali.",
      },
      create: {
        semesterId: semGanjil.id,
        ekskulId: tariId,
        siswaId: dewaAyuId,
        predikat: "Sangat Baik",
        keterangan: "Memiliki penguasaan gerak agem, tandang, dan tangkep yang sangat luwes serta ekspresif dalam membawakan tari tradisi Bali.",
      },
    });
  }

  if (pmrId && aisyahId) {
    await db.nilaiEkskul.upsert({
      where: {
        semesterId_ekskulId_siswaId: {
          semesterId: semGanjil.id,
          ekskulId: pmrId,
          siswaId: aisyahId,
        },
      },
      update: {
        predikat: "Baik",
        keterangan: "Mampu mempraktikkan dasar pertolongan pertama (P3K) dengan tenang dan memiliki rasa empati serta kepedulian sosial yang tinggi.",
      },
      create: {
        semesterId: semGanjil.id,
        ekskulId: pmrId,
        siswaId: aisyahId,
        predikat: "Baik",
        keterangan: "Mampu mempraktikkan dasar pertolongan pertama (P3K) dengan tenang dan memiliki rasa empati serta kepedulian sosial yang tinggi.",
      },
    });
  }
  console.log(`✅ Nilai Ekstrakurikuler: 3 penilaian e-rapor berhasil disimpan`);

  console.log("\n🎉 SEEDING SELESAI DENGAN SEMPURNA KE NEON POSTGRESQL!");
}

main()
  .catch((e) => {
    console.error("❌ Error saat seeding:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
