# Electron Deferred Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete five deferred items from the Electron code review: tray status polling, periodic update checks, crash recovery with restart, useElectron hook for auto-update APIs, and Electron main process hot reload in dev.

**Architecture:** Each item is a small, independent enhancement to existing Electron files. No new architectural patterns -- just wiring up existing exported functions and adding missing features.

**Tech Stack:** Electron, electron-updater, electronmon (dev only)

---

## File Structure

```
Modified files:
  electron/main.ts          -- Add agent status polling, crash recovery restart
  electron/updater.ts       -- Add periodic update check interval
  electron/server.ts        -- Add restartServer export
  electron/preload.ts       -- Add restartServer IPC
  src/hooks/useElectron.ts  -- Expose auto-update and login item APIs
  package.json              -- Add electronmon, update electron:dev script
```

---

### Task 1: Tray Status Polling

**Files:**
- Modify: `electron/main.ts`

The tray currently always shows green. Add a polling loop in `bootstrap()` that fetches `/api/teams` every 10 seconds and calls `updateTrayStatus` with the aggregate status.

- [ ] **Step 1: Add the polling function to main.ts**

After the `initAutoUpdater(mainWindow);` line in `bootstrap()` (around line 185), add:

```ts
import { updateTrayStatus } from "./tray";
```

(Add this import at the top with the other tray import -- modify the existing line 5.)

Then after `initAutoUpdater(mainWindow);` in `bootstrap()`, add:

```ts
// Poll agent status to update tray icon
const pollAgentStatus = async (): Promise<void> => {
  try {
    const port = getServerPort();
    if (port === 0) return;
    const response = await fetch(`http://localhost:${port}/api/teams`);
    const teams = await response.json();

    if (!Array.isArray(teams) || !mainWindow) return;

    const activeTeams = teams.filter(
      (t: { status: string }) => t.status === "running" || t.status === "active"
    );
    const erroredTeams = teams.filter(
      (t: { status: string }) => t.status === "errored"
    );
    const waitingTeams = teams.filter(
      (t: { status: string }) => t.status === "waiting" || t.status === "idle"
    );

    let status: "green" | "amber" | "red" = "green";
    if (erroredTeams.length > 0) {
      status = "red";
    } else if (waitingTeams.length > 0) {
      status = "amber";
    }

    updateTrayStatus(status, activeTeams.length, mainWindow);
  } catch {
    // Server not reachable, keep current status
  }
};

setInterval(pollAgentStatus, 10000);
pollAgentStatus();
```

- [ ] **Step 2: Update the tray import**

Change line 5 from:
```ts
import { createTray, destroyTray } from "./tray";
```
to:
```ts
import { createTray, destroyTray, updateTrayStatus } from "./tray";
```

- [ ] **Step 3: Verify compilation**

```bash
pnpm electron:compile
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add electron/main.ts
git commit -m "feat: poll agent status to update tray icon color"
```

---

### Task 2: Periodic Update Checks

**Files:**
- Modify: `electron/updater.ts`

Currently `autoUpdater.checkForUpdates()` is only called once in `initAutoUpdater`. Add a periodic check every 4 hours.

- [ ] **Step 1: Add periodic check in updater.ts**

At the end of the `initAutoUpdater` function, after the initial `checkForUpdates` call, add:

```ts
// Check for updates every 4 hours
const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
setInterval(() => {
  autoUpdater.checkForUpdates().catch((err) => {
    console.error("Periodic update check failed:", err);
  });
}, UPDATE_CHECK_INTERVAL_MS);
```

- [ ] **Step 2: Verify compilation**

```bash
pnpm electron:compile
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add electron/updater.ts
git commit -m "feat: check for updates every 4 hours"
```

---

### Task 3: Crash Recovery with Restart Button

**Files:**
- Modify: `electron/server.ts`
- Modify: `electron/main.ts`
- Modify: `electron/preload.ts`

Currently when the Next.js server crashes, the app shows an error dialog and quits. Change it to show a dialog with a "Restart Server" button.

- [ ] **Step 1: Add restartServer to server.ts**

Add this export at the end of `electron/server.ts` (before the `connectToDevServer` function):

```ts
export async function restartServer(appPath: string): Promise<number> {
  stopServer();
  return startServer(appPath);
}
```

- [ ] **Step 2: Replace the crash handler in main.ts**

In `electron/main.ts`, find the `onServerExit` callback inside `bootstrap()` (around lines 224-233). Replace:

```ts
if (!isDev) {
  onServerExit((code) => {
    if (code !== null && code !== 0 && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showErrorBox(
        "Server Crashed",
        "The BumbaClaude server has stopped unexpectedly. The application will close."
      );
      app.quit();
    }
  });
}
```

with:

```ts
if (!isDev) {
  onServerExit(async (code) => {
    if (code !== null && code !== 0 && mainWindow && !mainWindow.isDestroyed()) {
      const { response: buttonIndex } = await dialog.showMessageBox(mainWindow, {
        type: "error",
        buttons: ["Quit", "Restart Server"],
        defaultId: 1,
        title: "Server Crashed",
        message: "The BumbaClaude server has stopped unexpectedly.",
        detail: "You can restart the server or quit the application.",
      });

      if (buttonIndex === 1) {
        try {
          const appPath = getAppPath();
          const newPort = await restartServer(appPath);
          mainWindow.loadURL(`http://localhost:${newPort}`);

          onServerExit(async (restartCode) => {
            if (restartCode !== null && restartCode !== 0 && mainWindow && !mainWindow.isDestroyed()) {
              dialog.showErrorBox(
                "Server Crashed Again",
                "The server crashed again after restart. The application will close."
              );
              app.quit();
            }
          });
        } catch (err) {
          dialog.showErrorBox(
            "Restart Failed",
            `Failed to restart server:\n${err instanceof Error ? err.message : String(err)}`
          );
          app.quit();
        }
      } else {
        app.quit();
      }
    }
  });
}
```

Also add `restartServer` to the server import at the top of main.ts:

```ts
import { startServer, stopServer, onServerExit, connectToDevServer, getServerPort, restartServer } from "./server";
```

- [ ] **Step 3: Verify compilation**

```bash
pnpm electron:compile
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add electron/server.ts electron/main.ts
git commit -m "feat: add restart server button on crash instead of force quit"
```

---

### Task 4: Expose Auto-Update and Login APIs in useElectron Hook

**Files:**
- Modify: `src/hooks/useElectron.ts`

The hook currently only exposes `isElectron`, `selectDirectory`, and `sendNotification`. The preload already exposes auto-update listeners and login item methods, but the React hook doesn't surface them.

- [ ] **Step 1: Update the ElectronAPI interface and hook**

Replace the entire `src/hooks/useElectron.ts` with:

```ts
"use client";

import { useCallback, useEffect, useState } from "react";

interface ElectronAPI {
  isElectron: boolean;
  selectDirectory: () => Promise<string | null>;
  sendNotification: (title: string, body: string, route?: string) => Promise<void>;
  getVersion: () => Promise<string>;
  onNavigate: (callback: (route: string) => void) => () => void;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  onUpdateAvailable: (callback: (info: { version: string }) => void) => () => void;
  onUpdateProgress: (callback: (progress: { percent: number }) => void) => () => void;
  onUpdateDownloaded: (callback: () => void) => () => void;
  setOpenAtLogin: (enabled: boolean) => Promise<void>;
  getOpenAtLogin: () => Promise<{ openAtLogin: boolean }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export function useElectron() {
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    setIsElectron(!!window.electronAPI?.isElectron);
  }, []);

  const selectDirectory = useCallback(async (): Promise<string | null> => {
    if (!window.electronAPI) return null;
    return window.electronAPI.selectDirectory();
  }, []);

  const sendNotification = useCallback(
    async (title: string, body: string, route?: string): Promise<void> => {
      if (!window.electronAPI) return;
      return window.electronAPI.sendNotification(title, body, route);
    },
    []
  );

  const downloadUpdate = useCallback(async (): Promise<void> => {
    if (!window.electronAPI) return;
    return window.electronAPI.downloadUpdate();
  }, []);

  const installUpdate = useCallback(async (): Promise<void> => {
    if (!window.electronAPI) return;
    return window.electronAPI.installUpdate();
  }, []);

  const onUpdateAvailable = useCallback(
    (callback: (info: { version: string }) => void): (() => void) => {
      if (!window.electronAPI) return () => {};
      return window.electronAPI.onUpdateAvailable(callback);
    },
    []
  );

  const onUpdateProgress = useCallback(
    (callback: (progress: { percent: number }) => void): (() => void) => {
      if (!window.electronAPI) return () => {};
      return window.electronAPI.onUpdateProgress(callback);
    },
    []
  );

  const onUpdateDownloaded = useCallback(
    (callback: () => void): (() => void) => {
      if (!window.electronAPI) return () => {};
      return window.electronAPI.onUpdateDownloaded(callback);
    },
    []
  );

  const setOpenAtLogin = useCallback(async (enabled: boolean): Promise<void> => {
    if (!window.electronAPI) return;
    return window.electronAPI.setOpenAtLogin(enabled);
  }, []);

  const getOpenAtLogin = useCallback(async (): Promise<{ openAtLogin: boolean } | null> => {
    if (!window.electronAPI) return null;
    return window.electronAPI.getOpenAtLogin();
  }, []);

  return {
    isElectron,
    selectDirectory,
    sendNotification,
    downloadUpdate,
    installUpdate,
    onUpdateAvailable,
    onUpdateProgress,
    onUpdateDownloaded,
    setOpenAtLogin,
    getOpenAtLogin,
  };
}
```

- [ ] **Step 2: Verify Next.js build**

```bash
pnpm build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useElectron.ts
git commit -m "feat: expose auto-update and login item APIs in useElectron hook"
```

---

### Task 5: Electron Main Process Hot Reload in Dev

**Files:**
- Modify: `package.json`

Currently the `electron:dev` script launches Electron once and changes to `electron/*.ts` files require a manual restart. Use `electronmon` to auto-restart Electron when main process files change.

- [ ] **Step 1: Install electronmon**

```bash
pnpm add -D electronmon
```

- [ ] **Step 2: Update electron:dev script**

In `package.json`, replace the `electron:dev` script:

From:
```json
"electron:dev": "concurrently -k \"next dev\" \"wait-on http://localhost:3000 && pnpm electron:compile && electron .\""
```

To:
```json
"electron:dev": "concurrently -k \"next dev\" \"wait-on http://localhost:3000 && pnpm electron:compile && electronmon .\""
```

The only change is `electron .` becomes `electronmon .`. `electronmon` watches for file changes and restarts the Electron process automatically.

- [ ] **Step 3: Create electronmon config**

`electronmon` needs to know to watch `dist-electron/` (the compiled output) rather than `electron/` (the source). Create a top-level `.electronmonrc.json`:

No -- actually `electronmon` watches the `main` entry point and its dependencies by default. But since we compile TS to `dist-electron/`, we need it to watch those compiled files. The simplest approach: also add a watcher that recompiles on source changes.

Update the `electron:dev` script to:

```json
"electron:dev": "concurrently -k \"next dev\" \"wait-on http://localhost:3000 && pnpm electron:compile && electronmon .\" \"pnpm exec tsc -p electron.tsconfig.json --watch\""
```

This runs three processes:
1. `next dev` -- Next.js dev server with hot reload
2. `electronmon .` -- Electron with auto-restart on file changes in dist-electron/
3. `tsc --watch` -- Recompiles electron/ TS files on change, which triggers electronmon restart

- [ ] **Step 4: Verify dev script works**

```bash
pnpm electron:dev
```

Expected: All three processes start. Changing a file in `electron/` triggers recompilation and Electron restarts.

Note: This may not work perfectly in all environments. If `electronmon` does not detect changes to `dist-electron/`, the developer can manually restart with Ctrl+C and re-run. This is still an improvement over the previous script.

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "feat: add Electron main process hot reload via electronmon"
```

---

## Summary

| Task | Description | Modifies |
|------|-------------|----------|
| 1 | Tray status polling | electron/main.ts |
| 2 | Periodic update checks | electron/updater.ts |
| 3 | Crash recovery with restart | electron/server.ts, electron/main.ts |
| 4 | useElectron hook for all APIs | src/hooks/useElectron.ts |
| 5 | Electron dev hot reload | package.json |

Tasks 1-4 are independent (no shared file modifications except Task 1 and 3 both touch main.ts -- do Task 1 first). Task 5 is independent of all others.
