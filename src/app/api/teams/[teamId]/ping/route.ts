import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  getTeam,
  getAgentsByTeam,
  getTasksByTeam,
  createTask,
  updateTaskStatus,
  updateAgentStatus,
  createAuditEvent,
} from "@/lib/db";
import { sendInput } from "@/lib/tmux";
import { broadcast } from "@/lib/websocket";

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
    task_id,
    ping_type = "assignment", // "assignment" | "start" | "completion" | "status_update"
  } = body;

  const agents = getAgentsByTeam(teamId);
  const fromAgent = agents.find(
    (a) => a.name.toLowerCase() === from_agent_name?.toLowerCase()
  );
  const toAgent = agents.find(
    (a) => a.name.toLowerCase() === to_agent_name?.toLowerCase()
  );

  // For start and completion pings, to_agent is optional
  // (start = self-announcement; completion without target = operator-assigned task)
  if (!toAgent && ping_type !== "start" && ping_type !== "completion") {
    return NextResponse.json(
      { error: `Agent "${to_agent_name}" not found on this team` },
      { status: 404 }
    );
  }

  const tasks = getTasksByTeam(teamId);

  // --- Handle "start" pings: agent announces it is beginning work on a task ---
  if (ping_type === "start") {
    if (fromAgent) {
      // Find the task to mark as in_progress.
      // Check pending/claimed first, then fall back to already in_progress
      // (assignment pings set tasks to in_progress immediately).
      let targetTask = task_id
        ? tasks.find((t) => t.id === task_id)
        : tasks.find(
            (t) => t.assigned_agent_id === fromAgent.id &&
              (t.status === "pending" || t.status === "claimed")
          ) || tasks.find(
            (t) => t.assigned_agent_id === fromAgent.id &&
              t.status === "in_progress"
          );

      if (targetTask && targetTask.status !== "in_progress") {
        updateTaskStatus(targetTask.id, "in_progress");
      }

      // Update agent status to working
      updateAgentStatus(fromAgent.id, "working");

      createAuditEvent({
        team_id: teamId,
        agent_id: fromAgent.id,
        event_type: "task_started",
        event_data: JSON.stringify({
          task_id: targetTask?.id || null,
          title: task_title || targetTask?.title || "Unknown task",
          agent_name: fromAgent.name,
        }),
      });

      // Broadcast real-time event
      broadcast(teamId, {
        type: "task_started",
        agentId: fromAgent.id,
        data: {
          task_id: targetTask?.id || null,
          title: task_title || targetTask?.title || "Unknown task",
          agent_name: fromAgent.name,
        },
      });

      // If there's a different target agent to notify, wake them (skip self-pings)
      if (toAgent && toAgent.tmux_session && toAgent.id !== fromAgent.id) {
        try {
          const msg = `[AGENT UPDATE] ${from_agent_name} has STARTED working on: ${task_title || targetTask?.title || "a task"}`;
          await sendInput(toAgent.tmux_session, msg);
        } catch (error) {
          console.error(`Failed to notify agent ${toAgent.name}:`, error);
        }
      }
    }

    return NextResponse.json({ ok: true, ping_type: "start", agent: from_agent_name });
  }

  // --- Handle "completion" pings: mark the from_agent's task as completed ---
  if (ping_type === "completion") {
    let completedTask: typeof tasks[number] | null | undefined = null;

    if (fromAgent) {
      // Use explicit task_id if provided, otherwise find the agent's current task.
      // If task_id is given but not found, fall through to heuristic matching
      // (agents sometimes send malformed or stale task IDs).
      if (task_id) {
        completedTask = tasks.find((t) => t.id === task_id);
      }
      if (!completedTask) {
        // Heuristic: match by title first, then first in_progress/review
        completedTask = tasks.find(
          (t) => t.assigned_agent_id === fromAgent.id &&
            (t.status === "in_progress" || t.status === "review") &&
            task_title && t.title.toLowerCase().includes(task_title.toLowerCase())
        ) || tasks.find(
          (t) => t.assigned_agent_id === fromAgent.id &&
            (t.status === "in_progress" || t.status === "review")
        );
      }

      if (completedTask) {
        updateTaskStatus(completedTask.id, "completed");
        createAuditEvent({
          team_id: teamId,
          agent_id: fromAgent.id,
          event_type: "task_completed",
          event_data: JSON.stringify({
            task_id: completedTask.id,
            title: completedTask.title,
            agent_name: fromAgent.name,
          }),
        });

        // Broadcast real-time event
        broadcast(teamId, {
          type: "task_completed",
          agentId: fromAgent.id,
          data: {
            task_id: completedTask.id,
            title: completedTask.title,
            agent_name: fromAgent.name,
          },
        });
      }

      // Agent declared completion -- set to idle.
      // Re-query tasks to get fresh state after the update above.
      const freshTasks = getTasksByTeam(teamId);
      const remainingTasks = freshTasks.filter(
        (t) => t.assigned_agent_id === fromAgent.id &&
          (t.status === "in_progress" || t.status === "claimed" || t.status === "pending")
      );
      if (remainingTasks.length === 0) {
        updateAgentStatus(fromAgent.id, "idle");
      }
    }

    // Wake the target agent with the message
    if (toAgent && toAgent.tmux_session) {
      try {
        let msg = `[AGENT PING] COMPLETED by ${from_agent_name || "User"}: ${task_title || completedTask?.title || "Task completed"}`;
        if (task_description) msg += `\nDetails: ${task_description}`;
        if (tas_file) msg += `\nFile: ${tas_file}`;
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
        task_id: completedTask?.id || task_id || null,
        task_title: completedTask?.title || task_title,
      }),
    });

    return NextResponse.json({
      ok: true,
      ping_type: "completion",
      pinged: toAgent?.name || null,
      completed_task_id: completedTask?.id || null,
    });
  }

  // --- Handle "status_update" pings: just wake the agent, no new task ---
  if (ping_type === "status_update") {
    if (toAgent && toAgent.tmux_session) {
      try {
        let msg = `[AGENT UPDATE] From ${from_agent_name || "User"}: ${task_title || "Status update"}`;
        if (task_description) msg += `\nDetails: ${task_description}`;
        if (tas_file) msg += `\nFile: ${tas_file}`;
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

    return NextResponse.json({ ok: true, ping_type: "status_update", pinged: toAgent?.name || null });
  }

  // --- Handle "assignment" pings: create a new task and wake agent ---

  if (!toAgent) {
    return NextResponse.json(
      { error: `Agent "${to_agent_name}" not found on this team` },
      { status: 404 }
    );
  }

  // Find parent: use explicit parent_task_id, or auto-detect from_agent's current task
  let resolvedParentId = parent_task_id || null;
  if (!resolvedParentId && fromAgent) {
    const agentTask = tasks.find(
      (t) => t.assigned_agent_id === fromAgent.id &&
        (t.status === "in_progress" || t.status === "review") &&
        !t.parent_task_id
    );
    if (agentTask) {
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

  const newTaskId = uuidv4();
  const task = createTask({
    id: newTaskId,
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
    event_type: "task_assigned",
    event_data: JSON.stringify({
      ping_type: "assignment",
      from: from_agent_name || "User",
      to: to_agent_name,
      task_id: newTaskId,
      parent_task_id: resolvedParentId,
      task_title: task_title || `Task from ${from_agent_name || "User"}`,
    }),
  });

  // Broadcast real-time event
  broadcast(teamId, {
    type: "task_assigned",
    agentId: toAgent.id,
    data: {
      task_id: newTaskId,
      title: task_title || `Task from ${from_agent_name || "User"}`,
      from: from_agent_name || "User",
      to: to_agent_name,
    },
  });

  // Wake the target agent
  if (toAgent.tmux_session) {
    try {
      let pingMessage = `[AGENT PING] NEW ASSIGNMENT from ${from_agent_name || "User"}: ${task_title || "New task assigned"}`;
      if (task_description) pingMessage += `\nDetails: ${task_description}`;
      if (tas_file) pingMessage += `\nFile ready at: ${tas_file}`;
      pingMessage += `\nTask ID: ${newTaskId}`;

      await sendInput(toAgent.tmux_session, pingMessage);
      updateTaskStatus(newTaskId, "in_progress");
      updateAgentStatus(toAgent.id, "working");
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
