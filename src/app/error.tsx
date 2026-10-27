"use client";

import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Root Error]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center text-slate-800">
      <div className="w-16 h-16 rounded-3xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center text-2xl shadow-sm mb-4">
        <i className="fa-solid fa-triangle-exclamation" />
      </div>

      <h1 className="text-2xl font-black text-slate-900 tracking-tight">
        Terjadi Kesalahan Sistem
      </h1>

      <p className="text-xs sm:text-sm text-slate-500 max-w-md mt-2 mb-6">
        {error.message || "Aplikasi mengalami kendala sementara saat menghubungkan ke database atau memproses permintaan Anda."}
      </p>

      <div className="flex items-center gap-3">
        <button
          onClick={() => reset()}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-md shadow-blue-500/15 flex items-center gap-2 cursor-pointer"
        >
          <i className="fa-solid fa-arrows-rotate" />
          <span>Coba Lagi</span>
        </button>

        <a
          href="/login"
          className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 transition"
        >
          Ke Halaman Login
        </a>
      </div>
    </div>
  );
}
