import { Suspense } from "react";
import { requireRole } from "@/lib/auth/session";
import type { Role } from "@/lib/auth/jwt";

/**
 * Gerbang otorisasi server-side.
 * Dengan Cache Components (Next 16), pembacaan cookie wajib berada di dalam
 * <Suspense>. Shell layout tetap diprerender; konten terautentikasi di-stream.
 */
async function Gate({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  await requireRole(...roles);
  return <>{children}</>;
}

export function RoleGate({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="text-slate-400">Memuat...</p>}>
      <Gate roles={roles}>{children}</Gate>
    </Suspense>
  );
}

async function Name() {
  const session = await requireRole();
  return <b>{session.nama}</b>;
}

export function CurrentUserName() {
  return (
    <Suspense fallback={<b>…</b>}>
      <Name />
    </Suspense>
  );
}
