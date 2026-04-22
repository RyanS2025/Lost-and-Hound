import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import apiFetch from "../utils/apiFetch";

const LS_KEY = "__onesignalPlayerId";

// Poll localStorage for the player_id written by AppDelegate.swift.
// This handles any timing between native SDK hydration and React login.
export default function usePushNotifications(userId) {
  useEffect(() => {
    if (!userId || !Capacitor.isNativePlatform()) return;

    let stopped = false;

    async function tryRegister() {
      const playerId = localStorage.getItem(LS_KEY) || window[LS_KEY];
      if (!playerId) return false;
      await apiFetch("/api/push-tokens", {
        method: "POST",
        body: JSON.stringify({ playerId }),
      });
      return true;
    }

    // Try immediately, then poll every second for up to 30s
    tryRegister().then((done) => {
      if (done || stopped) return;
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        const done = await tryRegister().catch(() => false);
        if (done || attempts >= 30 || stopped) clearInterval(interval);
      }, 1000);
    }).catch(() => {});

    return () => { stopped = true; };
  }, [userId]);
}
