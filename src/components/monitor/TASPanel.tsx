"use client";

import { useState, useEffect } from "react";

interface TASFile {
  name: string;
  path: string;
  relativePath: string;
  size: number;
  modifiedAt: string;
  isDirectory: boolean;
}

interface TASAgentFolder {
  agentName: string;
  inbox: TASFile[];
  outbox: TASFile[];
}

interface TASContents {
  shared: TASFile[];
  agents: TASAgentFolder[];
}

interface TASPanelProps {
  teamId: string;
}

function FileItem({ file, teamId }: { file: TASFile; teamId: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const toggleExpand = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    if (file.isDirectory) return;

    try {
      const res = await fetch(`/api/teams/${teamId}/tas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: file.path }),
      });
      const data = await res.json();
      setContent(data.content || "");
      setExpanded(true);
    } catch {
      setContent("Failed to read file");
      setExpanded(true);
    }
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="border border-zinc-800/50 rounded overflow-hidden">
      <button
        onClick={toggleExpand}
        disabled={file.isDirectory}
        className="w-full flex items-center justify-between px-2 py-1 text-xs font-mono hover:bg-zinc-800/30 transition-colors disabled:opacity-50"
      >
        <span className="text-zinc-300 truncate">{file.name}</span>
        <div className="flex items-center gap-2 flex-shrink-0 text-zinc-600">
          <span>{timeAgo(file.modifiedAt)}</span>
          <span>
            {file.size < 1024
              ? `${file.size}B`
              : `${(file.size / 1024).toFixed(1)}K`}
          </span>
        </div>
      </button>
      {expanded && content !== null && (
        <div className="border-t border-zinc-800/50 bg-black/30 max-h-48 overflow-y-auto">
          <pre className="p-2 text-xs font-mono text-zinc-400 whitespace-pre-wrap">
            {content}
          </pre>
        </div>
      )}
    </div>
  );
}

function FolderSection({
  label,
  files,
  teamId,
  color,
}: {
  label: string;
  files: TASFile[];
  teamId: string;
  color: string;
}) {
  if (files.length === 0) return null;

  return (
    <div>
      <div className={`text-[10px] font-mono ${color} uppercase tracking-wider mb-1`}>
        {label} ({files.length})
      </div>
      <div className="space-y-0.5">
        {files.map((file) => (
          <FileItem key={file.path} file={file} teamId={teamId} />
        ))}
      </div>
    </div>
  );
}

export default function TASPanel({ teamId }: TASPanelProps) {
  const [contents, setContents] = useState<TASContents | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTAS = () => {
      fetch(`/api/teams/${teamId}/tas`)
        .then((res) => res.json())
        .then((data) => {
          setContents(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    };

    fetchTAS();
    const interval = setInterval(fetchTAS, 5000);
    return () => clearInterval(interval);
  }, [teamId]);

  const totalFiles =
    (contents?.shared.length || 0) +
    (contents?.agents.reduce(
      (sum, a) => sum + a.inbox.length + a.outbox.length,
      0
    ) || 0);

  return (
    <div className="flex flex-col h-full">
      <h3 className="font-mono font-bold text-zinc-100 mb-3 flex items-center justify-between">
        <span>TAS</span>
        <span className="text-xs font-normal text-zinc-500">
          {totalFiles} file{totalFiles !== 1 ? "s" : ""}
        </span>
      </h3>

      {loading ? (
        <div className="text-sm font-mono text-zinc-600 py-4 text-center">Loading...</div>
      ) : !contents || totalFiles === 0 ? (
        <div className="text-sm font-mono text-zinc-600 py-8 text-center">
          <div>No files in TAS yet</div>
          <div className="text-xs mt-1 text-zinc-700">
            Agents will place files in their outbox
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-3">
          <FolderSection
            label="Shared"
            files={contents.shared}
            teamId={teamId}
            color="text-amber-500"
          />

          {contents.agents.map((agent) => (
            <div key={agent.agentName}>
              <div className="text-xs font-mono text-zinc-400 font-bold mb-1.5">
                {agent.agentName}
              </div>
              <div className="ml-2 space-y-2">
                <FolderSection
                  label="Outbox"
                  files={agent.outbox}
                  teamId={teamId}
                  color="text-green-500"
                />
                <FolderSection
                  label="Inbox"
                  files={agent.inbox}
                  teamId={teamId}
                  color="text-blue-400"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
