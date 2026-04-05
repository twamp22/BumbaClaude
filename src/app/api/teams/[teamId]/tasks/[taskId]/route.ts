import { NextRequest, NextResponse } from "next/server";
import { updateTaskStatus, createAuditEvent } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; taskId: string }> }
) {
  const { teamId, taskId } = await params;
  const body = await request.json();
  const { status } = body;

  updateTaskStatus(taskId, status);

  createAuditEvent({
    team_id: teamId,
    event_type: "task_status_changed",
    event_data: JSON.stringify({ task_id: taskId, status }),
  });

  return NextResponse.json({ ok: true });
}
