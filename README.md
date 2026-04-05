# BumbaClaude

Mission control for Claude Code multi-agent workflows.

BumbaClaude is a standalone web dashboard that manages multi-agent Claude Code orchestration without modifying Claude Code itself. Define agent teams, launch them, watch them work, intervene when they go sideways, and keep an audit trail of everything.

## What it does

- **Define teams:** Create reusable agent team configurations with custom roles, model tiers, and governance rules
- **Launch workflows:** Spin up multi-agent Claude Code sessions from the dashboard with one click
- **Monitor live:** Watch each agent's terminal output in real time, see task progress, and send messages to individual agents
- **Enforce governance:** Set permission boundaries before agents spawn -- control file creation, shell access, git pushes, and turn limits
- **Audit everything:** Full event log of agent activity with timestamps, filterable by agent and event type
- **Save templates:** Package team configurations as reusable workflow templates, export and share as JSON

## How it works

BumbaClaude sits completely outside Claude Code. It talks to Claude Code through three public interfaces:

1. **tmux sessions** -- spawns, monitors, and controls Claude Code processes
2. **Filesystem state** -- reads the JSON mailbox and task files Claude Code writes to `~/.claude/`
3. **Agent SDK** (optional, v0.2) -- programmatic agent control via the official API

No forks. No patches. No modifications to Claude Code's source or binary.

## Quick start

```bash
git clone https://github.com/twamp22/BumbaClaude.git
cd BumbaClaude
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Prerequisites

- Node.js 18+
- pnpm
- tmux installed and available in PATH
- Claude Code installed (`claude` command available)
- Claude Max subscription or API key

## Tech stack

- Next.js 14+ (App Router, TypeScript)
- Tailwind CSS (dark mode primary)
- SQLite via better-sqlite3 (local, zero config)
- WebSocket for live agent status streaming
- chokidar for filesystem monitoring

## Project status

BumbaClaude is in early development. The MVP targets the core loop: define a team, spawn agents, monitor progress, intervene when needed, review the audit trail.

See [MVP_SPEC.md](./MVP_SPEC.md) for the full specification.

### Roadmap

- **v0.1** -- Dashboard home, team creation wizard, live monitor, task list, audit log, workflow templates
- **v0.2** -- Agent SDK integration, granular permissions, token tracking, template sharing
- **v0.3** -- Kanban board, context visualization, workflow replay, webhook notifications
- **v0.4** -- Plugin system, public template registry, GitHub Actions integration

## Contributing

BumbaClaude is open source and contributions are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

Whether it's a bug report, feature idea, documentation improvement, or code contribution -- all of it helps.

## License

MIT. See [LICENSE](./LICENSE) for the full text.

## Author

Thomas Wright ([@twamp22](https://github.com/twamp22))
