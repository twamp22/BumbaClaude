"use client";

import { useState, useEffect } from "react";
import QuickStats from "@/components/dashboard/QuickStats";
import TeamCard from "@/components/dashboard/TeamCard";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import type { Team, Agent, Task } from "@/lib/types";

interface DashboardData {
  teams: Team[];
  allAgents: Agent[];
  allTasks: Task[];
  teamMeta: Record<string, { agentCount: number; taskCount: number }>;
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/teams");
        const teams: Team[] = await res.json();

        const allAgents: Agent[] = [];
        const allTasks: Task[] = [];
        const teamMeta: Record<string, { agentCount: number; taskCount: number }> = {};

        await Promise.all(
          teams.map(async (team) => {
            try {
              const [agentRes, taskRes] = await Promise.all([
                fetch(`/api/teams/${team.id}/agents`),
                fetch(`/api/teams/${team.id}/tasks`),
              ]);
              const agents: Agent[] = await agentRes.json();
              const tasks: Task[] = await taskRes.json();
              allAgents.push(...agents);
              allTasks.push(...tasks);
              teamMeta[team.id] = { agentCount: agents.length, taskCount: tasks.length };
            } catch {
              teamMeta[team.id] = { agentCount: 0, taskCount: 0 };
            }
          })
        );

        setData({ teams, allAgents, allTasks, teamMeta });
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-zinc-500 font-mono">Loading...</div>
      </div>
    );
  }

  const { teams, allAgents, allTasks, teamMeta } = data;

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
