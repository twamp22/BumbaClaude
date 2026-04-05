import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";

const PORT = parseInt(process.env.WS_PORT || "3001");

let wss: WebSocketServer | null = null;
const teamClients = new Map<string, Set<WebSocket>>();

export function getWebSocketServer(): WebSocketServer {
  if (wss) return wss;

  wss = new WebSocketServer({ port: PORT });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || "/", `http://localhost:${PORT}`);
    const teamId = url.searchParams.get("teamId");

    if (!teamId) {
      ws.close(4000, "Missing teamId parameter");
      return;
    }

    if (!teamClients.has(teamId)) {
      teamClients.set(teamId, new Set());
    }
    teamClients.get(teamId)!.add(ws);

    ws.on("close", () => {
      const clients = teamClients.get(teamId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) {
          teamClients.delete(teamId);
        }
      }
    });

    ws.on("error", () => {
      const clients = teamClients.get(teamId);
      if (clients) {
        clients.delete(ws);
      }
    });
  });

  console.error(`[websocket] Server running on port ${PORT}`);
  return wss;
}

export interface WsEvent {
  type: string;
  teamId: string;
  agentId?: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

export function broadcast(teamId: string, event: Omit<WsEvent, "timestamp" | "teamId">): void {
  const clients = teamClients.get(teamId);
  if (!clients || clients.size === 0) return;

  const message = JSON.stringify({
    ...event,
    teamId,
    timestamp: new Date().toISOString(),
  });

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

export function broadcastAll(event: Omit<WsEvent, "timestamp" | "teamId">): void {
  for (const [teamId] of teamClients) {
    broadcast(teamId, event);
  }
}

export function getConnectedTeamIds(): string[] {
  return Array.from(teamClients.keys());
}

export function getClientCount(teamId: string): number {
  return teamClients.get(teamId)?.size || 0;
}
