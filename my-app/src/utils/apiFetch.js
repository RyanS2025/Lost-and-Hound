import { supabase } from "../../backend/supabaseClient";

const API_BASE = "http://localhost:3001";
// Change this to your deployed URL later, e.g. "https://api.myapp.com"

export default async function apiFetch(path, options = {}) {
  // 1. Get the current session from Supabase (this is still client-side auth)
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  // 2. Build the headers — always include the Bearer token
  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
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