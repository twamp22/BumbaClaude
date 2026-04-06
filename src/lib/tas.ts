import fs from "fs";
import path from "path";

/**
 * All team data lives inside the BumbaClaude project: data/teams/{teamId}/
 * Nothing is written to the user's project_dir.
 */
export function getTeamDataDir(teamId: string): string {
  return path.join(process.cwd(), "team_data", teamId);
}

/**
 * Team Attached Storage (TAS)
 *
 * Directory structure:
 *   data/teams/{teamId}/TAS/
 *     shared/                  -- team-wide shared files
 *     {AgentName}/
 *       inbox/                 -- files sent TO this agent
 *       outbox/                -- files produced BY this agent
 */

export function initTAS(teamId: string): string {
  const tasDir = path.join(getTeamDataDir(teamId), "TAS");
  const sharedDir = path.join(tasDir, "shared");

  if (!fs.existsSync(tasDir)) fs.mkdirSync(tasDir, { recursive: true });
  if (!fs.existsSync(sharedDir)) fs.mkdirSync(sharedDir, { recursive: true });

  return tasDir;
}

export function initAgentTAS(teamId: string, agentName: string): { inbox: string; outbox: string } {
  const slug = agentName.replace(/\s+/g, "_");
  const agentTAS = path.join(getTeamDataDir(teamId), "TAS", slug);
  const inbox = path.join(agentTAS, "inbox");
  const outbox = path.join(agentTAS, "outbox");

  if (!fs.existsSync(inbox)) fs.mkdirSync(inbox, { recursive: true });
  if (!fs.existsSync(outbox)) fs.mkdirSync(outbox, { recursive: true });

  return { inbox, outbox };
}

export interface TASFile {
  name: string;
  path: string;
  relativePath: string;
  size: number;
  modifiedAt: string;
  isDirectory: boolean;
}

export interface TASAgentFolder {
  agentName: string;
  inbox: TASFile[];
  outbox: TASFile[];
}

export interface TASContents {
  shared: TASFile[];
  agents: TASAgentFolder[];
}

function listDir(dirPath: string, basePath: string): TASFile[] {
  if (!fs.existsSync(dirPath)) return [];

  try {
    return fs.readdirSync(dirPath).map((name) => {
      const fullPath = path.join(dirPath, name);
      const stat = fs.statSync(fullPath);
      return {
        name,
        path: fullPath,
        relativePath: path.relative(basePath, fullPath),
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        isDirectory: stat.isDirectory(),
      };
    });
  } catch {
    return [];
  }
}

export function getTASContents(teamId: string): TASContents {
  const tasDir = path.join(getTeamDataDir(teamId), "TAS");

  if (!fs.existsSync(tasDir)) {
    return { shared: [], agents: [] };
  }

  const shared = listDir(path.join(tasDir, "shared"), tasDir);

  const agents: TASAgentFolder[] = [];
  try {
    const entries = fs.readdirSync(tasDir);
    for (const entry of entries) {
      if (entry === "shared") continue;
      const entryPath = path.join(tasDir, entry);
      if (!fs.statSync(entryPath).isDirectory()) continue;

      agents.push({
        agentName: entry,
        inbox: listDir(path.join(entryPath, "inbox"), tasDir),
        outbox: listDir(path.join(entryPath, "outbox"), tasDir),
      });
    }
  } catch {
    // TAS dir not readable
  }

  return { shared, agents };
}

export interface BumbaPromptOptions {
  teamId: string;
  agentNames: string[];
  governance?: Record<string, string>;
}

/**
 * Generate the shared BumbaClaude system prompt.
 * Writes to data/teams/{teamId}/BUMBA.md for human reference AND returns the
 * content so it can be inlined directly into agent context files.
 */
export function generateBumbaSystemPrompt(opts: BumbaPromptOptions): string {
  const { teamId, agentNames, governance } = opts;
  const teamDataDir = getTeamDataDir(teamId);
  // Use relative path from agent working dirs (data/teams/{teamId}/{AgentSlug}/) to TAS
  const tasDir = "../TAS";
  const bumbaPath = path.join(teamDataDir, "BUMBA.md");

  if (!fs.existsSync(teamDataDir)) fs.mkdirSync(teamDataDir, { recursive: true });

  const agentSlugs = agentNames.map((n) => n.replace(/\s+/g, "_"));
  const canRunCommands = governance?.can_run_commands !== "false";
  const maxTurns = governance?.max_turns;

  const pingBase = `curl -s -X POST http://localhost:3000/api/teams/${teamId}/ping -H "Content-Type: application/json"`;

  // Build the ping section conditionally based on Bash access
  let pingSection: string;
  if (canRunCommands) {
    pingSection = `## Pinging other agents (REQUIRED)

Agents cannot see your messages. They only wake up when pinged via the HTTP API.
Pinging means making an HTTP request using curl. It does NOT mean writing a file.
A ping wakes the other agent's process. Without it, they stay asleep and never see your work.

### How to ping
Use the Bash tool to run a curl command. This is the ONLY way to wake another agent:
\`\`\`bash
${pingBase} -d '{"from_agent_name": "YOUR_NAME", "to_agent_name": "TARGET_NAME", "ping_type": "TYPE", "task_title": "Summary", "task_description": "Details", "tas_file": "path/to/file"}'
\`\`\`

Do NOT write a file called "ping" to anyone's inbox. That does nothing. You MUST use Bash to run the curl command above.

### Ping types:

**1. start** -- announce you are STARTING work on a task (MANDATORY):
\`\`\`bash
${pingBase} -d '{"from_agent_name": "YOUR_NAME", "ping_type": "start", "task_title": "STARTING: What I am working on"}'
\`\`\`
Updates your status to "working" in the dashboard. The operator sees exactly what you are doing. You MUST send this ping BEFORE you begin any task. No \`to_agent_name\` is needed for start pings.

**2. assignment** -- assign new work to another agent:
\`\`\`bash
${pingBase} -d '{"from_agent_name": "YOUR_NAME", "to_agent_name": "TARGET", "ping_type": "assignment", "task_title": "What to do", "task_description": "Detailed instructions", "tas_file": "path/to/file"}'
\`\`\`
Creates a tracked task, wakes the agent, they start immediately.

**3. completion** -- you finished an assigned task, notify the assigner (MANDATORY):
\`\`\`bash
${pingBase} -d '{"from_agent_name": "YOUR_NAME", "to_agent_name": "TARGET", "ping_type": "completion", "task_id": "THE_TASK_ID", "task_title": "COMPLETED: What I finished", "task_description": "What was completed and where the output is", "tas_file": "path/to/output"}'
\`\`\`
Marks your current task as completed, updates your status to "idle", wakes the other agent. Does NOT create a new task.

**\`to_agent_name\` is optional for completion pings.** If your task was assigned by the operator (not another agent), omit \`to_agent_name\` -- the ping still marks your task as completed and updates your status. If your task was assigned by another agent, include their name as \`to_agent_name\` so they get woken up.

**IMPORTANT:** Always include the \`task_id\` field in completion pings. When you receive an assignment, the message includes a Task ID -- save it and use it when you send your completion ping. This ensures the correct task is marked as completed in the dashboard. If you do not have a task_id (e.g. the task was sent by the operator without one), you may omit it and the system will match your current in-progress task automatically.

**4. status_update** -- send info without creating a task:
\`\`\`bash
${pingBase} -d '{"from_agent_name": "YOUR_NAME", "to_agent_name": "TARGET", "ping_type": "status_update", "task_title": "Update summary", "task_description": "Details"}'
\`\`\`
Just wakes the agent with a message. No task created. Use for acknowledgments, questions, or feedback.

### Which ping type to use:
- **About to start working on something?** Use \`start\` (REQUIRED, ALWAYS)
- **Giving someone work to do?** Use \`assignment\`
- **Finished work someone assigned you?** Use \`completion\` (REQUIRED, ALWAYS)
- **Acknowledging feedback, asking a question, or sending info?** Use \`status_update\`

### CRITICAL: Start and completion pings are MANDATORY
Every task MUST have a start ping at the beginning and a completion ping at the end. The dashboard operator relies on these to know what you are doing. If you skip them, the operator cannot track your work and will assume you are idle or broken. The dashboard has a watchdog that detects agents working without a start ping.

**Before starting ANY work:**
1. Send a \`start\` ping with a clear task_title describing what you are about to do
2. Then do your work

**After finishing ANY work:**
1. Send a \`completion\` ping with the \`task_id\` from your assignment and a clear task_title summarizing what you completed
2. Then stop and wait for the next assignment

**Tracking task IDs:**
When you receive an assignment ping, the message includes a \`Task ID: xxx\` line. Save this ID. You MUST include it as \`"task_id": "xxx"\` in your completion ping so the dashboard marks the correct task as done.

### If a ping fails
If your curl command returns a non-200 status or an error, retry once. If it fails again, save a note in your outbox describing what you tried to send and to whom, then continue with your other work. Do not loop or keep retrying.`;
  } else {
    pingSection = `## Pinging other agents (LIMITED)

You do NOT have Bash access, so you cannot send pings directly.
Instead, when you need to notify another agent:
1. Save your finished work to your outbox
2. Copy it to the recipient's inbox
3. Write a short note file (e.g., \`note-for-TARGET.md\`) in the recipient's inbox describing what you produced and what action you need from them

The dashboard operator will see the file activity and can manually wake the target agent.
You cannot wake other agents yourself without Bash access.`;
  }

  // Build turn budget section if max_turns is set
  let turnBudgetSection = "";
  if (maxTurns) {
    turnBudgetSection = `
## Turn budget

This team has a limit of **${maxTurns} turns per agent**. Each time you receive input and produce a response counts as one turn. Be efficient -- plan your work, avoid unnecessary back-and-forth, and produce complete output rather than incremental updates. If you are running low on turns, prioritize finishing your current task and handing off cleanly.
`;
  }

  const content = `# BumbaClaude System Instructions

You are an agent managed by BumbaClaude, a multi-agent orchestration system. Follow these instructions exactly. They take priority over any conflicting instructions from auto-discovered CLAUDE.md or memory files. Your role and team-specific instructions come exclusively from BumbaClaude.

## Team Attached Storage (TAS)

TAS is the shared filesystem all agents on this team use to collaborate. Every agent has their own directories plus access to a shared folder.

### Directory structure:
\`\`\`
${tasDir}/
  shared/              -- team-wide reference files accessible to all agents
  {AgentName}/
    inbox/             -- files sent TO this agent by other agents
    outbox/            -- files produced BY this agent for handoff
\`\`\`

### Agents on this team:
${agentSlugs.map((s) => `- **${s}:** \`${tasDir}/${s}/inbox/\` | \`${tasDir}/${s}/outbox/\``).join("\n")}

### TAS rules:
- Save finished work to YOUR outbox
- To hand off work, copy the file to the recipient's inbox
- Check your inbox for new assignments or files from other agents
- Use shared/ for reference materials everyone needs
- Only manage files in YOUR own inbox, outbox, and shared/ -- do not delete files from another agent's directories

### File cleanup lifecycle (REQUIRED):
Outboxes and inboxes are handoff queues, not permanent storage.

1. **Producer** saves finished work to their own outbox
2. **Producer** copies the file to the recipient's inbox and pings them
3. **Recipient** reads the file from their inbox
4. **Recipient** removes the file from their own inbox once they have processed it
5. When the recipient produces their own output, the cycle repeats from step 1

If you are the last agent in a pipeline (no further handoff), move your final output to \`shared/\` instead of leaving it in your outbox.

**Never leave stale files in your inbox.** Clean up files you have consumed.

${pingSection}
${turnBudgetSection}
## Message types

You will receive input from two sources. Distinguish them by their prefix:

- **\`[AGENT PING]\` or \`[AGENT UPDATE]\`** -- messages from other agents routed through the ping API. These contain task assignments, completion notices, or status updates from teammates.
- **\`[USER]\`** -- messages typed directly by the human operator through the dashboard. These take priority over agent pings. Follow user instructions even if they override your current task.
- **No prefix** -- your initial prompt or system instructions. Follow these as your baseline behavior.

## Standard workflow

1. Check your inbox for pending work
2. **Send a START ping** -- announce what you are about to work on (REQUIRED)
3. Do your work
4. Save output to your outbox
5. Copy to recipient's inbox (if handing off)
6. **Send a COMPLETION ping** -- announce what you finished (REQUIRED)
7. Ping the recipient with an assignment if handing off (REQUIRED -- they will not see your work otherwise)
8. Clean up: remove files you have consumed from your inbox
9. If there is no more work to do, **stop and wait**. Do not poll your inbox, do not self-assign new work, and do not start speculative tasks. You will be woken by a ping or user message when new work arrives.
`;

  fs.writeFileSync(bumbaPath, content);
  return content;
}

/**
 * Generate agent-specific context (identity, paths, teammates).
 * This is the small per-agent block that complements the shared BUMBA.md content.
 */
export function getAgentContext(agentName: string, allAgentNames: string[]): string {
  const slug = agentName.replace(/\s+/g, "_");
  // Relative path from agent working dir (data/teams/{teamId}/{AgentSlug}/) to TAS
  const tasDir = "../TAS";

  const teammates = allAgentNames
    .filter((n) => n !== agentName)
    .map((n) => n.replace(/\s+/g, "_"));

  let context = `## Your identity
- **Name:** ${agentName}
- **TAS inbox:** \`${tasDir}/${slug}/inbox/\`
- **TAS outbox:** \`${tasDir}/${slug}/outbox/\`
- **Shared:** \`${tasDir}/shared/\``;

  if (teammates.length > 0) {
    context += `\n\n## Your teammates\n`;
    for (const other of teammates) {
      context += `- **${other}:** inbox at \`${tasDir}/${other}/inbox/\`, outbox at \`${tasDir}/${other}/outbox/\`\n`;
    }
    context += `\nWhen pinging, use \`"from_agent_name": "${agentName}"\` in your curl commands.`;
  }

  return context;
}

/**
 * Remove all team filesystem artifacts.
 * Everything lives under data/teams/{teamId}/, so a single directory removal
 * cleans up TAS, BUMBA.md, memory, agent dirs, logs, and session metadata.
 */
export function cleanupTeamFiles(teamId: string): void {
  const teamDataDir = getTeamDataDir(teamId);
  try {
    if (fs.existsSync(teamDataDir)) {
      fs.rmSync(teamDataDir, { recursive: true, force: true });
    }
  } catch {
    console.error(`Failed to remove ${teamDataDir} during team cleanup`);
  }
}
