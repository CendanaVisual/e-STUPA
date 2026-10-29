import { DashboardShell } from "@/components/layout/DashboardShell";
import type { NavItem } from "@/components/layout/SidebarNav";

const NAV: NavItem[] = [
  // Utama
  {
    href: "/admin",
    label: "Dashboard Ringkasan",
    icon: "fa-solid fa-chart-pie",
    category: "Utama",
  },
  {
    href: "/admin/kalender",
    label: "Kalender Akademik",
    icon: "fa-solid fa-calendar-days",
    category: "Utama",
  },

  // Manajemen Pengguna & Integrasi
  {
    href: "/admin/users",
    label: "Manajemen Akun Guru",
    icon: "fa-solid fa-users-gear",
    category: "Manajemen Pengguna",
  },
  {
    href: "/admin/impor",
    label: "Impor Data Dapodik",
    icon: "fa-solid fa-file-import",
    badge: "Excel",
    category: "Manajemen Pengguna",
  },

  // Data Master Sekolah
  {
    href: "/admin/master/sekolah",
    label: "Profil Sekolah",
    icon: "fa-solid fa-school",
    category: "Data Master Sekolah",
  },
  {
    href: "/admin/master/siswa",
    label: "Data Siswa",
    icon: "fa-solid fa-user-graduate",
    category: "Data Master Sekolah",
  },
  {
    href: "/admin/master/gtk",
    label: "Data GTK / Guru",
    icon: "fa-solid fa-chalkboard-user",
    category: "Data Master Sekolah",
  },
  {
    href: "/admin/master/rombel",
    label: "Rombel & Kelas",
    icon: "fa-solid fa-layer-group",
    category: "Data Master Sekolah",
  },
  {
    href: "/admin/master/mapel",
    label: "Mata Pelajaran",
    icon: "fa-solid fa-book-bookmark",
    category: "Data Master Sekolah",
  },
  {
    href: "/admin/master/ekskul",
    label: "Master Ekskul",
    icon: "fa-solid fa-medal",
    category: "Data Master Sekolah",
  },

  // Kesiswaan
  {
    href: "/admin/presensi",
    label: "Presensi Siswa",
    icon: "fa-solid fa-clipboard-user",
    badge: "Harian",
    category: "Kesiswaan & Presensi",
  },
  {
    href: "/admin/kesiswaan/prestasi",
    label: "Data Prestasi Murid",
    icon: "fa-solid fa-trophy",
    category: "Kesiswaan & Presensi",
  },
  {
    href: "/admin/kesiswaan/bk",
    label: "Bimbingan & Konseling",
    icon: "fa-solid fa-hand-holding-heart",
    category: "Kesiswaan & Presensi",
  },
  {
    href: "/admin/kesiswaan/jurnal",
    label: "Jurnal Perkembangan Murid",
    icon: "fa-solid fa-book-journal-whills",
    category: "Kesiswaan & Presensi",
  },

  // Penilaian & Asesmen
  {
    href: "/admin/pembelajaran",
    label: "Pembelajaran & Pengampu",
    icon: "fa-solid fa-chalkboard",
    category: "Penilaian & Rapor",
  },
  {
    href: "/admin/leger",
    label: "Leger Nilai Lengkap",
    icon: "fa-solid fa-list-check",
    category: "Penilaian & Rapor",
  },
  {
    href: "/admin/statistik",
    label: "Analisis & Statistik Nilai",
    icon: "fa-solid fa-chart-line",
    category: "Penilaian & Rapor",
  },
  {
    href: "/admin/ekskul",
    label: "Nilai Ekstrakurikuler",
    icon: "fa-solid fa-ranking-star",
    category: "Penilaian & Rapor",
  },
  {
    href: "/admin/tahun-ajaran",
    label: "Tahun Ajaran & Semester",
    icon: "fa-solid fa-calendar-check",
    badge: "2026/27",
    category: "Penilaian & Rapor",
  },
  {
    href: "/admin/backup",
    label: "Backup & Arsip Nilai",
    icon: "fa-solid fa-box-archive",
    category: "Penilaian & Rapor",
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell title="Superadmin" role="SUPERADMIN" nav={NAV}>
      {children}
    </DashboardShell>
  );
}
