import { createClient } from "@supabase/supabase-js";

// ── Fail fast, and say which variable is wrong ──────────────────────────────
// Without this, a missing or malformed value surfaces as a stack trace inside
// node_modules:
//
//   Error: Invalid supabaseUrl: Provided URL is malformed.
//       at validateSupabaseUrl (.../@supabase/supabase-js/dist/index.mjs:155:9)
//
// which names neither the variable nor what it currently contains, on a
// service that then crash-loops. The checks below mirror supabase-js's own
// validation ladder so the message can distinguish "not set" from "no scheme"
// from "unparseable" — three quite different mistakes.
//
// The URL is safe to print: it is public by construction (the same host is
// baked into the frontend bundle as VITE_SUPABASE_URL). The service-role key
// is never printed, only measured — its length alone is enough to tell an
// empty variable from a truncated paste.
function assertSupabaseEnv() {
  const rawUrl = process.env.SUPABASE_URL;
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = rawUrl?.trim();
  const problems = [];

  if (!url) {
    problems.push("SUPABASE_URL is not set (or is only whitespace)");
  } else if (!/^https?:\/\//i.test(url)) {
    problems.push(
      `SUPABASE_URL has no http(s):// scheme — got ${JSON.stringify(rawUrl)}`
    );
  } else {
    try {
      new URL(url);
    } catch {
      // Node's URL parser is far more permissive than it looks: it silently
      // percent-encodes ${ } " and strips tabs and newlines, so none of those
      // land here. Verified causes, which is what makes this hint worth
      // printing: an empty host ("https://" on its own, e.g. a variable
      // reference that resolved to nothing), a space in the host, a
      // non-numeric port, an unclosed [ , or a bad %-escape.
      problems.push(
        `SUPABASE_URL is not a parseable URL — got ${JSON.stringify(rawUrl)}\n` +
          "      Usually: nothing after https:// , a space in the host,\n" +
          "      or a non-numeric port after a colon."
      );
    }
  }

  if (!rawKey?.trim()) {
    problems.push("SUPABASE_SERVICE_ROLE_KEY is not set (or is only whitespace)");
  } else if (rawKey.trim().length < 40) {
    problems.push(
      `SUPABASE_SERVICE_ROLE_KEY looks truncated — ${rawKey.trim().length} characters`
    );
  }

  if (problems.length === 0) return;

  console.error("\n[config] Cannot start: the backend environment is incomplete.\n");
  for (const problem of problems) console.error(`  • ${problem}`);
  console.error(
    "\n  Set these on the service (Railway → Variables) or in my-app/backend/.env.\n" +
      "  See my-app/backend/.env.example for the full list.\n"
  );
  process.exit(1);
}

assertSupabaseEnv();

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
