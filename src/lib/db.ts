import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type {
  Team,
  Agent,
  Task,
  GovernanceRule,
  AuditEvent,
  Template,
  TeamStatus,
  AgentStatus,
  TaskStatus,
  TokenUsage,
  ToolUsage,
  Schedule,
  McpServer,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "dashboard.db");
const SCHEMA_PATH = path.join(process.cwd(), "db", "schema.sql");
const SEED_PATH = path.join(process.cwd(), "db", "seed.sql");

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  dbInstance = new Database(DB_PATH);
  dbInstance.pragma("journal_mode = WAL");
  dbInstance.pragma("foreign_keys = ON");

  // Run schema
  const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
  dbInstance.exec(schema);

  // Seed default templates
  if (fs.existsSync(SEED_PATH)) {
    const seed = fs.readFileSync(SEED_PATH, "utf-8");
    dbInstance.exec(seed);
  }

  // Migrations
  try {
    dbInstance.exec("ALTER TABLE tasks ADD COLUMN created_by_agent_id TEXT REFERENCES agents(id)");
  } catch { /* exists */ }
  try {
    dbInstance.exec("ALTER TABLE tasks ADD COLUMN parent_task_id TEXT REFERENCES tasks(id)");
  } catch { /* exists */ }

  return dbInstance;
}

// --- Teams ---

export function getAllTeams(): Team[] {
  return getDb().prepare("SELECT * FROM teams ORDER BY created_at DESC").all() as Team[];
}

export function getTeam(id: string): Team | undefined {
  return getDb().prepare("SELECT * FROM teams WHERE id = ?").get(id) as Team | undefined;
}

export function createTeam(team: Omit<Team, "created_at" | "ended_at">): Team {
  const db = getDb();
  db.prepare(
    "INSERT INTO teams (id, name, project_dir, status, execution_mode) VALUES (?, ?, ?, ?, ?)"
  ).run(team.id, team.name, team.project_dir, team.status, team.execution_mode);
  return getTeam(team.id)!;
}

export function updateTeamStatus(id: string, status: TeamStatus): void {
  const db = getDb();
  if (status === "completed" || status === "errored") {
    db.prepare("UPDATE teams SET status = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?").run(
      status,
      id
    );
  } else {
    db.prepare("UPDATE teams SET status = ? WHERE id = ?").run(status, id);
  }
}

export function deleteTeam(id: string): void {
  const db = getDb();
  db.prepare("DELETE FROM token_usage WHERE team_id = ?").run(id);
  db.prepare("DELETE FROM tool_usage WHERE team_id = ?").run(id);
  db.prepare("DELETE FROM schedules WHERE team_id = ?").run(id);
  db.prepare("DELETE FROM mcp_servers WHERE team_id = ?").run(id);
  db.prepare("DELETE FROM audit_events WHERE team_id = ?").run(id);
  db.prepare("DELETE FROM governance_rules WHERE team_id = ?").run(id);
  db.prepare("DELETE FROM tasks WHERE team_id = ?").run(id);
  db.prepare("DELETE FROM agents WHERE team_id = ?").run(id);
  db.prepare("DELETE FROM teams WHERE id = ?").run(id);
}

// --- Agents ---

export function getAgentsByTeam(teamId: string): Agent[] {
  return getDb()
    .prepare("SELECT * FROM agents WHERE team_id = ? ORDER BY spawned_at ASC")
    .all(teamId) as Agent[];
}

export function getAgent(id: string): Agent | undefined {
  return getDb().prepare("SELECT * FROM agents WHERE id = ?").get(id) as Agent | undefined;
}

export function createAgent(
  agent: Omit<Agent, "spawned_at" | "ended_at">
): Agent {
  const db = getDb();
  db.prepare(
    `INSERT INTO agents (id, team_id, name, role, model_tier, system_prompt, status, tmux_session)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    agent.id,
    agent.team_id,
    agent.name,
    agent.role,
    agent.model_tier,
    agent.system_prompt,
    agent.status,
    agent.tmux_session
  );
  return getAgent(agent.id)!;
}

export function updateAgentStatus(id: string, status: AgentStatus): void {
  const db = getDb();
  if (status === "completed" || status === "errored") {
    db.prepare("UPDATE agents SET status = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?").run(
      status,
      id
    );
  } else {
    db.prepare("UPDATE agents SET status = ? WHERE id = ?").run(status, id);
  }
}

export function getAgentBySession(tmuxSession: string): Agent | undefined {
  return getDb()
    .prepare("SELECT * FROM agents WHERE tmux_session = ?")
    .get(tmuxSession) as Agent | undefined;
}

export function updateAgentTmuxSession(id: string, tmuxSession: string): void {
  getDb()
    .prepare("UPDATE agents SET tmux_session = ? WHERE id = ?")
    .run(tmuxSession, id);
}

// --- Tasks ---

export function getTasksByTeam(teamId: string): Task[] {
  return getDb()
    .prepare("SELECT * FROM tasks WHERE team_id = ? ORDER BY created_at ASC")
    .all(teamId) as Task[];
}

export function createTask(task: Omit<Task, "created_at" | "completed_at">): Task {
  const db = getDb();
  db.prepare(
    `INSERT INTO tasks (id, team_id, title, description, assigned_agent_id, created_by_agent_id, parent_task_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(task.id, task.team_id, task.title, task.description, task.assigned_agent_id, task.created_by_agent_id, task.parent_task_id, task.status);
  return db.prepare("SELECT * FROM tasks WHERE id = ?").get(task.id) as Task;
}

export function getTasksByParent(parentTaskId: string): Task[] {
  return getDb()
    .prepare("SELECT * FROM tasks WHERE parent_task_id = ? ORDER BY created_at ASC")
    .all(parentTaskId) as Task[];
}

export function updateTaskStatus(id: string, status: TaskStatus): void {
  const db = getDb();
  if (status === "completed") {
    db.prepare("UPDATE tasks SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?").run(
      status,
      id
    );
  } else {
    db.prepare("UPDATE tasks SET status = ? WHERE id = ?").run(status, id);
  }
}

// --- Governance Rules ---

export function getGovernanceRules(teamId: string): GovernanceRule[] {
  return getDb()
    .prepare("SELECT * FROM governance_rules WHERE team_id = ?")
    .all(teamId) as GovernanceRule[];
}

export function createGovernanceRule(
  rule: Omit<GovernanceRule, "created_at">
): void {
  getDb()
    .prepare(
      "INSERT INTO governance_rules (id, team_id, rule_type, rule_value) VALUES (?, ?, ?, ?)"
    )
    .run(rule.id, rule.team_id, rule.rule_type, rule.rule_value);
}

// --- Audit Events ---

export function getAuditEvents(
  teamId: string,
  filters?: { agentId?: string; eventType?: string; limit?: number }
): AuditEvent[] {
  let query = "SELECT * FROM audit_events WHERE team_id = ?";
  const params: (string | number)[] = [teamId];

  if (filters?.agentId) {
    query += " AND agent_id = ?";
    params.push(filters.agentId);
  }
  if (filters?.eventType) {
    query += " AND event_type = ?";
    params.push(filters.eventType);
  }

  query += " ORDER BY created_at DESC";

  if (filters?.limit) {
    query += " LIMIT ?";
    params.push(filters.limit);
  }

  return getDb().prepare(query).all(...params) as AuditEvent[];
}

export function createAuditEvent(event: {
  team_id: string;
  agent_id?: string | null;
  event_type: string;
  event_data?: string | null;
}): void {
  getDb()
    .prepare(
      "INSERT INTO audit_events (team_id, agent_id, event_type, event_data) VALUES (?, ?, ?, ?)"
    )
    .run(event.team_id, event.agent_id ?? null, event.event_type, event.event_data ?? null);
}

export function getRecentAuditEvents(limit: number = 20): AuditEvent[] {
  return getDb()
    .prepare("SELECT * FROM audit_events ORDER BY created_at DESC LIMIT ?")
    .all(limit) as AuditEvent[];
}

// --- Templates ---

export function getAllTemplates(): Template[] {
  return getDb()
    .prepare("SELECT * FROM templates ORDER BY created_at ASC")
    .all() as Template[];
}

export function getTemplate(id: string): Template | undefined {
  return getDb().prepare("SELECT * FROM templates WHERE id = ?").get(id) as Template | undefined;
}

export function createTemplate(
  template: Omit<Template, "created_at" | "updated_at">
): Template {
  const db = getDb();
  db.prepare(
    "INSERT INTO templates (id, name, description, config) VALUES (?, ?, ?, ?)"
  ).run(template.id, template.name, template.description, template.config);
  return getTemplate(template.id)!;
}

export function deleteTemplate(id: string): void {
  getDb().prepare("DELETE FROM templates WHERE id = ?").run(id);
}

// --- Token Usage ---

export function recordTokenUsage(usage: {
  team_id: string;
  agent_id: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  cost_usd: number;
  model?: string | null;
  duration_ms?: number | null;
  session_id?: string | null;
}): void {
  getDb().prepare(
    `INSERT INTO token_usage (team_id, agent_id, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, cost_usd, model, duration_ms, session_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    usage.team_id, usage.agent_id, usage.input_tokens, usage.output_tokens,
    usage.cache_read_tokens, usage.cache_creation_tokens, usage.cost_usd,
    usage.model ?? null, usage.duration_ms ?? null, usage.session_id ?? null
  );
}

export function getTokenUsageByTeam(teamId: string): TokenUsage[] {
  return getDb()
    .prepare("SELECT * FROM token_usage WHERE team_id = ? ORDER BY recorded_at DESC")
    .all(teamId) as TokenUsage[];
}

export function getTokenUsageByAgent(agentId: string): TokenUsage[] {
  return getDb()
    .prepare("SELECT * FROM token_usage WHERE agent_id = ? ORDER BY recorded_at DESC")
    .all(agentId) as TokenUsage[];
}

export function getTokenUsageSummaryByTeam(teamId: string): {
  total_input: number; total_output: number; total_cache_read: number;
  total_cache_creation: number; total_cost: number; count: number;
} {
  return getDb().prepare(
    `SELECT COALESCE(SUM(input_tokens),0) as total_input, COALESCE(SUM(output_tokens),0) as total_output,
     COALESCE(SUM(cache_read_tokens),0) as total_cache_read, COALESCE(SUM(cache_creation_tokens),0) as total_cache_creation,
     COALESCE(SUM(cost_usd),0) as total_cost, COUNT(*) as count
     FROM token_usage WHERE team_id = ?`
  ).get(teamId) as { total_input: number; total_output: number; total_cache_read: number; total_cache_creation: number; total_cost: number; count: number };
}

// --- Tool Usage ---

export function recordToolUsage(usage: {
  team_id: string;
  agent_id: string;
  tool_name: string;
  tool_input_summary?: string | null;
  is_mcp_tool?: boolean;
  mcp_server_name?: string | null;
}): void {
  getDb().prepare(
    `INSERT INTO tool_usage (team_id, agent_id, tool_name, tool_input_summary, is_mcp_tool, mcp_server_name)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    usage.team_id, usage.agent_id, usage.tool_name,
    usage.tool_input_summary ?? null, usage.is_mcp_tool ? 1 : 0,
    usage.mcp_server_name ?? null
  );
}

export function getToolUsageByTeam(teamId: string): { tool_name: string; call_count: number; is_mcp_tool: number; mcp_server_name: string | null; last_used: string }[] {
  return getDb().prepare(
    `SELECT tool_name, COUNT(*) as call_count, is_mcp_tool, mcp_server_name, MAX(recorded_at) as last_used
     FROM tool_usage WHERE team_id = ? GROUP BY tool_name ORDER BY call_count DESC`
  ).all(teamId) as { tool_name: string; call_count: number; is_mcp_tool: number; mcp_server_name: string | null; last_used: string }[];
}

export function getToolUsageByAgent(agentId: string): { tool_name: string; call_count: number; is_mcp_tool: number; mcp_server_name: string | null }[] {
  return getDb().prepare(
    `SELECT tool_name, COUNT(*) as call_count, is_mcp_tool, mcp_server_name
     FROM tool_usage WHERE agent_id = ? GROUP BY tool_name ORDER BY call_count DESC`
  ).all(agentId) as { tool_name: string; call_count: number; is_mcp_tool: number; mcp_server_name: string | null }[];
}

// --- Schedules ---

export function getSchedulesByTeam(teamId: string): Schedule[] {
  return getDb()
    .prepare("SELECT * FROM schedules WHERE team_id = ? ORDER BY created_at ASC")
    .all(teamId) as Schedule[];
}

export function getSchedule(id: string): Schedule | undefined {
  return getDb().prepare("SELECT * FROM schedules WHERE id = ?").get(id) as Schedule | undefined;
}

export function createSchedule(schedule: Omit<Schedule, "last_run_at" | "run_count" | "created_at">): Schedule {
  getDb().prepare(
    `INSERT INTO schedules (id, team_id, agent_id, name, schedule_type, schedule_value, message, enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(schedule.id, schedule.team_id, schedule.agent_id, schedule.name,
    schedule.schedule_type, schedule.schedule_value, schedule.message, schedule.enabled);
  return getSchedule(schedule.id)!;
}

export function updateSchedule(id: string, updates: { enabled?: number; last_run_at?: string; run_count?: number }): void {
  const fields: string[] = [];
  const values: (string | number)[] = [];
  if (updates.enabled !== undefined) { fields.push("enabled = ?"); values.push(updates.enabled); }
  if (updates.last_run_at !== undefined) { fields.push("last_run_at = ?"); values.push(updates.last_run_at); }
  if (updates.run_count !== undefined) { fields.push("run_count = ?"); values.push(updates.run_count); }
  if (fields.length === 0) return;
  values.push(id);
  getDb().prepare(`UPDATE schedules SET ${fields.join(", ")} WHERE id = ?`).run(...values);
}

export function deleteSchedule(id: string): void {
  getDb().prepare("DELETE FROM schedules WHERE id = ?").run(id);
}

export function getDueSchedules(): Schedule[] {
  return getDb().prepare(
    `SELECT * FROM schedules WHERE enabled = 1
     AND (last_run_at IS NULL OR
       (schedule_type = 'interval' AND
        CAST((julianday('now') - julianday(last_run_at)) * 86400000 AS INTEGER) >= CAST(schedule_value AS INTEGER))
     )`
  ).all() as Schedule[];
}

// --- MCP Servers ---

export function recordMcpServer(server: {
  team_id?: string | null;
  agent_id?: string | null;
  server_name: string;
  status?: string | null;
  source: string;
}): void {
  const db = getDb();
  const existing = db.prepare(
    "SELECT id FROM mcp_servers WHERE server_name = ? AND COALESCE(team_id,'') = COALESCE(?,'') AND source = ?"
  ).get(server.server_name, server.team_id ?? null, server.source);
  if (existing) {
    db.prepare("UPDATE mcp_servers SET status = ?, discovered_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(server.status ?? null, (existing as { id: number }).id);
  } else {
    db.prepare(
      "INSERT INTO mcp_servers (team_id, agent_id, server_name, status, source) VALUES (?, ?, ?, ?, ?)"
    ).run(server.team_id ?? null, server.agent_id ?? null, server.server_name, server.status ?? null, server.source);
  }
}

export function getMcpServersByTeam(teamId: string): McpServer[] {
  return getDb()
    .prepare("SELECT * FROM mcp_servers WHERE team_id = ? OR team_id IS NULL ORDER BY server_name ASC")
    .all(teamId) as McpServer[];
}

export function getAllMcpServers(): McpServer[] {
  return getDb()
    .prepare("SELECT * FROM mcp_servers ORDER BY server_name ASC")
    .all() as McpServer[];
}
