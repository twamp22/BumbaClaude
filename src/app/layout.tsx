import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import SidebarTeamList from "@/components/shared/SidebarTeamList";

export const metadata: Metadata = {
  title: "BumbaClaude - Mission Control",
  description: "Mission control for Claude Code multi-agent workflows",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-zinc-100 min-h-screen antialiased">
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="w-56 bg-zinc-900 border-r border-zinc-800 flex flex-col flex-shrink-0">
            <div className="p-4 border-b border-zinc-800">
              <Link href="/" className="font-mono font-bold text-lg text-zinc-100 hover:text-white">
                BumbaClaude
              </Link>
              <div className="text-xs text-zinc-600 font-mono mt-0.5">Mission Control</div>
            </div>

            <div className="p-3">
              <Link
                href="/teams/new"
                className="block w-full bg-green-600 hover:bg-green-500 text-white text-center text-sm font-mono py-2 rounded transition-colors"
              >
                + New Team
              </Link>
            </div>

            <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
              <Link
                href="/"
                className="block px-3 py-2 text-sm font-mono text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/templates"
                className="block px-3 py-2 text-sm font-mono text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors"
              >
                Templates
              </Link>

              <SidebarTeamList />
            </nav>

            <div className="p-3 border-t border-zinc-800 text-xs font-mono text-zinc-600">
              v0.1.0
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
