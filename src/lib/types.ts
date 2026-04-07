// Shared TypeScript types for BumbaClaude

export type TeamStatus = "running" | "paused" | "completed" | "errored";
export type ExecutionMode = "tmux";
export type AgentStatus = "initializing" | "idle" | "working" | "waiting" | "completed" | "errored";
export type ModelTier = "haiku" | "sonnet" | "opus";
export type TaskStatus = "pending" | "claimed" | "in_progress" | "review" | "completed" | "blocked" | "cancelled" | "errored";

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

export type ScheduleType = "interval" | "cron";

export interface TokenUsage {
  id: number;
  team_id: string;
  agent_id: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  cost_usd: number;
  model: string | null;
  duration_ms: number | null;
  session_id: string | null;
  recorded_at: string;
}

export interface ToolUsage {
  id: number;
  team_id: string;
  agent_id: string;
  tool_name: string;
  tool_input_summary: string | null;
  is_mcp_tool: number;
  mcp_server_name: string | null;
  recorded_at: string;
}

export interface Schedule {
  id: string;
  team_id: string;
  agent_id: string;
  name: string;
  schedule_type: ScheduleType;
  schedule_value: string;
  message: string;
  enabled: number;
  last_run_at: string | null;
  run_count: number;
  created_at: string;
}

export interface McpServer {
  id: number;
  team_id: string | null;
  agent_id: string | null;
  server_name: string;
  status: string | null;
  source: string;
  discovered_at: string;
}

export interface RateLimitEvent {
  status: string;
  resetsAt: number;
  rateLimitType: string;
  overageStatus: string;
  overageResetsAt: number;
  isUsingOverage: boolean;
  teamId?: string;
  agentId?: string;
  timestamp: string;
}

export interface LimitInfo {
  subscriptionType: string | null;
  rateLimitTier: string | null;
  latestRateLimitEvent: RateLimitEvent | null;
  rateLimitHits: number;
}

export interface TmuxSession {
  sessionName: string;
  paneIndex: string;
  currentCommand: string;
  pid: string;
}
