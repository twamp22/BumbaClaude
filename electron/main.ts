import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";
import { startServer, stopServer, onServerExit, connectToDevServer } from "./server";
import { loadConfig, saveConfig } from "./config";
import { createTray, destroyTray } from "./tray";

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

  // Persist window bounds on changes
  const saveBounds = (): void => {
    if (win.isMaximized()) return;
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
    stopServer();
    app.quit();
  }
});

app.on("before-quit", () => {
  forceQuit = true;
  stopServer();
});

app.on("will-quit", () => {
  destroyTray();
});
