import Link from "next/link";
import { Suspense } from "react";
import { logout, kembaliKeSuperadmin } from "@/server/actions/auth";
import { CurrentUserName, RoleGate } from "@/components/auth/RoleGate";
import { SidebarNav, type NavItem } from "./SidebarNav";
import {
  SidebarLayoutProvider,
  CollapsibleSidebarAside,
  SidebarHeaderHideButton,
  TopbarSidebarToggleButton,
} from "./SidebarLayoutClient";
import { getSemesterAktif } from "@/lib/services/semester";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import type { Role } from "@/lib/auth/jwt";

async function ActiveSemesterCardContent() {
  const sem = await getSemesterAktif();
  const taNama = sem?.tahunAjaran?.nama || "2026/2027";
  const tipeLabel =
    sem?.tipe === "GENAP"
      ? "Semester Genap"
      : sem?.tipe === "GANJIL"
      ? "Semester Ganjil"
      : "Belum Aktif";
  const statusLabel = sem?.status === "DIKUNCI" ? "Dikunci" : "Aktif";

  return (
    <>
      <div className="flex items-center justify-between text-[10px] text-blue-700 font-bold uppercase tracking-wider mb-1">
        <span>
          <i className="fa-solid fa-school mr-1" />
          SATUAN PENDIDIKAN
        </span>
        <span className="font-mono text-teal-700">T.A. {taNama}</span>
      </div>
      <p className="text-xs font-extrabold text-slate-800 truncate">
        Portal Penilaian Sekolah
      </p>
      <p className="text-[10px] text-slate-500 font-medium mt-0.5 flex items-center gap-1.5">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            sem?.status === "DIKUNCI" ? "bg-amber-500" : "bg-emerald-500"
          }`}
        />
        <span>
          {tipeLabel} • {statusLabel}
        </span>
      </p>
    </>
  );
}

async function TopbarTahunAjaranLabel() {
  const sem = await getSemesterAktif();
  const taNama = sem?.tahunAjaran?.nama || "2026/2027";
  const tipeLabel = sem?.tipe === "GENAP" ? "Genap" : "Ganjil";
  return (
    <span className="text-teal-600 font-medium">
      Tahun Ajaran {taNama} ({tipeLabel})
    </span>
  );
}

async function SidebarUserAvatar() {
  const session = await getSession();
  if (session?.gtkId) {
    try {
      const gtk = await db.gtk.findUnique({
        where: { id: session.gtkId },
        select: { fotoUrl: true, nama: true },
      });
      if (gtk?.fotoUrl) {
        return (
          <img
            src={gtk.fotoUrl}
            alt={gtk.nama}
            className="w-9 h-9 rounded-xl object-cover border border-blue-200 shrink-0"
          />
        );
      }
    } catch {
      // Fallback avatar default
    }
  }
  return (
    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-teal-500 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
      <i className="fa-regular fa-user" />
    </div>
  );
}

async function ImpersonationReturnControl() {
  const session = await getSession();
  if (!session?.impersonatedByAdminId) return null;

  return (
    <form action={kembaliKeSuperadmin}>
      <button
        type="submit"
        title="Kembali ke Dashboard Superadmin"
        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-[11px] font-bold transition inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
      >
        <i className="fa-solid fa-shield-halved text-[10px]" />
        <span>Kembali ke Superadmin</span>
      </button>
    </form>
  );
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
    <SidebarLayoutProvider>
    <div className="min-h-screen bg-soft-pattern flex flex-col lg:flex-row relative text-slate-800 selection:bg-blue-500/15 selection:text-blue-700">
      {/* AMBIENT SOFT PASTEL GRADIENT BLOBS */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-28 -left-28 w-[32rem] h-[32rem] rounded-full bg-sky-200/50 blur-[110px] animate-blob-drift" />
        <div
          className="absolute top-1/4 -right-28 w-[30rem] h-[30rem] rounded-full bg-teal-200/40 blur-[120px] animate-blob-drift"
          style={{ animationDelay: "3s" }}
        />
        <div
          className="absolute -bottom-32 left-1/3 w-[34rem] h-[34rem] rounded-full bg-purple-200/35 blur-[130px] animate-blob-drift"
          style={{ animationDelay: "6s" }}
        />
      </div>

      {/* LEFT SIDEBAR NAVIGATION (Bright & Soft Airy Sidebar) */}
      <CollapsibleSidebarAside>
        <div className="flex flex-col">
          {/* Brand Header */}
          <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between gap-2">
            <Link href={role === "SUPERADMIN" ? "/admin" : "/guru"} className="flex items-center gap-3.5 group min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-teal-500 p-[2px] shadow-md shadow-blue-500/15 group-hover:scale-105 transition-transform shrink-0">
                <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center">
                  <i className="fa-solid fa-graduation-cap text-blue-600 text-lg" />
                </div>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-extrabold text-stupa-gradient tracking-tight leading-none">
                    STUPA
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-mono text-[9px] font-bold">
                    TERPADU
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">Sistem Penilaian Akademik</p>
              </div>
            </Link>
            <SidebarHeaderHideButton />
          </div>

          {/* School Identity Card */}
          <div className="px-4 pt-4">
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-blue-50/90 via-sky-50/60 to-teal-50/80 border border-blue-200/70 shadow-xs">
              <Suspense
                fallback={
                  <div className="space-y-1.5">
                    <div className="h-3 w-32 bg-blue-100/60 rounded animate-pulse" />
                    <p className="text-xs font-extrabold text-slate-800 truncate">
                      Portal Penilaian Sekolah
                    </p>
                    <div className="h-2.5 w-24 bg-emerald-100/60 rounded animate-pulse" />
                  </div>
                }
              >
                <ActiveSemesterCardContent />
              </Suspense>
            </div>
          </div>

          {/* Navigation Menu */}
          <div className="p-4 overflow-y-auto max-h-[calc(100vh-280px)]">
            <Suspense fallback={<div className="h-40 rounded-xl bg-slate-100/50 animate-pulse" />}>
              <SidebarNav nav={nav} />
            </Suspense>
          </div>
        </div>

        {/* Active User Profile & Logout at Bottom */}
        <div className="p-4 border-t border-slate-200/80 space-y-2.5 bg-slate-50/80">
          <div className="p-2.5 rounded-2xl bg-white border border-slate-200/90 flex items-center gap-3 shadow-xs">
            <Suspense
              fallback={
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-teal-500 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                  <i className="fa-regular fa-user" />
                </div>
              }
            >
              <SidebarUserAvatar />
            </Suspense>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-extrabold text-slate-800 truncate">
                <CurrentUserName />
              </div>
              <p className="text-[10px] text-emerald-600 font-semibold truncate flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>{title} • Sesi Terverifikasi</span>
              </p>
            </div>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="w-full py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100/80 border border-rose-200 text-rose-700 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <i className="fa-solid fa-right-from-bracket" />
              <span>Keluar Sesi</span>
            </button>
          </form>
        </div>
      </CollapsibleSidebarAside>

      {/* MAIN WORKSPACE CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* TOPBAR HEADER */}
        <header className="bg-white/85 backdrop-blur-xl border-b border-slate-200/90 px-6 sm:px-8 py-3.5 sticky top-0 z-20 shadow-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-xs text-slate-500">
            <TopbarSidebarToggleButton />
            <span className="font-bold text-blue-700 uppercase tracking-wider text-[11px]">STUPA</span>
            <span>/</span>
            <span className="font-semibold text-slate-700">{title}</span>
            <span>/</span>
            <Suspense fallback={<span className="text-teal-600 font-medium">Memuat Semester...</span>}>
              <TopbarTahunAjaranLabel />
            </Suspense>
          </div>

          <div className="flex items-center gap-3">
            <Suspense fallback={null}>
              <ImpersonationReturnControl />
            </Suspense>

            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Server & Database Aktif</span>
            </div>

            <form action={logout}>
              <button
                type="submit"
                title="Keluar"
                className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-500 text-xs font-bold transition cursor-pointer"
              >
                <i className="fa-solid fa-power-off" />
              </button>
            </form>
          </div>
        </header>

        {/* WORKSPACE BODY */}
        <main className="flex-1 p-6 sm:p-8 space-y-6">
          <RoleGate roles={[role]}>{children}</RoleGate>
        </main>
      </div>
    </div>
    </SidebarLayoutProvider>
  );
}
