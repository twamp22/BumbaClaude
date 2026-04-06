// Shared TypeScript types for BumbaClaude

export type TeamStatus = "running" | "paused" | "completed" | "errored";
export type ExecutionMode = "tmux";
export type AgentStatus = "initializing" | "idle" | "working" | "waiting" | "completed" | "errored";
export type ModelTier = "haiku" | "sonnet" | "opus";
export type TaskStatus = "pending" | "claimed" | "in_progress" | "review" | "completed" | "blocked";

export interface Team {
  id: string;
  name: string;
  project_dir: string;
  status: TeamStatus;
  execution_mode: ExecutionMode;
  created_at: string;
  ended_at: string | null;
}

export interface Agent {
  id: string;
  team_id: string;
  name: string;
  role: string;
  model_tier: ModelTier;
  system_prompt: string | null;
  status: AgentStatus;
  tmux_session: string | null;
  spawned_at: string;
  ended_at: string | null;
}

export interface Task {
  id: string;
  team_id: string;
  title: string;
  description: string | null;
  assigned_agent_id: string | null;
  created_by_agent_id: string | null;
  parent_task_id: string | null;
  status: TaskStatus;
  created_at: string;
  completed_at: string | null;
}

export interface GovernanceRule {
  id: string;
  team_id: string;
  rule_type: string;
  rule_value: string;
  created_at: string;
}

export interface AuditEvent {
  id: number;
  team_id: string;
  agent_id: string | null;
  event_type: string;
  event_data: string | null;
  created_at: string;
}

export interface Template {
  id: string;
  name: string;
  description: string | null;
  config: string;
  created_at: string;
  updated_at: string;
}

export interface TemplateConfig {
  agents: TemplateAgent[];
  governance: {
    max_turns?: number;
  };
}

export interface TemplateAgent {
  name: string;
  role: string;
  model_tier: ModelTier;
  tool_permissions: {
    can_create_files: boolean;
    can_run_commands: boolean;
    can_push_git: boolean;
  };
}

export interface TmuxSession {
  sessionName: string;
  paneIndex: string;
  currentCommand: string;
  pid: string;
}
