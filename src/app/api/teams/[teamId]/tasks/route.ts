import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getTasksByTeam, createTask, createAuditEvent } from "@/lib/db";

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

  const task = createTask({
    id: uuidv4(),
    team_id: teamId,
    title: body.title,
    description: body.description || null,
    assigned_agent_id: body.assigned_agent_id || null,
    status: "pending",
  });

  createAuditEvent({
    team_id: teamId,
    event_type: "task_created",
    event_data: JSON.stringify({ title: body.title }),
  });

  return NextResponse.json(task, { status: 201 });
}
