
import "server-only";
import postgres from "postgres";

type Row = Record<string, unknown>;

const TABLES = new Set([
  "meetings",
  "races",
  "runners",
  "runner_results",
  "race_results",
  "api_response_snapshots",
  "collection_runs",
  "form_snapshots",
  "race_evidence_snapshots",
]);

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

let connection: ReturnType<typeof postgres> | undefined;

function getConnection() {
  if (connection) return connection;

  const url = process.env.SMARTPUNT_V2_DATABASE_URL;

  if (!url) {
    throw new Error(
      "V2 database connection not configured. Add SMARTPUNT_V2_DATABASE_URL in Vercel."
    );
  }

  connection = postgres(url, {
    max: 2,
    idle_timeout: 10,
    connect_timeout: 10,
    ssl: "require",
    prepare: false,
    connection: {
      default_transaction_read_only: "on",
      statement_timeout: "10000",
    },
  });

  return connection;
}

function quoteIdentifier(value: string): string {
  if (!IDENTIFIER.test(value)) {
    throw new Error("Invalid V2 SQL identifier");
  }

  return `"${value}"`;
}

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
  if (!TABLES.has(table)) {
    throw new Error("Unsupported V2 table");
  }

  const columns = (options.select ?? "*")
    .split(",")
    .map((column) => column.trim());

  if (
    columns.length === 0 ||
    columns.some(
      (column) =>
        column !== "*" && !IDENTIFIER.test(column)
    ) ||
    (columns.includes("*") && columns.length !== 1)
  ) {
    throw new Error("Invalid V2 column selection");
  }

  const selectedColumns =
    columns.length === 1 && columns[0] === "*"
      ? "*"
      : columns.map(quoteIdentifier).join(", ");

  const values: string[] = [];
  const conditions: string[] = [];

  for (const [field, value] of Object.entries(
    options.filters ?? {}
  )) {
    const identifier = quoteIdentifier(field);
    values.push(value);
    conditions.push(
      `${identifier} = $${values.length}`
    );
  }

  let orderClause = "";

  if (options.order) {
    const parts = options.order.split(",").map((part) => {
      const pieces = part.trim().split(".");
      if (pieces.length > 2) {
        throw new Error("Invalid V2 ordering");
      }

      const field = quoteIdentifier(pieces[0]);
      const direction = pieces[1] ?? "asc";

      if (!["asc", "desc"].includes(direction)) {
        throw new Error("Invalid V2 sort direction");
      }

      return `${field} ${direction.toUpperCase()}`;
    });

    orderClause = ` ORDER BY ${parts.join(", ")}`;
  }

  const requestedLimit = Number.isFinite(options.limit)
    ? Math.trunc(options.limit!)
    : 40;

  const requestedOffset = Number.isFinite(options.offset)
    ? Math.trunc(options.offset!)
    : 0;

  const limit = Math.min(
    Math.max(requestedLimit, 1),
    100
  );

  const offset = Math.max(requestedOffset, 0);

  const whereClause = conditions.length
    ? ` WHERE ${conditions.join(" AND ")}`
    : "";

  const query = [
    `SELECT ${selectedColumns}`,
    `FROM "pf".${quoteIdentifier(table)}`,
    whereClause,
    orderClause,
    ` LIMIT ${limit} OFFSET ${offset}`,
  ].join("");

  try {
    const sql = getConnection();
    const rows = await sql.unsafe(query, values);
    return rows as Row[];
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown database error";

    throw new Error(
      `V2 ${table} database query failed: ${message}`
    );
  }
}
