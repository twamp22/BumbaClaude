"use client";

import { useState, useEffect, useCallback } from "react";
import type { Team, Agent, Task, GovernanceRule } from "@/lib/types";

interface TeamStatusData {
  team: Team | null;
  agents: Agent[];
  tasks: Task[];
  governance: GovernanceRule[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useTeamStatus(teamId: string): TeamStatusData {
  const [team, setTeam] = useState<Team | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [governance, setGovernance] = useState<GovernanceRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    fetch(`/api/teams/${teamId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Team not found");
        return res.json();
      })
      .then((data) => {
        setTeam(data.team);
        setAgents(data.agents);
        setTasks(data.tasks);
        setGovernance(data.governance);
        setLoading(false);
        setError(null);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [teamId]);

  useEffect(() => {
    fetchData();
    // Poll every 3 seconds for live updates (will be replaced by WebSocket in v0.2)
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { team, agents, tasks, governance, loading, error, refresh: fetchData };
}
