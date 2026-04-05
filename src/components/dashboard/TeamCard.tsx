"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Team } from "@/lib/types";
import StatusBadge from "@/components/shared/StatusBadge";

interface TeamCardProps {
  team: Team;
  agentCount: number;
  taskCount: number;
}

export default function TeamCard({ team, agentCount, taskCount }: TeamCardProps) {
  const router = useRouter();

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await fetch(`/api/teams/${team.id}`, { method: "DELETE" });
    window.location.reload();
  };

  return (
    <Link
      href={`/teams/${team.id}`}
      className="block bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-600 transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-mono font-bold text-zinc-100">{team.name}</h3>
        <div className="flex items-center gap-2">
          <StatusBadge status={team.status} />
          <button
            onClick={handleDelete}
            className="text-xs font-mono text-zinc-600 hover:text-red-500 transition-colors"
            title="Delete team"
          >
            [x]
          </button>
        </div>
      </div>
      <div className="text-xs font-mono text-zinc-500 mb-3 truncate">{team.project_dir}</div>
      <div className="flex gap-4 text-xs text-zinc-400 font-mono">
        <span>{agentCount} agents</span>
        <span>{taskCount} tasks</span>
      </div>
    </Link>
  );
}
