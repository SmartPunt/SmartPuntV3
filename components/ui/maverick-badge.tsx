import { MaverickIcon } from "@/components/ui/maverick-icon";

type MaverickBadgeProps = {
  label?: string;
  compact?: boolean;
  className?: string;
};

export function MaverickBadge({
  label = "The Maverick",
  compact = false,
  className = "",
}: MaverickBadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border border-amber-400/45",
        "bg-black/70 text-amber-200 shadow-sm",
        compact ? "gap-1 px-1.5 py-0.5 text-[10px]" : "gap-2 px-2.5 py-1 text-xs",
        "font-black uppercase tracking-[0.12em]",
        className,
      ].join(" ")}
    >
      <MaverickIcon size={compact ? 18 : 22} />
      {label}
    </span>
  );
}
