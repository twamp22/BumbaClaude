"use client";

import { useState, useEffect } from "react";
import type { WizardState } from "@/app/teams/new/page";

interface ProjectStepProps {
  state: WizardState;
  updateState: (partial: Partial<WizardState>) => void;
  onNext: () => void;
}

export default function ProjectStep({ state, updateState, onNext }: ProjectStepProps) {
  const [baseDir, setBaseDir] = useState("");
  const [dirManuallyEdited, setDirManuallyEdited] = useState(false);

  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        const dir = data.default_working_dir || "";
        setBaseDir(dir);
        if (!state.project_dir) {
          updateState({ project_dir: dir });
        }
      })
      .catch(console.error);
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNameChange = (name: string) => {
    updateState({ name });

    // Auto-update working directory if not manually edited
    if (!dirManuallyEdited && baseDir) {
      const slug = name.trim().replace(/\s+/g, "_");
      const newDir = slug ? `${baseDir}/${slug}` : baseDir;
      updateState({ project_dir: newDir });
    }
  };

  const handleDirChange = (dir: string) => {
    setDirManuallyEdited(true);
    updateState({ project_dir: dir });
  };

  const canProceed = state.name.trim() && state.project_dir.trim();

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-mono text-zinc-400 mb-1">Team name</label>
        <input
          type="text"
          value={state.name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="my-feature-team"
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
        />
      </div>

      <div>
        <label className="block text-sm font-mono text-zinc-400 mb-1">Working directory</label>
        <input
          type="text"
          value={state.project_dir}
          onChange={(e) => handleDirChange(e.target.value)}
          placeholder="Loading default..."
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
        />
        {!dirManuallyEdited && state.name.trim() && (
          <p className="text-xs font-mono text-zinc-600 mt-1">
            Auto-generated from team name. Edit to customize.
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-mono text-zinc-400 mb-1">Execution mode</label>
        <div className="flex gap-3">
          {(["tmux", "in-process"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => updateState({ execution_mode: mode })}
              className={`px-4 py-2 text-sm font-mono rounded border transition-colors ${
                state.execution_mode === mode
                  ? "bg-zinc-700 border-zinc-500 text-zinc-100"
                  : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-600"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-mono rounded transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
