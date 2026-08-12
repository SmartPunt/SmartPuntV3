"use client";

import {
  useEffect,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  deleteLongTermBetAction,
  upsertLongTermBet,
} from "@/lib/actions";

type GetOnEarlyItem = {
  id: number;
  horse?: string | null;
  meeting?: string | null;
  race_number?: number | null;
  race_date?: string | null;
  bet_type?: string | null;
  odds?: string | null;
  created_at?: string | null;
};

export default function MobileAdminGetOnEarly({
  getOnEarlyItems,
}: {
  getOnEarlyItems: GetOnEarlyItem[];
}) {
  const [horse, setHorse] = useState("");
  const [meeting, setMeeting] = useState("");
  const [raceNumber, setRaceNumber] = useState("");
  const [raceDate, setRaceDate] = useState("");
  const [betType, setBetType] = useState("Win");
  const [odds, setOdds] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

const [isPending, startTransition] =
    useTransition();

  const [editingId, setEditingId] =
    useState<number | null>(null);

  const [
    visibleGetOnEarlyItems,
    setVisibleGetOnEarlyItems,
  ] = useState<GetOnEarlyItem[]>(
    getOnEarlyItems,
  );

  const [
    deletingIds,
    setDeletingIds,
  ] = useState<Set<number>>(
    new Set(),
  );

  const router = useRouter();

  useEffect(() => {
    setVisibleGetOnEarlyItems(
      getOnEarlyItems,
    );
  }, [getOnEarlyItems]);

  function clearForm() {
    setEditingId(null);
    setHorse("");
    setMeeting("");
    setRaceNumber("");
    setRaceDate("");
    setBetType("Win");
    setOdds("");
    setMessage("");
    setError("");
  }

  function loadGetOnEarlyIntoForm(
    item: GetOnEarlyItem,
  ) {
    setMessage("");
    setError("");

    setEditingId(
      Number(item.id),
    );

    setHorse(
      item.horse || "",
    );

    setMeeting(
      item.meeting || "",
    );

    setRaceNumber(
      item.race_number
        ? String(
            item.race_number,
          )
        : "",
    );

    setRaceDate(
      item.race_date || "",
    );

    setBetType(
      item.bet_type || "Win",
    );

    setOdds(
      item.odds || "",
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function handleDelete(
    itemId: number,
  ) {
    setMessage("");
    setError("");

    setDeletingIds(
      (current) => {
        const next =
          new Set(current);

        next.add(itemId);

        return next;
      },
    );

    setVisibleGetOnEarlyItems(
      (current) =>
        current.filter(
          (item) =>
            Number(item.id) !==
            itemId,
        ),
    );

    startTransition(
      async () => {
        try {
          const formData =
            new FormData();

          formData.set(
            "id",
            String(itemId),
          );

          await deleteLongTermBetAction(
            formData,
          );

          if (
            editingId === itemId
          ) {
            clearForm();
          }
        } catch (
          deleteError
        ) {
          setVisibleGetOnEarlyItems(
            getOnEarlyItems,
          );

          setError(
            deleteError instanceof Error
              ? deleteError.message
              : "Failed to delete Get On Early.",
          );
        } finally {
          setDeletingIds(
            (current) => {
              const next =
                new Set(current);

              next.delete(
                itemId,
              );

              return next;
            },
          );
        }
      },
    );
  }

  function handleSubmit() {
    setMessage("");
    setError("");

    if (
      !horse.trim() ||
      !meeting.trim() ||
      !raceNumber.trim() ||
      !raceDate.trim() ||
      !betType.trim() ||
      !odds.trim()
    ) {
      setError(
        "Complete all Get On Early fields.",
      );
      return;
    }

const formData = new FormData();

    if (editingId) {
      formData.set(
        "id",
        String(editingId),
      );
    }

    formData.set(
      "horse",
      horse.trim(),
    );

    formData.set(
      "meeting",
      meeting.trim(),
    );

    formData.set(
      "race_number",
      raceNumber.trim(),
    );

    formData.set(
      "race_date",
      raceDate.trim(),
    );

    formData.set(
      "bet_type",
      betType,
    );

    formData.set(
      "odds",
      odds.trim(),
    );

    startTransition(async () => {
      try {
        await upsertLongTermBet(
          formData,
        );

setMessage(
          editingId
            ? "Get On Early updated."
            : "Get On Early published.",
        );

        setEditingId(null);
        setHorse("");
        setMeeting("");
        setRaceNumber("");
        setRaceDate("");
        setBetType("Win");
        setOdds("");

        router.refresh();
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Failed to publish Get On Early.",
        );
      }
    });
  }

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[2rem] border border-sky-300/30 bg-[linear-gradient(135deg,rgba(2,6,23,0.98),rgba(8,47,73,0.9),rgba(2,6,23,0.98))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-300">
          Early Opportunities
        </p>

        <h1 className="mt-2 text-2xl font-black tracking-tight text-white">
          Get On Early
        </h1>

        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Publish a clear early selection for an upcoming race.
        </p>
      </section>

      <section className="space-y-4 rounded-[2rem] border border-white/10 bg-black/75 p-4 shadow-xl shadow-black/30">
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-300">
            Horse
          </span>

          <input
            value={horse}
            onChange={(event) =>
              setHorse(
                event.target.value,
              )
            }
            placeholder="Attractiveness (NZ)"
            className="mt-2 w-full rounded-2xl border border-white/15 bg-zinc-950 px-3 py-3 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-sky-300"
          />
        </label>

        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-300">
            Meeting
          </span>

          <input
            value={meeting}
            onChange={(event) =>
              setMeeting(
                event.target.value,
              )
            }
            placeholder="Rosehill"
            className="mt-2 w-full rounded-2xl border border-white/15 bg-zinc-950 px-3 py-3 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-sky-300"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-300">
              Race Number
            </span>

            <input
              type="number"
              min="1"
              value={raceNumber}
              onChange={(event) =>
                setRaceNumber(
                  event.target.value,
                )
              }
              placeholder="1"
              className="mt-2 w-full rounded-2xl border border-white/15 bg-zinc-950 px-3 py-3 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-sky-300"
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-300">
              Race Date
            </span>

            <input
              type="date"
              value={raceDate}
              onChange={(event) =>
                setRaceDate(
                  event.target.value,
                )
              }
              className="mt-2 w-full rounded-2xl border border-white/15 bg-zinc-950 px-3 py-3 text-sm font-bold text-white outline-none focus:border-sky-300"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-300">
              Bet Type
            </span>

            <select
              value={betType}
              onChange={(event) =>
                setBetType(
                  event.target.value,
                )
              }
              className="mt-2 w-full rounded-2xl border border-white/15 bg-zinc-950 px-3 py-3 text-sm font-bold text-white outline-none focus:border-sky-300"
            >
              <option>Win</option>
              <option>Place</option>
              <option>Each Way</option>
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-300">
              Odds
            </span>

            <input
              value={odds}
              onChange={(event) =>
                setOdds(
                  event.target.value,
                )
              }
              placeholder="5"
              className="mt-2 w-full rounded-2xl border border-white/15 bg-zinc-950 px-3 py-3 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-sky-300"
            />
          </label>
        </div>
      </section>

      {horse &&
      meeting &&
      raceNumber &&
      raceDate ? (
        <section className="rounded-[1.75rem] border border-sky-300/25 bg-sky-400/[0.07] p-4">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-sky-300">
            Ready to Publish
          </p>

          <p className="mt-2 text-lg font-black text-white">
            {horse}
          </p>

          <p className="mt-1 text-sm font-semibold text-zinc-400">
            {meeting} R{raceNumber} · {raceDate}
          </p>

          <p className="mt-2 text-sm font-black text-sky-200">
            {betType}
            {odds
              ? ` · $${String(
                  odds,
                ).replace(/^\$/, "")}`
              : ""}
          </p>
        </section>
      ) : null}

      {message ? (
        <div className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-100">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm font-bold text-rose-100">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={
          isPending ||
          !horse.trim() ||
          !meeting.trim() ||
          !raceNumber.trim() ||
          !raceDate.trim() ||
          !odds.trim()
        }
        className="w-full rounded-[1.4rem] bg-gradient-to-r from-sky-300 via-cyan-300 to-sky-300 px-4 py-4 text-sm font-black uppercase tracking-[0.13em] text-black shadow-[0_18px_45px_rgba(14,165,233,0.18)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
      >
{isPending
          ? editingId
            ? "Updating..."
            : "Publishing..."
          : editingId
            ? "Update Get On Early"
            : "Publish Get On Early"}
      </button>
      {editingId ? (
        <button
          type="button"
          onClick={clearForm}
          disabled={isPending}
          className="w-full rounded-[1.4rem] border border-white/15 bg-white/5 px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-zinc-300 transition hover:bg-white/10 disabled:opacity-40"
        >
          Cancel Edit
        </button>
      ) : null}
      <section className="rounded-[2rem] border border-white/10 bg-black/75 p-4 shadow-xl shadow-black/30">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-300">
              Current Get On Early
            </p>

            <p className="mt-1 text-xs font-semibold text-zinc-500">
              Manage currently published early selections.
            </p>
          </div>

          <span className="rounded-full border border-sky-300/25 bg-sky-300/10 px-2.5 py-1 text-[9px] font-black text-sky-200">
            {
              visibleGetOnEarlyItems.length
            }
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {visibleGetOnEarlyItems.length ? (
            visibleGetOnEarlyItems.map(
              (item) => (
                <div
                  key={item.id}
                  className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-black text-white">
                        {item.horse ||
                          "Selection"}
                      </p>

                      <p className="mt-1 text-[11px] font-semibold text-zinc-400">
                        {item.meeting ||
                          "Meeting"}
                        {item.race_number
                          ? ` R${item.race_number}`
                          : ""}
                        {item.race_date
                          ? ` · ${item.race_date}`
                          : ""}
                      </p>
                    </div>

                    <span className="shrink-0 rounded-full border border-sky-300/25 bg-sky-300/10 px-2 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-sky-200">
                      {item.bet_type ||
                        "Win"}
                      {item.odds
                        ? ` · $${String(
                            item.odds,
                          ).replace(
                            /^\$/,
                            "",
                          )}`
                        : ""}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        loadGetOnEarlyIntoForm(
                          item,
                        )
                      }
                      disabled={
                        deletingIds.has(
                          Number(
                            item.id,
                          ),
                        )
                      }
                      className="rounded-xl border border-sky-300/30 bg-sky-300/10 px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.1em] text-sky-200 transition hover:bg-sky-300/15 disabled:opacity-40"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleDelete(
                          Number(
                            item.id,
                          ),
                        )
                      }
                      disabled={
                        deletingIds.has(
                          Number(
                            item.id,
                          ),
                        )
                      }
                      className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.1em] text-rose-200 transition hover:bg-rose-400/15 disabled:opacity-40"
                    >
                      {deletingIds.has(
                        Number(
                          item.id,
                        ),
                      )
                        ? "Deleting..."
                        : "Delete"}
                    </button>
                  </div>
                </div>
              ),
            )
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-center text-sm font-semibold text-zinc-500">
              No Get On Early selections published.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
