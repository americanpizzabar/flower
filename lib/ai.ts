import { GoogleGenAI } from "@google/genai";
import type {
  ConsultResult,
  ConsultTurn,
  InterpretResult,
  StoreIntroResult,
  VisualResult,
} from "./types";
import { CONSULT_SLOTS } from "./types";

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

const SLOT_DESCRIPTIONS = CONSULT_SLOTS.map(
  (s) => `  - ${s.key}: ${s.label_ja}${s.required ? " (必須)" : ""}`,
).join("\n");

const CONSULT_SYSTEM = `あなたは花屋の多言語接客アシスタントです。
お客様と何度かやり取りしながら、花を見繕うために必要な情報を集めます。

## 集めたい情報 (slots)
${SLOT_DESCRIPTIONS}

## あなたの仕事
これまでの会話の履歴とお客様の最新の発話を受け取り、次を行う:
1. お客様の発話の言語を自動検出 (BCP-47)
2. 会話全体から各 slot に該当する情報を抽出し、累積した keywords を更新する (過去のターンで分かったことを引き継ぐ)
3. filled_slots と missing_slots を計算する
4. 必須 slot (recipient, occasion, budget) が全部埋まり、かつお客様が「もう十分」というニュアンスを示したら is_ready=true。それ以外は false
5. is_ready が false なら、missing_slots の中で最も自然に次に聞ける項目を 1 つ選び、お客様の言語で短い質問 (next_question_to_customer) を作る
   - 質問は 1 つだけ。たくさん聞かない
   - 既に分かっている内容を踏まえて自然な会話の流れにする
   - 必須項目を優先するが、文脈に応じて柔軟に
6. is_ready が true なら next_question_to_customer は null
7. reply_to_customer はお客様の言語で「ありがとうございます。〜について教えていただけますか？」のように、共感の一言 + 次の質問を組み合わせる (is_ready=true なら締めの一言)
8. cumulative_summary_ja は店員向けに会話全体から分かったことを日本語で簡潔にまとめる
9. staff_note_ja には、店員に補足したいニュアンスや注意点 (任意)

## 出力
JSON のみ (前後にテキストやコードフェンスを付けない):
{
  "detected_language": "BCP-47",
  "language_name_ja": "日本語名",
  "cumulative_summary_ja": "店員向け要約",
  "keywords": {
    "recipient": "...", "occasion": "...", "budget": "...",
    "color": ["..."], "flower_language": ["..."],
    "style": "...", "delivery": "...", "deadline": "..."
  },
  "filled_slots": ["recipient", "occasion"],
  "missing_slots": ["budget", "color"],
  "reply_to_customer": "お客様の言語で",
  "next_question_to_customer": "お客様の言語で次に聞きたい質問 (is_ready=true なら null)",
  "is_ready": false,
  "staff_note_ja": "店員向けメモ (任意)"
}`;

export async function consultChat(
  history: ConsultTurn[],
  customerText: string,
  langHint?: string,
): Promise<ConsultResult> {
  const historyBlock =
    history.length === 0
      ? "これまでの会話: (まだなし)"
      : "これまでの会話:\n" +
        history
          .map((h) => `${h.role === "customer" ? "お客様" : "アシスタント"}: ${h.text}`)
          .join("\n");
  const langBlock = langHint ? `お客様の言語(推定): ${langHint}` : "";
  const payload = [langBlock, historyBlock, `お客様の最新の発話:\n${customerText}`]
    .filter(Boolean)
    .join("\n\n");

  return await callJson<ConsultResult>({
    system: CONSULT_SYSTEM,
    contents: payload,
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
  const MAX_ATTEMPTS = 3;
  const backoffMs = [0, 1500, 3500];

  let lastError: AiError | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(backoffMs[attempt]);

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
      const err = translateSdkError(e);
      lastError = err;
      if (isRetryable(err.code) && attempt < MAX_ATTEMPTS - 1) {
        continue;
      }
      throw err;
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
  // Should be unreachable since the loop either returns or throws
  throw lastError ?? new AiError("AI 呼び出しに失敗しました", { code: "unknown" });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryable(code: string): boolean {
  return code === "overloaded" || code === "rate_limit" || code === "server_error";
}

function translateSdkError(e: unknown): AiError {
  if (e instanceof AiError) return e;
  const rawMsg = extractMessage(e);
  const status = extractStatus(rawMsg);
  const apiStatus = extractApiStatus(rawMsg);
  const apiMsg = extractApiMessage(rawMsg);
  const displayMsg = apiMsg || rawMsg.slice(0, 200);

  // 503 UNAVAILABLE — モデルが混雑している (Gemini で一番よく出る)
  if (
    status === 503 ||
    apiStatus === "UNAVAILABLE" ||
    /unavailable|overload|high demand|currently experiencing/i.test(rawMsg)
  ) {
    return new AiError(
      `AI モデル (${MODEL}) が現在混雑しています。少し時間を置いてもう一度お試しください。\n何度も発生する場合は、環境変数 GEMINI_MODEL を gemini-2.5-flash-lite や gemini-2.0-flash に変えると改善する可能性があります。`,
      { code: "overloaded", status: 503 },
    );
  }
  if (
    status === 429 ||
    apiStatus === "RESOURCE_EXHAUSTED" ||
    /quota|rate limit|too many requests/i.test(rawMsg)
  ) {
    return new AiError(
      "Gemini API の利用上限 (1分間のリクエスト数や1日の上限) に達しました。少し時間を置いて再度お試しください。",
      { code: "rate_limit", status: 429 },
    );
  }
  if (status === 401 || status === 403 || /API key|permission denied/i.test(rawMsg)) {
    return new AiError(
      "Gemini API キーが無効、または権限がありません。Google AI Studio で新しいキーを発行して再設定してください。",
      { code: "auth", status },
    );
  }
  if (status === 404 || apiStatus === "NOT_FOUND" || /not found|does not exist/i.test(rawMsg)) {
    return new AiError(
      `モデル「${MODEL}」が見つかりません。環境変数 GEMINI_MODEL を確認してください (例: gemini-2.5-flash, gemini-2.5-pro, gemini-2.0-flash)。`,
      { code: "model_not_found", status },
    );
  }
  if (
    status === 500 ||
    status === 502 ||
    status === 504 ||
    apiStatus === "INTERNAL" ||
    apiStatus === "DEADLINE_EXCEEDED"
  ) {
    return new AiError(
      "AI サービスが一時的に不安定です。少し時間を置いて再度お試しください。",
      { code: "server_error", status },
    );
  }
  if (status === 400 || apiStatus === "INVALID_ARGUMENT") {
    return new AiError(`リクエストが Gemini に拒否されました: ${displayMsg}`, {
      code: "bad_request",
      status,
    });
  }
  return new AiError(`AI サービスでエラーが発生しました: ${displayMsg}`, {
    code: "sdk_error",
    status,
  });
}

function extractMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

function extractStatus(msg: string): number | undefined {
  // First try a structured JSON code field, e.g. {"error":{"code":503,...}}
  const fromJsonCode = msg.match(/"code"\s*:\s*(\d{3})/);
  if (fromJsonCode) return Number(fromJsonCode[1]);
  const m = msg.match(/\b(4\d{2}|5\d{2})\b/);
  return m ? Number(m[1]) : undefined;
}

function extractApiStatus(msg: string): string | undefined {
  // {"status":"UNAVAILABLE"} or "status": "RESOURCE_EXHAUSTED"
  const m = msg.match(/"status"\s*:\s*"([A-Z_]+)"/);
  return m ? m[1] : undefined;
}

function extractApiMessage(msg: string): string | undefined {
  // Try parsing as JSON first
  try {
    const obj = JSON.parse(msg) as { error?: { message?: string } };
    if (obj?.error?.message) return obj.error.message;
  } catch {
    /* not JSON, fall through */
  }
  // Regex extract of "message":"..."
  const m = msg.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (m) return m[1].replace(/\\"/g, '"').replace(/\\n/g, "\n");
  return undefined;
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
