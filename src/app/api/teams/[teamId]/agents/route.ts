import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { getAgentsByTeam, getTeam, getGovernanceRules, createAgent, createAuditEvent, updateAgentStatus } from "@/lib/db";
import { spawnAgent, buildContextFile } from "@/lib/tmux";
import { initAgentTAS, getTeamDataDir } from "@/lib/tas";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const agents = getAgentsByTeam(teamId);
  return NextResponse.json(agents);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const team = getTeam(teamId);
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const body = await request.json();
  const agentId = uuidv4();
  const sessionName = `bumba-${teamId.slice(0, 8)}-${body.name.toLowerCase().replace(/\s+/g, "-")}`;

  // Each agent gets its own subdirectory under the team's working dir
  const agentSlug = body.name.replace(/\s+/g, "_");
  const agentWorkingDir = path.join(getTeamDataDir(teamId), agentSlug);

  // Initialize TAS for this agent
  initAgentTAS(teamId, body.name);

  // Build governance map and context file (same as team creation)
  const governanceRules = getGovernanceRules(teamId);
  const governanceMap: Record<string, string> = {};
  for (const rule of governanceRules) {
    governanceMap[rule.rule_type] = rule.rule_value;
  }

  const existingAgents = getAgentsByTeam(teamId);
  const allAgentNames = [...existingAgents.map((a) => a.name), body.name];
  const contextFile = buildContextFile(teamId, body.name, body.role, allAgentNames, governanceMap);

  let tmuxSession: string | null = null;
  try {
    const result = await spawnAgent({
      sessionName,
      workingDir: agentWorkingDir,
      prompt: body.role,
      systemPrompt: body.system_prompt || undefined,
      model: body.model_tier,
      isolated: true,
      contextFile,
      governance: governanceMap,
      agentId,
      teamId,
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
    console.error(`Failed to spawn agent ${body.name}:`, error);
  }

  const agent = createAgent({
    id: agentId,
    team_id: teamId,
    name: body.name,
    role: body.role,
    model_tier: body.model_tier || "sonnet",
    system_prompt: body.system_prompt || null,
    status: tmuxSession ? "initializing" : "errored",
    tmux_session: tmuxSession,
  });

  createAuditEvent({
    team_id: teamId,
    agent_id: agentId,
    event_type: "agent_spawned",
    event_data: JSON.stringify({
      name: body.name,
      model_tier: body.model_tier,
      role: body.role,
    }),
  });

  return NextResponse.json(agent, { status: 201 });
}
