import { NextRequest, NextResponse } from "next/server";
import {
  getTeam,
  getAgentsByTeam,
  getTasksByTeam,
  getGovernanceRules,
  getAuditEvents,
  updateTeamStatus,
  updateAgentStatus,
  updateTaskStatus,
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
  const events = getAuditEvents(teamId, { limit: 100 });

  // Reconcile agent/task state inconsistencies
  for (const agent of agents) {
    const agentInProgressTasks = tasks.filter(
      (t) => t.assigned_agent_id === agent.id && t.status === "in_progress"
    );
    const agentPendingTasks = tasks.filter(
      (t) => t.assigned_agent_id === agent.id &&
        (t.status === "pending" || t.status === "claimed")
    );

    if (agent.status === "idle" && agentInProgressTasks.length > 0) {
      // Agent is idle but has in_progress tasks -- tasks are orphaned, mark them blocked
      for (const task of agentInProgressTasks) {
        updateTaskStatus(task.id, "blocked");
        task.status = "blocked";
      }
    } else if (
      agent.status === "working" &&
      agentInProgressTasks.length === 0 &&
      agentPendingTasks.length === 0
    ) {
      // Agent claims working but has no active tasks -- mark idle
      updateAgentStatus(agent.id, "idle");
      agent.status = "idle";
    }
  }

  // Enrich events with agent names
  const enrichedEvents = events.map((event) => {
    const agent = event.agent_id
      ? agents.find((a) => a.id === event.agent_id)
      : null;
    return {
      ...event,
      agent_name: agent?.name || null,
    };
  });

  return NextResponse.json({ team, agents, tasks, governance, events: enrichedEvents });
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
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const team = getTeam(teamId);
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const purge = request.nextUrl.searchParams.get("purge") === "true";
  const agents = getAgentsByTeam(teamId);
  const tasks = getTasksByTeam(teamId);

  // Stop all running agents
  for (const agent of agents) {
    if (agent.status !== "completed" && agent.status !== "errored") {
      updateAgentStatus(agent.id, "completed");
    }
    if (agent.tmux_session) {
      try {
        await killPane(agent.tmux_session);
      } catch {
        // Process may already be dead
      }
    }
  }

  // Cancel orphaned tasks
  for (const task of tasks) {
    if (task.status === "in_progress" || task.status === "pending" || task.status === "claimed" || task.status === "review") {
      updateTaskStatus(task.id, "cancelled");
    }
  }

  if (purge) {
    createAuditEvent({
      team_id: teamId,
      event_type: "team_deleted",
      event_data: JSON.stringify({
        name: team.name,
        project_dir: team.project_dir,
        agent_count: agents.length,
      }),
    });
    cleanupTeamFiles(teamId);
    deleteTeam(teamId);
  } else {
    updateTeamStatus(teamId, "completed");
    createAuditEvent({
      team_id: teamId,
      event_type: "team_killed",
      event_data: JSON.stringify({ reason: "manual" }),
    });
  }

  return NextResponse.json({ ok: true });
}
