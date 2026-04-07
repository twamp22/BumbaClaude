import { NextRequest, NextResponse } from "next/server";
import { getTokenUsageByTeam, getTokenUsageSummaryByTeam } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const usage = getTokenUsageByTeam(teamId);
  const summary = getTokenUsageSummaryByTeam(teamId);
  return NextResponse.json({ usage, summary });
}
