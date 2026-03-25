"use client";

export function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[28px] border border-amber-200/40 bg-white/95 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur ${className}`}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "green" | "blue" | "violet" | "amber" | "rose" | "red";
}) {
  const tones: Record<string, string> = {
    slate: "bg-zinc-900 text-amber-200 border border-amber-200/20",
    green: "bg-emerald-950 text-emerald-300 border border-emerald-700/40",
    blue: "bg-sky-950 text-sky-300 border border-sky-700/40",
    violet: "bg-violet-950 text-violet-300 border border-violet-700/40",
    amber: "bg-amber-100 text-amber-900 border border-amber-300/70",
    rose: "bg-rose-950 text-rose-300 border border-rose-700/40",
    red: "bg-red-950 text-red-300 border border-red-700/40",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function TipPill({ type }: { type: string }) {
  let tone: "slate" | "green" | "blue" | "violet" | "amber" | "rose" = "slate";

  if (type === "Win") tone = "green";
  else if (type === "Place") tone = "blue";
  else if (type === "All Up") tone = "violet";
  else if (type === "Horse to Watch" || type === "Race to Watch") tone = "amber";
  else if (type === "Long Term") tone = "rose";

  return <Badge tone={tone}>{type}</Badge>;
}
