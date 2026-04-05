# Contributing to BumbaClaude

Thanks for your interest in contributing. BumbaClaude is early-stage and moving fast, so contributions of all kinds are valuable.

## Ways to contribute

- **Bug reports** -- Found something broken? Open an issue with steps to reproduce.
- **Feature ideas** -- Have a use case the dashboard doesn't cover? Open a discussion or issue.
- **Code** -- Pick up an open issue or propose a change. See the workflow below.
- **Documentation** -- Improve the README, add examples, or clarify the spec.
- **Testing** -- Try BumbaClaude on your setup and report what works and what doesn't.

## Development workflow

1. Fork the repo and create a branch from `main`
2. Install dependencies: `pnpm install`
3. Start the dev server: `pnpm dev`
4. Make your changes
5. Run the build to check for errors: `pnpm build`
6. Open a pull request against `main`

### Branch naming

- `feature/short-description` for new features
- `fix/short-description` for bug fixes
- `docs/short-description` for documentation changes

### Commit messages

Keep them short and descriptive. No strict format required, just be clear about what changed and why.

## Code style

- TypeScript strict mode
- Server components by default, client components only when interactivity requires it
- All database operations go through `lib/db.ts`
- All tmux operations go through `lib/tmux.ts`
- No em dashes in user-facing text
- Meaningful error messages -- never silent failures

## Architecture boundaries

BumbaClaude is a wrapper around Claude Code, not a modification of it. This is a hard rule:

- **NEVER** modify files under `~/.claude/` (read-only access)
- **NEVER** patch or modify Claude Code's source or binary
- All interaction happens through tmux commands, filesystem reads, or the Agent SDK
- If a feature requires modifying Claude Code internals, it's out of scope

## Issues and discussions

- Check existing issues before opening a new one
- Use issue templates when available
- Be specific: include your OS, Node version, Claude Code version, and tmux version when reporting bugs

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
