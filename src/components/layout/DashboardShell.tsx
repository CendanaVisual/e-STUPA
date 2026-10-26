import Link from "next/link";
import { logout } from "@/server/actions/auth";
import { CurrentUserName, RoleGate } from "@/components/auth/RoleGate";
import type { Role } from "@/lib/auth/jwt";

export interface NavItem {
  href: string;
  label: string;
}

export function DashboardShell({
  title,
  role,
  nav,
  children,
}: {
  title: string;
  role: Role;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 bg-slate-900 p-4 text-slate-100">
        <div className="mb-6">
          <p className="text-lg font-bold">STUPA</p>
          <p className="text-xs text-slate-400">{title}</p>
        </div>
        <nav className="space-y-1">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="block rounded px-3 py-2 text-sm hover:bg-slate-800">
              {n.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-white px-6 py-3">
          <span className="text-sm text-slate-600">Masuk sebagai <CurrentUserName /></span>
          <form action={logout}>
            <button className="text-sm text-red-600 hover:underline">Keluar</button>
          </form>
        </header>
        <main className="flex-1 bg-slate-50 p-6">
          <RoleGate roles={[role]}>{children}</RoleGate>
        </main>
      </div>
    </div>
  );
}
