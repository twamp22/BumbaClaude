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
  connected: boolean;
  refresh: () => void;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";

export function useTeamStatus(teamId: string): TeamStatusData {
  const [team, setTeam] = useState<Team | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [governance, setGovernance] = useState<GovernanceRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
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
    // Initial fetch
    fetchData();

    // Try WebSocket connection
    let ws: WebSocket;
    try {
      ws = new WebSocket(`${WS_URL}?teamId=${teamId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        // Clear polling if WebSocket connects
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      };

      ws.onmessage = () => {
        // On any WebSocket event, refresh data from the API
        fetchData();
      };

      ws.onclose = () => {
        setConnected(false);
        // Fall back to polling
        if (!pollRef.current) {
          pollRef.current = setInterval(fetchData, 3000);
        }
      };

      ws.onerror = () => {
        // WebSocket failed, fall back to polling
        setConnected(false);
        if (!pollRef.current) {
          pollRef.current = setInterval(fetchData, 3000);
        }
      };
    } catch {
      // WebSocket not available, use polling
      pollRef.current = setInterval(fetchData, 3000);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [teamId, fetchData]);

  return { team, agents, tasks, governance, loading, error, connected, refresh: fetchData };
}
