import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    default_working_dir: process.cwd(),
  });
}
