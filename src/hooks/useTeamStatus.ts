"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Team, Agent, Task, GovernanceRule, AuditEvent } from "@/lib/types";

export interface EnrichedAuditEvent extends AuditEvent {
  agent_name: string | null;
}

interface TeamStatusData {
  team: Team | null;
  agents: Agent[];
  tasks: Task[];
  governance: GovernanceRule[];
  events: EnrichedAuditEvent[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useTeamStatus(teamId: string): TeamStatusData {
  const [team, setTeam] = useState<Team | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [governance, setGovernance] = useState<GovernanceRule[]>([]);
  const [events, setEvents] = useState<EnrichedAuditEvent[]>([]);
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
        setEvents(data.events || []);
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

  // WebSocket for instant updates on task/agent events
  useEffect(() => {
    const wsPort = process.env.NEXT_PUBLIC_WS_PORT || "3001";
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsHost = window.location.hostname;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      try {
        ws = new WebSocket(`${wsProtocol}//${wsHost}:${wsPort}?teamId=${teamId}`);

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            // On any task/agent event, trigger an immediate refresh
            if (
              data.type === "task_started" ||
              data.type === "task_completed" ||
              data.type === "task_assigned"
            ) {
              fetchData();
            }
          } catch {
            // Ignore malformed messages
          }
        };

        ws.onclose = () => {
          // Reconnect after 5 seconds
          reconnectTimer = setTimeout(connect, 5000);
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch {
        // WebSocket server may not be running; fall back to polling only
      }
    }

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null; // Prevent reconnect on intentional close
        ws.close();
      }
    };
  }, [teamId, fetchData]);

  return { team, agents, tasks, governance, events, loading, error, refresh: fetchData };
}
