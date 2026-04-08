"use client";

import { useActionState } from "react";
import { signInAction } from "@/lib/actions";

export default function LoginPage() {
  const [state, formAction] = useActionState(signInAction, {
    error: null,
  });

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.10),transparent_20%),linear-gradient(180deg,#111315_0%,#18181b_50%,#0f172a_100%)] text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-4 py-4 lg:px-8">
        <div className="w-full max-w-md overflow-hidden rounded-[32px] border border-amber-300/15 bg-[linear-gradient(135deg,rgba(17,17,17,0.96),rgba(39,39,42,0.96),rgba(202,138,4,0.20))] shadow-2xl backdrop-blur">

          {/* LOGO — LOWERED */}
          <div className="flex justify-center px-2 pt-5">
            <img
              src="/header-logo.png"
              alt="SmartPunt"
              className="h-auto w-[112%] max-w-none object-contain"
            />
          </div>

          {/* FORM */}
          <div className="px-8 pb-5 pt-1">
            <form action={formAction} className="space-y-3">
              <div>
                <label className="text-sm font-medium text-amber-100/85">Email</label>
                <input
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  className="mt-1.5 w-full rounded-2xl border border-amber-300/20 bg-black/30 px-4 py-2.5 text-white outline-none transition focus:border-amber-300"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-amber-100/85">Password</label>
                <input
                  name="password"
                  type="password"
                  placeholder="Your password"
                  className="mt-1.5 w-full rounded-2xl border border-amber-300/20 bg-black/30 px-4 py-2.5 text-white outline-none transition focus:border-amber-300"
                />
              </div>

              {state?.error ? (
                <div className="rounded-2xl bg-red-50 px-4 py-2 text-sm text-red-700">
                  {state.error}
                </div>
              ) : null}

              <button
                type="submit"
                className="w-full rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 px-4 py-2.5 text-sm font-semibold text-black shadow-md transition hover:brightness-110 active:scale-[0.98]"
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
