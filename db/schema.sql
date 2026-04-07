-- BumbaClaude database schema
-- SQLite via better-sqlite3

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  project_dir TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',    -- running, paused, completed, errored
  execution_mode TEXT NOT NULL DEFAULT 'tmux',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  model_tier TEXT NOT NULL DEFAULT 'sonnet', -- haiku, sonnet, opus
  system_prompt TEXT,
  status TEXT NOT NULL DEFAULT 'idle',       -- idle, working, waiting, completed, errored
  tmux_session TEXT,                         -- tmux session:pane identifier
  spawned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id),
  title TEXT NOT NULL,
  description TEXT,
  assigned_agent_id TEXT REFERENCES agents(id),
  created_by_agent_id TEXT REFERENCES agents(id),  -- agent that created this task (NULL = user-created)
  parent_task_id TEXT REFERENCES tasks(id),         -- parent task (NULL = top-level task)
  status TEXT NOT NULL DEFAULT 'pending',    -- pending, claimed, in_progress, review, completed, blocked
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

CREATE TABLE IF NOT EXISTS governance_rules (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id),
  rule_type TEXT NOT NULL,   -- can_create_files, can_run_commands, can_push_git, max_turns
  rule_value TEXT NOT NULL,  -- 'true'/'false' or numeric string
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id TEXT NOT NULL REFERENCES teams(id),
  agent_id TEXT REFERENCES agents(id),
  event_type TEXT NOT NULL,
  event_data TEXT,           -- JSON blob with event-specific details
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  config TEXT NOT NULL,      -- JSON blob: { agents: [...], governance: {...}, prompts: {...} }
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Token usage per agent response
CREATE TABLE IF NOT EXISTS token_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id TEXT NOT NULL REFERENCES teams(id),
  agent_id TEXT NOT NULL REFERENCES agents(id),
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  model TEXT,
  duration_ms INTEGER,
  session_id TEXT,
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tool usage per invocation
CREATE TABLE IF NOT EXISTS tool_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id TEXT NOT NULL REFERENCES teams(id),
  agent_id TEXT NOT NULL REFERENCES agents(id),
  tool_name TEXT NOT NULL,
  tool_input_summary TEXT,
  is_mcp_tool INTEGER NOT NULL DEFAULT 0,
  mcp_server_name TEXT,
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Scheduled recurring tasks
CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id),
  agent_id TEXT NOT NULL REFERENCES agents(id),
  name TEXT NOT NULL,
  schedule_type TEXT NOT NULL,     -- 'interval' or 'cron'
  schedule_value TEXT NOT NULL,    -- ms for interval, cron expr for cron
  message TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run_at DATETIME,
  run_count INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- MCP server registry
CREATE TABLE IF NOT EXISTS mcp_servers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id TEXT REFERENCES teams(id),
  agent_id TEXT REFERENCES agents(id),
  server_name TEXT NOT NULL,
  status TEXT,
  source TEXT NOT NULL,            -- 'agent-stream', 'project-config', 'global-config'
  discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_agents_team_id ON agents(team_id);
CREATE INDEX IF NOT EXISTS idx_tasks_team_id ON tasks(team_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_agent ON tasks(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_governance_team_id ON governance_rules(team_id);
CREATE INDEX IF NOT EXISTS idx_audit_team_id ON audit_events(team_id);
CREATE INDEX IF NOT EXISTS idx_audit_agent_id ON audit_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_token_usage_team ON token_usage(team_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_agent ON token_usage(agent_id);
CREATE INDEX IF NOT EXISTS idx_tool_usage_team ON tool_usage(team_id);
CREATE INDEX IF NOT EXISTS idx_tool_usage_agent ON tool_usage(agent_id);
CREATE INDEX IF NOT EXISTS idx_tool_usage_tool ON tool_usage(tool_name);
CREATE INDEX IF NOT EXISTS idx_schedules_team ON schedules(team_id);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_team ON mcp_servers(team_id);
