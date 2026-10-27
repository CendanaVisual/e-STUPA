import { db } from "@/lib/db";
import { tambahPrestasi, hapusPrestasi } from "@/server/actions/kesiswaan";

export default async function AdminPrestasiPage() {
  const activeSemester = await db.semester.findFirst({
    where: { isAktif: true },
    include: { tahunAjaran: true },
  });

  const prestasiList = activeSemester
    ? await db.prestasiSiswa.findMany({
        where: { semesterId: activeSemester.id },
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

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-bold text-[10px] tracking-wider uppercase">
              Kesiswaan
            </span>
            <span className="text-slate-400 text-xs">•</span>
            <span className="text-xs text-slate-500 font-medium">Rekapitulasi Prestasi</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Data Prestasi Murid
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Catatan prestasi akademik & non-akademik siswa dari tingkat sekolah hingga internasional.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* FORM INPUT PRESTASI */}
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-sm">
              <i className="fa-solid fa-trophy" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-800">Catat Prestasi Baru</h2>
              <p className="text-[11px] text-slate-400 font-medium">Rekam kejuaraan siswa</p>
            </div>
          </div>

          <form action={tambahPrestasi} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nama Siswa</label>
              <select
                name="siswaId"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                <option value="">-- Pilih Siswa --</option>
                {allSiswa.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nama} ({s.anggotaRombel[0]?.rombel.nama || "-"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nama Prestasi / Kejuaraan</label>
              <input
                type="text"
                name="namaPrestasi"
                required
                placeholder="Contoh: Olimpiade Sains Nasional Matematika"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kategori</label>
                <select
                  name="kategori"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none"
                >
                  <option value="Akademik">Akademik</option>
                  <option value="Non-Akademik">Non-Akademik</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tingkat</label>
                <select
                  name="tingkat"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none"
                >
                  <option value="Sekolah">Sekolah</option>
                  <option value="Kecamatan">Kecamatan</option>
                  <option value="Kabupaten/Kota">Kabupaten/Kota</option>
                  <option value="Provinsi">Provinsi</option>
                  <option value="Nasional">Nasional</option>
                  <option value="Internasional">Internasional</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Peringkat / Capaian</label>
                <input
                  type="text"
                  name="peringkat"
                  required
                  placeholder="Contoh: Juara 1 / Emas"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal</label>
                <input
                  type="date"
                  name="tanggal"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Penyelenggara</label>
              <input
                type="text"
                name="penyelenggara"
                placeholder="Contoh: Kemendikbudristek / Dinas Pendidikan"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold shadow-md shadow-amber-500/15 transition cursor-pointer"
            >
              Simpan Data Prestasi
            </button>
          </form>
        </div>

        {/* DAFTAR PRESTASI */}
        <div className="lg:col-span-2 bg-white/95 backdrop-blur-xl rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-extrabold text-slate-800">Daftar Prestasi Siswa Terdaftar</h2>
              <p className="text-[11px] text-slate-400 font-medium">Total {prestasiList.length} prestasi tercatat</p>
            </div>
          </div>

          {prestasiList.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <i className="fa-solid fa-trophy text-3xl text-slate-300" />
              <p className="text-xs font-bold text-slate-600">Belum ada catatan prestasi pada semester ini.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {prestasiList.map((p) => (
                <div
                  key={p.id}
                  className="p-4 rounded-2xl border border-slate-100 hover:border-slate-200 transition bg-slate-50/50 flex items-start justify-between gap-3 group"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-100/70 text-amber-600 flex items-center justify-center shrink-0">
                      <i className="fa-solid fa-award text-lg" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold text-slate-800">{p.namaPrestasi}</h3>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          {p.peringkat}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 font-semibold">
                        {p.siswa.nama} • {p.siswa.anggotaRombel[0]?.rombel.nama || "Tanpa Kelas"}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {p.kategori} • Tingkat {p.tingkat} {p.penyelenggara ? `• Oleh ${p.penyelenggara}` : ""}
                      </p>
                    </div>
                  </div>

                  <form action={hapusPrestasi}>
                    <input type="hidden" name="id" value={p.id} />
                    <button
                      type="submit"
                      title="Hapus"
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                    >
                      <i className="fa-solid fa-trash-can text-xs" />
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
