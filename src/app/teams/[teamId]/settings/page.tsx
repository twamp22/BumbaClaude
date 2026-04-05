"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTeamStatus } from "@/hooks/useTeamStatus";
import StatusBadge from "@/components/shared/StatusBadge";
import Link from "next/link";

interface ContextFile {
  name: string;
  relativePath: string;
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

  useEffect(() => {
    fetch(`/api/teams/${teamId}/context-files`)
      .then((res) => res.json())
      .then((data) => {
        setContextFiles(data.files || []);
        setContextLoading(false);
      })
      .catch(() => setContextLoading(false));
  }, [teamId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-zinc-500 font-mono">Loading...</div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500 font-mono">Team not found</div>
      </div>
    );
  }

  const getRule = (type: string) => {
    const rule = governance.find((r) => r.rule_type === type);
    return rule?.rule_value === "true";
  };

  const getMaxTurns = () => {
    const rule = governance.find((r) => r.rule_type === "max_turns");
    return rule?.rule_value || "25";
  };

  const deleteTeam = async () => {
    await fetch(`/api/teams/${team.id}`, { method: "DELETE" });
    window.location.href = "/";
  };

  const killTeam = async () => {
    await fetch(`/api/teams/${team.id}/kill`, { method: "POST" });
    router.refresh();
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
          Files that Claude Code reads for project context from {team.project_dir}
        </p>

        {contextLoading ? (
          <div className="text-sm font-mono text-zinc-600 py-4 text-center">Scanning...</div>
        ) : contextFiles.length === 0 ? (
          <div className="text-sm font-mono text-zinc-600 py-4 text-center">
            No context files found in project directory
          </div>
        ) : (
          <div className="space-y-1.5">
            {contextFiles.map((file) => (
              <div key={file.relativePath} className="border border-zinc-800 rounded-lg overflow-hidden">
                <button
                  onClick={() =>
                    setExpandedFile(expandedFile === file.relativePath ? null : file.relativePath)
                  }
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-zinc-500">
                      {expandedFile === file.relativePath ? "[-]" : "[+]"}
                    </span>
                    <span className="text-sm font-mono text-zinc-200">{file.relativePath}</span>
                  </div>
                  <span className="text-xs font-mono text-zinc-600">
                    {file.size < 1024
                      ? `${file.size} B`
                      : `${(file.size / 1024).toFixed(1)} KB`}
                  </span>
                </button>
                {expandedFile === file.relativePath && (
                  <div className="border-t border-zinc-800 bg-black/30 max-h-80 overflow-y-auto">
                    <pre className="p-3 text-xs font-mono text-zinc-400 whitespace-pre-wrap">
                      {file.content}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="bg-zinc-900 border border-red-900/30 rounded-lg p-4 space-y-3">
        <h2 className="font-mono font-bold text-red-400 text-sm uppercase tracking-wider">Danger Zone</h2>
        <div className="flex gap-3">
          {isActive && (
            <button
              onClick={killTeam}
              className="px-4 py-2 text-sm font-mono bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg border border-red-600/30 transition-colors"
            >
              Kill Team
            </button>
          )}
          <button
            onClick={deleteTeam}
            className="px-4 py-2 text-sm font-mono bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg border border-red-600/30 transition-colors"
          >
            Delete Team
          </button>
        </div>
      </div>
    </div>
  );
}
