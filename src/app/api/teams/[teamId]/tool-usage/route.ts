import { NextRequest, NextResponse } from "next/server";
import { getToolUsageByTeam } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const tools = getToolUsageByTeam(teamId);
  return NextResponse.json({ tools });
}
