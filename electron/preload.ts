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

  // Window controls
  windowMinimize: (): Promise<void> =>
    ipcRenderer.invoke("window:minimize"),
  windowMaximize: (): Promise<void> =>
    ipcRenderer.invoke("window:maximize"),
  windowClose: (): Promise<void> =>
    ipcRenderer.invoke("window:close"),
  windowIsMaximized: (): Promise<boolean> =>
    ipcRenderer.invoke("window:isMaximized"),
  onWindowMaximizeChange: (callback: (isMaximized: boolean) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, isMaximized: boolean) => callback(isMaximized);
    ipcRenderer.on("window:maximizeChanged", handler);
    return () => ipcRenderer.removeListener("window:maximizeChanged", handler);
  },

  // Launch on startup
  setOpenAtLogin: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke("app:setLoginItemSettings", enabled),
  getOpenAtLogin: (): Promise<{ openAtLogin: boolean }> =>
    ipcRenderer.invoke("app:getLoginItemSettings"),
});
