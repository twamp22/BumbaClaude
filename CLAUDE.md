# CLAUDE.md

## Project

BumbaClaude -- a standalone web dashboard for managing multi-agent Claude Code workflows. Open source, MIT licensed, hosted at github.com/twamp22/BumbaClaude.

## Stack

- Next.js 14+ (App Router, TypeScript, server components by default)
- Tailwind CSS (dark mode primary, class strategy)
- SQLite via better-sqlite3 (no ORM, raw SQL in lib/db.ts)
- WebSocket via ws (server) + native WebSocket (client)
- chokidar for filesystem watching of ~/.claude/ directories
- child_process for tmux session management
- pnpm as package manager

## Architecture boundary -- CRITICAL

BumbaClaude is a WRAPPER around Claude Code. It does NOT modify Claude Code.

- NEVER write to or modify files under ~/.claude/ -- read-only access only
- NEVER modify Claude Code's source, binary, or configuration
- All interaction with Claude Code happens through three channels:
  1. tmux commands (spawn sessions, capture output, send input, kill panes)
  2. Reading filesystem state (~/.claude/teams/ and ~/.claude/tasks/ directories)
  3. Optionally the Claude Agent SDK (API-based, v0.2+)

## Code conventions

- TypeScript strict mode throughout
- Server components by default, 'use client' only when interactivity requires it
- API routes in /src/app/api/ for all backend operations
- All database queries go through lib/db.ts helper functions
- All tmux operations go through lib/tmux.ts helper functions
- All filesystem watching goes through lib/watcher.ts
- No em dashes in any user-facing text or documentation
- Error handling: try/catch with meaningful error messages, never swallow errors silently
- Use console.error for server-side logging
- Use descriptive variable names -- no single-letter variables except loop counters

## File structure

```
/src/app/              -- Next.js pages (App Router)
/src/components/       -- React components organized by feature area
/src/lib/              -- Core library code (db, tmux, watcher, websocket, types)
/src/hooks/            -- Custom React hooks
/db/                   -- SQL schema and seed files
/data/                 -- SQLite database file (gitignored)
```

## Database

SQLite database lives at ./data/dashboard.db (auto-created on first run). Schema is defined in /db/schema.sql. Run schema migrations by executing the SQL file directly via better-sqlite3.

## Testing

- `pnpm build` to verify no TypeScript errors
- `pnpm lint` for linting
- tmux integration requires manual testing in a terminal with tmux installed
- Test with `tmux new-session -d -s test-session` to verify tmux is available before running integration tests

## Design direction

Industrial/utilitarian control room aesthetic. Dark mode primary. Monospace fonts for terminal output. Dense information display -- this is a power tool for developers, not a marketing page. Status colors: green=active, amber=idle/waiting, red=error, gray=completed.

## Key files

- MVP_SPEC.md -- Full feature specification for the MVP
- README.md -- Project overview and quick start
- CONTRIBUTING.md -- Contribution guidelines
