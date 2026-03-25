"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Panel } from "@/components/ui";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      return;
    }
    window.location.reload();
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-10">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_420px]">
        <div className="rounded-[2rem] bg-slate-900 p-8 text-white shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Cob's Rules</p>
          <h1 className="mt-3 text-4xl font-semibold">Private live trial</h1>
          <p className="mt-4 max-w-2xl text-slate-300">
            Real Supabase-backed login. Admin sees backend. Subscribers see the punter side only.
          </p>
        </div>

        <Panel>
          <form onSubmit={handleLogin} className="space-y-5 p-6">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Sign in</h2>
              <p className="mt-1 text-sm text-slate-500">Use your Supabase user credentials.</p>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none" />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Password</label>
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none" />
            </div>

            <button type="submit" className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Login</button>
            {error ? <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
          </form>
        </Panel>
      </div>
    </div>
  );
}
