"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/server/actions/auth";

export default function LoginPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, undefined);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <form action={action} className="w-full max-w-sm space-y-4 rounded-xl bg-white p-8 shadow">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800">STUPA</h1>
          <p className="text-sm text-slate-500">Sistem Terpadu Untuk Penilaian Akademik</p>
        </div>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Username</span>
          <input name="username" autoComplete="username" required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Password</span>
          <input name="password" type="password" autoComplete="current-password" required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button disabled={pending}
          className="w-full rounded-md bg-blue-600 py-2 font-semibold text-white disabled:opacity-60">
          {pending ? "Memproses..." : "Masuk"}
        </button>
      </form>
    </main>
  );
}
