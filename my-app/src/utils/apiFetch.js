import { supabase } from "../../backend/supabaseClient";

export const API_BASE = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:3001" : "");

export default async function apiFetch(path, options = {}) {
  // 1. Get the current session from Supabase (this is still client-side auth)
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const deviceToken = localStorage.getItem("device_token");

  // 2. Build the headers — always include the Bearer token and device token
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
    // Attach the status and the parsed body. Callers that only read
    // err.message keep working, but the ones that need to branch on a machine
    // -readable code — IMAGE_BLOCKED vs SCREENING_UNAVAILABLE, which mean very
    // different things to the user — can now do so without string matching.
    const err = new Error(json.error || `Request failed with status ${res.status}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }

  return json;
}