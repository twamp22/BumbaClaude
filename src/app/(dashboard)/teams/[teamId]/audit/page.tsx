"use client";

import { useParams } from "next/navigation";
import { useTeamStatus } from "@/hooks/useTeamStatus";
import AuditTable from "@/components/shared/AuditTable";
import Link from "next/link";

export default function AuditPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { team, agents, loading } = useTeamStatus(teamId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-zinc-500 font-mono">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href={`/teams/${teamId}`}
          className="text-zinc-500 hover:text-zinc-300 font-mono text-sm transition-colors"
        >
          &larr; Back to monitor
        </Link>
      </div>
      <h1 className="text-2xl font-bold font-mono">
        Audit Log {team && <span className="text-zinc-500">- {team.name}</span>}
      </h1>
      <AuditTable
        teamId={teamId}
        agents={agents.map((a) => ({ id: a.id, name: a.name }))}
      />
    </div>
  );
}
