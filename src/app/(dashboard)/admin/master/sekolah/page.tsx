import { db } from "@/lib/db";
import { updateProfilSekolah } from "@/server/actions/sekolah";

export default async function ProfilSekolahPage() {
  const sekolah = await db.sekolah.findFirst();

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="glass-light-panel rounded-3xl p-6 border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold">
            <i className="fa-solid fa-school mr-1" />
            Data Master Dapodik
          </span>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight mt-2">
            Profil Satuan Pendidikan
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Informasi identitas sekolah yang akan tercantum pada kop dan lembar ekspor resmi E-Rapor.
          </p>
        </div>
      </div>

      {/* Form Profil Sekolah */}
      <div className="glass-light-panel rounded-3xl p-6 sm:p-8 border border-slate-200/80">
        <form action={updateProfilSekolah} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nomor Pokok Sekolah Nasional (NPSN) *
              </label>
              <input
                type="text"
                name="npsn"
                required
                defaultValue={sekolah?.npsn || "50102030"}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nama Resmi Sekolah *
              </label>
              <input
                type="text"
                name="nama"
                required
                defaultValue={sekolah?.nama || "SMA Negeri 1 Nusantara"}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Bentuk Pendidikan
              </label>
              <select
                name="bentukPendidikan"
                defaultValue={sekolah?.bentukPendidikan || "SMA"}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="SD">SD (Sekolah Dasar)</option>
                <option value="SMP">SMP (Sekolah Menengah Pertama)</option>
                <option value="SMA">SMA (Sekolah Menengah Atas)</option>
                <option value="SMK">SMK (Sekolah Menengah Kejuruan)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Alamat Sekolah
              </label>
              <input
                type="text"
                name="alamat"
                defaultValue={sekolah?.alamat || "Jl. Pendidikan No. 1"}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nama Kepala Sekolah
              </label>
              <input
                type="text"
                name="namaKepsek"
                defaultValue={sekolah?.namaKepsek || "Drs. I Made Sujana, M.Pd."}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                NIP Kepala Sekolah
              </label>
              <input
                type="text"
                name="nipKepsek"
                defaultValue={sekolah?.nipKepsek || "197508152000031004"}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nomor Telepon
              </label>
              <input
                type="text"
                name="telepon"
                defaultValue={sekolah?.telepon || "(0361) 720123"}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Email Sekolah
              </label>
              <input
                type="email"
                name="email"
                defaultValue={sekolah?.email || "info@sekolah.sch.id"}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              className="py-2.5 px-6 rounded-xl btn-soft-primary text-xs font-bold flex items-center gap-2 cursor-pointer"
            >
              <i className="fa-solid fa-floppy-disk" />
              <span>Simpan Profil Sekolah</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
