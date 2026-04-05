import { NextRequest, NextResponse } from "next/server";
import {
  getTeam,
  getAgentsByTeam,
  updateTeamStatus,
  createAuditEvent,
} from "@/lib/db";
import { interrupt } from "@/lib/tmux";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const team = getTeam(teamId);
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const agents = getAgentsByTeam(teamId);
  for (const agent of agents) {
    if (agent.tmux_session && agent.status === "working") {
      try {
        await interrupt(agent.tmux_session);
      } catch (error) {
        console.error(`Failed to interrupt agent ${agent.name}:`, error);
      }
    }
  }

  updateTeamStatus(teamId, "paused");

  createAuditEvent({
    team_id: teamId,
    event_type: "team_paused",
  });

  return NextResponse.json({ ok: true });
}
