-- Filter leaderboard to confirmed emails only by joining auth.users.
-- Run this in the Supabase SQL editor.

-- Returns top 50 confirmed users by points, optionally filtered by campus.
CREATE OR REPLACE FUNCTION get_leaderboard(campus_filter TEXT DEFAULT NULL)
RETURNS TABLE (
  id             UUID,
  first_name     TEXT,
  last_name      TEXT,
  points         INTEGER,
  default_campus TEXT
) AS $$
  SELECT p.id, p.first_name, p.last_name, p.points, p.default_campus
  FROM profiles p
  INNER JOIN auth.users u ON u.id = p.id
  WHERE u.email_confirmed_at IS NOT NULL
    AND (campus_filter IS NULL OR campus_filter = 'global' OR p.default_campus = campus_filter)
  ORDER BY p.points DESC
  LIMIT 50;
$$ LANGUAGE sql SECURITY DEFINER;

-- Returns how many confirmed users have more points than a given user (used for rank calculation).
CREATE OR REPLACE FUNCTION get_rank_of_user(uid UUID, campus_filter TEXT DEFAULT NULL)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM profiles p
  INNER JOIN auth.users u ON u.id = p.id
  WHERE u.email_confirmed_at IS NOT NULL
    AND p.points > (SELECT points FROM profiles WHERE id = uid)
    AND (campus_filter IS NULL OR campus_filter = 'global' OR p.default_campus = campus_filter);
$$ LANGUAGE sql SECURITY DEFINER;
