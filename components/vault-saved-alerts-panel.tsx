"use client";

import { useState } from "react";
import VaultAlertEditor from "@/components/vault-alert-editor";
import type { VaultEditableAlert } from "@/lib/vault-actions";

export default function VaultSavedAlertsPanel({
  alerts,
}: {
  alerts: VaultEditableAlert[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="overflow-hidden rounded-[2rem] border border-amber-300/25 bg-black/82 p-4 shadow-2xl shadow-black/40 sm:p-5">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">
            My Vault
          </p>

          <div className="mt-2 flex items-center gap-2">
            <h2 className="text-2xl font-black tracking-tight text-white">
              Saved Alerts
            </h2>

            <span
              className={`text-sm font-black text-amber-200 transition-transform duration-200 ${
                isOpen ? "rotate-180" : ""
              }`}
              aria-hidden="true"
            >
              ▼
            </span>
          </div>

          <p className="mt-1 text-sm text-zinc-400">
            Your saved horses and personalised racing rules.
          </p>
        </div>

        <span className="flex h-11 min-w-11 items-center justify-center rounded-full border border-amber-300/35 bg-amber-300/10 px-3 text-sm font-black text-amber-200">
          {alerts.length}
        </span>
      </button>

      {isOpen ? (
        <div className="mt-5">
          {alerts.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {alerts.map((alert) => (
                <VaultAlertEditor
                  key={alert.id}
                  alert={alert}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-white/15 bg-white/5 p-7 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/10 text-2xl">
                🔐
              </div>

              <h3 className="mt-4 text-lg font-black text-white">
                Your Vault is empty
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">
                Search above to add your first horse. Saved horses will appear
                here and begin watching current and upcoming races.
              </p>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
