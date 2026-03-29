-- Track when username was last changed (NULL = never changed, no cooldown)
ALTER TABLE users ADD COLUMN username_changed_at TIMESTAMPTZ;

-- Default ascent visibility preference
ALTER TABLE users ADD COLUMN default_visibility TEXT NOT NULL DEFAULT 'public';
ALTER TABLE users ADD CONSTRAINT chk_default_visibility
  CHECK (default_visibility IN ('public', 'friends', 'private'));
