import "server-only";

type Row = Record<string, unknown>;

const TABLES = new Set([
  "meetings", "races", "runners", "runner_results", "race_results",
  "api_response_snapshots", "collection_runs", "form_snapshots", "race_evidence_snapshots",
]);

export async function v2Rows(
  table: string,
  options: {
    select?: string;
    filters?: Record<string, string>;
    order?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<Row[]> {
  if (!TABLES.has(table)) throw new Error("Unsupported V2 table");
  const url = process.env.SMARTPUNT_V2_SUPABASE_URL;
  const key = process.env.SMARTPUNT_V2_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("V2 connection not configured. Add the two SMARTPUNT_V2 environment variables in Vercel.");

  const params = new URLSearchParams();
  params.set("select", options.select ?? "*");
  for (const [field, value] of Object.entries(options.filters ?? {})) {
    if (!/^[a-z_]+$/.test(field)) throw new Error("Invalid filter");
    params.set(field, `eq.${value}`);
  }
  if (options.order) params.set("order", options.order);
  params.set("limit", String(Math.min(Math.max(options.limit ?? 40, 1), 100)));
  params.set("offset", String(Math.max(options.offset ?? 0, 0)));

  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${table}?${params}`, {
    method: "GET",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Accept-Profile": "pf",
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = (await response.text()).slice(0, 400);
    throw new Error(`V2 ${table} request failed (${response.status}): ${body}`);
  }
  return (await response.json()) as Row[];
}
