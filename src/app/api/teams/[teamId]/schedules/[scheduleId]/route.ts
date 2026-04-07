import { NextRequest, NextResponse } from "next/server";
import { getSchedule, updateSchedule, deleteSchedule, createAuditEvent } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; scheduleId: string }> }
) {
  const { teamId, scheduleId } = await params;
  const schedule = getSchedule(scheduleId);
  if (!schedule) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }

  const body = await request.json();
  const updates: { enabled?: number } = {};
  if (body.enabled !== undefined) {
    updates.enabled = body.enabled ? 1 : 0;
  }

  updateSchedule(scheduleId, updates);

  createAuditEvent({
    team_id: teamId,
    event_type: "schedule_updated",
    event_data: JSON.stringify({ schedule_id: scheduleId, ...updates }),
  });

  return NextResponse.json(getSchedule(scheduleId));
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string; scheduleId: string }> }
) {
  const { teamId, scheduleId } = await params;
  const schedule = getSchedule(scheduleId);
  if (!schedule) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }

  createAuditEvent({
    team_id: teamId,
    event_type: "schedule_deleted",
    event_data: JSON.stringify({ schedule_id: scheduleId, name: schedule.name }),
  });

  deleteSchedule(scheduleId);
  return NextResponse.json({ ok: true });
}
