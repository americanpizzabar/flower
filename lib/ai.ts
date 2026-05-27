import { GoogleGenAI } from "@google/genai";
import type { ChatResponse, InventoryItemWithFlower } from "./types";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

let _client: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  if (_client) return _client;
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Get one from https://aistudio.google.com/app/apikey",
    );
  }
  _client = new GoogleGenAI({ apiKey });
  return _client;
}

const SYSTEM_PROMPT = `あなたは多言語対応の花屋アシスタントです。
あなたの仕事は3つです:
1. お客様が話している言語を自動検出する (BCP-47 形式、例: ja, en, zh-Hans, zh-Hant, ko, es, fr, de)
2. お客様の意図を日本語で店員に伝える (ニュアンスや贈る相手の関係性も補足)
3. 提示された在庫の中から、お客様の希望・花言葉・誕生花・季節・国際的な慣習に最も合う花を選び、お客様の言語で短い案内文を作る

重要な制約:
- 必ず提示された在庫の中の inventory_id からのみ選ぶ (在庫にない花を勧めない)
- 文化的タブーに配慮する (例: フランス・イタリアで菊は葬儀の花、白い花は弔事を連想する文化もある)
- 1〜3 個を上限に絞り込む
- お客様への返答は丁寧で温かい言葉遣いに

出力は必ず以下の JSON 形式のみで返してください:
{
  "detected_language": "BCP-47",
  "language_name_ja": "日本語名 (例: 中国語(繁体))",
  "translated_for_staff_ja": "店員向け日本語訳と補足",
  "reply_to_customer": "お客様の言語での返答",
  "suggested_inventory_ids": [整数の配列],
  "reason_ja": "なぜこれを選んだか (店員向け、簡潔に)"
}`;

function inventorySummary(inv: InventoryItemWithFlower[]): string {
  if (inv.length === 0) return "(現在、在庫はありません)";
  return inv
    .map((i) => {
      const meaningsJa = i.flower.meanings.ja?.join("・") || "";
      const meaningsEn = i.flower.meanings.en?.join(", ") || "";
      const birth = (i.flower.birth_days || [])
        .map((b) => `${b.month}/${b.day}`)
        .join(",");
      const seasons = (i.flower.seasons || []).join(",");
      return [
        `- inventory_id=${i.id}`,
        `  花: ${i.flower.names.ja} (${i.flower.names.en})`,
        `  色: ${i.color || i.flower.default_color || "不明"}`,
        `  在庫: ${i.stock}本`,
        `  価格: ${i.price ? `¥${i.price}/本` : "未設定"}`,
        `  花言葉(ja): ${meaningsJa}`,
        `  meanings(en): ${meaningsEn}`,
        `  誕生花: ${birth || "なし"}`,
        `  旬: ${seasons || "通年"}`,
        i.flower.notes ? `  備考: ${i.flower.notes}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");
}

export async function chatWithCustomer(
  customerMessage: string,
  history: { role: "customer" | "staff"; text: string }[],
  inventory: InventoryItemWithFlower[],
): Promise<ChatResponse> {
  const inventoryBlock = `現在の在庫一覧:\n${inventorySummary(inventory)}`;
  const historyBlock =
    history.length === 0
      ? ""
      : "これまでの会話:\n" +
        history
          .map((h) => `${h.role === "customer" ? "お客様" : "店員"}: ${h.text}`)
          .join("\n");

  const userText = [
    inventoryBlock,
    historyBlock,
    `お客様の発話:\n${customerMessage}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const res = await client().models.generateContent({
    model: MODEL,
    contents: userText,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      temperature: 0.7,
      maxOutputTokens: 1024,
    },
  });

  const text = res.text;
  if (!text) throw new Error("Gemini returned no text");
  return parseJsonObject<ChatResponse>(text);
}

const SUGGEST_SYSTEM = `あなたは花屋の在庫から候補を絞り込むアシスタントです。
事前に SQL で絞り込まれた候補の中から、お客様の希望に最もよく合う順に並べ替え、日本語で短い説明を付けてください。
出力は次の JSON のみ:
{
  "ordered_inventory_ids": [整数の配列, 関連度の高い順],
  "comment_ja": "店員向けの一言コメント (なぜこの順か)"
}`;

export interface SuggestRanking {
  ordered_inventory_ids: number[];
  comment_ja: string;
}

export async function rankSuggestions(
  query: {
    birthday?: { month: number; day: number };
    keyword?: string;
    color?: string;
    budget?: number;
    preferSeasonal?: boolean;
  },
  candidates: InventoryItemWithFlower[],
): Promise<SuggestRanking> {
  if (candidates.length === 0) {
    return { ordered_inventory_ids: [], comment_ja: "在庫に該当する花がありませんでした。" };
  }
  if (candidates.length === 1) {
    return {
      ordered_inventory_ids: [candidates[0].id],
      comment_ja: "該当する花は1種類のみです。",
    };
  }

  const userText = `条件: ${JSON.stringify(query)}\n\n候補:\n${inventorySummary(candidates)}`;

  const res = await client().models.generateContent({
    model: MODEL,
    contents: userText,
    config: {
      systemInstruction: SUGGEST_SYSTEM,
      responseMimeType: "application/json",
      temperature: 0.5,
      maxOutputTokens: 512,
    },
  });

  const text = res.text;
  if (!text) {
    return {
      ordered_inventory_ids: candidates.map((c) => c.id),
      comment_ja: "AI からの応答を取得できませんでした。",
    };
  }
  try {
    return parseJsonObject<SuggestRanking>(text);
  } catch {
    return {
      ordered_inventory_ids: candidates.map((c) => c.id),
      comment_ja: text.slice(0, 200),
    };
  }
}

function parseJsonObject<T>(text: string): T {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error(`Expected JSON object, got: ${trimmed.slice(0, 200)}`);
  }
  return JSON.parse(trimmed.slice(start, end + 1)) as T;
}
