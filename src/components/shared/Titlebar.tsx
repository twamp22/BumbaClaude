"use client";

import { useEffect, useState } from "react";
import { useElectron } from "@/hooks/useElectron";

export default function Titlebar() {
  const {
    isElectron,
    windowMinimize,
    windowMaximize,
    windowClose,
    windowIsMaximized,
    onWindowMaximizeChange,
  } = useElectron();

  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isElectron) return;

    windowIsMaximized().then(setMaximized);

    const cleanup = onWindowMaximizeChange((isMax) => {
      setMaximized(isMax);
    });

    return cleanup;
  }, [isElectron, windowIsMaximized, onWindowMaximizeChange]);

  if (!isElectron) return null;

  return (
    <div className="flex items-center justify-between h-8 bg-zinc-950 border-b border-zinc-800 select-none shrink-0"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* Left: app title */}
      <div className="flex items-center gap-2 pl-3">
        <span className="text-xs font-mono font-bold text-zinc-400 tracking-wide">
          BumbaClaude
        </span>
      </div>

      {/* Right: window controls */}
      <div className="flex h-full" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <button
          onClick={windowMinimize}
          className="w-11 h-full flex items-center justify-center text-zinc-400 hover:bg-zinc-800 transition-colors"
          title="Minimize"
        >
          <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
            <rect width="10" height="1" />
          </svg>
        </button>
        <button
          onClick={windowMaximize}
          className="w-11 h-full flex items-center justify-center text-zinc-400 hover:bg-zinc-800 transition-colors"
          title={maximized ? "Restore" : "Maximize"}
        >
          {maximized ? (
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="2.5" y="0.5" width="8" height="8" />
              <rect x="0.5" y="2.5" width="8" height="8" fill="#09090b" />
              <rect x="0.5" y="2.5" width="8" height="8" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="0.5" y="0.5" width="9" height="9" rx="0.5" />
            </svg>
          )}
        </button>
        <button
          onClick={windowClose}
          className="w-11 h-full flex items-center justify-center text-zinc-400 hover:bg-red-600 hover:text-white transition-colors"
          title="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
            <line x1="1" y1="1" x2="9" y2="9" />
            <line x1="9" y1="1" x2="1" y2="9" />
          </svg>
        </button>
      </div>
    </div>
  );
}
