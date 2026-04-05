"use client";

import { useState, useEffect } from "react";
import type { AuditEvent } from "@/lib/types";

export default function ActivityFeed() {
  const [events, setEvents] = useState<AuditEvent[]>([]);

  useEffect(() => {
    fetch("/api/audit/recent")
      .then((res) => res.json())
      .then(setEvents)
      .catch(console.error);

    const interval = setInterval(() => {
      fetch("/api/audit/recent")
        .then((res) => res.json())
        .then(setEvents)
        .catch(console.error);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <h2 className="font-mono font-bold text-zinc-100 mb-3">Recent Activity</h2>
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {events.map((event) => (
          <div key={event.id} className="flex items-start gap-3 text-xs font-mono">
            <span className="text-zinc-600 whitespace-nowrap">
              {new Date(event.created_at).toLocaleTimeString()}
            </span>
            <span className="text-zinc-400">{event.event_type}</span>
            {event.event_data && (
              <span className="text-zinc-600 truncate">
                {(() => {
                  try {
                    const data = JSON.parse(event.event_data);
                    return data.name || data.title || data.text || "";
                  } catch {
                    return "";
                  }
                })()}
              </span>
            )}
          </div>
        ))}
        {events.length === 0 && (
          <div className="text-zinc-600 text-sm">No recent activity</div>
        )}
      </div>
    </div>
  );
}
