# STUPA — Sistem Terpadu Untuk Penilaian Akademik

Web aplikasi pengolahan daftar nilai sekolah (skala internal) dengan impor data
Dapodik dan ekspor format Template Nilai E-Rapor.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Prisma 6 ·
Neon PostgreSQL · Vercel

---

## Arsitektur Singkat

| Lapisan | Isi | Lingkup |
| --- | --- | --- |
| **Master** | `Sekolah`, `Gtk`, `Siswa`, `Mapel` | Lintas semester, kunci upsert = ID Dapodik (NISN, NUPTK/NIK, ptk_id, dst.) |
| **Akademik** | `Rombel`, `AnggotaRombel`, `Pembelajaran`, `Penilaian`, `Nilai`, `NilaiRapor` | **Terikat ke `Semester`** |
| **Parameter** | `TahunAjaran`, `Semester` (status `DRAFT → AKTIF → DIKUNCI → ARSIP`) | Hanya 1 semester aktif (partial unique index) |
| **Arsip/Log** | `ArsipNilai` (snapshot denormalisasi), `BackupLog`, `ImportLog`, `AuditLog` | Historis |
| **Auth** | `User` (role `SUPERADMIN` / `GURU`, guru ⇄ `Gtk` 1:1) | — |

**RBAC data:** Guru → `Pembelajaran` (guru × mapel × rombel × semester) →
`Rombel` → `AnggotaRombel` → `Siswa`. Guru hanya bisa melihat/mengubah nilai
pada pembelajaran miliknya, dan hanya saat status semester `AKTIF`.

**Ganti semester/tahun ajaran:** buat `Semester` baru → kunci semester lama →
aktifkan semester baru → impor rombel Dapodik terbaru (atau salin rombel
Ganjil → Genap). Data master & nilai lama tetap utuh.

## Struktur Folder

```
e-stupa/
├─ prisma/
│  ├─ schema.prisma            # Skema database
│  ├─ migrations/              # Riwayat migrasi SQL (+ constraint tambahan)
│  └─ seed.ts                  # Superadmin awal + TA 2026/2027
├─ src/
│  ├─ proxy.ts                 # (pengganti middleware di Next 16) proteksi route per role
│  ├─ app/
│  │  ├─ (auth)/login/         # Halaman login
│  │  ├─ (dashboard)/
│  │  │  ├─ admin/             # Area SUPERADMIN
│  │  │  │  ├─ users/          #   manajemen akun guru
│  │  │  │  ├─ impor/          #   unggah file Dapodik (.xlsx/.csv)
│  │  │  │  ├─ master/{sekolah,siswa,gtk,rombel,mapel}/
│  │  │  │  ├─ pembelajaran/   #   penugasan guru-mapel-rombel
│  │  │  │  ├─ tahun-ajaran/   #   TA & semester, freeze, buka semester baru
│  │  │  │  └─ backup/         #   snapshot arsip & ekspor cadangan
│  │  │  └─ guru/              # Area GURU
│  │  │     ├─ kelas/          #   kelas & mapel yang diampu
│  │  │     ├─ nilai/[pembelajaranId]/  # input nilai harian/UTS/UAS
│  │  │     └─ ekspor/         #   unduh format E-Rapor
│  │  ├─ api/
│  │  │  ├─ admin/impor/[jenis]/        # POST impor Dapodik
│  │  │  └─ guru/ekspor/[pembelajaranId]/ # GET file .xlsx E-Rapor
│  │  └─ forbidden/            # 403
│  ├─ components/
│  │  ├─ layout/               # DashboardShell, sidebar
│  │  └─ ui/                   # komponen UI reusable
│  ├─ lib/
│  │  ├─ db.ts                 # Prisma singleton
│  │  ├─ auth/                 # jwt.ts (jose), session.ts (cookie), rbac.ts (akses data)
│  │  ├─ services/semester.ts  # siklus semester: aktifkan, kunci, salin rombel
│  │  ├─ grading/calc.ts       # kalkulasi nilai akhir berbobot
│  │  ├─ import/               # parser Excel + pemetaan kolom Dapodik + upsert
│  │  └─ export/erapor.ts      # generator .xlsx format E-Rapor
│  └─ server/actions/          # Server Actions (auth, nilai, master, ...)
└─ .env.example
```

## Menjalankan Secara Lokal

```bash
cp .env.example .env        # isi DATABASE_URL, SESSION_SECRET, SEED_*
npm install
npm run db:deploy           # terapkan migrasi ke database
npm run db:seed             # buat superadmin awal
npm run dev
```

## Deploy ke Vercel

1. Import repository ini di Vercel.
2. Isi Environment Variables: `DATABASE_URL` (dan opsional `SESSION_SECRET`).
3. Vercel otomatis menjalankan skrip `vercel-build`
   (`prisma generate && prisma migrate deploy && next build`).

## Roadmap

- [ ] Importer GTK, Rombel, Anggota Rombel, Pembelajaran
- [ ] Grid input nilai (client) + server action simpan & hitung `NilaiRapor`
- [ ] Sesuaikan `src/lib/export/erapor.ts` dengan template E-Rapor resmi sekolah
- [ ] Manajemen user guru (buat akun dari data GTK)
- [ ] Freeze semester → snapshot ke `ArsipNilai` + ekspor cadangan
