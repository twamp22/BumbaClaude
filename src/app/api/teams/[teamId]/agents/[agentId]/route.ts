import { NextRequest, NextResponse } from "next/server";
import { getAgent, updateAgentStatus, createAuditEvent } from "@/lib/db";
import { sendInput, interrupt } from "@/lib/tmux";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string; agentId: string }> }
) {
  const { agentId } = await params;
  const agent = getAgent(agentId);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
  return NextResponse.json(agent);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; agentId: string }> }
) {
  const { teamId, agentId } = await params;
  const body = await request.json();
  const { status } = body;

  const agent = getAgent(agentId);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  updateAgentStatus(agentId, status);

  createAuditEvent({
    team_id: teamId,
    agent_id: agentId,
    event_type: "agent_status_changed",
    event_data: JSON.stringify({ from: agent.status, to: status }),
  });

  return NextResponse.json(getAgent(agentId));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; agentId: string }> }
) {
  const { teamId, agentId } = await params;
  const body = await request.json();
  const { action, text } = body;

  const agent = getAgent(agentId);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  if (!agent.tmux_session) {
    return NextResponse.json({ error: "Agent has no tmux session" }, { status: 400 });
  }

  if (action === "message") {
    await sendInput(agent.tmux_session, text);
    createAuditEvent({
      team_id: teamId,
      agent_id: agentId,
      event_type: "message_sent",
      event_data: JSON.stringify({ text }),
    });
  } else if (action === "interrupt") {
    await interrupt(agent.tmux_session);
    createAuditEvent({
      team_id: teamId,
      agent_id: agentId,
      event_type: "agent_interrupted",
    });
  }

  return NextResponse.json({ ok: true });
}
