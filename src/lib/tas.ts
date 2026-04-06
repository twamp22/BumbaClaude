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

/**
 * Generate the shared BumbaClaude system prompt and write it to {teamDir}/BUMBA.md.
 * This is the single source of truth for how all agents operate within BumbaClaude.
 * Agent-specific context (name, role, paths) is kept separate in per-agent context files.
 */
export function generateBumbaSystemPrompt(teamDir: string, teamId: string, agentNames: string[]): string {
  const tasDir = path.join(teamDir, "TAS").replace(/\\/g, "/");
  const bumbaPath = path.join(teamDir, "BUMBA.md");

  const agentSlugs = agentNames.map((n) => n.replace(/\s+/g, "_"));
  const pingBase = `curl -s -X POST http://localhost:3000/api/teams/${teamId}/ping -H "Content-Type: application/json"`;

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
- To hand off work, copy/move the file to the recipient's inbox
- Check your inbox for new assignments or files from other agents
- Use shared/ for reference materials everyone needs

### File cleanup lifecycle (REQUIRED):
Outboxes and inboxes are handoff queues, not permanent storage. Follow this lifecycle:

1. **Producer** saves finished work to their own outbox
2. **Producer** copies the file to the recipient's inbox and pings them
3. **Recipient** reads the file from their inbox
4. **Recipient** removes the file from their inbox once they begin working on it
5. **Recipient** removes the file from the producer's outbox once they have their own copy
6. When the recipient produces their own output, the cycle repeats from step 1

If you are the last agent in a pipeline (no further handoff), move your final output to \`shared/\` instead of leaving it in your outbox.

**Never leave stale files in inboxes or outboxes.** Clean up as you go.

## Pinging other agents (REQUIRED)

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

## Standard workflow

1. Check your inbox for pending work
2. Do your work
3. Save output to your outbox
4. Copy to recipient's inbox (if handing off)
5. Ping the recipient via curl (REQUIRED -- they will not see your work otherwise)
6. Clean up: remove files you have consumed from inboxes/outboxes
7. Never leave work passively waiting -- always ping after producing output
`;

  fs.writeFileSync(bumbaPath, content);
  return bumbaPath;
}

/**
 * Generate agent-specific context (identity, paths, teammates).
 * This is the small per-agent block that complements the shared BUMBA.md.
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
