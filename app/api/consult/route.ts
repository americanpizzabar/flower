import { NextResponse } from "next/server";
import { AiError, consultSummary } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "テキストが空です" }, { status: 400 });
    }
    const result = await consultSummary(text);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AiError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status || 500 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "通信エラーが発生しました" },
      { status: 500 },
    );
  }
}
