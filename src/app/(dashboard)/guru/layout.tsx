import { DashboardShell } from "@/components/layout/DashboardShell";

const NAV = [
  { href: "/guru", label: "Dashboard" },
  { href: "/guru/kelas", label: "Kelas & Mapel Saya" },
  { href: "/guru/ekspor", label: "Ekspor E-Rapor" },
];

export default function GuruLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell title="Guru" role="GURU" nav={NAV}>
      {children}
    </DashboardShell>
  );
}
