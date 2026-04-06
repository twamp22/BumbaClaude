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
 * Generate TAS instructions for an agent's context file.
 */
export function getTASInstructions(teamDir: string, agentName: string, allAgentNames: string[], teamId?: string): string {
  const slug = agentName.replace(/\s+/g, "_");
  const tasDir = path.join(teamDir, "TAS").replace(/\\/g, "/");

  const otherAgents = allAgentNames
    .filter((n) => n !== agentName)
    .map((n) => n.replace(/\s+/g, "_"));

  let instructions = `## Team Attached Storage (TAS)

You have access to a shared filesystem for collaborating with other agents.

### Your directories:
- **Your outbox:** \`${tasDir}/${slug}/outbox/\` -- Place files here when you produce work for others
- **Your inbox:** \`${tasDir}/${slug}/inbox/\` -- Check here for files sent to you by other agents
- **Shared:** \`${tasDir}/shared/\` -- Team-wide shared files accessible to all agents

### How to collaborate:
- When you finish producing work (articles, code, reports), save it to your outbox
- To send work to another agent, copy/move it to their inbox
- Check your inbox periodically for new assignments or files from other agents
- Use the shared directory for reference materials everyone needs`;

  if (otherAgents.length > 0) {
    instructions += `\n\n### Other agents on this team:\n`;
    for (const other of otherAgents) {
      instructions += `- **${other}:** inbox at \`${tasDir}/${other}/inbox/\`, outbox at \`${tasDir}/${other}/outbox/\`\n`;
    }

    const pingBase = `curl -s -X POST http://localhost:3000/api/teams/${teamId || "TEAM_ID"}/ping -H "Content-Type: application/json"`;

    instructions += `
### Pinging other agents (REQUIRED)

Agents cannot see your messages. They only wake up when pinged. Never say "ready for X to pull when ready." Always ping.

There are three ping types. Use the correct one:

**1. Assignment -- assign new work to another agent:**
\`\`\`bash
${pingBase} -d '{"from_agent_name": "${agentName}", "to_agent_name": "TARGET_NAME", "ping_type": "assignment", "task_title": "What to do", "task_description": "Detailed instructions", "tas_file": "path/to/file"}'
\`\`\`
Creates a tracked task, wakes the agent, they start immediately.

**2. Completion -- you finished an assigned task, notify the assigner:**
\`\`\`bash
${pingBase} -d '{"from_agent_name": "${agentName}", "to_agent_name": "TARGET_NAME", "ping_type": "completion", "task_title": "Task done: brief summary", "task_description": "What was completed and where the output is", "tas_file": "path/to/output"}'
\`\`\`
Marks your current task as completed, wakes the other agent. Does NOT create a new task.

**3. Status update -- send info without creating a task:**
\`\`\`bash
${pingBase} -d '{"from_agent_name": "${agentName}", "to_agent_name": "TARGET_NAME", "ping_type": "status_update", "task_title": "Update summary", "task_description": "Details"}'
\`\`\`
Just wakes the agent with a message. No task created. Use for acknowledgments, questions, or feedback.

### Which ping type to use:
- **Giving someone work to do?** Use \`assignment\`
- **Finished work someone assigned you?** Use \`completion\`
- **Acknowledging feedback, asking a question, or sending info?** Use \`status_update\`

### Workflow:
1. Produce your work, save to your TAS outbox
2. If handing off: copy to the recipient's inbox
3. Ping with the correct type
4. Never leave work passively waiting`;
  }

  return instructions;
}
