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
      const parsed = JSON.parse(raw);
      const merged: AppConfig = {
        ...DEFAULT_CONFIG,
        ...parsed,
        windowBounds: { ...DEFAULT_CONFIG.windowBounds, ...parsed.windowBounds },
        notifications: { ...DEFAULT_CONFIG.notifications, ...parsed.notifications },
      };
      cachedConfig = merged;
      return merged;
    }
  } catch (err) {
    console.error("Failed to load config, using defaults:", err);
  }
  cachedConfig = { ...DEFAULT_CONFIG };
  return cachedConfig;
}

export function saveConfig(config: Partial<AppConfig>): void {
  const current = loadConfig();
  const merged: AppConfig = {
    ...current,
    ...config,
    windowBounds: config.windowBounds
      ? { ...current.windowBounds, ...config.windowBounds }
      : current.windowBounds,
    notifications: config.notifications
      ? { ...current.notifications, ...config.notifications }
      : current.notifications,
  };
  cachedConfig = merged;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), "utf-8");
}

export function getConfig(): AppConfig {
  return loadConfig();
}
