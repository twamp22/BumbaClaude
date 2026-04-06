import { NextResponse } from "next/server";
import os from "os";

export async function GET() {
  return NextResponse.json({
    default_working_dir: os.homedir(),
  });
}
