import { NextRequest, NextResponse } from "next/server";
import { getMcpServersByTeam } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const servers = getMcpServersByTeam(teamId);
  return NextResponse.json({ servers });
}
