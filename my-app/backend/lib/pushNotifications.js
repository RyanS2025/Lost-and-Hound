import { supabase } from "./supabase.js";

export async function sendPushNotification(userId, title, body, data = {}) {
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  const appId  = process.env.ONESIGNAL_APP_ID;
  if (!apiKey || !appId) return;

  const [{ data: row }, { data: prefs }] = await Promise.all([
    supabase.from("push_tokens").select("player_id").eq("user_id", userId).single(),
    supabase.from("profiles").select("push_notifications_enabled").eq("id", userId).single(),
  ]);

  if (!row?.player_id) return;
  if (prefs?.push_notifications_enabled === false) return;

  try {
    await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${apiKey}` },
      body: JSON.stringify({
        app_id: appId,
        include_player_ids: [row.player_id],
        headings: { en: title },
        contents: { en: body },
        data,
      }),
    });
    supabase.from("push_logs").insert({ user_id: userId }).catch(() => {});
    incrementPushCount().catch(() => {});
  } catch (err) {
    console.error("Push notification error:", err);
  }
}

export async function sendBroadcastPush(title, body, data = {}) {
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  const appId  = process.env.ONESIGNAL_APP_ID;
  if (!apiKey || !appId) return;
  try {
    let notifPayload = {
      app_id: appId,
      included_segments: ["All"],
      headings: { en: title },
      contents: { en: body },
      data,
    };

    try {
      const { data: optedOut } = await supabase
        .from("profiles")
        .select("id")
        .eq("broadcast_notifications_enabled", false);
      if (optedOut?.length > 0) {
        const optedOutIds = optedOut.map(r => r.id);
        const { data: tokens } = await supabase
          .from("push_tokens")
          .select("player_id")
          .not("user_id", "in", `(${optedOutIds.map(id => `"${id}"`).join(",")})`);
        const playerIds = (tokens ?? []).map(t => t.player_id).filter(Boolean);
        if (playerIds.length > 0) {
          delete notifPayload.included_segments;
          notifPayload.include_player_ids = playerIds;
        }
      }
    } catch {}

    await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${apiKey}` },
      body: JSON.stringify(notifPayload),
    });
    await incrementPushCount();
  } catch (err) {
    console.error("Broadcast push error:", err);
  }
}

export async function incrementPushCount() {
  const { data: cfg } = await supabase
    .from("finance_config")
    .select("overrides")
    .eq("id", "singleton")
    .single();
  const current = cfg?.overrides?.push_count || 6;
  const next = { ...(cfg?.overrides ?? {}), push_count: current + 1 };
  await supabase
    .from("finance_config")
    .upsert({ id: "singleton", overrides: next, updated_at: new Date().toISOString() });
}
