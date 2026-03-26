-- ============================================================
-- Cloudflare D1 Schema (SQLite)
-- Migrated from Neon Postgres schema
-- ============================================================

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- ============================================================
-- 1. profiles - user profile metadata
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  avatar_url TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS profiles_id_idx ON profiles(id);

-- ============================================================
-- 2. users - auth credentials (NEW for custom auth)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);

-- ============================================================
-- 3. drafts - one active draft per user
-- ============================================================
CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  config TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS drafts_user_id_idx ON drafts(user_id);

-- ============================================================
-- 4. saved_prompts - saved prompt library
-- ============================================================
CREATE TABLE IF NOT EXISTS saved_prompts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  tags TEXT DEFAULT '[]',
  config TEXT NOT NULL DEFAULT '{}',
  built_prompt TEXT NOT NULL DEFAULT '',
  enhanced_prompt TEXT NOT NULL DEFAULT '',
  fingerprint TEXT,
  revision INTEGER NOT NULL DEFAULT 1,
  is_shared INTEGER NOT NULL DEFAULT 0,
  target_model TEXT NOT NULL DEFAULT '',
  use_case TEXT NOT NULL DEFAULT '',
  remixed_from TEXT REFERENCES community_posts(id) ON DELETE SET NULL,
  remix_note TEXT NOT NULL DEFAULT '',
  remix_diff TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK(length(title) >= 1 AND length(title) <= 200),
  CHECK(length(description) <= 500),
  CHECK(category IN (
    'general', 'frontend', 'backend', 'fullstack', 'devops', 'data',
    'ml-ai', 'security', 'testing', 'api', 'automation', 'docs',
    'content', 'analysis', 'creative', 'business', 'education'
  )),
  CHECK(revision >= 1),
  CHECK(length(target_model) <= 80),
  CHECK(length(use_case) <= 500),
  CHECK(length(remix_note) <= 500)
);

CREATE INDEX IF NOT EXISTS saved_prompts_user_updated_at_idx ON saved_prompts(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS saved_prompts_user_id_idx ON saved_prompts(user_id);

-- ============================================================
-- 5. community_posts - public feed
-- ============================================================
CREATE TABLE IF NOT EXISTS community_posts (
  id TEXT PRIMARY KEY,
  saved_prompt_id TEXT NOT NULL UNIQUE REFERENCES saved_prompts(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  enhanced_prompt TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  use_case TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  tags TEXT DEFAULT '[]',
  target_model TEXT NOT NULL DEFAULT '',
  is_public INTEGER NOT NULL DEFAULT 1,
  public_config TEXT NOT NULL DEFAULT '{}',
  starter_prompt TEXT NOT NULL DEFAULT '',
  remixed_from TEXT REFERENCES community_posts(id) ON DELETE SET NULL,
  remix_note TEXT NOT NULL DEFAULT '',
  remix_diff TEXT,
  upvote_count INTEGER NOT NULL DEFAULT 0,
  verified_count INTEGER NOT NULL DEFAULT 0,
  remix_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK(length(title) >= 1 AND length(title) <= 200),
  CHECK(length(enhanced_prompt) <= 50000),
  CHECK(length(description) <= 500),
  CHECK(length(use_case) <= 500),
  CHECK(category IN (
    'general', 'frontend', 'backend', 'fullstack', 'devops', 'data',
    'ml-ai', 'security', 'testing', 'api', 'automation', 'docs',
    'content', 'analysis', 'creative', 'business', 'education'
  )),
  CHECK(length(target_model) <= 80),
  CHECK(length(starter_prompt) <= 500),
  CHECK(length(remix_note) <= 500),
  CHECK(upvote_count >= 0),
  CHECK(verified_count >= 0),
  CHECK(remix_count >= 0),
  CHECK(comment_count >= 0)
);

CREATE INDEX IF NOT EXISTS community_posts_created_at_idx ON community_posts(created_at DESC) WHERE is_public = 1;
CREATE INDEX IF NOT EXISTS community_posts_upvote_created_at_idx ON community_posts(upvote_count DESC, created_at DESC) WHERE is_public = 1;
CREATE INDEX IF NOT EXISTS community_posts_verified_created_at_idx ON community_posts(verified_count DESC, created_at DESC) WHERE is_public = 1;
CREATE INDEX IF NOT EXISTS community_posts_remix_created_at_idx ON community_posts(remix_count DESC, created_at DESC) WHERE is_public = 1;
CREATE INDEX IF NOT EXISTS community_posts_category_idx ON community_posts(category) WHERE is_public = 1;
CREATE INDEX IF NOT EXISTS community_posts_author_id_idx ON community_posts(author_id);
CREATE INDEX IF NOT EXISTS community_posts_remixed_from_idx ON community_posts(remixed_from) WHERE remixed_from IS NOT NULL;
CREATE INDEX IF NOT EXISTS community_posts_tags_idx ON community_posts(tags);
CREATE INDEX IF NOT EXISTS community_posts_saved_prompt_id_idx ON community_posts(saved_prompt_id);

-- ============================================================
-- 6. community_votes - upvotes + verified votes
-- ============================================================
CREATE TABLE IF NOT EXISTS community_votes (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(post_id, user_id, vote_type),
  CHECK(vote_type IN ('upvote', 'verified'))
);

CREATE INDEX IF NOT EXISTS community_votes_post_id_idx ON community_votes(post_id);
CREATE INDEX IF NOT EXISTS community_votes_user_id_idx ON community_votes(user_id);

-- ============================================================
-- 7. community_comments - flat comments
-- ============================================================
CREATE TABLE IF NOT EXISTS community_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK(length(body) >= 1 AND length(body) <= 2000)
);

CREATE INDEX IF NOT EXISTS community_comments_post_id_created_at_idx ON community_comments(post_id, created_at);

-- ============================================================
-- 8. community_user_follows - profile follow graph
-- ============================================================
CREATE TABLE IF NOT EXISTS community_user_follows (
  id TEXT PRIMARY KEY,
  follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followed_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(follower_id, followed_user_id),
  CHECK(follower_id <> followed_user_id)
);

CREATE INDEX IF NOT EXISTS community_user_follows_follower_id_idx ON community_user_follows(follower_id);
CREATE INDEX IF NOT EXISTS community_user_follows_followed_user_id_idx ON community_user_follows(followed_user_id);

-- ============================================================
-- 9. community_prompt_ratings - 1..5 rating per user/post
-- ============================================================
CREATE TABLE IF NOT EXISTS community_prompt_ratings (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(post_id, user_id),
  CHECK(rating BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS community_prompt_ratings_post_id_idx ON community_prompt_ratings(post_id);
CREATE INDEX IF NOT EXISTS community_prompt_ratings_user_id_idx ON community_prompt_ratings(user_id);

-- ============================================================
-- 10. community_user_blocks - personal mute/block list
-- ============================================================
CREATE TABLE IF NOT EXISTS community_user_blocks (
  id TEXT PRIMARY KEY,
  blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(blocker_id, blocked_user_id),
  CHECK(blocker_id <> blocked_user_id),
  CHECK(length(reason) <= 500)
);

CREATE INDEX IF NOT EXISTS community_user_blocks_blocker_id_idx ON community_user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS community_user_blocks_blocked_user_id_idx ON community_user_blocks(blocked_user_id);

-- ============================================================
-- 11. community_reports - abuse and safety reports
-- ============================================================
CREATE TABLE IF NOT EXISTS community_reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT 'other',
  details TEXT NOT NULL DEFAULT '',
  post_id TEXT REFERENCES community_posts(id) ON DELETE SET NULL,
  comment_id TEXT REFERENCES community_comments(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK(target_type IN ('post', 'comment')),
  CHECK(length(reason) >= 1 AND length(reason) <= 80),
  CHECK(length(details) <= 2000)
);

CREATE INDEX IF NOT EXISTS community_reports_reporter_id_idx ON community_reports(reporter_id);
CREATE INDEX IF NOT EXISTS community_reports_post_id_idx ON community_reports(post_id);
CREATE INDEX IF NOT EXISTS community_reports_comment_id_idx ON community_reports(comment_id);

-- ============================================================
-- 12. notifications - activity feed for prompt interactions
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  post_id TEXT REFERENCES community_posts(id) ON DELETE SET NULL,
  comment_id TEXT REFERENCES community_comments(id) ON DELETE SET NULL,
  read_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK(type IN ('upvote', 'verified', 'comment', 'remix'))
);

CREATE INDEX IF NOT EXISTS notifications_user_created_at_idx ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_read_at_idx ON notifications(user_id, read_at);

-- ============================================================
-- 13. contact_messages - website support/contact form inbox
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone_country TEXT NOT NULL DEFAULT 'US',
  phone_number TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  requester_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  privacy_consent INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK(length(first_name) >= 1 AND length(first_name) <= 80),
  CHECK(length(last_name) >= 1 AND length(last_name) <= 80),
  CHECK(length(email) >= 3 AND length(email) <= 320),
  CHECK(length(phone_country) >= 1 AND length(phone_country) <= 8),
  CHECK(length(phone_number) <= 50),
  CHECK(length(message) >= 1 AND length(message) <= 5000),
  CHECK(status IN ('new', 'reviewing', 'resolved'))
);

CREATE INDEX IF NOT EXISTS contact_messages_created_at_idx ON contact_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS contact_messages_status_idx ON contact_messages(status, created_at DESC);

-- ============================================================
-- 14. support_reviewers - accounts allowed into the support inbox
-- ============================================================
CREATE TABLE IF NOT EXISTS support_reviewers (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ============================================================
-- 15. prompt_versions - saved prompt snapshots
-- ============================================================
CREATE TABLE IF NOT EXISTS prompt_versions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS prompt_versions_user_id_idx ON prompt_versions(user_id);
CREATE INDEX IF NOT EXISTS prompt_versions_created_at_idx ON prompt_versions(created_at DESC);

-- ============================================================
-- 16. oauth_accounts - OAuth provider linkage
-- ============================================================
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  expires_at INTEGER,
  UNIQUE(provider, provider_account_id)
);

CREATE INDEX IF NOT EXISTS oauth_accounts_user_id_idx ON oauth_accounts(user_id);
CREATE INDEX IF NOT EXISTS oauth_accounts_provider_idx ON oauth_accounts(provider, provider_account_id);

-- ============================================================
-- 17. sessions - refresh token storage
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  revoked INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_refresh_token_idx ON sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

-- ============================================================
-- Triggers for updated_at
-- ============================================================
CREATE TRIGGER IF NOT EXISTS profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW BEGIN
    UPDATE profiles SET updated_at = unixepoch() WHERE id = OLD.id;
  END;

CREATE TRIGGER IF NOT EXISTS users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW BEGIN
    UPDATE users SET updated_at = unixepoch() WHERE id = OLD.id;
  END;

CREATE TRIGGER IF NOT EXISTS drafts_updated_at
  BEFORE UPDATE ON drafts
  FOR EACH ROW BEGIN
    UPDATE drafts SET updated_at = unixepoch() WHERE id = OLD.id;
  END;

CREATE TRIGGER IF NOT EXISTS saved_prompts_updated_at
  BEFORE UPDATE ON saved_prompts
  FOR EACH ROW BEGIN
    UPDATE saved_prompts SET updated_at = unixepoch() WHERE id = OLD.id;
  END;

CREATE TRIGGER IF NOT EXISTS community_posts_updated_at
  BEFORE UPDATE ON community_posts
  FOR EACH ROW BEGIN
    UPDATE community_posts SET updated_at = unixepoch() WHERE id = OLD.id;
  END;

CREATE TRIGGER IF NOT EXISTS community_comments_updated_at
  BEFORE UPDATE ON community_comments
  FOR EACH ROW BEGIN
    UPDATE community_comments SET updated_at = unixepoch() WHERE id = OLD.id;
  END;

CREATE TRIGGER IF NOT EXISTS community_prompt_ratings_updated_at
  BEFORE UPDATE ON community_prompt_ratings
  FOR EACH ROW BEGIN
    UPDATE community_prompt_ratings SET updated_at = unixepoch() WHERE id = OLD.id;
  END;

CREATE TRIGGER IF NOT EXISTS contact_messages_updated_at
  BEFORE UPDATE ON contact_messages
  FOR EACH ROW BEGIN
    UPDATE contact_messages SET updated_at = unixepoch() WHERE id = OLD.id;
  END;
