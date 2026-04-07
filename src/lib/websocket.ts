import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";

const PORT = parseInt(process.env.WS_PORT || "3001");

const globalForWs = globalThis as unknown as {
  _wss?: WebSocketServer;
  _wsTeamClients?: Map<string, Set<WebSocket>>;
};

function getTeamClients(): Map<string, Set<WebSocket>> {
  if (!globalForWs._wsTeamClients) {
    globalForWs._wsTeamClients = new Map();
  }
  return globalForWs._wsTeamClients;
}

export function getWebSocketServer(): WebSocketServer {
  if (globalForWs._wss) return globalForWs._wss;

  const teamClients = getTeamClients();
  const wss = new WebSocketServer({ port: PORT });
  globalForWs._wss = wss;

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
  const teamClients = getTeamClients();
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
  const teamClients = getTeamClients();
  for (const [teamId] of teamClients) {
    broadcast(teamId, event);
  }
}

export function getConnectedTeamIds(): string[] {
  return Array.from(getTeamClients().keys());
}

export function getClientCount(teamId: string): number {
  return getTeamClients().get(teamId)?.size || 0;
}
