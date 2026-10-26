import { DashboardShell } from "@/components/layout/DashboardShell";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/users", label: "Manajemen User" },
  { href: "/admin/impor", label: "Impor Dapodik" },
  { href: "/admin/master/sekolah", label: "Profil Sekolah" },
  { href: "/admin/master/siswa", label: "Data Siswa" },
  { href: "/admin/master/gtk", label: "Data GTK" },
  { href: "/admin/master/rombel", label: "Rombel / Kelas" },
  { href: "/admin/master/mapel", label: "Mata Pelajaran" },
  { href: "/admin/pembelajaran", label: "Pembelajaran" },
  { href: "/admin/tahun-ajaran", label: "Tahun Ajaran & Semester" },
  { href: "/admin/backup", label: "Backup & Arsip" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell title="Superadmin" role="SUPERADMIN" nav={NAV}>
      {children}
    </DashboardShell>
  );
}
