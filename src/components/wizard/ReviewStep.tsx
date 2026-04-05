"use client";

import { useState } from "react";
import type { WizardState } from "@/app/teams/new/page";

interface ReviewStepProps {
  state: WizardState;
  onBack: () => void;
  onLaunch: () => void;
  submitting: boolean;
}

export default function ReviewStep({ state, onBack, onLaunch, submitting }: ReviewStepProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSaveTemplate = async () => {
    setSaving(true);
    try {
      await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: state.name,
          description: `Template from team "${state.name}"`,
          config: {
            agents: state.agents.map((a) => ({
              name: a.name,
              role: a.role,
              model_tier: a.model_tier,
              tool_permissions: {
                can_create_files: state.governance.can_create_files,
                can_run_commands: state.governance.can_run_commands,
                can_push_git: state.governance.can_push_git,
              },
            })),
            governance: { max_turns: state.governance.max_turns },
          },
        }),
      });
      setSaved(true);
    } catch (error) {
      console.error("Failed to save template:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4">
        <div>
          <div className="text-xs font-mono text-zinc-500 mb-1">Team</div>
          <div className="font-mono text-zinc-100">{state.name}</div>
        </div>
        <div>
          <div className="text-xs font-mono text-zinc-500 mb-1">Directory</div>
          <div className="font-mono text-zinc-300 text-sm">{state.project_dir}</div>
        </div>
        <div>
          <div className="text-xs font-mono text-zinc-500 mb-1">Mode</div>
          <div className="font-mono text-zinc-300 text-sm">{state.execution_mode}</div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <div className="text-xs font-mono text-zinc-500 mb-3">
          Agents ({state.agents.length})
        </div>
        <div className="space-y-2">
          {state.agents.map((agent, i) => (
            <div key={i} className="flex items-center justify-between py-1">
              <div>
                <span className="font-mono text-zinc-100 text-sm">{agent.name}</span>
                <span className="text-xs font-mono text-zinc-500 ml-2">{agent.model_tier}</span>
              </div>
              <span className="text-xs font-mono text-zinc-500 truncate max-w-xs ml-4">
                {agent.role}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <div className="text-xs font-mono text-zinc-500 mb-3">Governance</div>
        <div className="space-y-1 text-sm font-mono">
          <div className="flex justify-between">
            <span className="text-zinc-400">Create files</span>
            <span className={state.governance.can_create_files ? "text-green-500" : "text-red-500"}>
              {state.governance.can_create_files ? "Yes" : "No"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Run commands</span>
            <span className={state.governance.can_run_commands ? "text-green-500" : "text-red-500"}>
              {state.governance.can_run_commands ? "Yes" : "No"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Push to git</span>
            <span className={state.governance.can_push_git ? "text-green-500" : "text-red-500"}>
              {state.governance.can_push_git ? "Yes" : "No"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Max turns</span>
            <span className="text-zinc-100">{state.governance.max_turns}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="px-4 py-2 text-sm font-mono text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleSaveTemplate}
            disabled={saving || saved}
            className="px-4 py-2 text-sm font-mono text-zinc-400 border border-zinc-700 rounded hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-50 transition-colors"
          >
            {saved ? "Saved" : saving ? "Saving..." : "Save as Template"}
          </button>
        </div>
        <button
          onClick={onLaunch}
          disabled={submitting}
          className="px-6 py-2 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-mono font-bold rounded transition-colors"
        >
          {submitting ? "Launching..." : "Launch Team"}
        </button>
      </div>
    </div>
  );
}
