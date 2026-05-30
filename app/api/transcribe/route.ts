import { NextResponse } from "next/server";
import { AiError, transcribeAudio } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_MB = 4;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const lang = String(form.get("lang") || "auto");
    const file = form.get("audio");

    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "音声データが見つかりません" }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.byteLength === 0) {
      return NextResponse.json({ transcript: "", detected_language: lang });
    }
    if (buf.byteLength / (1024 * 1024) > MAX_MB) {
      return NextResponse.json(
        { error: `録音が長すぎます (${MAX_MB}MB 超)。短く区切って話してください。` },
        { status: 413 },
      );
    }

    const mimeType = (file as File).type || "audio/webm";
    const result = await transcribeAudio(buf.toString("base64"), mimeType, lang);
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
