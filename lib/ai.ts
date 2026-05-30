import { GoogleGenAI } from "@google/genai";
import type {
  AskQuestionResult,
  ConsultResult,
  ConsultTurn,
  InterpretResult,
  StoreIntroResult,
  VisualBriefResult,
} from "./types";
import { CONSULT_SLOTS } from "./types";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// thinkingBudget: 0 is only accepted by the 2.5-flash family. Pro requires a
// minimum budget and 2.0/1.5 have no thinking config, so we only disable it there.
const THINKING_DISABLED = /2\.5-flash/.test(MODEL);

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

## 最重要ルール: 言語
- 入力に target_lang が与えられます。これがお客様の言語です。
- お客様向けのフィールド (reply_to_customer, next_question_to_customer) は、お客様が何語で書いてきても、**必ず target_lang の言語で**書いてください。日本語で書いてはいけません (target_lang が ja の場合を除く)。
- 店員向けのフィールド (cumulative_summary_ja, next_question_to_customer_ja, staff_note_ja) は日本語で書いてください。

## 集めたい情報 (slots)
${SLOT_DESCRIPTIONS}

## あなたの仕事
これまでの会話の履歴とお客様の最新の発話を受け取り、次を行う:
1. お客様の発話の言語を参考に detected_language を埋める (ただし出力言語は上記ルールに従い target_lang を優先)
2. 会話全体から各 slot に該当する情報を抽出し、累積した keywords を更新する (過去のターンで分かったことを引き継ぐ)
3. filled_slots と missing_slots を計算する
4. 必須 slot (recipient, occasion, budget) が全部埋まり、かつお客様が「もう十分」というニュアンスを示したら is_ready=true。それ以外は false
5. is_ready が false なら、missing_slots の中で最も自然に次に聞ける項目を 1 つ選び、target_lang の質問 (next_question_to_customer) と、その日本語訳 (next_question_to_customer_ja) を作る
   - 質問は 1 つだけ。たくさん聞かない
   - 既に分かっている内容を踏まえて自然な会話の流れにする
   - 必須項目を優先するが、文脈に応じて柔軟に
6. is_ready が true なら next_question_to_customer と next_question_to_customer_ja はどちらも null
7. reply_to_customer は target_lang で「ありがとうございます。〜について教えていただけますか？」のように、共感の一言 + 次の質問を組み合わせる (is_ready=true なら締めの一言)
8. cumulative_summary_ja は店員向けに会話全体から分かったことを日本語で簡潔にまとめる
9. staff_note_ja には、店員に補足したいニュアンスや注意点 (任意)

## 出力
JSON のみ (前後にテキストやコードフェンスを付けない):
{
  "detected_language": "BCP-47",
  "language_name_ja": "日本語名",
  "cumulative_summary_ja": "店員向け要約 (日本語)",
  "keywords": {
    "recipient": "...", "occasion": "...", "budget": "...",
    "color": ["..."], "flower_language": ["..."], "style": "..."
  },
  "filled_slots": ["recipient", "occasion"],
  "missing_slots": ["budget", "color"],
  "reply_to_customer": "target_lang の言語で (日本語にしない)",
  "next_question_to_customer": "target_lang の言語で次に聞きたい質問 (is_ready=true なら null)",
  "next_question_to_customer_ja": "上記質問の日本語訳 (is_ready=true なら null)",
  "is_ready": false,
  "staff_note_ja": "店員向けメモ (日本語, 任意)"
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
  const langBlock = `target_lang: ${langHint || "en"}`;
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

const ASK_SYSTEM = `あなたは花屋の多言語接客アシスタントです。
店員が「お客様に聞きたいこと」を指定するので、これまでの会話の流れに沿った自然な質問文を作ります。

- target_lang の言語で、丁寧で温かい 1 文の質問を作る (question_customer_lang)
- その日本語訳も作る (question_ja)
- 会話履歴を踏まえ、既に分かっていることは繰り返さない

JSON のみで返答 (前後にテキストやコードフェンスを付けない):
{
  "question_customer_lang": "target_lang の質問",
  "question_ja": "その日本語訳"
}`;

const SLOT_LABELS: Record<string, string> = Object.fromEntries(
  CONSULT_SLOTS.map((s) => [s.key, s.label_ja]),
);

export async function askQuestion(opts: {
  mode: "slot" | "custom";
  slot?: string;
  customJa?: string;
  lang: string;
  history: ConsultTurn[];
}): Promise<AskQuestionResult> {
  const historyBlock =
    opts.history.length === 0
      ? "これまでの会話: (まだなし)"
      : "これまでの会話:\n" +
        opts.history
          .map((h) => `${h.role === "customer" ? "お客様" : "アシスタント"}: ${h.text}`)
          .join("\n");

  const ask =
    opts.mode === "slot"
      ? `店員が次の項目について聞きたいと指定しました: 「${SLOT_LABELS[opts.slot || ""] || opts.slot}」。この項目をお客様に尋ねる質問を作ってください。`
      : `店員がお客様に聞きたいこと(日本語): 「${opts.customJa || ""}」。これをお客様向けの自然な質問にしてください。`;

  const payload = `target_lang: ${opts.lang}\n\n${historyBlock}\n\n${ask}`;

  return await callJson<AskQuestionResult>({
    system: ASK_SYSTEM,
    contents: payload,
    maxOutputTokens: 2000,
    temperature: 0.4,
  });
}

export interface MediaPart {
  base64: string;
  mimeType: string;
}

const VISUAL_BRIEF_SYSTEM = `あなたは花屋の多言語接客アシスタントです。
お客様から「どんな花の組み合わせ・アレンジが欲しいか」をヒアリングし、後で AI が提案画像を生成するための指示書 (brief) を作ります。

## 最重要ルール: 言語
- 入力に target_lang が与えられます。これがお客様の言語です。
- reply_to_customer は、お客様が何語で書いてきても、**必ず target_lang の言語で**書いてください (target_lang が ja の場合を除き、日本語にしない)。
- brief_ja, flower_language_ja, follow_up_ja は日本語で書いてください。

これまでの会話とお客様の最新発話を踏まえ:
1. detected_language を埋める (出力言語は上記ルールに従う)
2. 色・雰囲気・用途・贈る相手・予算・込めたい花言葉などを整理し、画像生成に使える日本語の brief を作る (brief_ja)
3. 関連する花言葉を日本語でまとめる (flower_language_ja)
4. まだ確認したい点があれば、target_lang で 1 つだけ質問する (reply_to_customer に含める)。その日本語訳を follow_up_ja に入れる
5. 画像生成に十分な情報 (雰囲気と用途が分かる程度) が集まったら is_ready=true。その場合 follow_up_ja は空文字でよい

JSON のみで返答 (前後にテキストやコードフェンスを付けない):
{
  "detected_language": "BCP-47",
  "language_name_ja": "日本語名",
  "brief_ja": "画像生成用の日本語指示書",
  "flower_language_ja": "関連する花言葉 (日本語)",
  "reply_to_customer": "target_lang の言語での返答 (日本語にしない)",
  "follow_up_ja": "確認質問の日本語訳 (なければ空文字)",
  "is_ready": false
}`;

export async function visualBrief(
  history: ConsultTurn[],
  customerText: string,
  langHint?: string,
): Promise<VisualBriefResult> {
  const historyBlock =
    history.length === 0
      ? "これまでの会話: (まだなし)"
      : "これまでの会話:\n" +
        history
          .map((h) => `${h.role === "customer" ? "お客様" : "アシスタント"}: ${h.text}`)
          .join("\n");
  const langBlock = `target_lang: ${langHint || "en"}`;
  const payload = [langBlock, historyBlock, `お客様の最新の発話:\n${customerText}`]
    .filter(Boolean)
    .join("\n\n");

  return await callJson<VisualBriefResult>({
    system: VISUAL_BRIEF_SYSTEM,
    contents: payload,
    maxOutputTokens: 2000,
    temperature: 0.5,
  });
}

const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";

export interface GeneratedImage {
  base64: string;
  mimeType: string;
}

const IDENTIFY_SYSTEM = `あなたは花の identification の専門家です。
提供された写真・動画フレームに「はっきり写っている花・葉・グリーン」だけを挙げてください。

ルール:
- 主役として写っているものだけを挙げる。背景にぼやけて写っているもの、判別できないものは含めない。
- 推測で花を足さない。確実に判別できるものだけ。

JSON のみで返答 (前後にテキストやコードフェンスを付けない):
{
  "flowers": [{ "ja": "和名", "en": "English name", "color": "色(日本語)" }],
  "list_text": "店員向けの一覧 (例: 赤いバラ、白いカスミソウ、ユーカリ)"
}`;

export interface IdentifiedFlowers {
  flowers: { ja: string; en: string; color: string }[];
  list_text: string;
}

export async function identifyFlowers(media: MediaPart[]): Promise<IdentifiedFlowers> {
  const parts = [
    { text: "次の画像に実際に写っている花・葉・グリーンを挙げてください。" },
    ...media.map((m) => ({ inlineData: { mimeType: m.mimeType, data: m.base64 } })),
  ];
  return await callJson<IdentifiedFlowers>({
    system: IDENTIFY_SYSTEM,
    contents: [{ role: "user", parts }],
    maxOutputTokens: 1500,
    temperature: 0.2,
  });
}

export async function generateProposalImage(
  media: MediaPart[],
  briefText: string,
  allowedListText: string,
  removeFeedback?: string,
): Promise<GeneratedImage> {
  const prompt =
    `あなたはプロのフローリストです。下記の「使用可能な花のリスト」にある花だけを組み合わせて、` +
    `お客様の要望に合った美しい花束またはフラワーアレンジメントを 1 つ作り、その完成イメージ写真を生成してください。\n\n` +
    `# 使用可能な花のリスト (これ以外は絶対に使わない)\n${allowedListText}\n\n` +
    `# 厳守事項 (最重要)\n` +
    `- 上のリストにある花・葉・グリーンだけを使うこと。リストに無い花・植物・装飾は、たとえ見栄えが良くなるとしても絶対に追加・置換・補完しないこと。\n` +
    `- 添付写真は実物の見た目の参考です。花の種類・色・品種は写真とリストのとおりに保ち、本数や配置だけを調整すること。\n` +
    `- 迷った場合は、花の種類を増やさず、リストにある花だけで上品にまとめること。\n` +
    (removeFeedback
      ? `- 前回の生成では「${removeFeedback}」がリスト外なのに含まれていました。今回は必ず取り除くこと。\n`
      : "") +
    `\n# スタイル\n- 自然光のスタジオ撮影風、背景はシンプルで無地に近いもの。\n\n` +
    `# お客様の要望\n${briefText}`;

  const parts = [
    { text: prompt },
    ...media.map((m) => ({ inlineData: { mimeType: m.mimeType, data: m.base64 } })),
  ];

  let res;
  try {
    res = await client().models.generateContent({
      model: IMAGE_MODEL,
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: ["IMAGE", "TEXT"],
      },
    });
  } catch (e) {
    throw translateSdkError(e);
  }

  const candidate = (
    res as unknown as {
      candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
    }
  ).candidates?.[0];
  const imagePart = candidate?.content?.parts?.find((p) => p.inlineData?.data);
  if (!imagePart?.inlineData?.data) {
    throw new AiError(
      `画像を生成できませんでした。モデル「${IMAGE_MODEL}」が画像生成に対応しているか、API キーの権限をご確認ください。`,
      { code: "no_image" },
    );
  }
  return {
    base64: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType || "image/png",
  };
}

const VERIFY_SYSTEM = `あなたは品質チェック担当です。
生成された花のアレンジ画像が、許可リストの花だけで構成されているかを確認します。

ルール:
- 花の「種類」だけを見ます。色の濃淡や本数の違いは無視してください。
- 許可リストに無い花の種類が明確に含まれている場合のみ ok=false とし、その花を extra_ja に挙げます。
- 判断に迷う程度のものは ok=true とします。

JSON のみで返答 (前後にテキストやコードフェンスを付けない):
{ "ok": true, "extra_ja": "リスト外の花 (なければ空文字)" }`;

export interface VerifyResult {
  ok: boolean;
  extra_ja: string;
}

export async function verifyArrangement(
  generated: GeneratedImage,
  allowedListText: string,
): Promise<VerifyResult> {
  const parts = [
    {
      text: `許可リスト: ${allowedListText}\n\n下の画像に、許可リスト以外の花の種類が含まれていないか確認してください。`,
    },
    { inlineData: { mimeType: generated.mimeType, data: generated.base64 } },
  ];
  return await callJson<VerifyResult>({
    system: VERIFY_SYSTEM,
    contents: [{ role: "user", parts }],
    maxOutputTokens: 800,
    temperature: 0,
  });
}

const DESCRIBE_SYSTEM = `あなたは花屋の多言語接客アシスタントです。
AI が生成した「花の組み合わせ提案画像」と、お客様の要望 (target_lang 付き)、そして「店内に実在する花のリスト (allowed_list)」を受け取ります。

## 最重要ルール: 言語
- description_customer は必ず target_lang の言語で書く (target_lang が ja の場合を除き日本語にしない)。
- description_ja, flower_meanings_ja, unavailable_ja は日本語で書く。

## 手順
1. 画像に実際に写っている花・葉・グリーンだけを注意深く観察する (写っていないものを推測で挙げない)。
2. 観察した花・緑が、それぞれ allowed_list に含まれているかを照合する。
3. unavailable_ja: 画像に写っているのに allowed_list に「無い」花・葉・グリーンがあれば、その名前を日本語で具体的に列挙する。すべて allowed_list 内なら空文字。
4. description_customer: target_lang で、温かく魅力的な説明文を作る。実際に使われている花とその花言葉に触れる。
   - **重要**: allowed_list に無い花・緑が画像に含まれている場合は、説明文の中で「これらは完成イメージのための参考で、当店には現在ご用意がありません」という趣旨を、対象の花・緑の名前とともに target_lang で明確に伝えること。お客様が誤解しないようにする。
5. description_ja: description_customer の日本語訳 (在庫にない花の注意書きも必ず含める)。
6. flower_meanings_ja: 画像に含まれる花の花言葉を日本語でまとめる。

JSON のみで返答 (前後にテキストやコードフェンスを付けない):
{
  "description_customer": "target_lang の説明 (花言葉に触れる。在庫にない花があればその旨も明記)",
  "description_ja": "その日本語訳",
  "flower_meanings_ja": "使われている花の花言葉 (日本語)",
  "unavailable_ja": "画像に写っているが在庫リストに無い花・緑 (なければ空文字)"
}`;

export interface ArrangementDescription {
  description_customer: string;
  description_ja: string;
  flower_meanings_ja: string;
  unavailable_ja: string;
}

export async function describeArrangement(
  generated: GeneratedImage,
  briefText: string,
  lang: string,
  allowedListText: string,
  knownExtras?: string,
): Promise<ArrangementDescription> {
  const extrasHint = knownExtras
    ? `\n\n# 注意: 検証ステップで次の花がリスト外として検出されています。画像をよく見て確認し、含まれていれば必ず説明に明記してください: ${knownExtras}`
    : "";
  const parts = [
    {
      text:
        `target_lang: ${lang}\n` +
        `# 店内に実在する花のリスト (allowed_list)\n${allowedListText}\n\n` +
        `# お客様の要望\n${briefText}${extrasHint}\n\n` +
        `下の画像が提案するアレンジです。allowed_list と照合して説明してください。`,
    },
    { inlineData: { mimeType: generated.mimeType, data: generated.base64 } },
  ];

  return await callJson<ArrangementDescription>({
    system: DESCRIBE_SYSTEM,
    contents: [{ role: "user", parts }],
    maxOutputTokens: 2500,
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

const TRANSCRIBE_SYSTEM = `あなたは多言語の音声書き起こしエンジンです。
添付された音声に話されている言葉を、そのままの言語で正確に文字起こしします。

ルール:
- 話されている言語のまま書き起こす (翻訳しない)。
- lang_hint は話者の言語のヒントです。明らかに違う言語が話されている場合は実際の言語を優先します。
- 句読点を適切に補う。フィラー (えー、あー、um 等) は省く。
- 何も聞き取れない、または無音の場合は transcript を空文字にする。
- 聞こえた言葉だけを書く。推測で内容を足さない。

JSON のみで返答 (前後にテキストやコードフェンスを付けない):
{ "transcript": "聞き取った発話", "detected_language": "BCP-47" }`;

export interface TranscriptResult {
  transcript: string;
  detected_language: string;
}

export async function transcribeAudio(
  audioBase64: string,
  mimeType: string,
  langHint: string,
): Promise<TranscriptResult> {
  const parts = [
    {
      text: `lang_hint: ${langHint}\nこの音声を、話されている言語のまま文字起こししてください。`,
    },
    { inlineData: { mimeType, data: audioBase64 } },
  ];
  return await callJson<TranscriptResult>({
    system: TRANSCRIBE_SYSTEM,
    contents: [{ role: "user", parts }],
    maxOutputTokens: 1500,
    temperature: 0,
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
  // Escalate the output-token budget if the model truncates (MAX_TOKENS) or
  // returns unparseable JSON. Gemini 2.5 can still spend tokens before emitting
  // text, so a single fixed budget is fragile for multi-language replies.
  const base = args.maxOutputTokens;
  const budgets = Array.from(
    new Set([base, Math.min(16000, base * 3 + 2000), 16000]),
  );

  let lastError: AiError = new AiError("AI 呼び出しに失敗しました", { code: "unknown" });
  for (let i = 0; i < budgets.length; i++) {
    const isLastBudget = i === budgets.length - 1;
    try {
      const text = await generateOnce(args, budgets[i]);
      return parseJsonObject<T>(text);
    } catch (e) {
      const err =
        e instanceof AiError
          ? e
          : new AiError("AI の応答を解析できませんでした。もう一度お試しください。", {
              code: "parse_failed",
            });
      lastError = err;
      // Truncation or a parse failure (often silent truncation) → retry bigger.
      if ((err.code === "max_tokens" || err.code === "parse_failed") && !isLastBudget) {
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

// One generation with the given output budget, including network-level retries
// for transient (overloaded / rate / server) errors. Returns the raw text or
// throws an AiError (code "max_tokens" when the model truncated).
async function generateOnce(args: CallArgs, maxOutputTokens: number): Promise<string> {
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
          maxOutputTokens,
          // Gemini 2.5 spends "thinking" tokens out of maxOutputTokens before
          // emitting any text. For these structured extraction/translation
          // tasks thinking is unnecessary and was exhausting the budget,
          // truncating the JSON. 0 disables it (only valid on 2.5-flash family;
          // pro cannot disable it and 2.0 has no thinking).
          ...(THINKING_DISABLED ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
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

    if (finishReason === "MAX_TOKENS") {
      // Let callJson escalate the budget rather than failing outright.
      throw new AiError("AI の応答が長すぎて途中で切れました。", { code: "max_tokens" });
    }
    if (finishReason === "SAFETY") {
      throw new AiError(
        "AI が安全上の理由で応答をブロックしました。表現を変えて再度お試しください。",
        { code: "safety" },
      );
    }

    const text = res.text;
    if (!text || text.trim() === "") {
      throw new AiError(
        `AI からの応答が空でした (finishReason: ${finishReason || "unknown"})。モデル名 (${MODEL}) や API キーの権限をご確認ください。`,
        { code: "empty_response" },
      );
    }
    return text;
  }
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
