"use client";

import { useEffect, useState } from "react";
import type { WizardState, WizardAgent } from "@/app/teams/new/page";
import type { Template, TemplateConfig } from "@/lib/types";

interface RolesStepProps {
  state: WizardState;
  updateState: (partial: Partial<WizardState>) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function RolesStep({ state, updateState, onBack, onNext }: RolesStepProps) {
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    fetch("/api/templates")
      .then((res) => res.json())
      .then(setTemplates)
      .catch(console.error);
  }, []);

  const updateAgent = (index: number, partial: Partial<WizardAgent>) => {
    const agents = [...state.agents];
    agents[index] = { ...agents[index], ...partial };
    updateState({ agents });
  };

  const addAgent = () => {
    if (state.agents.length >= 6) return;
    updateState({
      agents: [...state.agents, { name: "", role: "", model_tier: "sonnet", system_prompt: "" }],
    });
  };

  const removeAgent = (index: number) => {
    if (state.agents.length <= 1) return;
    updateState({ agents: state.agents.filter((_, i) => i !== index) });
  };

  const loadTemplate = (template: Template) => {
    const config: TemplateConfig = JSON.parse(template.config);
    const agents: WizardAgent[] = config.agents.map((a) => ({
      name: a.name,
      role: a.role,
      model_tier: a.model_tier,
      system_prompt: "",
    }));
    updateState({ agents });
  };

  const canProceed = state.agents.every((a) => a.name.trim() && a.role.trim());

  return (
    <div className="space-y-6">
      {templates.length > 0 && (
        <div>
          <label className="block text-sm font-mono text-zinc-400 mb-1">Load from template</label>
          <div className="flex gap-2 flex-wrap">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => loadTemplate(tpl)}
                className="px-3 py-1.5 text-xs font-mono bg-zinc-800 border border-zinc-700 rounded hover:border-zinc-500 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                {tpl.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {state.agents.map((agent, index) => (
          <div key={index} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-zinc-500">Agent {index + 1}</span>
              {state.agents.length > 1 && (
                <button
                  onClick={() => removeAgent(index)}
                  className="text-xs font-mono text-red-500 hover:text-red-400"
                >
                  Remove
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono text-zinc-500 mb-1">Name</label>
                <input
                  type="text"
                  value={agent.name}
                  onChange={(e) => updateAgent(index, { name: e.target.value })}
                  placeholder="Reviewer"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-zinc-500 mb-1">Model</label>
                <select
                  value={agent.model_tier}
                  onChange={(e) =>
                    updateAgent(index, { model_tier: e.target.value as WizardAgent["model_tier"] })
                  }
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm font-mono text-zinc-100 focus:outline-none focus:border-zinc-500"
                >
                  <option value="haiku">Haiku</option>
                  <option value="sonnet">Sonnet</option>
                  <option value="opus">Opus</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-mono text-zinc-500 mb-1">Role</label>
              <textarea
                value={agent.role}
                onChange={(e) => updateAgent(index, { role: e.target.value })}
                placeholder="Describe what this agent does..."
                rows={2}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-zinc-500 mb-1">
                System prompt (optional)
              </label>
              <textarea
                value={agent.system_prompt}
                onChange={(e) => updateAgent(index, { system_prompt: e.target.value })}
                placeholder="Custom system prompt..."
                rows={2}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 resize-none"
              />
            </div>
          </div>
        ))}
      </div>

      {state.agents.length < 6 && (
        <button
          onClick={addAgent}
          className="w-full py-2 text-sm font-mono text-zinc-500 border border-dashed border-zinc-700 rounded hover:border-zinc-500 hover:text-zinc-300 transition-colors"
        >
          + Add Agent
        </button>
      )}

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm font-mono text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Back
        </button>
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
