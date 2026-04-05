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
    if (!agentId) return null;
    return agents.find((a) => a.id === agentId)?.name || "Unknown";
  };

  const completed = tasks.filter((t) => t.status === "completed");
  const active = tasks.filter((t) => t.status !== "completed");

  return (
    <div className="flex flex-col h-full">
      <h3 className="font-mono font-bold text-zinc-100 mb-3 flex items-center justify-between">
        <span>Tasks</span>
        <span className="text-xs font-normal text-zinc-500">
          {completed.length}/{tasks.length} done
        </span>
      </h3>

      <div className="flex-1 space-y-1.5 overflow-y-auto">
        {active.map((task) => (
          <div
            key={task.id}
            className="flex items-start justify-between py-2 px-3 bg-zinc-900/80 border border-zinc-800 rounded-lg group"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-mono text-zinc-100">{task.title}</div>
              {getAgentName(task.assigned_agent_id) && (
                <div className="text-xs font-mono text-zinc-500 mt-0.5">
                  {getAgentName(task.assigned_agent_id)}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 ml-2 flex-shrink-0">
              <StatusBadge status={task.status} />
              <button
                onClick={() => updateStatus(task.id, "completed")}
                className="text-xs font-mono text-zinc-700 hover:text-green-500 opacity-0 group-hover:opacity-100 transition-all"
                title="Mark complete"
              >
                [done]
              </button>
            </div>
          </div>
        ))}

        {completed.length > 0 && (
          <div className="pt-2 mt-2 border-t border-zinc-800/50">
            <div className="text-xs font-mono text-zinc-600 mb-1.5 px-1">Completed</div>
            {completed.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between py-1.5 px-3 text-zinc-600"
              >
                <span className="text-sm font-mono line-through">{task.title}</span>
                <StatusBadge status={task.status} />
              </div>
            ))}
          </div>
        )}

        {tasks.length === 0 && (
          <div className="text-sm font-mono text-zinc-600 py-8 text-center">
            No tasks yet
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-3 pt-3 border-t border-zinc-800 flex-shrink-0">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTask()}
          placeholder="Add task..."
          className="flex-1 bg-zinc-800/80 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
        />
        <button
          onClick={addTask}
          disabled={!newTitle.trim() || adding}
          className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white text-xs font-mono rounded-lg transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  );
}
