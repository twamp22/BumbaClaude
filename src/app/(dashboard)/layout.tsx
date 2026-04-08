import Link from "next/link";
import SidebarTeamList from "@/components/shared/SidebarTeamList";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-56 bg-zinc-900 border-r border-zinc-800 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-zinc-800">
          <a href="/landing" className="block hover:opacity-80 transition-opacity">
            <div className="font-mono font-bold text-lg text-zinc-100">BumbaClaude</div>
            <div className="text-xs text-zinc-600 font-mono mt-0.5">Agent Orchestration</div>
          </a>
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
          <a href="https://github.com/twamp22/BumbaClaude" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 transition-colors">v0.1.1</a>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
