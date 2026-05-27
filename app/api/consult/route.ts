import { NextResponse } from "next/server";
import { AiError, consultChat } from "@/lib/ai";
import type { ConsultTurn } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { text, history, lang } = await req.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "テキストが空です" }, { status: 400 });
    }
    const safeHistory: ConsultTurn[] = Array.isArray(history)
      ? history.filter(
          (t: unknown): t is ConsultTurn =>
            !!t &&
            typeof t === "object" &&
            (t as ConsultTurn).role !== undefined &&
            typeof (t as ConsultTurn).text === "string",
        )
      : [];
    const result = await consultChat(safeHistory, text, typeof lang === "string" ? lang : undefined);
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
