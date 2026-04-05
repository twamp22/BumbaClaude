import { execSync, exec, spawn, ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import type { TmuxSession } from "./types";

const IS_WINDOWS = os.platform() === "win32";
const LOG_DIR = path.join(process.cwd(), "data", "agent-logs");

function findClaude(): string {
  // Try common locations on Windows
  if (IS_WINDOWS) {
    const candidates = [
      path.join(os.homedir(), ".local", "bin", "claude.exe"),
      path.join(os.homedir(), ".local", "bin", "claude"),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  // Fall back to bare command (works if in PATH on Unix)
  return "claude";
}

// Track spawned processes on Windows
const activeProcesses = new Map<
  string,
  { process: ChildProcess; logFile: string; inputQueue: string[] }
>();

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

// --- tmux helpers (Linux/macOS) ---

function run(command: string): string {
  return execSync(command, { encoding: "utf-8", timeout: 10000 }).trim();
}

function runAsync(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(command, { encoding: "utf-8", timeout: 10000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`tmux command failed: ${error.message}\nstderr: ${stderr}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

/**
 * Check if tmux is available on the system.
 */
export function isTmuxAvailable(): boolean {
  if (IS_WINDOWS) return false;
  try {
    run("tmux -V");
    return true;
  } catch {
    return false;
  }
}

/**
 * Spawn a new Claude Code session.
 * Uses tmux on Linux/macOS, direct child_process on Windows.
 */
export async function spawnAgent(config: {
  sessionName: string;
  workingDir: string;
  agentArgs: string;
  model?: string;
}): Promise<{ sessionId: string; paneId: string }> {
  const { sessionName, workingDir, agentArgs } = config;

  if (!IS_WINDOWS && isTmuxAvailable()) {
    return spawnAgentTmux(config);
  }

  return spawnAgentProcess(sessionName, workingDir, agentArgs, config.model);
}

async function spawnAgentTmux(config: {
  sessionName: string;
  workingDir: string;
  agentArgs: string;
  model?: string;
}): Promise<{ sessionId: string; paneId: string }> {
  const { sessionName, workingDir, agentArgs } = config;

  await runAsync(`tmux new-session -d -s "${sessionName}" -c "${workingDir}"`);

  let claudeCmd = `claude ${agentArgs}`;
  if (config.model) {
    claudeCmd += ` --model ${config.model}`;
  }

  await runAsync(`tmux send-keys -t "${sessionName}" '${claudeCmd}' Enter`);

  return {
    sessionId: sessionName,
    paneId: `${sessionName}:0`,
  };
}

async function spawnAgentProcess(
  sessionName: string,
  workingDir: string,
  agentArgs: string,
  model?: string
): Promise<{ sessionId: string; paneId: string }> {
  ensureLogDir();

  const logFile = path.join(LOG_DIR, `${sessionName}.log`);
  fs.writeFileSync(logFile, "");

  const args: string[] = [];
  if (agentArgs.trim()) {
    // Parse args string into array, respecting quotes
    const parsed = agentArgs.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    args.push(...parsed.map((a) => a.replace(/^"|"$/g, "")));
  }
  if (model) {
    args.push("--model", model);
  }

  const claudePath = findClaude();
  const child = spawn(claudePath, args, {
    cwd: workingDir,
    stdio: ["pipe", "pipe", "pipe"],
    shell: false,
    detached: false,
    env: { ...process.env },
  });

  const logStream = fs.createWriteStream(logFile, { flags: "a" });

  child.stdout?.on("data", (data: Buffer) => {
    logStream.write(data);
  });

  child.stderr?.on("data", (data: Buffer) => {
    logStream.write(data);
  });

  child.on("error", (err) => {
    logStream.write(`\n[PROCESS ERROR] ${err.message}\n`);
  });

  child.on("exit", (code) => {
    logStream.write(`\n[PROCESS EXITED] code=${code}\n`);
    logStream.end();
    activeProcesses.delete(sessionName);
  });

  activeProcesses.set(sessionName, { process: child, logFile, inputQueue: [] });

  return {
    sessionId: sessionName,
    paneId: sessionName,
  };
}

/**
 * Capture last N lines of output from an agent.
 */
export async function captureOutput(paneId: string, lines: number = 50): Promise<string> {
  if (!IS_WINDOWS && isTmuxAvailable()) {
    return runAsync(`tmux capture-pane -t "${paneId}" -p -S -${lines}`);
  }

  // Windows: read from log file
  const entry = activeProcesses.get(paneId);
  if (!entry) {
    // Try reading the log file directly in case process ended
    const logFile = path.join(LOG_DIR, `${paneId}.log`);
    if (fs.existsSync(logFile)) {
      return tailFile(logFile, lines);
    }
    return "";
  }

  return tailFile(entry.logFile, lines);
}

function tailFile(filePath: string, lines: number): string {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const allLines = content.split("\n");
    return allLines.slice(-lines).join("\n");
  } catch {
    return "";
  }
}

/**
 * Send text input to an agent.
 */
export async function sendInput(paneId: string, text: string): Promise<void> {
  if (!IS_WINDOWS && isTmuxAvailable()) {
    const escaped = text.replace(/'/g, "'\\''");
    await runAsync(`tmux send-keys -t "${paneId}" '${escaped}' Enter`);
    return;
  }

  const entry = activeProcesses.get(paneId);
  if (!entry || !entry.process.stdin?.writable) {
    throw new Error(`No active process for session ${paneId}`);
  }

  entry.process.stdin.write(text + "\n");
}

/**
 * Send interrupt (Ctrl+C) to an agent.
 */
export async function interrupt(paneId: string): Promise<void> {
  if (!IS_WINDOWS && isTmuxAvailable()) {
    await runAsync(`tmux send-keys -t "${paneId}" C-c`);
    return;
  }

  const entry = activeProcesses.get(paneId);
  if (!entry) return;

  // Send SIGINT on Unix, or write Ctrl+C character on Windows
  if (IS_WINDOWS) {
    entry.process.stdin?.write("\x03");
  } else {
    entry.process.kill("SIGINT");
  }
}

/**
 * Kill an agent's process/pane.
 */
export async function killPane(paneId: string): Promise<void> {
  if (!IS_WINDOWS && isTmuxAvailable()) {
    await runAsync(`tmux kill-pane -t "${paneId}"`);
    return;
  }

  const entry = activeProcesses.get(paneId);
  if (!entry) return;

  entry.process.kill();
  activeProcesses.delete(paneId);
}

/**
 * Kill an entire session.
 */
export async function killSession(sessionName: string): Promise<void> {
  if (!IS_WINDOWS && isTmuxAvailable()) {
    await runAsync(`tmux kill-session -t "${sessionName}"`);
    return;
  }

  await killPane(sessionName);
}

/**
 * List all active sessions.
 */
export async function listSessions(): Promise<TmuxSession[]> {
  if (!IS_WINDOWS && isTmuxAvailable()) {
    try {
      const output = await runAsync(
        "tmux list-panes -a -F '#{session_name}:#{pane_index} #{pane_current_command} #{pane_pid}'"
      );
      if (!output) return [];
      return output.split("\n").map((line) => {
        const parts = line.split(" ");
        const [sessionName, paneIndex] = parts[0].split(":");
        return {
          sessionName,
          paneIndex,
          currentCommand: parts[1] || "",
          pid: parts[2] || "",
        };
      });
    } catch {
      return [];
    }
  }

  // Windows: list active processes
  return Array.from(activeProcesses.entries()).map(([name, entry]) => ({
    sessionName: name,
    paneIndex: "0",
    currentCommand: "claude",
    pid: String(entry.process.pid || ""),
  }));
}

/**
 * Check if a specific session exists.
 */
export async function sessionExists(sessionName: string): Promise<boolean> {
  if (!IS_WINDOWS && isTmuxAvailable()) {
    try {
      await runAsync(`tmux has-session -t "${sessionName}"`);
      return true;
    } catch {
      return false;
    }
  }

  return activeProcesses.has(sessionName);
}

/**
 * Check if a process is still running.
 */
export function isProcessAlive(sessionName: string): boolean {
  const entry = activeProcesses.get(sessionName);
  if (!entry) return false;
  return !entry.process.killed && entry.process.exitCode === null;
}
