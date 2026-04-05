import { execSync, exec } from "child_process";
import type { TmuxSession } from "./types";

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
  try {
    run("tmux -V");
    return true;
  } catch {
    return false;
  }
}

/**
 * Spawn a new Claude Code session in a tmux pane.
 */
export async function spawnAgent(config: {
  sessionName: string;
  workingDir: string;
  agentArgs: string;
  model?: string;
}): Promise<{ sessionId: string; paneId: string }> {
  const { sessionName, workingDir, agentArgs } = config;

  // Create a new tmux session (detached)
  await runAsync(`tmux new-session -d -s "${sessionName}" -c "${workingDir}"`);

  // Build the claude command
  let claudeCmd = `claude ${agentArgs}`;
  if (config.model) {
    claudeCmd += ` --model ${config.model}`;
  }

  // Send the command to the pane
  await runAsync(`tmux send-keys -t "${sessionName}" '${claudeCmd}' Enter`);

  return {
    sessionId: sessionName,
    paneId: `${sessionName}:0`,
  };
}

/**
 * Capture last N lines of output from an agent's pane.
 */
export async function captureOutput(paneId: string, lines: number = 50): Promise<string> {
  return runAsync(`tmux capture-pane -t "${paneId}" -p -S -${lines}`);
}

/**
 * Send text input to an agent's pane (like typing into the terminal).
 */
export async function sendInput(paneId: string, text: string): Promise<void> {
  // Escape single quotes in the text
  const escaped = text.replace(/'/g, "'\\''");
  await runAsync(`tmux send-keys -t "${paneId}" '${escaped}' Enter`);
}

/**
 * Send interrupt (Ctrl+C) to an agent's pane.
 */
export async function interrupt(paneId: string): Promise<void> {
  await runAsync(`tmux send-keys -t "${paneId}" C-c`);
}

/**
 * Kill an agent's tmux pane.
 */
export async function killPane(paneId: string): Promise<void> {
  await runAsync(`tmux kill-pane -t "${paneId}"`);
}

/**
 * Kill an entire tmux session.
 */
export async function killSession(sessionName: string): Promise<void> {
  await runAsync(`tmux kill-session -t "${sessionName}"`);
}

/**
 * List all tmux sessions/panes with their status.
 */
export async function listSessions(): Promise<TmuxSession[]> {
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
    // No tmux server running or no sessions
    return [];
  }
}

/**
 * Check if a specific tmux session exists.
 */
export async function sessionExists(sessionName: string): Promise<boolean> {
  try {
    await runAsync(`tmux has-session -t "${sessionName}"`);
    return true;
  } catch {
    return false;
  }
}
