"use client";

import { useState, useEffect } from "react";

interface Schedule {
  id: string;
  agent_id: string;
  name: string;
  schedule_type: string;
  schedule_value: string;
  message: string;
  enabled: number;
  last_run_at: string | null;
  run_count: number;
}

interface Agent {
  id: string;
  name: string;
  status: string;
}

export default function SchedulePanel({ teamId, agents }: { teamId: string; agents: Agent[] }) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ agent_id: "", name: "", schedule_type: "interval", schedule_value: "60000", message: "" });

  const fetchSchedules = async () => {
    try {
      const res = await fetch(`/api/teams/${teamId}/schedules`);
      const data = await res.json();
      setSchedules(data.schedules || []);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchSchedules();
    const interval = setInterval(fetchSchedules, 5000);
    return () => clearInterval(interval);
  }, [teamId]);

  const agentMap = new Map(agents.map((a) => [a.id, a.name]));

  const createSchedule = async () => {
    await fetch(`/api/teams/${teamId}/schedules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowForm(false);
    setForm({ agent_id: "", name: "", schedule_type: "interval", schedule_value: "60000", message: "" });
    fetchSchedules();
  };

  const toggleSchedule = async (id: string, currentEnabled: number) => {
    await fetch(`/api/teams/${teamId}/schedules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !currentEnabled }),
    });
    fetchSchedules();
  };

  const removeSchedule = async (id: string) => {
    await fetch(`/api/teams/${teamId}/schedules/${id}`, { method: "DELETE" });
    fetchSchedules();
  };

  const formatInterval = (ms: string) => {
    const minutes = parseInt(ms) / 60000;
    return minutes >= 60 ? `${(minutes / 60).toFixed(1)}h` : `${minutes}m`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Schedules</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-xs font-mono text-green-400 hover:text-green-300 transition-colors"
        >
          {showForm ? "Cancel" : "+ New"}
        </button>
      </div>

      {showForm && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3 space-y-2">
          <select
            value={form.agent_id}
            onChange={(e) => setForm({ ...form, agent_id: e.target.value })}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm font-mono text-zinc-200"
          >
            <option value="">Select agent</option>
            {agents.filter((a) => a.status !== "completed" && a.status !== "errored").map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <input
            placeholder="Schedule name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm font-mono text-zinc-200"
          />
          <div className="flex gap-2">
            <select
              value={form.schedule_type}
              onChange={(e) => setForm({ ...form, schedule_type: e.target.value })}
              className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm font-mono text-zinc-200"
            >
              <option value="interval">Interval</option>
              <option value="cron">Cron</option>
            </select>
            <input
              placeholder={form.schedule_type === "interval" ? "ms (60000 = 1min)" : "cron expression"}
              value={form.schedule_value}
              onChange={(e) => setForm({ ...form, schedule_value: e.target.value })}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm font-mono text-zinc-200"
            />
          </div>
          <textarea
            placeholder="Message to send"
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            rows={2}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm font-mono text-zinc-200 resize-none"
          />
          <button
            onClick={createSchedule}
            disabled={!form.agent_id || !form.name || !form.message}
            className="w-full px-3 py-1.5 text-sm font-mono bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded border border-green-600/30 transition-colors disabled:opacity-40"
          >
            Create Schedule
          </button>
        </div>
      )}

      {schedules.length === 0 && !showForm && (
        <div className="text-center text-zinc-600 font-mono text-sm py-4">No schedules configured</div>
      )}

      {schedules.map((schedule) => (
        <div key={schedule.id} className="flex items-center justify-between bg-zinc-900/40 rounded px-3 py-2 text-sm font-mono">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${schedule.enabled ? "bg-green-400" : "bg-zinc-600"}`} />
              <span className="text-zinc-300 truncate">{schedule.name}</span>
              <span className="text-xs text-zinc-600">
                {schedule.schedule_type === "interval" ? formatInterval(schedule.schedule_value) : schedule.schedule_value}
              </span>
            </div>
            <div className="text-xs text-zinc-500 mt-0.5 ml-4">
              {agentMap.get(schedule.agent_id) || "?"} -- {schedule.run_count} runs
              {schedule.last_run_at && ` -- last ${new Date(schedule.last_run_at).toLocaleTimeString()}`}
            </div>
          </div>
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={() => toggleSchedule(schedule.id, schedule.enabled)}
              className="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              {schedule.enabled ? "Pause" : "Resume"}
            </button>
            <button
              onClick={() => removeSchedule(schedule.id)}
              className="px-2 py-1 text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
