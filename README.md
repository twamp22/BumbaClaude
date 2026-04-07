<p align="center">
  <img src="public/logo.png" alt="BumbaClaude - Mission Control for Claude Code" width="300" />
</p>

<h1 align="center">BumbaClaude</h1>

<p align="center">
  <strong>Mission control for Claude Code multi-agent workflows</strong>
</p>

<p align="center">
  <a href="https://github.com/twamp22/BumbaClaude/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="MIT License" /></a>
  <a href="https://github.com/twamp22/BumbaClaude/releases"><img src="https://img.shields.io/badge/version-0.1.0-blue.svg" alt="Version" /></a>
  <a href="https://github.com/twamp22/BumbaClaude/pulls"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome" /></a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows%20(WSL)-lightgrey.svg" alt="Platform" />
</p>

<p align="center">
  Define agent teams. Launch them. Watch them work. Intervene when they go sideways.<br/>
  Full audit trail of everything. Zero modifications to Claude Code.
</p>

---

## Quick Start

```bash
git clone https://github.com/twamp22/BumbaClaude.git
cd BumbaClaude
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). That's it.

### Prerequisites

| Requirement | Why |
|---|---|
| Node.js 18+ | Runtime |
| pnpm | Package manager |
| tmux | Agent session management |
| Claude Code CLI | The `claude` command |
| Claude Max or API key | LLM access |

---

## Features

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
| Framework | Next.js 16+ (App Router, TypeScript) |
| Styling | Tailwind CSS (dark mode primary) |
| Database | SQLite via better-sqlite3 |
| Real-time | WebSocket (ws) |
| File watching | chokidar |
| Session mgmt | tmux via child_process |

---

## Roadmap

| Version | Focus |
|---|---|
| **v0.1** (current) | Dashboard, team wizard, live monitor, task list, audit log, templates |
| **v0.2** | Agent SDK integration, granular permissions, token tracking, template sharing |
| **v0.3** | Kanban board, context visualization, workflow replay, webhook notifications |
| **v0.4** | Plugin system, public template registry, GitHub Actions integration |

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

Bug reports, feature ideas, documentation improvements, and code contributions all help.

## License

MIT. See [LICENSE](./LICENSE).

## Author

Thomas Wright ([@twamp22](https://github.com/twamp22))
