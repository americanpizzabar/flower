import { NextResponse } from "next/server";
import { interpret } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { text, source_hint, target_lang } = await req.json();
    if (!text || !target_lang) {
      return NextResponse.json(
        { error: "text and target_lang are required" },
        { status: 400 },
      );
    }
    const result = await interpret(text, source_hint || "auto", target_lang);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "internal error" },
      { status: 500 },
    );
  }
}
