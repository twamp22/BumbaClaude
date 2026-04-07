"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function AddAgentPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const router = useRouter();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [modelTier, setModelTier] = useState<"haiku" | "sonnet" | "opus">("sonnet");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!name.trim() || !role.trim()) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/teams/${teamId}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          role,
          model_tier: modelTier,
          system_prompt: systemPrompt || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to add agent");
        setSubmitting(false);
        return;
      }

      router.push(`/teams/${teamId}`);
    } catch {
      setError("Failed to add agent");
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/teams/${teamId}`}
          className="text-zinc-500 hover:text-zinc-300 font-mono text-sm transition-colors"
        >
          &larr; Back
        </Link>
      </div>

      <h1 className="text-2xl font-bold font-mono">Add Agent</h1>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4">
        <div>
          <label className="block text-sm font-mono text-zinc-400 mb-1">Agent name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="News Writer"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
          />
        </div>

        <div>
          <label className="block text-sm font-mono text-zinc-400 mb-1">Model</label>
          <div className="flex gap-2">
            {(["haiku", "sonnet", "opus"] as const).map((tier) => (
              <button
                key={tier}
                onClick={() => setModelTier(tier)}
                className={`px-4 py-2 text-sm font-mono rounded-lg border transition-colors ${
                  modelTier === tier
                    ? "bg-zinc-700 border-zinc-500 text-zinc-100"
                    : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-600"
                }`}
              >
                {tier.charAt(0).toUpperCase() + tier.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-mono text-zinc-400 mb-1">Role</label>
          <textarea
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Describe what this agent does..."
            rows={3}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-mono text-zinc-400 mb-1">
            System prompt (optional)
          </label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Custom initial task or instructions..."
            rows={3}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 resize-none"
          />
        </div>
      </div>

      {error && (
        <div className="text-sm font-mono text-red-400">{error}</div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={!name.trim() || !role.trim() || submitting}
          className="px-6 py-2 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-mono font-bold rounded-lg transition-colors"
        >
          {submitting ? "Spawning..." : "Add Agent"}
        </button>
      </div>
    </div>
  );
}
