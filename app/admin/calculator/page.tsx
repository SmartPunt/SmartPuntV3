import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import AdminCalculator from "@/components/admin-calculator";

async function fetchAllRows<T>({
  pageSize = 1000,
  getPage,
}: {
  pageSize?: number;
  getPage: (from: number, to: number) => Promise<{ data: T[] | null; error: any }>;
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

function getServiceRoleConfig() {
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
      Accept: "application/json",
    },
  };
}

async function fetchServiceRoleRows<T>(tablePath: string) {
  const allRows: T[] = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { supabaseUrl, headers } = getServiceRoleConfig();
    const separator = tablePath.includes("?") ? "&" : "?";
    const path = `${tablePath}${separator}limit=${pageSize}&offset=${offset}`;

    const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Service role request failed for ${tablePath}`);
    }

    const rows = (await response.json()) as T[];
    allRows.push(...rows);

    if (rows.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return allRows;
}

export default async function Page() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (!["admin", "staff_admin"].includes(profile.role)) {
    redirect("/");
  }

  const supabase = await createClient();

  const races = await fetchAllRows({
    getPage: async (from, to) => {
      const result = await supabase
        .from("races")
        .select("*")
        .order("meeting_id", { ascending: false })
        .order("race_number", { ascending: true })
        .range(from, to);

      return {
        data: result.data ?? [],
        error: result.error,
      };
    },
  });

  const runners = await fetchAllRows({
    getPage: async (from, to) => {
      const result = await supabase
        .from("race_runners")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);

      return {
        data: result.data ?? [],
        error: result.error,
      };
    },
  });

  const horses = await fetchAllRows({
    getPage: async (from, to) => {
      const result = await supabase
        .from("horses")
        .select("*")
        .order("horse_name", { ascending: true })
        .range(from, to);

      return {
        data: result.data ?? [],
        error: result.error,
      };
    },
  });

  const meetings = await fetchAllRows({
    getPage: async (from, to) => {
      const result = await supabase
        .from("meetings")
        .select("*")
        .order("meeting_date", { ascending: false })
        .range(from, to);

      return {
        data: result.data ?? [],
        error: result.error,
      };
    },
  });

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

const calculatorTips = await fetchServiceRoleRows<{
  id: number;
  race_id: number | null;
  race_runner_id: number | null;
  horse_id: number | null;
  bet_type: string | null;
  status: string | null;
  published_at: string | null;
}>(
    "smartpunt_calculator_tips?select=*&order=published_at.desc",
  );

  return (
    <AdminCalculator
      races={races}
      runners={runners}
      horses={horses}
      meetings={meetings}
      jockeyProfiles={jockeyProfiles}
      calculatorTips={calculatorTips}
    />
  );
}
