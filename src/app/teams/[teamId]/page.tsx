"use client";

import { useParams } from "next/navigation";
import { useTeamStatus } from "@/hooks/useTeamStatus";
import AgentCard from "@/components/monitor/AgentCard";
import TaskList from "@/components/monitor/TaskList";
import TeamControls from "@/components/monitor/TeamControls";
import StatusBadge from "@/components/shared/StatusBadge";

export default function TeamMonitorPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { team, agents, tasks, loading, error, refresh } = useTeamStatus(teamId);

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

  return (
    <div className="flex flex-col h-screen">
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
              defaultExpanded={autoExpand}
            />
          ))}
          {agents.length === 0 && (
            <div className="text-center text-zinc-600 font-mono py-8">No agents spawned</div>
          )}
        </div>

        {/* Right panel - Tasks */}
        <div className="w-2/5 overflow-y-auto p-4">
          <TaskList tasks={tasks} agents={agents} teamId={teamId} onRefresh={refresh} />
        </div>
      </div>

      {/* Bottom controls */}
      <TeamControls team={team} onRefresh={refresh} />
    </div>
  );
}
