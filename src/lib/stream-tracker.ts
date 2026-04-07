import type { WriteStream } from "fs";
import { recordTokenUsage, recordToolUsage, recordMcpServer } from "./db";
import { broadcast } from "./websocket";

export interface StreamTrackerOptions {
  logStream: WriteStream;
  agentId?: string;
  teamId?: string;
}

interface UsageData {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  cost_usd: number;
  model: string | null;
  duration_ms: number | null;
  session_id: string | null;
}

interface RateLimitData {
  status: string;
  resetsAt: number;
  rateLimitType: string;
  overageStatus: string;
  overageResetsAt: number;
  isUsingOverage: boolean;
}

// Global rate limit state (shared across all agents)
const globalForLimits = globalThis as unknown as {
  _latestRateLimitEvent?: RateLimitData & { timestamp: string; agentId?: string; teamId?: string };
  _rateLimitHits?: number;
};

export function getLatestRateLimitEvent() {
  return globalForLimits._latestRateLimitEvent ?? null;
}

export function getRateLimitHits() {
  return globalForLimits._rateLimitHits ?? 0;
}

export class StreamTracker {
  private logStream: WriteStream;
  private agentId?: string;
  private teamId?: string;
  private buffer = "";
  private usage: UsageData | null = null;
  private firstTextWritten = false;

  constructor(opts: StreamTrackerOptions) {
    this.logStream = opts.logStream;
    this.agentId = opts.agentId;
    this.teamId = opts.teamId;
  }

  feed(chunk: Buffer): void {
    this.buffer += chunk.toString();
    const lines = this.buffer.split("\n");
    // Keep the last incomplete line in the buffer
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      this.processLine(line);
    }
  }

  flush(): void {
    if (this.buffer.trim()) {
      this.processLine(this.buffer);
      this.buffer = "";
    }
  }

  getUsage(): UsageData | null {
    return this.usage;
  }

  private processLine(line: string): void {
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(line);
    } catch {
      // Not valid JSON -- write raw to log
      this.logStream.write(line + "\n");
      return;
    }

    const type = event.type as string;

    switch (type) {
      case "assistant":
        this.handleAssistant(event);
        break;
      case "result":
        this.handleResult(event);
        break;
      case "tool_use":
        this.handleToolUse(event);
        break;
      case "rate_limit_event":
        this.handleRateLimit(event);
        break;
      case "system":
        this.handleSystem(event);
        break;
      // Skip hook events, tool_result, and other noise
    }
  }

  private handleAssistant(event: Record<string, unknown>): void {
    const message = event.message as Record<string, unknown> | undefined;
    if (!message) return;

    const content = message.content as Array<Record<string, unknown>> | undefined;
    if (!content) return;

    for (const block of content) {
      if (block.type === "text" && typeof block.text === "string") {
        if (this.firstTextWritten) {
          this.logStream.write("\n");
        }
        this.logStream.write(block.text);
        this.firstTextWritten = true;
      } else if (block.type === "tool_use" && typeof block.name === "string") {
        // Tool use events are nested inside assistant message content blocks
        this.handleToolUse(block as Record<string, unknown>);
      }
    }
  }

  private handleResult(event: Record<string, unknown>): void {
    const usage = event.usage as Record<string, unknown> | undefined;
    const modelUsage = event.modelUsage as Record<string, Record<string, unknown>> | undefined;

    // Extract model name from modelUsage keys
    let model: string | null = null;
    if (modelUsage) {
      const models = Object.keys(modelUsage);
      if (models.length > 0) model = models[0];
    }

    this.usage = {
      input_tokens: (usage?.input_tokens as number) || 0,
      output_tokens: (usage?.output_tokens as number) || 0,
      cache_read_tokens: (usage?.cache_read_input_tokens as number) || 0,
      cache_creation_tokens: (usage?.cache_creation_input_tokens as number) || 0,
      cost_usd: (event.total_cost_usd as number) || 0,
      model,
      duration_ms: (event.duration_ms as number) || null,
      session_id: (event.session_id as string) || null,
    };

    // Store in DB
    if (this.agentId && this.teamId) {
      try {
        recordTokenUsage({
          team_id: this.teamId,
          agent_id: this.agentId,
          ...this.usage,
        });

        broadcast(this.teamId, {
          type: "token_usage_updated",
          agentId: this.agentId,
          data: { ...this.usage },
        });
      } catch (error) {
        console.error("[stream-tracker] Failed to record token usage:", error);
      }
    }

    // Write the final text result to log
    const result = event.result as string | undefined;
    if (result && !this.firstTextWritten) {
      this.logStream.write(result);
      this.firstTextWritten = true;
    }
    this.logStream.write("\n\n[RESPONSE COMPLETE]\n");
  }

  private handleToolUse(event: Record<string, unknown>): void {
    const toolName = (event.name || event.tool_name) as string | undefined;
    if (!toolName || !this.agentId || !this.teamId) return;

    // Detect MCP tools by naming convention: mcp__serverName__toolName
    const mcpMatch = toolName.match(/^mcp__(.+?)__(.+)$/);
    const isMcp = !!mcpMatch;
    const mcpServerName = mcpMatch ? mcpMatch[1] : null;

    // Truncate input for summary
    const toolInput = event.input as Record<string, unknown> | string | undefined;
    let inputSummary: string | null = null;
    if (toolInput) {
      const raw = typeof toolInput === "string" ? toolInput : JSON.stringify(toolInput);
      inputSummary = raw.length > 200 ? raw.slice(0, 200) + "..." : raw;
    }

    try {
      recordToolUsage({
        team_id: this.teamId,
        agent_id: this.agentId,
        tool_name: toolName,
        tool_input_summary: inputSummary,
        is_mcp_tool: isMcp,
        mcp_server_name: mcpServerName,
      });
    } catch (error) {
      console.error("[stream-tracker] Failed to record tool usage:", error);
    }

    // Write tool use to log for visibility
    const displayName = mcpMatch ? `${mcpMatch[1]}:${mcpMatch[2]}` : toolName;
    this.logStream.write(`\n[TOOL USE] ${displayName}\n`);
  }

  private handleRateLimit(event: Record<string, unknown>): void {
    const info = event.rate_limit_info as RateLimitData | undefined;
    if (!info) return;

    const now = new Date().toISOString();
    globalForLimits._latestRateLimitEvent = {
      ...info,
      timestamp: now,
      agentId: this.agentId,
      teamId: this.teamId,
    };

    // Count non-allowed events as hits
    if (info.status !== "allowed") {
      globalForLimits._rateLimitHits = (globalForLimits._rateLimitHits ?? 0) + 1;
    }

    if (this.teamId) {
      broadcast(this.teamId, {
        type: "rate_limit_event",
        agentId: this.agentId,
        data: { ...info, timestamp: now },
      });
    }
  }

  private handleSystem(event: Record<string, unknown>): void {
    const subtype = event.subtype as string;
    if (subtype !== "init") return;

    // Extract MCP server info from init event
    const mcpServers = event.mcp_servers as Array<{ name: string; status: string }> | undefined;
    if (mcpServers && this.teamId) {
      for (const server of mcpServers) {
        try {
          recordMcpServer({
            team_id: this.teamId,
            agent_id: this.agentId,
            server_name: server.name,
            status: server.status,
            source: "agent-stream",
          });
        } catch (error) {
          console.error("[stream-tracker] Failed to record MCP server:", error);
        }
      }
    }
  }
}
