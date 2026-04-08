"use client";

import { useActionState } from "react";
import { signInAction } from "@/lib/actions";

export default function LoginPage() {
  const [state, formAction] = useActionState(signInAction, {
    error: null,
  });

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.10),transparent_20%),linear-gradient(180deg,#111315_0%,#18181b_50%,#0f172a_100%)] text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-4 py-8 lg:px-8">
        <div className="w-full max-w-md overflow-hidden rounded-[32px] border border-amber-300/15 bg-[linear-gradient(135deg,rgba(17,17,17,0.96),rgba(39,39,42,0.96),rgba(202,138,4,0.20))] shadow-2xl backdrop-blur">
          <div className="flex justify-center px-2 pt-3">
            <img
              src="/header-logo.png"
              alt="Fortune on 5"
              className="h-auto w-[112%] max-w-none object-contain"
            />
          </div>

          <div className="px-8 pb-7">
            <div className="-mt-1 text-center">
              <h1 className="bg-[linear-gradient(180deg,#f8fafc_0%,#d4d4d8_35%,#a1a1aa_70%,#f5f5f5_100%)] bg-clip-text font-serif text-3xl font-semibold tracking-[0.04em] text-transparent">
                Fortune on 5
              </h1>
              <p className="mt-1 text-sm text-amber-300">Premium Racing Tips</p>
            </div>

            <form action={formAction} className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-amber-100/85">Email</label>
                <input
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  className="mt-2 w-full rounded-2xl border border-amber-300/20 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-amber-300"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-amber-100/85">Password</label>
                <input
                  name="password"
                  type="password"
                  placeholder="Your password"
                  className="mt-2 w-full rounded-2xl border border-amber-300/20 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-amber-300"
                />
              </div>

              {state?.error ? (
                <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
                  {state.error}
                </div>
              ) : null}

              <button
                type="submit"
                className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-amber-300 transition hover:bg-zinc-900"
              >
                Log in
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
