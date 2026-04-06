import { NextRequest, NextResponse } from "next/server";
import { getAgent } from "@/lib/db";
import { captureOutput } from "@/lib/tmux";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; agentId: string }> }
) {
  const { agentId } = await params;
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
    return NextResponse.json({ output });
  } catch (error) {
    console.error(`Failed to capture output for agent ${agentId}:`, error);
    return NextResponse.json({ output: "" });
  }
}
