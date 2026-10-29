import { db } from "@/lib/db";
import {
  tambahEkskul,
  hapusEkskul,
  tambahPesertaEkskul,
  hapusPesertaEkskul,
} from "@/server/actions/ekskul";
import Link from "next/link";

export default async function AdminMasterEkskulPage(props: {
  searchParams?: Promise<{ tab?: string; ekskulId?: string; modal?: string }>;
}) {
  const sp = props?.searchParams ? await props.searchParams : {};
  const activeTab = sp?.tab || "master";
  const rawEkskulId = sp?.ekskulId;
  const isModalOpen = sp?.modal === "tambah";

  const activeSemester = await db.semester.findFirst({
    where: { isAktif: true },
    include: { tahunAjaran: true },
  });

  const taNama = activeSemester?.tahunAjaran?.nama ?? "2026/2027";

  const ekskulList = await db.ekstrakurikuler.findMany({
    orderBy: { nama: "asc" },
    include: {
      _count: { select: { nilaiEkskul: true } },
      nilaiEkskul: {
        where: activeSemester ? { semesterId: activeSemester.id } : undefined,
        include: {
          siswa: {
            include: {
              anggotaRombel: {
                where: activeSemester ? { semesterId: activeSemester.id } : undefined,
                include: { rombel: true },
              },
            },
          },
        },
      },
    },
  });

  const selectedEkskulId = rawEkskulId || ekskulList[0]?.id || "";
  const selectedEkskul = ekskulList.find((e) => e.id === selectedEkskulId);

  // Siswa aktif untuk pendaftaran peserta
  const allSiswa = activeSemester
    ? await db.siswa.findMany({
        where: {
          status: "AKTIF",
          anggotaRombel: { some: { semesterId: activeSemester.id } },
        },
        include: {
          anggotaRombel: {
            where: { semesterId: activeSemester.id },
            include: { rombel: true },
          },
        },
        orderBy: { nama: "asc" },
      })
    : [];

  const registeredSiswaIds = new Set(
    selectedEkskul?.nilaiEkskul.map((n) => n.siswaId) || []
  );
  const availableSiswa = allSiswa.filter((s) => !registeredSiswaIds.has(s.id));

  const TABS = [
    { id: "master", label: "Master Kegiatan", icon: "fa-solid fa-medal" },
    { id: "peserta", label: "Peserta", icon: "fa-solid fa-users" },
    { id: "sesi", label: "Sesi & Presensi", icon: "fa-solid fa-clipboard-user" },
    { id: "capaian", label: "Capaian Kegiatan", icon: "fa-solid fa-flag-checkered" },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
            Ekstrakurikuler
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Master kegiatan, peserta, sesi latihan, presensi, dan capaian — TA {taNama}.
          </p>
        </div>

        {activeTab !== "master" && (
          <form method="GET" className="flex items-center gap-2">
            <input type="hidden" name="tab" value={activeTab} />
            <select
              name="ekskulId"
              defaultValue={selectedEkskulId}
              className="bg-white border border-slate-200 rounded-full px-4 py-2.5 text-sm font-bold text-slate-700 cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">— Pilih Ekskul —</option>
              {ekskulList.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nama}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="px-3.5 py-2.5 rounded-full bg-slate-800 text-white text-xs font-bold shadow-xs hover:bg-slate-900 transition"
            >
              Pilih
            </button>
          </form>
        )}
      </div>

      {/* PILL NAVIGATION TABS */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {TABS.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <Link
              key={t.id}
              href={`/admin/master/ekskul?tab=${t.id}${selectedEkskulId ? `&ekskulId=${selectedEkskulId}` : ""}`}
              className={`px-4 py-2.5 rounded-full text-xs font-black whitespace-nowrap transition flex items-center gap-2 ${
                isActive
                  ? "bg-[#e11d48] text-white shadow-md shadow-rose-500/25"
                  : "bg-white text-slate-500 border border-slate-200 hover:border-rose-300 hover:text-rose-600"
              }`}
            >
              <i className={t.icon} />
              <span>{t.label}</span>
            </Link>
          );
        })}
      </div>

      {/* TAB 1: MASTER KEGIATAN */}
      {activeTab === "master" && (
        <div className="bg-white rounded-[2rem] p-5 md:p-7 shadow-xs border border-slate-200/90 space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-3 pb-3 border-b border-slate-100">
            <div className="text-xs font-black uppercase tracking-widest text-slate-400">
              {ekskulList.length} KEGIATAN · TA {taNama}
            </div>

            <Link
              href={`/admin/master/ekskul?tab=master&modal=tambah`}
              className="px-5 py-2.5 rounded-full bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-xs shadow-md shadow-sky-600/20 flex items-center gap-2 transition"
            >
              <i className="fa-solid fa-plus text-xs" />
              <span>Tambah Ekskul</span>
            </Link>
          </div>

          {ekskulList.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-bold">
              Belum ada kegiatan ekstrakurikuler.
            </div>
          ) : (
            <div className="space-y-3">
              {ekskulList.map((e) => {
                const pesertaCount = e._count?.nilaiEkskul ?? 0;
                const jadwalStr = `${e.hari || "-"}${e.jam ? ` (${e.jam})` : ""}`;

                return (
                  <div
                    key={e.id}
                    className="border border-slate-100 hover:border-slate-200 rounded-2xl p-4 transition bg-white group hover:shadow-xs"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                          <i className="fa-solid fa-medal text-lg" />
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-800 text-sm">{e.nama}</span>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                              {e.kategori || "Umum"}
                            </span>
                            {!e.isAktif && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-slate-100 text-slate-500 uppercase">
                                Nonaktif
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-bold text-slate-400 flex flex-wrap items-center gap-1.5">
                            <span>Pembina: <strong className="text-slate-600">{e.pembina || "-"}</strong></span>
                            <span>•</span>
                            <span className="text-sky-700 font-bold">{pesertaCount} peserta</span>
                            {e.kuota ? <span>/ {e.kuota} kuota</span> : null}
                            <span>•</span>
                            <span>Jadwal: {jadwalStr}</span>
                            {e.lokasi ? <span>• Lokasi: {e.lokasi}</span> : null}
                          </div>
                          {e.deskripsi && (
                            <p className="text-[11px] font-medium text-slate-500 mt-1 italic">
                              {e.deskripsi}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Link
                          href={`/admin/master/ekskul?tab=peserta&ekskulId=${e.id}`}
                          className="text-sky-700 bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-lg text-xs font-black transition"
                        >
                          Kelola
                        </Link>
                        <form action={hapusEkskul}>
                          <input type="hidden" name="id" value={e.id} />
                          <button
                            type="submit"
                            title="Hapus Kegiatan"
                            className="text-rose-500 bg-rose-50 hover:bg-rose-100 p-2 rounded-lg transition cursor-pointer"
                          >
                            <i className="fa-solid fa-trash text-xs" />
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PESERTA */}
      {activeTab === "peserta" && (
        <div className="bg-white rounded-[2rem] p-5 md:p-7 shadow-xs border border-slate-200/90 space-y-5">
          {!selectedEkskul ? (
            <div className="p-10 text-center text-slate-400 font-bold">
              Pilih kegiatan ekstrakurikuler terlebih dahulu (dropdown kanan atas), atau tambahkan lewat tab Master Kegiatan.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-black text-slate-800">
                    Daftar Peserta: {selectedEkskul.nama}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Total {selectedEkskul.nilaiEkskul.length} siswa terdaftar di kegiatan ini.
                  </p>
                </div>
              </div>

              {/* FORM PENDAFTARAN PESERTA BARU */}
              <form
                action={tambahPesertaEkskul}
                className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-wrap items-center gap-3"
              >
                <input type="hidden" name="ekskulId" value={selectedEkskul.id} />
                <div className="flex-1 min-w-[240px]">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Tambah Murid ke Ekskul Ini:
                  </label>
                  <select
                    name="siswaId"
                    required
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  >
                    <option value="">-- Pilih Siswa yang Belum Terdaftar --</option>
                    {availableSiswa.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nama} ({s.anggotaRombel[0]?.rombel?.nama ?? "-"}) - NISN: {s.nisn}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={availableSiswa.length === 0}
                  className="mt-5 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  <i className="fa-solid fa-user-plus mr-1.5" />
                  Daftarkan Peserta
                </button>
              </form>

              {/* TABEL PESERTA */}
              {selectedEkskul.nilaiEkskul.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-bold bg-slate-50/50 rounded-2xl border border-slate-100">
                  Belum ada peserta yang didaftarkan pada ekskul ini.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-100">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                        <th className="py-2.5 px-3">No</th>
                        <th className="py-2.5 px-3">NISN</th>
                        <th className="py-2.5 px-3">Nama Siswa</th>
                        <th className="py-2.5 px-3">Kelas</th>
                        <th className="py-2.5 px-3 text-center">Predikat</th>
                        <th className="py-2.5 px-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedEkskul.nilaiEkskul.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-2.5 px-3 font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-500">{item.siswa.nisn}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">{item.siswa.nama}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-600">
                            {item.siswa.anggotaRombel[0]?.rombel?.nama ?? "-"}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {item.predikat}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <form action={hapusPesertaEkskul} className="inline">
                              <input type="hidden" name="id" value={item.id} />
                              <button
                                type="submit"
                                title="Keluarkan Peserta"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              >
                                <i className="fa-solid fa-user-minus text-xs" />
                              </button>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SESI & PRESENSI */}
      {activeTab === "sesi" && (
        <div className="bg-white rounded-[2rem] p-5 md:p-7 shadow-xs border border-slate-200/90 space-y-4">
          {!selectedEkskul ? (
            <div className="p-10 text-center text-slate-400 font-bold">
              Pilih kegiatan ekstrakurikuler terlebih dahulu.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-slate-800">
                    Sesi Latihan & Presensi: {selectedEkskul.nama}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Jadwal rutin: {selectedEkskul.hari || "-"} ({selectedEkskul.jam || "-"}) • Pembina: {selectedEkskul.pembina || "-"}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200/80 text-center space-y-2">
                <i className="fa-solid fa-calendar-check text-3xl text-sky-500" />
                <h3 className="text-sm font-bold text-slate-700">Pencatatan Presensi Pertemuan</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Semua peserta ({selectedEkskul.nilaiEkskul.length} siswa) terhubung langsung dengan sistem penilaian capaian dan E-Rapor ekstrakurikuler.
                </p>
                <div className="pt-2">
                  <Link
                    href={`/admin/ekskul?ekskulId=${selectedEkskul.id}`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs transition"
                  >
                    <i className="fa-solid fa-ranking-star" />
                    Input Nilai Capaian E-Rapor
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: CAPAIAN KEGIATAN */}
      {activeTab === "capaian" && (
        <div className="bg-white rounded-[2rem] p-5 md:p-7 shadow-xs border border-slate-200/90 space-y-4">
          {!selectedEkskul ? (
            <div className="p-10 text-center text-slate-400 font-bold">
              Pilih kegiatan ekstrakurikuler terlebih dahulu.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-slate-800">
                    Capaian Kegiatan: {selectedEkskul.nama}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Kategori {selectedEkskul.kategori || "Umum"} — Ketercapaian kompetensi pengembangan diri.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {selectedEkskul.nilaiEkskul.map((n) => (
                  <div
                    key={n.id}
                    className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <span className="font-bold text-xs text-slate-800">{n.siswa.nama}</span>
                      <span className="text-[10px] text-slate-400 ml-2">
                        ({n.siswa.anggotaRombel[0]?.rombel?.nama ?? "-"})
                      </span>
                      <p className="text-xs text-slate-600 mt-1 italic">
                        &quot;{n.keterangan || "Aktif mengikuti setiap sesi latihan."}&quot;
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
                      {n.predikat}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL TAMBAH EKSKUL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-black text-slate-800">Tambah Kegiatan Ekskul Baru</h2>
              <Link
                href="/admin/master/ekskul"
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <i className="fa-solid fa-xmark text-sm" />
              </Link>
            </div>

            <form action={tambahEkskul} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Kegiatan</label>
                <input
                  type="text"
                  name="nama"
                  required
                  placeholder="Contoh: Praja Muda Karana (Pramuka)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kategori</label>
                  <select
                    name="kategori"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none"
                  >
                    <option value="Kepanduan">Kepanduan / Pramuka</option>
                    <option value="Olahraga">Olahraga & Kebugaran</option>
                    <option value="Kesenian">Kesenian & Budaya</option>
                    <option value="Sains">Sains & Riset</option>
                    <option value="Kemanusiaan / Kesehatan">Kemanusiaan (PMR)</option>
                    <option value="Keagamaan">Keagamaan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nama Pembina</label>
                  <input
                    type="text"
                    name="pembina"
                    placeholder="Nama guru / pelatih"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Hari Latihan</label>
                  <input
                    type="text"
                    name="hari"
                    placeholder="Contoh: Jumat"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Jam Latihan</label>
                  <input
                    type="text"
                    name="jam"
                    placeholder="14:30 - 16:30"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Lokasi Kegiatan</label>
                  <input
                    type="text"
                    name="lokasi"
                    placeholder="Lapangan / Lab / Aula"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kuota Maksimal</label>
                  <input
                    type="number"
                    name="kuota"
                    placeholder="30"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Deskripsi Kegiatan</label>
                <textarea
                  name="deskripsi"
                  rows={2}
                  placeholder="Keterangan singkat fokus pengembangan diri..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Link
                  href="/admin/master/ekskul"
                  className="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-bold text-xs transition"
                >
                  Batal
                </Link>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-xs shadow-md transition"
                >
                  Simpan Kegiatan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
