"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    pollRef.current = setInterval(fetchData, 3000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [teamId, fetchData]);

  return { team, agents, tasks, governance, loading, error, refresh: fetchData };
}
