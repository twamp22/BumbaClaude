"use client";

import Link from "next/link";
import type { Agent } from "@/lib/types";
import StatusBadge from "@/components/shared/StatusBadge";
import ContextMenu, { type ContextMenuItem } from "@/components/shared/ContextMenu";

interface AgentNavItemProps {
  agent: Agent;
  teamId: string;
}

const MODEL_COLORS: Record<string, string> = {
  opus: "text-purple-400",
  sonnet: "text-blue-400",
  haiku: "text-emerald-400",
};

export default function AgentNavItem({ agent, teamId }: AgentNavItemProps) {
  const isActive = agent.status === "working" || agent.status === "idle" || agent.status === "waiting";

  const interrupt = async () => {
    await fetch(`/api/teams/${teamId}/agents/${agent.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "interrupt" }),
    });
    window.location.reload();
  };

  const markCompleted = async () => {
    await fetch(`/api/teams/${teamId}/agents/${agent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    window.location.reload();
  };

  const viewOutput = () => {
    window.location.href = `/teams/${teamId}`;
  };

  const items: ContextMenuItem[] = [
    {
      label: "View Output",
      onClick: viewOutput,
    },
    {
      label: "Interrupt",
      onClick: interrupt,
      disabled: !isActive,
    },
    { label: "", onClick: () => {}, separator: true },
    {
      label: "Mark Completed",
      onClick: markCompleted,
      disabled: !isActive,
      variant: "danger",
    },
  ];

  return (
    <ContextMenu items={items}>
      <Link
        href={`/teams/${teamId}`}
        className="flex items-center justify-between px-2 py-1 text-xs font-mono text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 rounded transition-colors"
      >
        <span className="truncate">{agent.name}</span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`text-[10px] ${MODEL_COLORS[agent.model_tier] || "text-zinc-600"}`}>
            {agent.model_tier.charAt(0).toUpperCase()}
          </span>
          <StatusBadge status={agent.status} />
        </div>
      </Link>
    </ContextMenu>
  );
}
