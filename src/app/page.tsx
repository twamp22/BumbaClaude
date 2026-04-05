import { getAllTeams, getAgentsByTeam, getTasksByTeam } from "@/lib/db";
import QuickStats from "@/components/dashboard/QuickStats";
import TeamCard from "@/components/dashboard/TeamCard";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import type { Agent, Task } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function Home() {
  const teams = getAllTeams();

  const allAgents: Agent[] = [];
  const allTasks: Task[] = [];
  const teamMeta: Record<string, { agentCount: number; taskCount: number }> = {};

  for (const team of teams) {
    const agents = getAgentsByTeam(team.id);
    const tasks = getTasksByTeam(team.id);
    allAgents.push(...agents);
    allTasks.push(...tasks);
    teamMeta[team.id] = { agentCount: agents.length, taskCount: tasks.length };
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-mono">Dashboard</h1>
      </div>

      <QuickStats teams={teams} agents={allAgents} tasks={allTasks} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((team) => (
          <TeamCard
            key={team.id}
            team={team}
            agentCount={teamMeta[team.id].agentCount}
            taskCount={teamMeta[team.id].taskCount}
          />
        ))}
        {teams.length === 0 && (
          <div className="col-span-full text-center py-12 text-zinc-600 font-mono">
            No teams yet. Create one to get started.
          </div>
        )}
      </div>

      <ActivityFeed />
    </div>
  );
}
