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

  return (
    <AdminCalculator
      races={races}
      runners={runners}
      horses={horses}
      meetings={meetings}
    />
  );
}
