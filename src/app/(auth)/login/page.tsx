"use client";

import { useState, useActionState, useTransition } from "react";
import { login, type LoginState } from "@/server/actions/auth";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, undefined);

  // Client-side UI states
  const [username, setUsername] = useState("superadmin");
  const [password, setPassword] = useState("admin123");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [recoveryMethod, setRecoveryMethod] = useState<"email" | "wa">("email");
  const [recoveryIdentifier, setRecoveryIdentifier] = useState("");
  const [toast, setToast] = useState<{ title: string; desc: string; type?: "info" | "success" | "warn" } | null>(null);

  const showToastMsg = (title: string, desc: string, type: "info" | "success" | "warn" = "info") => {
    setToast({ title, desc, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.getModifierState && e.getModifierState("CapsLock")) {
      setCapsLockActive(true);
    } else {
      setCapsLockActive(false);
    }
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryIdentifier.trim()) return;
    setForgotStep(2);
    showToastMsg(
      "Kode Terkirim",
      `Kode verifikasi dikirim via ${recoveryMethod === "email" ? "Email Terdaftar" : "WhatsApp"} ke ${recoveryIdentifier}`,
      "success"
    );
  };

  const handleResetComplete = (e: React.FormEvent) => {
    e.preventDefault();
    setIsForgotModalOpen(false);
    setForgotStep(1);
    showToastMsg("Password Berhasil Direset", "Silakan gunakan password baru Anda untuk masuk.", "success");
  };

  return (
    <div className="relative min-h-screen bg-soft-pattern flex items-center justify-center p-4 sm:p-6 lg:p-10 overflow-x-hidden text-slate-800">
      {/* AMBIENT SOFT PASTEL GRADIENT BLOBS */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-28 -left-28 w-[32rem] h-[32rem] rounded-full bg-sky-200/60 blur-[110px] animate-blob-drift" />
        <div
          className="absolute top-1/4 -right-28 w-[30rem] h-[30rem] rounded-full bg-teal-200/50 blur-[120px] animate-blob-drift"
          style={{ animationDelay: "3s" }}
        />
        <div
          className="absolute -bottom-32 left-1/3 w-[34rem] h-[34rem] rounded-full bg-purple-200/45 blur-[130px] animate-blob-drift"
          style={{ animationDelay: "6s" }}
        />
        <div className="absolute bottom-12 right-1/4 w-72 h-72 rounded-full bg-rose-200/40 blur-[100px]" />
      </div>

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className="fixed top-5 right-5 z-[100] max-w-sm w-full pointer-events-auto bg-white/95 backdrop-blur-xl rounded-2xl p-4 border border-blue-200 shadow-xl flex items-start gap-3 transition-all duration-300">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0 mt-0.5 text-blue-600">
            <i className="fa-solid fa-circle-check text-base" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-extrabold text-slate-800">{toast.title}</p>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed font-medium">{toast.desc}</p>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-slate-700 text-xs"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      )}

      {/* MAIN LOGIN CARD */}
      <main className="relative z-10 w-full max-w-6xl glass-light-panel rounded-[2rem] overflow-hidden grid grid-cols-1 lg:grid-cols-12 border border-white/80 shadow-2xl">
        {/* Top Decorative Pastel Gradient Bar */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-500 via-teal-400 to-amber-400" />

        {/* LEFT COLUMN: VISUALISASI INTERAKTIF STUPA (7 Cols) */}
        <section className="lg:col-span-7 p-8 sm:p-12 lg:p-14 flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-sky-50/90 via-white/80 to-teal-50/70 border-b lg:border-b-0 lg:border-r border-slate-200/80">
          {/* Decorative Soft Circles */}
          <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-blue-100/60 blur-3xl pointer-events-none" />
          <div className="absolute top-16 right-12 w-44 h-44 rounded-full bg-teal-100/60 blur-2xl pointer-events-none" />

          {/* Top Header Badge & Headline STUPA */}
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/90 border border-blue-200/80 shadow-sm mb-7">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-xs font-bold tracking-wide uppercase text-blue-700">
                Manajemen Akademik Terintegrasi
              </span>
            </div>

            {/* BRAND CREST & HEADLINE UTAMA: STUPA */}
            <div className="flex items-start gap-5 mb-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-blue-600 via-blue-500 to-teal-500 p-[2px] shadow-xl shadow-blue-500/20 shrink-0 mt-1">
                <div className="w-full h-full bg-white rounded-[14px] flex flex-col items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-blue-50 to-transparent" />
                  <i className="fa-solid fa-graduation-cap text-2xl sm:text-3xl text-blue-600 relative z-10" />
                  <span className="text-[9px] font-mono tracking-widest text-blue-700 font-extrabold mt-0.5 relative z-10">
                    STUPA
                  </span>
                </div>
              </div>
              <div>
                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-stupa-gradient leading-none">
                  STUPA
                </h1>
                <h2 className="mt-2.5 text-lg sm:text-xl lg:text-2xl font-bold text-slate-800 tracking-tight leading-snug">
                  Sistem Terpadu Untuk Penilaian Akademik
                </h2>
              </div>
            </div>

            <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-xl mt-4">
              Dirancang secara terpadu untuk mengakomodir pengelolaan daftar nilai akademik di{" "}
              <span className="text-blue-700 font-semibold">satu sekolah secara menyeluruh</span>—mulai dari
              pengolahan nilai <span className="text-teal-700 font-semibold">Tujuan Pembelajaran (TP)</span>,{" "}
              <span className="text-blue-700 font-semibold">Sumatif Lingkup Materi (SLM)</span>,{" "}
              <span className="text-amber-600 font-semibold">Sumatif Akhir Semester (SAS)</span>, hingga sinkronisasi{" "}
              <span className="underline decoration-blue-400 decoration-2 underline-offset-4 font-semibold text-slate-700">
                E-Rapor Kemendikbud
              </span>
              .
            </p>
          </div>

          {/* FLOATING VISUAL CARDS: RINGKASAN SISTEM PENILAIAN 1 SEKOLAH */}
          <div className="relative z-10 my-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Floating Card 1 */}
            <div className="glass-light-card rounded-2xl p-5 animate-float-slow">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-sm">
                    <i className="fa-solid fa-school-flag" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Kapasitas Nilai</p>
                    <p className="text-sm font-bold text-slate-800">Rombel Terintegrasi</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono text-xs font-bold">
                  Skala Sekolah
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden mb-2.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 via-sky-400 to-emerald-400"
                  style={{ width: "95%" }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span>
                  <i className="fa-solid fa-circle-check text-emerald-500 mr-1" />
                  Sinkronisasi Nilai Real-Time
                </span>
              </div>
            </div>

            {/* Floating Card 2 */}
            <div className="glass-light-card rounded-2xl p-5 animate-float-delayed flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-teal-600 font-bold">
                    Otomatisasi Penilaian
                  </span>
                  <h3 className="text-base font-extrabold text-slate-800 mt-0.5">TP • SLM • SAS • E-Rapor</h3>
                  <p className="text-xs text-slate-500 mt-1">Kalkulasi nilai akhir & deskripsi capaian otomatis</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-500 shadow-sm shrink-0">
                  <i className="fa-solid fa-wand-magic-sparkles text-lg" />
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium flex items-center gap-1.5">
                  <i className="fa-solid fa-file-csv text-emerald-600" />
                  Format Ekspor Standar
                </span>
                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-mono text-[10px] font-bold">
                  TERPADU
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Highlights */}
          <div className="relative z-10 pt-4 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-5 flex-wrap font-medium">
              <span className="flex items-center gap-1.5 text-slate-600">
                <i className="fa-solid fa-table-cells text-blue-500" /> Olah Nilai Interaktif
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <i className="fa-solid fa-chart-pie text-teal-500" /> Analitik Ketuntasan KKTP
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <i className="fa-solid fa-shield-halved text-amber-500" /> Keamanan Data Terpusat
              </span>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: FORM LOGIN (5 Cols) */}
        <section className="lg:col-span-5 p-8 sm:p-11 lg:p-12 flex flex-col justify-center bg-white/95 relative">
          {/* Academic Period Indicator */}
          <div className="flex items-center justify-between gap-2 mb-7">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-semibold">
              <i className="fa-regular fa-calendar-check" />
              <span>Tahun Ajaran 2026/2027</span>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Server Aktif
            </span>
          </div>

          {/* Form Header */}
          <div className="mb-7">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
              Masuk ke Portal STUPA
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
              Silakan masukkan <span className="font-semibold text-slate-700">Username</span> dan{" "}
              <span className="font-semibold text-slate-700">Password</span> Anda untuk mengakses sistem pengolahan
              nilai akademik sekolah.
            </p>
          </div>

          {/* FORM LOGIN */}
          <form action={formAction} className="space-y-5">
            {/* ERROR ALERT */}
            {state?.error && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-3 shadow-sm">
                <i className="fa-solid fa-triangle-exclamation text-base mt-0.5 shrink-0 text-rose-500" />
                <div className="flex-1">
                  <p className="font-bold">Gagal Masuk</p>
                  <p className="mt-0.5">{state.error}</p>
                </div>
              </div>
            )}

            {/* FIELD 1: USERNAME */}
            <div>
              <label
                htmlFor="loginUsername"
                className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2"
              >
                1. Username / Email
              </label>
              <div className="relative flex items-center rounded-2xl bg-slate-50/90 border border-slate-200 input-soft-focus transition-all">
                <span className="pl-4 pr-3 text-slate-400">
                  <i className="fa-regular fa-user text-base" />
                </span>
                <input
                  type="text"
                  id="loginUsername"
                  name="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username atau email"
                  required
                  autoComplete="username"
                  className="w-full py-3.5 pr-10 bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none font-semibold"
                />
                {username && (
                  <button
                    type="button"
                    onClick={() => setUsername("")}
                    title="Bersihkan"
                    className="absolute right-3.5 text-slate-400 hover:text-slate-600 transition"
                  >
                    <i className="fa-solid fa-circle-xmark text-sm" />
                  </button>
                )}
              </div>
            </div>

            {/* FIELD 2: PASSWORD */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="loginPassword"
                  className="text-xs font-bold uppercase tracking-wider text-slate-600"
                >
                  2. Password
                </label>
                {capsLockActive && (
                  <span className="text-[11px] text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                    <i className="fa-solid fa-arrow-up-from-bracket mr-1" />
                    Caps Lock Aktif
                  </span>
                )}
              </div>
              <div className="relative flex items-center rounded-2xl bg-slate-50/90 border border-slate-200 input-soft-focus transition-all">
                <span className="pl-4 pr-3 text-slate-400">
                  <i className="fa-solid fa-lock text-sm" />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  id="loginPassword"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  required
                  autoComplete="current-password"
                  onKeyUp={handleKeyUp}
                  className="w-full py-3.5 pr-12 bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none font-semibold"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? "Sembunyikan Password" : "Tampilkan Password"}
                  className="absolute right-3 w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                >
                  <i className={showPassword ? "fa-regular fa-eye-slash text-blue-600" : "fa-regular fa-eye"} />
                </button>
              </div>
            </div>

            {/* FIELD 3: INGAT SAYA & LUPA PASSWORD */}
            <div className="flex items-center justify-between pt-1">
              <label className="inline-flex items-center gap-2.5 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  name="rememberMe"
                  defaultChecked
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30"
                />
                <span className="text-xs font-medium text-slate-600 group-hover:text-slate-800 transition">
                  Ingat Saya di perangkat ini
                </span>
              </label>

              <button
                type="button"
                onClick={() => {
                  setRecoveryIdentifier(username);
                  setIsForgotModalOpen(true);
                }}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 transition flex items-center gap-1.5 underline decoration-blue-300 hover:decoration-blue-600 underline-offset-4"
              >
                <i className="fa-solid fa-key text-[11px]" />
                <span>Lupa Password?</span>
              </button>
            </div>

            {/* TOMBOL SUBMIT */}
            <div className="pt-3">
              <button
                type="submit"
                disabled={pending}
                className="w-full py-4 px-6 rounded-2xl btn-soft-primary text-sm tracking-wide flex items-center justify-center gap-2.5 disabled:opacity-60 cursor-pointer"
              >
                {pending ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin text-base" />
                    <span>Memverifikasi Akses STUPA...</span>
                  </>
                ) : (
                  <>
                    <span>Masuk ke Sistem STUPA</span>
                    <i className="fa-solid fa-arrow-right-to-bracket" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Quick Review Help Badge */}
          <div className="mt-4 p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 text-[11px] text-slate-600 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <i className="fa-solid fa-key text-blue-600" />
              <span>Akun Uji Coba: <strong>superadmin</strong> / <strong>admin123</strong></span>
            </span>
            <button
              type="button"
              onClick={() => {
                setUsername("superadmin");
                setPassword("admin123");
                showToastMsg("Kredensial Dimuat", "Username dan password default telah diisi otomatis.", "info");
              }}
              className="text-blue-700 font-bold hover:underline"
            >
              Isi Otomatis
            </button>
          </div>

          {/* Security & Support Info Box */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-2">
              <i className="fa-solid fa-shield-check text-emerald-500 text-sm" />
              <span>Terhubung ke Basis Data Nilai Terpadu</span>
            </span>
            <span className="font-mono text-[11px] text-slate-400">STUPA v4.5</span>
          </div>
        </section>
      </main>

      {/* MODAL LUPA PASSWORD */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setIsForgotModalOpen(false)}
              className="absolute top-5 right-5 w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition"
            >
              <i className="fa-solid fa-xmark" />
            </button>

            {forgotStep === 1 ? (
              <div>
                <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 text-2xl mb-5 shadow-sm">
                  <i className="fa-solid fa-unlock-keyhole" />
                </div>
                <h3 className="text-xl font-extrabold text-slate-800">Pemulihan Kata Sandi STUPA</h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
                  Masukkan <span className="text-blue-600 font-semibold">Username</span> atau email terdaftar untuk
                  menerima kode verifikasi pemulihan.
                </p>

                <div className="mt-5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Saluran Pengiriman Kode
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setRecoveryMethod("email")}
                      className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                        recoveryMethod === "email"
                          ? "border-blue-300 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-800"
                      }`}
                    >
                      <i className="fa-regular fa-envelope text-sm" />
                      <span>Email Terdaftar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecoveryMethod("wa")}
                      className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                        recoveryMethod === "wa"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-800"
                      }`}
                    >
                      <i className="fa-brands fa-whatsapp text-base text-emerald-600" />
                      <span>Nomor WhatsApp</span>
                    </button>
                  </div>
                </div>

                <form onSubmit={handleForgotSubmit} className="mt-5 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      {recoveryMethod === "email" ? "Username atau Email Terdaftar" : "Nomor WhatsApp Terdaftar"}
                    </label>
                    <div className="relative flex items-center rounded-xl bg-slate-50 border border-slate-200 input-soft-focus">
                      <span className="pl-3.5 pr-2.5 text-blue-600">
                        <i
                          className={recoveryMethod === "email" ? "fa-regular fa-envelope" : "fa-brands fa-whatsapp"}
                        />
                      </span>
                      <input
                        type="text"
                        value={recoveryIdentifier}
                        onChange={(e) => setRecoveryIdentifier(e.target.value)}
                        placeholder={
                          recoveryMethod === "email"
                            ? "Masukkan username atau email"
                            : "Contoh: 081234567890"
                        }
                        required
                        className="w-full py-3 pr-4 bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none font-medium"
                      />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200/80 text-[11px] text-slate-600 flex items-start gap-2.5">
                    <i className="fa-solid fa-circle-info text-blue-500 mt-0.5" />
                    <span>
                      Sistem STUPA akan mengirimkan kode 6 digit untuk verifikasi identitas akun Anda.
                    </span>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsForgotModalOpen(false)}
                      className="w-1/3 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-600 transition"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="w-2/3 py-3 rounded-xl btn-soft-primary text-xs font-bold flex items-center justify-center gap-2"
                    >
                      <i className="fa-solid fa-paper-plane" />
                      <span>Kirim Kode</span>
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div>
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 text-2xl mb-4">
                  <i className="fa-solid fa-shield-check" />
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
                  Kode Verifikasi Terkirim
                </span>
                <h3 className="text-xl font-extrabold text-slate-800 mt-2">Atur Ulang Password Baru</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Kode telah dikirimkan ke <strong>{recoveryIdentifier}</strong>.
                </p>

                <form onSubmit={handleResetComplete} className="mt-4 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Kode Verifikasi (6 Digit)
                    </label>
                    <input
                      type="text"
                      defaultValue="240826"
                      maxLength={6}
                      required
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-50 border border-blue-300 text-center font-mono text-base tracking-[0.25em] text-blue-700 font-bold focus:outline-none focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Password Baru</label>
                    <input
                      type="password"
                      placeholder="Minimal 6 karakter"
                      defaultValue="admin123"
                      required
                      className="w-full py-2.5 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-xl btn-soft-emerald text-xs font-bold flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-check-double" />
                    <span>Simpan Password Baru & Masuk</span>
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
