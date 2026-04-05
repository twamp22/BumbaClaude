import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import {
  getAllTeams,
  createTeam,
  createAgent,
  createGovernanceRule,
  createAuditEvent,
  updateAgentStatus,
} from "@/lib/db";
import { spawnAgent, buildContextFile } from "@/lib/tmux";
import { startWatching } from "@/lib/watcher";
import { initTAS, initAgentTAS } from "@/lib/tas";

export async function GET() {
  const teams = getAllTeams();
  return NextResponse.json(teams);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, project_dir, execution_mode, agents, governance, isolated } = body;

  const teamId = uuidv4();
  const useIsolation = isolated !== false; // Default to true

  const team = createTeam({
    id: teamId,
    name,
    project_dir,
    status: "running",
    execution_mode: execution_mode || "tmux",
  });

  // Create governance rules
  const governanceMap: Record<string, string> = {};
  if (governance) {
    for (const [ruleType, ruleValue] of Object.entries(governance)) {
      createGovernanceRule({
        id: uuidv4(),
        team_id: teamId,
        rule_type: ruleType,
        rule_value: String(ruleValue),
      });
      governanceMap[ruleType] = String(ruleValue);
    }
  }

  // Initialize TAS
  initTAS(project_dir);

  // Collect agent names for TAS instructions
  const agentNames: string[] = (agents || []).map((a: { name: string }) => a.name);

  // Spawn agents
  const spawnedAgents = [];
  if (agents && Array.isArray(agents)) {
    for (const agentDef of agents) {
      const agentId = uuidv4();
      const sessionName = `bumba-${teamId.slice(0, 8)}-${agentDef.name.toLowerCase().replace(/\s+/g, "-")}`;

      // Initialize TAS directories for this agent
      initAgentTAS(project_dir, agentDef.name);

      // Build isolated context file if isolation is enabled
      let contextFile: string | undefined;
      if (useIsolation) {
        contextFile = buildContextFile(teamId, agentDef.name, agentDef.role, project_dir, agentNames);
      }

      // Each agent gets its own subdirectory under the team's working dir
      const agentSlug = agentDef.name.replace(/\s+/g, "_");
      const agentWorkingDir = path.join(project_dir, agentSlug);

      let tmuxSession: string | null = null;
      try {
        const result = await spawnAgent({
          sessionName,
          workingDir: agentWorkingDir,
          prompt: agentDef.role,
          systemPrompt: agentDef.system_prompt || undefined,
          model: agentDef.model_tier,
          isolated: useIsolation,
          contextFile,
          governance: governanceMap,
          onExit: (code) => {
            updateAgentStatus(agentId, code === 0 ? "completed" : "errored");
            createAuditEvent({
              team_id: teamId,
              agent_id: agentId,
              event_type: code === 0 ? "agent_completed" : "agent_errored",
              event_data: JSON.stringify({ exit_code: code }),
            });
          },
        });
        tmuxSession = result.paneId;
      } catch (error) {
        console.error(`Failed to spawn agent ${agentDef.name}:`, error);
      }

      const agent = createAgent({
        id: agentId,
        team_id: teamId,
        name: agentDef.name,
        role: agentDef.role,
        model_tier: agentDef.model_tier || "sonnet",
        system_prompt: agentDef.system_prompt || null,
        status: tmuxSession ? "working" : "errored",
        tmux_session: tmuxSession,
      });

      spawnedAgents.push(agent);

      createAuditEvent({
        team_id: teamId,
        agent_id: agentId,
        event_type: "agent_spawned",
        event_data: JSON.stringify({
          name: agentDef.name,
          model_tier: agentDef.model_tier,
          role: agentDef.role,
          isolated: useIsolation,
        }),
      });
    }
  }

  createAuditEvent({
    team_id: teamId,
    event_type: "team_created",
    event_data: JSON.stringify({ name, agent_count: spawnedAgents.length, isolated: useIsolation }),
  });

  // Start filesystem watcher for this team
  try {
    startWatching(name, teamId);
  } catch (error) {
    console.error(`Failed to start watcher for team ${name}:`, error);
  }

  return NextResponse.json({ team, agents: spawnedAgents }, { status: 201 });
}
