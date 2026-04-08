import { autoUpdater } from "electron-updater";
import { app, BrowserWindow } from "electron";
import path from "path";
import fs from "fs";

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
    cleanUpdaterCache();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("update:downloaded");
    }
  });

  autoUpdater.on("error", (err) => {
    console.error("Auto-updater error:", err);
  });

  autoUpdater.checkForUpdates().catch((err) => {
    console.error("Update check failed:", err);
  });

  // Check for updates every 4 hours
  const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
  setInterval(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error("Periodic update check failed:", err);
    });
  }, UPDATE_CHECK_INTERVAL_MS);
}

export function downloadUpdate(): void {
  autoUpdater.downloadUpdate().catch((err) => {
    console.error("Download update failed:", err);
  });
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall(false, true);
}

function cleanUpdaterCache(): void {
  try {
    const cacheDir = path.join(app.getPath("userData"), "..", "bumba-claude-updater");
    if (fs.existsSync(cacheDir)) {
      const entries = fs.readdirSync(cacheDir);
      for (const entry of entries) {
        // Keep the pending installer, remove old downloads
        if (entry === "installer.exe") continue;
        const fullPath = path.join(cacheDir, entry);
        fs.rmSync(fullPath, { recursive: true, force: true });
      }
      console.log("Cleaned updater cache");
    }
  } catch (err) {
    console.error("Failed to clean updater cache:", err);
  }
}
