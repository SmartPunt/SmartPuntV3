"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function useRealtimeTable<T>(table: string, initialData: T[]) {
  const [rows, setRows] = useState<T[]>(initialData);
  const router = useRouter();

  useEffect(() => {
    setRows(initialData);
  }, [initialData]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`realtime:${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => {
        router.refresh();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router, table]);

  return rows;
}
