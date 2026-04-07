import { Tray, Menu, nativeImage, app, BrowserWindow } from "electron";
import path from "path";

type TrayStatus = "green" | "amber" | "red";

let tray: Tray | null = null;
let currentStatus: TrayStatus = "green";
let activeTeamCount: number = 0;

function getIconPath(status: TrayStatus): string {
  return path.join(__dirname, "assets", `tray-${status}.png`);
}

function buildContextMenu(mainWindow: BrowserWindow | null): Menu {
  return Menu.buildFromTemplate([
    {
      label: mainWindow?.isVisible() ? "Hide Window" : "Show Window",
      click: () => {
        if (!mainWindow) return;
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: "separator" },
    {
      label: `Active teams: ${activeTeamCount}`,
      enabled: false,
    },
    { type: "separator" },
    {
      label: "Quit BumbaClaude",
      click: () => {
        app.quit();
      },
    },
  ]);
}

export function createTray(mainWindow: BrowserWindow): Tray {
  const iconPath = getIconPath("green");
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  tray.setToolTip("BumbaClaude - Agent Orchestration");
  tray.setContextMenu(buildContextMenu(mainWindow));

  tray.on("click", () => {
    if (mainWindow.isVisible()) {
      mainWindow.focus();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  return tray;
}

export function updateTrayStatus(status: TrayStatus, teamCount: number, mainWindow: BrowserWindow): void {
  if (!tray) return;
  currentStatus = status;
  activeTeamCount = teamCount;

  const iconPath = getIconPath(status);
  const icon = nativeImage.createFromPath(iconPath);
  tray.setImage(icon);

  const statusLabels: Record<TrayStatus, string> = {
    green: "All agents healthy",
    amber: "Agents waiting for input",
    red: "Agent errors detected",
  };
  tray.setToolTip(`BumbaClaude - ${statusLabels[status]}`);
  tray.setContextMenu(buildContextMenu(mainWindow));
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
