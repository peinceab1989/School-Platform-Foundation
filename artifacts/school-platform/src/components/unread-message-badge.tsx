import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

/** Live unread-message count for the signed-in user's school inbox. */
export default function UnreadMessageBadge({ schoolId }: { schoolId: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    const db = getSupabaseClient() as any;
    let channel: any;
    let userId = "";

    const refresh = async () => {
      const { data } = await db.auth.getUser();
      userId = data?.user?.id ?? "";
      if (!userId || !active) return;
      const result = await db.from("school_messages")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId).eq("recipient_id", userId).eq("is_read", false);
      if (active && !result.error) setCount(result.count ?? 0);
    };

    void refresh();
    channel = db.channel("resa-unread-badge-" + schoolId + "-" + Math.random().toString(36).slice(2))
      .on("postgres_changes", { event: "*", schema: "public", table: "school_messages", filter: "school_id=eq." + schoolId }, (payload: any) => {
        if (payload.new?.recipient_id === userId || payload.old?.recipient_id === userId) void refresh();
      }).subscribe();

    return () => {
      active = false;
      if (channel) void db.removeChannel(channel);
    };
  }, [schoolId]);

  if (!count) return null;
  return <span aria-label={count + " unread messages"} title={count + " unread messages"} className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-extrabold leading-none text-white">{count > 99 ? "99+" : count}</span>;
}
