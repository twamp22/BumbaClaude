import fs from "fs";
import path from "path";

/**
 * Team Attached Storage (TAS)
 *
 * Directory structure:
 *   {teamDir}/TAS/
 *     shared/                  -- team-wide shared files
 *     {AgentName}/
 *       inbox/                 -- files sent TO this agent
 *       outbox/                -- files produced BY this agent
 */

export function initTAS(teamDir: string): string {
  const tasDir = path.join(teamDir, "TAS");
  const sharedDir = path.join(tasDir, "shared");

  if (!fs.existsSync(tasDir)) fs.mkdirSync(tasDir, { recursive: true });
  if (!fs.existsSync(sharedDir)) fs.mkdirSync(sharedDir, { recursive: true });

  return tasDir;
}

export function initAgentTAS(teamDir: string, agentName: string): { inbox: string; outbox: string } {
  const slug = agentName.replace(/\s+/g, "_");
  const agentTAS = path.join(teamDir, "TAS", slug);
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

export function getTASContents(teamDir: string): TASContents {
  const tasDir = path.join(teamDir, "TAS");

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
  teamDir: string;
  teamId: string;
  agentNames: string[];
  governance?: Record<string, string>;
}

/**
 * Generate the shared BumbaClaude system prompt.
 * Writes to {teamDir}/BUMBA.md for human reference AND returns the content
 * so it can be inlined directly into agent context files.
 */
export function generateBumbaSystemPrompt(opts: BumbaPromptOptions): string {
  const { teamDir, teamId, agentNames, governance } = opts;
  const tasDir = path.join(teamDir, "TAS").replace(/\\/g, "/");
  const bumbaPath = path.join(teamDir, "BUMBA.md");

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

**1. assignment** -- assign new work to another agent:
\`\`\`bash
${pingBase} -d '{"from_agent_name": "YOUR_NAME", "to_agent_name": "TARGET", "ping_type": "assignment", "task_title": "What to do", "task_description": "Detailed instructions", "tas_file": "path/to/file"}'
\`\`\`
Creates a tracked task, wakes the agent, they start immediately.

**2. completion** -- you finished an assigned task, notify the assigner:
\`\`\`bash
${pingBase} -d '{"from_agent_name": "YOUR_NAME", "to_agent_name": "TARGET", "ping_type": "completion", "task_title": "Done: brief summary", "task_description": "What was completed and where the output is", "tas_file": "path/to/output"}'
\`\`\`
Marks your current task as completed, wakes the other agent. Does NOT create a new task.

**3. status_update** -- send info without creating a task:
\`\`\`bash
${pingBase} -d '{"from_agent_name": "YOUR_NAME", "to_agent_name": "TARGET", "ping_type": "status_update", "task_title": "Update summary", "task_description": "Details"}'
\`\`\`
Just wakes the agent with a message. No task created. Use for acknowledgments, questions, or feedback.

### Which ping type to use:
- **Giving someone work to do?** Use \`assignment\`
- **Finished work someone assigned you?** Use \`completion\`
- **Acknowledging feedback, asking a question, or sending info?** Use \`status_update\`

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
2. Do your work
3. Save output to your outbox
4. Copy to recipient's inbox (if handing off)
5. Ping the recipient (REQUIRED -- they will not see your work otherwise)
6. Clean up: remove files you have consumed from your inbox
7. If there is no more work to do, **stop and wait**. Do not poll your inbox, do not self-assign new work, and do not start speculative tasks. You will be woken by a ping or user message when new work arrives.
`;

  fs.writeFileSync(bumbaPath, content);
  return content;
}

/**
 * Generate agent-specific context (identity, paths, teammates).
 * This is the small per-agent block that complements the shared BUMBA.md content.
 */
export function getAgentContext(teamDir: string, agentName: string, allAgentNames: string[]): string {
  const slug = agentName.replace(/\s+/g, "_");
  const tasDir = path.join(teamDir, "TAS").replace(/\\/g, "/");

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
 * Remove all team filesystem artifacts (TAS, BUMBA.md, memory, agent dirs, logs).
 * Called on hard delete. Does NOT remove the project_dir itself since the user owns that.
 */
export function cleanupTeamFiles(teamDir: string, agentNames: string[]): void {
  const toRemove = [
    path.join(teamDir, "TAS"),
    path.join(teamDir, "BUMBA.md"),
    path.join(teamDir, "memory"),
  ];

  // Agent working directories (each agent gets {teamDir}/{AgentSlug}/)
  for (const name of agentNames) {
    const slug = name.replace(/\s+/g, "_");
    toRemove.push(path.join(teamDir, slug));
  }

  for (const target of toRemove) {
    try {
      if (!fs.existsSync(target)) continue;
      const stat = fs.statSync(target);
      if (stat.isDirectory()) {
        fs.rmSync(target, { recursive: true, force: true });
      } else {
        fs.unlinkSync(target);
      }
    } catch {
      // Best-effort cleanup -- log but don't fail the delete
      console.error(`Failed to remove ${target} during team cleanup`);
    }
  }
}
