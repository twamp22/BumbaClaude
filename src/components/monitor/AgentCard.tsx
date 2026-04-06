"use client";

import { useState, useEffect, useRef } from "react";
import type { Agent, Task } from "@/lib/types";
import StatusBadge from "@/components/shared/StatusBadge";
import MessageInput from "@/components/monitor/MessageInput";

interface AgentCardProps {
  agent: Agent;
  teamId: string;
  tasks: Task[];
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

type OutputSegment = {
  type: "agent" | "user" | "ping" | "update";
  content: string;
};

/**
 * Parse agent output into typed segments. Only matches prefixes at the start
 * of a line (after a newline or at position 0) to avoid false positives when
 * agent output happens to contain literal "[AGENT PING]" text mid-line.
 * Each prefix captures everything until the next prefix or end of string.
 */
function parseOutputSegments(formatted: string): OutputSegment[] {
  if (!formatted) return [];

  // Match prefixes only at line boundaries (start of string or after newline)
  const prefixPattern = /(?:^|\n)(\[USER\]|\[AGENT PING\]|\[AGENT UPDATE\])\s*/g;
  const segments: OutputSegment[] = [];

  const matches: { index: number; prefix: string; afterIndex: number }[] = [];
  let match;
  while ((match = prefixPattern.exec(formatted)) !== null) {
    // Adjust index to skip the leading newline if present
    const prefixStart = formatted[match.index] === "\n" ? match.index + 1 : match.index;
    matches.push({
      index: prefixStart,
      prefix: match[1],
      afterIndex: match.index + match[0].length,
    });
  }

  if (matches.length === 0) {
    // No prefixes found, entire output is agent content
    return [{ type: "agent", content: formatted }];
  }

  // Content before the first prefix is agent output
  if (matches[0].index > 0) {
    const beforeContent = formatted.substring(0, matches[0].index).trimEnd();
    if (beforeContent) {
      segments.push({ type: "agent", content: beforeContent });
    }
  }

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const nextStart = i + 1 < matches.length ? matches[i + 1].index : formatted.length;
    const content = formatted.substring(current.afterIndex, nextStart).trim();

    let type: OutputSegment["type"] = "agent";
    if (current.prefix === "[USER]") type = "user";
    else if (current.prefix === "[AGENT PING]") type = "ping";
    else if (current.prefix === "[AGENT UPDATE]") type = "update";

    segments.push({ type, content });
  }

  return segments;
}

export default function AgentCard({ agent, teamId, tasks, defaultExpanded = false }: AgentCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [output, setOutput] = useState("");
  const outputRef = useRef<HTMLPreElement>(null);

  // Find the agent's current active task
  const currentTask = tasks.find(
    (t) => t.assigned_agent_id === agent.id && t.status === "in_progress"
  );
  const pendingTasks = tasks.filter(
    (t) => t.assigned_agent_id === agent.id && (t.status === "pending" || t.status === "claimed")
  );

  useEffect(() => {
    if (!expanded || !agent.tmux_session) return;

    const fetchOutput = () => {
      fetch(`/api/teams/${teamId}/agents/${agent.id}/output?lines=200`)
        .then((res) => res.json())
        .then((data) => {
          const newOutput = data.output || "";
          const changed = newOutput !== output;
          setOutput(newOutput);

          if (changed && outputRef.current) {
            const el = outputRef.current;
            const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            if (isNearBottom) {
              el.scrollTop = el.scrollHeight;
            }
          }
        })
        .catch(console.error);
    };

    fetchOutput();
    const interval = setInterval(fetchOutput, 3000);
    return () => clearInterval(interval);
  }, [expanded, agent.id, agent.tmux_session, teamId, output]);

  const MODEL_COLORS: Record<string, string> = {
    opus: "text-purple-400",
    sonnet: "text-blue-400",
    haiku: "text-emerald-400",
  };

  const formatted = formatOutput(output);
  const segments = parseOutputSegments(formatted);

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

      {/* Current task banner */}
      {currentTask && (
        <div className="mx-4 mb-1 px-3 py-1.5 bg-green-900/30 border border-green-800/50 rounded text-xs font-mono text-green-400 flex items-center gap-2 flex-shrink-0">
          <span className="text-green-500 animate-pulse">&#9679;</span>
          <span className="font-bold">WORKING:</span>
          <span className="truncate">{currentTask.title}</span>
        </div>
      )}
      {!currentTask && pendingTasks.length > 0 && (
        <div className="mx-4 mb-1 px-3 py-1.5 bg-amber-900/30 border border-amber-800/50 rounded text-xs font-mono text-amber-400 flex items-center gap-2 flex-shrink-0">
          <span className="font-bold">QUEUED:</span>
          <span className="truncate">{pendingTasks.length} task{pendingTasks.length !== 1 ? "s" : ""} pending</span>
        </div>
      )}

      <div className="px-4 pb-2 text-xs font-mono text-zinc-500 flex-shrink-0">{agent.role}</div>

      {expanded && (
        <div className="flex flex-col flex-1 min-h-0 border-t border-zinc-800">
          <pre
            ref={outputRef}
            className="flex-1 overflow-y-auto bg-black/50 p-4 text-sm font-mono whitespace-pre-wrap min-h-[120px]"
          >
            {segments.map((segment, i) => {
              switch (segment.type) {
                case "user":
                  return (
                    <span key={i}>
                      {i > 0 && "\n"}
                      <span className="text-blue-400 opacity-70">{">"} {segment.content}</span>
                      {"\n"}
                    </span>
                  );
                case "ping":
                  return (
                    <span key={i}>
                      {i > 0 && "\n"}
                      <span className="text-amber-400 font-bold">[PING] {segment.content}</span>
                      {"\n"}
                    </span>
                  );
                case "update":
                  return (
                    <span key={i}>
                      {i > 0 && "\n"}
                      <span className="text-cyan-400">[UPDATE] {segment.content}</span>
                      {"\n"}
                    </span>
                  );
                case "agent":
                default:
                  return (
                    <span key={i} className="text-green-400">
                      {segment.content}
                    </span>
                  );
              }
            })}
            {segments.length === 0 && (
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
