import fs from "fs";
import path from "path";
import os from "os";
import type { LimitInfo } from "./types";
import { getLatestRateLimitEvent, getRateLimitHits } from "./stream-tracker";

let cachedCredentials: { subscriptionType: string | null; rateLimitTier: string | null } | null = null;

export function readCredentials(): { subscriptionType: string | null; rateLimitTier: string | null } {
  if (cachedCredentials) return cachedCredentials;

  try {
    const credPath = path.join(os.homedir(), ".claude", ".credentials.json");
    const data = JSON.parse(fs.readFileSync(credPath, "utf-8"));
    const oauth = data.claudeAiOauth || {};
    cachedCredentials = {
      subscriptionType: oauth.subscriptionType || null,
      rateLimitTier: oauth.rateLimitTier || null,
    };
  } catch {
    cachedCredentials = { subscriptionType: null, rateLimitTier: null };
  }

  return cachedCredentials;
}

export function getLimitInfo(): LimitInfo {
  const creds = readCredentials();
  return {
    ...creds,
    latestRateLimitEvent: getLatestRateLimitEvent(),
    rateLimitHits: getRateLimitHits(),
  };
}

export function initLimitTracker(): void {
  readCredentials();
  console.error(`[limit-tracker] Initialized (subscription: ${cachedCredentials?.subscriptionType || "unknown"})`);
}
