import { NextResponse } from "next/server";
import { visualConsult, type MediaPart } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const wish = String(form.get("wish") || "");
    const lang = String(form.get("lang") || "") || undefined;
    const files = form.getAll("media");

    if (!wish) {
      return NextResponse.json({ error: "wish is required" }, { status: 400 });
    }
    if (files.length === 0) {
      return NextResponse.json({ error: "media is required" }, { status: 400 });
    }

    const media: MediaPart[] = [];
    for (const f of files) {
      if (!(f instanceof Blob)) continue;
      const buf = Buffer.from(await f.arrayBuffer());
      const sizeMb = buf.byteLength / (1024 * 1024);
      if (sizeMb > 18) {
        return NextResponse.json(
          { error: `ファイルサイズが大きすぎます (${sizeMb.toFixed(1)}MB)。18MB 以下にしてください。` },
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
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "internal error" },
      { status: 500 },
    );
  }
}
