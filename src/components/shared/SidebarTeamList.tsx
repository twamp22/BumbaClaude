"use client";

import { useState, useEffect } from "react";
import type { Team, Agent } from "@/lib/types";
import TeamNavItem from "@/components/shared/TeamNavItem";
import AgentNavItem from "@/components/shared/AgentNavItem";

interface TeamWithAgents extends Team {
  agents: Agent[];
}

export default function SidebarTeamList() {
  const [teams, setTeams] = useState<TeamWithAgents[]>([]);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const res = await fetch("/api/teams");
        const teamList: Team[] = await res.json();

        // Fetch agents for each team
        const teamsWithAgents = await Promise.all(
          teamList.map(async (team) => {
            try {
              const agentRes = await fetch(`/api/teams/${team.id}/agents`);
              const agents: Agent[] = await agentRes.json();
              return { ...team, agents };
            } catch {
              return { ...team, agents: [] };
            }
          })
        );

        setTeams(teamsWithAgents);
      } catch (error) {
        console.error("Failed to fetch teams:", error);
      }
    };

    fetchTeams();
    const interval = setInterval(fetchTeams, 3000);
    return () => clearInterval(interval);
  }, []);

  if (teams.length === 0) return null;

  return (
    <div className="pt-3 mt-3 border-t border-zinc-800">
      <div className="px-3 py-1 text-xs font-mono text-zinc-600 uppercase tracking-wider">
        Teams
      </div>
      {teams.map((team) => (
        <div key={team.id}>
          <TeamNavItem team={team} />
          {team.agents.length > 0 && (
            <div className="ml-3 pl-3 border-l border-zinc-800/50">
              {team.agents.map((agent) => (
                <AgentNavItem key={agent.id} agent={agent} teamId={team.id} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
