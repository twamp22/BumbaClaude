"use client";

import { useState, useEffect } from "react";
import type { Agent } from "@/lib/types";
import StatusBadge from "@/components/shared/StatusBadge";
import MessageInput from "@/components/monitor/MessageInput";

interface AgentCardProps {
  agent: Agent;
  teamId: string;
}

export default function AgentCard({ agent, teamId }: AgentCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [output, setOutput] = useState("");

  useEffect(() => {
    if (!expanded || !agent.tmux_session) return;

    const fetchOutput = () => {
      fetch(`/api/teams/${teamId}/agents/${agent.id}/output?lines=50`)
        .then((res) => res.json())
        .then((data) => setOutput(data.output || ""))
        .catch(console.error);
    };

    fetchOutput();
    const interval = setInterval(fetchOutput, 3000);
    return () => clearInterval(interval);
  }, [expanded, agent.id, agent.tmux_session, teamId]);

  const MODEL_COLORS: Record<string, string> = {
    opus: "text-purple-400",
    sonnet: "text-blue-400",
    haiku: "text-emerald-400",
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <StatusBadge status={agent.status} />
          <span className="font-mono font-bold text-zinc-100">{agent.name}</span>
          <span className={`text-xs font-mono ${MODEL_COLORS[agent.model_tier] || "text-zinc-500"}`}>
            {agent.model_tier}
          </span>
        </div>
        <span className="text-xs font-mono text-zinc-600">{expanded ? "[-]" : "[+]"}</span>
      </button>

      <div className="px-4 pb-1 text-xs font-mono text-zinc-500">{agent.role}</div>

      {expanded && (
        <div className="border-t border-zinc-800">
          <div className="bg-black/50 p-3 max-h-64 overflow-y-auto">
            <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap">
              {output || "No output captured"}
            </pre>
          </div>
          <div className="p-3 border-t border-zinc-800">
            <MessageInput teamId={teamId} agentId={agent.id} />
          </div>
        </div>
      )}
    </div>
  );
}
