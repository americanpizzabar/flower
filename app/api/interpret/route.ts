import { NextResponse } from "next/server";
import { AiError, interpret } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { text, source_hint, target_lang } = await req.json();
    if (!text || !target_lang) {
      return NextResponse.json(
        { error: "テキストと翻訳先言語の両方が必要です" },
        { status: 400 },
      );
    }
    const result = await interpret(text, source_hint || "auto", target_lang);
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
