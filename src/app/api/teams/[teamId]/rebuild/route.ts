import { NextRequest, NextResponse } from "next/server";
import {
  getTeam,
  getAgentsByTeam,
  getGovernanceRules,
  createAuditEvent,
} from "@/lib/db";
import { buildContextFile } from "@/lib/tmux";
import { initTAS, initAgentTAS, generateBumbaSystemPrompt } from "@/lib/tas";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const team = getTeam(teamId);
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const agents = getAgentsByTeam(teamId);
  const governance = getGovernanceRules(teamId);
  const agentNames = agents.map((a) => a.name);

  // Re-initialize TAS and regenerate shared system prompt
  initTAS(teamId);
  for (const agent of agents) {
    initAgentTAS(teamId, agent.name);
  }
  // Build governance map for prompt generation
  const governanceMap: Record<string, string> = {};
  for (const rule of governance) {
    governanceMap[rule.rule_type] = rule.rule_value;
  }
  generateBumbaSystemPrompt({ teamId, agentNames, governance: governanceMap });

  // Check if isolated mode
  const isolatedRule = governance.find((r) => r.rule_type === "isolated");
  const useIsolation = isolatedRule ? isolatedRule.rule_value === "true" : true;

  // Rebuild context files for all agents
  if (useIsolation) {
    for (const agent of agents) {
      buildContextFile(teamId, agent.name, agent.role, agentNames, governanceMap);
    }
  }

  createAuditEvent({
    team_id: teamId,
    event_type: "team_rebuilt",
    event_data: JSON.stringify({
      agents_updated: agentNames,
      tas_initialized: true,
    }),
  });

  return NextResponse.json({
    ok: true,
    message: `Rebuilt context for ${agents.length} agents, TAS initialized`,
  });
}
