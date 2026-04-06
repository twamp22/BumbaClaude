import { NextRequest, NextResponse } from "next/server";
import {
  getTeam,
  getAgentsByTeam,
  getTasksByTeam,
  getGovernanceRules,
  updateTeamStatus,
  createAuditEvent,
  deleteTeam,
} from "@/lib/db";
import { killPane } from "@/lib/tmux";
import { cleanupTeamFiles } from "@/lib/tas";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const team = getTeam(teamId);
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const agents = getAgentsByTeam(teamId);
  const tasks = getTasksByTeam(teamId);
  const governance = getGovernanceRules(teamId);

  return NextResponse.json({ team, agents, tasks, governance });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const body = await request.json();
  const { status } = body;

  const team = getTeam(teamId);
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  updateTeamStatus(teamId, status);

  createAuditEvent({
    team_id: teamId,
    event_type: "team_status_changed",
    event_data: JSON.stringify({ from: team.status, to: status }),
  });

  return NextResponse.json(getTeam(teamId));
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const team = getTeam(teamId);
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  // Kill any running agents first
  const agents = getAgentsByTeam(teamId);
  for (const agent of agents) {
    if (agent.tmux_session) {
      try {
        await killPane(agent.tmux_session);
      } catch {
        // Process may already be dead
      }
    }
  }

  // Audit the deletion before removing DB rows
  createAuditEvent({
    team_id: teamId,
    event_type: "team_deleted",
    event_data: JSON.stringify({
      name: team.name,
      project_dir: team.project_dir,
      agent_count: agents.length,
    }),
  });

  // Clean up filesystem artifacts (TAS, BUMBA.md, context files, agent dirs)
  cleanupTeamFiles(team.project_dir, agents.map((a) => a.name));

  deleteTeam(teamId);
  return NextResponse.json({ ok: true });
}
