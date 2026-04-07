# BumbaClaude Electron Desktop App -- Design Spec

## Overview

Package BumbaClaude as a standalone Windows desktop application using Electron. The Electron layer is purely additive -- the existing Next.js codebase remains untouched and can still run in a browser via `pnpm dev`.

Future consideration: Android app as a remote client is backburnered. The desktop app does NOT act as a server for remote clients. When Android support is revisited, the server/relay architecture will be designed separately.

## Architecture

Electron wraps the existing Next.js app. New files live in an `electron/` directory at the project root:

```
electron/
  main.ts          -- Electron main process (window, tray, IPC)
  preload.ts       -- Bridge between renderer and main process
  tray.ts          -- System tray icon and menu
  updater.ts       -- Auto-update logic
  notifications.ts -- Native OS notification handlers
```

### Main process responsibilities

1. Start the Next.js standalone server as a child process on a random available port
2. Open a BrowserWindow pointing to `http://localhost:{port}`
3. Manage system tray, native menus, notifications, and auto-update
4. Handle IPC between the renderer (Next.js app) and native OS features

### Key principle

The Electron layer is additive. Nothing in the existing `src/` codebase changes. A developer can still clone the repo and run `pnpm dev` in a browser without Electron installed.

## Native Features

### Window management

- Single-window app with standard minimize/maximize/close
- Close-to-tray (configurable) -- closing the window keeps agents running in the background
- Remember window size and position between sessions (persisted to disk)
- Native Windows titlebar (not custom)

### System tray

- Tray icon showing aggregate agent status:
  - Green: all agents healthy
  - Amber: agents idle/waiting for input
  - Red: agent errors
- Right-click menu: Show/Hide window, active team count, Quit
- Left-click opens/focuses the window

### Notifications

Native Windows toast notifications for:
- Agent completed a task
- Agent errored
- Agent waiting for human input
- Governance limit reached

Configurable -- user can toggle which event types trigger notifications. Clicking a notification opens the app and navigates to the relevant team/agent.

### File dialogs

Team creation's "select working directory" uses the native Windows folder picker via Electron's `dialog.showOpenDialog()` instead of a text input.

### Auto-update

- Uses `electron-updater` with GitHub Releases as the update source
- Checks for updates on launch and periodically (configurable interval)
- "Update available" banner in the app UI; user clicks to install
- Downloads in background, restarts to apply

### Installer

- NSIS-based Windows installer (.exe) via `electron-builder`
- Portable mode option (.zip, no install required)
- Start menu shortcut, optional desktop shortcut
- Optional "launch on Windows startup" toggle

### Global shortcuts

- Configurable global hotkey to show/hide the window (default: Ctrl+Shift+B)

## Build & Packaging

### Tooling

- `electron-builder` for packaging and creating installers
- Custom build script or `electron-vite` to compile TypeScript in `electron/`

### Build process

1. Compile Next.js with `pnpm build` (using `output: 'standalone'` mode)
2. Compile Electron TypeScript files
3. Package the Next.js standalone output + Electron into a distributable

### Scripts (added to package.json)

- `pnpm electron:dev` -- runs Next.js dev server + Electron in development mode with hot reload
- `pnpm electron:build` -- builds Next.js then packages into a Windows installer
- `pnpm electron:preview` -- builds and runs locally without creating an installer

### Development workflow

- `pnpm dev` -- browser-only development, no Electron (unchanged)
- `pnpm electron:dev` -- full desktop app experience with hot reload
- Electron main process reloads on changes to `electron/` files
- Renderer (Next.js) uses normal Next.js hot reload

### Distribution

- GitHub Releases for hosting installers and auto-update files
- `.exe` installer + `.zip` portable version
- Auto-update checks against GitHub Releases API

### Next.js configuration change

Add `output: 'standalone'` to `next.config.ts` for the Electron build. This bundles the Next.js server into a self-contained folder that Electron can run without the full `node_modules`.

## Error Handling & Lifecycle

### Startup sequence

1. Electron launches, shows a splash screen (BumbaClaude logo + "Starting...")
2. Finds an available port, starts the Next.js standalone server
3. Waits for the server to respond (health check polling)
4. Opens the main window, hides the splash
5. Registers system tray, global shortcuts, starts update check

### Crash recovery

- If the Next.js server process dies, Electron detects it and shows an error screen with a "Restart Server" button
- If the Electron main process crashes, agents keep running in their tmux sessions (independent processes) -- next launch picks them back up via BumbaClaude's existing crash recovery logic

### Graceful shutdown

- "Quit" from tray or closing the window (with close-to-tray disabled) triggers shutdown
- If agents are still running, prompt: "X agents are still active. Quit anyway? (Agents will keep running in tmux)"
- Shuts down the Next.js server process, then exits Electron

### Single instance lock

- Only one instance of the app can run at a time
- Launching a second instance focuses the existing window instead of opening a new one

## Dependencies (new)

### Production

- `electron` -- desktop app framework
- `electron-updater` -- auto-update support

### Dev

- `electron-builder` -- packaging and installer creation
- `electron-vite` or equivalent -- TypeScript compilation for Electron files

## Out of scope

- Android/mobile app (backburnered)
- Remote server mode (no serving to external clients)
- macOS or Linux builds (Windows only for now, but Electron makes these trivial to add later)
- Custom titlebar or frameless window
- Deep OS integration (right-click context menu on folders) -- can be added later via NSIS installer scripts
