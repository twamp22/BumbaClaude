"use client";

import { useState } from "react";
import type { Task, Agent } from "@/lib/types";
import StatusBadge from "@/components/shared/StatusBadge";

interface TaskListProps {
  tasks: Task[];
  agents: Agent[];
  teamId: string;
  onRefresh: () => void;
}

export default function TaskList({ tasks, agents, teamId, onRefresh }: TaskListProps) {
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const addTask = async () => {
    if (!newTitle.trim() || adding) return;
    setAdding(true);
    try {
      await fetch(`/api/teams/${teamId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
      setNewTitle("");
      onRefresh();
    } catch (error) {
      console.error("Failed to add task:", error);
    } finally {
      setAdding(false);
    }
  };

  const updateStatus = async (taskId: string, status: string) => {
    try {
      await fetch(`/api/teams/${teamId}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      onRefresh();
    } catch (error) {
      console.error("Failed to update task:", error);
    }
  };

  const getAgentName = (agentId: string | null) => {
    if (!agentId) return "Unassigned";
    return agents.find((a) => a.id === agentId)?.name || "Unknown";
  };

  return (
    <div className="space-y-3">
      <h3 className="font-mono font-bold text-zinc-100">Tasks</h3>

      <div className="space-y-1">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center justify-between py-2 px-3 bg-zinc-900 border border-zinc-800 rounded"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-mono text-zinc-100 truncate">{task.title}</div>
              <div className="text-xs font-mono text-zinc-500">{getAgentName(task.assigned_agent_id)}</div>
            </div>
            <div className="flex items-center gap-2 ml-3">
              <StatusBadge status={task.status} />
              {task.status !== "completed" && (
                <button
                  onClick={() => updateStatus(task.id, "completed")}
                  className="text-xs font-mono text-zinc-600 hover:text-green-500 transition-colors"
                  title="Mark complete"
                >
                  [done]
                </button>
              )}
            </div>
          </div>
        ))}
        {tasks.length === 0 && (
          <div className="text-sm font-mono text-zinc-600 py-4 text-center">No tasks</div>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTask()}
          placeholder="Add task..."
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
        />
        <button
          onClick={addTask}
          disabled={!newTitle.trim() || adding}
          className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white text-xs font-mono rounded transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  );
}
