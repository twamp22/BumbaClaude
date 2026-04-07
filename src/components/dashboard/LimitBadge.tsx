"use client";

import { useState, useEffect } from "react";

interface LimitData {
  subscriptionType: string | null;
  rateLimitTier: string | null;
  rateLimitHits: number;
  latestRateLimitEvent: {
    status: string;
    resetsAt: number;
    rateLimitType: string;
    overageStatus: string;
    isUsingOverage: boolean;
    timestamp: string;
  } | null;
}

export default function LimitBadge() {
  const [data, setData] = useState<LimitData | null>(null);

  useEffect(() => {
    const fetchLimits = async () => {
      try {
        const res = await fetch("/api/limits");
        setData(await res.json());
      } catch { /* ignore */ }
    };
    fetchLimits();
    const interval = setInterval(fetchLimits, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!data) return null;

  const tierLabel = data.subscriptionType?.toUpperCase() || "FREE";
  const tierColor = data.subscriptionType === "max"
    ? "text-purple-400 bg-purple-500/10 border-purple-500/20"
    : "text-zinc-400 bg-zinc-500/10 border-zinc-500/20";

  const rateEvent = data.latestRateLimitEvent;
  const resetsIn = rateEvent ? Math.max(0, Math.floor((rateEvent.resetsAt * 1000 - Date.now()) / 60000)) : null;

  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${tierColor}`}>
        {tierLabel}
      </span>
      {rateEvent && resetsIn !== null && resetsIn > 0 && (
        <span className="text-xs font-mono text-zinc-500">
          resets {resetsIn}m
        </span>
      )}
      {rateEvent?.isUsingOverage && (
        <span className="text-xs font-mono text-amber-400 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
          OVERAGE
        </span>
      )}
      {data.rateLimitHits > 0 && (
        <span className="text-xs font-mono text-red-400">
          {data.rateLimitHits} limit hit{data.rateLimitHits !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}
