-- Run this in the Supabase SQL editor to create the support_tickets table.

CREATE TABLE IF NOT EXISTS support_tickets (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  email        TEXT,
  name         TEXT,
  category     TEXT        NOT NULL,
  subject      TEXT        NOT NULL,
  description  TEXT        NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'open',
  mod_note     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- status values: 'open' | 'in_progress' | 'resolved' | 'closed'
