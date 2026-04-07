"use client";

import type { WizardState, WizardGovernance } from "@/app/(dashboard)/teams/new/page";

interface GovernanceStepProps {
  state: WizardState;
  updateState: (partial: Partial<WizardState>) => void;
  onBack: () => void;
  onNext: () => void;
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-zinc-800">
      <span className="text-sm font-mono text-zinc-300">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`w-10 h-5 rounded-full transition-colors relative ${
          checked ? "bg-green-600" : "bg-zinc-700"
        }`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            checked ? "left-5" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

export default function GovernanceStep({ state, updateState, onBack, onNext }: GovernanceStepProps) {
  const updateGovernance = (partial: Partial<WizardGovernance>) => {
    updateState({ governance: { ...state.governance, ...partial } });
  };

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <div className="pb-3 mb-3 border-b border-zinc-800">
          <Toggle
            label="Isolated mode (recommended)"
            checked={state.governance.isolated}
            onChange={(val) => updateGovernance({ isolated: val })}
          />
          <p className="text-xs font-mono text-zinc-600 mt-1 ml-1">
            Blocks auto-discovered memory, CLAUDE.md, hooks. Agents only see BumbaClaude-managed context.
          </p>
        </div>
        <Toggle
          label="Agents can create new files"
          checked={state.governance.can_create_files}
          onChange={(val) => updateGovernance({ can_create_files: val })}
        />
        <Toggle
          label="Agents can run shell commands"
          checked={state.governance.can_run_commands}
          onChange={(val) => updateGovernance({ can_run_commands: val })}
        />
        <Toggle
          label="Agents can push to git"
          checked={state.governance.can_push_git}
          onChange={(val) => updateGovernance({ can_push_git: val })}
        />

        <div className="pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-mono text-zinc-300">Max turns before check-in</span>
            <span className="text-sm font-mono text-zinc-100">{state.governance.max_turns}</span>
          </div>
          <input
            type="range"
            min={5}
            max={50}
            value={state.governance.max_turns}
            onChange={(e) => updateGovernance({ max_turns: parseInt(e.target.value) })}
            className="w-full accent-green-600"
          />
          <div className="flex justify-between text-xs font-mono text-zinc-600">
            <span>5</span>
            <span>50</span>
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm font-mono text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-mono rounded transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
