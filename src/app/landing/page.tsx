"use client";

import { useState, useEffect } from "react";

/* ------------------------------------------------------------------ */
/*  Animated radar sweep (CSS-only, matches logo aesthetic)            */
/* ------------------------------------------------------------------ */
function RadarGraphic() {
  return (
    <div className="relative w-64 h-64 md:w-80 md:h-80 mx-auto">
      {/* Outer ring */}
      <div className="absolute inset-0 rounded-full border-2 border-green-500/30" />
      {/* Middle ring */}
      <div className="absolute inset-6 rounded-full border border-green-500/20" />
      {/* Inner ring */}
      <div className="absolute inset-12 rounded-full border border-green-500/15" />
      {/* Crosshair vertical */}
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-green-500/15" />
      {/* Crosshair horizontal */}
      <div className="absolute top-1/2 left-0 right-0 h-px bg-green-500/15" />
      {/* Sweep line */}
      <div
        className="absolute left-1/2 top-1/2 w-1/2 h-px origin-left bg-gradient-to-r from-green-400/80 to-transparent"
        style={{ animation: "radar-sweep 3s linear infinite" }}
      />
      {/* Center dot */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-green-400 shadow-[0_0_12px_rgba(74,222,128,0.6)]" />
      {/* Blips */}
      <Blip top="25%" left="62%" delay={0.5} />
      <Blip top="40%" left="28%" delay={1.8} />
      <Blip top="68%" left="72%" delay={2.9} />
      <Blip top="55%" left="45%" delay={0.2} />
      <Blip top="30%" left="75%" delay={1.2} />
    </div>
  );
}

function Blip({
  top,
  left,
  delay,
}: {
  top: string;
  left: string;
  delay: number;
}) {
  return (
    <div
      className="absolute w-2 h-2 rounded-full bg-green-400"
      style={{
        top,
        left,
        animation: `blip-pulse 3s ease-in-out ${delay}s infinite`,
        boxShadow: "0 0 8px rgba(74,222,128,0.5)",
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Feature card                                                       */
/* ------------------------------------------------------------------ */
function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="group relative bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 hover:border-green-500/40 transition-all duration-300 hover:shadow-[0_0_30px_rgba(34,197,94,0.05)]">
      <div className="text-3xl mb-4 font-mono text-green-400">{icon}</div>
      <h3 className="text-lg font-bold font-mono text-zinc-100 mb-2">
        {title}
      </h3>
      <p className="text-sm text-zinc-400 leading-relaxed">{description}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat counter with animation                                        */
/* ------------------------------------------------------------------ */
function StatNumber({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl md:text-4xl font-bold font-mono text-green-400">
        {value}
      </div>
      <div className="text-xs text-zinc-500 mt-1 font-mono uppercase tracking-wider">
        {label}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Terminal demo mockup                                               */
/* ------------------------------------------------------------------ */
function TerminalDemo() {
  const [visibleLines, setVisibleLines] = useState(0);
  const lines = [
    { prefix: "$", text: "git clone https://github.com/twamp22/BumbaClaude.git", color: "text-zinc-300" },
    { prefix: "$", text: "cd BumbaClaude && pnpm install", color: "text-zinc-300" },
    { prefix: "$", text: "pnpm dev", color: "text-zinc-300" },
    { prefix: ">", text: "Ready on http://localhost:3000", color: "text-green-400" },
    { prefix: " ", text: "", color: "" },
    { prefix: "#", text: "Launch a team with 3 agents in seconds", color: "text-zinc-500" },
    { prefix: "#", text: "Monitor live terminal output from every agent", color: "text-zinc-500" },
    { prefix: "#", text: "Full audit trail. Zero modifications to Claude Code.", color: "text-zinc-500" },
  ];

  useEffect(() => {
    if (visibleLines < lines.length) {
      const timer = setTimeout(
        () => setVisibleLines((prev) => prev + 1),
        visibleLines === 0 ? 600 : 400
      );
      return () => clearTimeout(timer);
    }
  }, [visibleLines, lines.length]);

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl max-w-2xl mx-auto">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900/80 border-b border-zinc-800">
        <div className="w-3 h-3 rounded-full bg-red-500/80" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
        <div className="w-3 h-3 rounded-full bg-green-500/80" />
        <span className="ml-3 text-xs font-mono text-zinc-500">
          terminal -- bumba-claude
        </span>
      </div>
      {/* Content */}
      <div className="p-5 font-mono text-sm space-y-1 min-h-[220px]">
        {lines.slice(0, visibleLines).map((line, index) => (
          <div key={index} className={`${line.color} flex`}>
            {line.prefix && (
              <span className="text-green-500 mr-2 select-none">
                {line.prefix}
              </span>
            )}
            <span>{line.text}</span>
          </div>
        ))}
        {visibleLines < lines.length && (
          <span className="inline-block w-2 h-4 bg-green-400 animate-pulse" />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Architecture diagram                                               */
/* ------------------------------------------------------------------ */
function ArchitectureDiagram() {
  return (
    <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 font-mono text-sm">
      <div className="bg-zinc-900 border border-green-500/30 rounded-lg px-6 py-4 text-center shadow-[0_0_20px_rgba(34,197,94,0.08)]">
        <div className="text-green-400 font-bold">BumbaClaude</div>
        <div className="text-zinc-500 text-xs mt-1">Dashboard</div>
      </div>

      <div className="flex flex-col items-center gap-1 text-zinc-600">
        <div className="flex items-center gap-2">
          <span className="hidden md:inline">---</span>
          <span className="text-xs">tmux</span>
          <span className="hidden md:inline">---&gt;</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden md:inline">&lt;---</span>
          <span className="text-xs">filesystem</span>
          <span className="hidden md:inline">---</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden md:inline">---</span>
          <span className="text-xs">Agent SDK</span>
          <span className="hidden md:inline">---&gt;</span>
        </div>
        <div className="md:hidden text-lg">&#8597;</div>
      </div>

      <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-6 py-4 text-center">
        <div className="text-zinc-300 font-bold">Claude Code</div>
        <div className="text-zinc-500 text-xs mt-1">Agents</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main landing page                                                  */
/* ------------------------------------------------------------------ */
export default function LandingPage() {
  return (
    <div className="relative overflow-hidden">
      {/* Inline keyframe styles */}
      <style jsx>{`
        @keyframes radar-sweep {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes blip-pulse {
          0%,
          100% {
            opacity: 0.2;
            transform: scale(0.8);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
          }
        }
      `}</style>

      {/* Background grid effect */}
      <div
        className="fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,197,94,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.3) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 md:px-12 py-5 border-b border-zinc-800/50">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="BumbaClaude" className="w-28 h-28 object-contain" />
          <span className="font-mono font-bold text-lg">BumbaClaude</span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/twamp22/BumbaClaude"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-mono text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            GitHub
          </a>
          <a
            href="/"
            className="bg-green-600 hover:bg-green-500 text-white text-sm font-mono px-4 py-2 rounded-lg transition-colors"
          >
            Open Dashboard
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 px-6 md:px-12 pt-20 pb-16 md:pt-32 md:pb-24">
        <div className="max-w-5xl mx-auto text-center">
          <div className="mb-8">
            <div className="relative">
              <RadarGraphic />
              {/* Logo overlay on radar */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <img
                  src="/logo.png"
                  alt="BumbaClaude"
                  className="w-40 h-40 md:w-52 md:h-52 object-contain drop-shadow-[0_0_30px_rgba(34,197,94,0.3)] translate-y-3"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="inline-block px-3 py-1 rounded-full border border-green-500/20 bg-green-500/5">
              <span className="text-xs font-mono text-green-400">
                v0.1.0 -- Open Source (MIT)
              </span>
            </div>
            <div className="inline-block px-3 py-1 rounded-full border border-green-500/20 bg-green-500/5">
              <span className="text-xs font-mono text-green-400">
                First-party compatible
              </span>
            </div>
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold font-mono tracking-tight mb-6">
            <span className="text-zinc-100">Mission Control</span>
            <br />
            <span className="bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
              for Claude Code
            </span>
          </h1>

          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Define agent teams. Launch them. Watch them work. Intervene when they
            go sideways. Full audit trail of everything.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
            <a
              href="/teams/new"
              className="bg-green-600 hover:bg-green-500 text-white font-mono font-bold px-8 py-3.5 rounded-lg text-lg transition-colors shadow-[0_0_30px_rgba(34,197,94,0.2)] hover:shadow-[0_0_40px_rgba(34,197,94,0.3)]"
            >
              Create Your First Team
            </a>
            <a
              href="/"
              className="border border-zinc-700 hover:border-zinc-500 text-zinc-300 font-mono px-8 py-3.5 rounded-lg text-lg transition-colors"
            >
              Open Dashboard
            </a>
          </div>

          <p className="text-xs font-mono text-zinc-600">
            Zero modifications to Claude Code. Works with Claude Max or API
            keys.
          </p>
        </div>
      </section>

      {/* Stats bar */}
      <section className="relative z-10 border-y border-zinc-800/50 bg-zinc-900/30 py-10">
        <div className="max-w-4xl mx-auto flex justify-around">
          <StatNumber value="3" label="Interfaces" />
          <StatNumber value="0" label="Claude Code mods" />
          <StatNumber value="100%" label="Open source" />
          <StatNumber value="MIT" label="License" />
        </div>
      </section>

      {/* Demo screenshot placeholder */}
      <section className="relative z-10 px-6 md:px-12 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="relative rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900 border-b border-zinc-800">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
              <span className="ml-3 text-xs font-mono text-zinc-500">
                BumbaClaude -- Dashboard
              </span>
            </div>
            <div className="p-8 md:p-12 text-center">
              <div className="text-zinc-600 font-mono text-sm mb-4">
                [ Dashboard screenshot / GIF goes here ]
              </div>
              <div className="text-zinc-700 text-xs font-mono">
                Replace this with a screenshot of the live dashboard showing
                agents running
              </div>
              {/* Once you have a screenshot, replace the placeholder above with: */}
              {/* <img src="/dashboard-hero.png" alt="BumbaClaude Dashboard" className="w-full rounded" /> */}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 px-6 md:px-12 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold font-mono mb-4">
              Everything you need to orchestrate
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto">
              Manage multi-agent Claude Code workflows from a single dashboard.
              No terminal juggling required.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <FeatureCard
              icon="[+]"
              title="Define Teams"
              description="Create agent team configurations with custom roles, model tiers, and governance rules. Frontend team, backend team, QA team -- each with their own boundaries."
            />
            <FeatureCard
              icon=">>>"
              title="Launch Workflows"
              description="Spin up multi-agent sessions from the dashboard. Each agent runs in its own tmux session, fully isolated and independently controllable."
            />
            <FeatureCard
              icon="|||"
              title="Monitor Live"
              description="Watch each agent's terminal output in real time. See task progress across all agents at a glance. Send messages when they need course correction."
            />
            <FeatureCard
              icon="{!}"
              title="Enforce Governance"
              description="Set permission boundaries before agents spawn. Control file creation, shell access, git pushes, and turn limits. Agents stay in their lane."
            />
            <FeatureCard
              icon="[=]"
              title="Audit Everything"
              description="Full event log of agent activity with timestamps, filterable by agent and event type. Know exactly what happened, when, and why."
            />
            <FeatureCard
              icon="<->"
              title="Save Templates"
              description="Package team configurations as reusable workflow templates. Export and share as JSON. Build a library of proven multi-agent patterns."
            />
          </div>
        </div>
      </section>

      {/* The BumbaClaude Way */}
      <section className="relative z-10 px-6 md:px-12 py-20 bg-zinc-900/20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold font-mono mb-4">
              The BumbaClaude Way
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto">
              Built on principles that keep your workflow on solid ground.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="group relative bg-zinc-900/60 border border-green-500/20 rounded-xl p-6 hover:border-green-500/40 transition-all duration-300 hover:shadow-[0_0_30px_rgba(34,197,94,0.05)]">
              <div className="text-3xl mb-4 font-mono text-green-400">[ok]</div>
              <h3 className="text-lg font-bold font-mono text-zinc-100 mb-2">
                First-Party Compatible
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Uses the official CLI, reads official filesystem state, supports the official Agent SDK. No special access required.
              </p>
            </div>
            <div className="group relative bg-zinc-900/60 border border-green-500/20 rounded-xl p-6 hover:border-green-500/40 transition-all duration-300 hover:shadow-[0_0_30px_rgba(34,197,94,0.05)]">
              <div className="text-3xl mb-4 font-mono text-green-400">[--]</div>
              <h3 className="text-lg font-bold font-mono text-zinc-100 mb-2">
                No Tricks, No Hacks
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                No spoofed tokens, no header manipulation, no OAuth hijacking. Just clean orchestration through official interfaces.
              </p>
            </div>
            <div className="group relative bg-zinc-900/60 border border-green-500/20 rounded-xl p-6 hover:border-green-500/40 transition-all duration-300 hover:shadow-[0_0_30px_rgba(34,197,94,0.05)]">
              <div className="text-3xl mb-4 font-mono text-green-400">[$$]</div>
              <h3 className="text-lg font-bold font-mono text-zinc-100 mb-2">
                Your Access, Your Choice
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Works with subscriptions. Works with API keys. Your billing, your decision. BumbaClaude orchestrates whatever you've got.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 px-6 md:px-12 py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold font-mono mb-4">
              A wrapper, not a fork
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto">
              BumbaClaude sits completely outside Claude Code. No source
              modifications. No binary patches. Three clean interfaces.
            </p>
          </div>

          <ArchitectureDiagram />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <div className="text-center">
              <div className="text-green-400 font-mono font-bold mb-2">
                tmux
              </div>
              <p className="text-sm text-zinc-500">
                Spawns, monitors, and controls Claude Code processes in isolated
                terminal sessions
              </p>
            </div>
            <div className="text-center">
              <div className="text-green-400 font-mono font-bold mb-2">
                Filesystem
              </div>
              <p className="text-sm text-zinc-500">
                Reads JSON mailbox and task files that Claude Code writes to
                ~/.claude/
              </p>
            </div>
            <div className="text-center">
              <div className="text-green-400 font-mono font-bold mb-2">
                Agent SDK
              </div>
              <p className="text-sm text-zinc-500">
                Optional programmatic control via the official Claude Agent SDK
                (v0.2+)
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Quick start */}
      <section id="quick-start" className="relative z-10 px-6 md:px-12 py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold font-mono mb-4">
              Up and running in 30 seconds
            </h2>
          </div>

          <TerminalDemo />

          <div className="mt-10 text-center">
            <h3 className="font-mono font-bold text-zinc-300 mb-4">
              Prerequisites
            </h3>
            <div className="flex flex-wrap justify-center gap-3">
              {[
                "Node.js 18+",
                "pnpm",
                "tmux",
                "Claude Code CLI",
                "Claude Max / API key",
              ].map((req) => (
                <span
                  key={req}
                  className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-400"
                >
                  {req}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section className="relative z-10 px-6 md:px-12 py-20 bg-zinc-900/20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold font-mono mb-12 text-center">
            Roadmap
          </h2>

          <div className="space-y-6">
            {[
              {
                version: "v0.1",
                label: "current",
                title: "Foundation",
                items:
                  "Dashboard, team wizard, live monitor, task list, audit log, templates",
              },
              {
                version: "v0.2",
                label: "",
                title: "Integration",
                items:
                  "Agent SDK integration, granular permissions, token tracking, template sharing",
              },
              {
                version: "v0.3",
                label: "",
                title: "Visualization",
                items:
                  "Kanban board, context visualization, workflow replay, webhook notifications",
              },
              {
                version: "v0.4",
                label: "",
                title: "Ecosystem",
                items:
                  "Plugin system, public template registry, GitHub Actions integration",
              },
            ].map((milestone, index) => (
              <div
                key={milestone.version}
                className={`flex gap-4 items-start ${index === 0 ? "" : "opacity-60"}`}
              >
                <div className="flex flex-col items-center">
                  <div
                    className={`w-4 h-4 rounded-full border-2 ${index === 0 ? "border-green-400 bg-green-400/20" : "border-zinc-700"}`}
                  />
                  {index < 3 && (
                    <div className="w-px h-12 bg-zinc-800 mt-1" />
                  )}
                </div>
                <div className="pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-zinc-100">
                      {milestone.version}
                    </span>
                    <span className="font-mono text-zinc-400">
                      {milestone.title}
                    </span>
                    {milestone.label && (
                      <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                        {milestone.label}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-500 mt-1">
                    {milestone.items}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 md:px-12 py-24">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold font-mono mb-6">
            Orchestrate freely.
            <br />
            <span className="bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
              Orchestrate right.
            </span>
          </h2>
          <p className="text-zinc-400 mb-10 text-lg">
            First-party compatible. Open source. Built for developers who do
            things the right way.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/teams/new"
              className="bg-green-600 hover:bg-green-500 text-white font-mono font-bold px-8 py-3.5 rounded-lg text-lg transition-colors shadow-[0_0_30px_rgba(34,197,94,0.2)] hover:shadow-[0_0_40px_rgba(34,197,94,0.3)]"
            >
              Create a Team
            </a>
            <a
              href="/"
              className="border border-zinc-700 hover:border-zinc-500 text-zinc-300 font-mono px-8 py-3.5 rounded-lg text-lg transition-colors"
            >
              Go to Dashboard
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-zinc-800/50 px-6 md:px-12 py-8">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="BumbaClaude" className="w-20 h-20 object-contain" />
            <span className="font-mono text-sm text-zinc-500">
              BumbaClaude
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm font-mono text-zinc-600">
            <a
              href="https://github.com/twamp22/BumbaClaude"
              className="hover:text-zinc-400 transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://github.com/twamp22/BumbaClaude/blob/main/LICENSE"
              className="hover:text-zinc-400 transition-colors"
            >
              MIT License
            </a>
            <span>
              Built by{" "}
              <a
                href="https://github.com/twamp22"
                className="text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                @twamp22
              </a>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
