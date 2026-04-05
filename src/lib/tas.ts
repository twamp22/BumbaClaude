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

    instructions += `
### Pinging other agents

When you place a file in another agent's inbox or need them to act on something, you MUST ping them. Use the Bash tool to make this API call:

\`\`\`bash
curl -s -X POST http://localhost:3000/api/teams/${teamId || "TEAM_ID"}/ping \\
  -H "Content-Type: application/json" \\
  -d '{"from_agent_name": "${agentName}", "to_agent_name": "TARGET_AGENT_NAME", "task_title": "Brief task description", "task_description": "Detailed instructions", "tas_file": "path/to/file/if/relevant"}'
\`\`\`

Replace TARGET_AGENT_NAME with the agent's name and fill in the task details. This will:
1. Create a tracked task visible in the dashboard
2. Wake the target agent and deliver the task immediately
3. The target agent will begin working on it right away

**Always ping after placing files in another agent's inbox.** Do not assume they will check on their own.`;
  }

  return instructions;
}
