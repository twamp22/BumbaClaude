"use client";

import { useRouter } from "next/navigation";
import type { Team } from "@/lib/types";

interface TeamControlsProps {
  team: Team;
  onRefresh: () => void;
}

export default function TeamControls({ team, onRefresh }: TeamControlsProps) {
  const router = useRouter();

  const action = async (endpoint: string) => {
    try {
      await fetch(`/api/teams/${team.id}/${endpoint}`, { method: "POST" });
      onRefresh();
    } catch (error) {
      console.error(`Failed to ${endpoint}:`, error);
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

  return (
    <div className="flex items-center justify-between bg-zinc-900 border-t border-zinc-800 px-4 py-3">
      <div className="flex gap-2">
        {team.status === "running" && (
          <button
            onClick={() => action("pause")}
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
          onClick={() => action("kill")}
          className="px-3 py-1.5 text-xs font-mono bg-red-700 hover:bg-red-600 text-white rounded transition-colors"
        >
          Kill Team
        </button>
      </div>
    </div>
  );
}
