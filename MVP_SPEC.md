# BumbaClaude -- MVP Specification

## Project overview

A standalone web dashboard that manages multi-agent Claude Code workflows without modifying Claude Code itself. It communicates through three public interfaces: tmux session management, filesystem state (mailbox/task JSON files at ~/.claude/), and optionally the Claude Agent SDK.

**Target users:** Solo developers and small teams using Claude Code with Max subscriptions or API keys.

**Core philosophy:** Claude Code already has the agent runtime. This project adds the control plane -- a visual interface for defining, launching, monitoring, and governing multi-agent workflows.

---

## Tech stack

- **Framework:** Next.js 16+ (App Router, TypeScript)
- **Styling:** Tailwind CSS
- **Database:** SQLite via better-sqlite3 (local, zero-config)
- **Real-time:** WebSocket (ws library) for live agent status
- **Process management:** child_process for tmux interaction
- **File watching:** chokidar for ~/.claude/ directory monitoring
- **Package manager:** pnpm

---

## MVP scope (v0.1) -- "Mission Control"

The MVP delivers the core loop: define a team, spawn agents, watch them work, intervene when needed.

### Feature 1: Dashboard home

A single-page overview showing:
- All active agent teams with status indicators (running, idle, completed, errored)
- Quick stats: total agents running, tasks completed, tasks pending
- Recent activity feed (last 20 events across all teams)
- "New team" button

### Feature 2: Team creation wizard

A step-by-step form to launch a new agent team:

**Step 1 -- Project setup:**
- Select working directory (file picker or manual path input)
- Team name (auto-generated from directory name, editable)
- Execution mode: tmux (Agent SDK mode planned for v0.2)

**Step 2 -- Agent roles:**
- Add 1-6 agent roles with: name, description, model tier (haiku/sonnet/opus), tool permissions
- Preset templates available: "Code review (3 agents)", "Full-stack feature (4 agents)", "Research sprint (2 agents)"
- Custom role definition with free-text system prompt

**Step 3 -- Governance rules (simplified for MVP):**
- Toggle: agents can create new files (yes/no)
- Toggle: agents can run shell commands (yes/no)
- Toggle: agents can push to git (yes/no)
- Max turns per agent before requiring human check-in (slider: 5-50)

**Step 4 -- Launch:**
- Review summary of team configuration
- "Launch team" button
- Dashboard navigates to the live monitor for this team

### Feature 3: Live monitor

The primary workspace view when a team is running:

**Left panel (60% width) -- Agent activity:**
- Vertical stack of agent cards, one per team member
- Each card shows: agent name, role, model tier, current status (working/idle/waiting for input/completed)
- Expandable: click to see last 50 lines of terminal output (captured from tmux)
- "Send message" input field per agent -- sends text to that agent's tmux pane
- Color-coded status: green=working, amber=idle, red=errored, gray=completed

**Right panel (40% width) -- Task board:**
- Simple list view (not full kanban for MVP) of all tasks
- Each task shows: title, assigned agent, status (pending/claimed/in-progress/completed/blocked)
- Tasks are read from ~/.claude/tasks/{team-name}/
- Manual task status override (click to mark complete if agent forgot)

**Bottom bar -- Team controls:**
- "Pause all" -- sends interrupt signal to all agent tmux panes
- "Resume" -- sends resume to paused agents
- "Add agent" -- spawn an additional teammate mid-run
- "End team" -- graceful shutdown (let agents finish current task, then terminate)
- "Kill team" -- immediate termination of all tmux sessions

### Feature 4: Audit log

A chronological event log for each team run:
- Agent spawned (timestamp, name, model, role)
- Task created / claimed / completed
- Message sent (from dashboard to agent, or agent-to-agent via mailbox)
- File modified (path, agent responsible)
- Command executed (command string, agent responsible)
- Team ended (reason: manual, completed, error)

Stored in SQLite. Filterable by agent, event type, and time range.

### Feature 5: Workflow templates

Save and reuse team configurations:
- "Save as template" button on the team creation wizard
- Template library page listing all saved templates
- Each template stores: agent roles, governance rules, default prompts
- "Launch from template" -- pre-fills the creation wizard
- Import/export templates as JSON files (for sharing with others)

---

## Data models (SQLite)

```sql
CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  project_dir TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running', -- running, paused, completed, errored
  execution_mode TEXT NOT NULL DEFAULT 'tmux',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME
);

CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  model_tier TEXT NOT NULL DEFAULT 'sonnet', -- haiku, sonnet, opus
  system_prompt TEXT,
  status TEXT NOT NULL DEFAULT 'idle', -- idle, working, waiting, completed, errored
  tmux_session TEXT, -- tmux session:pane identifier
  spawned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id),
  title TEXT NOT NULL,
  description TEXT,
  assigned_agent_id TEXT REFERENCES agents(id),
  status TEXT NOT NULL DEFAULT 'pending', -- pending, claimed, in_progress, completed, blocked
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

CREATE TABLE governance_rules (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id),
  rule_type TEXT NOT NULL, -- can_create_files, can_run_commands, can_push_git, max_turns
  rule_value TEXT NOT NULL, -- 'true'/'false' or numeric string
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id TEXT NOT NULL REFERENCES teams(id),
  agent_id TEXT REFERENCES agents(id),
  event_type TEXT NOT NULL,
  event_data TEXT, -- JSON blob with event-specific details
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  config TEXT NOT NULL, -- JSON blob: { agents: [...], governance: {...}, prompts: {...} }
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Integration layer details

### tmux manager (lib/tmux.ts)

Core functions the backend needs:

```typescript
// Spawn a new Claude Code session in a tmux pane
async function spawnAgent(config: {
  sessionName: string;
  workingDir: string;
  agentArgs: string; // claude code CLI args including --agent flag if using custom agent
  model?: string;
}): Promise<{ sessionId: string; paneId: string }>;

// Capture last N lines of output from an agent's pane
async function captureOutput(paneId: string, lines?: number): Promise<string>;

// Send text input to an agent's pane (like typing into the terminal)
async function sendInput(paneId: string, text: string): Promise<void>;

// Send interrupt (Ctrl+C) to an agent's pane
async function interrupt(paneId: string): Promise<void>;

// Kill an agent's tmux pane
async function killPane(paneId: string): Promise<void>;

// List all tmux sessions/panes with their status
async function listSessions(): Promise<TmuxSession[]>;
```

All of these are thin wrappers around `child_process.execSync` / `child_process.exec` calling tmux commands:
- `tmux new-session -d -s {name} -c {workingDir}`
- `tmux send-keys -t {pane} '{command}' Enter`
- `tmux capture-pane -t {pane} -p -S -{lines}`
- `tmux kill-pane -t {pane}`
- `tmux list-panes -a -F '#{session_name}:#{pane_index} #{pane_current_command} #{pane_pid}'`

### Filesystem watcher (lib/watcher.ts)

Watches three directory trees under ~/.claude/:

```typescript
// Watch for changes and emit events via WebSocket
function watchClaudeState(teamName: string): EventEmitter {
  // Watch: ~/.claude/teams/{teamName}/config.json -- team membership changes
  // Watch: ~/.claude/teams/{teamName}/mailbox/*.json -- agent messages
  // Watch: ~/.claude/tasks/{teamName}/*.lock -- task claim/completion
  // Watch: ~/.claude/tasks/{teamName}/*.pending -- new tasks

  // On change, parse the JSON file and emit structured events
  // These events feed the live monitor and audit log
}
```

Uses chokidar with `{ persistent: true, ignoreInitial: false }` to catch existing state on startup.

### Agent SDK integration (lib/sdk.ts) -- OPTIONAL for MVP

If the user provides an API key, the dashboard can use the Claude Agent SDK for more programmatic control:

```typescript
// Programmatically define and spawn agents with the SDK
// This gives cleaner control over tool permissions and model selection
// But requires API billing rather than subscription usage
```

This is a v0.2 feature. MVP should work entirely with tmux + filesystem.

---

## File structure

```
/
  package.json
  next.config.ts
  postcss.config.mjs
  tsconfig.json
  CLAUDE.md                    -- Instructions for Claude Code to work on this project
  /src
    /app
      layout.tsx               -- Root layout with sidebar nav
      page.tsx                 -- Dashboard home
      /teams
        /new
          page.tsx             -- Team creation wizard
        /[teamId]
          page.tsx             -- Live monitor for a specific team
          /audit
            page.tsx           -- Audit log for a specific team
      /templates
        page.tsx               -- Template library
    /components
      /dashboard
        TeamCard.tsx           -- Team summary card for home page
        ActivityFeed.tsx       -- Recent events feed
        QuickStats.tsx         -- Stat counters
      /monitor
        AgentCard.tsx          -- Individual agent status + output
        TaskList.tsx           -- Task list panel
        TeamControls.tsx       -- Bottom control bar
        MessageInput.tsx       -- Send message to agent
      /wizard
        ProjectStep.tsx        -- Step 1: project setup
        RolesStep.tsx          -- Step 2: agent roles
        GovernanceStep.tsx     -- Step 3: governance rules
        ReviewStep.tsx         -- Step 4: review + launch
      /shared
        StatusBadge.tsx        -- Color-coded status indicator
        AuditTable.tsx         -- Filterable event log table
    /lib
      db.ts                    -- SQLite connection + query helpers
      tmux.ts                  -- tmux session management
      watcher.ts               -- ~/.claude/ filesystem watcher
      websocket.ts             -- WebSocket server for live updates
      types.ts                 -- Shared TypeScript types
    /hooks
      useTeamStatus.ts         -- WebSocket hook for live agent status
      useAuditLog.ts           -- Hook for streaming audit events
  /db
    schema.sql                 -- SQLite schema (from above)
    seed.sql                   -- Default templates
```

---

## UI design direction

**Aesthetic:** Industrial/utilitarian control room. Think mission control, not SaaS dashboard. Dark mode primary. Monospace fonts for agent output. Status colors that feel operational (not decorative). Dense information display -- this is a power tool, not a marketing page.

**Key UI patterns:**
- Sidebar navigation: Teams, Templates, Settings
- Agent output windows styled like terminal emulators (dark bg, monospace, scrollable)
- Status indicators use the traffic light pattern: green dot = active, amber = idle/waiting, red = error
- Task list uses simple rows with status chips, not elaborate kanban columns (v0.1)
- Governance toggles use switch components with clear on/off states
- Audit log is a dense table with monospace timestamps and filterable columns

---

## Phased roadmap

### v0.1 -- MVP (this spec)
- Dashboard home with team overview
- Team creation wizard with presets
- Live monitor with agent output capture
- Basic task list (read from filesystem)
- Simple governance toggles
- Audit log
- Workflow templates (save/load)

### v0.2 -- Governance + SDK
- Agent SDK integration for programmatic control
- Granular permission rules (per-agent file path restrictions, command allowlists)
- Token usage tracking and cost estimation
- Template marketplace (import from URL / share via gist)

### v0.3 -- Intelligence
- Kanban board with drag-and-drop task management
- Agent memory/context window visualization
- Workflow replay (re-run a template with same inputs)
- Webhook integrations (notify Slack/Discord/Telegram on events)
- Multi-project support (manage several repos from one dashboard)

### v0.4 -- Community
- Plugin system for custom integrations
- Public template registry
- GitHub Action for CI-triggered agent teams
- Team analytics and performance metrics

---

## CLAUDE.md for this project

See CLAUDE.md in the project root. It contains all instructions for Claude Code to work on BumbaClaude.

---

## Getting started

```bash
git clone https://github.com/twamp22/BumbaClaude.git
cd BumbaClaude
pnpm install
pnpm dev
```

Then hand this spec to Claude Code:
```
Read MVP_SPEC.md and scaffold the project structure. Start with the database schema, lib/tmux.ts, and lib/db.ts, then build the dashboard home page.
```
