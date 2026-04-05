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
      router.push("/");
    } catch (error) {
      console.error("Failed to kill:", error);
    }
  };

  const deleteTeam = async () => {
    await fetch(`/api/teams/${team.id}`, { method: "DELETE" });
    router.push("/");
  };

  if (team.status === "completed" || team.status === "errored") {
    return (
      <div className="flex items-center justify-between bg-zinc-900 border-t border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono text-zinc-500">
            Team {team.status}
          </span>
          <button
            onClick={() => router.push(`/teams/${team.id}/audit`)}
            className="px-3 py-1.5 text-xs font-mono bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors"
          >
            Audit Log
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={deleteTeam}
            className="px-3 py-1.5 text-xs font-mono bg-red-700 hover:bg-red-600 text-white rounded transition-colors"
          >
            Delete Team
          </button>
          <button
            onClick={() => router.push("/")}
            className="px-3 py-1.5 text-xs font-mono bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors"
          >
            Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between bg-zinc-900 border-t border-zinc-800 px-4 py-3">
      <div className="flex gap-2">
        {team.status === "running" && (
          <button
            onClick={pause}
            className="px-3 py-1.5 text-xs font-mono bg-amber-600 hover:bg-amber-500 text-white rounded transition-colors"
          >
            Pause All
          </button>
        )}
        {team.status === "paused" && (
          <button
            onClick={resume}
            className="px-3 py-1.5 text-xs font-mono bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
          >
            Resume
          </button>
        )}
        <button
          onClick={() => router.push(`/teams/${team.id}/audit`)}
          className="px-3 py-1.5 text-xs font-mono bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors"
        >
          Audit Log
        </button>
      </div>
      <div className="flex gap-2">
        <button
          onClick={kill}
          className="px-3 py-1.5 text-xs font-mono bg-red-700 hover:bg-red-600 text-white rounded transition-colors"
        >
          Kill Team
        </button>
      </div>
    </div>
  );
}
