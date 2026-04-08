import type { Metadata } from "next";
import "./globals.css";
import Titlebar from "@/components/shared/Titlebar";

export const metadata: Metadata = {
  title: "BumbaClaude - Agent Orchestration",
  description: "Orchestrate multi-agent Claude Code workflows from a single dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-zinc-100 h-screen antialiased flex flex-col overflow-hidden">
        <Titlebar />
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </body>
    </html>
  );
}
