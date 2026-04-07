"use client";

import { useState, useEffect } from "react";

interface McpServer {
  id: number;
  server_name: string;
  status: string | null;
  source: string;
  discovered_at: string;
}

export default function McpPanel({ teamId }: { teamId: string }) {
  const [servers, setServers] = useState<McpServer[]>([]);

  useEffect(() => {
    const fetchServers = async () => {
      try {
        const res = await fetch(`/api/teams/${teamId}/mcp`);
        const data = await res.json();
        setServers(data.servers || []);
      } catch { /* ignore */ }
    };
    fetchServers();
    const interval = setInterval(fetchServers, 10000);
    return () => clearInterval(interval);
  }, [teamId]);

  const statusColor = (status: string | null) => {
    switch (status) {
      case "connected": return "text-green-400 bg-green-500/10 border-green-500/20";
      case "needs-auth": return "text-amber-400 bg-amber-500/10 border-amber-500/20";
      default: return "text-zinc-400 bg-zinc-500/10 border-zinc-500/20";
    }
  };

  const sourceLabel = (source: string) => {
    switch (source) {
      case "agent-stream": return "Agent";
      case "project-config": return "Project";
      case "global-config": return "Global";
      default: return source;
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-wider">MCP Servers</h3>
      {servers.length === 0 ? (
        <div className="text-center text-zinc-600 font-mono text-sm py-4">No MCP servers discovered</div>
      ) : (
        <div className="space-y-2">
          {servers.map((server) => (
            <div key={server.id} className="flex items-center justify-between bg-zinc-900/40 rounded px-3 py-2 text-sm font-mono">
              <div className="flex items-center gap-2">
                <span className="text-zinc-300">{server.server_name}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded border ${statusColor(server.status)}`}>
                  {server.status || "unknown"}
                </span>
              </div>
              <span className="text-xs text-zinc-600">{sourceLabel(server.source)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
