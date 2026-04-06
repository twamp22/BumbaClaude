"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useTeamStatus } from "@/hooks/useTeamStatus";
import AgentCard from "@/components/monitor/AgentCard";
import TaskList from "@/components/monitor/TaskList";
import TASPanel from "@/components/monitor/TASPanel";
import ActivityFeed from "@/components/monitor/ActivityFeed";
import ToastNotifications from "@/components/monitor/ToastNotifications";
import TeamControls from "@/components/monitor/TeamControls";
import StatusBadge from "@/components/shared/StatusBadge";

export default function TeamMonitorPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { team, agents, tasks, governance, events, loading, error, refresh } = useTeamStatus(teamId);
  const [rightTab, setRightTab] = useState<"tasks" | "activity" | "tas">("tasks");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-zinc-500 font-mono">Loading...</div>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500 font-mono">{error || "Team not found"}</div>
      </div>
    );
  }

  const autoExpand = agents.length <= 2;
  const staleThresholdMinutes = parseInt(
    governance.find((g) => g.rule_type === "stale_threshold_minutes")?.rule_value || "15"
  );

  return (
    <div className="flex flex-col h-screen">
      <ToastNotifications teamId={teamId} />
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold font-mono">{team.name}</h1>
          <StatusBadge status={team.status} />
          <span className="text-xs font-mono text-zinc-600">
            {agents.length} agent{agents.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="text-xs font-mono text-zinc-500">{team.project_dir}</div>
      </div>

      {/* Main panels */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left panel - Agents */}
        <div className="w-3/5 overflow-y-auto p-4 flex flex-col gap-3 border-r border-zinc-800">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              teamId={teamId}
              tasks={tasks}
              defaultExpanded={autoExpand}
            />
          ))}
          {agents.length === 0 && (
            <div className="text-center text-zinc-600 font-mono py-8">No agents spawned</div>
          )}
        </div>

        {/* Right panel - Tabbed: Tasks / TAS */}
        <div className="w-2/5 flex flex-col overflow-hidden">
          <div className="flex border-b border-zinc-800 flex-shrink-0">
            <button
              onClick={() => setRightTab("tasks")}
              className={`flex-1 px-4 py-2 text-sm font-mono transition-colors ${
                rightTab === "tasks"
                  ? "text-zinc-100 border-b-2 border-green-500"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Tasks
            </button>
            <button
              onClick={() => setRightTab("activity")}
              className={`flex-1 px-4 py-2 text-sm font-mono transition-colors ${
                rightTab === "activity"
                  ? "text-zinc-100 border-b-2 border-amber-500"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Activity
            </button>
            <button
              onClick={() => setRightTab("tas")}
              className={`flex-1 px-4 py-2 text-sm font-mono transition-colors ${
                rightTab === "tas"
                  ? "text-zinc-100 border-b-2 border-green-500"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              TAS
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {rightTab === "tasks" ? (
              <TaskList tasks={tasks} agents={agents} teamId={teamId} staleThresholdMinutes={staleThresholdMinutes} onRefresh={refresh} />
            ) : rightTab === "activity" ? (
              <ActivityFeed events={events} />
            ) : (
              <TASPanel teamId={teamId} />
            )}
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <TeamControls team={team} onRefresh={refresh} />
    </div>
  );
}
