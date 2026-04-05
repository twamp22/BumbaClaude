import { NextRequest, NextResponse } from "next/server";
import {
  getTeam,
  getAgentsByTeam,
  updateTeamStatus,
  updateAgentStatus,
  createAuditEvent,
} from "@/lib/db";
import { killPane } from "@/lib/tmux";
import { stopWatching } from "@/lib/watcher";

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
    if (agent.tmux_session) {
      try {
        await killPane(agent.tmux_session);
      } catch (error) {
        console.error(`Failed to kill agent ${agent.name}:`, error);
      }
    }
    if (agent.status !== "completed" && agent.status !== "errored") {
      updateAgentStatus(agent.id, "completed");
    }
  }

  updateTeamStatus(teamId, "completed");
  stopWatching(team.name);

  createAuditEvent({
    team_id: teamId,
    event_type: "team_killed",
    event_data: JSON.stringify({ reason: "manual" }),
  });

  return NextResponse.json({ ok: true });
}
