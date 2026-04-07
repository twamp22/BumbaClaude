import { app, BrowserWindow, ipcMain, dialog, globalShortcut } from "electron";
import path from "path";
import { startServer, stopServer, onServerExit, connectToDevServer, getServerPort } from "./server";
import { loadConfig, saveConfig } from "./config";
import { createTray, destroyTray, updateTrayStatus } from "./tray";
import { sendNotification } from "./notifications";
import { initAutoUpdater, downloadUpdate, installUpdate } from "./updater";

let mainWindow: BrowserWindow | null = null;
let forceQuit = false;

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
    backgroundColor: "#09090b",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  splash.loadFile(path.join(__dirname, "splash.html"));
  return splash;
}

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

  // Persist window bounds on changes (debounced to avoid excessive disk writes)
  let saveBoundsTimer: ReturnType<typeof setTimeout> | null = null;
  const saveBounds = (): void => {
    if (win.isMaximized()) return;
    if (saveBoundsTimer) clearTimeout(saveBoundsTimer);
    saveBoundsTimer = setTimeout(() => {
      const bounds = win.getBounds();
      saveConfig({
        windowBounds: {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          isMaximized: false,
        },
      });
    }, 500);
  };

  win.on("resize", saveBounds);
  win.on("move", saveBounds);

  win.on("maximize", () => {
    saveConfig({
      windowBounds: { ...loadConfig().windowBounds, isMaximized: true },
    });
  });

  win.on("unmaximize", () => {
    const bounds = win.getBounds();
    saveConfig({
      windowBounds: {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        isMaximized: false,
      },
    });
  });

  return win;
}

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

  ipcMain.handle("notification:send", (_event, title: string, body: string, route?: string) => {
    sendNotification(
      { type: "agentCompleted", title, body, route },
      mainWindow
    );
  });

  // Auto-update
  ipcMain.handle("update:download", () => {
    downloadUpdate();
  });

  ipcMain.handle("update:install", () => {
    installUpdate();
  });

  // Launch on startup
  ipcMain.handle("app:setLoginItemSettings", (_event, openAtLogin: boolean) => {
    app.setLoginItemSettings({
      openAtLogin,
      openAsHidden: true,
    });
    saveConfig({ launchOnStartup: openAtLogin });
  });

  ipcMain.handle("app:getLoginItemSettings", () => {
    return app.getLoginItemSettings();
  });
}

async function bootstrap(): Promise<void> {
  const splash = createSplashWindow();

  try {
    const isDev = !app.isPackaged;
    let port: number;

    if (isDev) {
      const devPort = parseInt(process.env.NEXT_DEV_PORT || "3000");
      port = await connectToDevServer(devPort);
    } else {
      const appPath = getAppPath();
      port = await startServer(appPath);
    }

    mainWindow = createMainWindow(port);
    createTray(mainWindow);
    initAutoUpdater(mainWindow);

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

    // Global shortcut to toggle window visibility
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

    // Apply launch-on-startup setting
    const startupConfig = loadConfig();
    if (startupConfig.launchOnStartup) {
      app.setLoginItemSettings({
        openAtLogin: true,
        openAsHidden: true,
      });
    }

    mainWindow.on("close", (event) => {
      const config = loadConfig();
      if (config.closeToTray && !forceQuit) {
        event.preventDefault();
        mainWindow!.hide();
      }
    });

    mainWindow.once("ready-to-show", () => {
      splash.destroy();
    });

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
  if (!loadConfig().closeToTray) {
    app.quit();
  }
});

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

      if (buttonIndex === 0) return;
    }
  } catch {
    // If we can't reach the server, just quit
  }

  forceQuit = true;
  app.quit();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  destroyTray();
});
