"use client";

import { useState } from "react";

interface MessageInputProps {
  teamId: string;
  agentId: string;
}

export default function MessageInput({ teamId, agentId }: MessageInputProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/teams/${teamId}/agents/${agentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "message", text }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to send");
        return;
      }
      setText("");
    } catch {
      setError("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Send message to agent..."
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
        />
        <button
          onClick={send}
          disabled={!text.trim() || sending}
          className="px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-xs font-mono rounded transition-colors"
        >
          Send
        </button>
      </div>
      {error && (
        <div className="text-xs font-mono text-red-500">{error}</div>
      )}
    </div>
  );
}
