import { NextResponse } from "next/server";
import { AiError, visualConsult, type MediaPart } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const maxDuration = 60;

const TOTAL_MB_LIMIT = 18;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const wish = String(form.get("wish") || "");
    const lang = String(form.get("lang") || "") || undefined;
    const files = form.getAll("media");

    if (!wish) {
      return NextResponse.json({ error: "お客様の希望が入力されていません" }, { status: 400 });
    }
    if (files.length === 0) {
      return NextResponse.json({ error: "写真または動画を1つ以上添付してください" }, { status: 400 });
    }

    const media: MediaPart[] = [];
    let totalBytes = 0;
    for (const f of files) {
      if (!(f instanceof Blob)) continue;
      const buf = Buffer.from(await f.arrayBuffer());
      totalBytes += buf.byteLength;
      if (totalBytes / (1024 * 1024) > TOTAL_MB_LIMIT) {
        return NextResponse.json(
          {
            error: `合計サイズが ${TOTAL_MB_LIMIT}MB を超えました (${(totalBytes / 1024 / 1024).toFixed(1)}MB)。写真の枚数を減らすか、短い動画にしてください。`,
          },
          { status: 413 },
        );
      }
      media.push({
        base64: buf.toString("base64"),
        mimeType: (f as File).type || "application/octet-stream",
      });
    }

    const result = await visualConsult(wish, lang, media);
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
