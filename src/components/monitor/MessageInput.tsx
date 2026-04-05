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
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder={sending ? "Sending..." : "Message this agent..."}
            disabled={sending}
            className="w-full bg-zinc-800/80 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-green-600/50 focus:ring-1 focus:ring-green-600/20 disabled:opacity-50 transition-all"
          />
        </div>
        <button
          onClick={send}
          disabled={!text.trim() || sending}
          className="px-4 py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-sm font-mono font-bold rounded-lg transition-colors flex-shrink-0"
        >
          {sending ? "..." : "Send"}
        </button>
      </div>
      {error && (
        <div className="text-xs font-mono text-red-400 px-1">{error}</div>
      )}
    </div>
  );
}
