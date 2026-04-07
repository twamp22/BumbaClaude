import { getDueSchedules, updateSchedule, getAgent, createAuditEvent } from "./db";
import { sendInput } from "./tmux";
import { broadcast } from "./websocket";

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startScheduler(): void {
  if (intervalId) return;
  intervalId = setInterval(tick, 10000); // Check every 10 seconds
  console.error("[scheduler] Started");
}

export function stopScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.error("[scheduler] Stopped");
  }
}

async function tick(): Promise<void> {
  let dueSchedules;
  try {
    dueSchedules = getDueSchedules();
  } catch {
    return; // DB not ready
  }

  for (const schedule of dueSchedules) {
    const agent = getAgent(schedule.agent_id);
    if (!agent || !agent.tmux_session) continue;
    if (agent.status === "completed" || agent.status === "errored") continue;

    try {
      await sendInput(agent.tmux_session, `[SCHEDULED] ${schedule.name}: ${schedule.message}`);

      const now = new Date().toISOString();
      updateSchedule(schedule.id, {
        last_run_at: now,
        run_count: schedule.run_count + 1,
      });

      createAuditEvent({
        team_id: schedule.team_id,
        agent_id: schedule.agent_id,
        event_type: "schedule_fired",
        event_data: JSON.stringify({
          schedule_id: schedule.id,
          name: schedule.name,
          run_count: schedule.run_count + 1,
        }),
      });

      broadcast(schedule.team_id, {
        type: "schedule_fired",
        agentId: schedule.agent_id,
        data: { scheduleId: schedule.id, name: schedule.name },
      });
    } catch (error) {
      console.error(`[scheduler] Failed to fire schedule ${schedule.name}:`, error);
    }
  }
}
