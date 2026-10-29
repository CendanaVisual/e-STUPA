import { db } from "@/lib/db";
import {
  tambahBk,
  hapusBk,
} from "@/server/actions/kesiswaan";
import Link from "next/link";
import { safeFormatDate } from "@/lib/date";

export default async function GuruBkPage(props: {
  searchParams?: Promise<{ status?: string; q?: string; modal?: string }>;
}) {
  const sp = props?.searchParams ? await props.searchParams : {};
  const filterStatus = sp?.status || "Semua";
  const searchQ = (sp?.q || "").trim().toLowerCase();
  const isModalOpen = sp?.modal === "tambah";

  const activeSemester = await db.semester.findFirst({
    where: { isAktif: true },
    include: { tahunAjaran: true },
  });

  const bkList = activeSemester
    ? await db.bimbinganKonseling.findMany({
        where: {
          semesterId: activeSemester.id,
          ...(filterStatus !== "Semua" ? { status: filterStatus } : {}),
          ...(searchQ
            ? {
                siswa: {
                  nama: { contains: searchQ, mode: "insensitive" },
                },
              }
            : {}),
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
          guruBk: true,
        },
        orderBy: { tanggal: "desc" },
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

  const BK_STATUS_OPTIONS = [
    "Terbuka",
    "Dalam Pendampingan",
    "Terpantau",
    "Selesai",
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* HEADER SESUAI GAMBAR 4 */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
            Bimbingan & Konseling
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Catatan pendampingan murid dengan tingkat kerahasiaan berlapis. Daftar di bawah hanya menampilkan catatan sesuai hak akses Anda.
          </p>
        </div>

        <Link
          href="/guru/kesiswaan/bk?modal=tambah"
          className="px-5 py-2.5 rounded-full bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-xs shadow-md shadow-sky-600/20 flex items-center gap-2 transition"
        >
          <i className="fa-solid fa-plus text-xs" />
          <span>Catatan Baru</span>
        </Link>
      </div>

      {/* MAIN CONTAINER SESUAI GAMBAR 4 */}
      <div className="bg-white rounded-[2rem] p-4 md:p-6 shadow-xs border border-slate-200/90 space-y-4">
        {/* FILTER BAR DI DALAM PILL CONTAINER */}
        <form
          method="GET"
          className="flex flex-wrap items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100"
        >
          <select
            name="status"
            defaultValue={filterStatus}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 cursor-pointer focus:outline-none"
          >
            <option value="Semua">Semua Status Kasus</option>
            {BK_STATUS_OPTIONS.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          <div className="relative flex-1 min-w-[200px]">
            <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 text-xs" />
            <input
              type="text"
              name="q"
              defaultValue={searchQ}
              placeholder="Cari nama murid..."
              className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
          </div>

          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold shadow-xs hover:bg-slate-900 transition"
          >
            Cari & Filter
          </button>
        </form>

        {/* LIST CATATAN BK */}
        {bkList.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-bold">
            Tidak ada catatan BK yang dapat Anda akses.
          </div>
        ) : (
          <div className="space-y-3">
            {bkList.map((item) => {
              const isSelesai = item.status === "Selesai";
              const isTerbuka = item.status === "Terbuka";
              const kerahasiaan = item.kerahasiaan || "wali";

              return (
                <div
                  key={item.id}
                  className="border border-slate-100 hover:border-slate-200 rounded-2xl p-4 transition bg-white space-y-2"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
                        <i className="fa-solid fa-hand-holding-heart text-base" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-800 text-sm">
                            {item.siswa.nama}
                          </span>
                          <span className="text-slate-400 font-bold text-xs">
                            ({item.siswa.anggotaRombel[0]?.rombel?.nama ?? "-"})
                          </span>
                        </div>
                        <div className="text-[11px] font-bold text-slate-400">
                          {safeFormatDate(item.tanggal)} · {item.kategori} · dicatat oleh {item.guruBk?.nama || "Guru BK"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className="px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-500 flex items-center gap-1"
                        title="Tingkat Kerahasiaan"
                      >
                        <i className={`fa-solid ${kerahasiaan === "pribadi" ? "fa-lock" : kerahasiaan === "ringkas" ? "fa-eye-low-vision" : "fa-user-shield"}`} />
                        <span>{kerahasiaan === "pribadi" ? "Pribadi" : kerahasiaan === "ringkas" ? "Ringkasan" : "Wali & Kepsek"}</span>
                      </span>

                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                          isSelesai
                            ? "bg-emerald-100 text-emerald-700"
                            : isTerbuka
                            ? "bg-amber-100 text-amber-700"
                            : "bg-sky-100 text-sky-700"
                        }`}
                      >
                        {item.status}
                      </span>

                      <form action={hapusBk} className="inline">
                        <input type="hidden" name="id" value={item.id} />
                        <button
                          type="submit"
                          title="Hapus Catatan"
                          className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition cursor-pointer"
                        >
                          <i className="fa-solid fa-trash text-xs" />
                        </button>
                      </form>
                    </div>
                  </div>

                  <div className="ml-0 sm:ml-13 text-xs font-medium text-slate-600 bg-slate-50/70 p-3.5 rounded-xl border border-slate-100/90 space-y-1.5">
                    <div>
                      <strong className="text-slate-800">Kasus / Gejala:</strong> {item.permasalahan}
                    </div>
                    {item.tindakLanjut && (
                      <div className="text-slate-500">
                        <strong className="text-slate-700">Tindak Lanjut & Rekomendasi:</strong> {item.tindakLanjut}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL INPUT BK BARU */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-black text-slate-800">Catatan Bimbingan Baru</h2>
              <Link
                href="/guru/kesiswaan/bk"
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <i className="fa-solid fa-xmark text-sm" />
              </Link>
            </div>

            <form action={tambahBk} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Pilih Siswa</label>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Bidang Layanan</label>
                  <select
                    name="kategori"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none"
                  >
                    <option value="Belajar">Belajar / Akademik</option>
                    <option value="Perilaku">Perilaku / Kedisiplinan</option>
                    <option value="Pribadi">Pribadi</option>
                    <option value="Sosial">Sosial / Teman Sebaya</option>
                    <option value="Karier">Karier / Bakat Minat</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal</label>
                  <input
                    type="date"
                    name="tanggal"
                    defaultValue={new Date().toISOString().split("T")[0]}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Uraian Kasus / Permasalahan
                </label>
                <textarea
                  name="permasalahan"
                  required
                  rows={3}
                  placeholder="Deskripsikan gejala perilaku, kesulitan belajar, atau kendala siswa..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Rencana Tindak Lanjut
                </label>
                <textarea
                  name="tindakLanjut"
                  rows={2}
                  placeholder="Bimbingan berkala, konseling individu, komunikasi orang tua..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status Kasus</label>
                  <select
                    name="status"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none"
                  >
                    <option value="Terbuka">Terbuka</option>
                    <option value="Dalam Pendampingan">Dalam Pendampingan</option>
                    <option value="Terpantau">Terpantau</option>
                    <option value="Selesai">Selesai</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tingkat Kerahasiaan</label>
                  <select
                    name="kerahasiaan"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none"
                  >
                    <option value="wali">Wali Kelas & Kepsek</option>
                    <option value="ringkas">Ringkasan utk Guru</option>
                    <option value="pribadi">Pribadi Pencatat</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Link
                  href="/guru/kesiswaan/bk"
                  className="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-bold text-xs transition"
                >
                  Batal
                </Link>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-xs shadow-md transition"
                >
                  Simpan Catatan BK
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
