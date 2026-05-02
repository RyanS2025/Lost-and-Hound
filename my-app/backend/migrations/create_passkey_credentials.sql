-- Run this in the Supabase SQL editor to add WebAuthn passkey support.

CREATE TABLE IF NOT EXISTS passkey_credentials (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  credential_id TEXT        NOT NULL UNIQUE,   -- base64url encoded WebAuthn credential ID
  public_key    TEXT        NOT NULL,           -- base64url encoded COSE public key
  counter       BIGINT      NOT NULL DEFAULT 0, -- sign counter (replay attack prevention)
  device_name   TEXT        NOT NULL DEFAULT 'My Device',
  transports    TEXT,                           -- JSON array of transport hints
  aaguid        TEXT,                           -- authenticator type identifier
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_passkey_credentials_user_id       ON passkey_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_passkey_credentials_credential_id ON passkey_credentials(credential_id);
