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
    throw new AiError(
      "GEMINI_API_KEY が設定されていません。Google AI Studio (https://aistudio.google.com/app/apikey) でキーを発行し、Vercel の Environment Variables に追加してください。",
      { code: "no_api_key" },
    );
  }
  _client = new GoogleGenAI({ apiKey });
  return _client;
}

export class AiError extends Error {
  code: string;
  status?: number;
  constructor(message: string, opts: { code: string; status?: number }) {
    super(message);
    this.name = "AiError";
    this.code = opts.code;
    this.status = opts.status;
  }
}

const CONSULT_SYSTEM = `あなたは花屋の多言語接客アシスタントです。
お客様の発話 (どの言語でも) を受け取り、店員が日本語で花を見繕えるように要約します。

手順:
1. 発話の言語を自動検出 (BCP-47)
2. 店員向けに丁寧に日本語要約。ニュアンス・贈る相手・関係性・場面も補足
3. 検索しやすいキーワードを抽出
4. 確認しておくと良い追加質問を 2〜3 個用意
5. お客様への確認メッセージをお客様の言語で短く

JSON のみで返答 (前後にテキストやコードフェンスを付けない):
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
  return await callJson<ConsultResult>({
    system: CONSULT_SYSTEM,
    contents: customerText,
    maxOutputTokens: 4000,
    temperature: 0.5,
  });
}

const VISUAL_SYSTEM = `あなたは花屋の多言語接客アシスタントです。
店員が撮影した店内の花の写真 (または短い動画) と、お客様の希望テキストを受け取ります。

手順:
1. 画像/動画に写っている花を観察 (種類、色、本数の目安、雰囲気)
2. お客様の希望と照らし合わせ、合致度・代案を判断
3. お客様の言語で「これは○○の花で、〜〜のイメージにぴったりです」のような案内を作る
4. 店員向けに日本語で何が写っているか・どう案内したかを補足
5. お客様に対して次の質問を投げかける

JSON のみで返答 (前後にテキストやコードフェンスを付けない):
{
  "detected_language": "BCP-47",
  "language_name_ja": "日本語名",
  "what_we_see_ja": "店員向け日本語",
  "description_for_customer": "お客様の言語",
  "match_assessment_ja": "店員向け",
  "follow_up_to_customer": "お客様の言語"
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

  return await callJson<VisualResult>({
    system: VISUAL_SYSTEM,
    contents: [{ role: "user", parts }],
    maxOutputTokens: 3000,
    temperature: 0.6,
  });
}

const INTERPRET_SYSTEM = `あなたは花屋の接客で使われる通訳アシスタントです。
入力テキストを指定された方向に翻訳します。お客様向けには丁寧で温かい言葉遣いに。

入力情報:
- source_hint: 入力テキストの言語ヒント ("ja" or "auto" or BCP-47)
- target_lang: 翻訳先の言語 (BCP-47)

JSON のみで返答 (前後にテキストやコードフェンスを付けない):
{
  "detected_language": "実際に検出した BCP-47",
  "language_name_ja": "検出言語の日本語名",
  "translation": "翻訳結果",
  "notes_ja": "店員へのヒント (任意)"
}`;

export async function interpret(
  text: string,
  sourceHint: string,
  targetLang: string,
): Promise<InterpretResult> {
  const payload = `source_hint: ${sourceHint}\ntarget_lang: ${targetLang}\n---\n${text}`;
  return await callJson<InterpretResult>({
    system: INTERPRET_SYSTEM,
    contents: payload,
    maxOutputTokens: 2000,
    temperature: 0.3,
  });
}

const INTRO_SYSTEM = `あなたは花屋の多言語案内アシスタントです。
店の Web ページから抽出したテキストを受け取り、各国の観光客向けに分かりやすく要約・翻訳します。

手順:
1. テキストから店の概要・特徴・営業時間・アクセス・支払い方法等を抽出
2. 各指定言語で 4〜6 文の温かい紹介文を作成
3. それぞれに「お気軽にお声がけください」のような呼びかけを添える
4. ja の項目には必ず日本語版も含める

JSON のみで返答 (前後にテキストやコードフェンスを付けない):
{
  "source_summary_ja": "ページから読み取った店の特徴の日本語要約",
  "intros": [
    {
      "lang": "BCP-47",
      "language_name_ja": "日本語名",
      "greeting": "短い挨拶",
      "about": "店の概要 (2〜3文)",
      "specialties": "得意なこと",
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
  return await callJson<StoreIntroResult>({
    system: INTRO_SYSTEM,
    contents: payload,
    maxOutputTokens: 8000,
    temperature: 0.6,
  });
}

interface CallArgs {
  system: string;
  contents: unknown;
  maxOutputTokens: number;
  temperature: number;
}

async function callJson<T>(args: CallArgs): Promise<T> {
  let res;
  try {
    res = await client().models.generateContent({
      model: MODEL,
      // The SDK accepts string | Content[] | Content; we pass unknown to keep this helper generic.
      contents: args.contents as Parameters<
        ReturnType<typeof client>["models"]["generateContent"]
      >[0]["contents"],
      config: {
        systemInstruction: args.system,
        responseMimeType: "application/json",
        temperature: args.temperature,
        maxOutputTokens: args.maxOutputTokens,
      },
    });
  } catch (e) {
    throw translateSdkError(e);
  }

  const finishReason =
    (res as unknown as { candidates?: { finishReason?: string }[] }).candidates?.[0]
      ?.finishReason || "";

  const text = res.text;

  if (!text || text.trim() === "") {
    if (finishReason === "SAFETY") {
      throw new AiError(
        "AI が安全上の理由で応答をブロックしました。表現を変えて再度お試しください。",
        { code: "safety" },
      );
    }
    if (finishReason === "MAX_TOKENS") {
      throw new AiError(
        "AI の応答が長すぎて途中で切れました。入力を短くして再度お試しください。",
        { code: "max_tokens" },
      );
    }
    throw new AiError(
      `AI からの応答が空でした (finishReason: ${finishReason || "unknown"})。モデル名 (${MODEL}) や API キーの権限をご確認ください。`,
      { code: "empty_response" },
    );
  }

  try {
    return parseJsonObject<T>(text);
  } catch {
    if (finishReason === "MAX_TOKENS") {
      throw new AiError(
        "AI の応答が長すぎて JSON が途中で切れました。入力を短くするか、対応言語を減らしてみてください。",
        { code: "max_tokens" },
      );
    }
    throw new AiError(
      "AI の応答を解析できませんでした。もう一度お試しください。",
      { code: "parse_failed" },
    );
  }
}

function translateSdkError(e: unknown): AiError {
  if (e instanceof AiError) return e;
  const msg = e instanceof Error ? e.message : String(e);
  const status = extractStatus(msg);

  if (status === 401 || status === 403 || /API key|permission/i.test(msg)) {
    return new AiError(
      "Gemini API キーが無効、または権限がありません。Google AI Studio で新しいキーを発行して再設定してください。",
      { code: "auth", status },
    );
  }
  if (status === 404 || /not found|does not exist/i.test(msg)) {
    return new AiError(
      `モデル「${MODEL}」が見つかりません。環境変数 GEMINI_MODEL を確認してください (例: gemini-2.5-flash, gemini-2.5-pro)。`,
      { code: "model_not_found", status },
    );
  }
  if (status === 429 || /quota|rate/i.test(msg)) {
    return new AiError(
      "Gemini API の利用上限に達しました。少し時間を置いて再度お試しください。",
      { code: "rate_limit", status },
    );
  }
  if (status === 400 || /invalid|bad request/i.test(msg)) {
    return new AiError(
      `リクエストが Gemini に拒否されました: ${msg.slice(0, 200)}`,
      { code: "bad_request", status },
    );
  }
  return new AiError(`AI サービスでエラーが発生しました: ${msg.slice(0, 200)}`, {
    code: "sdk_error",
    status,
  });
}

function extractStatus(msg: string): number | undefined {
  const m = msg.match(/\b(4\d{2}|5\d{2})\b/);
  return m ? Number(m[1]) : undefined;
}

function parseJsonObject<T>(text: string): T {
  let cleaned = text.trim();

  // Strip Markdown code fences: ```json ... ``` or ``` ... ```
  const fence = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (fence) cleaned = fence[1].trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("not a JSON object");
  }
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}
