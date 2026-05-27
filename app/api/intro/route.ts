import { NextResponse } from "next/server";
import { storeIntro } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const maxDuration = 60;

const DEFAULT_LANGS = ["ja", "en", "zh-Hans", "ko", "es", "fr", "de"];

async function fetchPageText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; HanakotobaBot/1.0; +https://florist.local/)",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`URL の取得に失敗しました (HTTP ${res.status})`);
  }
  const html = await res.text();
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12000);
}

export async function POST(req: Request) {
  try {
    const { url, langs } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "URL の形式が正しくありません" }, { status: 400 });
    }

    const text = await fetchPageText(url);
    if (text.length < 50) {
      return NextResponse.json(
        { error: "ページから十分なテキストが取得できませんでした" },
        { status: 422 },
      );
    }

    const targetLangs: string[] = Array.isArray(langs) && langs.length > 0 ? langs : DEFAULT_LANGS;
    const result = await storeIntro(text, url, targetLangs);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "internal error" },
      { status: 500 },
    );
  }
}
