<p align="center">
  <img src="public/logo.png" alt="BumbaClaude - Agent Orchestration for Claude Code" width="300" />
</p>

<h1 align="center">BumbaClaude</h1>

<p align="center">
  <strong>The right way to orchestrate Claude Code</strong>
</p>

<p align="center">
  <a href="https://github.com/twamp22/BumbaClaude/releases/latest"><img src="https://img.shields.io/github/v/release/twamp22/BumbaClaude?color=green&label=release" alt="Latest Release" /></a>
  <a href="https://github.com/twamp22/BumbaClaude/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="MIT License" /></a>
  <a href="https://github.com/twamp22/BumbaClaude/pulls"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome" /></a>
  <img src="https://img.shields.io/badge/first--party-compatible-green.svg" alt="First-Party Compatible" />
  <img src="https://img.shields.io/badge/platform-Windows-blue.svg" alt="Platform" />
</p>

<p align="center">
  Define agent teams. Launch them. Watch them work. Intervene when they go sideways.<br/>
  Full audit trail of everything. Zero modifications to Claude Code.
</p>

---

## Download

**[Download BumbaClaude v0.1.1 for Windows](https://github.com/twamp22/BumbaClaude/releases/latest)**

- **BumbaClaude Setup 0.1.1.exe** -- Windows installer (recommended)
- **BumbaClaude-0.1.1-win.zip** -- Portable version (no install needed)

> Requires Node.js v24+ and Claude Code CLI installed on your system.

---

## Quick Start (from source)

```bash
git clone https://github.com/twamp22/BumbaClaude.git
cd BumbaClaude
pnpm install
pnpm electron:dev    # Desktop app with hot reload
# or
pnpm dev             # Browser-only at http://localhost:3000
```

---

## Why BumbaClaude

**The wrapper principle.** BumbaClaude never touches Claude Code internals. It sits entirely outside and communicates through three official interfaces: tmux sessions, filesystem state, and the Agent SDK.

**First-party compatible.** Every interface BumbaClaude uses is one that Claude Code exposes to all users. No special access. No hidden tricks. No loopholes that break when the next update ships.

**Your access, your choice.** BumbaClaude works with subscriptions and API keys alike. Your billing model is your decision.

Read the full philosophy: [PHILOSOPHY.md](./PHILOSOPHY.md)

## What BumbaClaude does NOT do

- Does not spoof client headers or OAuth tokens
- Does not bypass rate limits or usage metering
- Does not modify Claude Code's source, binary, or config
- Does not require special API access or workarounds
- Does not lock you into any specific billing model

---

### Prerequisites

| Requirement | Why |
|---|---|
| Node.js 24+ | Runtime (for standalone app) |
| pnpm | Package manager (for development) |
| tmux | Agent session management |
| Claude Code CLI | The `claude` command |
| Claude Max or API key | LLM access |

---

## Features

### Standalone Desktop App
Native Windows application with system tray, notifications, global shortcuts, and auto-update. Runs as a standalone app -- no browser needed.

### Define Teams
Create reusable agent team configurations with custom roles, model tiers, and governance rules. Set up a frontend team, a backend team, a QA team -- each with their own permissions and boundaries.

### Launch Workflows
Spin up multi-agent Claude Code sessions from the dashboard with one click. Each agent runs in its own tmux session, fully isolated and independently controllable.

### Monitor Live
Watch each agent's terminal output in real time. See task progress across all agents at a glance. Send messages to individual agents when they need course correction.

### Enforce Governance
Set permission boundaries before agents spawn. Control file creation, shell access, git pushes, and turn limits. Agents can't exceed the boundaries you define.

### Audit Everything
Full event log of agent activity with timestamps, filterable by agent and event type. Know exactly what happened, when, and why.

### Save Templates
Package team configurations as reusable workflow templates. Export and share as JSON. Build a library of proven multi-agent patterns.

---

## How It Works

BumbaClaude is a **wrapper**, not a fork. It sits completely outside Claude Code and talks to it through three public interfaces:

```
+------------------+       tmux        +------------------+
|                  | ----------------> |                  |
|   BumbaClaude    |    filesystem     |   Claude Code    |
|   (dashboard)    | <---------------- |   (agents)       |
|                  |    Agent SDK      |                  |
+------------------+ ----------------> +------------------+
```

1. **tmux sessions** -- spawns, monitors, and controls Claude Code processes
2. **Filesystem state** -- reads JSON mailbox and task files from `~/.claude/`
3. **Agent SDK** (optional, v0.2+) -- programmatic agent control via the official API

No forks. No patches. No modifications to Claude Code's source or binary.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop | Electron 41+ (custom titlebar, system tray, auto-update) |
| Framework | Next.js 16+ (App Router, TypeScript) |
| Styling | Tailwind CSS (dark mode primary) |
| Database | SQLite via better-sqlite3 |
| Real-time | WebSocket (ws) |
| File watching | chokidar |
| Session mgmt | tmux via child_process |
| Packaging | electron-builder (NSIS installer, portable zip) |

---

## Roadmap

| Version | Focus | Status |
|---|---|---|
| **v0.1.1** | Dashboard, team wizard, live monitor, audit log, templates, token/tool tracking, MCP discovery, scheduled tasks, context files, Electron desktop app | **Released** |
| **v0.2.0** | Agent SDK integration, per-agent permissions, Kanban task board, template sharing/registry | Planned |
| **v0.3.0** | Workflow replay, webhook notifications, context graph visualization | Planned |
| **v0.4.0** | Plugin system, GitHub Actions integration, cross-platform builds (macOS/Linux) | Planned |

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

Bug reports, feature ideas, documentation improvements, and code contributions all help.

## License

MIT. See [LICENSE](./LICENSE).

## Author

Thomas Wright ([@twamp22](https://github.com/twamp22))
