"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTeamStatus } from "@/hooks/useTeamStatus";
import StatusBadge from "@/components/shared/StatusBadge";
import Link from "next/link";

interface ContextFile {
  name: string;
  fullPath: string;
  displayPath: string;
  source: "project" | "ancestor" | "global";
  size: number;
  content: string;
}

export default function TeamSettingsPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const router = useRouter();
  const { team, agents, governance, loading } = useTeamStatus(teamId);
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([]);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [contextLoading, setContextLoading] = useState(true);
  const [instructions, setInstructions] = useState("");
  const [instructionsSaved, setInstructionsSaved] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildMsg, setRebuildMsg] = useState("");

  useEffect(() => {
    fetch(`/api/teams/${teamId}/memory`)
      .then((res) => res.json())
      .then((data) => setInstructions(data.instructions || ""))
      .catch(console.error);
  }, [teamId]);

  useEffect(() => {
    fetch(`/api/teams/${teamId}/context-files`)
      .then((res) => res.json())
      .then((data) => {
        setContextFiles(data.files || []);
        setContextLoading(false);
      })
      .catch(() => setContextLoading(false));
  }, [teamId]);

  useEffect(() => {
    if (!loading && !team) {
      router.replace("/");
    }
  }, [loading, team, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-zinc-500 font-mono">Loading...</div>
      </div>
    );
  }

  if (!team) {
    return null;
  }

  const getRule = (type: string) => {
    const rule = governance.find((r) => r.rule_type === type);
    return rule?.rule_value === "true";
  };

  const getMaxTurns = () => {
    const rule = governance.find((r) => r.rule_type === "max_turns");
    return rule?.rule_value || "25";
  };

  const rebuild = async () => {
    setRebuilding(true);
    setRebuildMsg("");
    try {
      const res = await fetch(`/api/teams/${teamId}/rebuild`, { method: "POST" });
      const data = await res.json();
      setRebuildMsg(data.message || "Rebuilt");
    } catch {
      setRebuildMsg("Failed to rebuild");
    } finally {
      setRebuilding(false);
    }
  };

  const removeTeam = async () => {
    await fetch(`/api/teams/${team.id}?purge=true`, { method: "DELETE" });
    window.location.href = "/";
  };

  const isActive = team.status === "running" || team.status === "paused";

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

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold font-mono">{team.name}</h1>
          <StatusBadge status={team.status} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={rebuild}
            disabled={rebuilding}
            className="px-4 py-1.5 text-sm font-mono bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg border border-blue-600/30 transition-colors disabled:opacity-50"
          >
            {rebuilding ? "Rebuilding..." : "Rebuild Context"}
          </button>
          {rebuildMsg && (
            <span className="text-xs font-mono text-zinc-500">{rebuildMsg}</span>
          )}
        </div>
      </div>

      {/* Team info */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
        <h2 className="font-mono font-bold text-zinc-300 text-sm uppercase tracking-wider">Details</h2>
        <div className="grid grid-cols-2 gap-3 text-sm font-mono">
          <div>
            <div className="text-zinc-500">Directory</div>
            <div className="text-zinc-200">{team.project_dir}</div>
          </div>
          <div>
            <div className="text-zinc-500">Mode</div>
            <div className="text-zinc-200">{team.execution_mode}</div>
          </div>
          <div>
            <div className="text-zinc-500">Created</div>
            <div className="text-zinc-200">{new Date(team.created_at).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-zinc-500">Status</div>
            <div className="text-zinc-200">{team.status}</div>
          </div>
        </div>
      </div>

      {/* Agents */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-mono font-bold text-zinc-300 text-sm uppercase tracking-wider">
            Agents ({agents.length})
          </h2>
        </div>
        <div className="space-y-2">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="flex items-center justify-between py-2 px-3 bg-zinc-800/50 rounded-lg"
            >
              <div>
                <div className="font-mono text-sm text-zinc-100">{agent.name}</div>
                <div className="text-xs font-mono text-zinc-500">{agent.role}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-zinc-500">{agent.model_tier}</span>
                <StatusBadge status={agent.status} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Governance */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
        <h2 className="font-mono font-bold text-zinc-300 text-sm uppercase tracking-wider">Governance</h2>
        <div className="space-y-2 text-sm font-mono">
          <div className="flex justify-between py-1.5">
            <span className="text-zinc-400">Create files</span>
            <span className={getRule("can_create_files") ? "text-green-500" : "text-red-500"}>
              {getRule("can_create_files") ? "Allowed" : "Denied"}
            </span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-zinc-400">Run commands</span>
            <span className={getRule("can_run_commands") ? "text-green-500" : "text-red-500"}>
              {getRule("can_run_commands") ? "Allowed" : "Denied"}
            </span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-zinc-400">Push to git</span>
            <span className={getRule("can_push_git") ? "text-green-500" : "text-red-500"}>
              {getRule("can_push_git") ? "Allowed" : "Denied"}
            </span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-zinc-400">Max turns</span>
            <span className="text-zinc-200">{getMaxTurns()}</span>
          </div>
        </div>
      </div>

      {/* Context Files */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
        <h2 className="font-mono font-bold text-zinc-300 text-sm uppercase tracking-wider">
          Context Files
        </h2>
        <p className="text-xs font-mono text-zinc-500">
          Files that Claude Code loads for context. Discovered from project directory,
          ancestor directories, and global ~/.claude/ config.
        </p>

        {contextLoading ? (
          <div className="text-sm font-mono text-zinc-600 py-4 text-center">Scanning...</div>
        ) : contextFiles.length === 0 ? (
          <div className="text-sm font-mono text-zinc-600 py-4 text-center">
            No context files found
          </div>
        ) : (
          <div className="space-y-4">
            {(["project", "ancestor", "global"] as const).map((source) => {
              const files = contextFiles.filter((f) => f.source === source);
              if (files.length === 0) return null;
              const sourceLabels = {
                project: "Project Directory",
                ancestor: "Ancestor Directories",
                global: "Global (~/.claude/)",
              };
              const sourceColors = {
                project: "text-green-500",
                ancestor: "text-blue-400",
                global: "text-purple-400",
              };
              return (
                <div key={source}>
                  <div className={`text-xs font-mono ${sourceColors[source]} mb-1.5 uppercase tracking-wider`}>
                    {sourceLabels[source]}
                  </div>
                  <div className="space-y-1">
                    {files.map((file) => (
                      <div key={file.fullPath} className="border border-zinc-800 rounded-lg overflow-hidden">
                        <button
                          onClick={() =>
                            setExpandedFile(expandedFile === file.fullPath ? null : file.fullPath)
                          }
                          className="w-full flex items-center justify-between px-3 py-2 hover:bg-zinc-800/50 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-mono text-zinc-500 flex-shrink-0">
                              {expandedFile === file.fullPath ? "[-]" : "[+]"}
                            </span>
                            <span className="text-sm font-mono text-zinc-200 font-bold flex-shrink-0">
                              {file.name}
                            </span>
                            <span className="text-xs font-mono text-zinc-600 truncate">
                              {file.displayPath}
                            </span>
                          </div>
                          <span className="text-xs font-mono text-zinc-600 flex-shrink-0 ml-2">
                            {file.size < 1024
                              ? `${file.size} B`
                              : `${(file.size / 1024).toFixed(1)} KB`}
                          </span>
                        </button>
                        {expandedFile === file.fullPath && (
                          <div className="border-t border-zinc-800 bg-black/30 max-h-80 overflow-y-auto">
                            <pre className="p-3 text-xs font-mono text-zinc-400 whitespace-pre-wrap">
                              {file.content}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Custom Memory / Instructions */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
        <h2 className="font-mono font-bold text-zinc-300 text-sm uppercase tracking-wider">
          Custom Instructions
        </h2>
        <p className="text-xs font-mono text-zinc-500">
          Custom context injected into agents when running in isolated mode.
          This replaces auto-discovered CLAUDE.md and global memory.
        </p>
        <textarea
          value={instructions}
          onChange={(e) => {
            setInstructions(e.target.value);
            setInstructionsSaved(false);
          }}
          placeholder={"# Team Instructions\n\nAdd custom instructions for your agents here.\nThis is injected as the system prompt in isolated mode.\n\nExample:\n- Always write TypeScript\n- Use functional components\n- Follow the project's existing patterns"}
          rows={10}
          className="w-full bg-black/30 border border-zinc-700 rounded-lg px-4 py-3 text-sm font-mono text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-zinc-500 resize-y"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-zinc-600">
            {instructionsSaved ? "Saved" : "Unsaved changes"}
          </span>
          <button
            onClick={async () => {
              setSaving(true);
              await fetch(`/api/teams/${teamId}/memory`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ instructions }),
              });
              setInstructionsSaved(true);
              setSaving(false);
            }}
            disabled={instructionsSaved || saving}
            className="px-4 py-1.5 text-sm font-mono bg-green-600 hover:bg-green-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-lg transition-colors"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-zinc-900 border border-red-900/30 rounded-lg p-4 space-y-3">
        <h2 className="font-mono font-bold text-red-400 text-sm uppercase tracking-wider">Danger Zone</h2>
        <button
          onClick={removeTeam}
          className="px-4 py-2 text-sm font-mono bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg border border-red-600/30 transition-colors"
        >
          Remove Team
        </button>
      </div>
    </div>
  );
}
