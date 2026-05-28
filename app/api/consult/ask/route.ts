import { NextResponse } from "next/server";
import { AiError, askQuestion } from "@/lib/ai";
import type { ConsultTurn } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { mode, slot, custom_ja, lang, history } = await req.json();
    if (mode !== "slot" && mode !== "custom") {
      return NextResponse.json({ error: "mode が不正です" }, { status: 400 });
    }
    if (!lang || typeof lang !== "string") {
      return NextResponse.json({ error: "言語が指定されていません" }, { status: 400 });
    }
    if (mode === "slot" && !slot) {
      return NextResponse.json({ error: "項目が指定されていません" }, { status: 400 });
    }
    if (mode === "custom" && !custom_ja) {
      return NextResponse.json({ error: "質問内容が入力されていません" }, { status: 400 });
    }

    const safeHistory: ConsultTurn[] = Array.isArray(history)
      ? history.filter(
          (t: unknown): t is ConsultTurn =>
            !!t &&
            typeof t === "object" &&
            typeof (t as ConsultTurn).text === "string",
        )
      : [];

    const result = await askQuestion({
      mode,
      slot: typeof slot === "string" ? slot : undefined,
      customJa: typeof custom_ja === "string" ? custom_ja : undefined,
      lang,
      history: safeHistory,
    });
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
