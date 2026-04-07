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
