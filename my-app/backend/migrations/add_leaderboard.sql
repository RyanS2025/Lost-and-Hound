-- Run this in the Supabase SQL editor to add the leaderboard/points system.

-- 1. Add points column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 0;

-- 2. Create point_events audit table
CREATE TABLE IF NOT EXISTS point_events (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type  TEXT        NOT NULL,  -- 'post_found' | 'post_lost' | 'resolved'
  points      INTEGER     NOT NULL,
  listing_id  UUID        REFERENCES listings(item_id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_point_events_user_id ON point_events(user_id);

-- 3. Atomic increment helper (avoids read-modify-write race)
CREATE OR REPLACE FUNCTION increment_user_points(uid UUID, delta INT)
RETURNS void AS $$
  UPDATE profiles SET points = points + delta WHERE id = uid;
$$ LANGUAGE sql SECURITY DEFINER;
