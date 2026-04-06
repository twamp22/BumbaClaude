import { NextRequest, NextResponse } from "next/server";
import { getTeam } from "@/lib/db";
import fs from "fs";
import path from "path";
import { getTeamMemoryDir } from "@/lib/tmux";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const team = getTeam(teamId);
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const memoryDir = getTeamMemoryDir(team.project_dir);
  const instructionsPath = path.join(memoryDir, "instructions.md");

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

  const memoryDir = getTeamMemoryDir(team.project_dir);
  if (!fs.existsSync(memoryDir)) {
    fs.mkdirSync(memoryDir, { recursive: true });
  }

  fs.writeFileSync(path.join(memoryDir, "instructions.md"), instructions || "");

  return NextResponse.json({ ok: true });
}
