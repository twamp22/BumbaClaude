"use client";

import Link from "next/link";
import type { Team } from "@/lib/types";
import StatusBadge from "@/components/shared/StatusBadge";
import ContextMenu, { type ContextMenuItem } from "@/components/shared/ContextMenu";

interface TeamNavItemProps {
  team: Team;
}

export default function TeamNavItem({ team }: TeamNavItemProps) {
  const pause = async () => {
    await fetch(`/api/teams/${team.id}/pause`, { method: "POST" });
    window.location.reload();
  };

  const resume = async () => {
    await fetch(`/api/teams/${team.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "running" }),
    });
    window.location.reload();
  };

  const kill = async () => {
    await fetch(`/api/teams/${team.id}/kill`, { method: "POST" });
    window.location.reload();
  };

  const deleteTeam = async () => {
    await fetch(`/api/teams/${team.id}`, { method: "DELETE" });
    window.location.href = "/";
  };

  const isActive = team.status === "running" || team.status === "paused";

  const items: ContextMenuItem[] = [
    {
      label: team.status === "paused" ? "Resume" : "Pause",
      onClick: team.status === "paused" ? resume : pause,
      disabled: !isActive,
    },
    {
      label: "Settings",
      onClick: () => { window.location.href = `/teams/${team.id}/settings`; },
    },
    {
      label: "Add Agent",
      onClick: () => { window.location.href = `/teams/${team.id}/agents/new`; },
      disabled: !isActive,
    },
    {
      label: "Audit Log",
      onClick: () => { window.location.href = `/teams/${team.id}/audit`; },
    },
    { label: "", onClick: () => {}, separator: true },
    {
      label: isActive ? "Kill Team" : "Delete Team",
      onClick: isActive ? kill : deleteTeam,
      variant: "danger",
    },
  ];

  return (
    <ContextMenu items={items}>
      <Link
        href={`/teams/${team.id}`}
        className="flex items-center justify-between px-3 py-1.5 text-sm font-mono text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors"
      >
        <span className="truncate">{team.name}</span>
        <StatusBadge status={team.status} />
      </Link>
    </ContextMenu>
  );
}
