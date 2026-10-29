import { db } from "@/lib/db";
import {
  tambahPrestasi,
  hapusPrestasi,
  setPrestasiStatus,
} from "@/server/actions/kesiswaan";
import Link from "next/link";
import { safeFormatDate } from "@/lib/date";

export default async function AdminPrestasiPage(props: {
  searchParams?: Promise<{ kat?: string; status?: string; tingkat?: string; modal?: string }>;
}) {
  const sp = props?.searchParams ? await props.searchParams : {};
  const filterKat = sp?.kat || "Semua";
  const filterStatus = sp?.status || "Semua";
  const filterTingkat = sp?.tingkat || "Semua";
  const isModalOpen = sp?.modal === "tambah";

  const activeSemester = await db.semester.findFirst({
    where: { isAktif: true },
    include: { tahunAjaran: true },
  });

  const prestasiList = activeSemester
    ? await db.prestasiSiswa.findMany({
        where: {
          semesterId: activeSemester.id,
          ...(filterKat !== "Semua" ? { kategori: filterKat } : {}),
          ...(filterStatus !== "Semua" ? { status: filterStatus } : {}),
          ...(filterTingkat !== "Semua" ? { tingkat: filterTingkat } : {}),
        },
        include: {
          siswa: {
            include: {
              anggotaRombel: {
                where: { semesterId: activeSemester.id },
                include: { rombel: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

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

  const TINGKAT_OPTIONS = [
    "Sekolah",
    "Kecamatan",
    "Kota/Kabupaten",
    "Provinsi",
    "Nasional",
    "Internasional",
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* HEADER SESUAI GAMBAR 3 */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
            Data Prestasi
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Prestasi akademik & nonakademik seluruh murid. Prestasi terverifikasi otomatis muncul di profil murid.
          </p>
        </div>

        <Link
          href="/admin/kesiswaan/prestasi?modal=tambah"
          className="px-5 py-2.5 rounded-full bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-xs shadow-md shadow-sky-600/20 flex items-center gap-2 transition"
        >
          <i className="fa-solid fa-plus text-xs" />
          <span>Tambah Prestasi</span>
        </Link>
      </div>

      {/* MAIN CONTAINER */}
      <div className="bg-white rounded-[2rem] p-4 md:p-6 shadow-xs border border-slate-200/90 space-y-4">
        {/* FILTER BAR DI DALAM PILL CONTAINER */}
        <form
          method="GET"
          className="flex flex-wrap items-center gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100"
        >
          <select
            name="kat"
            defaultValue={filterKat}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 cursor-pointer focus:outline-none"
          >
            <option value="Semua">Semua Kategori</option>
            <option value="Akademik">Akademik</option>
            <option value="Nonakademik">Nonakademik</option>
          </select>

          <select
            name="status"
            defaultValue={filterStatus}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 cursor-pointer focus:outline-none"
          >
            <option value="Semua">Semua Status</option>
            <option value="draft">Draft</option>
            <option value="terverifikasi">Terverifikasi</option>
            <option value="ditolak">Ditolak</option>
          </select>

          <select
            name="tingkat"
            defaultValue={filterTingkat}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 cursor-pointer focus:outline-none"
          >
            <option value="Semua">Semua Tingkat</option>
            {TINGKAT_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold shadow-xs hover:bg-slate-900 transition ml-auto"
          >
            Terapkan Filter
          </button>
        </form>

        {/* LIST DATA PRESTASI */}
        {prestasiList.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-bold">
            Belum ada data prestasi.
          </div>
        ) : (
          <div className="space-y-2.5">
            {prestasiList.map((p) => {
              const statusLower = (p.status || "terverifikasi").toLowerCase();
              const isTerverif = statusLower === "terverifikasi";
              const isDitolak = statusLower === "ditolak";

              return (
                <div
                  key={p.id}
                  className="border border-slate-100 hover:border-slate-200 rounded-2xl p-4 transition bg-white"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                        <i className="fa-solid fa-trophy text-base" />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-800 text-sm">
                            {p.namaPrestasi}
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            {p.kategori} {p.bidang ? `· ${p.bidang}` : ""}
                          </span>
                        </div>

                        <div className="text-xs font-semibold text-slate-600">
                          <span className="text-sky-700 font-bold">{p.siswa.nama}</span>
                          <span className="text-slate-400 ml-1">
                            ({p.siswa.anggotaRombel[0]?.rombel?.nama ?? "-"})
                          </span>
                          <span className="mx-1 text-slate-300">•</span>
                          <span className="text-slate-500 font-bold">
                            {p.tingkat} · {p.peringkat} · {safeFormatDate(p.tanggal)}
                          </span>
                        </div>

                        <div className="text-[11px] font-medium text-slate-400">
                          {p.penyelenggara ? `Penyelenggara: ${p.penyelenggara}` : ""}
                          {p.keterangan ? ` · ${p.keterangan}` : ""}
                          {p.buktiUrl && (
                            <>
                              {" · "}
                              <a
                                href={p.buktiUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sky-600 font-bold hover:underline"
                              >
                                Bukti <i className="fa-solid fa-arrow-up-right-from-square text-[9px]" />
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                          isTerverif
                            ? "bg-emerald-100 text-emerald-700"
                            : isDitolak
                            ? "bg-rose-100 text-rose-600"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {p.status || "Terverifikasi"}
                      </span>

                      {/* VERIFIKASI / TOLAK ACTIONS */}
                      {!isTerverif && (
                        <form action={setPrestasiStatus} className="inline">
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="status" value="terverifikasi" />
                          <button
                            type="submit"
                            title="Verifikasi Prestasi"
                            className="text-emerald-600 bg-emerald-50 hover:bg-emerald-100 p-2 rounded-lg transition cursor-pointer"
                          >
                            <i className="fa-solid fa-check text-xs" />
                          </button>
                        </form>
                      )}

                      {!isDitolak && (
                        <form action={setPrestasiStatus} className="inline">
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="status" value="ditolak" />
                          <button
                            type="submit"
                            title="Tolak Prestasi"
                            className="text-rose-500 bg-rose-50 hover:bg-rose-100 p-2 rounded-lg transition cursor-pointer"
                          >
                            <i className="fa-solid fa-xmark text-xs" />
                          </button>
                        </form>
                      )}

                      <form action={hapusPrestasi} className="inline">
                        <input type="hidden" name="id" value={p.id} />
                        <button
                          type="submit"
                          title="Hapus Data Prestasi"
                          className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition cursor-pointer"
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

      {/* MODAL INPUT PRESTASI */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-black text-slate-800">Tambah Prestasi Murid</h2>
              <Link
                href="/admin/kesiswaan/prestasi"
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <i className="fa-solid fa-xmark text-sm" />
              </Link>
            </div>

            <form action={tambahPrestasi} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Siswa</label>
                <select
                  name="siswaId"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                >
                  <option value="">-- Pilih Siswa --</option>
                  {allSiswa.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nama} ({s.anggotaRombel[0]?.rombel?.nama ?? "-"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Prestasi / Kejuaraan
                </label>
                <input
                  type="text"
                  name="namaPrestasi"
                  required
                  placeholder="Contoh: Olimpiade Sains Nasional Matematika"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kategori</label>
                  <select
                    name="kategori"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none"
                  >
                    <option value="Akademik">Akademik</option>
                    <option value="Nonakademik">Nonakademik</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Bidang Lomba</label>
                  <input
                    type="text"
                    name="bidang"
                    placeholder="Sains / Seni / Olahraga"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tingkat</label>
                  <select
                    name="tingkat"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none"
                  >
                    {TINGKAT_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Peringkat / Capaian</label>
                  <input
                    type="text"
                    name="peringkat"
                    required
                    placeholder="Juara 1 / Emas / Harapan 2"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal</label>
                  <input
                    type="date"
                    name="tanggal"
                    defaultValue={new Date().toISOString().split("T")[0]}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status Awal</label>
                  <select
                    name="status"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none"
                  >
                    <option value="terverifikasi">Terverifikasi</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Penyelenggara</label>
                <input
                  type="text"
                  name="penyelenggara"
                  placeholder="Kemendikbudristek / Dinas Pendidikan"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tautan Bukti / Piagam</label>
                <input
                  type="url"
                  name="buktiUrl"
                  placeholder="https://drive.google.com/..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Link
                  href="/admin/kesiswaan/prestasi"
                  className="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-bold text-xs transition"
                >
                  Batal
                </Link>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-xs shadow-md transition"
                >
                  Simpan Prestasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
