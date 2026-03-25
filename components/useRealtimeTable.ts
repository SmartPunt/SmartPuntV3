"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useRealtimeTable<T>(table: string, initialData: T[]) {
  const [rows, setRows] = useState<T[]>(initialData);

  useEffect(() => {
    setRows(initialData);
  }, [initialData]);

  useEffect(() => {
    const supabase = createClient();

    const refresh = async () => {
      const { data } = await supabase.from(table).select("*").order("created_at", { ascending: false });
      if (data) setRows(data as T[]);
    };

    const channel = supabase
      .channel(`realtime:${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, refresh)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table]);

  return rows;
}
