import type { Team, Agent, Task } from "@/lib/types";

interface QuickStatsProps {
  teams: Team[];
  agents: Agent[];
  tasks: Task[];
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className="text-3xl font-bold font-mono text-zinc-100">{value}</div>
      <div className="text-sm text-zinc-500 mt-1">{label}</div>
    </div>
  );
}

export default function QuickStats({ teams, agents, tasks }: QuickStatsProps) {
  const teamsRunning = teams.filter((t) => t.status === "running").length;
  const agentsActive = agents.filter((a) => a.status === "working" || a.status === "idle").length;
  const tasksCompleted = tasks.filter((t) => t.status === "completed").length;
  const tasksPending = tasks.filter(
    (t) => t.status === "pending" || t.status === "in_progress" || t.status === "claimed"
  ).length;

  return (
    <div className="grid grid-cols-4 gap-4">
      <StatCard label="Teams running" value={teamsRunning} />
      <StatCard label="Agents active" value={agentsActive} />
      <StatCard label="Tasks completed" value={tasksCompleted} />
      <StatCard label="Tasks pending" value={tasksPending} />
    </div>
  );
}
