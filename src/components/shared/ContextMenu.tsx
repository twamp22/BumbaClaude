"use client";

import { useState, useEffect, useRef } from "react";

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
  separator?: boolean;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  children: React.ReactNode;
}

export default function ContextMenu({ items, children }: ContextMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Position relative to viewport, clamped to screen
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - items.length * 36 - 16);
    setPosition({ x, y });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    const handleScroll = () => setOpen(false);

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    document.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

  return (
    <div ref={containerRef} onContextMenu={handleContextMenu}>
      {children}
      {open && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[180px] bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl shadow-black/50 py-1 animate-in fade-in duration-100"
          style={{ left: position.x, top: position.y }}
        >
          {items.map((item, i) => {
            if (item.separator) {
              return <div key={i} className="border-t border-zinc-700 my-1" />;
            }
            return (
              <button
                key={i}
                onClick={() => {
                  if (!item.disabled) {
                    item.onClick();
                    setOpen(false);
                  }
                }}
                disabled={item.disabled}
                className={`w-full text-left px-3 py-1.5 text-sm font-mono transition-colors ${
                  item.disabled
                    ? "text-zinc-600 cursor-not-allowed"
                    : item.variant === "danger"
                      ? "text-red-400 hover:bg-red-500/10"
                      : "text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
