-- ALV Store own-auth extensions: password credentials + reset tokens.
-- Applied AFTER the Supabase migrations. The Express API is the only writer.

ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE auth.users ALTER COLUMN email SET NOT NULL;

CREATE TABLE IF NOT EXISTS auth.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON auth.password_reset_tokens(user_id);
