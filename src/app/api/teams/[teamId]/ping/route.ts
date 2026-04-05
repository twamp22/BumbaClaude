import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  getTeam,
  getAgentsByTeam,
  getTasksByTeam,
  createTask,
  updateTaskStatus,
  createAuditEvent,
} from "@/lib/db";
import { sendInput } from "@/lib/tmux";

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
  const { from_agent_name, to_agent_name, task_title, task_description, tas_file, parent_task_id } = body;

  const agents = getAgentsByTeam(teamId);
  const fromAgent = agents.find(
    (a) => a.name.toLowerCase() === from_agent_name?.toLowerCase()
  );
  const toAgent = agents.find(
    (a) => a.name.toLowerCase() === to_agent_name.toLowerCase()
  );

  if (!toAgent) {
    return NextResponse.json(
      { error: `Agent "${to_agent_name}" not found on this team` },
      { status: 404 }
    );
  }

  // Auto-detect parent task: if from_agent has an in_progress task, use it as parent
  let resolvedParentId = parent_task_id || null;
  if (!resolvedParentId && fromAgent) {
    const tasks = getTasksByTeam(teamId);
    const agentInProgress = tasks.find(
      (t) => t.assigned_agent_id === fromAgent.id && t.status === "in_progress"
    );
    if (agentInProgress) {
      resolvedParentId = agentInProgress.id;
      // Move parent task to "review" since the agent is handing off work
      updateTaskStatus(agentInProgress.id, "review");
      createAuditEvent({
        team_id: teamId,
        agent_id: fromAgent.id,
        event_type: "task_status_changed",
        event_data: JSON.stringify({
          task_id: agentInProgress.id,
          from: "in_progress",
          to: "review",
          reason: `Handed off to ${to_agent_name}`,
        }),
      });
    }
  }

  // Create a sub-task linked to the parent
  const taskId = uuidv4();
  const task = createTask({
    id: taskId,
    team_id: teamId,
    title: task_title || `Ping from ${from_agent_name || "User"}`,
    description: task_description || null,
    assigned_agent_id: toAgent.id,
    created_by_agent_id: fromAgent?.id || null,
    parent_task_id: resolvedParentId,
    status: "pending",
  });

  createAuditEvent({
    team_id: teamId,
    agent_id: fromAgent?.id || null,
    event_type: "agent_ping",
    event_data: JSON.stringify({
      from: from_agent_name || "User",
      to: to_agent_name,
      task_id: taskId,
      parent_task_id: resolvedParentId,
      task_title: task_title,
      tas_file,
    }),
  });

  // Wake the target agent with the task
  if (toAgent.tmux_session) {
    try {
      let pingMessage = `PING from ${from_agent_name || "User"}: ${task_title || "New task assigned"}`;
      if (task_description) {
        pingMessage += `\n\nDetails: ${task_description}`;
      }
      if (tas_file) {
        pingMessage += `\n\nFile ready at: ${tas_file}`;
      }
      pingMessage += `\n\nPlease begin working on this immediately.`;

      await sendInput(toAgent.tmux_session, pingMessage);
      updateTaskStatus(taskId, "in_progress");

      createAuditEvent({
        team_id: teamId,
        agent_id: toAgent.id,
        event_type: "agent_pinged",
        event_data: JSON.stringify({
          from: from_agent_name || "User",
          task_id: taskId,
          parent_task_id: resolvedParentId,
        }),
      });
    } catch (error) {
      console.error(`Failed to ping agent ${toAgent.name}:`, error);
      return NextResponse.json(
        { error: `Failed to wake agent: ${toAgent.name}` },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({ ok: true, task, pinged: toAgent.name, parent_task_id: resolvedParentId });
}
