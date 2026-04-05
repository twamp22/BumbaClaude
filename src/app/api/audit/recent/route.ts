import { NextResponse } from "next/server";
import { getRecentAuditEvents } from "@/lib/db";

export async function GET() {
  return NextResponse.json(getRecentAuditEvents(20));
}
