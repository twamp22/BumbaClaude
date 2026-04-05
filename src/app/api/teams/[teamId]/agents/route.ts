import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getAgentsByTeam, getTeam, createAgent, createAuditEvent } from "@/lib/db";
import { spawnAgent } from "@/lib/tmux";

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

  let tmuxSession: string | null = null;
  try {
    const result = await spawnAgent({
      sessionName,
      workingDir: team.project_dir,
      prompt: body.role,
      systemPrompt: body.system_prompt || undefined,
      model: body.model_tier,
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
    status: tmuxSession ? "working" : "errored",
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
