"use client";

import { useRouter } from "next/navigation";
import type { Team } from "@/lib/types";

interface TeamControlsProps {
  team: Team;
  onRefresh: () => void;
}

export default function TeamControls({ team, onRefresh }: TeamControlsProps) {
  const router = useRouter();

  const pause = async () => {
    try {
      await fetch(`/api/teams/${team.id}/pause`, { method: "POST" });
      onRefresh();
    } catch (error) {
      console.error("Failed to pause:", error);
    }
  };

  const resume = async () => {
    try {
      await fetch(`/api/teams/${team.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "running" }),
      });
      onRefresh();
    } catch (error) {
      console.error("Failed to resume:", error);
    }
  };

  const kill = async () => {
    try {
      await fetch(`/api/teams/${team.id}/kill`, { method: "POST" });
      window.location.href = "/";
    } catch (error) {
      console.error("Failed to kill:", error);
    }
  };

  const deleteTeam = async () => {
    await fetch(`/api/teams/${team.id}`, { method: "DELETE" });
    window.location.href = "/";
  };

  if (team.status === "completed" || team.status === "errored") {
    return (
      <div className="flex items-center justify-between bg-zinc-900/80 border-t border-zinc-800 px-5 py-2.5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
            {team.status}
          </span>
          <button
            onClick={() => router.push(`/teams/${team.id}/audit`)}
            className="px-3 py-1.5 text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-lg border border-zinc-700 transition-colors"
          >
            Audit Log
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={deleteTeam}
            className="px-3 py-1.5 text-xs font-mono text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            Delete
          </button>
          <button
            onClick={() => (window.location.href = "/")}
            className="px-3 py-1.5 text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-lg border border-zinc-700 transition-colors"
          >
            Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between bg-zinc-900/80 border-t border-zinc-800 px-5 py-2.5 flex-shrink-0">
      <div className="flex gap-2">
        {team.status === "running" && (
          <button
            onClick={pause}
            className="px-3 py-1.5 text-xs font-mono bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 rounded-lg border border-amber-600/30 transition-colors"
          >
            Pause All
          </button>
        )}
        {team.status === "paused" && (
          <button
            onClick={resume}
            className="px-3 py-1.5 text-xs font-mono bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg border border-green-600/30 transition-colors"
          >
            Resume
          </button>
        )}
        <button
          onClick={() => router.push(`/teams/${team.id}/audit`)}
          className="px-3 py-1.5 text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-lg border border-zinc-700 transition-colors"
        >
          Audit Log
        </button>
      </div>
      <button
        onClick={kill}
        className="px-3 py-1.5 text-xs font-mono bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg border border-red-600/30 transition-colors"
      >
        Kill Team
      </button>
    </div>
  );
}
