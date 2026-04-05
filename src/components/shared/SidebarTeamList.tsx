"use client";

import { useState, useEffect } from "react";
import type { Team } from "@/lib/types";
import TeamNavItem from "@/components/shared/TeamNavItem";

export default function SidebarTeamList() {
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    const fetchTeams = () => {
      fetch("/api/teams")
        .then((res) => res.json())
        .then(setTeams)
        .catch(console.error);
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
        <TeamNavItem key={team.id} team={team} />
      ))}
    </div>
  );
}
