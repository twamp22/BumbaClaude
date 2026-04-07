import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";
import { startServer, stopServer, onServerExit, connectToDevServer } from "./server";

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
  stopServer();
  app.quit();
});

app.on("before-quit", () => {
  stopServer();
});
