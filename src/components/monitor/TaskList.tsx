"use client";

import { useState } from "react";
import type { Task, Agent } from "@/lib/types";
import StatusBadge from "@/components/shared/StatusBadge";

interface TaskListProps {
  tasks: Task[];
  agents: Agent[];
  teamId: string;
  staleThresholdMinutes?: number;
  onRefresh: () => void;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

const DEFAULT_STALE_THRESHOLD_MIN = 15;

function isStale(task: Task, thresholdMs: number): boolean {
  if (task.status !== "in_progress") return false;
  const created = new Date(task.created_at).getTime();
  return Date.now() - created > thresholdMs;
}

export default function TaskList({ tasks, agents, teamId, staleThresholdMinutes, onRefresh }: TaskListProps) {
  const staleThresholdMs = (staleThresholdMinutes || DEFAULT_STALE_THRESHOLD_MIN) * 60 * 1000;
  const [newTitle, setNewTitle] = useState("");
  const [assignTo, setAssignTo] = useState("");
  const [adding, setAdding] = useState(false);

  const addTask = async () => {
    if (!newTitle.trim() || adding) return;
    setAdding(true);
    try {
      const body: Record<string, string> = { title: newTitle };
      if (assignTo) body.assigned_agent_id = assignTo;
      await fetch(`/api/teams/${teamId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setNewTitle("");
      setAssignTo("");
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

  // Group tasks: top-level (with their sub-tasks inline, including completed ones)
  const topLevel = tasks.filter((t) => !t.parent_task_id);
  const getSubTasks = (parentId: string) => tasks.filter((t) => t.parent_task_id === parentId);

  // Completed top-level tasks that have no sub-tasks go to the completed section
  const activeTopLevel = topLevel.filter(
    (t) => t.status !== "completed" || getSubTasks(t.id).length > 0
  );
  const completedTopLevel = topLevel.filter(
    (t) => t.status === "completed" && getSubTasks(t.id).length === 0
  );

  // Orphaned completed tasks (sub-tasks whose parent is also completed -- show separately)
  const completedCount = tasks.filter((t) => t.status === "completed").length;

  return (
    <div className="flex flex-col h-full">
      <h3 className="font-mono font-bold text-zinc-100 mb-3 flex items-center justify-between">
        <span>Tasks</span>
        <span className="text-xs font-normal text-zinc-500">
          {completedCount}/{tasks.length} done
        </span>
      </h3>

      <div className="flex-1 space-y-1.5 overflow-y-auto">
        {activeTopLevel.map((task) => {
          const subs = getSubTasks(task.id);
          const stale = isStale(task, staleThresholdMs);
          return (
            <div key={task.id}>
              <div className={`flex items-start justify-between py-2 px-3 bg-zinc-900/80 border rounded-lg group ${
                stale ? "border-red-800/60" : task.status === "completed" ? "border-zinc-800/40" : "border-zinc-800"
              } ${task.status === "completed" ? "opacity-60" : ""}`}>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-mono ${task.status === "completed" ? "text-zinc-500 line-through" : "text-zinc-100"}`}>
                    {task.title}
                  </div>
                  <div className="text-xs font-mono text-zinc-500 mt-0.5 flex gap-2 flex-wrap">
                    {getAgentName(task.assigned_agent_id) && (
                      <span>&rarr; {getAgentName(task.assigned_agent_id)}</span>
                    )}
                    {getAgentName(task.created_by_agent_id) && (
                      <span className="text-zinc-600">from {getAgentName(task.created_by_agent_id)}</span>
                    )}
                    <span className="text-zinc-700">{timeAgo(task.created_at)}</span>
                    {stale && (
                      <span className="text-red-400 font-bold" title="Task has been in_progress for over 15 minutes">
                        STALE
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                  <StatusBadge status={task.status} />
                  {task.status !== "completed" && (
                    <button
                      onClick={() => updateStatus(task.id, "completed")}
                      className="text-xs font-mono text-zinc-700 hover:text-green-500 opacity-0 group-hover:opacity-100 transition-all"
                      title="Mark complete"
                    >
                      [done]
                    </button>
                  )}
                </div>
              </div>
              {subs.length > 0 && (
                <div className="ml-3 pl-3 border-l border-zinc-800/50 mt-1 space-y-1">
                  {subs.map((sub) => {
                    const subStale = isStale(sub, staleThresholdMs);
                    return (
                      <div
                        key={sub.id}
                        className={`flex items-start justify-between py-1.5 px-3 border rounded group ${
                          sub.status === "completed"
                            ? "bg-zinc-900/20 border-zinc-800/30 opacity-50"
                            : subStale
                            ? "bg-zinc-900/40 border-red-800/50"
                            : "bg-zinc-900/40 border-zinc-800/50"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className={`text-xs font-mono ${sub.status === "completed" ? "text-zinc-600 line-through" : "text-zinc-300"}`}>
                            {sub.title}
                          </div>
                          <div className="text-[10px] font-mono text-zinc-600 mt-0.5 flex gap-2 flex-wrap">
                            {getAgentName(sub.assigned_agent_id) && (
                              <span>&rarr; {getAgentName(sub.assigned_agent_id)}</span>
                            )}
                            {getAgentName(sub.created_by_agent_id) && (
                              <span>from {getAgentName(sub.created_by_agent_id)}</span>
                            )}
                            <span className="text-zinc-700">{timeAgo(sub.created_at)}</span>
                            {subStale && (
                              <span className="text-red-400 font-bold">STALE</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                          <StatusBadge status={sub.status} />
                          {sub.status !== "completed" && (
                            <button
                              onClick={() => updateStatus(sub.id, "completed")}
                              className="text-[10px] font-mono text-zinc-700 hover:text-green-500 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              [done]
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {completedTopLevel.length > 0 && (
          <div className="pt-2 mt-2 border-t border-zinc-800/50">
            <div className="text-xs font-mono text-zinc-600 mb-1.5 px-1">Completed</div>
            {completedTopLevel.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between py-1.5 px-3 text-zinc-600"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-mono line-through">{task.title}</span>
                  {task.completed_at && (
                    <span className="text-[10px] font-mono text-zinc-700 ml-2">
                      {timeAgo(task.completed_at)}
                    </span>
                  )}
                </div>
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

      <div className="mt-3 pt-3 border-t border-zinc-800 flex-shrink-0 space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()}
            placeholder="Add task..."
            className="flex-1 bg-zinc-800/80 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
          />
          <select
            value={assignTo}
            onChange={(e) => setAssignTo(e.target.value)}
            className="bg-zinc-800/80 border border-zinc-700 rounded-lg px-2 py-2 text-xs font-mono text-zinc-300 focus:outline-none focus:border-zinc-500"
          >
            <option value="">Assign to...</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <button
            onClick={addTask}
            disabled={!newTitle.trim() || adding}
            className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white text-xs font-mono rounded-lg transition-colors"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
