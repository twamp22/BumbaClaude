import { NextRequest, NextResponse } from "next/server";
import { getTeam, getAuditEvents, getAgentsByTeam } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const team = getTeam(teamId);
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const eventType = url.searchParams.get("type") || undefined;

  const events = getAuditEvents(teamId, { eventType, limit });
  const agents = getAgentsByTeam(teamId);

  // Enrich events with agent names
  const enriched = events.map((event) => {
    const agent = event.agent_id
      ? agents.find((a) => a.id === event.agent_id)
      : null;
    return {
      ...event,
      agent_name: agent?.name || null,
    };
  });

  return NextResponse.json({ events: enriched });
}
