# Electron Desktop App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package BumbaClaude as a standalone Windows desktop app using Electron, with system tray, notifications, auto-update, and installer.

**Architecture:** Electron main process starts a Next.js standalone server as a child process, opens a BrowserWindow to it. New code lives in `electron/` -- existing `src/` is untouched. IPC bridge connects renderer to native features (tray, notifications, file dialogs).

**Tech Stack:** Electron 35+, electron-builder, electron-updater, TypeScript

---

## File Structure

```
electron/
  main.ts              -- Entry point: app lifecycle, window, single instance, IPC handlers
  preload.ts           -- contextBridge exposing native APIs to renderer
  splash.html          -- Static splash screen shown during server startup
  tray.ts              -- System tray icon, menu, status color management
  updater.ts           -- Auto-update check/download/install logic
  notifications.ts     -- Native notification dispatch + click-to-navigate
  server.ts            -- Spawns and monitors the Next.js standalone server
  config.ts            -- Persists user preferences (window bounds, settings)
  assets/
    icon.ico           -- App icon (copy from public/favicon.ico or create new)
    tray-green.png     -- Tray icon: healthy (16x16)
    tray-amber.png     -- Tray icon: waiting (16x16)
    tray-red.png       -- Tray icon: error (16x16)

src/hooks/useElectron.ts          -- Client hook: detect Electron, call IPC
src/components/shared/NativeFilePicker.tsx  -- Wrapper: uses native dialog in Electron, falls back to text input in browser

electron-builder.config.js        -- electron-builder configuration
electron.tsconfig.json            -- Separate tsconfig for electron/ directory
```

**Modified files:**
- `package.json` -- add Electron deps and scripts
- `next.config.ts` -- add `output: 'standalone'` (conditional or always)
- `tsconfig.json` -- exclude `electron/` from Next.js compilation

---

### Task 1: Project Setup and Electron Scaffolding

**Files:**
- Create: `electron/main.ts`
- Create: `electron/preload.ts`
- Create: `electron/server.ts`
- Create: `electron.tsconfig.json`
- Modify: `package.json`
- Modify: `tsconfig.json`
- Modify: `next.config.ts`

- [ ] **Step 1: Install Electron dependencies**

```bash
pnpm add -D electron electron-builder
```

- [ ] **Step 2: Create electron.tsconfig.json**

This is a separate TypeScript config for the Electron main process code. It targets Node.js, not the browser.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "lib": ["ES2022"],
    "outDir": "./dist-electron",
    "rootDir": "./electron",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "declaration": false
  },
  "include": ["electron/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Exclude electron/ from Next.js tsconfig**

In `tsconfig.json`, add `"electron"` to the `exclude` array so Next.js does not try to compile Electron code:

```json
"exclude": [
  "node_modules",
  "electron"
]
```

- [ ] **Step 4: Add output standalone to next.config.ts**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
```

- [ ] **Step 5: Create electron/server.ts**

This module spawns the Next.js standalone server and monitors it. It finds a free port, starts the server, and provides health checking.

```ts
import { fork, type ChildProcess } from "child_process";
import path from "path";
import net from "net";

let serverProcess: ChildProcess | null = null;
let serverPort: number = 0;

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const address = server.address();
      if (address && typeof address === "object") {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        reject(new Error("Could not find free port"));
      }
    });
    server.on("error", reject);
  });
}

async function waitForServer(port: number, timeoutMs: number = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`http://localhost:${port}`);
      if (response.ok || response.status === 404) return;
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Server did not start within ${timeoutMs}ms`);
}

export async function startServer(appPath: string): Promise<number> {
  serverPort = await findFreePort();

  const serverJs = path.join(appPath, ".next", "standalone", "server.js");

  serverProcess = fork(serverJs, [], {
    env: {
      ...process.env,
      PORT: String(serverPort),
      HOSTNAME: "localhost",
    },
    cwd: appPath,
    stdio: "pipe",
  });

  serverProcess.on("error", (err) => {
    console.error("Next.js server error:", err);
  });

  serverProcess.stdout?.on("data", (data: Buffer) => {
    console.log("[next]", data.toString().trim());
  });

  serverProcess.stderr?.on("data", (data: Buffer) => {
    console.error("[next]", data.toString().trim());
  });

  await waitForServer(serverPort);
  return serverPort;
}

export function stopServer(): void {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    serverProcess = null;
  }
}

export function isServerRunning(): boolean {
  return serverProcess !== null && !serverProcess.killed;
}

export function getServerPort(): number {
  return serverPort;
}

export function onServerExit(callback: (code: number | null) => void): void {
  if (serverProcess) {
    serverProcess.on("exit", callback);
  }
}
```

- [ ] **Step 6: Create electron/preload.ts**

The preload script bridges the renderer (Next.js app) and the main process via contextBridge. Initially it exposes a minimal API -- more methods will be added in later tasks.

```ts
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,

  // File dialogs
  selectDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke("dialog:selectDirectory"),

  // Notifications
  sendNotification: (title: string, body: string, route?: string): Promise<void> =>
    ipcRenderer.invoke("notification:send", title, body, route),

  // App info
  getVersion: (): Promise<string> =>
    ipcRenderer.invoke("app:getVersion"),

  // Navigation from main process (e.g., notification click)
  onNavigate: (callback: (route: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, route: string) => callback(route);
    ipcRenderer.on("navigate", handler);
    return () => ipcRenderer.removeListener("navigate", handler);
  },
});
```

- [ ] **Step 7: Create electron/main.ts**

The main entry point. For now, it starts the server, opens a window, and handles the single-instance lock. Tray, notifications, and updater are wired in later tasks.

```ts
import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";
import { startServer, stopServer, isServerRunning, onServerExit } from "./server";

let mainWindow: BrowserWindow | null = null;

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function getAppPath(): string {
  // In development: project root. In production: the packaged app resources.
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "app");
  }
  return path.join(__dirname, "..");
}

function createSplashWindow(): BrowserWindow {
  const splash = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    resizable: false,
    backgroundColor: "#09090b", // zinc-950
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  splash.loadFile(path.join(__dirname, "splash.html"));
  return splash;
}

function createMainWindow(port: number): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#09090b",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadURL(`http://localhost:${port}`);

  win.once("ready-to-show", () => {
    win.show();
  });

  return win;
}

// IPC Handlers
function registerIpcHandlers(): void {
  ipcMain.handle("dialog:selectDirectory", async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle("app:getVersion", () => {
    return app.getVersion();
  });
}

async function bootstrap(): Promise<void> {
  const splash = createSplashWindow();

  try {
    const appPath = getAppPath();
    const port = await startServer(appPath);

    mainWindow = createMainWindow(port);

    mainWindow.once("ready-to-show", () => {
      splash.destroy();
    });

    onServerExit((code) => {
      if (code !== null && code !== 0 && mainWindow && !mainWindow.isDestroyed()) {
        dialog.showErrorBox(
          "Server Crashed",
          "The BumbaClaude server has stopped unexpectedly. The application will close."
        );
        app.quit();
      }
    });
  } catch (err) {
    splash.destroy();
    dialog.showErrorBox(
      "Startup Error",
      `Failed to start BumbaClaude server:\n${err instanceof Error ? err.message : String(err)}`
    );
    app.quit();
  }
}

app.whenReady().then(() => {
  registerIpcHandlers();
  bootstrap();
});

app.on("window-all-closed", () => {
  stopServer();
  app.quit();
});

app.on("before-quit", () => {
  stopServer();
});
```

- [ ] **Step 8: Create electron/splash.html**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #09090b;
      color: #fafafa;
      font-family: 'Courier New', monospace;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      -webkit-app-region: drag;
    }
    .title {
      font-size: 28px;
      font-weight: bold;
      letter-spacing: 2px;
      margin-bottom: 8px;
    }
    .subtitle {
      font-size: 12px;
      color: #71717a;
      margin-bottom: 32px;
    }
    .spinner {
      width: 24px;
      height: 24px;
      border: 2px solid #27272a;
      border-top-color: #22c55e;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    .status {
      margin-top: 16px;
      font-size: 11px;
      color: #52525b;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="title">BumbaClaude</div>
  <div class="subtitle">Agent Orchestration</div>
  <div class="spinner"></div>
  <div class="status">Starting server...</div>
</body>
</html>
```

- [ ] **Step 9: Update package.json**

Add the `main` field pointing to the compiled Electron entry, add Electron scripts, and add the `build` configuration for electron-builder:

```json
{
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "electron:compile": "tsc -p electron.tsconfig.json",
    "electron:dev": "pnpm build && pnpm electron:compile && electron .",
    "electron:build": "pnpm build && pnpm electron:compile && electron-builder --win",
    "electron:preview": "pnpm build && pnpm electron:compile && electron ."
  }
}
```

Note: `electron:dev` and `electron:preview` are identical for now. Task 7 adds a proper dev workflow with hot reload.

- [ ] **Step 10: Verify the Electron app launches**

```bash
cd D:/Code/BumbaClaude
pnpm electron:dev
```

Expected: Splash screen appears, Next.js server starts, main window opens showing the BumbaClaude dashboard. Close the window to quit.

- [ ] **Step 11: Commit**

```bash
git add electron/ electron.tsconfig.json package.json tsconfig.json next.config.ts
git commit -m "feat: scaffold Electron app with main process, preload, server, and splash screen"
```

---

### Task 2: Window State Persistence

**Files:**
- Create: `electron/config.ts`
- Modify: `electron/main.ts`

- [ ] **Step 1: Create electron/config.ts**

Stores user preferences (window bounds, settings) in a JSON file in the app's user data directory.

```ts
import { app } from "electron";
import path from "path";
import fs from "fs";

interface AppConfig {
  windowBounds: {
    x?: number;
    y?: number;
    width: number;
    height: number;
    isMaximized: boolean;
  };
  closeToTray: boolean;
  launchOnStartup: boolean;
  globalShortcut: string;
  notifications: {
    agentCompleted: boolean;
    agentErrored: boolean;
    agentWaiting: boolean;
    governanceLimit: boolean;
  };
}

const CONFIG_PATH = path.join(app.getPath("userData"), "config.json");

const DEFAULT_CONFIG: AppConfig = {
  windowBounds: {
    width: 1400,
    height: 900,
    isMaximized: false,
  },
  closeToTray: true,
  launchOnStartup: false,
  globalShortcut: "Ctrl+Shift+B",
  notifications: {
    agentCompleted: true,
    agentErrored: true,
    agentWaiting: true,
    governanceLimit: true,
  },
};

let cachedConfig: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (cachedConfig) return cachedConfig;

  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
      cachedConfig = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
      return cachedConfig;
    }
  } catch (err) {
    console.error("Failed to load config, using defaults:", err);
  }

  cachedConfig = { ...DEFAULT_CONFIG };
  return cachedConfig;
}

export function saveConfig(config: Partial<AppConfig>): void {
  const current = loadConfig();
  const merged = { ...current, ...config };
  cachedConfig = merged;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), "utf-8");
}

export function getConfig(): AppConfig {
  return loadConfig();
}
```

- [ ] **Step 2: Wire window state persistence into main.ts**

Import `loadConfig` and `saveConfig` in `main.ts`. Update `createMainWindow` to use saved bounds:

```ts
import { loadConfig, saveConfig } from "./config";
```

Replace the `createMainWindow` function:

```ts
function createMainWindow(port: number): BrowserWindow {
  const config = loadConfig();
  const { windowBounds } = config;

  const win = new BrowserWindow({
    width: windowBounds.width,
    height: windowBounds.height,
    x: windowBounds.x,
    y: windowBounds.y,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#09090b",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (windowBounds.isMaximized) {
    win.maximize();
  }

  win.loadURL(`http://localhost:${port}`);

  win.once("ready-to-show", () => {
    win.show();
  });

  // Save window bounds on move/resize
  const saveBounds = () => {
    if (!win.isMaximized() && !win.isMinimized()) {
      const bounds = win.getBounds();
      saveConfig({
        windowBounds: {
          ...bounds,
          isMaximized: false,
        },
      });
    }
  };

  win.on("resize", saveBounds);
  win.on("move", saveBounds);
  win.on("maximize", () => {
    saveConfig({ windowBounds: { ...loadConfig().windowBounds, isMaximized: true } });
  });
  win.on("unmaximize", () => {
    saveConfig({ windowBounds: { ...loadConfig().windowBounds, isMaximized: false } });
  });

  return win;
}
```

- [ ] **Step 3: Test window state persistence**

```bash
pnpm electron:dev
```

1. Resize the window, move it to a different position
2. Close and relaunch
3. Verify window opens at the same position and size

- [ ] **Step 4: Commit**

```bash
git add electron/config.ts electron/main.ts
git commit -m "feat: persist window position and size between sessions"
```

---

### Task 3: System Tray

**Files:**
- Create: `electron/tray.ts`
- Create: `electron/assets/icon.ico`
- Create: `electron/assets/tray-green.png`
- Create: `electron/assets/tray-amber.png`
- Create: `electron/assets/tray-red.png`
- Modify: `electron/main.ts`
- Modify: `electron/config.ts`

- [ ] **Step 1: Create tray icon assets**

For initial development, generate simple 16x16 colored circle PNGs. These can be replaced with proper designed icons later. Copy `public/favicon.ico` to `electron/assets/icon.ico` for the app icon.

```bash
cp public/favicon.ico electron/assets/icon.ico
```

For the tray PNGs, create placeholder files. In production these should be designed 16x16 icons but for now we need files to exist. Use a simple Node script or manually create them. (The engineer should create 16x16 PNG images with green, amber, and red circles on transparent background.)

- [ ] **Step 2: Create electron/tray.ts**

```ts
import { Tray, Menu, nativeImage, app, BrowserWindow } from "electron";
import path from "path";

type TrayStatus = "green" | "amber" | "red";

let tray: Tray | null = null;
let currentStatus: TrayStatus = "green";
let activeTeamCount: number = 0;

function getIconPath(status: TrayStatus): string {
  return path.join(__dirname, "..", "electron", "assets", `tray-${status}.png`);
}

function buildContextMenu(mainWindow: BrowserWindow | null): Menu {
  return Menu.buildFromTemplate([
    {
      label: mainWindow?.isVisible() ? "Hide Window" : "Show Window",
      click: () => {
        if (!mainWindow) return;
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: "separator" },
    {
      label: `Active teams: ${activeTeamCount}`,
      enabled: false,
    },
    { type: "separator" },
    {
      label: "Quit BumbaClaude",
      click: () => {
        app.quit();
      },
    },
  ]);
}

export function createTray(mainWindow: BrowserWindow): Tray {
  const iconPath = getIconPath("green");
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  tray.setToolTip("BumbaClaude - Agent Orchestration");
  tray.setContextMenu(buildContextMenu(mainWindow));

  tray.on("click", () => {
    if (mainWindow.isVisible()) {
      mainWindow.focus();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  return tray;
}

export function updateTrayStatus(status: TrayStatus, teamCount: number, mainWindow: BrowserWindow): void {
  if (!tray) return;
  currentStatus = status;
  activeTeamCount = teamCount;

  const iconPath = getIconPath(status);
  const icon = nativeImage.createFromPath(iconPath);
  tray.setImage(icon);

  const statusLabels: Record<TrayStatus, string> = {
    green: "All agents healthy",
    amber: "Agents waiting for input",
    red: "Agent errors detected",
  };
  tray.setToolTip(`BumbaClaude - ${statusLabels[status]}`);
  tray.setContextMenu(buildContextMenu(mainWindow));
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
```

- [ ] **Step 3: Wire tray into main.ts and implement close-to-tray**

Add imports at the top of `main.ts`:

```ts
import { createTray, destroyTray } from "./tray";
```

In the `bootstrap` function, after creating the main window, add:

```ts
createTray(mainWindow);
```

Add close-to-tray behavior. Replace the `window-all-closed` handler and add a close handler to the main window inside `bootstrap`, after `mainWindow = createMainWindow(port)`:

```ts
mainWindow.on("close", (event) => {
  const config = loadConfig();
  if (config.closeToTray && mainWindow && !app.isQuitting) {
    event.preventDefault();
    mainWindow.hide();
  }
});
```

Add a flag for quit intent. At the top of `main.ts`, add a property on `app`:

```ts
// Extend app with a quitting flag
declare module "electron" {
  interface App {
    isQuitting: boolean;
  }
}
app.isQuitting = false;
```

Update the `before-quit` handler:

```ts
app.on("before-quit", () => {
  app.isQuitting = true;
  stopServer();
});
```

Update `window-all-closed`:

```ts
app.on("window-all-closed", () => {
  // On close-to-tray, windows may all be hidden but app stays alive
  // Only quit if not using close-to-tray
  if (!loadConfig().closeToTray) {
    stopServer();
    app.quit();
  }
});
```

Clean up tray on quit:

```ts
app.on("will-quit", () => {
  destroyTray();
});
```

- [ ] **Step 4: Test system tray**

```bash
pnpm electron:compile && electron .
```

1. App launches with tray icon
2. Close the window -- it hides to tray (close-to-tray is on by default)
3. Click tray icon -- window shows again
4. Right-click tray -- context menu with Show/Hide, team count, Quit
5. Click Quit -- app fully exits

- [ ] **Step 5: Commit**

```bash
git add electron/tray.ts electron/assets/ electron/main.ts
git commit -m "feat: add system tray with close-to-tray behavior"
```

---

### Task 4: Native Notifications

**Files:**
- Create: `electron/notifications.ts`
- Modify: `electron/main.ts`
- Modify: `electron/preload.ts`

- [ ] **Step 1: Create electron/notifications.ts**

```ts
import { Notification, BrowserWindow } from "electron";
import { getConfig } from "./config";

type NotificationType = "agentCompleted" | "agentErrored" | "agentWaiting" | "governanceLimit";

interface NotificationOptions {
  type: NotificationType;
  title: string;
  body: string;
  route?: string; // Route to navigate to when clicked
}

export function sendNotification(
  options: NotificationOptions,
  mainWindow: BrowserWindow | null
): void {
  const config = getConfig();

  // Check if this notification type is enabled
  if (!config.notifications[options.type]) return;

  const notification = new Notification({
    title: options.title,
    body: options.body,
    icon: undefined, // Uses app icon by default on Windows
  });

  notification.on("click", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      if (options.route) {
        mainWindow.webContents.send("navigate", options.route);
      }
    }
  });

  notification.show();
}
```

- [ ] **Step 2: Register notification IPC handler in main.ts**

Add import:

```ts
import { sendNotification } from "./notifications";
```

Inside `registerIpcHandlers`, add:

```ts
ipcMain.handle("notification:send", (_event, title: string, body: string, route?: string) => {
  sendNotification(
    { type: "agentCompleted", title, body, route },
    mainWindow
  );
});
```

- [ ] **Step 3: Test notifications**

```bash
pnpm electron:compile && electron .
```

Open DevTools in the Electron window (Ctrl+Shift+I) and run:

```js
window.electronAPI.sendNotification("Test", "This is a test notification", "/")
```

Expected: Windows toast notification appears. Clicking it focuses the app.

- [ ] **Step 4: Commit**

```bash
git add electron/notifications.ts electron/main.ts
git commit -m "feat: add native Windows toast notifications with click-to-navigate"
```

---

### Task 5: Client-Side Electron Integration Hook

**Files:**
- Create: `src/hooks/useElectron.ts`
- Create: `src/components/shared/NativeFilePicker.tsx`

- [ ] **Step 1: Create src/hooks/useElectron.ts**

This hook detects whether the app is running inside Electron and provides access to native APIs.

```ts
"use client";

import { useCallback, useEffect, useState } from "react";

interface ElectronAPI {
  isElectron: boolean;
  selectDirectory: () => Promise<string | null>;
  sendNotification: (title: string, body: string, route?: string) => Promise<void>;
  getVersion: () => Promise<string>;
  onNavigate: (callback: (route: string) => void) => () => void;
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

  return {
    isElectron,
    selectDirectory,
    sendNotification,
  };
}
```

- [ ] **Step 2: Create src/components/shared/NativeFilePicker.tsx**

A wrapper component that uses the native OS folder picker in Electron and falls back to a text input in the browser.

```tsx
"use client";

import { useState } from "react";
import { useElectron } from "@/hooks/useElectron";

interface NativeFilePickerProps {
  value: string;
  onChange: (path: string) => void;
  placeholder?: string;
  className?: string;
}

export default function NativeFilePicker({
  value,
  onChange,
  placeholder = "/path/to/project",
  className = "",
}: NativeFilePickerProps) {
  const { isElectron, selectDirectory } = useElectron();
  const [isSelecting, setIsSelecting] = useState(false);

  const handleBrowse = async () => {
    setIsSelecting(true);
    try {
      const selected = await selectDirectory();
      if (selected) {
        onChange(selected);
      }
    } finally {
      setIsSelecting(false);
    }
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm font-mono text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
      />
      {isElectron && (
        <button
          type="button"
          onClick={handleBrowse}
          disabled={isSelecting}
          className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-sm font-mono rounded transition-colors disabled:opacity-50"
        >
          {isSelecting ? "..." : "Browse"}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify the components work in browser mode**

```bash
pnpm dev
```

Open http://localhost:3000 in a browser. The `useElectron` hook should report `isElectron: false`. The `NativeFilePicker` should render as a plain text input without a Browse button.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useElectron.ts src/components/shared/NativeFilePicker.tsx
git commit -m "feat: add useElectron hook and NativeFilePicker component"
```

---

### Task 6: Auto-Update

**Files:**
- Create: `electron/updater.ts`
- Modify: `electron/main.ts`
- Modify: `electron/preload.ts`

- [ ] **Step 1: Install electron-updater**

```bash
pnpm add electron-updater
```

- [ ] **Step 2: Create electron/updater.ts**

```ts
import { autoUpdater } from "electron-updater";
import { BrowserWindow } from "electron";

let mainWindow: BrowserWindow | null = null;

export function initAutoUpdater(win: BrowserWindow): void {
  mainWindow = win;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("update:available", {
        version: info.version,
        releaseNotes: info.releaseNotes,
      });
    }
  });

  autoUpdater.on("download-progress", (progress) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("update:progress", {
        percent: progress.percent,
      });
    }
  });

  autoUpdater.on("update-downloaded", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("update:downloaded");
    }
  });

  autoUpdater.on("error", (err) => {
    console.error("Auto-updater error:", err);
  });

  // Check for updates on startup
  autoUpdater.checkForUpdates().catch((err) => {
    console.error("Update check failed:", err);
  });
}

export function downloadUpdate(): void {
  autoUpdater.downloadUpdate().catch((err) => {
    console.error("Download update failed:", err);
  });
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall(false, true);
}
```

- [ ] **Step 3: Add update IPC to preload.ts**

Add these methods to the `contextBridge.exposeInMainWorld` call in `preload.ts`:

```ts
// Auto-update
downloadUpdate: (): Promise<void> =>
  ipcRenderer.invoke("update:download"),
installUpdate: (): Promise<void> =>
  ipcRenderer.invoke("update:install"),
onUpdateAvailable: (callback: (info: { version: string }) => void): (() => void) => {
  const handler = (_event: Electron.IpcRendererEvent, info: { version: string }) => callback(info);
  ipcRenderer.on("update:available", handler);
  return () => ipcRenderer.removeListener("update:available", handler);
},
onUpdateProgress: (callback: (progress: { percent: number }) => void): (() => void) => {
  const handler = (_event: Electron.IpcRendererEvent, progress: { percent: number }) => callback(progress);
  ipcRenderer.on("update:progress", handler);
  return () => ipcRenderer.removeListener("update:progress", handler);
},
onUpdateDownloaded: (callback: () => void): (() => void) => {
  const handler = () => callback();
  ipcRenderer.on("update:downloaded", handler);
  return () => ipcRenderer.removeListener("update:downloaded", handler);
},
```

- [ ] **Step 4: Register update IPC handlers in main.ts**

Add import:

```ts
import { initAutoUpdater, downloadUpdate, installUpdate } from "./updater";
```

In `registerIpcHandlers`:

```ts
ipcMain.handle("update:download", () => {
  downloadUpdate();
});

ipcMain.handle("update:install", () => {
  installUpdate();
});
```

In `bootstrap`, after creating the main window:

```ts
initAutoUpdater(mainWindow);
```

- [ ] **Step 5: Commit**

```bash
git add electron/updater.ts electron/main.ts electron/preload.ts
pnpm add electron-updater
git commit -m "feat: add auto-update support via electron-updater and GitHub Releases"
```

---

### Task 7: Development Workflow (Hot Reload)

**Files:**
- Modify: `package.json`
- Modify: `electron/server.ts`

- [ ] **Step 1: Install concurrently and wait-on**

```bash
pnpm add -D concurrently wait-on
```

- [ ] **Step 2: Add dev mode to electron/server.ts**

Add a function that connects to an already-running Next.js dev server instead of spawning standalone:

```ts
export async function connectToDevServer(port: number): Promise<number> {
  serverPort = port;
  await waitForServer(port);
  return port;
}
```

- [ ] **Step 3: Update electron/main.ts for dev mode**

In the `bootstrap` function, detect dev mode and connect to the existing dev server instead of starting standalone:

Replace the server start logic in `bootstrap`:

```ts
const isDev = !app.isPackaged;
let port: number;

if (isDev) {
  // In dev mode, connect to the Next.js dev server (started by concurrently)
  const devPort = parseInt(process.env.NEXT_DEV_PORT || "3000");
  const { connectToDevServer } = await import("./server");
  port = await connectToDevServer(devPort);
} else {
  const appPath = getAppPath();
  port = await startServer(appPath);
}
```

Also add to the import at the top (keep the existing `startServer` import for production):

```ts
import { startServer, stopServer, isServerRunning, onServerExit, connectToDevServer } from "./server";
```

- [ ] **Step 4: Update package.json scripts**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "electron:compile": "tsc -p electron.tsconfig.json",
    "electron:dev": "concurrently -k \"next dev\" \"wait-on http://localhost:3000 && pnpm electron:compile && electron .\"",
    "electron:build": "pnpm build && pnpm electron:compile && electron-builder --win",
    "electron:preview": "pnpm build && pnpm electron:compile && electron ."
  }
}
```

- [ ] **Step 5: Test dev workflow**

```bash
pnpm electron:dev
```

Expected: Next.js dev server starts, then Electron opens pointing to it. Changes to `src/` files trigger hot reload in the Electron window.

- [ ] **Step 6: Commit**

```bash
git add package.json electron/server.ts electron/main.ts
git commit -m "feat: add electron:dev script with hot reload via concurrently"
```

---

### Task 8: Global Shortcuts

**Files:**
- Modify: `electron/main.ts`
- Modify: `electron/config.ts`

- [ ] **Step 1: Register global shortcut in main.ts**

Add import:

```ts
import { globalShortcut } from "electron";
```

In `bootstrap`, after creating the tray, register the global shortcut:

```ts
const config = loadConfig();
const shortcut = config.globalShortcut || "Ctrl+Shift+B";

const registered = globalShortcut.register(shortcut, () => {
  if (!mainWindow) return;
  if (mainWindow.isVisible() && mainWindow.isFocused()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
});

if (!registered) {
  console.error(`Failed to register global shortcut: ${shortcut}`);
}
```

Unregister on quit. Add to the `will-quit` handler:

```ts
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  destroyTray();
});
```

- [ ] **Step 2: Test global shortcut**

```bash
pnpm electron:compile && electron .
```

1. Press Ctrl+Shift+B -- window should show/hide
2. When the window is hidden, Ctrl+Shift+B should bring it back

- [ ] **Step 3: Commit**

```bash
git add electron/main.ts
git commit -m "feat: add global keyboard shortcut to toggle window visibility"
```

---

### Task 9: Graceful Shutdown with Agent Warning

**Files:**
- Modify: `electron/main.ts`

- [ ] **Step 1: Add quit confirmation when agents are running**

The app should check if agents are active before quitting. Add a quit handler that queries the app's API for active agents. In `main.ts`, modify the `before-quit` handler:

```ts
let forceQuit = false;

app.on("before-quit", async (event) => {
  if (forceQuit) {
    stopServer();
    return;
  }

  event.preventDefault();

  try {
    const port = getServerPort();
    const response = await fetch(`http://localhost:${port}/api/teams`);
    const teams = await response.json();

    const activeTeams = Array.isArray(teams)
      ? teams.filter((t: { status: string }) => t.status === "running" || t.status === "active")
      : [];

    if (activeTeams.length > 0) {
      const { response: buttonIndex } = await dialog.showMessageBox(mainWindow!, {
        type: "question",
        buttons: ["Cancel", "Quit Anyway"],
        defaultId: 0,
        cancelId: 0,
        title: "Agents Still Running",
        message: `${activeTeams.length} team(s) have active agents. Quit anyway?\n\nAgents will keep running in their tmux sessions.`,
      });

      if (buttonIndex === 0) return; // User cancelled
    }
  } catch {
    // If we can't reach the server, just quit
  }

  forceQuit = true;
  app.quit();
});
```

Remove the old `before-quit` handler that just called `stopServer()`.

Also update the `app.isQuitting` flag approach. Replace the `declare module` extension with the `forceQuit` variable (already added above). Update the close handler on the main window:

```ts
mainWindow.on("close", (event) => {
  const config = loadConfig();
  if (config.closeToTray && !forceQuit) {
    event.preventDefault();
    mainWindow!.hide();
  }
});
```

- [ ] **Step 2: Test graceful shutdown**

```bash
pnpm electron:compile && electron .
```

1. With no agents running, Quit from tray -- should exit immediately
2. With agents running (or mock the API to return active teams), Quit from tray -- should show confirmation dialog

- [ ] **Step 3: Commit**

```bash
git add electron/main.ts
git commit -m "feat: warn before quitting when agents are still running"
```

---

### Task 10: Electron Builder Configuration and Installer

**Files:**
- Create: `electron-builder.config.js`
- Modify: `package.json`

- [ ] **Step 1: Create electron-builder.config.js**

```js
/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: "com.bumbaclaude.app",
  productName: "BumbaClaude",
  copyright: "Copyright 2026 Thomas Wright",

  directories: {
    output: "release",
    buildResources: "electron/assets",
  },

  files: [
    "dist-electron/**/*",
    "electron/splash.html",
    "electron/assets/**/*",
    ".next/standalone/**/*",
    ".next/static/**/*",
    "public/**/*",
    "db/**/*",
  ],

  extraResources: [
    {
      from: ".next/standalone",
      to: "app/.next/standalone",
      filter: ["**/*"],
    },
    {
      from: ".next/static",
      to: "app/.next/static",
      filter: ["**/*"],
    },
    {
      from: "public",
      to: "app/public",
      filter: ["**/*"],
    },
    {
      from: "db",
      to: "app/db",
      filter: ["**/*"],
    },
  ],

  win: {
    target: [
      {
        target: "nsis",
        arch: ["x64"],
      },
      {
        target: "zip",
        arch: ["x64"],
      },
    ],
    icon: "electron/assets/icon.ico",
  },

  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopIcon: true,
    createStartMenuShortcut: true,
    shortcutName: "BumbaClaude",
    installerIcon: "electron/assets/icon.ico",
    uninstallerIcon: "electron/assets/icon.ico",
  },

  publish: {
    provider: "github",
    owner: "twamp22",
    repo: "BumbaClaude",
    releaseType: "release",
  },
};
```

- [ ] **Step 2: Add build config reference to package.json**

Add to the top level of `package.json`:

```json
{
  "build": "electron-builder.config.js"
}
```

Note: The `"build"` key here tells electron-builder where to find its config. It does not conflict with the `scripts.build` entry.

- [ ] **Step 3: Test the build**

```bash
pnpm electron:build
```

Expected: Creates `release/` directory with:
- `BumbaClaude Setup X.X.X.exe` (NSIS installer)
- `BumbaClaude-X.X.X-win.zip` (portable)

- [ ] **Step 4: Test the installer**

Run the generated `.exe` installer. Verify:
1. Installation wizard allows choosing directory
2. Start menu shortcut is created
3. App launches from Start menu
4. App shows the BumbaClaude dashboard

- [ ] **Step 5: Commit**

```bash
git add electron-builder.config.js package.json
git commit -m "feat: add electron-builder config for Windows NSIS installer and portable zip"
```

---

### Task 11: Launch on Startup

**Files:**
- Modify: `electron/main.ts`
- Modify: `electron/preload.ts`

- [ ] **Step 1: Add launch-on-startup toggle in main.ts**

In `registerIpcHandlers`, add:

```ts
ipcMain.handle("app:setLoginItemSettings", (_event, openAtLogin: boolean) => {
  app.setLoginItemSettings({
    openAtLogin,
    openAsHidden: true, // Start minimized to tray
  });
  saveConfig({ launchOnStartup: openAtLogin });
});

ipcMain.handle("app:getLoginItemSettings", () => {
  return app.getLoginItemSettings();
});
```

- [ ] **Step 2: Add to preload.ts**

Add to the `electronAPI` object:

```ts
setOpenAtLogin: (enabled: boolean): Promise<void> =>
  ipcRenderer.invoke("app:setLoginItemSettings", enabled),
getOpenAtLogin: (): Promise<{ openAtLogin: boolean }> =>
  ipcRenderer.invoke("app:getLoginItemSettings"),
```

- [ ] **Step 3: Apply saved startup setting on launch**

In `bootstrap`, after `registerIpcHandlers()`:

```ts
const config = loadConfig();
if (config.launchOnStartup) {
  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: true,
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add electron/main.ts electron/preload.ts
git commit -m "feat: add launch-on-Windows-startup support"
```

---

### Task 12: Add .gitignore Entries and Final Cleanup

**Files:**
- Modify: `.gitignore`
- Modify: `package.json`

- [ ] **Step 1: Add Electron build artifacts to .gitignore**

Append to `.gitignore`:

```
# Electron
dist-electron/
release/
```

- [ ] **Step 2: Verify all scripts work end-to-end**

Run each command and verify:

```bash
# Browser-only dev (should still work unchanged)
pnpm dev

# Electron dev with hot reload
pnpm electron:dev

# Production build + Electron package
pnpm electron:build
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: add Electron build artifacts to gitignore"
```

---

## Summary

| Task | Description | Depends On |
|------|-------------|-----------|
| 1 | Project setup and Electron scaffolding | - |
| 2 | Window state persistence | 1 |
| 3 | System tray | 1 |
| 4 | Native notifications | 1 |
| 5 | Client-side Electron integration hook | 1 |
| 6 | Auto-update | 1 |
| 7 | Development workflow (hot reload) | 1 |
| 8 | Global shortcuts | 2 |
| 9 | Graceful shutdown with agent warning | 3 |
| 10 | Electron builder config and installer | 1 |
| 11 | Launch on startup | 2 |
| 12 | Gitignore and final cleanup | All |

Tasks 2-7 can be worked on in parallel after Task 1. Tasks 8-11 have light dependencies. Task 12 is last.
