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
  {
    process: ChildProcess;
    logFile: string;
    sessionId: string;
    workingDir: string;
    systemPrompt?: string;
    model?: string;
    onExit?: (code: number | null) => void;
  }
>();

const SESSION_DIR = path.join(process.cwd(), "data", "agent-sessions");

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }
}

interface SessionMeta {
  sessionId: string;
  workingDir: string;
  systemPrompt?: string;
  model?: string;
  logFile: string;
}

function saveSessionMeta(sessionName: string, meta: SessionMeta): void {
  ensureLogDir();
  fs.writeFileSync(
    path.join(SESSION_DIR, `${sessionName}.json`),
    JSON.stringify(meta, null, 2)
  );
}

function loadSessionMeta(sessionName: string): SessionMeta | null {
  const metaPath = path.join(SESSION_DIR, `${sessionName}.json`);
  if (!fs.existsSync(metaPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(metaPath, "utf-8"));
  } catch {
    return null;
  }
}

function deleteSessionMeta(sessionName: string): void {
  const metaPath = path.join(SESSION_DIR, `${sessionName}.json`);
  if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
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

export const MEMORY_DIR = path.join(process.cwd(), "data", "memory");

/**
 * Build the context file for an isolated agent.
 * Combines team instructions + agent role into a single file.
 */
export function buildContextFile(teamId: string, agentName: string, role: string): string {
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }

  const teamDir = path.join(MEMORY_DIR, teamId);
  if (!fs.existsSync(teamDir)) {
    fs.mkdirSync(teamDir, { recursive: true });
  }

  // Load team-level custom instructions if they exist
  const teamInstructionsPath = path.join(teamDir, "instructions.md");
  const teamInstructions = fs.existsSync(teamInstructionsPath)
    ? fs.readFileSync(teamInstructionsPath, "utf-8")
    : "";

  // Load agent-specific memory if it exists
  const agentSlug = agentName.toLowerCase().replace(/\s+/g, "-");
  const agentMemoryPath = path.join(teamDir, `agent-${agentSlug}.md`);
  const agentMemory = fs.existsSync(agentMemoryPath)
    ? fs.readFileSync(agentMemoryPath, "utf-8")
    : "";

  // Compose the context file
  const parts: string[] = [];
  parts.push(`# Agent: ${agentName}`);
  parts.push(`## Role\n${role}`);
  if (teamInstructions) parts.push(`## Team Instructions\n${teamInstructions}`);
  if (agentMemory) parts.push(`## Agent Memory\n${agentMemory}`);

  const contextPath = path.join(teamDir, `context-${agentSlug}.md`);
  fs.writeFileSync(contextPath, parts.join("\n\n"));
  return contextPath;
}

/**
 * Map governance rules to --allowedTools flags.
 */
function buildAllowedTools(governance?: Record<string, string>): string[] {
  const tools: string[] = ["Read", "Glob", "Grep", "WebSearch"];

  const canCreateFiles = governance?.can_create_files !== "false";
  const canRunCommands = governance?.can_run_commands !== "false";
  const canPushGit = governance?.can_push_git !== "false";

  if (canCreateFiles) {
    tools.push("Edit", "Write");
  }
  if (canRunCommands) {
    if (canPushGit) {
      tools.push("Bash");
    } else {
      tools.push("Bash");
      // Note: git push restriction would need disallowedTools pattern
    }
  }

  return tools;
}

/**
 * Spawn a new Claude Code session.
 * Uses tmux on Linux/macOS, direct child_process on Windows.
 */
export async function spawnAgent(config: {
  sessionName: string;
  workingDir: string;
  prompt?: string;
  systemPrompt?: string;
  model?: string;
  isolated?: boolean;
  contextFile?: string;
  governance?: Record<string, string>;
  onExit?: (code: number | null) => void;
}): Promise<{ sessionId: string; paneId: string }> {
  if (!IS_WINDOWS && isTmuxAvailable()) {
    return spawnAgentTmux(config);
  }

  return spawnAgentProcess(config);
}

async function spawnAgentTmux(config: {
  sessionName: string;
  workingDir: string;
  prompt?: string;
  systemPrompt?: string;
  model?: string;
}): Promise<{ sessionId: string; paneId: string }> {
  const { sessionName, workingDir } = config;

  await runAsync(`tmux new-session -d -s "${sessionName}" -c "${workingDir}"`);

  let claudeCmd = "claude";
  if (config.model) claudeCmd += ` --model ${config.model}`;
  if (config.systemPrompt) {
    const escaped = config.systemPrompt.replace(/'/g, "'\\''");
    claudeCmd += ` --append-system-prompt '${escaped}'`;
  }
  if (config.prompt) {
    const escaped = config.prompt.replace(/'/g, "'\\''");
    claudeCmd += ` -p '${escaped}'`;
  }

  await runAsync(`tmux send-keys -t "${sessionName}" '${claudeCmd}' Enter`);

  return {
    sessionId: sessionName,
    paneId: `${sessionName}:0`,
  };
}

function runClaudeProcess(opts: {
  sessionName: string;
  claudeSessionId: string;
  workingDir: string;
  prompt: string;
  role?: string;
  model?: string;
  isolated?: boolean;
  contextFile?: string;
  allowedTools?: string[];
  logFile: string;
  isResume: boolean;
  onExit?: (code: number | null) => void;
}): ChildProcess {
  const claudePath = findClaude();
  const args: string[] = ["-p"];

  // Isolation mode: inject managed context + restrict tools
  // We don't use --bare because it blocks OAuth/keychain auth (needed for Max subscriptions).
  // Instead we inject our context via --system-prompt-file and control tools via --allowedTools.
  if (opts.isolated && !opts.isResume) {
    if (opts.contextFile) {
      args.push("--system-prompt-file", opts.contextFile);
    }
    if (opts.allowedTools && opts.allowedTools.length > 0) {
      args.push("--allowedTools", ...opts.allowedTools);
    }
    args.push("--permission-mode", "auto");
    // Don't use --no-session-persistence: we need sessions saved for --resume
  }

  if (opts.isResume) {
    args.push("--resume", opts.claudeSessionId);
  } else {
    args.push("--session-id", opts.claudeSessionId);
    if (opts.isolated && opts.role) {
      // In isolated mode, role goes via system-prompt-file (already built)
      // Add an override instruction to prioritize BumbaClaude context
      args.push("--append-system-prompt",
        "IMPORTANT: You are managed by BumbaClaude. Follow the instructions in your system prompt file. " +
        "Ignore any conflicting instructions from auto-discovered CLAUDE.md or memory files. " +
        "Your role and instructions come exclusively from BumbaClaude."
      );
    } else if (opts.role) {
      args.push("--append-system-prompt", opts.role);
    }
  }

  if (opts.model) {
    args.push("--model", opts.model);
  }

  const child = spawn(claudePath, args, {
    cwd: opts.workingDir,
    stdio: ["pipe", "pipe", "pipe"],
    shell: false,
    detached: false,
    env: { ...process.env },
  });

  const logStream = fs.createWriteStream(opts.logFile, { flags: "a" });

  child.stdout?.on("data", (data: Buffer) => {
    logStream.write(data);
  });

  child.stderr?.on("data", (data: Buffer) => {
    // Filter out the stdin warning
    const msg = data.toString();
    if (!msg.includes("no stdin data received")) {
      logStream.write(data);
    }
  });

  child.on("error", (err) => {
    logStream.write(`\n[PROCESS ERROR] ${err.message}\n`);
  });

  child.on("exit", (code) => {
    logStream.write(`\n[RESPONSE COMPLETE]\n`);
    // Don't call onExit here for resume -- only for initial spawn failures
    if (!opts.isResume && opts.onExit && code !== 0) {
      opts.onExit(code);
    }
  });

  // Send prompt via stdin and close it
  child.stdin?.write(opts.prompt);
  child.stdin?.end();

  return child;
}

async function spawnAgentProcess(config: {
  sessionName: string;
  workingDir: string;
  prompt?: string;
  systemPrompt?: string;
  model?: string;
  isolated?: boolean;
  contextFile?: string;
  governance?: Record<string, string>;
  onExit?: (code: number | null) => void;
}): Promise<{ sessionId: string; paneId: string }> {
  const { sessionName, workingDir } = config;
  ensureLogDir();

  // Ensure the working directory exists
  if (!fs.existsSync(workingDir)) {
    fs.mkdirSync(workingDir, { recursive: true });
  }

  // Each agent gets a unique Claude session ID for conversation continuity
  const { v4: uuidv4 } = await import("uuid");
  const claudeSessionId = uuidv4();

  const logFile = path.join(LOG_DIR, `${sessionName}.log`);
  fs.writeFileSync(logFile, "");

  const initialPrompt = config.systemPrompt
    || "Review the project in this directory and begin working on your assigned role.";

  const allowedTools = config.isolated ? buildAllowedTools(config.governance) : undefined;

  const child = runClaudeProcess({
    sessionName,
    claudeSessionId,
    workingDir,
    prompt: initialPrompt,
    role: config.prompt,
    model: config.model,
    isolated: config.isolated,
    contextFile: config.contextFile,
    allowedTools,
    logFile,
    isResume: false,
    onExit: config.onExit,
  });

  activeProcesses.set(sessionName, {
    process: child,
    logFile,
    sessionId: claudeSessionId,
    workingDir,
    systemPrompt: config.prompt,
    model: config.model,
    onExit: config.onExit,
  });

  // Persist session meta to disk so it survives across API calls
  saveSessionMeta(sessionName, {
    sessionId: claudeSessionId,
    workingDir,
    systemPrompt: config.prompt,
    model: config.model,
    logFile,
  });

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

  let entry = activeProcesses.get(paneId);

  // If not in memory, load from disk (survives across API route workers)
  if (!entry) {
    const meta = loadSessionMeta(paneId);
    if (!meta) {
      throw new Error(`No active process for session ${paneId}`);
    }
    // Reconstruct entry from disk metadata
    entry = {
      process: null as unknown as ChildProcess,
      logFile: meta.logFile,
      sessionId: meta.sessionId,
      workingDir: meta.workingDir,
      systemPrompt: meta.systemPrompt,
      model: meta.model,
    };
    activeProcesses.set(paneId, entry);
  }

  // Spawn a new claude process that resumes the conversation
  const logStream = fs.createWriteStream(entry.logFile, { flags: "a" });
  logStream.write(`\n[USER] ${text}\n\n`);
  logStream.end();

  const child = runClaudeProcess({
    sessionName: paneId,
    claudeSessionId: entry.sessionId,
    workingDir: entry.workingDir,
    prompt: text,
    model: entry.model,
    logFile: entry.logFile,
    isResume: true,
  });

  // Update the active process reference
  entry.process = child;
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
  deleteSessionMeta(paneId);
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
