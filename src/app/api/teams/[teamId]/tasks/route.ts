import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  getTasksByTeam,
  getAgentsByTeam,
  createTask,
  updateTaskStatus,
  createAuditEvent,
} from "@/lib/db";
import { sendInput } from "@/lib/tmux";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  return NextResponse.json(getTasksByTeam(teamId));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const body = await request.json();

  // Find an agent to assign to (prefer specified, else first available)
  const agents = getAgentsByTeam(teamId);
  const assignedAgent = body.assigned_agent_id
    ? agents.find((a) => a.id === body.assigned_agent_id)
    : agents.find((a) => a.status === "working" || a.status === "idle") || agents[0];

  const taskId = uuidv4();
  const task = createTask({
    id: taskId,
    team_id: teamId,
    title: body.title,
    description: body.description || null,
    assigned_agent_id: assignedAgent?.id || null,
    created_by_agent_id: body.created_by_agent_id || null,
    parent_task_id: body.parent_task_id || null,
    status: "pending",
  });

  createAuditEvent({
    team_id: teamId,
    event_type: "task_created",
    event_data: JSON.stringify({ title: body.title, assigned_to: assignedAgent?.name }),
  });

  // Send the task to the assigned agent as a message
  if (assignedAgent?.tmux_session) {
    try {
      const taskPrompt = body.description
        ? `Task: ${body.title}\n\n${body.description}`
        : `Task: ${body.title}`;
      await sendInput(assignedAgent.tmux_session, taskPrompt);
      updateTaskStatus(taskId, "in_progress");
      createAuditEvent({
        team_id: teamId,
        agent_id: assignedAgent.id,
        event_type: "task_assigned",
        event_data: JSON.stringify({ task_id: taskId, title: body.title }),
      });
    } catch (error) {
      console.error("Failed to send task to agent:", error);
    }
  }

  return NextResponse.json(task, { status: 201 });
}
