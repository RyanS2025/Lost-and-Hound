import { supabase } from "../../backend/supabaseClient";

export const API_BASE = window.location.hostname === "localhost"
  ? "http://localhost:3001"
  : "https://lost-and-hound-backend-production.up.railway.app";
// Change this to your deployed URL later, e.g. "https://api.myapp.com"

// Retrieve the stored device token from localStorage (30-day) or sessionStorage (session-only).
export function getStoredDeviceToken() {
  const ls = localStorage.getItem("2fa_device_token");
  if (ls) return ls;
  return sessionStorage.getItem("2fa_device_token") || null;
}

// Persist a device token after successful 2FA verification.
export function storeDeviceToken(token, remember) {
  if (remember) {
    localStorage.setItem("2fa_device_token", token);
    sessionStorage.removeItem("2fa_device_token");
  } else {
    sessionStorage.setItem("2fa_device_token", token);
    localStorage.removeItem("2fa_device_token");
  }
}

// Clear the device token on sign-out.
export function clearDeviceToken() {
  localStorage.removeItem("2fa_device_token");
  sessionStorage.removeItem("2fa_device_token");
}

export default async function apiFetch(path, options = {}) {
  // 1. Get the current session from Supabase (this is still client-side auth)
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  // 2. Build the headers — always include the Bearer token and device token
  const deviceToken = getStoredDeviceToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token       && { Authorization:    `Bearer ${token}` }),
    ...(deviceToken && { "X-Device-Token": deviceToken }),
    ...options.headers, // allow overrides if needed
  };

  // 3. Make the fetch call
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  // 4. Parse the response
  const json = await res.json();

  // 5. If the server returned an error status, throw it
  //    This lets you catch errors in your components with try/catch
  if (!res.ok) {
    throw new Error(json.error || `Request failed with status ${res.status}`);
  }

  return json;
}