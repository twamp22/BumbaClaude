import { NextResponse } from "next/server";
import path from "path";

export async function GET() {
  return NextResponse.json({
    default_working_dir: path.join(process.cwd(), "team_data"),
  });
}
