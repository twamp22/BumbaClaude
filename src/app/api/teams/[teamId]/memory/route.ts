import { NextRequest, NextResponse } from "next/server";
import { getTeam } from "@/lib/db";
import fs from "fs";
import path from "path";
import { MEMORY_DIR } from "@/lib/tmux";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const team = getTeam(teamId);
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const teamDir = path.join(MEMORY_DIR, teamId);
  const instructionsPath = path.join(teamDir, "instructions.md");

  const instructions = fs.existsSync(instructionsPath)
    ? fs.readFileSync(instructionsPath, "utf-8")
    : "";

  return NextResponse.json({ instructions });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const team = getTeam(teamId);
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const body = await request.json();
  const { instructions } = body;

  const teamDir = path.join(MEMORY_DIR, teamId);
  if (!fs.existsSync(teamDir)) {
    fs.mkdirSync(teamDir, { recursive: true });
  }

  fs.writeFileSync(path.join(teamDir, "instructions.md"), instructions || "");

  return NextResponse.json({ ok: true });
}
