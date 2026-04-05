"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ProjectStep from "@/components/wizard/ProjectStep";
import RolesStep from "@/components/wizard/RolesStep";
import GovernanceStep from "@/components/wizard/GovernanceStep";
import ReviewStep from "@/components/wizard/ReviewStep";

export interface WizardAgent {
  name: string;
  role: string;
  model_tier: "haiku" | "sonnet" | "opus";
  system_prompt: string;
}

export interface WizardGovernance {
  can_create_files: boolean;
  can_run_commands: boolean;
  can_push_git: boolean;
  max_turns: number;
}

export interface WizardState {
  name: string;
  project_dir: string;
  execution_mode: "in-process" | "tmux";
  agents: WizardAgent[];
  governance: WizardGovernance;
}

const STEPS = ["Project", "Roles", "Governance", "Review"];

export default function NewTeamPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [state, setState] = useState<WizardState>({
    name: "",
    project_dir: "",
    execution_mode: "tmux",
    agents: [{ name: "", role: "", model_tier: "sonnet", system_prompt: "" }],
    governance: {
      can_create_files: true,
      can_run_commands: true,
      can_push_git: false,
      max_turns: 25,
    },
  });

  const updateState = (partial: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  };

  const handleLaunch = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      const data = await res.json();
      router.push(`/teams/${data.team.id}`);
    } catch (error) {
      console.error("Failed to launch team:", error);
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold font-mono mb-6">New Team</h1>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((name, i) => (
          <div key={name} className="flex items-center gap-2">
            <button
              onClick={() => i < step && setStep(i)}
              className={`px-3 py-1 text-xs font-mono rounded ${
                i === step
                  ? "bg-green-600 text-white"
                  : i < step
                    ? "bg-zinc-700 text-zinc-300 cursor-pointer hover:bg-zinc-600"
                    : "bg-zinc-800 text-zinc-600"
              }`}
            >
              {i + 1}. {name}
            </button>
            {i < STEPS.length - 1 && <div className="w-4 h-px bg-zinc-700" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      {step === 0 && (
        <ProjectStep state={state} updateState={updateState} onNext={() => setStep(1)} />
      )}
      {step === 1 && (
        <RolesStep
          state={state}
          updateState={updateState}
          onBack={() => setStep(0)}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <GovernanceStep
          state={state}
          updateState={updateState}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}
      {step === 3 && (
        <ReviewStep
          state={state}
          onBack={() => setStep(2)}
          onLaunch={handleLaunch}
          submitting={submitting}
        />
      )}
    </div>
  );
}
