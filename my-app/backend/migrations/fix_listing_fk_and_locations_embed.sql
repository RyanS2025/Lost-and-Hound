-- ============================================================================
-- Fix: listing-delete FK violations + ambiguous listings↔locations embed
-- ============================================================================
-- Two production errors motivated this migration:
--
--   1. "update or delete on table \"listings\" violates foreign key constraint
--       \"conversations_listing_id_fkey\" on table \"conversations\""
--      → conversations.listing_id references listings with no ON DELETE rule,
--        so any listing that has a conversation cannot be deleted.
--
--   2. "Could not embed because more than one relationship was found for
--       'listings' and 'locations'"
--      → listings has TWO real foreign keys to locations (confirmed via the
--        STEP 0 query below): location_id (listings_location_id_fkey) and
--        desk_location_id (listings_desk_location_id_fkey). Because both are
--        valid, `select=*,locations(...)` is ambiguous and must name a column.
--        The app pins to location_id, which is the one the listing feed means.
--
-- The application code already works around both (it pre-deletes dependent
-- conversations, and pins embeds to `locations!location_id`). This migration
-- removes the root causes at the schema level so the workarounds become
-- belt-and-suspenders rather than load-bearing.
--
-- Run these in the Supabase Dashboard → SQL Editor. The introspection queries
-- are read-only; run them first and read the output before the ALTERs.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- STEP 0 (READ-ONLY): inspect every FK between listings and locations.
-- CONFIRMED RESULT (2026-06): two rows on DIFFERENT columns —
--   listings_location_id_fkey      (location_id)      ← used by the app
--   listings_desk_location_id_fkey (desk_location_id) ← separate "desk" link
-- Both are legitimate, so there is nothing to drop; the code's
-- `locations!location_id` hint is the correct and complete fix. Re-run this
-- only if a future schema change makes the embed ambiguous again.
-- ----------------------------------------------------------------------------
SELECT
  con.conname                        AS constraint_name,
  src.relname                        AS from_table,
  att.attname                        AS from_column,
  tgt.relname                        AS to_table
FROM pg_constraint con
JOIN pg_class src        ON src.oid = con.conrelid
JOIN pg_class tgt        ON tgt.oid = con.confrelid
JOIN unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
JOIN pg_attribute att    ON att.attrelid = con.conrelid AND att.attnum = k.attnum
WHERE con.contype = 'f'
  AND src.relname = 'listings'
  AND tgt.relname = 'locations'
ORDER BY con.conname, k.ord;


-- ----------------------------------------------------------------------------
-- STEP 1 (READ-ONLY): confirm the conversations → listings FK and its current
-- delete behavior (confdeltype: 'a' = NO ACTION, 'r' = RESTRICT, 'c' = CASCADE,
-- 'n' = SET NULL).
-- CONFIRMED RESULT (2026-06): confdeltype = 'a' (NO ACTION) — the database does
-- nothing on listing delete, which is exactly what blocks deleting a listing
-- that still has a conversation. STEP 2 below is the optional permanent fix.
-- ----------------------------------------------------------------------------
SELECT conname, confdeltype
FROM pg_constraint
WHERE contype = 'f' AND conname = 'conversations_listing_id_fkey';


-- ----------------------------------------------------------------------------
-- STEP 2: make deleting a listing automatic for its dependents.
-- Pick ONE of the two options below.
--
-- Option A — SET NULL (recommended): keep the conversation/message history,
-- just detach it from the deleted listing. The app already tolerates a null
-- listing_id on a conversation. Least destructive.
--
-- Option B — CASCADE: deleting a listing also deletes its conversations. You
-- then ALSO need cascades from messages/hidden_conversations → conversations
-- (see Option B continued) or those child rows will block the cascade.
-- ----------------------------------------------------------------------------

-- ---- Option A: SET NULL ----------------------------------------------------
-- ALTER TABLE conversations DROP CONSTRAINT conversations_listing_id_fkey;
-- ALTER TABLE conversations
--   ADD CONSTRAINT conversations_listing_id_fkey
--   FOREIGN KEY (listing_id) REFERENCES listings(item_id) ON DELETE SET NULL;

-- ---- Option B: CASCADE -----------------------------------------------------
-- ALTER TABLE conversations DROP CONSTRAINT conversations_listing_id_fkey;
-- ALTER TABLE conversations
--   ADD CONSTRAINT conversations_listing_id_fkey
--   FOREIGN KEY (listing_id) REFERENCES listings(item_id) ON DELETE CASCADE;
--
-- ---- Option B continued: cascade conversations' own children ---------------
-- (confirm the exact constraint names with STEP 0's query pattern, swapping the
--  table names, then:)
-- ALTER TABLE messages DROP CONSTRAINT messages_conversation_id_fkey;
-- ALTER TABLE messages
--   ADD CONSTRAINT messages_conversation_id_fkey
--   FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
--
-- ALTER TABLE hidden_conversations DROP CONSTRAINT hidden_conversations_conversation_id_fkey;
-- ALTER TABLE hidden_conversations
--   ADD CONSTRAINT hidden_conversations_conversation_id_fkey
--   FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
