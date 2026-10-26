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

  // Data Master Dapodik
  {
    href: "/admin/master/sekolah",
    label: "Profil Sekolah",
    icon: "fa-solid fa-school",
    category: "Data Master Dapodik",
  },
  {
    href: "/admin/master/siswa",
    label: "Data Siswa",
    icon: "fa-solid fa-user-graduate",
    category: "Data Master Dapodik",
  },
  {
    href: "/admin/master/gtk",
    label: "Data GTK / Guru",
    icon: "fa-solid fa-chalkboard-user",
    category: "Data Master Dapodik",
  },
  {
    href: "/admin/master/rombel",
    label: "Rombel & Kelas",
    icon: "fa-solid fa-layer-group",
    category: "Data Master Dapodik",
  },
  {
    href: "/admin/master/mapel",
    label: "Mata Pelajaran",
    icon: "fa-solid fa-book-bookmark",
    category: "Data Master Dapodik",
  },

  // Akademik & Pengolahan Nilai
  {
    href: "/admin/pembelajaran",
    label: "Pembelajaran & Pengampu",
    icon: "fa-solid fa-chalkboard",
    category: "Akademik & Nilai",
  },
  {
    href: "/admin/tahun-ajaran",
    label: "Tahun Ajaran & Semester",
    icon: "fa-solid fa-calendar-days",
    badge: "2026/27",
    category: "Akademik & Nilai",
  },
  {
    href: "/admin/backup",
    label: "Backup & Arsip Nilai",
    icon: "fa-solid fa-box-archive",
    category: "Akademik & Nilai",
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell title="Superadmin" role="SUPERADMIN" nav={NAV}>
      {children}
    </DashboardShell>
  );
}
