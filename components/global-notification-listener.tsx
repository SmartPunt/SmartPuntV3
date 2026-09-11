"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";

type LiveSubscriberNotification = {
  id: number;
  user_id: string;
  notification_type:
    | "maverick_tip"
    | "race_day_started"
    | "conditions_changed"
    | "vault_matches_today";
  title: string;
  message: string;
  link: string | null;
  race_id: number | null;
  meeting_id: number | null;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
};

function getNotificationIcon(
  type: LiveSubscriberNotification["notification_type"],
) {
  if (type === "maverick_tip") {
    return "🛡️";
  }

  if (type === "race_day_started") {
    return "🏇";
  }

  if (type === "conditions_changed") {
    return "🌦️";
  }

  if (type === "vault_matches_today") {
    return "🔔";
  }

  return "●";
}

export default function GlobalNotificationListener() {
  const [supabase] = useState(() => createClient());

  const [
    liveNotification,
    setLiveNotification,
  ] = useState<LiveSubscriberNotification | null>(
    null,
  );

  const dismissTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );

  useEffect(() => {
    let active = true;
    let channel:
      | ReturnType<typeof supabase.channel>
      | null = null;

    async function startNotificationListener() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active || !user) {
        return;
      }

      channel = supabase
        .channel(
          `smartpunt-subscriber-notifications-${user.id}`,
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "subscriber_notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (!active) {
              return;
            }

            const notification =
              payload.new as LiveSubscriberNotification;

            setLiveNotification(notification);

            if (dismissTimerRef.current) {
              clearTimeout(
                dismissTimerRef.current,
              );
            }

            dismissTimerRef.current =
              setTimeout(() => {
                setLiveNotification(null);
              }, 9000);
          },
        )
        .subscribe();
    }

    startNotificationListener();

    return () => {
      active = false;

      if (dismissTimerRef.current) {
        clearTimeout(
          dismissTimerRef.current,
        );
      }

      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [supabase]);

  function openNotification() {
    if (!liveNotification) {
      return;
    }

    /*
     * Use a normal navigation deliberately.
     *
     * This guarantees the Dashboard server request
     * reloads subscriber_notifications before the
     * notification window opens.
     */
    window.location.assign(
      `/subscriber-dashboard?notificationId=${liveNotification.id}`,
    );
  }

  if (!liveNotification) {
    return null;
  }

  return (
    <div
      className="
        fixed
        left-3
        right-3
        top-[calc(env(safe-area-inset-top)+0.75rem)]
        z-[120]
        mx-auto
        max-w-[28rem]
        sm:left-auto
        sm:right-5
        sm:top-5
        sm:mx-0
        sm:w-[24rem]
      "
      role="status"
      aria-live="polite"
    >
      <div className="relative overflow-hidden rounded-[1.4rem] border border-amber-300/35 bg-zinc-950 shadow-[0_20px_60px_rgba(0,0,0,0.75)]">
        <button
          type="button"
          onClick={openNotification}
          className="block w-full px-4 py-4 pr-11 text-left transition active:scale-[0.99] hover:bg-amber-300/[0.05]"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-300/10 text-xl">
              {getNotificationIcon(
                liveNotification.notification_type,
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-amber-300">
                SmartPunt Alert
              </p>

              <p className="mt-1 text-sm font-black leading-5 text-white">
                {liveNotification.title}
              </p>

              <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-400">
                {liveNotification.message}
              </p>

              <p className="mt-2 text-[9px] font-black uppercase tracking-[0.12em] text-amber-200">
                Tap to view notification →
              </p>
            </div>
          </div>
        </button>

        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={() =>
            setLiveNotification(null)
          }
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-black/60 text-sm font-black text-zinc-400 transition hover:bg-white/10 hover:text-white"
        >
          ×
        </button>

        <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-amber-300 to-transparent" />
      </div>
    </div>
  );
}
