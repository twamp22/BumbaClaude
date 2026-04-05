import { NextRequest, NextResponse } from "next/server";
import { getTeam } from "@/lib/db";
import { getTASContents } from "@/lib/tas";
import fs from "fs";
import path from "path";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const team = getTeam(teamId);
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const contents = getTASContents(team.project_dir);
  return NextResponse.json(contents);
}

// Read a specific file from TAS
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const team = getTeam(teamId);
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const body = await request.json();
  const { filePath } = body;

  // Security: ensure the path is within the team's TAS directory
  const tasDir = path.join(team.project_dir, "TAS");
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(tasDir))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  if (!fs.existsSync(resolved)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const content = fs.readFileSync(resolved, "utf-8");
  return NextResponse.json({ content });
}
