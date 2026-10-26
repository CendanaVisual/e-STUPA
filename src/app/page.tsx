import Link from "next/link";

/** Normalnya tidak pernah tampil: `src/proxy.ts` mengalihkan "/" sesuai role. */
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <Link href="/login" className="text-blue-600 hover:underline">Masuk ke STUPA</Link>
    </main>
  );
}
