import { GoogleGenAI } from "@google/genai";
import type {
  ConsultResult,
  InterpretResult,
  StoreIntroResult,
  VisualResult,
} from "./types";

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

const CONSULT_SYSTEM = `あなたは花屋の多言語接客アシスタントです。
お客様の発話 (どの言語でも) を受け取り、店員が日本語で花を見繕えるように要約します。

手順:
1. 発話の言語を自動検出 (BCP-47)
2. 店員向けに丁寧に日本語要約。ニュアンス・贈る相手・関係性・場面も補足
3. 検索しやすいキーワードを抽出
4. 確認しておくと良い追加質問を 2〜3 個用意
5. お客様への確認メッセージをお客様の言語で短く

JSON のみで返答:
{
  "detected_language": "BCP-47",
  "language_name_ja": "日本語名",
  "customer_text_original": "お客様の発話のまま",
  "summary_ja": "店員向け要約",
  "keywords": {
    "color": [], "purpose": "", "recipient": "",
    "budget": "", "flower_language": [],
    "occasion": "", "style": "", "delivery": ""
  },
  "follow_up_questions_ja": ["..."],
  "reply_to_customer": "お客様の言語で"
}`;

export async function consultSummary(customerText: string): Promise<ConsultResult> {
  const res = await client().models.generateContent({
    model: MODEL,
    contents: customerText,
    config: {
      systemInstruction: CONSULT_SYSTEM,
      responseMimeType: "application/json",
      temperature: 0.5,
      maxOutputTokens: 1200,
    },
  });
  const text = res.text;
  if (!text) throw new Error("Gemini returned no text");
  return parseJsonObject<ConsultResult>(text);
}

const VISUAL_SYSTEM = `あなたは花屋の多言語接客アシスタントです。
店員が撮影した店内の花の写真 (または短い動画) と、お客様の希望テキストを受け取ります。

手順:
1. 画像/動画に写っている花を観察 (種類、色、本数の目安、雰囲気)
2. お客様の希望と照らし合わせ、合致度・代案を判断
3. お客様の言語で「これは○○の花で、〜〜のイメージにぴったりです」のような案内を作る
4. 店員向けに日本語で何が写っているか・どう案内したかを補足
5. お客様に対して次の質問を投げかける (気に入ったか、別のも見たいか等)

JSON のみで返答:
{
  "detected_language": "BCP-47",
  "language_name_ja": "日本語名",
  "what_we_see_ja": "画像/動画に写っているもの (店員向け日本語)",
  "description_for_customer": "お客様の言語での説明",
  "match_assessment_ja": "希望との合致度・代案 (店員向け)",
  "follow_up_to_customer": "お客様の言語での次の問いかけ"
}`;

export interface MediaPart {
  base64: string;
  mimeType: string;
}

export async function visualConsult(
  customerWish: string,
  customerLangHint: string | undefined,
  media: MediaPart[],
): Promise<VisualResult> {
  const userText = customerLangHint
    ? `お客様の言語: ${customerLangHint}\nお客様の希望:\n${customerWish}`
    : `お客様の希望:\n${customerWish}`;

  const parts = [
    { text: userText },
    ...media.map((m) => ({ inlineData: { mimeType: m.mimeType, data: m.base64 } })),
  ];

  const res = await client().models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction: VISUAL_SYSTEM,
      responseMimeType: "application/json",
      temperature: 0.6,
      maxOutputTokens: 1200,
    },
  });
  const text = res.text;
  if (!text) throw new Error("Gemini returned no text");
  return parseJsonObject<VisualResult>(text);
}

const INTERPRET_SYSTEM = `あなたは花屋の接客で使われる通訳アシスタントです。
入力テキストを指定された方向に翻訳します。お客様向けには丁寧で温かい言葉遣いに。

入力情報:
- source_hint: 入力テキストの言語ヒント ("ja" or "auto" or BCP-47)
- target_lang: 翻訳先の言語 (BCP-47)

JSON のみで返答:
{
  "detected_language": "実際に検出した BCP-47",
  "language_name_ja": "検出言語の日本語名",
  "translation": "翻訳結果",
  "notes_ja": "店員へのヒント (発音注意・文化的背景など、任意)"
}`;

export async function interpret(
  text: string,
  sourceHint: string,
  targetLang: string,
): Promise<InterpretResult> {
  const payload = `source_hint: ${sourceHint}\ntarget_lang: ${targetLang}\n---\n${text}`;
  const res = await client().models.generateContent({
    model: MODEL,
    contents: payload,
    config: {
      systemInstruction: INTERPRET_SYSTEM,
      responseMimeType: "application/json",
      temperature: 0.3,
      maxOutputTokens: 800,
    },
  });
  const out = res.text;
  if (!out) throw new Error("Gemini returned no text");
  return parseJsonObject<InterpretResult>(out);
}

const INTRO_SYSTEM = `あなたは花屋の多言語案内アシスタントです。
店の Web ページから抽出したテキストを受け取り、各国の観光客向けに分かりやすく要約・翻訳します。

手順:
1. テキストから店の概要・特徴・営業時間・アクセス・支払い方法等を抽出
2. 各指定言語で 4〜6 文の温かい紹介文を作成
3. それぞれに「お気軽にお声がけください」のような呼びかけを添える
4. ja の項目には必ず日本語版も含める

JSON のみで返答:
{
  "source_summary_ja": "ページから読み取った店の特徴の日本語要約",
  "intros": [
    {
      "lang": "BCP-47",
      "language_name_ja": "日本語名",
      "greeting": "短い挨拶",
      "about": "店の概要 (2〜3文)",
      "specialties": "得意なこと・人気のもの",
      "hours_access": "営業時間・アクセス・支払いなど",
      "call_to_action": "声かけ・誘導の一言"
    }
  ]
}`;

export async function storeIntro(
  pageText: string,
  storeUrl: string,
  targetLangs: string[],
): Promise<StoreIntroResult> {
  const payload =
    `店の URL: ${storeUrl}\n` +
    `対応する言語: ${targetLangs.join(", ")}\n` +
    `---\n` +
    `店の Web ページから抽出したテキスト:\n${pageText.slice(0, 12000)}`;

  const res = await client().models.generateContent({
    model: MODEL,
    contents: payload,
    config: {
      systemInstruction: INTRO_SYSTEM,
      responseMimeType: "application/json",
      temperature: 0.6,
      maxOutputTokens: 4000,
    },
  });
  const out = res.text;
  if (!out) throw new Error("Gemini returned no text");
  return parseJsonObject<StoreIntroResult>(out);
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
