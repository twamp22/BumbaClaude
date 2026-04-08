import { app, BrowserWindow, ipcMain, dialog, globalShortcut, Menu } from "electron";
import path from "path";
import { startServer, stopServer, onServerExit, connectToDevServer, getServerPort, restartServer } from "./server";
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

function getStandaloneDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "standalone");
  }
  return path.join(__dirname, "..", ".next", "standalone");
}

function getAppPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath);
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
    frame: false,
    titleBarStyle: "hidden",
    backgroundColor: "#09090b",
    icon: path.join(__dirname, "assets", "icon.ico"),
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
    win.webContents.send("window:maximizeChanged", true);
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
    win.webContents.send("window:maximizeChanged", false);
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

  // Window controls
  ipcMain.handle("window:minimize", () => {
    mainWindow?.minimize();
  });

  ipcMain.handle("window:maximize", () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.handle("window:close", () => {
    mainWindow?.close();
  });

  ipcMain.handle("window:isMaximized", () => {
    return mainWindow?.isMaximized() ?? false;
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
      const standaloneDir = getStandaloneDir();
      port = await startServer(standaloneDir);
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
              const standaloneDir = getStandaloneDir();
              const newPort = await restartServer(standaloneDir);
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
  Menu.setApplicationMenu(null);
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
