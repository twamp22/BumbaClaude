"use client";

import { useRef, useEffect } from "react";
import type { EnrichedAuditEvent } from "@/hooks/useTeamStatus";

type ActivityEvent = EnrichedAuditEvent;

interface ActivityFeedProps {
  events: ActivityEvent[];
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function getEventIcon(eventType: string): string {
  switch (eventType) {
    case "task_started":
      return ">>>";
    case "task_completed":
      return "[OK]";
    case "task_assigned":
      return "[=>]";
    case "agent_ping":
      return "[!!]";
    case "task_status_changed":
      return "[~~]";
    case "team_status_changed":
      return "[**]";
    case "watchdog_no_start_ping":
      return "[!!]";
    default:
      return "[--]";
  }
}

function getEventColor(eventType: string): string {
  switch (eventType) {
    case "task_started":
      return "text-green-400";
    case "task_completed":
      return "text-emerald-400";
    case "task_assigned":
      return "text-amber-400";
    case "agent_ping":
      return "text-blue-400";
    case "task_status_changed":
      return "text-cyan-400";
    case "team_status_changed":
      return "text-purple-400";
    case "watchdog_no_start_ping":
      return "text-red-400";
    default:
      return "text-zinc-400";
  }
}

function formatEventMessage(event: ActivityEvent): string {
  const data = event.event_data ? JSON.parse(event.event_data) : {};
  const agentName = event.agent_name || data.agent_name || "Unknown";

  switch (event.event_type) {
    case "task_started":
      return `${agentName} STARTED: ${data.title || "unknown task"}`;
    case "task_completed":
      return `${agentName} COMPLETED: ${data.title || "unknown task"}`;
    case "task_assigned": {
      const from = data.from || "User";
      const to = data.to || "Unknown";
      return `${from} assigned to ${to}: ${data.task_title || data.title || "task"}`;
    }
    case "agent_ping": {
      const pingType = data.ping_type || "unknown";
      const from = data.from || "Unknown";
      const to = data.to || "Unknown";
      if (pingType === "completion") {
        return `${from} notified ${to}: completed ${data.task_title || "task"}`;
      }
      if (pingType === "status_update") {
        return `${from} sent update to ${to}: ${data.task_title || ""}`;
      }
      return `${from} pinged ${to} (${pingType})`;
    }
    case "task_status_changed":
      return `Task "${data.task_id?.substring(0, 8) || "?"}" changed: ${data.from} -> ${data.to}${data.reason ? ` (${data.reason})` : ""}`;
    case "team_status_changed":
      return `Team status: ${data.from} -> ${data.to}`;
    case "watchdog_no_start_ping":
      return `WARNING: ${data.agent_name || agentName} is working without a start ping!`;
    default:
      return `${event.event_type}: ${event.event_data || ""}`;
  }
}

export default function ActivityFeed({ events }: ActivityFeedProps) {
  const feedRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  useEffect(() => {
    if (events.length > prevCountRef.current && feedRef.current) {
      feedRef.current.scrollTop = 0;
    }
    prevCountRef.current = events.length;
  }, [events.length]);

  // Filter to show only the important events
  const importantTypes = new Set([
    "task_started",
    "task_completed",
    "task_assigned",
    "agent_ping",
    "task_status_changed",
    "team_status_changed",
    "watchdog_no_start_ping",
  ]);
  const filtered = events.filter((e) => importantTypes.has(e.event_type));

  return (
    <div className="flex flex-col h-full">
      <h3 className="font-mono font-bold text-zinc-100 mb-3 flex items-center justify-between">
        <span>Activity</span>
        <span className="text-xs font-normal text-zinc-500">
          {filtered.length} events
        </span>
      </h3>

      <div ref={feedRef} className="flex-1 overflow-y-auto space-y-0.5">
        {filtered.map((event) => {
          const icon = getEventIcon(event.event_type);
          const color = getEventColor(event.event_type);
          const message = formatEventMessage(event);
          const isHighlight = event.event_type === "task_started" || event.event_type === "task_completed" || event.event_type === "watchdog_no_start_ping";

          return (
            <div
              key={event.id}
              className={`px-3 py-1.5 rounded font-mono text-xs ${
                isHighlight
                  ? "bg-zinc-900/80 border border-zinc-800"
                  : "bg-transparent"
              }`}
            >
              <div className="flex items-start gap-2">
                <span className={`${color} font-bold flex-shrink-0`}>{icon}</span>
                <span className={`${isHighlight ? color + " font-bold" : "text-zinc-400"} flex-1`}>
                  {message}
                </span>
                <span className="text-zinc-700 flex-shrink-0">{formatTime(event.created_at)}</span>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-sm font-mono text-zinc-600 py-8 text-center">
            No activity yet
          </div>
        )}
      </div>
    </div>
  );
}
