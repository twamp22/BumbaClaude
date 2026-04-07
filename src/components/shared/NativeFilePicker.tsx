"use client";

import { useState } from "react";
import { useElectron } from "@/hooks/useElectron";

interface NativeFilePickerProps {
  value: string;
  onChange: (path: string) => void;
  placeholder?: string;
  className?: string;
}

export default function NativeFilePicker({
  value,
  onChange,
  placeholder = "/path/to/project",
  className = "",
}: NativeFilePickerProps) {
  const { isElectron, selectDirectory } = useElectron();
  const [isSelecting, setIsSelecting] = useState(false);

  const handleBrowse = async () => {
    setIsSelecting(true);
    try {
      const selected = await selectDirectory();
      if (selected) {
        onChange(selected);
      }
    } finally {
      setIsSelecting(false);
    }
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm font-mono text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
      />
      {isElectron && (
        <button
          type="button"
          onClick={handleBrowse}
          disabled={isSelecting}
          className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-sm font-mono rounded transition-colors disabled:opacity-50"
        >
          {isSelecting ? "..." : "Browse"}
        </button>
      )}
    </div>
  );
}
