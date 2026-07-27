export const MAVERICK_TIP_TYPES = [
  "Win",
  "Place",
  "Each Way",
] as const;

export type MaverickTipType =
  (typeof MAVERICK_TIP_TYPES)[number];

export const MAVERICK_CONFIDENCE_LEVELS = [
  "High",
  "Medium",
  "Low",
] as const;

export type MaverickConfidence =
  (typeof MAVERICK_CONFIDENCE_LEVELS)[number];

export const MAVERICK_TIP_ANGLES = [
  "The Vibe",
  "Favourite Vulnerable",
  "Track Specialist",
  "Wet Tracker",
  "Maps Perfectly",
  "Value At Odds",
  "Tempo Edge",
  "First-Up Play",
  "Forgive Run",
  "Stable Mail",
] as const;

export const MAVERICK_TIMEZONES = [
  {
    value: "Australia/Perth",
    mobileLabel: "Perth",
    desktopLabel: "Australia/Perth",
  },
  {
    value: "Australia/Adelaide",
    mobileLabel: "Adelaide",
    desktopLabel: "Australia/Adelaide",
  },
  {
    value: "Australia/Darwin",
    mobileLabel: "Darwin",
    desktopLabel: "Australia/Darwin",
  },
  {
    value: "Australia/Brisbane",
    mobileLabel: "Brisbane",
    desktopLabel: "Australia/Brisbane",
  },
  {
    value: "Australia/Sydney",
    mobileLabel: "Sydney",
    desktopLabel: "Australia/Sydney",
  },
  {
    value: "Australia/Melbourne",
    mobileLabel: "Melbourne",
    desktopLabel: "Australia/Melbourne",
  },
  {
    value: "Australia/Hobart",
    mobileLabel: "Hobart",
    desktopLabel: "Australia/Hobart",
  },
] as const;

export function requiresWinOdds(
  tipType: MaverickTipType,
) {
  return (
    tipType === "Win" ||
    tipType === "Each Way"
  );
}

export function requiresPlaceOdds(
  tipType: MaverickTipType,
) {
  return (
    tipType === "Place" ||
    tipType === "Each Way"
  );
}
