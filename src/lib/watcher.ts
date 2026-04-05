import { watch } from "chokidar";
import { EventEmitter } from "events";
import path from "path";
import fs from "fs";
import os from "os";
import { createAuditEvent } from "./db";
import { broadcast } from "./websocket";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const activeWatchers = new Map<string, ReturnType<typeof watch>>();

export interface WatcherEvent {
  type: string;
  path: string;
  teamName: string;
  data?: Record<string, unknown>;
}

export const watcherEmitter = new EventEmitter();

function parseJsonFile(filePath: string): Record<string, unknown> | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function handleFileChange(teamName: string, teamId: string, filePath: string, eventType: string) {
  const relative = path.relative(CLAUDE_DIR, filePath);
  const ext = path.extname(filePath);

  let auditType = "file_changed";
  let eventData: Record<string, unknown> = { path: relative, change: eventType };

  // Mailbox messages
  if (relative.includes("mailbox") && ext === ".json") {
    auditType = "mailbox_message";
    const data = parseJsonFile(filePath);
    if (data) {
      eventData = { ...eventData, ...data };
    }
  }

  // Task files
  if (relative.includes("tasks")) {
    if (ext === ".lock") {
      auditType = "task_claimed";
    } else if (ext === ".pending") {
      auditType = "task_pending";
    } else if (ext === ".json") {
      auditType = "task_updated";
      const data = parseJsonFile(filePath);
      if (data) {
        eventData = { ...eventData, ...data };
      }
    }
  }

  // Config changes
  if (relative.includes("config.json")) {
    auditType = "config_changed";
    const data = parseJsonFile(filePath);
    if (data) {
      eventData = { ...eventData, ...data };
    }
  }

  createAuditEvent({
    team_id: teamId,
    event_type: auditType,
    event_data: JSON.stringify(eventData),
  });

  broadcast(teamId, {
    type: auditType,
    data: eventData,
  });

  watcherEmitter.emit("event", {
    type: auditType,
    path: filePath,
    teamName,
    data: eventData,
  });
}

export function startWatching(teamName: string, teamId: string): void {
  if (activeWatchers.has(teamName)) return;

  const teamDir = path.join(CLAUDE_DIR, "teams", teamName);
  const tasksDir = path.join(CLAUDE_DIR, "tasks", teamName);

  const watchPaths: string[] = [];
  if (fs.existsSync(teamDir)) watchPaths.push(teamDir);
  if (fs.existsSync(tasksDir)) watchPaths.push(tasksDir);

  if (watchPaths.length === 0) {
    // Directories don't exist yet; watch parent dirs for creation
    const teamsParent = path.join(CLAUDE_DIR, "teams");
    const tasksParent = path.join(CLAUDE_DIR, "tasks");
    if (fs.existsSync(teamsParent)) watchPaths.push(path.join(teamsParent, teamName, "**"));
    if (fs.existsSync(tasksParent)) watchPaths.push(path.join(tasksParent, teamName, "**"));

    if (watchPaths.length === 0) return;
  }

  const watcher = watch(watchPaths, {
    persistent: true,
    ignoreInitial: false,
    depth: 3,
  });

  watcher.on("add", (filePath) => handleFileChange(teamName, teamId, filePath, "add"));
  watcher.on("change", (filePath) => handleFileChange(teamName, teamId, filePath, "change"));
  watcher.on("unlink", (filePath) => handleFileChange(teamName, teamId, filePath, "unlink"));

  activeWatchers.set(teamName, watcher);
  console.error(`[watcher] Started watching ${teamName}`);
}

export function stopWatching(teamName: string): void {
  const watcher = activeWatchers.get(teamName);
  if (watcher) {
    watcher.close();
    activeWatchers.delete(teamName);
    console.error(`[watcher] Stopped watching ${teamName}`);
  }
}

export function stopAll(): void {
  for (const [name] of activeWatchers) {
    stopWatching(name);
  }
}

export function getWatchedTeams(): string[] {
  return Array.from(activeWatchers.keys());
}
