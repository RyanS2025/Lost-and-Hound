-- ============================================================================
-- Sensitive-content screening — complete schema change, one script
-- ============================================================================
-- Paste the whole file into Supabase Dashboard → SQL Editor and run it once.
-- Safe to re-run: every statement is idempotent. Run it on the DEV project
-- first, then production.
--
-- RUN THIS BEFORE DEPLOYING THE CODE. Every listing POST writes
-- description_internal, so the backend hard-fails until the column exists.
--
-- ── What ships with it ──────────────────────────────────────────────────────
--
-- 1. IMAGE SCREENING. Uploads are checked with Google Vision for adult content
--    and for government IDs, payment cards and personal documents. Anything
--    that matches is deleted from storage before it can be attached to
--    anything; the post is still created and renders a "photo hidden" tile.
--
-- 2. DESCRIPTION AUTO-SORTER. One description is split in two:
--      listings.description           PUBLIC, auto-redacted — what the feed shows
--      listings.description_internal  STAFF ONLY — the original, including the
--                                     specifics the Curry front desk uses to
--                                     verify a claimant really owns an item
--
--    Note the direction: `description` keeps its name and becomes the SAFE
--    column. Every existing read site, and every future one written without
--    thinking about this feature, therefore defaults to the redacted text. The
--    inverse layout would make one missed render site a privacy breach.
--
-- Existing rows are deliberately NOT backfilled. They keep whatever their
-- author typed and get description_internal = NULL, which the staff UI shows
-- as "No withheld details on file (posted before the auto-sorter)."
--
-- Column names are prefixed image_/sensitive_ so they cannot collide with the
-- proctor-desk columns on the Shamar--Leaderboard-game-work branch
-- (desk_location_id, received_at, received_by, owner_id, owner_name,
-- pickup_pin, delivered_at, delivered_by).
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. Redaction flags
-- ────────────────────────────────────────────────────────────────────────────
-- NOT NULL DEFAULT false rather than nullable: every read site does a plain
-- truthiness check, and a three-state column would make "unknown"
-- indistinguishable from "not redacted". Postgres 11+ stores the default in
-- the catalog instead of rewriting the table, so this is safe on a live table.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS image_redacted boolean NOT NULL DEFAULT false;

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS image_redacted boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.listings.image_redacted IS
  'True when the uploaded photo was blocked by sensitive-content screening. The image was deleted from storage and image_url is NULL; the UI renders a synthetic "photo hidden" tile. Set by the backend only, and only against a signed blocked-upload token — never trust a client-asserted value.';

COMMENT ON COLUMN public.support_tickets.image_redacted IS
  'See listings.image_redacted.';


-- ────────────────────────────────────────────────────────────────────────────
-- 2. The staff-only description
-- ────────────────────────────────────────────────────────────────────────────
-- Nullable with no default. NULL means either "this row predates the
-- auto-sorter" or "this description had nothing worth withholding", so
-- "has withheld details" is a plain IS NOT NULL check.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS description_internal text;

COMMENT ON COLUMN public.listings.description_internal IS
  'Auto-sorter: the full original description exactly as the poster typed it, including the identifying specifics the front desk uses to verify ownership. DESK AND MODERATION STAFF ONLY. The public column "description" holds the auto-redacted external text. Never include this column in a select() reachable by a non-staff client — see PUBLIC_LISTING_COLUMNS in backend/routes/listings.js.';


-- ────────────────────────────────────────────────────────────────────────────
-- 3. Block audit
-- ────────────────────────────────────────────────────────────────────────────
-- Why a table rather than just stdout: the two reasons this log exists —
-- retuning the detection thresholds, and spotting someone who tries fifteen
-- times — are both retrospective aggregate questions. Railway's log retention
-- is short and not queryable, so console output cannot answer either.
--
-- What is deliberately NOT stored, and why:
--   * the image or any derivative  — the whole point is that it is gone
--   * the OCR text or matched text — that IS the personal information we just
--     deleted the image to avoid storing. Only rule ids ('PAY_LUHN_PAN') kept.
--   * the storage path             — would durably record the address of an
--     object we just deleted. path_hash still correlates repeat attempts.
--   * the raw IP                   — ip_hash is keyed and truncated, and is
--     only populated for guests, who have no other identity.

CREATE TABLE IF NOT EXISTS public.sensitive_image_blocks (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at   timestamptz NOT NULL DEFAULT now(),

  subject_kind text        NOT NULL CHECK (subject_kind IN ('user', 'guest')),
  subject_id   uuid        NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_hash      text        NULL,

  surface      text        NOT NULL CHECK (surface IN ('listing', 'support')),
  tier         text        NOT NULL CHECK (tier IN ('government_id', 'payment', 'pii_document', 'unsafe_content')),
  score        integer     NOT NULL,
  reasons      text[]      NOT NULL DEFAULT '{}',
  path_hash    text        NOT NULL
);

-- "Has this person tried repeatedly?"
CREATE INDEX IF NOT EXISTS sensitive_image_blocks_subject_idx
  ON public.sensitive_image_blocks (subject_id, created_at DESC);

-- "What did the last month look like?" (threshold tuning)
CREATE INDEX IF NOT EXISTS sensitive_image_blocks_created_idx
  ON public.sensitive_image_blocks (created_at DESC);

-- RLS on with NO policies = deny-all to anon and authenticated. The backend
-- reaches this table with the service-role key, which bypasses RLS. There is
-- deliberately no client-facing read path.
ALTER TABLE public.sensitive_image_blocks ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.sensitive_image_blocks IS
  'Append-only audit of images rejected by sensitive-content screening. Contains no image data, no OCR text, no URLs and no raw IPs — only rule ids, a score, and hashes. Service-role access only (RLS enabled, no policies).';


-- ────────────────────────────────────────────────────────────────────────────
-- 4. Vision usage accounting
-- ────────────────────────────────────────────────────────────────────────────
-- Screening costs 2 billable Google Vision units per image (SafeSearch + text
-- detection), or 4 when an ambiguous image escalates to label/logo detection.
-- The old counter assumed 1 unit per call, so it under-reports by 2-4x.

-- Created here because a fresh Supabase project will not have it yet; on an
-- existing project this is a no-op.
CREATE TABLE IF NOT EXISTS public.vision_usage (
  month      text PRIMARY KEY,
  call_count integer NOT NULL DEFAULT 0
);

ALTER TABLE public.vision_usage ENABLE ROW LEVEL SECURITY;

-- increment_vision_usage_by uses ON CONFLICT (month), which REQUIRES a unique
-- constraint on that column. A pre-existing table might not have one, and the
-- application code never proves it does — it only ever reads with .eq("month").
-- Guarded so we don't add a second, redundant index when a PK already covers it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class c     ON c.oid = i.indrelid
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY (i.indkey)
    WHERE c.relname = 'vision_usage'
      AND i.indisunique
      AND i.indnatts = 1
      AND a.attname = 'month'
  ) THEN
    CREATE UNIQUE INDEX vision_usage_month_key ON public.vision_usage (month);
  END IF;
END $$;

-- GREATEST(p_units, 0) stops a negative argument being used to walk the
-- counter backwards and hide spend.
CREATE OR REPLACE FUNCTION public.increment_vision_usage_by(p_month text, p_units integer)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.vision_usage (month, call_count)
  VALUES (p_month, GREATEST(p_units, 0))
  ON CONFLICT (month)
  DO UPDATE SET call_count = public.vision_usage.call_count + GREATEST(p_units, 0);
$$;

-- The single-argument original, for compatibility with `main` and with the
-- unmerged proctor-desk branch, both of which still call it. Harmless to keep.
CREATE OR REPLACE FUNCTION public.increment_vision_usage(p_month text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.increment_vision_usage_by(p_month, 1);
$$;

-- SECURITY DEFINER functions run as their owner, so they must not be callable
-- by untrusted roles. The backend uses the service-role key.
REVOKE ALL ON FUNCTION public.increment_vision_usage_by(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_vision_usage(text)             FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.increment_vision_usage_by(text, integer) IS
  'Adds p_units billable Google Vision units to the month''s counter. Screening costs 2 units per image, or 4 when an ambiguous image escalates to label/logo detection.';


-- ────────────────────────────────────────────────────────────────────────────
-- 5. Reload the PostgREST schema cache
-- ────────────────────────────────────────────────────────────────────────────
-- Without this the new columns return "PGRST204 column not found" until the
-- cache expires on its own.

NOTIFY pgrst, 'reload schema';


-- ────────────────────────────────────────────────────────────────────────────
-- 6. Verification — this is the result grid you will see
-- ────────────────────────────────────────────────────────────────────────────
-- Every row must say OK. Anything marked MISSING means a statement above
-- failed; scroll up in the SQL Editor output to find which.

WITH expected(object, present) AS (
  SELECT 'column  listings.image_redacted', EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'listings' AND column_name = 'image_redacted')
  UNION ALL
  SELECT 'column  listings.description_internal', EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'listings' AND column_name = 'description_internal')
  UNION ALL
  SELECT 'column  support_tickets.image_redacted', EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'support_tickets' AND column_name = 'image_redacted')
  UNION ALL
  SELECT 'table   sensitive_image_blocks',
         to_regclass('public.sensitive_image_blocks') IS NOT NULL
  UNION ALL
  SELECT 'rls     sensitive_image_blocks (deny-all)',
         COALESCE((SELECT c.relrowsecurity FROM pg_class c
                   WHERE c.oid = to_regclass('public.sensitive_image_blocks')), false)
  UNION ALL
  SELECT 'table   vision_usage',
         to_regclass('public.vision_usage') IS NOT NULL
  UNION ALL
  SELECT 'index   vision_usage unique(month)', EXISTS (
    SELECT 1 FROM pg_index i
    JOIN pg_class c     ON c.oid = i.indrelid
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY (i.indkey)
    WHERE c.relname = 'vision_usage' AND i.indisunique AND i.indnatts = 1 AND a.attname = 'month')
  UNION ALL
  SELECT 'fn      increment_vision_usage_by', EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'increment_vision_usage_by')
)
SELECT object, CASE WHEN present THEN 'OK' ELSE 'MISSING' END AS status
FROM expected
ORDER BY status DESC, object;


-- ============================================================================
-- REQUIRED: column-level grants on listings
-- ============================================================================
-- NOT optional, and it must run in the SAME session as the ALTER TABLE above.
-- The column does not exist until that ALTER runs, so there is nothing to leak
-- until it does — and from that moment there is, because this database has:
--
--   polname                                 polroles
--   "Authenticated users can read listings" {authenticated}
--
-- a permissive SELECT policy on public.listings. Confirmed by query, 2026-09-11.
--
-- That policy plus PostgREST means any logged-in student can skip Express
-- entirely with the anon key out of the JS bundle and their own session token:
--
--   GET /rest/v1/listings?select=item_id,description_internal
--
-- and read the ownership-verification details for every listing in the system.
-- PUBLIC_LISTING_COLUMNS and check-internal-leak.sh cannot see that request;
-- they only constrain our own source. This grant is what actually stops it.
--
-- Postgres has no "revoke one column", so this revokes table-level SELECT and
-- re-grants an explicit list. The list is DERIVED rather than pasted: a
-- hardcoded one silently rots the next time anyone adds a column, and the
-- proctor-desk work is about to add several. Anything not named in the exclude
-- list below stays readable exactly as it is today.
--
-- pickup_pin is excluded for the same reason description_internal is: it is a
-- verification secret. It may not exist yet; NOT IN simply won't match it.
--
-- Re-runnable. Adding a column later means running this block again.
DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'listings'
     AND column_name NOT IN ('description_internal', 'pickup_pin');

  IF cols IS NULL THEN
    RAISE EXCEPTION 'public.listings has no grantable columns — refusing to revoke';
  END IF;

  REVOKE SELECT ON public.listings FROM anon, authenticated;
  EXECUTE format('GRANT SELECT (%s) ON public.listings TO anon, authenticated', cols);
END $$;

-- Verify: this must return zero rows. Any row is a role that can still read a
-- withheld column directly through PostgREST.
SELECT grantee, column_name
  FROM information_schema.column_privileges
 WHERE table_schema = 'public'
   AND table_name = 'listings'
   AND column_name IN ('description_internal', 'pickup_pin')
   AND grantee IN ('anon', 'authenticated')
   AND privilege_type = 'SELECT';

-- Realtime caveat: whether postgres_changes payloads respect column privileges
-- is Realtime-version dependent. Nothing subscribes to listings today (checked
-- across src/ — the feed reads through apiFetch, not Realtime), so this is a
-- note for whoever adds the first such subscription, not a live gap.
