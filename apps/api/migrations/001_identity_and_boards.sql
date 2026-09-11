BEGIN;

CREATE TABLE IF NOT EXISTS huddlecanvas_users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  external_subject text UNIQUE,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS huddlecanvas_workspaces (
  id text PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL,
  created_by text NOT NULL REFERENCES huddlecanvas_users(id),
  personal_owner_id text UNIQUE REFERENCES huddlecanvas_users(id)
);

CREATE TABLE IF NOT EXISTS huddlecanvas_memberships (
  workspace_id text NOT NULL REFERENCES huddlecanvas_workspaces(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES huddlecanvas_users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'editor', 'commenter', 'viewer', 'guest-session')),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS huddlecanvas_boards (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES huddlecanvas_workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  document jsonb NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  created_at timestamptz NOT NULL,
  created_by text NOT NULL REFERENCES huddlecanvas_users(id),
  updated_at timestamptz NOT NULL,
  updated_by text NOT NULL REFERENCES huddlecanvas_users(id)
);

CREATE INDEX IF NOT EXISTS huddlecanvas_boards_workspace_updated
  ON huddlecanvas_boards (workspace_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS huddlecanvas_board_versions (
  id text PRIMARY KEY,
  board_id text NOT NULL REFERENCES huddlecanvas_boards(id) ON DELETE CASCADE,
  revision integer NOT NULL CHECK (revision > 0),
  document jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  created_by text NOT NULL REFERENCES huddlecanvas_users(id),
  reason text NOT NULL,
  UNIQUE (board_id, revision)
);

CREATE INDEX IF NOT EXISTS huddlecanvas_versions_board_revision
  ON huddlecanvas_board_versions (board_id, revision DESC);

COMMIT;
