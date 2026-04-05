import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getAllTemplates, createTemplate } from "@/lib/db";

export async function GET() {
  return NextResponse.json(getAllTemplates());
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const template = createTemplate({
    id: uuidv4(),
    name: body.name,
    description: body.description || null,
    config: typeof body.config === "string" ? body.config : JSON.stringify(body.config),
  });
  return NextResponse.json(template, { status: 201 });
}
