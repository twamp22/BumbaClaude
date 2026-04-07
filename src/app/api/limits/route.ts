import { NextResponse } from "next/server";
import { getLatestRateLimitEvent, getRateLimitHits } from "@/lib/stream-tracker";
import fs from "fs";
import path from "path";
import os from "os";

function readCredentials(): { subscriptionType: string | null; rateLimitTier: string | null } {
  try {
    const credPath = path.join(os.homedir(), ".claude", ".credentials.json");
    const data = JSON.parse(fs.readFileSync(credPath, "utf-8"));
    const oauth = data.claudeAiOauth || {};
    return {
      subscriptionType: oauth.subscriptionType || null,
      rateLimitTier: oauth.rateLimitTier || null,
    };
  } catch {
    return { subscriptionType: null, rateLimitTier: null };
  }
}

export async function GET() {
  const creds = readCredentials();
  const latestRateLimitEvent = getLatestRateLimitEvent();
  const rateLimitHits = getRateLimitHits();

  return NextResponse.json({
    ...creds,
    latestRateLimitEvent,
    rateLimitHits,
  });
}
