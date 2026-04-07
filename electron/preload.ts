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

  // Launch on startup
  setOpenAtLogin: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke("app:setLoginItemSettings", enabled),
  getOpenAtLogin: (): Promise<{ openAtLogin: boolean }> =>
    ipcRenderer.invoke("app:getLoginItemSettings"),
});
