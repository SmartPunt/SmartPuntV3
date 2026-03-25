"use client";

export function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-[28px] border border-slate-200/80 bg-white shadow-sm ${className}`}>
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
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-700",
    blue: "bg-sky-100 text-sky-700",
    violet: "bg-violet-100 text-violet-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
    red: "bg-red-100 text-red-700",
  };

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function TipPill({ type }: { type: string }) {
  let tone: "slate" | "green" | "blue" | "violet" | "amber" | "rose" = "slate";
  if (type === "Win") tone = "green";
  if (type === "Place") tone = "blue";
  if (type === "All Up") tone = "violet";
  if (type === "Horse to Watch" || type === "Race to Watch") tone = "amber";
  if (type === "Long Term") tone = "rose";
  return <Badge tone={tone}>{type}</Badge>;
}
