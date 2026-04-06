import { NextRequest, NextResponse } from "next/server";
import {
  getAgent,
  getTasksByTeam,
  updateAgentStatus,
  createAuditEvent,
} from "@/lib/db";
import { captureOutput } from "@/lib/tmux";

// Track output length per agent to detect new output between polls
const lastOutputLength = new Map<string, number>();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; agentId: string }> }
) {
  const { teamId, agentId } = await params;
  const agent = getAgent(agentId);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  if (!agent.tmux_session) {
    return NextResponse.json({ error: "Agent has no tmux session" }, { status: 400 });
  }

  const lines = parseInt(request.nextUrl.searchParams.get("lines") || "50");
  try {
    const output = await captureOutput(agent.tmux_session, lines);

    // Watchdog: detect agent producing output without a tracked in_progress task
    const prevLength = lastOutputLength.get(agentId) || 0;
    const currentLength = output.length;
    const isProducingOutput = currentLength > prevLength && currentLength - prevLength > 10;
    lastOutputLength.set(agentId, currentLength);

    if (isProducingOutput && agent.status === "idle") {
      // Grace period: don't flag agents during initial boot-up (first 60 seconds)
      const spawnedAt = new Date(agent.spawned_at).getTime();
      const elapsed = Date.now() - spawnedAt;
      const BOOT_GRACE_PERIOD_MS = 60_000;

      if (elapsed > BOOT_GRACE_PERIOD_MS) {
        const tasks = getTasksByTeam(teamId);
        const hasActiveTask = tasks.some(
          (t) => t.assigned_agent_id === agentId &&
            (t.status === "in_progress" || t.status === "claimed")
        );

        if (!hasActiveTask) {
          // Agent is working but didn't send a start ping -- flag it
          updateAgentStatus(agentId, "working");
          createAuditEvent({
            team_id: teamId,
            agent_id: agentId,
            event_type: "watchdog_no_start_ping",
            event_data: JSON.stringify({
              agent_name: agent.name,
              message: "Agent is producing output without a start ping or tracked task",
            }),
          });
        }
      }
    }

    return NextResponse.json({ output });
  } catch (error) {
    console.error(`Failed to capture output for agent ${agentId}:`, error);
    return NextResponse.json({ output: "" });
  }
}
