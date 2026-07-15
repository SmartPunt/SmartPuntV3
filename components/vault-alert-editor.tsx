"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import VaultPicker from "@/components/vault-picker";
import {
  deleteVaultAlertAction,
  toggleVaultAlertAction,
  updateVaultAlertRulesAction,
  type VaultEditableAlert,
} from "@/lib/vault-actions";

const DISTANCE_OPTIONS = [
  "800–999m",
  "1000–1200m",
  "1201–1400m",
  "1401–1600m",
  "1601–1800m",
  "1801–2200m",
  "2201m+",
];

const CONDITION_OPTIONS = [
  "Good",
  "Soft",
  "Heavy",
  "Synthetic",
];

export default function VaultAlertEditor({
  alert,
}: {
  alert: VaultEditableAlert;
}) {
  const router = useRouter();

  const [open, setOpen] = useState(false);

  const [alertName, setAlertName] = useState(
    alert.alert_name,
  );

  const [trackNames, setTrackNames] = useState<string[]>(
    alert.track_names || [],
  );

  const [jockeyNames, setJockeyNames] = useState<string[]>(
    alert.jockey_names || [],
  );

  const [trainerNames, setTrainerNames] = useState<
    string[]
  >(alert.trainer_names || []);

  const [distanceBuckets, setDistanceBuckets] = useState<
    string[]
  >(alert.distance_buckets || []);

  const [trackConditions, setTrackConditions] = useState<
    string[]
  >(alert.track_conditions || []);

  const [minBarrier, setMinBarrier] = useState(
    alert.min_effective_barrier?.toString() || "",
  );

  const [maxBarrier, setMaxBarrier] = useState(
    alert.max_effective_barrier?.toString() || "",
  );

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [isSaving, startSaving] = useTransition();
  const [isToggling, startToggling] = useTransition();
  const [isDeleting, startDeleting] = useTransition();

  function toggleArrayValue(
    current: string[],
    value: string,
    setter: (values: string[]) => void,
  ) {
    setter(
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }

  function saveRules() {
    setMessage("");
    setErrorMessage("");

    startSaving(async () => {
      const result = await updateVaultAlertRulesAction({
        alertId: alert.id,
        alertName,
        trackNames,
        jockeyNames,
        trainerNames,
        distanceBuckets,
        trackConditions,
        minEffectiveBarrier: minBarrier
          ? Number(minBarrier)
          : null,
        maxEffectiveBarrier: maxBarrier
          ? Number(maxBarrier)
          : null,
      });

      if (!result.success) {
        setErrorMessage(
          result.error || "Could not save Vault rules.",
        );
        return;
      }

      setMessage(result.message || "Vault rules saved.");

      router.refresh();
    });
  }

  function toggleEnabled() {
    setMessage("");
    setErrorMessage("");

    startToggling(async () => {
      const result = await toggleVaultAlertAction({
        alertId: alert.id,
        enabled: !alert.enabled,
      });

      if (!result.success) {
        setErrorMessage(
          result.error ||
            "Could not update this Vault alert.",
        );
        return;
      }

      setMessage(result.message || "Vault alert updated.");

      router.refresh();
    });
  }

  function deleteAlert() {
    const confirmed = window.confirm(
      `Remove ${alert.target_name} from your Vault?`,
    );

    if (!confirmed) return;

    setMessage("");
    setErrorMessage("");

    startDeleting(async () => {
      const result = await deleteVaultAlertAction({
        alertId: alert.id,
      });

      if (!result.success) {
        setErrorMessage(
          result.error ||
            "Could not delete this Vault alert.",
        );
        return;
      }

      router.refresh();
    });
  }

  const customRuleCount =
    trackNames.length +
    jockeyNames.length +
    trainerNames.length +
    distanceBuckets.length +
    trackConditions.length +
    (minBarrier ? 1 : 0) +
    (maxBarrier ? 1 : 0);

  return (
    <article className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.055] shadow-lg shadow-black/20">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
              Horse Vault Rule
            </p>

            <h3 className="mt-2 truncate text-xl font-black text-white">
              {alert.target_name}
            </h3>

            <p className="mt-1 truncate text-sm text-zinc-400">
              {alert.alert_name}
            </p>
          </div>

          <span
            className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
              alert.enabled
                ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
                : "border-white/10 bg-white/5 text-zinc-400"
            }`}
          >
            {alert.enabled ? "Active" : "Paused"}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-zinc-300">
            Horse: {alert.target_name}
          </span>

          {customRuleCount === 0 ? (
            <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-[10px] font-bold text-amber-200">
              Any race
            </span>
          ) : (
            <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold text-emerald-200">
              {customRuleCount} custom rule
              {customRuleCount === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="mt-4 w-full rounded-xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-amber-200 transition hover:bg-amber-300/15"
        >
          {open ? "Close Rules" : "Edit Rules"}
        </button>
      </div>

      {open ? (
        <div className="border-t border-white/10 bg-black/35 p-4">
          <div>
            <label className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
              Alert name
            </label>

            <input
              value={alertName}
              onChange={(event) =>
                setAlertName(event.target.value)
              }
              maxLength={120}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.07] px-3 py-3 text-sm font-semibold text-white outline-none focus:border-amber-400"
            />
          </div>

          <div className="mt-5">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
              Distance
            </p>

            <p className="mt-1 text-xs text-zinc-500">
              Leave all unselected for any distance.
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {DISTANCE_OPTIONS.map((option) => {
                const selected =
                  distanceBuckets.includes(option);

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() =>
                      toggleArrayValue(
                        distanceBuckets,
                        option,
                        setDistanceBuckets,
                      )
                    }
                    className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
                      selected
                        ? "border-amber-300/50 bg-amber-300/15 text-amber-100"
                        : "border-white/10 bg-white/5 text-zinc-400"
                    }`}
                  >
                    {selected ? "✓ " : ""}
                    {option}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
              Track condition
            </p>

            <p className="mt-1 text-xs text-zinc-500">
              Leave all unselected for any condition.
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {CONDITION_OPTIONS.map((option) => {
                const selected =
                  trackConditions.includes(option);

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() =>
                      toggleArrayValue(
                        trackConditions,
                        option,
                        setTrackConditions,
                      )
                    }
                    className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
                      selected
                        ? "border-amber-300/50 bg-amber-300/15 text-amber-100"
                        : "border-white/10 bg-white/5 text-zinc-400"
                    }`}
                  >
                    {selected ? "✓ " : ""}
                    {option}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <VaultPicker
              label="Tracks"
              pickerType="track"
              values={trackNames}
              onChange={setTrackNames}
              placeholder="Search tracks..."
            />

            <VaultPicker
              label="Jockeys"
              pickerType="jockey"
              values={jockeyNames}
              onChange={setJockeyNames}
              placeholder="Search jockeys..."
            />

            <VaultPicker
              label="Trainers"
              pickerType="trainer"
              values={trainerNames}
              onChange={setTrainerNames}
              placeholder="Search trainers..."
            />

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
                Effective barrier
              </p>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={minBarrier}
                  onChange={(event) =>
                    setMinBarrier(event.target.value)
                  }
                  placeholder="Min"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.07] px-3 py-3 text-sm font-semibold text-white outline-none placeholder:text-zinc-500 focus:border-amber-400"
                />

                <input
                  type="number"
                  min="1"
                  max="30"
                  value={maxBarrier}
                  onChange={(event) =>
                    setMaxBarrier(event.target.value)
                  }
                  placeholder="Max"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.07] px-3 py-3 text-sm font-semibold text-white outline-none placeholder:text-zinc-500 focus:border-amber-400"
                />
              </div>

              <p className="mt-1 text-[11px] text-zinc-500">
                Leave both blank for any effective barrier.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={saveRules}
            disabled={isSaving}
            className="mt-6 w-full rounded-xl bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving
              ? "Saving Rules..."
              : "Save Vault Rules"}
          </button>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={toggleEnabled}
              disabled={isToggling}
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-xs font-black uppercase tracking-[0.1em] text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isToggling
                ? "Updating..."
                : alert.enabled
                  ? "Pause Alert"
                  : "Resume Alert"}
            </button>

            <button
              type="button"
              onClick={deleteAlert}
              disabled={isDeleting}
              className="rounded-xl border border-rose-300/25 bg-rose-400/10 px-3 py-3 text-xs font-black uppercase tracking-[0.1em] text-rose-200 transition hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isDeleting ? "Removing..." : "Delete"}
            </button>
          </div>

          {message ? (
            <div className="mt-3 rounded-xl border border-emerald-300/25 bg-emerald-400/10 px-3 py-2 text-sm font-bold text-emerald-200">
              {message}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="mt-3 rounded-xl border border-rose-300/25 bg-rose-400/10 px-3 py-2 text-sm font-bold text-rose-200">
              {errorMessage}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
