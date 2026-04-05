import { NextRequest, NextResponse } from "next/server";
import { getAuditEvents } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const searchParams = request.nextUrl.searchParams;

  const filters: { agentId?: string; eventType?: string; limit?: number } = {};
  if (searchParams.has("agentId")) filters.agentId = searchParams.get("agentId")!;
  if (searchParams.has("eventType")) filters.eventType = searchParams.get("eventType")!;
  if (searchParams.has("limit")) filters.limit = parseInt(searchParams.get("limit")!);

  return NextResponse.json(getAuditEvents(teamId, filters));
}
