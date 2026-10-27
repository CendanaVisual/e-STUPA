"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Dashboard Error]", error);
  }, [error]);

  const isMinifiedOrRSC =
    error?.message?.includes("Minified React error") ||
    error?.message?.includes("Server Components render") ||
    !error?.message;

  const displayMessage = isMinifiedOrRSC
    ? "Sesi akses Anda telah diperbarui atau koneksi server mengalami penyesuaian. Silakan muat ulang atau masuk kembali ke akun Anda."
    : error.message;

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-3xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center text-2xl shadow-sm mb-4">
        <i className="fa-solid fa-triangle-exclamation" />
      </div>

      <span className="px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs uppercase tracking-wider mb-2">
        Pemberitahuan Sistem
      </span>

      <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
        Gagal Memuat Halaman
      </h2>

      <p className="text-xs sm:text-sm text-slate-600 max-w-md mt-2 mb-2 leading-relaxed">
        {displayMessage}
      </p>

      {error?.digest && (
        <p className="font-mono text-[10px] text-slate-400 mb-6 bg-slate-100/80 px-2.5 py-1 rounded-md">
          Digest ID: {error.digest}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
        <button
          onClick={() => reset()}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-md shadow-blue-500/15 flex items-center gap-2 cursor-pointer"
        >
          <i className="fa-solid fa-arrows-rotate" />
          <span>Muat Ulang Halaman</span>
        </button>

        <a
          href="/admin"
          className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
        >
          <i className="fa-solid fa-gauge" />
          <span>Dashboard</span>
        </a>

        <a
          href="/login"
          className="px-5 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 text-emerald-700 text-xs font-bold transition flex items-center gap-1.5"
        >
          <i className="fa-solid fa-right-to-bracket" />
          <span>Masuk Ulang (Login)</span>
        </a>
      </div>
    </div>
  );
}
