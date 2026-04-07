import fs from "fs";
import path from "path";
import os from "os";
import { recordMcpServer } from "./db";

export function discoverMcpServers(teamId?: string): void {
  // Read global MCP servers from ~/.claude/settings.json
  try {
    const settingsPath = path.join(os.homedir(), ".claude", "settings.json");
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    const mcpServers = settings.mcpServers || {};
    for (const name of Object.keys(mcpServers)) {
      recordMcpServer({
        team_id: teamId ?? null,
        server_name: name,
        status: null,
        source: "global-config",
      });
    }
  } catch {
    // settings.json missing or no mcpServers key
  }
}

export function discoverProjectMcpServers(projectDir: string, teamId: string): void {
  // Read project-level MCP servers from .mcp.json
  try {
    const mcpPath = path.join(projectDir, ".mcp.json");
    const config = JSON.parse(fs.readFileSync(mcpPath, "utf-8"));
    const mcpServers = config.mcpServers || {};
    for (const name of Object.keys(mcpServers)) {
      recordMcpServer({
        team_id: teamId,
        server_name: name,
        status: null,
        source: "project-config",
      });
    }
  } catch {
    // .mcp.json missing or not in project
  }
}
