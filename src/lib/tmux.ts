import { execSync, exec, spawn, ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import type { TmuxSession } from "./types";
import { getAgentContext, generateBumbaSystemPrompt, getTeamDataDir } from "./tas";
import { getAgentBySession, getTeam } from "./db";

const IS_WINDOWS = os.platform() === "win32";

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
    role?: string;
    model?: string;
    allowedTools?: string[];
    agentId?: string;
    teamId?: string;
    onExit?: (code: number | null) => void;
  }
>();

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

interface SessionMeta {
  sessionId: string;
  workingDir: string;
  role?: string;
  model?: string;
  logFile: string;
  isolated?: boolean;
  allowedTools?: string[];
  agentId?: string;
  teamId?: string;
}

function sessionMetaPath(workingDir: string): string {
  return path.join(workingDir, "session.json");
}

function saveSessionMeta(meta: SessionMeta): void {
  ensureDir(meta.workingDir);
  fs.writeFileSync(
    sessionMetaPath(meta.workingDir),
    JSON.stringify(meta, null, 2)
  );
}

function loadSessionMeta(sessionName: string): SessionMeta | null {
  // Look up the agent's working dir from the database
  try {
    const agent = getAgentBySession(sessionName);
    if (!agent) return null;
    const team = getTeam(agent.team_id);
    if (!team) return null;
    const agentSlug = agent.name.replace(/\s+/g, "_");
    const workingDir = path.join(getTeamDataDir(team.id), agentSlug);
    const metaPath = sessionMetaPath(workingDir);
    if (fs.existsSync(metaPath)) {
      return JSON.parse(fs.readFileSync(metaPath, "utf-8"));
    }
    // Fallback: check legacy location (data/agent-sessions/)
    const legacyPath = path.join(process.cwd(), "data", "agent-sessions", `${sessionName}.json`);
    if (fs.existsSync(legacyPath)) {
      return JSON.parse(fs.readFileSync(legacyPath, "utf-8"));
    }
    return null;
  } catch {
    return null;
  }
}

function deleteSessionMeta(sessionName: string): void {
  // Try to find and delete from the agent's working dir
  const entry = activeProcesses.get(sessionName);
  if (entry) {
    const metaPath = sessionMetaPath(entry.workingDir);
    if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
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
 * Get the memory directory for a team, stored inside data/teams/{teamId}/.
 */
export function getTeamMemoryDir(teamId: string): string {
  return path.join(getTeamDataDir(teamId), "memory");
}

/**
 * Build the context file for an isolated agent.
 * Inlines the full BUMBA.md system instructions + agent role into a single
 * self-contained file. No external file reads required on agent startup.
 */
export function buildContextFile(
  teamId: string,
  agentName: string,
  role: string,
  allAgentNames: string[],
  governance?: Record<string, string>,
): string {
  const memoryDir = getTeamMemoryDir(teamId);
  ensureDir(memoryDir);

  // Generate the BUMBA.md content (also writes to disk for human reference)
  const bumbaContent = generateBumbaSystemPrompt({
    teamId,
    agentNames: allAgentNames,
    governance,
  });

  // Load team-level custom instructions if they exist
  const teamInstructionsPath = path.join(memoryDir, "instructions.md");
  const teamInstructions = fs.existsSync(teamInstructionsPath)
    ? fs.readFileSync(teamInstructionsPath, "utf-8")
    : "";

  // Load agent-specific memory if it exists
  const agentSlug = agentName.toLowerCase().replace(/\s+/g, "-");
  const agentMemoryPath = path.join(memoryDir, `agent-${agentSlug}.md`);
  const agentMemory = fs.existsSync(agentMemoryPath)
    ? fs.readFileSync(agentMemoryPath, "utf-8")
    : "";

  // Build agent-specific context (identity, paths, teammates)
  const agentContext = getAgentContext(agentName, allAgentNames);

  // Compose the context file -- inline BUMBA.md content, then agent-specific details
  const parts: string[] = [];
  parts.push(bumbaContent);
  parts.push(`# Agent: ${agentName}`);
  parts.push(`## Role\n${role}`);
  if (agentContext) parts.push(agentContext);
  if (teamInstructions) parts.push(`## Team Instructions\n${teamInstructions}`);
  if (agentMemory) parts.push(`## Agent Memory\n${agentMemory}`);

  const contextPath = path.join(memoryDir, `context-${agentSlug}.md`);
  fs.writeFileSync(contextPath, parts.join("\n\n"));
  return contextPath;
}

/**
 * Map governance rules to --allowedTools flags.
 */
function buildAllowedTools(governance?: Record<string, string>): string[] {
  const tools: string[] = ["Read", "Glob", "Grep", "WebSearch", "WebFetch"];

  const canCreateFiles = governance?.can_create_files !== "false";
  const canRunCommands = governance?.can_run_commands !== "false";

  if (canCreateFiles) {
    tools.push("Edit", "Write", "NotebookEdit");
  }
  if (canRunCommands) {
    tools.push("Bash");
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
  agentId?: string;
  teamId?: string;
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
  agentId?: string;
  teamId?: string;
  logFile: string;
  isResume: boolean;
  onExit?: (code: number | null) => void;
}): ChildProcess {
  const claudePath = findClaude();
  const args: string[] = ["-p"];

  // Isolation mode: inject managed context + restrict tools
  // We don't use --bare because it blocks OAuth/keychain auth (needed for Max subscriptions).
  // Instead we inject our context via --system-prompt-file and control tools via --allowedTools.
  // Always apply tool permissions and permission mode
  if (opts.allowedTools && opts.allowedTools.length > 0) {
    args.push("--allowedTools", opts.allowedTools.join(" "));
  }
  args.push("--permission-mode", "auto");

  if (opts.isolated && !opts.isResume) {
    if (opts.contextFile) {
      args.push("--system-prompt-file", opts.contextFile);
    }
    args.push("--disable-slash-commands");
  }

  if (opts.isResume) {
    args.push("--resume", opts.claudeSessionId);
    // Reinforce critical rules on resume since conversation compression may have dropped them
    args.push("--append-system-prompt",
      "REMINDER: You are a BumbaClaude agent. Key rules: " +
      "(1) Ping other agents using Bash + curl -- writing files does not wake them. " +
      "(2) ALWAYS send a start ping before working and a completion ping when done. " +
      "Completion pings do NOT require to_agent_name -- omit it if the task came from the operator. " +
      "(3) Clean your inbox after consuming files. " +
      "(4) If there is no work to do, stop and wait -- do not self-assign tasks. " +
      "(5) Messages prefixed [USER] are from the human operator and take priority."
    );
  } else {
    args.push("--session-id", opts.claudeSessionId);
    if (opts.role && !(opts.isolated && opts.contextFile)) {
      // Non-isolated mode: inject role directly since there is no context file
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

    if (opts.agentId) {
      try {
        const db = require("./db");
        const isCleanExit = code === 0;
        const agentStatus = isCleanExit ? "idle" : "errored";
        const taskStatus = isCleanExit ? "completed" : "errored";

        db.updateAgentStatus(opts.agentId, agentStatus);

        if (!isCleanExit) {
          db.createAuditEvent({
            team_id: opts.teamId || null,
            agent_id: opts.agentId,
            event_type: "agent_errored",
            event_data: JSON.stringify({
              exit_code: code,
              agent_name: opts.role || "Agent",
            }),
          });
        }

        // Auto-complete/error orphaned tasks when agent exits.
        // This prevents tasks from being stuck when the model fails to curl
        // or when the process is killed.
        if (opts.teamId) {
          const tasks = db.getTasksByTeam(opts.teamId);
          const orphanedTasks = tasks.filter(
            (t: { assigned_agent_id: string; status: string; parent_task_id: string | null; id: string }) => {
              if (t.assigned_agent_id !== opts.agentId) return false;
              if (t.status === "in_progress") return true;
              // Also auto-complete "review" tasks if all their child tasks are done
              if (t.status === "review" && isCleanExit) {
                const childTasks = tasks.filter(
                  (ct: { parent_task_id: string | null }) => ct.parent_task_id === t.id
                );
                const allChildrenDone = childTasks.length > 0 && childTasks.every(
                  (ct: { status: string }) => ct.status === "completed"
                );
                return allChildrenDone;
              }
              return false;
            }
          );
          for (const task of orphanedTasks) {
            db.updateTaskStatus(task.id, taskStatus);
            db.createAuditEvent({
              team_id: opts.teamId,
              agent_id: opts.agentId,
              event_type: isCleanExit ? "task_completed" : "task_errored",
              event_data: JSON.stringify({
                task_id: task.id,
                title: task.title,
                agent_name: opts.role || "Agent",
                auto_completed: true,
                reason: isCleanExit
                  ? "Agent process exited without sending completion ping"
                  : `Agent process crashed with exit code ${code}`,
              }),
            });

            // Wake the parent task's agent so they can continue
            if (task.parent_task_id) {
              const parentTask = tasks.find(
                (t: { id: string }) => t.id === task.parent_task_id
              );
              if (parentTask?.assigned_agent_id) {
                const parentAgent = db.getAgent(parentTask.assigned_agent_id);
                if (parentAgent?.tmux_session) {
                  const msg = isCleanExit
                    ? `[AGENT PING] COMPLETED by ${opts.role || "Agent"}: ${task.title}\nTask ID: ${task.id}\nNote: Auto-completed on process exit. Check inbox for output files.`
                    : `[AGENT UPDATE] ERRORED: ${opts.role || "Agent"} crashed while working on: ${task.title}\nTask ID: ${task.id}\nExit code: ${code}`;
                  sendInput(parentAgent.tmux_session, msg).catch((err: Error) => {
                    console.error(`Failed to wake parent agent: ${err.message}`);
                  });
                }
              }
            }
          }
        }
      } catch { /* db may not be available */ }
    }

    // Report errors on initial spawn
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
  agentId?: string;
  teamId?: string;
  onExit?: (code: number | null) => void;
}): Promise<{ sessionId: string; paneId: string }> {
  const { sessionName, workingDir } = config;

  // Ensure the working directory exists
  ensureDir(workingDir);

  // Each agent gets a unique Claude session ID for conversation continuity
  const { v4: uuidv4 } = await import("uuid");
  const claudeSessionId = uuidv4();

  const logFile = path.join(workingDir, `${sessionName}.log`);
  fs.writeFileSync(logFile, "");

  const initialPrompt = config.systemPrompt
    || "Check your TAS inbox for pending work. If empty, review the project in your working directory and wait for instructions.";

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
    agentId: config.agentId,
    logFile,
    isResume: false,
    onExit: config.onExit,
  });

  activeProcesses.set(sessionName, {
    process: child,
    logFile,
    sessionId: claudeSessionId,
    workingDir,
    role: config.prompt,
    model: config.model,
    allowedTools,
    agentId: config.agentId,
    teamId: config.teamId,
    onExit: config.onExit,
  });

  // Persist session meta to disk so it survives across API calls
  saveSessionMeta({
    sessionId: claudeSessionId,
    workingDir,
    role: config.prompt,
    model: config.model,
    logFile,
    isolated: config.isolated,
    allowedTools,
    agentId: config.agentId,
    teamId: config.teamId,
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
    // Try loading session meta from DB to find the log file
    const meta = loadSessionMeta(paneId);
    if (meta && fs.existsSync(meta.logFile)) {
      return tailFile(meta.logFile, lines);
    }
    // Fallback: check legacy log location
    const legacyLog = path.join(process.cwd(), "data", "agent-logs", `${paneId}.log`);
    if (fs.existsSync(legacyLog)) {
      return tailFile(legacyLog, lines);
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
      role: meta.role,
      model: meta.model,
      allowedTools: meta.allowedTools,
      agentId: meta.agentId,
      teamId: meta.teamId,
    };
    activeProcesses.set(paneId, entry);
  }

  // Spawn a new claude process that resumes the conversation
  const logStream = fs.createWriteStream(entry.logFile, { flags: "a" });
  logStream.write(`\n[USER] ${text}\n\n`);
  logStream.end();

  // Update agent status to working while processing
  if (entry.agentId) {
    try {
      const { updateAgentStatus } = require("./db");
      updateAgentStatus(entry.agentId, "working");
    } catch { /* db may not be available */ }
  }

  const child = runClaudeProcess({
    sessionName: paneId,
    claudeSessionId: entry.sessionId,
    workingDir: entry.workingDir,
    prompt: text,
    model: entry.model,
    allowedTools: entry.allowedTools,
    agentId: entry.agentId,
    teamId: entry.teamId,
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
