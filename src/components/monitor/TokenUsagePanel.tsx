"use client";

import { useState, useEffect } from "react";

interface TokenSummary {
  total_input: number;
  total_output: number;
  total_cache_read: number;
  total_cache_creation: number;
  total_cost: number;
  count: number;
}

interface TokenRecord {
  id: number;
  agent_id: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  cost_usd: number;
  model: string | null;
  duration_ms: number | null;
  recorded_at: string;
}

export default function TokenUsagePanel({ teamId, agents }: { teamId: string; agents: { id: string; name: string }[] }) {
  const [summary, setSummary] = useState<TokenSummary | null>(null);
  const [records, setRecords] = useState<TokenRecord[]>([]);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const res = await fetch(`/api/teams/${teamId}/usage`);
        const data = await res.json();
        setSummary(data.summary);
        setRecords(data.usage || []);
      } catch { /* ignore */ }
    };
    fetchUsage();
    const interval = setInterval(fetchUsage, 5000);
    return () => clearInterval(interval);
  }, [teamId]);

  const agentMap = new Map(agents.map((a) => [a.id, a.name]));

  // Aggregate per agent
  const perAgent = new Map<string, { input: number; output: number; cost: number; count: number }>();
  for (const rec of records) {
    const existing = perAgent.get(rec.agent_id) || { input: 0, output: 0, cost: 0, count: 0 };
    existing.input += rec.input_tokens;
    existing.output += rec.output_tokens;
    existing.cost += rec.cost_usd;
    existing.count += 1;
    perAgent.set(rec.agent_id, existing);
  }

  const formatTokens = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
  const formatCost = (n: number) => `$${n.toFixed(4)}`;

  return (
    <div className="space-y-4">
      {/* Summary */}
      {summary && summary.count > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3 text-center">
            <div className="text-lg font-mono font-bold text-green-400">{formatCost(summary.total_cost)}</div>
            <div className="text-xs font-mono text-zinc-500">Total Cost</div>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3 text-center">
            <div className="text-lg font-mono font-bold text-zinc-200">{formatTokens(summary.total_input + summary.total_output)}</div>
            <div className="text-xs font-mono text-zinc-500">Total Tokens</div>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3 text-center">
            <div className="text-lg font-mono font-bold text-zinc-200">{summary.count}</div>
            <div className="text-xs font-mono text-zinc-500">Responses</div>
          </div>
        </div>
      )}

      {/* Per-agent breakdown */}
      {perAgent.size > 0 && (
        <div>
          <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-2">Per Agent</h3>
          <div className="space-y-1">
            {Array.from(perAgent.entries()).map(([agentId, stats]) => (
              <div key={agentId} className="flex items-center justify-between bg-zinc-900/40 rounded px-3 py-2 text-sm font-mono">
                <span className="text-zinc-300">{agentMap.get(agentId) || agentId.slice(0, 8)}</span>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-zinc-500">{formatTokens(stats.input)} in / {formatTokens(stats.output)} out</span>
                  <span className="text-green-400">{formatCost(stats.cost)}</span>
                  <span className="text-zinc-600">{stats.count} calls</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary?.count === 0 && (
        <div className="text-center text-zinc-600 font-mono text-sm py-4">No token usage recorded yet</div>
      )}
    </div>
  );
}
