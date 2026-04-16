"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Panel, TipPill } from "@/components/ui";

/* ---------- HELPERS ---------- */

function isToday(dateStr?: string | null) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

function isLast30Days(dateStr?: string | null) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
  return diff <= 30;
}

/* ---------- COMPONENT ---------- */

export default function ResultedTipsBoard({
  title,
  subtitle,
  currentUser,
  tips,
  backHref,
  backLabel,
}: any) {
  const [openId, setOpenId] = useState<number | null>(null);

  const sorted = [...tips].sort(
    (a, b) =>
      new Date(b.settled_at || "").getTime() -
      new Date(a.settled_at || "").getTime()
  );

  const today = sorted.filter((t) => isToday(t.settled_at));
  const lastMonth = sorted.filter(
    (t) => !isToday(t.settled_at) && isLast30Days(t.settled_at)
  );
  const older = sorted.filter((t) => !isLast30Days(t.settled_at));

  const total = sorted.length;
  const wins = sorted.filter((t) => t.successful === true).length;
  const strike = total ? ((wins / total) * 100).toFixed(1) : "0";

  function Section(label: string, items: any[]) {
    if (!items.length) return null;

    return (
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-white mb-3">
          {label} ({items.length})
        </h2>

        <div className="space-y-3">
          {items.map((tip) => {
            const isOpen = openId === tip.id;

            return (
              <div
                key={tip.id}
                className="rounded-2xl border border-white/10 bg-white/95 p-4 text-zinc-950 shadow-sm"
              >
                {/* HEADER */}
                <div
                  className="flex justify-between cursor-pointer"
                  onClick={() =>
                    setOpenId(isOpen ? null : tip.id)
                  }
                >
                  <div>
                    <p className="text-xs text-zinc-500">{tip.race}</p>
                    <h3 className="font-semibold">{tip.horse}</h3>
                  </div>

                  <div className="flex gap-2">
                    <Badge tone={tip.successful ? "green" : "rose"}>
                      {tip.successful ? "Win" : "Loss"}
                    </Badge>
                    <TipPill type={tip.type} />
                  </div>
                </div>

                {/* COLLAPSED DETAILS */}
                {!isOpen && (
                  <div className="mt-2 text-xs text-zinc-500">
                    {tip.note} • Fin {tip.finishing_position ?? "-"}
                  </div>
                )}

                {/* EXPANDED */}
                {isOpen && (
                  <div className="mt-4 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="blue">{tip.confidence}</Badge>
                      {tip.note && <Badge tone="amber">{tip.note}</Badge>}
                      {tip.finishing_position && (
                        <Badge tone="slate">
                          Fin {tip.finishing_position}
                        </Badge>
                      )}
                    </div>

                    {tip.commentary && (
                      <div className="rounded-xl bg-zinc-50 p-3 text-sm">
                        {tip.commentary}
                      </div>
                    )}

                    {tip.result_comment && (
                      <div className="rounded-xl bg-amber-50 p-3 text-sm">
                        {tip.result_comment}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* HEADER */}
      <div className="border-b border-white/10 p-4 flex justify-between">
        <h1 className="text-xl font-bold">{title}</h1>

        <Link
          href={backHref}
          className="text-sm border px-3 py-1 rounded-xl"
        >
          {backLabel}
        </Link>
      </div>

      <div className="max-w-5xl mx-auto p-4">
        {/* PERFORMANCE */}
        <div className="rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-400 p-4 text-black mb-6">
          <div className="flex justify-between">
            <div>
              <p className="text-sm">Head Tipper</p>
              <p className="text-xl font-bold">{strike}%</p>
            </div>
            <div>
              <p className="text-sm">Record</p>
              <p className="text-xl font-bold">
                {wins}/{total}
              </p>
            </div>
          </div>
        </div>

        {/* SECTIONS */}
        {Section("Today", today)}
        {Section("Last 30 Days", lastMonth)}
        {Section("Older", older)}
      </div>
    </div>
  );
}
