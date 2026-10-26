import { DashboardShell } from "@/components/layout/DashboardShell";
import type { NavItem } from "@/components/layout/SidebarNav";

const NAV: NavItem[] = [
  {
    href: "/guru",
    label: "Dashboard Guru",
    icon: "fa-solid fa-chart-pie",
    category: "Utama",
  },
  {
    href: "/guru/kelas",
    label: "Kelas & Mapel Diampu",
    icon: "fa-solid fa-chalkboard-user",
    category: "Akademik & Nilai",
  },
  {
    href: "/guru/ekspor",
    label: "Ekspor E-Rapor",
    icon: "fa-solid fa-file-export",
    badge: "Excel",
    category: "Akademik & Nilai",
  },
];

export default function GuruLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell title="Guru Pengampu" role="GURU" nav={NAV}>
      {children}
    </DashboardShell>
  );
}
