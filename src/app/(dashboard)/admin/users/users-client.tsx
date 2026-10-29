"use client";

import { useState, useTransition } from "react";
import {
  createUser,
  updateUser,
  toggleUserStatus,
  resetUserPassword,
  deleteUser,
  autoGenerateTeacherAccounts,
} from "@/server/actions/users";
import { safeFormatDate } from "@/lib/date";

export type UserItem = {
  id: string;
  username: string;
  role: "SUPERADMIN" | "GURU";
  isActive: boolean;
  lastLoginAt: Date | string | null;
  gtkId: string | null;
  createdAt: Date | string;
  gtk: {
    id: string;
    nama: string;
    nuptk: string | null;
    nip: string | null;
    jenisPtk: string | null;
    isAktif: boolean;
  } | null;
};

export type GtkItem = {
  id: string;
  nama: string;
  nuptk: string | null;
  nip: string | null;
  jenisPtk: string | null;
  isAktif: boolean;
  user: {
    id: string;
    username: string;
  } | null;
};

interface UsersClientProps {
  initialUsers: UserItem[];
  allGtks: GtkItem[];
  currentUserId: string;
}

export function UsersClient({ initialUsers, allGtks, currentUserId }: UsersClientProps) {
  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const [isPending, startTransition] = useTransition();

  // Filters & Search
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "GURU" | "SUPERADMIN">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  // Notifications
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAutoModal, setShowAutoModal] = useState(false);

  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);

  // Form state: Add
  const [addForm, setAddForm] = useState({
    role: "GURU" as "GURU" | "SUPERADMIN",
    gtkId: "",
    username: "",
    password: "",
  });
  const [showAddPass, setShowAddPass] = useState(false);

  // Form state: Edit
  const [editForm, setEditForm] = useState({
    id: "",
    role: "GURU" as "GURU" | "SUPERADMIN",
    gtkId: "",
    username: "",
    isActive: true,
  });

  // Form state: Reset Password
  const [newPassword, setNewPassword] = useState("");
  const [showResetPass, setShowResetPass] = useState(false);

  // Computed data
  const gtksWithoutAccount = allGtks.filter((g) => !g.user && g.isAktif);
  const totalUsers = users.length;
  const guruCount = users.filter((u) => u.role === "GURU").length;
  const superadminCount = users.filter((u) => u.role === "SUPERADMIN").length;

  const filteredUsers = users.filter((u) => {
    // Role filter
    if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
    // Status filter
    if (statusFilter === "ACTIVE" && !u.isActive) return false;
    if (statusFilter === "INACTIVE" && u.isActive) return false;
    // Search
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const matchUsername = u.username.toLowerCase().includes(q);
    const matchGtk = u.gtk?.nama.toLowerCase().includes(q) || false;
    const matchNuptk = u.gtk?.nuptk?.toLowerCase().includes(q) || false;
    const matchNip = u.gtk?.nip?.toLowerCase().includes(q) || false;
    return matchUsername || matchGtk || matchNuptk || matchNip;
  });

  // Auto-fill username when selecting GTK in Add Form
  const handleSelectGtkForAdd = (gtkId: string) => {
    setAddForm((prev) => {
      let suggestedUsername = prev.username;
      if (gtkId) {
        const found = allGtks.find((g) => g.id === gtkId);
        if (found && !prev.username) {
          if (found.nuptk) {
            suggestedUsername = `guru.${found.nuptk.slice(-6)}`;
          } else {
            const clean = found.nama
              .toLowerCase()
              .replace(/[^a-z0-9]/g, ".")
              .split(".")
              .filter(Boolean)
              .slice(0, 2)
              .join(".");
            suggestedUsername = clean || "guru.pengampu";
          }
        }
      }
      return { ...prev, gtkId, username: suggestedUsername };
    });
  };

  // Submit Add User
  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      const res = await createUser({
        role: addForm.role,
        gtkId: addForm.gtkId || null,
        username: addForm.username,
        password: addForm.password,
      });

      if (!res.success) {
        setFeedback({ type: "error", message: res.message });
      } else {
        setFeedback({ type: "success", message: res.message });
        setShowAddModal(false);
        setAddForm({ role: "GURU", gtkId: "", username: "", password: "" });
        // Optimistic refresh
        const linkedGtk = allGtks.find((g) => g.id === addForm.gtkId);
        const newUser: UserItem = {
          id: `new-${Date.now()}`,
          username: addForm.username.toLowerCase().trim(),
          role: addForm.role,
          isActive: true,
          lastLoginAt: null,
          gtkId: addForm.gtkId || null,
          createdAt: new Date().toISOString(),
          gtk: linkedGtk || null,
        };
        setUsers((prev) => [newUser, ...prev]);
      }
    });
  };

  // Open Edit Modal
  const openEditModal = (u: UserItem) => {
    setSelectedUser(u);
    setEditForm({
      id: u.id,
      role: u.role,
      gtkId: u.gtkId || "",
      username: u.username,
      isActive: u.isActive,
    });
    setFeedback(null);
    setShowEditModal(true);
  };

  // Submit Edit User
  const handleUpdateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      const res = await updateUser({
        id: editForm.id,
        username: editForm.username,
        role: editForm.role,
        gtkId: editForm.gtkId || null,
        isActive: editForm.isActive,
      });

      if (!res.success) {
        setFeedback({ type: "error", message: res.message });
      } else {
        setFeedback({ type: "success", message: res.message });
        setShowEditModal(false);
        const linkedGtk = allGtks.find((g) => g.id === editForm.gtkId);
        setUsers((prev) =>
          prev.map((item) =>
            item.id === editForm.id
              ? {
                  ...item,
                  username: editForm.username.toLowerCase().trim(),
                  role: editForm.role,
                  gtkId: editForm.gtkId || null,
                  isActive: editForm.isActive,
                  gtk: linkedGtk || null,
                }
              : item
          )
        );
      }
    });
  };

  // Submit Toggle Status
  const handleToggleStatus = (u: UserItem) => {
    if (u.id === currentUserId) {
      setFeedback({ type: "error", message: "Anda tidak dapat menonaktifkan akun sendiri." });
      return;
    }

    startTransition(async () => {
      const res = await toggleUserStatus(u.id);
      if (!res.success) {
        setFeedback({ type: "error", message: res.message });
      } else {
        setFeedback({ type: "success", message: res.message });
        setUsers((prev) =>
          prev.map((item) =>
            item.id === u.id ? { ...item, isActive: !item.isActive } : item
          )
        );
      }
    });
  };

  // Open Reset Modal
  const openResetModal = (u: UserItem) => {
    setSelectedUser(u);
    setNewPassword("");
    setFeedback(null);
    setShowResetModal(true);
  };

  // Submit Reset Password
  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setFeedback(null);

    startTransition(async () => {
      const res = await resetUserPassword(selectedUser.id, newPassword);
      if (!res.success) {
        setFeedback({ type: "error", message: res.message });
      } else {
        setFeedback({ type: "success", message: res.message });
        setShowResetModal(false);
      }
    });
  };

  // Open Delete Modal
  const openDeleteModal = (u: UserItem) => {
    setSelectedUser(u);
    setFeedback(null);
    setShowDeleteModal(true);
  };

  // Submit Delete
  const handleDeleteUser = () => {
    if (!selectedUser) return;
    setFeedback(null);

    startTransition(async () => {
      const res = await deleteUser(selectedUser.id);
      if (!res.success) {
        setFeedback({ type: "error", message: res.message });
      } else {
        setFeedback({ type: "success", message: res.message });
        setShowDeleteModal(false);
        setUsers((prev) => prev.filter((item) => item.id !== selectedUser.id));
      }
    });
  };

  // Submit Auto-Generate
  const handleAutoGenerate = () => {
    setFeedback(null);

    startTransition(async () => {
      const res = await autoGenerateTeacherAccounts("guru123456");
      if (!res.success) {
        setFeedback({ type: "error", message: res.message });
      } else {
        setFeedback({ type: "success", message: res.message });
        setShowAutoModal(false);
        // Page will refresh via server action revalidatePath or window reload
        window.location.reload();
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Banner Notifikasi Pesan */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between gap-3 border shadow-sm transition-all ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
            <i
              className={`fa-solid ${
                feedback.type === "success"
                  ? "fa-circle-check text-emerald-600 text-base"
                  : "fa-triangle-exclamation text-rose-600 text-base"
              }`}
            />
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer text-xs"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      )}

      {/* Top Banner & Ringkasan Metrik */}
      <div className="glass-light-panel rounded-3xl p-6 border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold">
            <i className="fa-solid fa-users-gear" />
            <span>Manajemen Pengguna & Hak Akses</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight mt-2">
            Kelola Akun Guru & Superadmin
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
            Atur kredensial login pendidik agar dapat menginput nilai harian, absensi kelas, jurnal perkembangan, serta ekspor format E-Rapor.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {gtksWithoutAccount.length > 0 && (
            <button
              onClick={() => setShowAutoModal(true)}
              className="py-2.5 px-4 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <i className="fa-solid fa-wand-magic-sparkles text-amber-600" />
              <span>Auto Buat Akun ({gtksWithoutAccount.length} GTK)</span>
            </button>
          )}

          <button
            onClick={() => {
              setFeedback(null);
              setShowAddModal(true);
            }}
            className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md shadow-blue-500/20"
          >
            <i className="fa-solid fa-plus" />
            <span>+ Tambah Akun Baru</span>
          </button>
        </div>
      </div>

      {/* 4 Kartu Statistik Cepat */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center text-lg font-bold">
            <i className="fa-solid fa-users" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Akun</p>
            <p className="text-xl font-extrabold text-slate-800">{totalUsers}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center text-lg font-bold">
            <i className="fa-solid fa-chalkboard-user" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Akun Guru</p>
            <p className="text-xl font-extrabold text-slate-800">{guruCount}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-200 text-purple-600 flex items-center justify-center text-lg font-bold">
            <i className="fa-solid fa-shield-halved" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Superadmin</p>
            <p className="text-xl font-extrabold text-slate-800">{superadminCount}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-lg font-bold">
            <i className="fa-solid fa-user-clock" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">GTK Belum Ada Akun</p>
            <p className="text-xl font-extrabold text-slate-800">{gtksWithoutAccount.length}</p>
          </div>
        </div>
      </div>

      {/* Filter & Bar Pencarian */}
      <div className="bg-slate-100/70 p-3 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[260px]">
          <div className="relative flex-1 min-w-[180px] max-w-md">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari username, nama guru, atau NUPTK..."
              className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-700 font-semibold focus:outline-none focus:border-blue-500 shadow-xs"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            )}
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as "ALL" | "GURU" | "SUPERADMIN")}
            className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 shadow-xs cursor-pointer"
          >
            <option value="ALL">Semua Role</option>
            <option value="GURU">Guru Pengampu</option>
            <option value="SUPERADMIN">Superadmin</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "INACTIVE")}
            className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 shadow-xs cursor-pointer"
          >
            <option value="ALL">Semua Status</option>
            <option value="ACTIVE">Hanya Aktif</option>
            <option value="INACTIVE">Hanya Nonaktif</option>
          </select>
        </div>

        <div className="text-xs font-bold text-slate-500 font-mono">
          Menampilkan {filteredUsers.length} dari {totalUsers} akun
        </div>
      </div>

      {/* Tabel Data Akun */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider">
                <th className="py-3.5 px-4">Pengguna</th>
                <th className="py-3.5 px-3">Peran (Role)</th>
                <th className="py-3.5 px-3">Data GTK Terhubung</th>
                <th className="py-3.5 px-3 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center text-xl mx-auto mb-2">
                      <i className="fa-solid fa-user-slash" />
                    </div>
                    <p className="font-bold text-slate-600 text-sm">Tidak ada data pengguna yang sesuai</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Coba sesuaikan kata kunci pencarian atau bersihkan filter.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrent = u.id === currentUserId;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition group">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs uppercase shadow-xs ${
                              u.role === "SUPERADMIN"
                                ? "bg-purple-100 text-purple-700 border border-purple-200"
                                : "bg-blue-100 text-blue-700 border border-blue-200"
                            }`}
                          >
                            {u.username.slice(0, 2)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800 text-xs sm:text-sm">
                                {u.username}
                              </span>
                              {isCurrent && (
                                <span className="px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800 text-[10px] font-extrabold border border-cyan-200">
                                  Akun Anda
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                              <i className="fa-regular fa-clock text-[10px]" />
                              <span>
                                {u.lastLoginAt
                                  ? `Login: ${safeFormatDate(u.lastLoginAt)}`
                                  : "Belum pernah login"}
                              </span>
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <span
                          className={`px-2.5 py-1 rounded-full font-bold text-[10px] uppercase tracking-wide inline-flex items-center gap-1.5 ${
                            u.role === "SUPERADMIN"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}
                        >
                          <i
                            className={`fa-solid ${
                              u.role === "SUPERADMIN" ? "fa-shield-halved" : "fa-chalkboard-user"
                            }`}
                          />
                          <span>{u.role === "SUPERADMIN" ? "Superadmin" : "Guru"}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        {u.gtk ? (
                          <div>
                            <p className="font-bold text-slate-700 flex items-center gap-1.5">
                              <i className="fa-solid fa-link text-blue-500 text-[10px]" />
                              <span>{u.gtk.nama}</span>
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {u.gtk.nuptk ? `NUPTK: ${u.gtk.nuptk}` : u.gtk.nip ? `NIP: ${u.gtk.nip}` : "Tanpa NUPTK/NIP"}
                            </p>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic flex items-center gap-1">
                            <i className="fa-solid fa-link-slash text-slate-300" />
                            <span>Tidak ditautkan ke GTK</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] inline-flex items-center gap-1.5 ${
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

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Toggle status */}
                          <button
                            onClick={() => handleToggleStatus(u)}
                            disabled={isPending || isCurrent}
                            title={u.isActive ? "Nonaktifkan Akun" : "Aktifkan Akun"}
                            className={`w-7 h-7 rounded-lg border flex items-center justify-center text-xs transition cursor-pointer ${
                              isCurrent
                                ? "opacity-30 cursor-not-allowed border-slate-200 text-slate-400"
                                : u.isActive
                                ? "border-amber-200 text-amber-600 hover:bg-amber-50"
                                : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                            }`}
                          >
                            <i className={`fa-solid ${u.isActive ? "fa-power-off" : "fa-check"}`} />
                          </button>

                          {/* Reset Password */}
                          <button
                            onClick={() => openResetModal(u)}
                            disabled={isPending}
                            title="Reset Kata Sandi"
                            className="w-7 h-7 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center justify-center text-xs transition cursor-pointer"
                          >
                            <i className="fa-solid fa-key text-[11px]" />
                          </button>

                          {/* Edit Akun */}
                          <button
                            onClick={() => openEditModal(u)}
                            disabled={isPending}
                            title="Edit Akun & Tautan GTK"
                            className="w-7 h-7 rounded-lg border border-slate-200 text-blue-600 hover:bg-blue-50 flex items-center justify-center text-xs transition cursor-pointer"
                          >
                            <i className="fa-solid fa-pen-to-square text-[11px]" />
                          </button>

                          {/* Hapus */}
                          <button
                            onClick={() => openDeleteModal(u)}
                            disabled={isPending || isCurrent}
                            title="Hapus Akun"
                            className={`w-7 h-7 rounded-lg border flex items-center justify-center text-xs transition cursor-pointer ${
                              isCurrent
                                ? "opacity-30 cursor-not-allowed border-slate-200 text-slate-400"
                                : "border-rose-200 text-rose-600 hover:bg-rose-50"
                            }`}
                          >
                            <i className="fa-regular fa-trash-can text-[11px]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= MODAL TAMBAH AKUN ================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center text-base">
                  <i className="fa-solid fa-user-plus" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">Tambah Akun Baru</h3>
                  <p className="text-[11px] text-slate-400">Buat kredensial login pengguna STUPA</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Peran Akun (Role) <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAddForm((prev) => ({ ...prev, role: "GURU" }))}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition ${
                      addForm.role === "GURU"
                        ? "bg-blue-50 border-blue-500 text-blue-700 shadow-xs"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <i className="fa-solid fa-chalkboard-user" />
                    <span>Guru Pengampu</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddForm((prev) => ({ ...prev, role: "SUPERADMIN" }))}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition ${
                      addForm.role === "SUPERADMIN"
                        ? "bg-purple-50 border-purple-500 text-purple-700 shadow-xs"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <i className="fa-solid fa-shield-halved" />
                    <span>Superadmin</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tautkan ke Data GTK Pendidik (Opsional)
                </label>
                <select
                  value={addForm.gtkId}
                  onChange={(e) => handleSelectGtkForAdd(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
                >
                  <option value="">-- Tanpa Tautan GTK (Belum Ditautkan) --</option>
                  {allGtks.map((g) => {
                    const isTaken = !!g.user;
                    return (
                      <option key={g.id} value={g.id} disabled={isTaken}>
                        {g.nama} {g.nuptk ? `(NUPTK: ${g.nuptk})` : ""} {isTaken ? `[Sudah punya akun: ${g.user?.username}]` : "✓ Siap ditautkan"}
                      </option>
                    );
                  })}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Menautkan akun ke GTK memungkinkan guru otomatis melihat jadwal mengajar & rombelnya.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Username <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={addForm.username}
                  onChange={(e) =>
                    setAddForm((prev) => ({ ...prev, username: e.target.value.toLowerCase().trim() }))
                  }
                  placeholder="mis. guru.budi atau budi123"
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Hanya huruf kecil, angka, titik, strip (-), atau garis bawah (_). Minimal 3 karakter.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kata Sandi (Password) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showAddPass ? "text" : "password"}
                    required
                    value={addForm.password}
                    onChange={(e) => setAddForm((prev) => ({ ...prev, password: e.target.value }))}
                    placeholder="Minimal 6 karakter"
                    className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAddPass(!showAddPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                  >
                    <i className={`fa-solid ${showAddPass ? "fa-eye-slash" : "fa-eye"}`} />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md shadow-blue-500/20 disabled:opacity-60"
                >
                  {isPending ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-check" />
                      <span>Simpan Akun Baru</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL EDIT AKUN ================= */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center text-base">
                  <i className="fa-solid fa-pen-to-square" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">Edit Akun Pengguna</h3>
                  <p className="text-[11px] text-slate-400">Ubah peran, username, dan tautan data GTK</p>
                </div>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Peran Akun</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditForm((prev) => ({ ...prev, role: "GURU" }))}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition ${
                      editForm.role === "GURU"
                        ? "bg-blue-50 border-blue-500 text-blue-700 shadow-xs"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <i className="fa-solid fa-chalkboard-user" />
                    <span>Guru Pengampu</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditForm((prev) => ({ ...prev, role: "SUPERADMIN" }))}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition ${
                      editForm.role === "SUPERADMIN"
                        ? "bg-purple-50 border-purple-500 text-purple-700 shadow-xs"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <i className="fa-solid fa-shield-halved" />
                    <span>Superadmin</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tautkan ke Data GTK</label>
                <select
                  value={editForm.gtkId}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, gtkId: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
                >
                  <option value="">-- Tanpa Tautan GTK (Belum Ditautkan) --</option>
                  {allGtks.map((g) => {
                    const isTaken = !!g.user && g.user.id !== selectedUser.id;
                    return (
                      <option key={g.id} value={g.id} disabled={isTaken}>
                        {g.nama} {g.nuptk ? `(NUPTK: ${g.nuptk})` : ""} {isTaken ? `[Sudah ditautkan ke ${g.user?.username}]` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={editForm.username}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, username: e.target.value.toLowerCase().trim() }))
                  }
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Status Keaktifan</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="isActive"
                      checked={editForm.isActive}
                      onChange={() => setEditForm((prev) => ({ ...prev, isActive: true }))}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-bold text-slate-700">Aktif</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="isActive"
                      checked={!editForm.isActive}
                      onChange={() => setEditForm((prev) => ({ ...prev, isActive: false }))}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span className="text-xs font-bold text-slate-700">Nonaktif</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md shadow-blue-500/20 disabled:opacity-60"
                >
                  {isPending ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-check" />
                      <span>Simpan Perubahan</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL RESET PASSWORD ================= */}
      {showResetModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-base">
                  <i className="fa-solid fa-key" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">Reset Kata Sandi</h3>
                  <p className="text-[11px] text-slate-400">Akun: <span className="font-bold text-slate-700">{selectedUser.username}</span></p>
                </div>
              </div>
              <button
                onClick={() => setShowResetModal(false)}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Password Baru <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showResetPass ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPass(!showResetPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                  >
                    <i className={`fa-solid ${showResetPass ? "fa-eye-slash" : "fa-eye"}`} />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md shadow-amber-500/20 disabled:opacity-60"
                >
                  {isPending ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-check" />
                      <span>Update Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL HAPUS AKUN ================= */}
      {showDeleteModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center text-xl mx-auto shadow-xs">
              <i className="fa-solid fa-triangle-exclamation" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-extrabold text-slate-800">Konfirmasi Hapus Akun</h3>
              <p className="text-xs text-slate-500">
                Apakah Anda yakin ingin menghapus akun{" "}
                <span className="font-bold text-slate-800 font-mono">@{selectedUser.username}</span>?
              </p>
              <p className="text-[11px] text-slate-400 pt-1">
                Data master GTK tidak akan terhapus, hanya hak akses login yang akan dicabut.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={isPending}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md shadow-rose-500/20 disabled:opacity-60"
              >
                {isPending ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-trash-can" />
                    <span>Ya, Hapus Akun</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL AUTO GENERATE AKUN ================= */}
      {showAutoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-xl mx-auto shadow-xs">
              <i className="fa-solid fa-wand-magic-sparkles" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-extrabold text-slate-800">Generate Akun Guru Otomatis</h3>
              <p className="text-xs text-slate-500">
                Sistem akan membuat akun login Guru secara otomatis untuk{" "}
                <span className="font-bold text-slate-800">{gtksWithoutAccount.length} GTK</span> yang belum memiliki akun.
              </p>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-left text-[11px] text-slate-600 mt-2 space-y-1">
                <p>• <strong>Username</strong>: Dibuat otomatis dari NUPTK/nama panggilan guru.</p>
                <p>• <strong>Password Bawaan</strong>: <code className="bg-white px-1.5 py-0.5 rounded border font-bold text-blue-700">guru123456</code></p>
                <p>• Guru dapat mengganti kata sandi setelah login.</p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAutoModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleAutoGenerate}
                disabled={isPending}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md shadow-amber-500/20 disabled:opacity-60"
              >
                {isPending ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin" />
                    <span>Membuat Akun...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-check" />
                    <span>Proses Sekarang</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
