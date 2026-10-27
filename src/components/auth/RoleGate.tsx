import { Suspense } from "react";
import { getSession } from "@/lib/auth/session";
import type { Role } from "@/lib/auth/jwt";

/**
 * Gerbang otorisasi server-side yang aman untuk Suspense / PPR.
 * Hindari melempar redirect() di dalam Suspense untuk mencegah Minified React error #441.
 */
async function Gate({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    return (
      <div className="p-8 text-center bg-white/90 backdrop-blur-xl rounded-3xl border border-slate-200 shadow-sm max-w-md mx-auto my-12 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-xl mx-auto shadow-xs">
          <i className="fa-solid fa-lock" />
        </div>
        <div>
          <h3 className="font-extrabold text-slate-800 text-base">Sesi Anda Telah Berakhir</h3>
          <p className="text-xs text-slate-500 mt-1">Silakan masuk kembali untuk melanjutkan ke panel kerja.</p>
        </div>
        <a
          href="/login"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-md shadow-blue-500/20"
        >
          <i className="fa-solid fa-right-to-bracket" />
          <span>Masuk Kembali ke Sistem</span>
        </a>
      </div>
    );
  }

  if (roles.length > 0 && !roles.includes(session.role)) {
    return (
      <div className="p-8 text-center bg-white/90 backdrop-blur-xl rounded-3xl border border-rose-200 shadow-sm max-w-md mx-auto my-12 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center text-xl mx-auto shadow-xs">
          <i className="fa-solid fa-ban" />
        </div>
        <div>
          <h3 className="font-extrabold text-slate-800 text-base">Hak Akses Dibatasi</h3>
          <p className="text-xs text-slate-500 mt-1">Akun Anda tidak memiliki izin untuk membuka halaman ini.</p>
        </div>
        <a
          href="/login"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition"
        >
          <span>Ganti Akun</span>
        </a>
      </div>
    );
  }

  return <>{children}</>;
}

export function RoleGate({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="text-slate-400 text-xs py-4">Memuat panel...</p>}>
      <Gate roles={roles}>{children}</Gate>
    </Suspense>
  );
}

async function Name() {
  const session = await getSession();
  return <b>{session?.nama || session?.username || "Pengguna"}</b>;
}

export function CurrentUserName() {
  return (
    <Suspense fallback={<b>…</b>}>
      <Name />
    </Suspense>
  );
}
