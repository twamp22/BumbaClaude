"use client";

import { useState, useEffect, useCallback } from "react";
import type { AuditEvent } from "@/lib/types";

export function useAuditLog(teamId: string, pollInterval: number = 5000) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(() => {
    fetch(`/api/teams/${teamId}/audit`)
      .then((res) => res.json())
      .then((data) => {
        setEvents(data);
        setLoading(false);
      })
      .catch(console.error);
  }, [teamId]);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, pollInterval);
    return () => clearInterval(interval);
  }, [fetchEvents, pollInterval]);

  return { events, loading, refresh: fetchEvents };
}
