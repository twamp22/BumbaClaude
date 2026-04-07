"use client";

import { useState, useEffect } from "react";

interface ToolStat {
  tool_name: string;
  call_count: number;
  is_mcp_tool: number;
  mcp_server_name: string | null;
  last_used: string;
}

export default function ToolUsagePanel({ teamId }: { teamId: string }) {
  const [tools, setTools] = useState<ToolStat[]>([]);

  useEffect(() => {
    const fetchTools = async () => {
      try {
        const res = await fetch(`/api/teams/${teamId}/tool-usage`);
        const data = await res.json();
        setTools(data.tools || []);
      } catch { /* ignore */ }
    };
    fetchTools();
    const interval = setInterval(fetchTools, 5000);
    return () => clearInterval(interval);
  }, [teamId]);

  const maxCount = Math.max(...tools.map((t) => t.call_count), 1);

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Tool Usage</h3>
      {tools.length === 0 ? (
        <div className="text-center text-zinc-600 font-mono text-sm py-4">No tool usage recorded yet</div>
      ) : (
        <div className="space-y-1">
          {tools.map((tool) => (
            <div key={tool.tool_name} className="flex items-center gap-3 text-sm font-mono">
              <div className="w-32 truncate text-zinc-300 flex items-center gap-1">
                {tool.is_mcp_tool ? (
                  <span className="text-purple-400 text-xs px-1 py-0.5 bg-purple-500/10 rounded border border-purple-500/20 mr-1">MCP</span>
                ) : null}
                {tool.is_mcp_tool && tool.mcp_server_name
                  ? tool.tool_name.replace(`mcp__${tool.mcp_server_name}__`, "")
                  : tool.tool_name}
              </div>
              <div className="flex-1 h-4 bg-zinc-900 rounded overflow-hidden">
                <div
                  className={`h-full rounded ${tool.is_mcp_tool ? "bg-purple-500/40" : "bg-green-500/40"}`}
                  style={{ width: `${(tool.call_count / maxCount) * 100}%` }}
                />
              </div>
              <div className="w-12 text-right text-zinc-400">{tool.call_count}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
