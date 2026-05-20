"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import {
  SMARTPUNT_SCORING_VERSION,
  calculateRaceConfidence,
  calculateRaceScores,
  type Horse,
  type Meeting,
  type Race,
  type Runner,
} from "@/lib/calculator/scoring";

function normaliseFormString(input: string | null | undefined): string {
  if (!input) return "";

  return input
    .toLowerCase()
    .replace(/[^0-9x]/g, "")   // keep numbers + x
    .replace(/10/g, "0")       // convert 10th+ to 0
    .slice(0, 6);
}

function buildUpdatedForm(existing: string | null, finishingPosition: number | null) {
  const cleaned = normaliseFormString(existing);

  if (finishingPosition === null || finishingPosition === undefined) {
    return cleaned;
  }

  let resultChar = "";

  if (finishingPosition === 1) resultChar = "1";
  else if (finishingPosition <= 9) resultChar = String(finishingPosition);
  else resultChar = "0"; // 10th+

  return (resultChar + cleaned).slice(0, 6);
}

type ActionResult = {
  success: boolean;
  error: string | null;
};

async function fetchAllRows<T>({
  pageSize = 1000,
  getPage,
}: {
  pageSize?: number;
  getPage: (
    from: number,
    to: number,
  ) => Promise<{ data: T[] | null; error: any }>;
}) {
  const allRows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await getPage(from, to);

    if (error) {
      throw new Error(error.message || "Failed to fetch rows.");
    }

    const rows = data || [];
    allRows.push(...rows);

    if (rows.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return allRows;
}

async function requireAdmin() {
  const profile = await getCurrentProfile();

  if (!profile || profile.role !== "admin" || profile.status !== "active") {
    throw new Error("Unauthorized");
  }

  return profile;
}

async function requireRacingAdmin() {
  const profile = await getCurrentProfile();

  if (
    !profile ||
    !["admin", "staff_admin"].includes(profile.role) ||
    profile.status !== "active"
  ) {
    throw new Error("Unauthorized");
  }

  return profile;
}

function getServiceRoleHeaders() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase service role configuration in environment variables.",
    );
  }

  return {
    supabaseUrl,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
  };
}

async function serviceRoleFetch(path: string, init?: RequestInit) {
  const { supabaseUrl, headers } = getServiceRoleHeaders();

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Service role request failed for ${path}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return null;
}

async function serviceRoleSelect(path: string) {
  return serviceRoleFetch(path, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });
}

async function serviceRolePatch(path: string, body: Record<string, unknown>) {
  await serviceRoleFetch(path, {
    method: "PATCH",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
}

async function serviceRoleDelete(path: string) {
  await serviceRoleFetch(path, {
    method: "DELETE",
    headers: {
      Prefer: "return=minimal",
    },
  });
}

function getZonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);

  const get = (type: string) => {
    const value = parts.find((part) => part.type === type)?.value;
    if (!value) throw new Error(`Missing ${type}`);
    return Number(value);
  };

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

function zonedDateTimeToUtcIso(
  raceDate: string,
  raceTime: string,
  timeZone: string,
): string | null {
  if (!raceDate || !raceTime || !timeZone) return null;

  const [year, month, day] = raceDate.split("-").map(Number);
  const [hour, minute] = raceTime.split(":").map(Number);

  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }

  const desiredLocalAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let utcGuess = desiredLocalAsUtc;

  for (let i = 0; i < 3; i += 1) {
    const parts = getZonedParts(new Date(utcGuess), timeZone);
    const zonedAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );

    const diff = desiredLocalAsUtc - zonedAsUtc;
    utcGuess += diff;

    if (diff === 0) break;
  }

  return new Date(utcGuess).toISOString();
}

function normaliseHorseName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
function normaliseImportedForm(value: string) {
  return String(value || "")
    .trim()
    .replace(/[^0-9xX]/g, "")
    .split("")
    .reverse()
    .slice(0, 6)
    .join("");
}

function updateFormStringWithResult(
  existing: string | null,
  finishingPosition: number | null,
) {
  if (!existing && (finishingPosition === null || finishingPosition === undefined)) {
    return "";
  }

  // Clean existing form (keep digits + x only)
  const cleaned = (existing || "")
    .toLowerCase()
    .replace(/[^0-9x]/g, "")
    .slice(0, 6);

  if (finishingPosition === null || finishingPosition === undefined) {
    return cleaned;
  }

  let resultChar = "";

  if (finishingPosition === 1) resultChar = "1";
  else if (finishingPosition <= 9) resultChar = String(finishingPosition);
  else resultChar = "0"; // 10th+

  // prepend and cap to 6 characters
  return (resultChar + cleaned).slice(0, 6);
}
function updateStatRecordWithResult(
  existingRecord: string | null,
  finishingPosition: number,
) {
  const cleaned = String(existingRecord || "").trim();
  const match = cleaned.match(/^(\d+):(\d+),(\d+),(\d+)$/);

  const runs = match ? Number(match[1]) : 0;
  const wins = match ? Number(match[2]) : 0;
  const seconds = match ? Number(match[3]) : 0;
  const thirds = match ? Number(match[4]) : 0;

  const validFinish =
    Number.isFinite(finishingPosition) && finishingPosition > 0;

  if (!validFinish) {
    return `${runs}:${wins},${seconds},${thirds}`;
  }

  const nextRuns = runs + 1;
  const nextWins = wins + (finishingPosition === 1 ? 1 : 0);
  const nextSeconds = seconds + (finishingPosition === 2 ? 1 : 0);
  const nextThirds = thirds + (finishingPosition === 3 ? 1 : 0);

  return `${nextRuns}:${nextWins},${nextSeconds},${nextThirds}`;
}

function normaliseText(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildInFilter(values: number[]) {
  return `in.(${values.join(",")})`;
}

function getBaseAppUrl() {
  return String(process.env.SMARTPUNT_APP_URL || "")
    .trim()
    .replace(/\/+$/, "");
}

function getHeaderLogoUrl() {
  const appUrl = getBaseAppUrl();
  return appUrl ? `${appUrl}/header-logo.png` : "";
}

function buildEmailHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  const logoUrl = getHeaderLogoUrl();

  return `
    <div style="padding: 18px 20px 14px; background: linear-gradient(135deg, #171717, #3f3f46, #ca8a04); color: white;">
      ${
        logoUrl
          ? `
            <div style="margin: 0 0 14px; text-align: center;">
              <img
                src="${logoUrl}"
                alt="SmartPunt"
                style="display: block; width: 100%; max-width: 600px; height: auto; margin: 0 auto;"
              />
            </div>
          `
          : ""
      }
      <div style="font-size: 12px; letter-spacing: 0.28em; text-transform: uppercase; opacity: 0.8;">
        ${eyebrow}
      </div>
      <h1 style="margin: 12px 0 0; font-size: 28px; line-height: 1.2;">
        ${title}
      </h1>
      ${
        subtitle
          ? `<p style="margin: 10px 0 0; opacity: 0.9;">${subtitle}</p>`
          : ""
      }
    </div>
  `;
}

function buildEmailShell({
  headerHtml,
  bodyHtml,
}: {
  headerHtml: string;
  bodyHtml: string;
}) {
  return `
    <div style="font-family: Arial, sans-serif; background: #f8fafc; padding: 24px; color: #111827;">
      <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 18px; overflow: hidden; border: 1px solid #e5e7eb;">
        ${headerHtml}
        <div style="padding: 24px;">
          ${bodyHtml}
        </div>
      </div>
    </div>
  `;
}

function buildViewInSmartPuntButton() {
  const appUrl = getBaseAppUrl();

  if (!appUrl) return "";

  return `
    <div style="margin-top: 24px;">
      <a href="${appUrl}" style="display:inline-block;padding:12px 18px;border-radius:12px;background:#111827;color:#fbbf24;text-decoration:none;font-weight:700;">
        View in SmartPunt
      </a>
    </div>
  `;
}

async function getActiveSubscriberEmails() {
  const supabase = await createClient();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("email, email_alerts_enabled")
    .eq("role", "user")
    .eq("status", "active")
    .eq("email_alerts_enabled", true);

  if (error) {
    throw new Error(`Failed to load subscriber emails: ${error.message}`);
  }

  return (profiles || [])
    .map((profile: any) => String(profile.email || "").trim())
    .filter(Boolean);
}

async function sendBatchEmails(
  emails: Array<{
    from: string;
    to: string[];
    subject: string;
    html: string;
  }>,
) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey || !emails.length) return;

  for (let i = 0; i < emails.length; i += 100) {
    const batch = emails.slice(i, i + 100);

    const response = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to send notification emails: ${errorText}`);
    }
  }
}

async function sendSuggestedTipNotifications({
  race,
  horse,
  type,
  confidence,
  note,
  commentary,
}: {
  race: string;
  horse: string;
  type: string;
  confidence: string;
  note: string;
  commentary: string;
}) {
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!fromEmail) return;

  const recipients = await getActiveSubscriberEmails();
  if (!recipients.length) return;

  const subject = `New SmartPunt Tip: ${race} - ${horse}`;

  const html = (email: string) =>
    buildEmailShell({
      headerHtml: buildEmailHeader({
        eyebrow: "SmartPunt",
        title: "New Tip Just Dropped",
        subtitle: "Premium racing club alert",
      }),
      bodyHtml: `
        <p style="margin: 0; font-size: 14px; color: #6b7280;">${race}</p>
        <h2 style="margin: 6px 0 0; font-size: 28px; color: #111827;">${horse}</h2>

        <div style="margin-top: 16px; display: flex; flex-wrap: wrap; gap: 8px;">
          <span style="display:inline-block;padding:8px 12px;border-radius:999px;background:#ecfccb;color:#166534;font-size:12px;font-weight:700;">${type}</span>
          <span style="display:inline-block;padding:8px 12px;border-radius:999px;background:#e0f2fe;color:#0369a1;font-size:12px;font-weight:700;">${confidence} confidence</span>
          ${
            note
              ? `<span style="display:inline-block;padding:8px 12px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:12px;font-weight:700;">${note}</span>`
              : ""
          }
        </div>

        <p style="margin: 20px 0 0; font-size: 15px; line-height: 1.7; color: #374151;">
          ${commentary || `${horse} has been added as a new SmartPunt tip.`}
        </p>

        ${buildViewInSmartPuntButton()}

        <p style="margin-top: 24px; font-size: 12px; color: #9ca3af;">
          Sent to ${email} because you’re an active SmartPunt subscriber.
        </p>
      `,
    });

  const emails = recipients.map((email) => ({
    from: fromEmail,
    to: [email],
    subject,
    html: html(email),
  }));

  await sendBatchEmails(emails);
}
async function sendSmartPuntCalculatorTipNotifications({
  race,
  horse,
  betType,
  score,
  winPercent,
  placePercent,
  raceConfidencePercent,
  raceConfidenceTier,
  raceGap,
}: {
  race: string;
  horse: string;
  betType: string;
  score: number;
  winPercent: number;
  placePercent: number;
  raceConfidencePercent: number;
  raceConfidenceTier: string;
  raceGap: number;
}) {
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!fromEmail) return;

  const recipients = await getActiveSubscriberEmails();
  if (!recipients.length) return;

  const subject = `⚡ SmartPunt Model Signal: ${race} - ${horse}`;

  const html = (email: string) =>
    buildEmailShell({
      headerHtml: `
        <div style="padding: 22px 20px 18px; background: radial-gradient(circle at top left, rgba(251,191,36,0.22), transparent 34%), linear-gradient(135deg, #020617, #111827 48%, #18181b); color: white; border-bottom: 1px solid rgba(251,191,36,0.35);">
          <div style="font-size: 11px; letter-spacing: 0.32em; text-transform: uppercase; color: #fbbf24; font-weight: 800;">
            SmartPunt Calculator
          </div>

          <h1 style="margin: 12px 0 0; font-size: 30px; line-height: 1.15; color: #ffffff;">
            MODEL SIGNAL GENERATED
          </h1>

          <p style="margin: 10px 0 0; font-size: 14px; color: #d4d4d8;">
            Probability-based betting signal · No human commentary attached
          </p>
        </div>
      `,
      bodyHtml: `
        <div style="border-radius: 18px; overflow: hidden; border: 1px solid #111827; background: #020617;">
          <div style="padding: 18px; border-bottom: 1px solid rgba(251,191,36,0.28);">
            <p style="margin: 0; font-size: 12px; color: #fbbf24; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 800;">
              Calculator Output
            </p>

            <p style="margin: 12px 0 0; font-size: 14px; color: #9ca3af;">
              ${race}
            </p>

            <h2 style="margin: 6px 0 0; font-size: 32px; line-height: 1.1; color: #ffffff;">
              ${horse}
            </h2>
          </div>

          <div style="padding: 18px;">
            <div style="display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px;">
              <div style="padding:14px;border-radius:14px;background:#fbbf24;color:#111827;">
                <div style="font-size:10px;opacity:.72;text-transform:uppercase;font-weight:800;letter-spacing:.12em;">Signal</div>
                <div style="margin-top:6px;font-size:22px;font-weight:900;">${betType}</div>
              </div>

              <div style="padding:14px;border-radius:14px;background:#111827;border:1px solid #374151;">
                <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;font-weight:800;letter-spacing:.12em;">Score</div>
                <div style="margin-top:6px;font-size:22px;font-weight:900;color:#ffffff;">${score}</div>
              </div>

              <div style="padding:14px;border-radius:14px;background:#111827;border:1px solid #374151;">
                <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;font-weight:800;letter-spacing:.12em;">Win Chance</div>
                <div style="margin-top:6px;font-size:22px;font-weight:900;color:#ffffff;">${winPercent}%</div>
              </div>

              <div style="padding:14px;border-radius:14px;background:#111827;border:1px solid #374151;">
                <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;font-weight:800;letter-spacing:.12em;">Place Chance</div>
                <div style="margin-top:6px;font-size:22px;font-weight:900;color:#ffffff;">${placePercent}%</div>
              </div>

              <div style="padding:14px;border-radius:14px;background:#111827;border:1px solid #374151;">
                <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;font-weight:800;letter-spacing:.12em;">Race Confidence</div>
                <div style="margin-top:6px;font-size:20px;font-weight:900;color:#ffffff;">
                  ${raceConfidencePercent}% ${raceConfidenceTier ? `· ${raceConfidenceTier}` : ""}
                </div>
              </div>

              <div style="padding:14px;border-radius:14px;background:#111827;border:1px solid #374151;">
                <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;font-weight:800;letter-spacing:.12em;">Score Gap</div>
                <div style="margin-top:6px;font-size:22px;font-weight:900;color:#ffffff;">+${raceGap}</div>
              </div>
            </div>

            <div style="margin-top: 18px; padding: 14px; border-radius: 14px; background: rgba(251,191,36,0.10); border: 1px solid rgba(251,191,36,0.24);">
              <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #fde68a;">
                This is a SmartPunt Calculator signal generated from model scoring. It is separate from Head Tipper selections and will be tracked as its own performance channel.
              </p>
            </div>
          </div>
        </div>

        ${buildViewInSmartPuntButton()}

        <p style="margin-top: 24px; font-size: 12px; color: #9ca3af;">
          Sent to ${email} because you’re an active SmartPunt subscriber.
        </p>
      `,
    });

  const emails = recipients.map((email) => ({
    from: fromEmail,
    to: [email],
    subject,
    html: html(email),
  }));

  await sendBatchEmails(emails);
}
async function sendGetOnEarlyNotifications({
  title,
  horse,
  betType,
  odds,
  commentary,
}: {
  title: string;
  horse: string;
  betType: string;
  odds: string;
  commentary: string;
}) {
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!fromEmail) return;

  const recipients = await getActiveSubscriberEmails();
  if (!recipients.length) return;

  const subject = `Get On Early: ${horse} ${odds ? `(${odds})` : ""}`;

  const html = (email: string) =>
    buildEmailShell({
      headerHtml: buildEmailHeader({
        eyebrow: "SmartPunt",
        title: "Get On Early",
      }),
      bodyHtml: `
        <p style="margin: 0; font-size: 14px; color: #6b7280;">${title}</p>
        <h2 style="margin: 6px 0 0; font-size: 28px; color: #111827;">${horse}</h2>

        <div style="margin-top: 16px; display: flex; flex-wrap: wrap; gap: 8px;">
          <span style="display:inline-block;padding:8px 12px;border-radius:999px;background:#ecfccb;color:#166534;font-size:12px;font-weight:700;">${betType}</span>
          ${
            odds
              ? `<span style="display:inline-block;padding:8px 12px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:12px;font-weight:700;">${odds}</span>`
              : ""
          }
        </div>

        <p style="margin: 20px 0 0; font-size: 15px; line-height: 1.7; color: #374151;">
          ${commentary || `${horse} has been added as an early-value play.`}
        </p>

        ${buildViewInSmartPuntButton()}

        <p style="margin-top: 24px; font-size: 12px; color: #9ca3af;">
          Sent to ${email} because you’re an active SmartPunt subscriber.
        </p>
      `,
    });

  const emails = recipients.map((email) => ({
    from: fromEmail,
    to: [email],
    subject,
    html: html(email),
  }));

  await sendBatchEmails(emails);
}

async function sendPublishedRaceNotification({
  meetingName,
  raceName,
  raceNumber,
  distanceM,
}: {
  meetingName: string;
  raceName: string;
  raceNumber: number;
  distanceM: number | null;
}) {
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!fromEmail) return;

  const recipients = await getActiveSubscriberEmails();
  if (!recipients.length) return;

  const subject = `Published Race: ${meetingName} R${raceNumber}`;
  const raceLabel = `${meetingName} R${raceNumber} ${raceName} ${distanceM ? `- ${distanceM}m` : ""}`;

  const html = (email: string) =>
    buildEmailShell({
      headerHtml: buildEmailHeader({
        eyebrow: "SmartPunt",
        title: "New Published Race",
      }),
      bodyHtml: `
        <h2 style="margin: 6px 0 0; font-size: 28px; color: #111827;">${raceLabel}</h2>

        ${buildViewInSmartPuntButton()}

        <p style="margin-top: 24px; font-size: 12px; color: #9ca3af;">
          Sent to ${email} because you’re an active SmartPunt subscriber.
        </p>
      `,
    });

  const emails = recipients.map((email) => ({
    from: fromEmail,
    to: [email],
    subject,
    html: html(email),
  }));

  await sendBatchEmails(emails);
}

async function clearSuggestedTipLinksForRaceIds(raceIds: number[]) {
  if (!raceIds.length) return;

  await serviceRolePatch(`suggested_tips?race_id=${buildInFilter(raceIds)}`, {
    meeting_id: null,
    race_id: null,
    horse_id: null,
    race_runner_id: null,
    updated_at: new Date().toISOString(),
  });
}

async function clearSuggestedTipLinksForRunnerIds(runnerIds: number[]) {
  if (!runnerIds.length) return;

  await serviceRolePatch(
    `suggested_tips?race_runner_id=${buildInFilter(runnerIds)}`,
    {
      race_runner_id: null,
      updated_at: new Date().toISOString(),
    },
  );
}
// SmartPunt horse master form seed active

async function saveCalculatorPredictionsForRace(
  raceId: number,
  { excludeScratched = false }: { excludeScratched?: boolean } = {},
) {
  const supabase = await createClient();

  const [races, runners, horses, meetings] = await Promise.all([
    fetchAllRows<Race>({
      getPage: async (from, to) => {
        const result = await supabase
          .from("races")
          .select("*")
          .order("meeting_id", { ascending: false })
          .order("race_number", { ascending: true })
          .range(from, to);

        return {
          data: (result.data ?? []) as Race[],
          error: result.error,
        };
      },
    }),
    fetchAllRows<Runner>({
      getPage: async (from, to) => {
        const result = await supabase
          .from("race_runners")
          .select("*")
          .order("created_at", { ascending: false })
          .range(from, to);

        return {
          data: (result.data ?? []) as Runner[],
          error: result.error,
        };
      },
    }),
    fetchAllRows<Horse>({
      getPage: async (from, to) => {
        const result = await supabase
          .from("horses")
          .select("*")
          .order("horse_name", { ascending: true })
          .range(from, to);

        return {
          data: (result.data ?? []) as Horse[],
          error: result.error,
        };
      },
    }),
    fetchAllRows<Meeting>({
      getPage: async (from, to) => {
        const result = await supabase
          .from("meetings")
          .select("*")
          .order("meeting_date", { ascending: false })
          .range(from, to);

        return {
          data: (result.data ?? []) as Meeting[],
          error: result.error,
        };
      },
    }),
  ]);

  const activeRace = races.find((race) => Number(race.id) === Number(raceId));

  if (!activeRace) {
    throw new Error("Race not found for calculator prediction snapshot.");
  }

  const runnersForScoring = excludeScratched
    ? runners.filter(
        (runner) =>
          Number(runner.race_id) !== Number(raceId) || !runner.scratched,
      )
    : runners;

const jockeyProfiles = await fetchAllRows({
  getPage: async (from, to) => {
    const result = await supabase
      .from("jockey_profiles")
      .select("*")
      .order("jockey_name", { ascending: true })
      .range(from, to);

    return {
      data: result.data ?? [],
      error: result.error,
    };
  },
});

const scoredRunners = calculateRaceScores({
  activeRace,
  races,
  runners: runnersForScoring,
  horses,
  meetings,
  jockeyProfiles,
});

  if (!scoredRunners.length) {
    return;
  }

const now = new Date().toISOString();
const raceConfidence = calculateRaceConfidence(scoredRunners);

const topWin = scoredRunners[0] || null;
const topPlace =
  [...scoredRunners].sort((a, b) => b.placePercent - a.placePercent)[0] || null;

const secondForWin = topWin
  ? scoredRunners.find((runner) => runner.id !== topWin.id) || null
  : null;

const winGap = topWin && secondForWin
  ? Math.round(topWin.score - secondForWin.score)
  : topWin
    ? Math.round(topWin.score)
    : 0;

const qualifiesAsWin =
  topWin !== null &&
  topWin.score >= 68 &&
  winGap >= 4 &&
  topWin.winPercent >= 8;

const qualifiesAsStrongWin =
  topWin !== null &&
  topWin.score >= 72 &&
  winGap >= 6 &&
  topWin.winPercent >= 10;

const secondForPlace = topPlace
  ? scoredRunners.find((runner) => runner.id !== topPlace.id) || null
  : null;

const placeGap = topPlace && secondForPlace
  ? Math.round(topPlace.score - secondForPlace.score)
  : topPlace
    ? Math.round(topPlace.score)
    : 0;

const qualifiesAsPlace =
  topPlace !== null &&
  topPlace.score >= 62 &&
  topPlace.placePercent >= 30 &&
  placeGap >= 2;

const qualifiesAsStrongPlace =
  topPlace !== null &&
  topPlace.score >= 66 &&
  topPlace.placePercent >= 34 &&
  placeGap >= 3;

function getSmartPuntTipType(runnerId: number) {
  if (topWin && runnerId === topWin.id && qualifiesAsStrongWin) return "Best Bet";
  if (topWin && runnerId === topWin.id && qualifiesAsWin) return "Win";
  if (topPlace && runnerId === topPlace.id && qualifiesAsStrongPlace) return "Strong Place";
  if (topPlace && runnerId === topPlace.id && qualifiesAsPlace) return "Place";
  return "No Bet";
}

function isSmartPuntTip(runnerId: number) {
  return getSmartPuntTipType(runnerId) !== "No Bet";
}

function getRaceGapForRunner(runnerId: number) {
  if (topWin && runnerId === topWin.id) return winGap;
  if (topPlace && runnerId === topPlace.id) return placeGap;
  return raceConfidence.gap;
}
  const payload = scoredRunners.map((runner) => ({
    race_id: Number(runner.race_id),
    runner_id: Number(runner.id),
    horse_id: Number(runner.horse_id),
    scoring_version: SMARTPUNT_SCORING_VERSION,
    score: Number(runner.score),
    rank: Number(runner.rank),
    win_percent: Number(runner.winPercent),
    place_percent: Number(runner.placePercent),
    recent_form_score: Number(runner.components.recentForm),
    distance_score: Number(runner.components.distance),
    track_score: Number(runner.components.track),
    condition_score: Number(runner.components.condition),
    barrier_score: Number(runner.components.barrier),
    weight_score: Number(runner.components.weight),
    jockey_score: Number(runner.components.jockey),
    trainer_score: Number(runner.components.trainer),
        is_smartpunt_tip: isSmartPuntTip(Number(runner.id)),
    smartpunt_tip_type: getSmartPuntTipType(Number(runner.id)),
    race_gap: getRaceGapForRunner(Number(runner.id)),
    race_confidence_tier: raceConfidence.tier,
    race_confidence_percent: raceConfidence.confidencePercent,
    suggested_bet: raceConfidence.suggestedBet,
    predicted_at: now,
    finishing_position: null,
    won: null,
    placed: null,
    settled_at: null,
    updated_at: now,
  }));

  await serviceRoleDelete(
    `calculator_predictions?race_id=eq.${raceId}&scoring_version=eq.${encodeURIComponent(
      SMARTPUNT_SCORING_VERSION,
    )}`,
  );

  await serviceRoleFetch("calculator_predictions", {
    method: "POST",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify(payload),
  });
}

async function updateCalculatorPredictionResultsForRace(
  raceId: number,
  updates: Array<{
    id: number;
    finishing_position: number | null;
    won: boolean | null;
    placed: boolean | null;
    settled_at: string | null;
  }>,
) {
  const settledAt = new Date().toISOString();

  for (const update of updates) {
    await serviceRolePatch(
      `calculator_predictions?race_id=eq.${raceId}&runner_id=eq.${update.id}&scoring_version=eq.${encodeURIComponent(
        SMARTPUNT_SCORING_VERSION,
      )}`,
      {
        finishing_position: update.finishing_position,
        won: update.won,
        placed: update.placed,
        settled_at: update.settled_at || settledAt,
        updated_at: new Date().toISOString(),
      },
    );
  }
}

async function autoFinaliseMatchingSuggestedTipsForRace(raceId: number) {
  const supabase = await createClient();

  const { data: raceData, error: raceError } = await supabase
    .from("races")
    .select("*")
    .eq("id", raceId)
    .maybeSingle();

  if (raceError || !raceData) {
    throw new Error(raceError?.message || "Race not found for tip settlement.");
  }

  const { data: meetingData, error: meetingError } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", raceData.meeting_id)
    .maybeSingle();

  if (meetingError) {
    throw new Error(meetingError.message);
  }

  const { data: runnerRows, error: runnerError } = await supabase
    .from("race_runners")
    .select("*")
    .eq("race_id", raceId);

  if (runnerError) {
    throw new Error(runnerError.message);
  }

  const activeRunnerRows = (runnerRows || []).filter(
    (runner: any) => !runner.scratched,
  );
  const runnerIds = activeRunnerRows.map((runner: any) => Number(runner.id));
  const horseIds = activeRunnerRows
    .map((runner: any) => Number(runner.horse_id))
    .filter(Boolean);

  const horseMap = new Map<number, any>();
  if (horseIds.length > 0) {
    const { data: horseRows, error: horseError } = await supabase
      .from("horses")
      .select("id, horse_name, normalised_name")
      .in("id", horseIds);

    if (horseError) {
      throw new Error(horseError.message);
    }

    for (const horse of horseRows || []) {
      horseMap.set(Number(horse.id), horse);
    }
  }

  const { data: suggestedTips, error: tipsError } = await supabase
    .from("suggested_tips")
    .select("*")
    .is("settled_at", null);

  if (tipsError) {
    throw new Error(tipsError.message);
  }

  const meetingName = String(meetingData?.meeting_name || "");
  const raceName = String(raceData.race_name || "");
  const raceNumber = Number(raceData.race_number || 0);

  const normalisedMeetingName = normaliseText(meetingName);
  const normalisedRaceName = normaliseText(raceName);
  const raceMarkers = [
    `r${raceNumber}`,
    `race ${raceNumber}`,
    `race${raceNumber}`,
  ].map(normaliseText);

  const updates: Array<{
    id: number;
    finishing_position: number | null;
    successful: boolean | null;
    settled_at: string;
  }> = [];

  for (const tip of suggestedTips || []) {
    const tipType = String(tip.type || "")
      .toLowerCase()
      .trim();
    if (!["win", "place", "each way"].includes(tipType)) continue;

    let matchedRunner: any | null = null;

    if (tip.race_runner_id && runnerIds.includes(Number(tip.race_runner_id))) {
      matchedRunner =
        activeRunnerRows.find(
          (runner: any) => Number(runner.id) === Number(tip.race_runner_id),
        ) || null;
    }

    if (!matchedRunner) {
      const tipHorse = normaliseHorseName(String(tip.horse || ""));
      const tipRace = normaliseText(String(tip.race || ""));

      if (!tipHorse || !tipRace) continue;

      matchedRunner =
        activeRunnerRows.find((runner: any) => {
          const horse = horseMap.get(Number(runner.horse_id));
          const horseName = horse?.normalised_name
            ? String(horse.normalised_name)
            : normaliseHorseName(String(horse?.horse_name || ""));
          return horseName === tipHorse;
        }) || null;

      if (!matchedRunner) continue;

      const raceTextMatchesMeeting =
        !!normalisedMeetingName && tipRace.includes(normalisedMeetingName);
      const raceTextMatchesNumber = raceMarkers.some(
        (marker) => marker && tipRace.includes(marker),
      );
      const raceTextMatchesRaceName =
        !!normalisedRaceName && tipRace.includes(normalisedRaceName);

      if (
        !raceTextMatchesMeeting ||
        (!raceTextMatchesNumber && !raceTextMatchesRaceName)
      ) {
        continue;
      }
    }

    const finishingPosition =
      matchedRunner.finishing_position !== null &&
      matchedRunner.finishing_position !== undefined &&
      !Number.isNaN(Number(matchedRunner.finishing_position))
        ? Number(matchedRunner.finishing_position)
        : null;

    let successful: boolean | null = null;

    if (tipType === "win") {
      successful = finishingPosition === 1;
    } else if (tipType === "place" || tipType === "each way") {
      successful = finishingPosition !== null ? finishingPosition <= 3 : false;
    }

    updates.push({
      id: Number(tip.id),
      finishing_position: finishingPosition,
      successful,
      settled_at: new Date().toISOString(),
    });
  }

  for (const update of updates) {
    const { error } = await supabase
      .from("suggested_tips")
      .update({
        finishing_position: update.finishing_position,
        successful: update.successful,
        settled_at: update.settled_at,
        updated_at: new Date().toISOString(),
      })
      .eq("id", update.id);

    if (error) {
      throw new Error(error.message);
    }
  }
}

export async function toggleSubscriberEmailAlertsAction(
  formData: FormData,
): Promise<void> {
  try {
    await requireAdmin();

    const profileId = String(formData.get("profile_id") ?? "").trim();
    const enabled =
      String(formData.get("email_alerts_enabled") ?? "") === "true";

    if (!profileId) {
      console.error("Subscriber alert toggle failed: missing profile_id.");
      return;
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from("profiles")
      .update({
        email_alerts_enabled: enabled,
      })
      .eq("id", profileId);

    if (error) {
      console.error("Subscriber alert toggle failed:", error.message);
      return;
    }

    revalidatePath("/");
  } catch (error) {
    console.error("Subscriber alert toggle crashed:", error);
  }
}

export async function createSubscriberUserAction(
  _: { error: string | null; success: string | null },
  formData: FormData,
) {
  await requireAdmin();

  const fullName = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "user").trim();
  const emailInput = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const usernameInput = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "").trim();

  if (!fullName || !password) {
    return { error: "Full name and password are required.", success: null };
  }

  if (!["user", "admin", "staff_admin"].includes(role)) {
    return { error: "Invalid role selected.", success: null };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters.", success: null };
  }

  const isSubscriber = role === "user";

  if (isSubscriber && !emailInput) {
    return { error: "Subscribers must have an email address.", success: null };
  }

  if (!isSubscriber && !usernameInput) {
    return {
      error: "Full Admin and Race Builder users must have a username.",
      success: null,
    };
  }

  const username = usernameInput || null;

  if (username && !/^[a-zA-Z0-9._-]{3,30}$/.test(username)) {
    return {
      error:
        "Username must be 3 to 30 characters and use only letters, numbers, dots, underscores, or hyphens.",
      success: null,
    };
  }

  const authEmail = isSubscriber ? emailInput : `${username}@smartpunt.local`;

  const profileEmail = isSubscriber ? emailInput : authEmail;

  const { supabaseUrl, headers } = getServiceRoleHeaders();

  if (username) {
    const existingUsernameRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?select=id&username=eq.${encodeURIComponent(username)}`,
      {
        method: "GET",
        headers: {
          ...headers,
          Accept: "application/json",
        },
      },
    );

    const existingUsernameData = await existingUsernameRes.json();

    if (!existingUsernameRes.ok) {
      return {
        error:
          existingUsernameData?.message ||
          existingUsernameData?.msg ||
          "Failed to validate username.",
        success: null,
      };
    }

    if (
      Array.isArray(existingUsernameData) &&
      existingUsernameData.length > 0
    ) {
      return {
        error: "That username is already in use.",
        success: null,
      };
    }
  }

  const createUserRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        username: username || null,
        role,
      },
    }),
  });

  const createUserData = await createUserRes.json();

  if (!createUserRes.ok) {
    return {
      error:
        createUserData?.msg ||
        createUserData?.message ||
        "Failed to create auth user.",
      success: null,
    };
  }

  const userId = createUserData?.id || createUserData?.user?.id;

  if (!userId) {
    return {
      error: "Auth user was created but no user ID was returned.",
      success: null,
    };
  }

  const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles`, {
    method: "POST",
    headers: {
      ...headers,
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify([
      {
        id: userId,
        email: profileEmail,
        username,
        full_name: fullName,
        role,
        status: "active",
      },
    ]),
  });

  if (!profileRes.ok) {
    const profileErrorText = await profileRes.text();
    return {
      error: `Auth user created, but profile creation failed: ${profileErrorText}`,
      success: null,
    };
  }

  revalidatePath("/");

  const roleLabel =
    role === "admin"
      ? "Full Admin"
      : role === "staff_admin"
        ? "Race Builder"
        : "Subscriber";

  const loginLabel = isSubscriber ? profileEmail : username;

  return {
    error: null,
    success: `${roleLabel} created successfully for ${loginLabel}.`,
  };
}
export async function signInAction(
  _: { error: string | null },
  formData: FormData,
) {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!identifier || !password) {
    return { error: "Username/email and password are required." };
  }

  const supabase = await createClient();
  let resolvedEmail = identifier.toLowerCase();

  if (!identifier.includes("@")) {
    try {
      const username = identifier.toLowerCase();
      const encodedUsername = encodeURIComponent(username);

      const profileRows = (await serviceRoleSelect(
        `profiles?select=email&username=eq.${encodedUsername}&limit=1`,
      )) as Array<{ email: string }> | null;

      const profile = profileRows?.[0] || null;

      if (!profile?.email) {
        return { error: "Username not found." };
      }

      resolvedEmail = String(profile.email).toLowerCase();
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Failed to look up username.",
      };
    }
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: resolvedEmail,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  const { cookies } = await import("next/headers");
  (await cookies()).set("smartpunt_play_intro", "true", {
    path: "/",
    maxAge: 60,
    httpOnly: false,
    sameSite: "lax",
  });

  revalidatePath("/", "layout");
  return { error: null };
}

export async function updateMeetingConditionAction(formData: FormData) {
  const meetingId = formData.get("meeting_id");
  const condition = formData.get("track_condition");

  if (!meetingId) {
    return { success: false, error: "Missing meeting ID" };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("meetings")
    .update({
      track_condition: condition || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", Number(meetingId));

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
}

export async function markTipActiveAction(formData: FormData): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Unauthorized");

  const tipId = Number(formData.get("tip_id"));
  const supabase = await createClient();

  const { error } = await supabase.from("user_active_tips").upsert(
    {
      user_id: profile.id,
      tip_id: tipId,
    },
    { onConflict: "user_id,tip_id" },
  );

  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/my-resulted-tips");
}

export async function removeTipActiveAction(formData: FormData): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Unauthorized");

  const tipId = Number(formData.get("tip_id"));
  const supabase = await createClient();

  const { error } = await supabase
    .from("user_active_tips")
    .delete()
    .eq("user_id", profile.id)
    .eq("tip_id", tipId);

  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/my-resulted-tips");
}

export async function upsertSuggestedTip(formData: FormData): Promise<void> {
  const profile = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const isNew = !id;
  const sendNotification =
    String(formData.get("send_notification") ?? "") === "true";

  const raceDate = String(formData.get("race_date") ?? "");
  const raceTime = String(formData.get("race_time") ?? "");
  const raceTimezone = String(
    formData.get("race_timezone") ?? "Australia/Perth",
  );
  const raceStartAt = zonedDateTimeToUtcIso(raceDate, raceTime, raceTimezone);

  const meetingIdRaw = String(formData.get("meeting_id") ?? "").trim();
  const raceIdRaw = String(formData.get("race_id") ?? "").trim();
  const horseIdRaw = String(formData.get("horse_id") ?? "").trim();
  const raceRunnerIdRaw = String(formData.get("race_runner_id") ?? "").trim();

  const finishingPositionRaw = String(
    formData.get("finishing_position") ?? "",
  ).trim();
  const successfulRaw = String(formData.get("successful") ?? "").trim();

  const successful =
    successfulRaw === "true" ? true : successfulRaw === "false" ? false : null;

  const payload = {
    meeting_id: meetingIdRaw ? Number(meetingIdRaw) : null,
    race_id: raceIdRaw ? Number(raceIdRaw) : null,
    horse_id: horseIdRaw ? Number(horseIdRaw) : null,
    race_runner_id: raceRunnerIdRaw ? Number(raceRunnerIdRaw) : null,
    race: String(formData.get("race") ?? ""),
    horse: String(formData.get("horse") ?? ""),
    type: String(formData.get("type") ?? "Win"),
    confidence: String(formData.get("confidence") ?? "High"),
    note: String(formData.get("note") ?? ""),
    commentary: String(formData.get("commentary") ?? ""),
    result_comment: String(formData.get("result_comment") ?? ""),
    race_start_at: raceStartAt,
    race_timezone: raceTimezone,
    finishing_position: finishingPositionRaw
      ? Number(finishingPositionRaw)
      : null,
    successful,
    settled_at:
      typeof successful === "boolean" ? new Date().toISOString() : null,
    created_by: profile.id,
    updated_at: new Date().toISOString(),
  };

  const supabase = await createClient();

  if (id) {
    const { error } = await supabase
      .from("suggested_tips")
      .update(payload)
      .eq("id", Number(id));

    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase
      .from("suggested_tips")
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(error.message);

    if (isNew && sendNotification && data) {
      try {
        await sendSuggestedTipNotifications({
          race: data.race || payload.race,
          horse: data.horse || payload.horse,
          type: data.type || payload.type,
          confidence: data.confidence || payload.confidence,
          note: data.note || payload.note,
          commentary: data.commentary || payload.commentary,
        });
      } catch (notificationError) {
        console.error(notificationError);
      }
    }
  }

  revalidatePath("/");
  revalidatePath("/resulted-tips");
  revalidatePath("/my-resulted-tips");
}
export async function addUserBetAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
const profile = await getCurrentProfile();

if (!profile || profile.status !== "active") {
  return {
    success: false,
    error: "Unauthorized",
  };
}
    const supabase = await createClient();

    const source = String(formData.get("source") ?? "");
    const suggestedTipIdRaw = formData.get("suggested_tip_id");
    const calculatorTipIdRaw = formData.get("calculator_tip_id");

    const raceId = Number(formData.get("race_id") || 0) || null;
    const raceRunnerId =
      Number(formData.get("race_runner_id") || 0) || null;
    const horseId = Number(formData.get("horse_id") || 0) || null;

    const horse = String(formData.get("horse") ?? "");
    const race = String(formData.get("race") ?? "");

    const betType = String(formData.get("bet_type") ?? "Win");

    const oddsTaken = Number(formData.get("odds_taken") || 0);

    if (!source) {
      return {
        success: false,
        error: "Bet source is required.",
      };
    }

    if (!horse || !race) {
      return {
        success: false,
        error: "Horse and race are required.",
      };
    }

    if (!oddsTaken || Number.isNaN(oddsTaken) || oddsTaken <= 1) {
      return {
        success: false,
        error: "Valid odds are required.",
      };
    }

    const payload = {
      user_id: profile.id,

      source,

      suggested_tip_id: suggestedTipIdRaw
        ? Number(suggestedTipIdRaw)
        : null,

      calculator_tip_id: calculatorTipIdRaw
        ? Number(calculatorTipIdRaw)
        : null,

      race_id: raceId,
      race_runner_id: raceRunnerId,
      horse_id: horseId,

      horse,
      race,

      bet_type: betType,

      odds_taken: oddsTaken,
      stake_points: 1,

      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("user_bets")
      .insert(payload);

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    revalidatePath("/");
    revalidatePath("/my-resulted-tips");

return {
  success: true,
  error: null,
};
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to add user bet.",
    };
  }
}
export async function publishSmartPuntCalculatorTipAction(
  formData: FormData,
): Promise<void> {
  try {
const profile = await requireAdmin();

    const sendNotification =
      String(formData.get("send_notification") ?? "") === "true";

    const payload = {
      meeting_id: Number(formData.get("meeting_id") || 0) || null,
      race_id: Number(formData.get("race_id") || 0) || null,
      race_runner_id: Number(formData.get("race_runner_id") || 0) || null,
      horse_id: Number(formData.get("horse_id") || 0) || null,
      race: String(formData.get("race") ?? ""),
      horse: String(formData.get("horse") ?? ""),
      bet_type: String(formData.get("bet_type") ?? "Win"),
      confidence: String(formData.get("confidence") ?? "High"),
      score: Number(formData.get("score") || 0),
      win_percent: Number(formData.get("win_percent") || 0),
      place_percent: Number(formData.get("place_percent") || 0),
      race_gap: Number(formData.get("race_gap") || 0),
      race_confidence_percent: Number(
        formData.get("race_confidence_percent") || 0,
      ),
      race_confidence_tier: String(
        formData.get("race_confidence_tier") ?? "",
      ),
      status: "active",
      created_by: profile.id,
      updated_at: new Date().toISOString(),
    };

    if (!payload.race_id || !payload.race_runner_id || !payload.horse_id) {
throw new Error("Race, runner, and horse are required for calculator tips.");
    }

const insertedRows = await serviceRoleFetch("smartpunt_calculator_tips?select=*", {
  method: "POST",
  headers: {
    Prefer: "return=representation",
  },
  body: JSON.stringify(payload),
});

const data = Array.isArray(insertedRows) ? insertedRows[0] : insertedRows;

if (!data) {
  throw new Error("Calculator tip was not created.");
}

    if (sendNotification && data) {
      try {
        await sendSmartPuntCalculatorTipNotifications({
          race: data.race || payload.race,
          horse: data.horse || payload.horse,
          betType: data.bet_type || payload.bet_type,
          score: Number(data.score || payload.score),
          winPercent: Number(data.win_percent || payload.win_percent),
          placePercent: Number(data.place_percent || payload.place_percent),
          raceConfidencePercent: Number(
            data.race_confidence_percent || payload.race_confidence_percent,
          ),
          raceConfidenceTier:
            data.race_confidence_tier || payload.race_confidence_tier,
          raceGap: Number(data.race_gap || payload.race_gap),
        });
      } catch (notificationError) {
        console.error(notificationError);
      }
    }

    revalidatePath("/");
    revalidatePath("/admin/calculator");
    revalidatePath("/resulted-tips");
    revalidatePath("/my-resulted-tips");

return;
  } catch (error) {
throw new Error(
  error instanceof Error
    ? error.message
    : "Failed to publish calculator tip.",
);
  }
}
export async function deleteSuggestedTipAction(
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const id = Number(formData.get("id"));
  const supabase = await createClient();

  const { data: tip, error: tipError } = await supabase
    .from("suggested_tips")
    .select(`
      id,
      race_start_at,
      races:races (
        id,
        race_number,
        races_meeting:meetings (
          meeting_name,
          meeting_date
        )
      )
    `)
    .eq("id", id)
    .single();

  if (tipError) {
    throw new Error(tipError.message);
  }

  const now = new Date();

  if (tip?.race_start_at) {
    const raceStart = new Date(tip.race_start_at);

    if (raceStart <= now) {
      throw new Error(
        "This tip is locked because the race has already started.",
      );
    }
  }

  const { error } = await supabase
    .from("suggested_tips")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/resulted-tips");
  revalidatePath("/my-resulted-tips");
}

export async function upsertWatchItem(formData: FormData): Promise<void> {
  const profile = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  const payload = {
    race: String(formData.get("race") ?? ""),
    horse: String(formData.get("horse") ?? ""),
    label: String(formData.get("label") ?? "Horse to Watch"),
    commentary: String(formData.get("commentary") ?? ""),
    created_by: profile.id,
    updated_at: new Date().toISOString(),
  };

  const supabase = await createClient();
  const query = id
    ? supabase.from("watchlist_items").update(payload).eq("id", Number(id))
    : supabase.from("watchlist_items").insert(payload);

  const { error } = await query;
  if (error) throw new Error(error.message);

  revalidatePath("/");
}

export async function deleteWatchItemAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const supabase = await createClient();

  const { error } = await supabase
    .from("watchlist_items")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/");
}

export async function upsertLongTermBet(formData: FormData): Promise<void> {
  const profile = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const isNew = !id;

  const raceDate = String(formData.get("race_date") ?? "");
  const raceTime = String(formData.get("race_time") ?? "");
  const raceTimezone = String(
    formData.get("race_timezone") ?? "Australia/Perth",
  );
  const raceStartAt = zonedDateTimeToUtcIso(raceDate, raceTime, raceTimezone);

  const raceNumberRaw = String(formData.get("race_number") ?? "").trim();
  const raceNumber = raceNumberRaw ? Number(raceNumberRaw) : null;

  const payload = {
    title: String(formData.get("title") ?? ""),
    horse: String(formData.get("horse") ?? ""),
    meeting: String(formData.get("meeting") ?? "").trim() || null,
    race_number:
      raceNumber !== null && !Number.isNaN(raceNumber) ? raceNumber : null,
    race_start_at: raceStartAt,
    race_timezone: raceTimezone || null,
    bet_type: String(formData.get("bet_type") ?? "Win"),
    odds: String(formData.get("odds") ?? ""),
    commentary: String(formData.get("commentary") ?? ""),
    created_by: profile.id,
    updated_at: new Date().toISOString(),
  };

  const supabase = await createClient();

  if (id) {
    const { error } = await supabase
      .from("long_term_bets")
      .update(payload)
      .eq("id", Number(id));

    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase
      .from("long_term_bets")
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(error.message);

    if (isNew && data) {
      try {
        await sendGetOnEarlyNotifications({
          title: data.title || payload.title,
          horse: data.horse || payload.horse,
          betType: data.bet_type || payload.bet_type,
          odds: data.odds || payload.odds,
          commentary: data.commentary || payload.commentary,
        });
      } catch (notificationError) {
        console.error(notificationError);
      }
    }
  }

  revalidatePath("/");
  revalidatePath("/long-term-bets");
}

export async function deleteLongTermBetAction(
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const supabase = await createClient();

  const { error } = await supabase.from("long_term_bets").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/");
}

export async function createMeetingAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const profile = await requireRacingAdmin();
    const supabase = await createClient();

    const meetingName = String(formData.get("meeting_name") ?? "").trim();
    const meetingDate = String(formData.get("meeting_date") ?? "").trim();
    const trackCondition = String(formData.get("track_condition") ?? "").trim();

    if (!meetingName || !meetingDate) {
      return { success: false, error: "Meeting name and date are required." };
    }

    const { error } = await supabase.from("meetings").insert({
      meeting_name: meetingName,
      meeting_date: meetingDate,
      track_condition: trackCondition || null,
      created_by: profile.id,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/race-builder");
    revalidatePath("/current-races");
    revalidatePath("/race-archive");
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create meeting.",
    };
  }
}

export async function deleteMeetingAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireRacingAdmin();

    const meetingId = Number(formData.get("meeting_id"));

    if (!meetingId) {
      return { success: false, error: "Meeting is required." };
    }

    const races = (await serviceRoleSelect(
      `races?meeting_id=eq.${meetingId}&select=id`,
    )) as Array<{ id: number }> | null;

    const raceIds = (races || [])
      .map((race) => Number(race.id))
      .filter(Boolean);

    if (raceIds.length > 0) {
      const runners = (await serviceRoleSelect(
        `race_runners?race_id=${buildInFilter(raceIds)}&select=id`,
      )) as Array<{ id: number }> | null;

      const runnerIds = (runners || [])
        .map((runner) => Number(runner.id))
        .filter(Boolean);

      await clearSuggestedTipLinksForRaceIds(raceIds);
      await clearSuggestedTipLinksForRunnerIds(runnerIds);

      await serviceRoleDelete(`race_runners?race_id=${buildInFilter(raceIds)}`);
      await serviceRoleDelete(`races?id=${buildInFilter(raceIds)}`);
    }

    await serviceRoleDelete(`meetings?id=eq.${meetingId}`);

    revalidatePath("/admin/race-builder");
    revalidatePath("/current-races");
    revalidatePath("/race-archive");
    revalidatePath("/");
    revalidatePath("/resulted-tips");
    revalidatePath("/my-resulted-tips");

    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete meeting.",
    };
  }
}
export async function updateMeetingDetailsAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireRacingAdmin();

    const supabase = await createClient();

    const meetingId = Number(formData.get("meeting_id"));
    const meetingName = String(formData.get("meeting_name") || "").trim();
    const meetingDate = String(formData.get("meeting_date") || "").trim();

    if (!meetingId) {
      return { success: false, error: "Meeting is required." };
    }

    if (!meetingName) {
      return { success: false, error: "Meeting name is required." };
    }

    if (!meetingDate) {
      return { success: false, error: "Meeting date is required." };
    }

    const { error } = await supabase
      .from("meetings")
      .update({
        meeting_name: meetingName,
        meeting_date: meetingDate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", meetingId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/current-races");
    revalidatePath("/admin/race-builder");
    revalidatePath("/admin/calculator");
    revalidatePath("/admin/calculator-report");
    revalidatePath("/");

    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update meeting.",
    };
  }
}

export async function updateRaceDetailsAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireRacingAdmin();

    const supabase = await createClient();

    const raceId = Number(formData.get("race_id"));
    const raceNumber = Number(formData.get("race_number"));
    const raceName = String(formData.get("race_name") || "").trim();
    const distanceRaw = String(formData.get("distance_m") || "").trim();
    const distanceM = distanceRaw ? Number(distanceRaw) : null;

    if (!raceId) {
      return { success: false, error: "Race is required." };
    }

    if (!raceNumber || raceNumber <= 0) {
      return { success: false, error: "Race number is required." };
    }

    if (!raceName) {
      return { success: false, error: "Race name is required." };
    }

    const { error } = await supabase
      .from("races")
      .update({
        race_number: raceNumber,
        race_name: raceName,
        distance_m:
          distanceM !== null && Number.isFinite(distanceM) ? distanceM : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", raceId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/current-races");
    revalidatePath("/admin/race-builder");
    revalidatePath("/admin/calculator");
    revalidatePath("/admin/calculator-report");
    revalidatePath("/");

    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update race.",
    };
  }
}

export async function createRaceAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const profile = await requireRacingAdmin();
    const supabase = await createClient();

    const meetingId = Number(formData.get("meeting_id"));
    const raceNumber = Number(formData.get("race_number"));
    const raceNameRaw = String(formData.get("race_name") ?? "").trim();
    const distanceRaw = String(formData.get("distance_m") ?? "").trim();

    if (!meetingId || !raceNumber) {
      return { success: false, error: "Meeting and race number are required." };
    }

    const distanceValue = distanceRaw ? Number(distanceRaw) : null;
    const raceName = raceNameRaw || `Race ${raceNumber}`;

    const { error } = await supabase.from("races").insert({
      meeting_id: meetingId,
      race_number: raceNumber,
      race_name: raceName,
      distance_m: Number.isNaN(distanceValue as number) ? null : distanceValue,
      status: "draft",
      published_at: null,
      created_by: profile.id,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      if (error.code === "23505") {
        return {
          success: false,
          error: "That race number already exists for this meeting.",
        };
      }
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/race-builder");
    revalidatePath("/current-races");
    revalidatePath("/race-archive");
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create race.",
    };
  }
}

export async function toggleRacePublishAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireRacingAdmin();
    const supabase = await createClient();

    const raceId = Number(formData.get("race_id"));
    const nextStatus = String(formData.get("next_status") ?? "").trim();

    if (!raceId || !nextStatus) {
      return { success: false, error: "Race and status are required." };
    }

    if (!["draft", "published", "closed"].includes(nextStatus)) {
      return { success: false, error: "Invalid race status." };
    }

    const payload = {
      status: nextStatus,
      published_at:
        nextStatus === "published" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("races")
      .update(payload)
      .eq("id", raceId);

    if (error) {
      return { success: false, error: error.message };
    }

    if (nextStatus === "published") {
      try {
        await saveCalculatorPredictionsForRace(raceId);
      } catch (predictionError) {
        console.error(
          "Calculator prediction snapshot failed:",
          predictionError,
        );
      }
    }

    revalidatePath("/admin/race-builder");
    revalidatePath("/current-races");
    revalidatePath("/race-archive");
    revalidatePath("/");
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update race status.",
    };
  }
}
export async function publishMeetingRacesAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireRacingAdmin();

    const supabase = await createClient();
    const meetingId = Number(formData.get("meeting_id"));

    if (!meetingId) {
      return { success: false, error: "Meeting is required." };
    }

    const { data: races, error: racesError } = await supabase
      .from("races")
      .select("id,status")
      .eq("meeting_id", meetingId);

    if (racesError) {
      return { success: false, error: racesError.message };
    }

    const draftRaces = (races || []).filter((race) => race.status === "draft");

    if (!draftRaces.length) {
      return {
        success: false,
        error: "No draft races found for this meeting.",
      };
    }

    const raceIds = draftRaces.map((race) => race.id);
    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("races")
      .update({
        status: "published",
        published_at: now,
        updated_at: now,
      })
      .in("id", raceIds);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    await Promise.allSettled(
      raceIds.map((raceId) => saveCalculatorPredictionsForRace(raceId)),
    );

    revalidatePath("/admin/race-builder");
    revalidatePath("/current-races");
    revalidatePath("/race-archive");
    revalidatePath("/");
    revalidatePath("/admin/calculator");
    revalidatePath("/admin/calculator-report");

    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to publish meeting races.",
    };
  }
}
export async function abandonMeetingAction(
  formData: FormData,
): Promise<void> {
  try {
    await requireRacingAdmin();

    const meetingId = Number(formData.get("meeting_id"));
    const reason =
      String(formData.get("abandonment_reason") ?? "Meeting abandoned.").trim() ||
      "Meeting abandoned.";

    if (!meetingId) {
      throw new Error("Meeting is required.");
    }

    const now = new Date().toISOString();

    const races = (await serviceRoleSelect(
      `races?meeting_id=eq.${meetingId}&select=id,status`,
    )) as Array<{ id: number; status: string | null }> | null;

    const raceIds = (races || [])
      .map((race) => Number(race.id))
      .filter(Boolean);

    if (!raceIds.length) {
      throw new Error("No races found for this meeting.");
    }

    const runners = (await serviceRoleSelect(
      `race_runners?race_id=${buildInFilter(raceIds)}&select=id`,
    )) as Array<{ id: number }> | null;

    const runnerIds = (runners || [])
      .map((runner) => Number(runner.id))
      .filter(Boolean);

    await serviceRolePatch(`meetings?id=eq.${meetingId}`, {
      abandoned_at: now,
      abandonment_reason: reason,
    });

    await serviceRolePatch(`races?id=${buildInFilter(raceIds)}`, {
      status: "closed",
      abandoned_at: now,
      abandonment_reason: reason,
      updated_at: now,
    });

    if (runnerIds.length > 0) {
      await serviceRolePatch(`race_runners?id=${buildInFilter(runnerIds)}`, {
        finishing_position: null,
        starting_price: null,
        won: false,
        placed: false,
        settled_at: now,
        updated_at: now,
      });
    }

    await serviceRolePatch(`suggested_tips?race_id=${buildInFilter(raceIds)}`, {
      finishing_position: null,
      successful: null,
      result_comment: reason,
      settled_at: now,
      updated_at: now,
    });

    await serviceRolePatch(
      `smartpunt_calculator_tips?race_id=${buildInFilter(raceIds)}`,
      {
        status: "voided",
        voided: true,
        void_reason: reason,
        finishing_position: null,
        won: null,
        placed: null,
        settled_at: now,
        updated_at: now,
      },
    );

    await serviceRolePatch(
      `user_bets?race_id=${buildInFilter(raceIds)}&settled_at=is.null`,
      {
        voided: true,
        void_reason: reason,
        finishing_position: null,
        won: null,
        placed: null,
        return_points: null,
        profit_loss_points: 0,
        settled_at: now,
        updated_at: now,
      },
    );

    revalidatePath("/");
    revalidatePath("/current-races");
    revalidatePath("/race-archive");
    revalidatePath("/my-active-tips");
    revalidatePath("/my-resulted-tips");
    revalidatePath("/admin/calculator");
    revalidatePath("/admin/calculator-report");

    return;
  } catch (error) {
    console.error("Failed to abandon meeting:", error);
    return;
  }
}
export async function deleteRaceAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireRacingAdmin();

    const raceId = Number(formData.get("race_id"));

    if (!raceId) {
      return { success: false, error: "Race is required." };
    }

    const runners = (await serviceRoleSelect(
      `race_runners?race_id=eq.${raceId}&select=id`,
    )) as Array<{ id: number }> | null;

    const runnerIds = (runners || [])
      .map((runner) => Number(runner.id))
      .filter(Boolean);

    await clearSuggestedTipLinksForRaceIds([raceId]);
    await clearSuggestedTipLinksForRunnerIds(runnerIds);

    await serviceRoleDelete(`race_runners?race_id=eq.${raceId}`);
    await serviceRoleDelete(`races?id=eq.${raceId}`);

    revalidatePath("/admin/race-builder");
    revalidatePath("/current-races");
    revalidatePath("/race-archive");
    revalidatePath("/");
    revalidatePath("/resulted-tips");
    revalidatePath("/my-resulted-tips");

    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete race.",
    };
  }
}

export async function createRaceRunnerAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const profile = await requireRacingAdmin();
    const supabase = await createClient();

    const raceId = Number(formData.get("race_id"));
    const selectedHorseIdRaw = String(
      formData.get("selected_horse_id") ?? "",
    ).trim();
    const horseNameRaw = String(formData.get("horse_name") ?? "").trim();
    const jockeyName = String(formData.get("jockey_name") ?? "").trim();
    const trainerName = String(formData.get("trainer_name") ?? "").trim();
    const barrierRaw = String(formData.get("barrier") ?? "").trim();
    const marketPriceRaw = String(formData.get("market_price") ?? "").trim();
    const weightKgRaw = String(formData.get("weight_kg") ?? "").trim();
    const isApprenticeRaw = String(formData.get("is_apprentice") ?? "").trim();
    const apprenticeClaimRaw = String(
      formData.get("apprentice_claim_kg") ?? "",
    ).trim();
    const formLast6 = String(formData.get("form_last_6") ?? "").trim();
    const trackFormLast6 = String(
      formData.get("track_form_last_6") ?? "",
    ).trim();
    const distanceFormLast6 = String(
      formData.get("distance_form_last_6") ?? "",
    ).trim();

    if (!raceId) {
      return { success: false, error: "Race is required." };
    }

    if (!selectedHorseIdRaw && !horseNameRaw) {
      return { success: false, error: "Select or enter a horse first." };
    }

    let horseId = selectedHorseIdRaw ? Number(selectedHorseIdRaw) : 0;

    if (!horseId) {
      const normalisedName = normaliseHorseName(horseNameRaw);

      if (!normalisedName) {
        return { success: false, error: "Horse name is required." };
      }

      const { data: existingHorse, error: existingHorseError } = await supabase
        .from("horses")
        .select("id, horse_name")
        .eq("normalised_name", normalisedName)
        .maybeSingle();

      if (existingHorseError) {
        return { success: false, error: existingHorseError.message };
      }

      if (existingHorse?.id) {
        horseId = existingHorse.id;
      } else {
        const { data: insertedHorse, error: insertHorseError } = await supabase
          .from("horses")
          .insert({
            horse_name: horseNameRaw.replace(/\s+/g, " ").trim(),
            normalised_name: normalisedName,

            form_last_6: formLast6 ? normaliseImportedForm(formLast6) : null,
            track_form_last_6: trackFormLast6 || null,
            distance_form_last_6: distanceFormLast6 || null,

            updated_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (insertHorseError) {
          if (insertHorseError.code === "23505") {
            const { data: retryHorse, error: retryHorseError } = await supabase
              .from("horses")
              .select("id")
              .eq("normalised_name", normalisedName)
              .maybeSingle();

            if (retryHorseError || !retryHorse?.id) {
              return {
                success: false,
                error:
                  retryHorseError?.message || "Unable to match existing horse.",
              };
            }

            horseId = retryHorse.id;
          } else {
            return { success: false, error: insertHorseError.message };
          }
        } else {
          horseId = insertedHorse.id;
        }
      }
    }

    const barrierValue = barrierRaw ? Number(barrierRaw) : null;
    const marketPriceValue = marketPriceRaw ? Number(marketPriceRaw) : null;
    const weightKgValue = weightKgRaw ? Number(weightKgRaw) : null;
    const isApprentice =
      isApprenticeRaw === "true"
        ? true
        : isApprenticeRaw === "false"
          ? false
          : null;
    const apprenticeClaimValue = apprenticeClaimRaw
      ? Number(apprenticeClaimRaw)
      : null;

    const { error } = await supabase.from("race_runners").insert({
      race_id: raceId,
      horse_id: horseId,
      jockey_name: jockeyName || null,
      trainer_name: trainerName || null,
      barrier:
        barrierValue && !Number.isNaN(barrierValue) ? barrierValue : null,
      market_price:
        marketPriceValue !== null && !Number.isNaN(marketPriceValue)
          ? marketPriceValue
          : null,
      weight_kg:
        weightKgValue !== null && !Number.isNaN(weightKgValue)
          ? weightKgValue
          : null,
      is_apprentice: isApprentice,
      apprentice_claim_kg:
        apprenticeClaimValue !== null && !Number.isNaN(apprenticeClaimValue)
          ? apprenticeClaimValue
          : null,
      form_last_6: formLast6 ? normaliseImportedForm(formLast6) : null,
      track_form_last_6: trackFormLast6 || null,
      distance_form_last_6: distanceFormLast6 || null,
      scratched: false,
      created_by: profile.id,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      if (error.code === "23505") {
        return {
          success: false,
          error: "That horse is already loaded into this race.",
        };
      }
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/race-builder");
    revalidatePath("/current-races");
    revalidatePath("/admin/horses");
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create runner.",
    };
  }
}

export async function createRaceRunnersBulkAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const profile = await requireRacingAdmin();
    const supabase = await createClient();

    const raceId = Number(formData.get("race_id"));
    const runnersJson = String(formData.get("runners_json") ?? "");

    if (!raceId) {
      return { success: false, error: "Race is required." };
    }

    let importedRunners: Array<{
      horse_name?: string;
      jockey_name?: string;
      trainer_name?: string;
      barrier?: string;
      market_price?: string;
      weight_kg?: string;
      is_apprentice?: boolean;
      apprentice_claim_kg?: string;
      form_last_6?: string;
      track_form_last_6?: string;
      distance_form_last_6?: string;
    }> = [];

    try {
      importedRunners = JSON.parse(runnersJson);
    } catch {
      return { success: false, error: "Imported runners could not be read." };
    }

    if (!Array.isArray(importedRunners) || !importedRunners.length) {
      return { success: false, error: "No imported runners were supplied." };
    }

    const cleanedRunners = importedRunners
      .map((runner) => {
        const horseName = String(runner.horse_name || "")
          .replace(/\s+/g, " ")
          .trim();
        const normalisedName = normaliseHorseName(horseName);

        return {
          ...runner,
          horse_name: horseName,
          normalised_name: normalisedName,
        };
      })
      .filter((runner) => runner.horse_name && runner.normalised_name);

    if (!cleanedRunners.length) {
      return { success: false, error: "No valid horse names were found." };
    }

    const seenNames = new Set<string>();
    const duplicateNames = new Set<string>();

    for (const runner of cleanedRunners) {
      if (seenNames.has(runner.normalised_name)) {
        duplicateNames.add(runner.horse_name);
      }
      seenNames.add(runner.normalised_name);
    }

    if (duplicateNames.size > 0) {
      return {
        success: false,
        error: `Duplicate horse in import: ${Array.from(duplicateNames).join(", ")}`,
      };
    }

    const normalisedNames = Array.from(seenNames);

    const { data: existingHorses, error: existingHorsesError } = await supabase
      .from("horses")
      .select("id, horse_name, normalised_name")
      .in("normalised_name", normalisedNames);

    if (existingHorsesError) {
      return { success: false, error: existingHorsesError.message };
    }

    const horsesByNormalisedName = new Map<string, { id: number }>();

    for (const horse of existingHorses || []) {
      horsesByNormalisedName.set(String((horse as any).normalised_name), {
        id: Number((horse as any).id),
      });
    }

    const missingHorseRows = cleanedRunners
      .filter((runner) => !horsesByNormalisedName.has(runner.normalised_name))
      .map((runner) => ({
        horse_name: runner.horse_name,
        normalised_name: runner.normalised_name,
        form_last_6: runner.form_last_6
          ? normaliseImportedForm(String(runner.form_last_6))
          : null,
        track_form_last_6: runner.track_form_last_6 || null,
        distance_form_last_6: runner.distance_form_last_6 || null,
        updated_at: new Date().toISOString(),
      }));

    if (missingHorseRows.length > 0) {
      const { data: insertedHorses, error: insertedHorsesError } = await supabase
        .from("horses")
        .insert(missingHorseRows)
        .select("id, normalised_name");

      if (insertedHorsesError && insertedHorsesError.code !== "23505") {
        return { success: false, error: insertedHorsesError.message };
      }

      if (insertedHorsesError?.code === "23505") {
        const { data: retryHorses, error: retryHorsesError } = await supabase
          .from("horses")
          .select("id, normalised_name")
          .in("normalised_name", normalisedNames);

        if (retryHorsesError) {
          return { success: false, error: retryHorsesError.message };
        }

        for (const horse of retryHorses || []) {
          horsesByNormalisedName.set(String((horse as any).normalised_name), {
            id: Number((horse as any).id),
          });
        }
      } else {
        for (const horse of insertedHorses || []) {
          horsesByNormalisedName.set(String((horse as any).normalised_name), {
            id: Number((horse as any).id),
          });
        }
      }
    }

    const horseIds = cleanedRunners
      .map((runner) => horsesByNormalisedName.get(runner.normalised_name)?.id)
      .filter((id): id is number => Boolean(id));

    if (horseIds.length !== cleanedRunners.length) {
      return {
        success: false,
        error: "One or more imported horses could not be matched or created.",
      };
    }

    const { data: existingRaceRunners, error: existingRaceRunnersError } =
      await supabase
        .from("race_runners")
        .select("horse_id, horses(horse_name)")
        .eq("race_id", raceId)
        .in("horse_id", horseIds);

    if (existingRaceRunnersError) {
      return { success: false, error: existingRaceRunnersError.message };
    }

    if ((existingRaceRunners || []).length > 0) {
      const duplicateHorseNames = (existingRaceRunners || []).map((runner: any) => {
        const horse = Array.isArray(runner.horses)
          ? runner.horses[0]
          : runner.horses;
        return horse?.horse_name || `Horse ${runner.horse_id}`;
      });

      return {
        success: false,
        error: `Already loaded into this race: ${duplicateHorseNames.join(", ")}`,
      };
    }

    const now = new Date().toISOString();

    const runnerRows = cleanedRunners.map((runner) => {
      const horseId = horsesByNormalisedName.get(runner.normalised_name)?.id;
      const barrierValue = runner.barrier ? Number(runner.barrier) : null;
      const marketPriceValue = runner.market_price
        ? Number(runner.market_price)
        : null;
      const weightKgValue = runner.weight_kg ? Number(runner.weight_kg) : null;
      const apprenticeClaimValue = runner.apprentice_claim_kg
        ? Number(runner.apprentice_claim_kg)
        : null;

      return {
        race_id: raceId,
        horse_id: horseId,
        jockey_name: runner.jockey_name || null,
        trainer_name: runner.trainer_name || null,
        barrier:
          barrierValue !== null && !Number.isNaN(barrierValue)
            ? barrierValue
            : null,
        market_price:
          marketPriceValue !== null && !Number.isNaN(marketPriceValue)
            ? marketPriceValue
            : null,
        weight_kg:
          weightKgValue !== null && !Number.isNaN(weightKgValue)
            ? weightKgValue
            : null,
        is_apprentice:
          typeof runner.is_apprentice === "boolean"
            ? runner.is_apprentice
            : null,
        apprentice_claim_kg:
          apprenticeClaimValue !== null && !Number.isNaN(apprenticeClaimValue)
            ? apprenticeClaimValue
            : null,
        form_last_6: runner.form_last_6
          ? normaliseImportedForm(String(runner.form_last_6))
          : null,
        track_form_last_6: runner.track_form_last_6 || null,
        distance_form_last_6: runner.distance_form_last_6 || null,
        scratched: false,
        created_by: profile.id,
        updated_at: now,
      };
    });

    const { error: insertRunnersError } = await supabase
      .from("race_runners")
      .insert(runnerRows);

    if (insertRunnersError) {
      if (insertRunnersError.code === "23505") {
        return {
          success: false,
          error: "One or more horses are already loaded into this race.",
        };
      }

      return { success: false, error: insertRunnersError.message };
    }

    revalidatePath("/admin/race-builder");
    revalidatePath("/current-races");
    revalidatePath("/admin/horses");

    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to import runners.",
    };
  }
}


export async function deleteRaceRunnerAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireRacingAdmin();

    const runnerId = Number(formData.get("runner_id"));

    if (!runnerId) {
      return { success: false, error: "Runner is required." };
    }

    await clearSuggestedTipLinksForRunnerIds([runnerId]);
    await serviceRoleDelete(`race_runners?id=eq.${runnerId}`);

    revalidatePath("/admin/race-builder");
    revalidatePath("/current-races");
    revalidatePath("/");
    revalidatePath("/resulted-tips");
    revalidatePath("/my-resulted-tips");

    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete runner.",
    };
  }
}

export async function updateRaceRunnerDetailsAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireRacingAdmin();
    const supabase = await createClient();

    const runnerId = Number(formData.get("runner_id"));

    if (!runnerId) {
      return { success: false, error: "Runner is required." };
    }

    const jockeyName = String(formData.get("jockey_name") ?? "").trim();
    const trainerName = String(formData.get("trainer_name") ?? "").trim();
    const barrierRaw = String(formData.get("barrier") ?? "").trim();
    const marketPriceRaw = String(formData.get("market_price") ?? "").trim();
    const weightKgRaw = String(formData.get("weight_kg") ?? "").trim();
    const isApprenticeRaw = String(formData.get("is_apprentice") ?? "").trim();
    const apprenticeClaimRaw = String(
      formData.get("apprentice_claim_kg") ?? "",
    ).trim();
    const formLast6 = String(formData.get("form_last_6") ?? "").trim();
    const trackFormLast6 = String(
      formData.get("track_form_last_6") ?? "",
    ).trim();
    const distanceFormLast6 = String(
      formData.get("distance_form_last_6") ?? "",
    ).trim();

    const barrierValue = barrierRaw ? Number(barrierRaw) : null;
    const marketPriceValue = marketPriceRaw ? Number(marketPriceRaw) : null;
    const weightKgValue = weightKgRaw ? Number(weightKgRaw) : null;
    const apprenticeClaimValue = apprenticeClaimRaw
      ? Number(apprenticeClaimRaw)
      : null;

    const isApprentice =
      isApprenticeRaw === "true"
        ? true
        : isApprenticeRaw === "false"
          ? false
          : null;

    const { error } = await supabase
      .from("race_runners")
      .update({
        jockey_name: jockeyName || null,
        trainer_name: trainerName || null,
        barrier:
          barrierValue !== null && !Number.isNaN(barrierValue)
            ? barrierValue
            : null,
        market_price:
          marketPriceValue !== null && !Number.isNaN(marketPriceValue)
            ? marketPriceValue
            : null,
        weight_kg:
          weightKgValue !== null && !Number.isNaN(weightKgValue)
            ? weightKgValue
            : null,
        is_apprentice: isApprentice,
        apprentice_claim_kg:
          apprenticeClaimValue !== null && !Number.isNaN(apprenticeClaimValue)
            ? apprenticeClaimValue
            : null,
        form_last_6: formLast6 ? normaliseImportedForm(formLast6) : null,
        track_form_last_6: trackFormLast6 || null,
        distance_form_last_6: distanceFormLast6 || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", runnerId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/current-races");
    revalidatePath("/admin/race-builder");
    revalidatePath("/race-archive");
    revalidatePath("/admin/horses");
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update runner details.",
    };
  }
}

export async function toggleRaceRunnerScratchAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireRacingAdmin();
    const supabase = await createClient();

    const runnerId = Number(formData.get("runner_id"));
    const scratchedRaw = String(formData.get("scratched") ?? "").trim();

    if (!runnerId) {
      return { success: false, error: "Runner is required." };
    }

    const scratched = scratchedRaw === "true";

    const { error } = await supabase
      .from("race_runners")
      .update({
        scratched,
        updated_at: new Date().toISOString(),
      })
      .eq("id", runnerId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/current-races");
    revalidatePath("/race-archive");
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update scratch status.",
    };
  }
}

export async function bulkScratchRaceRunnersAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireRacingAdmin();
    const supabase = await createClient();

    const raceId = Number(formData.get("race_id"));
    const runnerIdsRaw = String(formData.get("runner_ids") ?? "").trim();

    if (!raceId) {
      return { success: false, error: "Race is required." };
    }

    let runnerIds: number[] = [];

    try {
      const parsed = JSON.parse(runnerIdsRaw || "[]");
      runnerIds = Array.isArray(parsed)
        ? parsed.map((value) => Number(value)).filter(Boolean)
        : [];
    } catch {
      runnerIds = runnerIdsRaw
        .split(",")
        .map((value) => Number(value.trim()))
        .filter(Boolean);
    }

    const uniqueRunnerIds = Array.from(new Set(runnerIds));

    if (!uniqueRunnerIds.length) {
      return { success: true, error: null };
    }

    const { data: matchingRunners, error: matchingError } = await supabase
      .from("race_runners")
      .select("id")
      .eq("race_id", raceId)
      .in("id", uniqueRunnerIds);

    if (matchingError) {
      return { success: false, error: matchingError.message };
    }

    const safeRunnerIds = (matchingRunners || [])
      .map((runner: any) => Number(runner.id))
      .filter(Boolean);

    if (!safeRunnerIds.length) {
      return { success: true, error: null };
    }

    const { error } = await supabase
      .from("race_runners")
      .update({
        scratched: true,
        updated_at: new Date().toISOString(),
      })
      .eq("race_id", raceId)
      .in("id", safeRunnerIds);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/current-races");
    revalidatePath("/race-archive");
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to bulk scratch runners.",
    };
  }
}

export async function settleRaceRunnersAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireRacingAdmin();
    const supabase = await createClient();

    const raceId = Number(formData.get("race_id"));

    if (!raceId) {
      return { success: false, error: "Race is required." };
    }

    const { data: raceRunners, error: runnersError } = await supabase
      .from("race_runners")
      .select(
        "id, horse_id, scratched, form_last_6, track_form_last_6, distance_form_last_6",
      )
      .eq("race_id", raceId);

    if (runnersError) {
      return { success: false, error: runnersError.message };
    }

    const now = new Date().toISOString();
    const runnersById = new Map<number, any>();
    const scratchedMap = new Map<number, boolean>();

    for (const runner of raceRunners || []) {
      const runnerId = Number((runner as any).id);
      runnersById.set(runnerId, runner);
      scratchedMap.set(runnerId, Boolean((runner as any).scratched));
    }

    const updates: Array<{
      id: number;
      finishing_position: number | null;
      starting_price: number | null;
      won: boolean | null;
      placed: boolean | null;
      settled_at: string | null;
      updated_at: string;
    }> = [];

    for (const [key, value] of formData.entries()) {
      if (!key.startsWith("finishing_position_")) continue;

      const runnerId = Number(key.replace("finishing_position_", ""));
      const finishingPositionRaw = String(value ?? "").trim();

      if (!runnerId) continue;

      const isScratched = scratchedMap.get(runnerId) === true;

      if (isScratched) {
        updates.push({
          id: runnerId,
          finishing_position: null,
          starting_price: null,
          won: false,
          placed: false,
          settled_at: now,
          updated_at: now,
        });
        continue;
      }

      const finishingPosition = finishingPositionRaw
        ? Number(finishingPositionRaw)
        : null;
      const startingPriceRaw = String(
        formData.get(`starting_price_${runnerId}`) ?? "",
      ).trim();
      const startingPrice = startingPriceRaw ? Number(startingPriceRaw) : null;

      const hasFinish =
        finishingPosition !== null && !Number.isNaN(finishingPosition);

      updates.push({
        id: runnerId,
        finishing_position: hasFinish ? finishingPosition : null,
        starting_price:
          startingPrice !== null && !Number.isNaN(startingPrice)
            ? startingPrice
            : null,
        won: hasFinish ? finishingPosition === 1 : false,
        placed: hasFinish ? finishingPosition <= 3 : false,
        settled_at: now,
        updated_at: now,
      });
    }

    if (!updates.length) {
      return { success: false, error: "No runner results were submitted." };
    }

    try {
      await saveCalculatorPredictionsForRace(raceId, {
        excludeScratched: true,
      });
    } catch (predictionError) {
      console.error(
        "Calculator final prediction snapshot failed:",
        predictionError,
      );
    }

    const rpcResults = updates.map((update) => ({
      runner_id: update.id,
      finishing_position: update.finishing_position,
      starting_price: update.starting_price,
    }));

    const { error: rpcError } = await supabase.rpc("settle_race_fast", {
      p_race_id: raceId,
      p_results: rpcResults,
    });

    if (rpcError) {
      return { success: false, error: rpcError.message };
    }
    try {
  const calculatorTipUpdates = updates.map((update) => ({
    race_id: raceId,
    race_runner_id: update.id,
    finishing_position: update.finishing_position,
    won: update.won,
    placed: update.placed,
    settled_at: update.settled_at,
    updated_at: now,
  }));

  for (const update of calculatorTipUpdates) {
    await serviceRoleFetch(
      `smartpunt_calculator_tips?race_id=eq.${raceId}&race_runner_id=eq.${update.race_runner_id}`,
      {
        method: "PATCH",
        headers: {
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          finishing_position: update.finishing_position,
          won: update.won,
          placed: update.placed,
          settled_at: update.settled_at,
          updated_at: update.updated_at,
        }),
      },
    );
  }
} catch (calculatorTipSettleError) {
  console.error(
    "SmartPunt calculator tip settlement update failed:",
    calculatorTipSettleError,
  );
}
try {
  for (const update of updates) {
    const finishingPosition = update.finishing_position;

    const won = finishingPosition === 1;
    const placed =
      finishingPosition !== null &&
      finishingPosition !== undefined &&
      finishingPosition <= 3;

    const matchingUserBets = await serviceRoleSelect(
      `user_bets?race_runner_id=eq.${update.id}&settled_at=is.null`,
    );

    for (const bet of matchingUserBets || []) {
      const betType = String((bet as any).bet_type || "Win");
      const oddsTaken = Number((bet as any).odds_taken || 0);
      const stakePoints = Number((bet as any).stake_points || 1);

      const successful = betType.toLowerCase().includes("place")
        ? placed
        : won;

      const returnPoints = successful
        ? Number((oddsTaken * stakePoints).toFixed(2))
        : 0;

      const profitLossPoints = Number(
        (returnPoints - stakePoints).toFixed(2),
      );

      await serviceRolePatch(`user_bets?id=eq.${(bet as any).id}`, {
        finishing_position: finishingPosition,
        won,
        placed,
        return_points: returnPoints,
        profit_loss_points: profitLossPoints,
        settled_at: now,
        updated_at: now,
      });
    }
  }
} catch (userBetSettlementError) {
  console.error(
    "User bet settlement process failed:",
    userBetSettlementError,
  );
}
    const horseIds = Array.from(
      new Set(
        updates
          .filter(
            (update) =>
              update.finishing_position !== null &&
              update.finishing_position !== undefined &&
              update.finishing_position > 0,
          )
          .map((update) => Number(runnersById.get(update.id)?.horse_id))
          .filter(Boolean),
      ),
    );

if (horseIds.length > 0) {
  const { data: horseRows, error: horseFetchError } = await supabase
    .from("horses")
.select(`
  id,
  horse_name,
  form_last_6,
  track_form_last_6,
  distance_form_last_6,
  good_track_record,
  soft_track_record,
  heavy_track_record,
  synthetic_track_record
`)
    .in("id", horseIds);

  if (horseFetchError) {
    return { success: false, error: horseFetchError.message };
  }

  const horseRowsById = new Map<number, any>();

  for (const horse of horseRows || []) {
    horseRowsById.set(Number((horse as any).id), horse);
  }
const raceIdsForCondition = Array.from(
  new Set(
    updates
      .map((update) => runnersById.get(update.id)?.race_id)
      .filter(Boolean),
  ),
);

const { data: raceConditionRows, error: raceConditionError } =
  raceIdsForCondition.length > 0
    ? await supabase
        .from("races")
        .select("id, meeting_id, meetings(track_condition)")
        .in("id", raceIdsForCondition)
    : { data: [], error: null };

if (raceConditionError) {
  return { success: false, error: raceConditionError.message };
}

const raceConditionByRaceId = new Map<number, string>();

for (const raceRow of raceConditionRows || []) {
  const meetingData = Array.isArray((raceRow as any).meetings)
    ? (raceRow as any).meetings[0]
    : (raceRow as any).meetings;

  raceConditionByRaceId.set(
    Number((raceRow as any).id),
    String(meetingData?.track_condition || ""),
  );
}
  for (const update of updates) {
    if (
      update.finishing_position === null ||
      update.finishing_position === undefined ||
      update.finishing_position <= 0
    ) {
      continue;
    }

    const matchingRunner = runnersById.get(update.id);
    const horseId = Number(matchingRunner?.horse_id);

    if (!horseId) continue;

    let horseRow = horseRowsById.get(horseId) || null;

    // create missing horse row safely
    if (!horseRow) {
      const horseName =
        String(matchingRunner?.horse_name || "").trim() || "Unknown horse";

      const { data: createdHorseRow, error: createHorseError } = await supabase
        .from("horses")
.insert({
  id: horseId,
  horse_name: horseName,
  normalised_name: normaliseHorseName(horseName),

  form_last_6: null,
  track_form_last_6: null,
  distance_form_last_6: null,

  good_track_record: null,
  soft_track_record: null,
  heavy_track_record: null,
  synthetic_track_record: null,
})
.select(`
  id,
  horse_name,
  form_last_6,
  track_form_last_6,
  distance_form_last_6,
  good_track_record,
  soft_track_record,
  heavy_track_record,
  synthetic_track_record
`)
        .single();

      if (createHorseError) {
        return { success: false, error: createHorseError.message };
      }

      horseRow = createdHorseRow;
      horseRowsById.set(horseId, horseRow);
    }

    const existingHorseForm =
      horseRow?.form_last_6 ||
      normaliseImportedForm(String(matchingRunner?.form_last_6 || ""));

    const existingTrackForm =
      horseRow?.track_form_last_6 ||
      String(matchingRunner?.track_form_last_6 || "");

    const existingDistanceForm =
      horseRow?.distance_form_last_6 ||
      String(matchingRunner?.distance_form_last_6 || "");

const trackCondition = String(
  raceConditionByRaceId.get(Number(matchingRunner?.race_id)) || "",
).toLowerCase();

const { error: horseUpdateError } = await supabase
  .from("horses")
  .update({
    form_last_6: updateFormStringWithResult(
      existingHorseForm || null,
      Number(update.finishing_position),
    ),

    track_form_last_6: updateStatRecordWithResult(
      existingTrackForm || null,
      Number(update.finishing_position),
    ),

    distance_form_last_6: updateStatRecordWithResult(
      existingDistanceForm || null,
      Number(update.finishing_position),
    ),

    good_track_record: trackCondition.startsWith("good")
      ? updateStatRecordWithResult(
          horseRow?.good_track_record || null,
          Number(update.finishing_position),
        )
      : horseRow?.good_track_record || null,

    soft_track_record: trackCondition.startsWith("soft")
      ? updateStatRecordWithResult(
          horseRow?.soft_track_record || null,
          Number(update.finishing_position),
        )
      : horseRow?.soft_track_record || null,

    heavy_track_record: trackCondition.startsWith("heavy")
      ? updateStatRecordWithResult(
          horseRow?.heavy_track_record || null,
          Number(update.finishing_position),
        )
      : horseRow?.heavy_track_record || null,

    synthetic_track_record: trackCondition.startsWith("synthetic")
      ? updateStatRecordWithResult(
          horseRow?.synthetic_track_record || null,
          Number(update.finishing_position),
        )
      : horseRow?.synthetic_track_record || null,

    updated_at: now,
  })
  .eq("id", horseId);

if (horseUpdateError) {
  return { success: false, error: horseUpdateError.message };
}
  }
}

    revalidatePath("/admin/race-builder");
    revalidatePath("/current-races");
    revalidatePath("/race-archive");
    revalidatePath("/admin/horses");
    revalidatePath("/resulted-tips");
    revalidatePath("/my-resulted-tips");
    revalidatePath("/");

    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to settle race.",
    };
  }
}
function normaliseJockeyProfileName(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function upsertJockeyProfileAction(formData: FormData): Promise<void> {
  const profile = await getCurrentProfile();

  if (!profile || !["admin", "staff_admin"].includes(profile.role)) {
    throw new Error("Unauthorized");
  }

  const supabase = await createClient();

  const id = String(formData.get("id") || "").trim();
  const jockeyName = String(formData.get("jockey_name") || "").trim();
  const manualRatingRaw = String(formData.get("manual_rating") || "").trim();
  const confidenceTag = String(formData.get("confidence_tag") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (!jockeyName) {
    throw new Error("Jockey name is required.");
  }

  const manualRating = manualRatingRaw ? Number(manualRatingRaw) : null;

  if (
    manualRating !== null &&
    (!Number.isFinite(manualRating) || manualRating < 1 || manualRating > 100)
  ) {
    throw new Error("Manual rating must be between 1 and 100.");
  }

  const payload = {
    jockey_name: jockeyName,
    normalised_name: normaliseJockeyProfileName(jockeyName),
    manual_rating: manualRating,
    confidence_tag: confidenceTag || null,
    notes: notes || null,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { error } = await supabase
      .from("jockey_profiles")
      .update(payload)
      .eq("id", Number(id));

    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("jockey_profiles")
      .upsert(
        {
          ...payload,
          rating: 55,
        },
        { onConflict: "normalised_name" },
      );

    if (error) throw new Error(error.message);
  }

  revalidatePath("/admin/jockeys");
  revalidatePath("/admin/calculator");
}

export async function deleteJockeyProfileAction(formData: FormData): Promise<void> {
  const profile = await getCurrentProfile();

  if (!profile || !["admin", "staff_admin"].includes(profile.role)) {
    throw new Error("Unauthorized");
  }

  const supabase = await createClient();
  const id = Number(formData.get("id"));

  if (!id) {
    throw new Error("Jockey profile is required.");
  }

  const { error } = await supabase.from("jockey_profiles").delete().eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/jockeys");
  revalidatePath("/admin/calculator");
}

function getFortuneWeekRange(dateValue: string) {
  const date = dateValue ? new Date(`${dateValue}T00:00:00`) : new Date();

  if (Number.isNaN(date.getTime())) {
    throw new Error("Valid Fortune on 5 date is required.");
  }

  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const toDateOnly = (value: Date) => value.toISOString().slice(0, 10);

  return {
    publishedDate: toDateOnly(date),
    weekStartDate: toDateOnly(monday),
    weekEndDate: toDateOnly(sunday),
  };
}

export async function createFortuneFiveAction(
  formData: FormData,
): Promise<void> {
  const profile = await requireAdmin();
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const publishedDateRaw = String(formData.get("published_date") ?? "").trim();

  if (!title) {
    throw new Error("Fortune on 5 title is required.");
  }

  if (!publishedDateRaw) {
    throw new Error("Fortune on 5 date is required.");
  }

  const { publishedDate, weekStartDate, weekEndDate } =
    getFortuneWeekRange(publishedDateRaw);

  const legRunnerIds = [1, 2, 3, 4, 5]
    .map((legNumber) => Number(formData.get(`leg_${legNumber}_race_runner_id`) || 0))
    .filter(Boolean);

  if (legRunnerIds.length !== 5) {
    throw new Error("Fortune on 5 requires exactly five legs.");
  }

  if (new Set(legRunnerIds).size !== 5) {
    throw new Error("Each Fortune on 5 leg must be a different runner.");
  }

  const { data: runnerRows, error: runnersError } = await supabase
    .from("race_runners")
    .select("*, races(*), horses(*)")
    .in("id", legRunnerIds);

  if (runnersError) {
    throw new Error(runnersError.message);
  }

  const runnersById = new Map<number, any>();
  for (const runner of runnerRows || []) {
    runnersById.set(Number((runner as any).id), runner);
  }

  const missingRunner = legRunnerIds.find((runnerId) => !runnersById.has(runnerId));
  if (missingRunner) {
    throw new Error("One of the selected Fortune on 5 runners could not be found.");
  }

  const meetingIds = Array.from(
    new Set(
      (runnerRows || [])
        .map((runner: any) => Number(runner?.races?.meeting_id || 0))
        .filter(Boolean),
    ),
  );

  const { data: meetingRows, error: meetingsError } = meetingIds.length
    ? await supabase
        .from("meetings")
        .select("id, meeting_name")
        .in("id", meetingIds)
    : { data: [], error: null };

  if (meetingsError) {
    throw new Error(meetingsError.message);
  }

  const meetingsById = new Map<number, any>();
  for (const meeting of meetingRows || []) {
    meetingsById.set(Number((meeting as any).id), meeting);
  }

  const insertedFortuneFives = await serviceRoleFetch(
    "fortune_fives?select=id",
    {
      method: "POST",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        title,
        description: description || null,
        week_start_date: weekStartDate,
        week_end_date: weekEndDate,
        published_date: publishedDate,
        status: "active",
        created_by: profile.id,
      }),
    },
  );

  const fortuneFive = Array.isArray(insertedFortuneFives)
    ? insertedFortuneFives[0]
    : insertedFortuneFives;

  if (!fortuneFive?.id) {
    throw new Error("Fortune on 5 could not be created.");
  }

  const legRows = [1, 2, 3, 4, 5].map((legNumber) => {
    const runnerId = Number(formData.get(`leg_${legNumber}_race_runner_id`) || 0);
    const runner = runnersById.get(runnerId);
    const race = (runner as any).races;
    const horse = (runner as any).horses;
    const betType = String(formData.get(`leg_${legNumber}_bet_type`) ?? "Win");

    return {
      fortune_five_id: fortuneFive.id,
      leg_number: legNumber,
      race_id: race?.id || runner.race_id || null,
      race_runner_id: runner.id,
      horse_id: horse?.id || runner.horse_id || null,
      race: race
        ? `${meetingsById.get(Number(race.meeting_id))?.meeting_name || "Meeting"} — R${race.race_number} ${race.race_name || "Race"}`
        : "Race",
      horse: horse?.horse_name || "Unknown horse",
      bet_type: betType,
    };
  });

  await serviceRoleFetch("fortune_five_legs", {
    method: "POST",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify(legRows),
  });

  revalidatePath("/");
  revalidatePath("/admin/fortune-on-5");
  revalidatePath("/fortune-on-5");
}

export async function acceptFortuneFiveAction(
  formData: FormData,
): Promise<void> {
  const profile = await getCurrentProfile();

  if (!profile || profile.status !== "active") {
    throw new Error("Unauthorized");
  }

  const supabase = await createClient();
  const fortuneFiveId = Number(formData.get("fortune_five_id") || 0);
  const oddsTaken = Number(formData.get("odds_taken") || 0);

  if (!fortuneFiveId) {
    throw new Error("Fortune on 5 selection is required.");
  }

  if (!oddsTaken || Number.isNaN(oddsTaken) || oddsTaken <= 1) {
    throw new Error("Valid multi odds are required.");
  }

  const { error } = await supabase.from("user_fortune_fives").insert({
    user_id: profile.id,
    fortune_five_id: fortuneFiveId,
    odds_taken: oddsTaken,
    stake_points: 1,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/fortune-on-5");
}

export async function resultFortuneFiveAction(
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();

  const fortuneFiveId = Number(formData.get("fortune_five_id") || 0);
  const result = String(formData.get("result") ?? "").trim();

  if (!fortuneFiveId) {
    throw new Error("Fortune on 5 result is required.");
  }

  const isWon = result === "won";
  const isLost = result === "lost";
  const isVoid = result === "void";

  if (!isWon && !isLost && !isVoid) {
    throw new Error("Choose Won, Lost, or Void.");
  }

  const now = new Date().toISOString();

  const { error: fortuneError } = await supabase
    .from("fortune_fives")
    .update({
      status: isVoid ? "void" : "settled",
      won: isVoid ? null : isWon,
      settled_at: now,
    })
    .eq("id", fortuneFiveId);

  if (fortuneError) {
    throw new Error(fortuneError.message);
  }

  const { data: acceptedRows, error: acceptedError } = await supabase
    .from("user_fortune_fives")
    .select("id, odds_taken, stake_points")
    .eq("fortune_five_id", fortuneFiveId)
    .is("settled_at", null);

  if (acceptedError) {
    throw new Error(acceptedError.message);
  }

  await Promise.all(
    (acceptedRows || []).map(async (row: any) => {
      const stakePoints = Number(row.stake_points || 1);
      const oddsTaken = Number(row.odds_taken || 0);
      const returnPoints = isVoid
        ? stakePoints
        : isWon
          ? Number((oddsTaken * stakePoints).toFixed(2))
          : 0;
      const profitLossPoints = Number((returnPoints - stakePoints).toFixed(2));

      const { error } = await supabase
        .from("user_fortune_fives")
        .update({
          won: isVoid ? null : isWon,
          return_points: returnPoints,
          profit_loss_points: profitLossPoints,
          settled_at: now,
        })
        .eq("id", row.id);

      if (error) {
        throw new Error(error.message);
      }
    }),
  );

  revalidatePath("/");
  revalidatePath("/admin/fortune-on-5");
  revalidatePath("/fortune-on-5");
}

export async function updateFortuneFiveLegResultAction(
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const legId = Number(formData.get("leg_id") || 0);
  const result = String(formData.get("result") ?? "pending");

  if (!legId) {
    throw new Error("Fortune on 5 leg is required.");
  }

  const legRows = (await serviceRoleSelect(
    `fortune_five_legs?id=eq.${legId}&select=id,fortune_five_id`,
  )) as Array<{ id: number; fortune_five_id: number }> | null;

  const leg = legRows?.[0];

  if (!leg?.fortune_five_id) {
    throw new Error("Fortune on 5 leg could not be found.");
  }

  const legWon =
    result === "won" ? true : result === "lost" ? false : null;

  await serviceRolePatch(`fortune_five_legs?id=eq.${legId}`, {
    won: legWon,
  });

  const allLegs = (await serviceRoleSelect(
    `fortune_five_legs?fortune_five_id=eq.${leg.fortune_five_id}&select=id,won`,
  )) as Array<{ id: number; won: boolean | null }> | null;

  const legs = allLegs || [];
  const now = new Date().toISOString();
  const hasLostLeg = legs.some((item) => item.won === false);
  const allLegsWon = legs.length === 5 && legs.every((item) => item.won === true);

  if (hasLostLeg) {
    await serviceRolePatch(`fortune_fives?id=eq.${leg.fortune_five_id}`, {
      won: false,
      settled_at: now,
      status: "active",
    });

    const userEntries = (await serviceRoleSelect(
      `user_fortune_fives?fortune_five_id=eq.${leg.fortune_five_id}&settled_at=is.null&select=id,stake_points`,
    )) as Array<{ id: number; stake_points: number | string | null }> | null;

    await Promise.all(
      (userEntries || []).map((entry) => {
        const stakePoints = Number(entry.stake_points || 1);

        return serviceRolePatch(`user_fortune_fives?id=eq.${entry.id}`, {
          won: false,
          return_points: 0,
          profit_loss_points: Number((-stakePoints).toFixed(2)),
          settled_at: now,
        });
      }),
    );
  } else if (allLegsWon) {
    await serviceRolePatch(`fortune_fives?id=eq.${leg.fortune_five_id}`, {
      won: true,
      settled_at: now,
      status: "active",
    });

    const userEntries = (await serviceRoleSelect(
      `user_fortune_fives?fortune_five_id=eq.${leg.fortune_five_id}&settled_at=is.null&select=id,odds_taken,stake_points`,
    )) as Array<{
      id: number;
      odds_taken: number | string | null;
      stake_points: number | string | null;
    }> | null;

    await Promise.all(
      (userEntries || []).map((entry) => {
        const oddsTaken = Number(entry.odds_taken || 0);
        const stakePoints = Number(entry.stake_points || 1);
        const returnPoints = Number((oddsTaken * stakePoints).toFixed(2));
        const profitLossPoints = Number((returnPoints - stakePoints).toFixed(2));

        return serviceRolePatch(`user_fortune_fives?id=eq.${entry.id}`, {
          won: true,
          return_points: returnPoints,
          profit_loss_points: profitLossPoints,
          settled_at: now,
        });
      }),
    );
  } else {
    await serviceRolePatch(`fortune_fives?id=eq.${leg.fortune_five_id}`, {
      won: null,
      settled_at: null,
      status: "active",
    });

    await serviceRolePatch(
      `user_fortune_fives?fortune_five_id=eq.${leg.fortune_five_id}`,
      {
        won: null,
        return_points: null,
        profit_loss_points: null,
        settled_at: null,
      },
    );
  }

  revalidatePath("/admin/fortune-on-5");
  revalidatePath("/fortune-on-5");
}

