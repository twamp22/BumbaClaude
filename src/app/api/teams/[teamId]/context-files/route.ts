import { NextRequest, NextResponse } from "next/server";
import { getTeam } from "@/lib/db";
import fs from "fs";
import path from "path";

const CONTEXT_FILE_PATTERNS = [
  "CLAUDE.md",
  ".claude/CLAUDE.md",
  ".claude/settings.json",
  ".claude/commands",
  "SOUL.md",
  "AGENTS.md",
  "CONTRIBUTING.md",
  "CONVENTIONS.md",
  "ARCHITECTURE.md",
  "CODING_GUIDELINES.md",
  ".cursorrules",
  ".windsurfrules",
  ".github/copilot-instructions.md",
  "CLAUDE.local.md",
  ".claude/CLAUDE.local.md",
];

interface ContextFile {
  name: string;
  path: string;
  relativePath: string;
  size: number;
  content: string;
  exists: boolean;
}

function findContextFiles(projectDir: string): ContextFile[] {
  const results: ContextFile[] = [];

  for (const pattern of CONTEXT_FILE_PATTERNS) {
    const fullPath = path.join(projectDir, pattern);
    const exists = fs.existsSync(fullPath);

    if (exists) {
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) {
        const content = fs.readFileSync(fullPath, "utf-8");
        results.push({
          name: path.basename(pattern),
          path: fullPath,
          relativePath: pattern,
          size: stat.size,
          content,
          exists: true,
        });
      }
    }
  }

  // Also scan for any *.md files in .claude/ directory
  const claudeDir = path.join(projectDir, ".claude");
  if (fs.existsSync(claudeDir) && fs.statSync(claudeDir).isDirectory()) {
    const files = fs.readdirSync(claudeDir);
    for (const file of files) {
      const relativePath = `.claude/${file}`;
      // Skip already found files
      if (results.some((r) => r.relativePath === relativePath)) continue;

      const fullPath = path.join(claudeDir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isFile() && (file.endsWith(".md") || file.endsWith(".json"))) {
        const content = fs.readFileSync(fullPath, "utf-8");
        results.push({
          name: file,
          path: fullPath,
          relativePath,
          size: stat.size,
          content,
          exists: true,
        });
      }
    }
  }

  return results;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const team = getTeam(teamId);
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  if (!fs.existsSync(team.project_dir)) {
    return NextResponse.json({ files: [], project_dir: team.project_dir });
  }

  const files = findContextFiles(team.project_dir);
  return NextResponse.json({ files, project_dir: team.project_dir });
}
