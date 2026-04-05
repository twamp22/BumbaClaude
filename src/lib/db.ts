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
