import { DashboardShell } from "@/components/layout/DashboardShell";
import type { NavItem } from "@/components/layout/SidebarNav";

const NAV: NavItem[] = [
  // Utama
  {
    href: "/guru",
    label: "Dashboard Guru",
    icon: "fa-solid fa-chart-pie",
    category: "Utama",
  },
  {
    href: "/guru/kalender",
    label: "Kalender Akademik",
    icon: "fa-solid fa-calendar-days",
    category: "Utama",
  },

  // Pembelajaran & Nilai
  {
    href: "/guru/kelas",
    label: "Kelas & Input Nilai",
    icon: "fa-solid fa-chalkboard-user",
    category: "Pembelajaran & Nilai",
  },
  {
    href: "/guru/presensi",
    label: "Presensi Harian",
    icon: "fa-solid fa-clipboard-user",
    category: "Pembelajaran & Nilai",
  },
  {
    href: "/guru/leger",
    label: "Leger Nilai Kelas",
    icon: "fa-solid fa-list-check",
    category: "Pembelajaran & Nilai",
  },
  {
    href: "/guru/ekskul",
    label: "Nilai Ekstrakurikuler",
    icon: "fa-solid fa-ranking-star",
    category: "Pembelajaran & Nilai",
  },
  {
    href: "/guru/ekspor",
    label: "Ekspor E-Rapor",
    icon: "fa-solid fa-file-export",
    badge: "Excel",
    category: "Pembelajaran & Nilai",
  },

  // Kesiswaan
  {
    href: "/guru/kesiswaan/prestasi",
    label: "Prestasi Murid",
    icon: "fa-solid fa-trophy",
    category: "Kesiswaan",
  },
  {
    href: "/guru/kesiswaan/bk",
    label: "Bimbingan & Konseling",
    icon: "fa-solid fa-hand-holding-heart",
    category: "Kesiswaan",
  },
  {
    href: "/guru/kesiswaan/jurnal",
    label: "Jurnal Sikap Murid",
    icon: "fa-solid fa-book-journal-whills",
    category: "Kesiswaan",
  },
];

export default function GuruLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell title="Guru Pengampu" role="GURU" nav={NAV}>
      {children}
    </DashboardShell>
  );
}
