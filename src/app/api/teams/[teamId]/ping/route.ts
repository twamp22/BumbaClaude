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
  const {
    from_agent_name,
    to_agent_name,
    task_title,
    task_description,
    tas_file,
    parent_task_id,
    ping_type = "assignment", // "assignment" | "status_update" | "completion"
  } = body;

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

  const tasks = getTasksByTeam(teamId);

  // --- Handle "completion" pings: mark the from_agent's task as completed ---
  if (ping_type === "completion") {
    // Find the from_agent's in_progress or review task and complete it
    if (fromAgent) {
      const agentTask = tasks.find(
        (t) => t.assigned_agent_id === fromAgent.id &&
          (t.status === "in_progress" || t.status === "review")
      );
      if (agentTask) {
        updateTaskStatus(agentTask.id, "completed");
        createAuditEvent({
          team_id: teamId,
          agent_id: fromAgent.id,
          event_type: "task_completed",
          event_data: JSON.stringify({ task_id: agentTask.id, title: agentTask.title }),
        });
      }
    }

    // Just wake the target agent with the message, no new task
    if (toAgent.tmux_session) {
      try {
        let msg = `PING from ${from_agent_name || "User"}: ${task_title || "Task completed"}`;
        if (task_description) msg += `\n\nDetails: ${task_description}`;
        if (tas_file) msg += `\n\nFile: ${tas_file}`;
        await sendInput(toAgent.tmux_session, msg);
      } catch (error) {
        console.error(`Failed to ping agent ${toAgent.name}:`, error);
      }
    }

    createAuditEvent({
      team_id: teamId,
      agent_id: fromAgent?.id || null,
      event_type: "agent_ping",
      event_data: JSON.stringify({
        ping_type: "completion",
        from: from_agent_name,
        to: to_agent_name,
        task_title,
      }),
    });

    return NextResponse.json({ ok: true, ping_type: "completion", pinged: toAgent.name });
  }

  // --- Handle "status_update" pings: just wake the agent, no new task ---
  if (ping_type === "status_update") {
    if (toAgent.tmux_session) {
      try {
        let msg = `UPDATE from ${from_agent_name || "User"}: ${task_title || "Status update"}`;
        if (task_description) msg += `\n\nDetails: ${task_description}`;
        if (tas_file) msg += `\n\nFile: ${tas_file}`;
        await sendInput(toAgent.tmux_session, msg);
      } catch (error) {
        console.error(`Failed to ping agent ${toAgent.name}:`, error);
      }
    }

    createAuditEvent({
      team_id: teamId,
      agent_id: fromAgent?.id || null,
      event_type: "agent_ping",
      event_data: JSON.stringify({
        ping_type: "status_update",
        from: from_agent_name,
        to: to_agent_name,
        task_title,
      }),
    });

    return NextResponse.json({ ok: true, ping_type: "status_update", pinged: toAgent.name });
  }

  // --- Handle "assignment" pings: create a new task and wake agent ---

  // Find parent: use explicit parent_task_id, or auto-detect from_agent's current task
  let resolvedParentId = parent_task_id || null;
  if (!resolvedParentId && fromAgent) {
    // Only link to a direct top-level or first-level task, not sub-tasks
    const agentTask = tasks.find(
      (t) => t.assigned_agent_id === fromAgent.id &&
        (t.status === "in_progress" || t.status === "review") &&
        !t.parent_task_id
    );
    if (agentTask) {
      // Move parent to review
      updateTaskStatus(agentTask.id, "review");
      resolvedParentId = agentTask.id;
      createAuditEvent({
        team_id: teamId,
        agent_id: fromAgent.id,
        event_type: "task_status_changed",
        event_data: JSON.stringify({
          task_id: agentTask.id,
          from: agentTask.status,
          to: "review",
          reason: `Handed off to ${to_agent_name}`,
        }),
      });
    }
  }

  const taskId = uuidv4();
  const task = createTask({
    id: taskId,
    team_id: teamId,
    title: task_title || `Task from ${from_agent_name || "User"}`,
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
      ping_type: "assignment",
      from: from_agent_name || "User",
      to: to_agent_name,
      task_id: taskId,
      parent_task_id: resolvedParentId,
      task_title,
    }),
  });

  // Wake the target agent
  if (toAgent.tmux_session) {
    try {
      let pingMessage = `PING from ${from_agent_name || "User"}: ${task_title || "New task assigned"}`;
      if (task_description) pingMessage += `\n\nDetails: ${task_description}`;
      if (tas_file) pingMessage += `\n\nFile ready at: ${tas_file}`;
      pingMessage += `\n\nPlease begin working on this immediately.`;

      await sendInput(toAgent.tmux_session, pingMessage);
      updateTaskStatus(taskId, "in_progress");
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
