-- Backfill points for users who posted listings or resolved items before
-- the points system was introduced. Safe to run multiple times — uses
-- WHERE NOT EXISTS to skip listings that already have a point event.

-- 1. Award points for existing found listings (+15)
INSERT INTO point_events (user_id, event_type, points, listing_id)
SELECT poster_id, 'post_found', 15, item_id
FROM listings
WHERE listing_type = 'found'
  AND NOT EXISTS (
    SELECT 1 FROM point_events
    WHERE listing_id = listings.item_id
      AND event_type = 'post_found'
  );

-- 2. Award points for existing lost listings (+5)
INSERT INTO point_events (user_id, event_type, points, listing_id)
SELECT poster_id, 'post_lost', 5, item_id
FROM listings
WHERE listing_type = 'lost'
  AND NOT EXISTS (
    SELECT 1 FROM point_events
    WHERE listing_id = listings.item_id
      AND event_type = 'post_lost'
  );

-- 3. Award points for already-resolved listings (+25)
INSERT INTO point_events (user_id, event_type, points, listing_id)
SELECT poster_id, 'resolved', 25, item_id
FROM listings
WHERE resolved = true
  AND NOT EXISTS (
    SELECT 1 FROM point_events
    WHERE listing_id = listings.item_id
      AND event_type = 'resolved'
  );

-- 4. Recalculate points totals for all profiles from point_events
UPDATE profiles
SET points = COALESCE((
  SELECT SUM(pe.points)
  FROM point_events pe
  WHERE pe.user_id = profiles.id
), 0);
