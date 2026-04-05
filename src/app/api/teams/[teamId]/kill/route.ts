import { NextRequest, NextResponse } from "next/server";
import {
  getTeam,
  getAgentsByTeam,
  updateTeamStatus,
  updateAgentStatus,
  createAuditEvent,
} from "@/lib/db";
import { killPane } from "@/lib/tmux";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const team = getTeam(teamId);
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  // Update all agent statuses first (DB is the source of truth)
  const agents = getAgentsByTeam(teamId);
  for (const agent of agents) {
    if (agent.status !== "completed" && agent.status !== "errored") {
      updateAgentStatus(agent.id, "completed");
    }
    // Best-effort process cleanup
    if (agent.tmux_session) {
      try {
        await killPane(agent.tmux_session);
      } catch {
        // Process may already be dead or never started
      }
    }
  }

  updateTeamStatus(teamId, "completed");

  createAuditEvent({
    team_id: teamId,
    event_type: "team_killed",
    event_data: JSON.stringify({ reason: "manual" }),
  });

  return NextResponse.json({ ok: true });
}
