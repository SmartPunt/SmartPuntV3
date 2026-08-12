"use client";

import { useState, useTransition } from "react";
import { upsertLongTermBet } from "@/lib/actions";

export default function MobileAdminGetOnEarly() {
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
          "Get On Early published.",
        );

        setHorse("");
        setMeeting("");
        setRaceNumber("");
        setRaceDate("");
        setBetType("Win");
        setOdds("");
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
          ? "Publishing..."
          : "Publish Get On Early"}
      </button>
    </div>
  );
}
