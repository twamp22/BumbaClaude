"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { Template, TemplateConfig } from "@/lib/types";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchTemplates = () => {
    fetch("/api/templates")
      .then((res) => res.json())
      .then((data) => {
        setTemplates(data);
        setLoading(false);
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const deleteTemplate = async (id: string) => {
    await fetch(`/api/templates/${id}`, { method: "DELETE" });
    fetchTemplates();
  };

  const exportTemplate = (template: Template) => {
    const blob = new Blob([JSON.stringify({ ...template }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${template.name.replace(/\s+/g, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importTemplate = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const data = JSON.parse(text);
    await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        description: data.description,
        config: data.config,
      }),
    });
    fetchTemplates();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const parseConfig = (configStr: string): TemplateConfig | null => {
    try {
      return JSON.parse(configStr);
    } catch {
      return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-zinc-500 font-mono">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-mono">Templates</h1>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={importTemplate}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 text-sm font-mono bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors"
          >
            Import JSON
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => {
          const config = parseConfig(template.config);
          return (
            <div
              key={template.id}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3"
            >
              <div>
                <h3 className="font-mono font-bold text-zinc-100">{template.name}</h3>
                {template.description && (
                  <p className="text-xs font-mono text-zinc-500 mt-1">{template.description}</p>
                )}
              </div>

              {config && (
                <div className="text-xs font-mono text-zinc-400 space-y-1">
                  <div>{config.agents.length} agents</div>
                  <div className="flex flex-wrap gap-1">
                    {config.agents.map((a, i) => (
                      <span
                        key={i}
                        className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-500"
                      >
                        {a.name} ({a.model_tier})
                      </span>
                    ))}
                  </div>
                  {config.governance.max_turns && (
                    <div>Max turns: {config.governance.max_turns}</div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t border-zinc-800">
                <Link
                  href={`/teams/new?template=${template.id}`}
                  className="px-3 py-1.5 text-xs font-mono bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
                >
                  Launch
                </Link>
                <button
                  onClick={() => exportTemplate(template)}
                  className="px-3 py-1.5 text-xs font-mono bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors"
                >
                  Export
                </button>
                <button
                  onClick={() => deleteTemplate(template.id)}
                  className="px-3 py-1.5 text-xs font-mono text-red-500 hover:text-red-400 transition-colors ml-auto"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
        {templates.length === 0 && (
          <div className="col-span-full text-center py-12 text-zinc-600 font-mono">
            No templates yet. Create a team and save it as a template.
          </div>
        )}
      </div>
    </div>
  );
}
