-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPERADMIN', 'GURU');

-- CreateEnum
CREATE TYPE "TipeSemester" AS ENUM ('GANJIL', 'GENAP');

-- CreateEnum
CREATE TYPE "StatusSemester" AS ENUM ('DRAFT', 'AKTIF', 'DIKUNCI', 'ARSIP');

-- CreateEnum
CREATE TYPE "JenisKelamin" AS ENUM ('L', 'P');

-- CreateEnum
CREATE TYPE "StatusSiswa" AS ENUM ('AKTIF', 'LULUS', 'PINDAH', 'KELUAR');

-- CreateEnum
CREATE TYPE "KategoriPenilaian" AS ENUM ('HARIAN', 'UTS', 'UAS');

-- CreateEnum
CREATE TYPE "JenisImpor" AS ENUM ('SEKOLAH', 'GTK', 'SISWA', 'ROMBEL', 'ANGGOTA_ROMBEL', 'MAPEL', 'PEMBELAJARAN');

-- CreateEnum
CREATE TYPE "StatusProses" AS ENUM ('BERHASIL', 'SEBAGIAN', 'GAGAL');

-- CreateEnum
CREATE TYPE "JenisBackup" AS ENUM ('SNAPSHOT_ARSIP', 'EKSPOR_FILE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'GURU',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "gtkId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tahun_ajaran" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "tahunMulai" INTEGER NOT NULL,
    "isAktif" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tahun_ajaran_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semester" (
    "id" TEXT NOT NULL,
    "tahunAjaranId" TEXT NOT NULL,
    "tipe" "TipeSemester" NOT NULL,
    "kode" TEXT NOT NULL,
    "status" "StatusSemester" NOT NULL DEFAULT 'DRAFT',
    "isAktif" BOOLEAN NOT NULL DEFAULT false,
    "tanggalMulai" DATE,
    "tanggalSelesai" DATE,
    "tanggalRapor" DATE,
    "dikunciPada" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "semester_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sekolah" (
    "id" TEXT NOT NULL,
    "dapodikId" TEXT,
    "npsn" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "bentukPendidikan" TEXT,
    "alamat" TEXT,
    "desaKelurahan" TEXT,
    "kecamatan" TEXT,
    "kabupatenKota" TEXT,
    "provinsi" TEXT,
    "kodePos" TEXT,
    "telepon" TEXT,
    "email" TEXT,
    "website" TEXT,
    "namaKepsek" TEXT,
    "nipKepsek" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sekolah_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gtk" (
    "id" TEXT NOT NULL,
    "dapodikId" TEXT,
    "nuptk" TEXT,
    "nik" TEXT,
    "nip" TEXT,
    "nama" TEXT NOT NULL,
    "jenisKelamin" "JenisKelamin",
    "tempatLahir" TEXT,
    "tanggalLahir" DATE,
    "jenisPtk" TEXT,
    "statusKepegawaian" TEXT,
    "email" TEXT,
    "noHp" TEXT,
    "isAktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gtk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "siswa" (
    "id" TEXT NOT NULL,
    "dapodikId" TEXT,
    "nisn" TEXT NOT NULL,
    "nis" TEXT,
    "nik" TEXT,
    "nama" TEXT NOT NULL,
    "jenisKelamin" "JenisKelamin" NOT NULL,
    "tempatLahir" TEXT,
    "tanggalLahir" DATE,
    "agama" TEXT,
    "alamat" TEXT,
    "namaAyah" TEXT,
    "namaIbu" TEXT,
    "namaWali" TEXT,
    "status" "StatusSiswa" NOT NULL DEFAULT 'AKTIF',
    "isAktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "siswa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mapel" (
    "id" TEXT NOT NULL,
    "dapodikId" INTEGER,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "kodeErapor" TEXT,
    "kelompok" TEXT,
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "isAktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mapel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rombel" (
    "id" TEXT NOT NULL,
    "dapodikId" TEXT,
    "semesterId" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "tingkat" INTEGER NOT NULL,
    "kurikulum" TEXT,
    "waliKelasId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rombel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anggota_rombel" (
    "id" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "rombelId" TEXT NOT NULL,
    "siswaId" TEXT NOT NULL,
    "noAbsen" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anggota_rombel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pembelajaran" (
    "id" TEXT NOT NULL,
    "dapodikId" TEXT,
    "semesterId" TEXT NOT NULL,
    "rombelId" TEXT NOT NULL,
    "mapelId" TEXT NOT NULL,
    "gtkId" TEXT NOT NULL,
    "kktp" INTEGER,
    "bobotHarian" INTEGER NOT NULL DEFAULT 50,
    "bobotUts" INTEGER NOT NULL DEFAULT 25,
    "bobotUas" INTEGER NOT NULL DEFAULT 25,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pembelajaran_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penilaian" (
    "id" TEXT NOT NULL,
    "pembelajaranId" TEXT NOT NULL,
    "kategori" "KategoriPenilaian" NOT NULL,
    "urutan" INTEGER NOT NULL DEFAULT 1,
    "nama" TEXT NOT NULL,
    "tujuanPembelajaran" TEXT,
    "tanggal" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "penilaian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nilai" (
    "id" TEXT NOT NULL,
    "penilaianId" TEXT NOT NULL,
    "siswaId" TEXT NOT NULL,
    "nilai" DECIMAL(5,2),
    "catatan" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nilai_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nilai_rapor" (
    "id" TEXT NOT NULL,
    "pembelajaranId" TEXT NOT NULL,
    "siswaId" TEXT NOT NULL,
    "rataHarian" DECIMAL(5,2),
    "nilaiUts" DECIMAL(5,2),
    "nilaiUas" DECIMAL(5,2),
    "nilaiAkhir" DECIMAL(5,2),
    "isOverride" BOOLEAN NOT NULL DEFAULT false,
    "capaianTertinggi" TEXT,
    "capaianTerendah" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nilai_rapor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arsip_nilai" (
    "id" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "tahunAjaran" TEXT NOT NULL,
    "tipeSemester" "TipeSemester" NOT NULL,
    "nisn" TEXT NOT NULL,
    "namaSiswa" TEXT NOT NULL,
    "namaRombel" TEXT NOT NULL,
    "tingkat" INTEGER NOT NULL,
    "kodeMapel" TEXT NOT NULL,
    "namaMapel" TEXT NOT NULL,
    "namaGuru" TEXT NOT NULL,
    "nuptkGuru" TEXT,
    "rataHarian" DECIMAL(5,2),
    "nilaiUts" DECIMAL(5,2),
    "nilaiUas" DECIMAL(5,2),
    "nilaiAkhir" DECIMAL(5,2),
    "capaianTertinggi" TEXT,
    "capaianTerendah" TEXT,
    "detailNilai" JSONB,
    "diarsipkanPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arsip_nilai_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_log" (
    "id" TEXT NOT NULL,
    "jenis" "JenisBackup" NOT NULL,
    "semesterId" TEXT,
    "status" "StatusProses" NOT NULL,
    "jumlahBaris" INTEGER NOT NULL DEFAULT 0,
    "fileUrl" TEXT,
    "catatan" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backup_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_log" (
    "id" TEXT NOT NULL,
    "jenis" "JenisImpor" NOT NULL,
    "semesterId" TEXT,
    "namaFile" TEXT NOT NULL,
    "totalBaris" INTEGER NOT NULL DEFAULT 0,
    "ditambah" INTEGER NOT NULL DEFAULT 0,
    "diperbarui" INTEGER NOT NULL DEFAULT 0,
    "gagal" INTEGER NOT NULL DEFAULT 0,
    "status" "StatusProses" NOT NULL,
    "errors" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "aksi" TEXT NOT NULL,
    "entitas" TEXT NOT NULL,
    "entitasId" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_gtkId_key" ON "users"("gtkId");

-- CreateIndex
CREATE UNIQUE INDEX "tahun_ajaran_nama_key" ON "tahun_ajaran"("nama");

-- CreateIndex
CREATE UNIQUE INDEX "semester_kode_key" ON "semester"("kode");

-- CreateIndex
CREATE INDEX "semester_isAktif_idx" ON "semester"("isAktif");

-- CreateIndex
CREATE UNIQUE INDEX "semester_tahunAjaranId_tipe_key" ON "semester"("tahunAjaranId", "tipe");

-- CreateIndex
CREATE UNIQUE INDEX "sekolah_dapodikId_key" ON "sekolah"("dapodikId");

-- CreateIndex
CREATE UNIQUE INDEX "sekolah_npsn_key" ON "sekolah"("npsn");

-- CreateIndex
CREATE UNIQUE INDEX "gtk_dapodikId_key" ON "gtk"("dapodikId");

-- CreateIndex
CREATE UNIQUE INDEX "gtk_nuptk_key" ON "gtk"("nuptk");

-- CreateIndex
CREATE UNIQUE INDEX "gtk_nik_key" ON "gtk"("nik");

-- CreateIndex
CREATE INDEX "gtk_nama_idx" ON "gtk"("nama");

-- CreateIndex
CREATE UNIQUE INDEX "siswa_dapodikId_key" ON "siswa"("dapodikId");

-- CreateIndex
CREATE UNIQUE INDEX "siswa_nisn_key" ON "siswa"("nisn");

-- CreateIndex
CREATE INDEX "siswa_nama_idx" ON "siswa"("nama");

-- CreateIndex
CREATE INDEX "siswa_status_idx" ON "siswa"("status");

-- CreateIndex
CREATE UNIQUE INDEX "mapel_dapodikId_key" ON "mapel"("dapodikId");

-- CreateIndex
CREATE UNIQUE INDEX "mapel_kode_key" ON "mapel"("kode");

-- CreateIndex
CREATE UNIQUE INDEX "rombel_dapodikId_key" ON "rombel"("dapodikId");

-- CreateIndex
CREATE INDEX "rombel_semesterId_tingkat_idx" ON "rombel"("semesterId", "tingkat");

-- CreateIndex
CREATE UNIQUE INDEX "rombel_semesterId_nama_key" ON "rombel"("semesterId", "nama");

-- CreateIndex
CREATE INDEX "anggota_rombel_rombelId_idx" ON "anggota_rombel"("rombelId");

-- CreateIndex
CREATE UNIQUE INDEX "anggota_rombel_semesterId_siswaId_key" ON "anggota_rombel"("semesterId", "siswaId");

-- CreateIndex
CREATE UNIQUE INDEX "pembelajaran_dapodikId_key" ON "pembelajaran"("dapodikId");

-- CreateIndex
CREATE INDEX "pembelajaran_semesterId_gtkId_idx" ON "pembelajaran"("semesterId", "gtkId");

-- CreateIndex
CREATE UNIQUE INDEX "pembelajaran_rombelId_mapelId_key" ON "pembelajaran"("rombelId", "mapelId");

-- CreateIndex
CREATE UNIQUE INDEX "penilaian_pembelajaranId_kategori_urutan_key" ON "penilaian"("pembelajaranId", "kategori", "urutan");

-- CreateIndex
CREATE INDEX "nilai_siswaId_idx" ON "nilai"("siswaId");

-- CreateIndex
CREATE UNIQUE INDEX "nilai_penilaianId_siswaId_key" ON "nilai"("penilaianId", "siswaId");

-- CreateIndex
CREATE INDEX "nilai_rapor_siswaId_idx" ON "nilai_rapor"("siswaId");

-- CreateIndex
CREATE UNIQUE INDEX "nilai_rapor_pembelajaranId_siswaId_key" ON "nilai_rapor"("pembelajaranId", "siswaId");

-- CreateIndex
CREATE INDEX "arsip_nilai_nisn_idx" ON "arsip_nilai"("nisn");

-- CreateIndex
CREATE UNIQUE INDEX "arsip_nilai_semesterId_nisn_kodeMapel_key" ON "arsip_nilai"("semesterId", "nisn", "kodeMapel");

-- CreateIndex
CREATE INDEX "import_log_jenis_createdAt_idx" ON "import_log"("jenis", "createdAt");

-- CreateIndex
CREATE INDEX "audit_log_entitas_entitasId_idx" ON "audit_log"("entitas", "entitasId");

-- CreateIndex
CREATE INDEX "audit_log_createdAt_idx" ON "audit_log"("createdAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_gtkId_fkey" FOREIGN KEY ("gtkId") REFERENCES "gtk"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semester" ADD CONSTRAINT "semester_tahunAjaranId_fkey" FOREIGN KEY ("tahunAjaranId") REFERENCES "tahun_ajaran"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rombel" ADD CONSTRAINT "rombel_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semester"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rombel" ADD CONSTRAINT "rombel_waliKelasId_fkey" FOREIGN KEY ("waliKelasId") REFERENCES "gtk"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anggota_rombel" ADD CONSTRAINT "anggota_rombel_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semester"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anggota_rombel" ADD CONSTRAINT "anggota_rombel_rombelId_fkey" FOREIGN KEY ("rombelId") REFERENCES "rombel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anggota_rombel" ADD CONSTRAINT "anggota_rombel_siswaId_fkey" FOREIGN KEY ("siswaId") REFERENCES "siswa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pembelajaran" ADD CONSTRAINT "pembelajaran_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semester"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pembelajaran" ADD CONSTRAINT "pembelajaran_rombelId_fkey" FOREIGN KEY ("rombelId") REFERENCES "rombel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pembelajaran" ADD CONSTRAINT "pembelajaran_mapelId_fkey" FOREIGN KEY ("mapelId") REFERENCES "mapel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pembelajaran" ADD CONSTRAINT "pembelajaran_gtkId_fkey" FOREIGN KEY ("gtkId") REFERENCES "gtk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penilaian" ADD CONSTRAINT "penilaian_pembelajaranId_fkey" FOREIGN KEY ("pembelajaranId") REFERENCES "pembelajaran"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nilai" ADD CONSTRAINT "nilai_penilaianId_fkey" FOREIGN KEY ("penilaianId") REFERENCES "penilaian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nilai" ADD CONSTRAINT "nilai_siswaId_fkey" FOREIGN KEY ("siswaId") REFERENCES "siswa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nilai" ADD CONSTRAINT "nilai_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nilai_rapor" ADD CONSTRAINT "nilai_rapor_pembelajaranId_fkey" FOREIGN KEY ("pembelajaranId") REFERENCES "pembelajaran"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nilai_rapor" ADD CONSTRAINT "nilai_rapor_siswaId_fkey" FOREIGN KEY ("siswaId") REFERENCES "siswa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arsip_nilai" ADD CONSTRAINT "arsip_nilai_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_log" ADD CONSTRAINT "backup_log_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semester"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_log" ADD CONSTRAINT "backup_log_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_log" ADD CONSTRAINT "import_log_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semester"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_log" ADD CONSTRAINT "import_log_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- Constraint tambahan (tidak bisa diekspresikan di Prisma schema)
-- ============================================================================

-- Hanya boleh ada SATU semester aktif
CREATE UNIQUE INDEX "semester_single_aktif" ON "semester" ("isAktif") WHERE "isAktif" = true;

-- Hanya boleh ada SATU tahun ajaran aktif
CREATE UNIQUE INDEX "tahun_ajaran_single_aktif" ON "tahun_ajaran" ("isAktif") WHERE "isAktif" = true;

-- Rentang nilai 0-100
ALTER TABLE "nilai" ADD CONSTRAINT "nilai_range_chk" CHECK ("nilai" IS NULL OR ("nilai" >= 0 AND "nilai" <= 100));
ALTER TABLE "nilai_rapor" ADD CONSTRAINT "nilai_rapor_akhir_range_chk" CHECK ("nilaiAkhir" IS NULL OR ("nilaiAkhir" >= 0 AND "nilaiAkhir" <= 100));

-- Total bobot = 100
ALTER TABLE "pembelajaran" ADD CONSTRAINT "pembelajaran_bobot_chk" CHECK ("bobotHarian" + "bobotUts" + "bobotUas" = 100);

-- Akun GURU wajib tertaut ke GTK
ALTER TABLE "users" ADD CONSTRAINT "users_guru_gtk_chk" CHECK ("role" <> 'GURU' OR "gtkId" IS NOT NULL);
