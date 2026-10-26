import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3">
      <h1 className="text-3xl font-bold text-slate-800">403 — Akses Ditolak</h1>
      <p className="text-slate-500">Anda tidak memiliki hak akses ke halaman ini.</p>
      <Link href="/" className="text-blue-600 hover:underline">Kembali</Link>
    </main>
  );
}
