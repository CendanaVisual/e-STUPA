import { db } from "@/lib/db";
import { createUser, toggleUserStatus } from "@/server/actions/users";
import { safeFormatDate } from "@/lib/date";

export default async function UsersManagementPage() {
  const [users, availableGtks] = await Promise.all([
    db.user.findMany({
      orderBy: [{ role: "asc" }, { createdAt: "desc" }],
      include: { gtk: true },
    }),
    db.gtk.findMany({
      where: { user: null },
      orderBy: { nama: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="glass-light-panel rounded-3xl p-6 border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-xs font-bold">
            <i className="fa-solid fa-users-gear mr-1" />
            Manajemen Akun Pengguna
          </span>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight mt-2">
            Kelola Akun Guru & Superadmin
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Atur akun login untuk pendidik agar dapat menginput nilai harian dan mengekspor format E-Rapor.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold font-mono">
            Total {users.length} Akun Terdaftar
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Tambah User Baru (4 Cols) */}
        <div className="lg:col-span-4 glass-light-panel rounded-3xl p-6 border border-slate-200/80 h-fit">
          <h3 className="text-base font-extrabold text-slate-800 mb-3 flex items-center gap-2">
            <i className="fa-solid fa-user-plus text-blue-600" />
            <span>Tambah Akun Baru</span>
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Buat username dan kata sandi baru untuk Pendidik atau Administrator.
          </p>

          <form action={createUser} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Peran Akun (Role)</label>
              <select
                name="role"
                defaultValue="GURU"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="GURU">Guru Pengampu</option>
                <option value="SUPERADMIN">Superadmin</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tautkan ke Data GTK (Opsional)</label>
              <select
                name="gtkId"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">-- Pilih GTK dari Dapodik --</option>
                {availableGtks.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nama} ({g.nuptk ? `NUPTK: ${g.nuptk}` : "NUPTK: -"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Username</label>
              <input
                type="text"
                name="username"
                required
                placeholder="mis. guru.budi"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 font-semibold focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
              <input
                type="password"
                name="password"
                required
                placeholder="Minimal 6 karakter"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 font-semibold focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl btn-soft-primary text-xs font-bold flex items-center justify-center gap-2 mt-4 cursor-pointer"
            >
              <i className="fa-solid fa-plus" />
              <span>Simpan Akun Baru</span>
            </button>
          </form>
        </div>

        {/* Tabel Daftar Pengguna (8 Cols) */}
        <div className="lg:col-span-8 glass-light-panel rounded-3xl p-6 border border-slate-200/80 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
              <i className="fa-solid fa-table-list text-purple-600" />
              <span>Daftar Akun Pengguna</span>
            </h3>
          </div>

          <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200/80">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3.5">Pengguna</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Data GTK Terhubung</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3.5">
                      <p className="font-bold text-slate-800">{u.username}</p>
                      <p className="text-[10px] text-slate-400">
                        {u.lastLoginAt
                          ? `Login: ${safeFormatDate(u.lastLoginAt)}`
                          : "Belum pernah login"}
                      </p>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          u.role === "SUPERADMIN"
                            ? "bg-purple-50 text-purple-700 border border-purple-200"
                            : "bg-blue-50 text-blue-700 border border-blue-200"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-700">
                      {u.gtk ? (
                        <span>
                          {u.gtk.nama}{" "}
                          <span className="text-[10px] text-slate-400 font-mono">
                            ({u.gtk.nuptk || "No NUPTK"})
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Tidak ditautkan</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] inline-flex items-center gap-1 ${
                          u.isActive
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            u.isActive ? "bg-emerald-500" : "bg-rose-500"
                          }`}
                        />
                        <span>{u.isActive ? "Aktif" : "Nonaktif"}</span>
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <form action={toggleUserStatus}>
                        <input type="hidden" name="userId" value={u.id} />
                        <button
                          type="submit"
                          className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-[11px] font-bold text-slate-600 transition cursor-pointer"
                        >
                          {u.isActive ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
