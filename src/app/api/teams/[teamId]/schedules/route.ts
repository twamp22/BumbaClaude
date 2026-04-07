import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getSchedulesByTeam, createSchedule, getTeam, getAgent, createAuditEvent } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const schedules = getSchedulesByTeam(teamId);
  return NextResponse.json({ schedules });
}

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
  const { agent_id, name, schedule_type, schedule_value, message } = body;

  const agent = getAgent(agent_id);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const schedule = createSchedule({
    id: uuidv4(),
    team_id: teamId,
    agent_id: agent_id,
    name,
    schedule_type,
    schedule_value: String(schedule_value),
    message,
    enabled: 1,
  });

  createAuditEvent({
    team_id: teamId,
    agent_id: agent_id,
    event_type: "schedule_created",
    event_data: JSON.stringify({ schedule_id: schedule.id, name, schedule_type, schedule_value }),
  });

  return NextResponse.json(schedule, { status: 201 });
}
