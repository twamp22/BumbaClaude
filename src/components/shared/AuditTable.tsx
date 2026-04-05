"use client";

import { useState, useEffect } from "react";
import type { AuditEvent } from "@/lib/types";

interface AuditTableProps {
  teamId: string;
  agents?: { id: string; name: string }[];
}

const EVENT_TYPES = [
  "agent_spawned",
  "agent_status_changed",
  "agent_interrupted",
  "team_created",
  "team_status_changed",
  "team_paused",
  "team_killed",
  "task_created",
  "task_status_changed",
  "message_sent",
];

export default function AuditTable({ teamId, agents }: AuditTableProps) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [filterAgent, setFilterAgent] = useState("");
  const [filterType, setFilterType] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (filterAgent) params.set("agentId", filterAgent);
    if (filterType) params.set("eventType", filterType);

    fetch(`/api/teams/${teamId}/audit?${params}`)
      .then((res) => res.json())
      .then(setEvents)
      .catch(console.error);
  }, [teamId, filterAgent, filterType]);

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <select
          value={filterAgent}
          onChange={(e) => setFilterAgent(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm font-mono text-zinc-300"
        >
          <option value="">All agents</option>
          {agents?.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm font-mono text-zinc-300"
        >
          <option value="">All events</option>
          {EVENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm font-mono">
          <thead>
            <tr className="text-zinc-500 text-left border-b border-zinc-800">
              <th className="pb-2 pr-4">Time</th>
              <th className="pb-2 pr-4">Event</th>
              <th className="pb-2 pr-4">Agent</th>
              <th className="pb-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => {
              const agentName = agents?.find((a) => a.id === event.agent_id)?.name;
              let details = "";
              if (event.event_data) {
                try {
                  const data = JSON.parse(event.event_data);
                  details = Object.entries(data)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(", ");
                } catch {
                  details = event.event_data;
                }
              }

              return (
                <tr key={event.id} className="border-b border-zinc-800/50 text-zinc-300">
                  <td className="py-1.5 pr-4 text-zinc-500 whitespace-nowrap">
                    {new Date(event.created_at).toLocaleTimeString()}
                  </td>
                  <td className="py-1.5 pr-4 whitespace-nowrap">{event.event_type}</td>
                  <td className="py-1.5 pr-4 text-zinc-400">{agentName || "-"}</td>
                  <td className="py-1.5 text-zinc-500 truncate max-w-xs">{details}</td>
                </tr>
              );
            })}
            {events.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-zinc-600">
                  No events recorded
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
