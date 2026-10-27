"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GuruPageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Guru Module Error]", error);
  }, [error]);

  const isMinifiedOrRSC =
    error?.message?.includes("Minified React error") ||
    error?.message?.includes("Server Components render") ||
    !error?.message;

  const displayMessage = isMinifiedOrRSC
    ? "Terjadi kendala saat memuat data modul ini. Halaman memerlukan data kelas atau penugasan semester aktif."
    : error.message;

  return (
    <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 sm:p-12 border border-slate-200/90 shadow-sm text-center max-w-xl mx-auto my-8 space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center text-2xl mx-auto shadow-xs">
        <i className="fa-solid fa-triangle-exclamation" />
      </div>

      <span className="px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs uppercase tracking-wider inline-block">
        Kendala Memuat Modul Guru
      </span>

      <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">
        Gagal Memuat Data Halaman
      </h2>

      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
        {displayMessage}
      </p>

      {error?.digest && (
        <p className="font-mono text-[10px] text-slate-400 bg-slate-100/80 px-2.5 py-1 rounded-md inline-block">
          Digest ID: {error.digest}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <button
          onClick={() => reset()}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-md shadow-blue-500/15 flex items-center gap-2 cursor-pointer"
        >
          <i className="fa-solid fa-arrows-rotate" />
          <span>Muat Ulang Modul</span>
        </button>

        <Link
          href="/guru"
          className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
        >
          <i className="fa-solid fa-house text-xs" />
          <span>Dashboard Guru</span>
        </Link>
      </div>
    </div>
  );
}
