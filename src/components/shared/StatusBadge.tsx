"use client";

const STATUS_COLORS: Record<string, string> = {
  // Team statuses
  running: "bg-green-500",
  paused: "bg-amber-500",
  completed: "bg-zinc-500",
  errored: "bg-red-500",
  // Agent statuses
  idle: "bg-amber-500",
  working: "bg-green-500",
  waiting: "bg-amber-500",
  // Task statuses
  pending: "bg-zinc-500",
  claimed: "bg-blue-500",
  in_progress: "bg-green-500",
  review: "bg-purple-500",
  blocked: "bg-red-500",
};

const STATUS_LABELS: Record<string, string> = {
  in_progress: "In Progress",
  review: "In Review",
};

export default function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || "bg-zinc-600";
  const label = STATUS_LABELS[status] || status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-mono">
      <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}
