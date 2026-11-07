"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateKktpDanBobotAction } from "@/server/actions/penilaian";

export type KelasPembelajaranItem = {
  id: string;
  mapelNama: string;
  mapelKode: string;
  rombelNama: string;
  rombelTingkat: number;
  kktp: number;
  bobotHarian: number;
  bobotUts: number;
  bobotUas: number;
  semesterStatus: string;
};

export function KelasClient({ items }: { items: KelasPembelajaranItem[] }) {
  const router = useRouter();
  const [list, setList] = useState<KelasPembelajaranItem[]>(items);
  const [isPending, startTransition] = useTransition();

  const [editingItem, setEditingItem] = useState<KelasPembelajaranItem | null>(null);
  const [kktpVal, setKktpVal] = useState<number>(75);
  const [bobotHarianVal, setBobotHarianVal] = useState<number>(50);
  const [bobotUtsVal, setBobotUtsVal] = useState<number>(25);
  const [bobotUasVal, setBobotUasVal] = useState<number>(25);

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const openConfigModal = (item: KelasPembelajaranItem) => {
    setEditingItem(item);
    setKktpVal(item.kktp);
    setBobotHarianVal(item.bobotHarian);
    setBobotUtsVal(item.bobotUts);
    setBobotUasVal(item.bobotUas);
    setFeedback(null);
  };

  const totalBobot =
    (Number.isNaN(bobotHarianVal) ? 0 : bobotHarianVal) +
    (Number.isNaN(bobotUtsVal) ? 0 : bobotUtsVal) +
    (Number.isNaN(bobotUasVal) ? 0 : bobotUasVal);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setFeedback(null);

    startTransition(async () => {
      const res = await updateKktpDanBobotAction(editingItem.id, {
        kktp: kktpVal,
        bobotHarian: bobotHarianVal,
        bobotUts: bobotUtsVal,
        bobotUas: bobotUasVal,
      });

      if (!res.success) {
        setFeedback({ type: "error", message: res.message });
      } else {
        setList((prev) =>
          prev.map((it) =>
            it.id === editingItem.id
              ? {
                  ...it,
                  kktp: Math.round(kktpVal),
                  bobotHarian: Math.round(bobotHarianVal),
                  bobotUts: Math.round(bobotUtsVal),
                  bobotUas: Math.round(bobotUasVal),
                }
              : it
          )
        );
        setEditingItem(null);
        setFeedback({ type: "success", message: res.message });
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-5">
      {feedback && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between gap-3 border shadow-sm ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            <i
              className={`fa-solid ${
                feedback.type === "success"
                  ? "fa-circle-check text-emerald-600"
                  : "fa-triangle-exclamation text-rose-600"
              }`}
            />
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer text-xs"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      )}

      {list.length === 0 ? (
        <div className="glass-light-panel rounded-3xl p-12 text-center text-xs text-slate-400 border border-slate-200/80">
          <i className="fa-solid fa-chalkboard text-4xl text-slate-300 mb-3 block" />
          <p className="font-bold text-slate-700 text-sm">Belum ada penugasan mengajar.</p>
          <p className="text-slate-500 mt-1">
            Akun Anda belum di-plotting ke rombel pada semester aktif. Silakan hubungi Superadmin sekolah.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((p) => {
            const isLocked = p.semesterStatus !== "AKTIF";
            return (
              <div
                key={p.id}
                className="glass-light-card rounded-2xl p-5 border border-slate-200/90 hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-bold text-xs font-mono">
                      Kelas {p.rombelNama}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400">
                      Tingkat {p.rombelTingkat}
                    </span>
                  </div>
                  <Link href={`/guru/nilai/${p.id}`} className="group block">
                    <h3 className="text-base font-extrabold text-slate-800 group-hover:text-blue-700 transition">
                      {p.mapelNama}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">Kode: {p.mapelKode}</p>
                  </Link>

                  <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2 text-[11px]">
                    <div className="text-slate-600">
                      <span className="font-bold text-slate-800">KKTP {p.kktp}</span>
                      <span className="mx-1.5 text-slate-300">•</span>
                      <span>
                        Bobot {p.bobotHarian}/{p.bobotUts}/{p.bobotUas}%
                      </span>
                    </div>
                    {!isLocked && (
                      <button
                        type="button"
                        onClick={() => openConfigModal(p)}
                        title="Edit Mandiri KKTP & Bobot Asesmen"
                        className="px-2 py-1 rounded-lg bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-blue-700 font-bold text-[10px] inline-flex items-center gap-1 transition cursor-pointer shrink-0"
                      >
                        <i className="fa-solid fa-sliders text-[9px]" />
                        <span>Atur</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <Link
                    href={`/guru/nilai/${p.id}`}
                    className="text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1.5 transition"
                  >
                    <span>Input / Lihat Nilai</span>
                    <i className="fa-solid fa-arrow-right text-[11px]" />
                  </Link>
                  <span className="text-slate-400 text-[10px] font-mono">
                    Sinkron Superadmin
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL EDIT KKTP & BOBOT ASESMEN */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
                  <i className="fa-solid fa-sliders" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-800">
                    Atur KKTP &amp; Bobot Asesmen
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {editingItem.mapelNama} • Kelas {editingItem.rombelNama}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nilai KKTP Minimum (0 – 100) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  max={100}
                  value={kktpVal}
                  onChange={(e) => setKktpVal(parseInt(e.target.value || "0", 10))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 focus:bg-white border border-slate-200 text-sm font-mono font-extrabold text-blue-700 focus:outline-none focus:border-blue-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Batas ketuntasan minimal mata pelajaran ini untuk status Tuntas/Remedial &amp; deskripsi capaian TP.
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    Komposisi Bobot Nilai Akhir (%)
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold border ${
                      totalBobot === 100
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-rose-50 text-rose-700 border-rose-200"
                    }`}
                  >
                    Total: {totalBobot}% {totalBobot === 100 ? "✓" : "(Wajib 100%)"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Formatif / TP (%)
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      max={100}
                      value={bobotHarianVal}
                      onChange={(e) => setBobotHarianVal(parseInt(e.target.value || "0", 10))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 focus:bg-white border border-slate-200 text-xs font-mono font-bold text-center text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      SLM / STS (%)
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      max={100}
                      value={bobotUtsVal}
                      onChange={(e) => setBobotUtsVal(parseInt(e.target.value || "0", 10))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 focus:bg-white border border-slate-200 text-xs font-mono font-bold text-center text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      SAS (%)
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      max={100}
                      value={bobotUasVal}
                      onChange={(e) => setBobotUasVal(parseInt(e.target.value || "0", 10))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 focus:bg-white border border-slate-200 text-xs font-mono font-bold text-center text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-400 font-semibold mr-1">Preset cepat:</span>
                  {[
                    [50, 25, 25],
                    [40, 30, 30],
                    [60, 20, 20],
                    [34, 33, 33],
                  ].map(([h, u, s]) => (
                    <button
                      key={`${h}-${u}-${s}`}
                      type="button"
                      onClick={() => {
                        setBobotHarianVal(h);
                        setBobotUtsVal(u);
                        setBobotUasVal(s);
                      }}
                      className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 text-[10px] font-mono font-bold cursor-pointer transition"
                    >
                      {h}/{u}/{s}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/70 text-[11px] text-blue-800">
                <i className="fa-solid fa-arrows-rotate mr-1.5" />
                Hasil perubahan KKTP &amp; Bobot tersinkronisasi otomatis ke menu Pembelajaran &amp; Leger di Superadmin.
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending || totalBobot !== 100}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <i className={`fa-solid ${isPending ? "fa-spinner fa-spin" : "fa-check"}`} />
                  <span>{isPending ? "Menyimpan..." : "Simpan & Sinkronkan"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
