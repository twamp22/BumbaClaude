"use client";

import { useState, useEffect, useRef } from "react";
import type { Agent } from "@/lib/types";
import StatusBadge from "@/components/shared/StatusBadge";
import MessageInput from "@/components/monitor/MessageInput";

interface AgentCardProps {
  agent: Agent;
  teamId: string;
  defaultExpanded?: boolean;
}

function formatOutput(raw: string): string {
  return raw
    .replace(/^\s*Warning: no stdin data received.*\n?/gm, "")
    .replace(/\[RESPONSE COMPLETE\]/g, "")
    .replace(/\[PROCESS EXITED\] code=\d+/g, "")
    .replace(/\[PROCESS ERROR\].*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default function AgentCard({ agent, teamId, defaultExpanded = false }: AgentCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [output, setOutput] = useState("");
  const outputRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (!expanded || !agent.tmux_session) return;

    const fetchOutput = () => {
      fetch(`/api/teams/${teamId}/agents/${agent.id}/output?lines=200`)
        .then((res) => res.json())
        .then((data) => {
          setOutput(data.output || "");
          // Auto-scroll to bottom
          if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
          }
        })
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

  const formatted = formatOutput(output);

  // Parse output into segments for better display
  const segments = formatted.split(/\[USER\]\s*/);

  return (
    <div className={`bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden flex flex-col ${expanded ? "flex-1" : ""}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-800/50 transition-colors flex-shrink-0"
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

      <div className="px-4 pb-2 text-xs font-mono text-zinc-500 flex-shrink-0">{agent.role}</div>

      {expanded && (
        <div className="flex flex-col flex-1 min-h-0 border-t border-zinc-800">
          <pre
            ref={outputRef}
            className="flex-1 overflow-y-auto bg-black/50 p-4 text-sm font-mono whitespace-pre-wrap min-h-[120px]"
          >
            {segments.map((segment, i) => {
              if (i === 0) {
                // First segment is the initial agent response
                return (
                  <span key={i} className="text-green-400">
                    {segment}
                  </span>
                );
              }
              // Subsequent segments: user message then agent response
              const lines = segment.split("\n");
              const userMsg = lines[0];
              const agentResponse = lines.slice(1).join("\n").trim();
              return (
                <span key={i}>
                  {"\n"}
                  <span className="text-blue-400 opacity-70">{">"} {userMsg}</span>
                  {"\n"}
                  <span className="text-green-400">{agentResponse}</span>
                </span>
              );
            })}
            {!formatted && (
              <span className="text-zinc-600 italic">Waiting for response...</span>
            )}
          </pre>
          <div className="p-3 border-t border-zinc-800 flex-shrink-0">
            <MessageInput teamId={teamId} agentId={agent.id} />
          </div>
        </div>
      )}
    </div>
  );
}
