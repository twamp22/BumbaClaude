import { Notification, BrowserWindow } from "electron";
import { getConfig } from "./config";

type NotificationType = "agentCompleted" | "agentErrored" | "agentWaiting" | "governanceLimit";

interface NotificationOptions {
  type: NotificationType;
  title: string;
  body: string;
  route?: string;
}

export function sendNotification(
  options: NotificationOptions,
  mainWindow: BrowserWindow | null
): void {
  const config = getConfig();

  if (!config.notifications[options.type]) return;

  const notification = new Notification({
    title: options.title,
    body: options.body,
    icon: undefined,
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
