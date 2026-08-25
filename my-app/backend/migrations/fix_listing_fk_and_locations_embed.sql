-- ───────────────────────────────────────────────────────────────────────────
-- Durable DB-side fixes for the two errors seen in the logs.
-- The code changes in server.js make the API work without these, but applying
-- them removes the root causes at the schema level. Run in the Supabase SQL editor.
-- ───────────────────────────────────────────────────────────────────────────


-- ============================================================================
-- 1) FK violation on listing cleanup/delete
--    "update or delete on table \"listings\" violates foreign key constraint
--     \"conversations_listing_id_fkey\" on table \"conversations\""
--
--    Deleting a listing fails whenever a conversation still references it.
--    Make the reference cascade (or SET NULL) so the DB cleans up automatically.
--    Pick ONE of the two options below.
-- ============================================================================

-- Option A (recommended): delete the conversation when its listing is deleted.
-- Requires that messages / hidden_conversations also cascade from conversations
-- (see the two follow-up statements).
ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS conversations_listing_id_fkey,
  ADD  CONSTRAINT conversations_listing_id_fkey
       FOREIGN KEY (listing_id) REFERENCES listings(item_id) ON DELETE CASCADE;

-- Make child rows of a conversation cascade too, so the delete above succeeds.
ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_conversation_id_fkey,
  ADD  CONSTRAINT messages_conversation_id_fkey
       FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;

ALTER TABLE hidden_conversations
  DROP CONSTRAINT IF EXISTS hidden_conversations_conversation_id_fkey,
  ADD  CONSTRAINT hidden_conversations_conversation_id_fkey
       FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;

-- Option B (alternative): keep the conversation but detach it from the listing.
-- Use this instead of Option A if conversations should survive listing deletion.
--   ALTER TABLE conversations
--     DROP CONSTRAINT IF EXISTS conversations_listing_id_fkey,
--     ADD  CONSTRAINT conversations_listing_id_fkey
--          FOREIGN KEY (listing_id) REFERENCES listings(item_id) ON DELETE SET NULL;


-- ============================================================================
-- 2) "Could not embed because more than one relationship was found for
--     'listings' and 'locations'"
--
--    listings has more than one FK path to locations, so PostgREST can't pick
--    one for the locations(...) embed. The server.js change pins it with a hint
--    (locations!location_id). First confirm WHY there are two relationships:
-- ============================================================================

-- Introspect every FK between listings and locations:
SELECT
  con.conname              AS constraint_name,
  att.attname              AS listings_column,
  cl_loc.relname           AS references_table
FROM pg_constraint con
JOIN pg_class      cl_src  ON cl_src.oid = con.conrelid
JOIN pg_class      cl_loc  ON cl_loc.oid = con.confrelid
JOIN unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
JOIN pg_attribute  att     ON att.attrelid = con.conrelid AND att.attnum = k.attnum
WHERE con.contype = 'f'
  AND cl_src.relname = 'listings'
  AND cl_loc.relname = 'locations';

-- Interpreting the result:
--   * Two rows on the SAME listings_column  -> a duplicate constraint (a migration
--     likely ran twice). Drop the extra one; then the embed needs no hint:
--       ALTER TABLE listings DROP CONSTRAINT <the_duplicate_constraint_name>;
--   * Two rows on DIFFERENT columns (e.g. location_id and some other column) ->
--     both relationships are real; the locations!location_id hint in server.js is
--     the correct fix and nothing needs to change here.
