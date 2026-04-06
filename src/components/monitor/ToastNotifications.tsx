"use client";

import { useState, useEffect, useCallback } from "react";

interface Toast {
  id: number;
  message: string;
  type: "started" | "completed" | "assigned" | "warning";
  timestamp: number;
}

interface ToastNotificationsProps {
  teamId: string;
}

const TOAST_DURATION_MS = 6000;

let toastCounter = 0;

function getToastStyle(type: Toast["type"]): string {
  switch (type) {
    case "started":
      return "border-green-600/60 bg-green-950/90 text-green-300";
    case "completed":
      return "border-emerald-600/60 bg-emerald-950/90 text-emerald-300";
    case "assigned":
      return "border-amber-600/60 bg-amber-950/90 text-amber-300";
    case "warning":
      return "border-red-600/60 bg-red-950/90 text-red-300";
  }
}

function getToastIcon(type: Toast["type"]): string {
  switch (type) {
    case "started":
      return ">>>";
    case "completed":
      return "[OK]";
    case "assigned":
      return "[=>]";
    case "warning":
      return "[!!]";
  }
}

export default function ToastNotifications({ teamId }: ToastNotificationsProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast["type"]) => {
    const id = ++toastCounter;
    setToasts((prev) => [...prev.slice(-4), { id, message, type, timestamp: Date.now() }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_DURATION_MS);
  }, []);

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
            const eventData = data.data || {};

            switch (data.type) {
              case "task_started":
                addToast(
                  `${eventData.agent_name || "Agent"} STARTED: ${eventData.title || "task"}`,
                  "started"
                );
                break;
              case "task_completed":
                addToast(
                  `${eventData.agent_name || "Agent"} COMPLETED: ${eventData.title || "task"}`,
                  "completed"
                );
                break;
              case "task_assigned":
                addToast(
                  `${eventData.from || "User"} assigned "${eventData.title || "task"}" to ${eventData.to || "agent"}`,
                  "assigned"
                );
                break;
            }
          } catch {
            // Ignore malformed messages
          }
        };

        ws.onclose = () => {
          reconnectTimer = setTimeout(connect, 5000);
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch {
        // WebSocket not available
      }
    }

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [teamId, addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-md">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto px-4 py-3 rounded-lg border font-mono text-sm shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-right ${getToastStyle(toast.type)}`}
          style={{
            animation: "toast-in 0.3s ease-out",
          }}
        >
          <div className="flex items-center gap-2">
            <span className="font-bold flex-shrink-0">{getToastIcon(toast.type)}</span>
            <span>{toast.message}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
