import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import apiFetch from "./apiFetch";

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  // Request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Push notification permission denied");
    return null;
  }

  // Get Expo push token
  let tokenData;
  try {
    tokenData = await Notifications.getExpoPushTokenAsync();
  } catch {
    // projectId not available in Expo Go — push won't work until dev build
    console.log("[Push] Token registration skipped (Expo Go limitation)");
    return null;
  }
  const expoPushToken = tokenData.data;

  // Register token with backend
  try {
    await apiFetch("/api/push-tokens", {
      method: "POST",
      body: JSON.stringify({
        expoPushToken,
        platform: Platform.OS,
      }),
    });
    console.log("[Push] Token registered:", expoPushToken.slice(0, 20) + "...");
  } catch (err) {
    console.error("[Push] Failed to register token:", err);
  }

  return expoPushToken;
}

export async function unregisterPushToken(expoPushToken: string): Promise<void> {
  try {
    await apiFetch("/api/push-tokens", {
      method: "DELETE",
      body: JSON.stringify({ expoPushToken }),
    });
  } catch (err) {
    console.error("[Push] Failed to unregister token:", err);
  }
}
