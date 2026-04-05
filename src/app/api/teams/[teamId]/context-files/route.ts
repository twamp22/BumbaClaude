import { NextRequest, NextResponse } from "next/server";
import { getTeam } from "@/lib/db";
import fs from "fs";
import path from "path";
import os from "os";

// Files Claude Code looks for in each directory
const DIR_CONTEXT_FILES = [
  "CLAUDE.md",
  "CLAUDE.local.md",
  "SOUL.md",
  "AGENTS.md",
  "CONTRIBUTING.md",
  "CONVENTIONS.md",
  "ARCHITECTURE.md",
  "CODING_GUIDELINES.md",
  ".cursorrules",
  ".windsurfrules",
  ".github/copilot-instructions.md",
];

// Files in .claude/ subdirectory
const CLAUDE_DIR_FILES = [
  "CLAUDE.md",
  "CLAUDE.local.md",
  "settings.json",
  "settings.local.json",
];

interface ContextFile {
  name: string;
  fullPath: string;
  displayPath: string;
  source: "project" | "ancestor" | "global";
  size: number;
  content: string;
}

function tryReadFile(filePath: string): { size: number; content: string } | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return null;
    return { size: stat.size, content: fs.readFileSync(filePath, "utf-8") };
  } catch {
    return null;
  }
}

function scanDirectory(
  dir: string,
  source: ContextFile["source"],
  seen: Set<string>
): ContextFile[] {
  const results: ContextFile[] = [];

  // Check known context files
  for (const pattern of DIR_CONTEXT_FILES) {
    const fullPath = path.join(dir, pattern);
    if (seen.has(fullPath)) continue;
    const file = tryReadFile(fullPath);
    if (file) {
      seen.add(fullPath);
      results.push({
        name: path.basename(pattern),
        fullPath,
        displayPath: fullPath,
        source,
        ...file,
      });
    }
  }

  // Check .claude/ subdirectory
  const claudeDir = path.join(dir, ".claude");
  if (fs.existsSync(claudeDir) && fs.statSync(claudeDir).isDirectory()) {
    for (const name of CLAUDE_DIR_FILES) {
      const fullPath = path.join(claudeDir, name);
      if (seen.has(fullPath)) continue;
      const file = tryReadFile(fullPath);
      if (file) {
        seen.add(fullPath);
        results.push({
          name,
          fullPath,
          displayPath: fullPath,
          source,
          ...file,
        });
      }
    }

    // Also scan for any other .md/.json files in .claude/
    try {
      const entries = fs.readdirSync(claudeDir);
      for (const entry of entries) {
        const fullPath = path.join(claudeDir, entry);
        if (seen.has(fullPath)) continue;
        if (entry.endsWith(".md") || entry.endsWith(".json")) {
          const file = tryReadFile(fullPath);
          if (file) {
            seen.add(fullPath);
            results.push({
              name: entry,
              fullPath,
              displayPath: fullPath,
              source,
              ...file,
            });
          }
        }
      }
    } catch {
      // Permission denied or other error
    }
  }

  return results;
}

function findAllContextFiles(projectDir: string): ContextFile[] {
  const results: ContextFile[] = [];
  const seen = new Set<string>();

  // 1. Scan the project directory itself
  results.push(...scanDirectory(projectDir, "project", seen));

  // 2. Walk up ancestor directories (Claude Code auto-discovers CLAUDE.md up the tree)
  let current = path.dirname(projectDir);
  const root = path.parse(current).root;
  while (current !== root && current !== path.dirname(current)) {
    const ancestorFiles = scanDirectory(current, "ancestor", seen);
    results.push(...ancestorFiles);
    current = path.dirname(current);
  }

  // 3. Global Claude config at ~/.claude/
  const globalClaudeDir = path.join(os.homedir(), ".claude");
  if (fs.existsSync(globalClaudeDir)) {
    // Check for global settings and CLAUDE.md
    for (const name of ["CLAUDE.md", "settings.json", "settings.local.json"]) {
      const fullPath = path.join(globalClaudeDir, name);
      if (seen.has(fullPath)) continue;
      const file = tryReadFile(fullPath);
      if (file) {
        seen.add(fullPath);
        results.push({
          name,
          fullPath,
          displayPath: fullPath,
          source: "global",
          ...file,
        });
      }
    }

    // Check project-specific config under ~/.claude/projects/
    const projectKey = projectDir.replace(/[:/\\]/g, "-").replace(/^-/, "");
    const projectConfigDir = path.join(globalClaudeDir, "projects", projectKey);
    if (fs.existsSync(projectConfigDir)) {
      try {
        const entries = fs.readdirSync(projectConfigDir, { recursive: true }) as string[];
        for (const entry of entries) {
          const fullPath = path.join(projectConfigDir, entry);
          if (seen.has(fullPath)) continue;
          const file = tryReadFile(fullPath);
          if (file) {
            seen.add(fullPath);
            results.push({
              name: path.basename(entry),
              fullPath,
              displayPath: fullPath,
              source: "global",
              ...file,
            });
          }
        }
      } catch {
        // Recursive readdir may fail
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

  const files = fs.existsSync(team.project_dir)
    ? findAllContextFiles(team.project_dir)
    : [];

  return NextResponse.json({ files, project_dir: team.project_dir });
}
