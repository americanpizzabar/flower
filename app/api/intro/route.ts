import { NextResponse } from "next/server";
import { AiError, storeIntro } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const maxDuration = 60;

const DEFAULT_LANGS = ["ja", "en", "zh-Hans", "ko", "es", "fr", "de"];

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

async function fetchPageText(url: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
      },
      redirect: "follow",
    });
  } catch (e) {
    throw new Error(
      `URL に接続できませんでした: ${e instanceof Error ? e.message : "ネットワークエラー"}`,
    );
  }

  if (!res.ok) {
    if (res.status === 403 || res.status === 401) {
      throw new Error(
        `このサイトは外部からの読み取りをブロックしています (HTTP ${res.status})。別の URL (ホームページや食べログ等) をお試しください。`,
      );
    }
    if (res.status === 404) {
      throw new Error("URL が見つかりませんでした (HTTP 404)。URL をご確認ください。");
    }
    throw new Error(`URL の取得に失敗しました (HTTP ${res.status})`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (!/text\/html|application\/xhtml/.test(contentType) && !/text\//.test(contentType)) {
    throw new Error(
      `読み取れないコンテンツ種別です (${contentType || "不明"})。お店のホームページなど HTML ページの URL をお試しください。`,
    );
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const charset = detectCharset(contentType, buf);
  let html: string;
  try {
    html = new TextDecoder(charset, { fatal: false }).decode(buf);
  } catch {
    html = buf.toString("utf-8");
  }

  const text = stripHtml(html);

  if (text.length < 200) {
    throw new Error(
      "ページからほとんどテキストが読み取れませんでした。JavaScript で動的に描画されるサイト (Google マップ・Instagram など) の可能性があります。お店のホームページ URL をお試しください。",
    );
  }

  return text.slice(0, 12000);
}

function detectCharset(contentType: string, buf: Buffer): string {
  const fromHeader = contentType.match(/charset=([^\s;]+)/i)?.[1];
  if (fromHeader) return normalize(fromHeader);

  const head = buf.slice(0, 4096).toString("latin1");
  const fromMeta =
    head.match(/<meta[^>]+charset=["']?([^"'>\s]+)/i)?.[1] ||
    head.match(/<meta[^>]+content=["'][^"']*charset=([^"';\s]+)/i)?.[1];
  if (fromMeta) return normalize(fromMeta);
  return "utf-8";
}

function normalize(label: string): string {
  const lower = label.toLowerCase();
  if (lower === "shift_jis" || lower === "shift-jis" || lower === "sjis") return "shift_jis";
  if (lower === "euc-jp" || lower === "eucjp") return "euc-jp";
  if (lower === "iso-2022-jp") return "iso-2022-jp";
  return lower;
}

function stripHtml(html: string): string {
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
    .replace(/&#x?\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: Request) {
  try {
    const { url, langs } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL を入力してください" }, { status: 400 });
    }
    try {
      const u = new URL(url);
      if (!/^https?:$/.test(u.protocol)) {
        return NextResponse.json(
          { error: "URL は http:// または https:// で始まる必要があります" },
          { status: 400 },
        );
      }
    } catch {
      return NextResponse.json({ error: "URL の形式が正しくありません" }, { status: 400 });
    }

    const text = await fetchPageText(url);
    const targetLangs: string[] = Array.isArray(langs) && langs.length > 0 ? langs : DEFAULT_LANGS;
    const result = await storeIntro(text, url, targetLangs);
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
