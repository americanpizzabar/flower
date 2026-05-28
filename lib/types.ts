export type SlotKey =
  | "recipient"
  | "occasion"
  | "budget"
  | "color"
  | "flower_language"
  | "style";

export const CONSULT_SLOTS: { key: SlotKey; label_ja: string; required: boolean }[] = [
  { key: "recipient", label_ja: "贈る相手", required: true },
  { key: "occasion", label_ja: "用途・場面", required: true },
  { key: "budget", label_ja: "予算", required: true },
  { key: "color", label_ja: "色・雰囲気", required: false },
  { key: "flower_language", label_ja: "込めたい意味・花言葉", required: false },
  { key: "style", label_ja: "スタイル(花束/アレンジ等)", required: false },
];

export interface ConsultTurn {
  role: "customer" | "assistant";
  text: string;
}

export interface ConsultKeywords {
  recipient?: string;
  occasion?: string;
  budget?: string;
  color?: string[];
  flower_language?: string[];
  style?: string;
}

export interface ConsultResult {
  detected_language: string;
  language_name_ja: string;
  cumulative_summary_ja: string;
  keywords: ConsultKeywords;
  filled_slots: SlotKey[];
  missing_slots: SlotKey[];
  reply_to_customer: string;
  next_question_to_customer: string | null;
  next_question_to_customer_ja: string | null;
  is_ready: boolean;
  staff_note_ja?: string;
}

export interface AskQuestionResult {
  question_customer_lang: string;
  question_ja: string;
}

export interface VisualBriefResult {
  detected_language: string;
  language_name_ja: string;
  brief_ja: string;
  flower_language_ja: string;
  reply_to_customer: string;
  follow_up_ja: string;
  is_ready: boolean;
}

export interface ProposalResult {
  image_data_url: string;
  description_customer: string;
  description_ja: string;
  flower_meanings_ja: string;
}

export interface InterpretResult {
  detected_language: string;
  language_name_ja: string;
  translation: string;
  notes_ja?: string;
}

export interface StoreIntroLang {
  lang: string;
  language_name_ja: string;
  greeting: string;
  about: string;
  specialties: string;
  hours_access: string;
  call_to_action: string;
}

export interface StoreIntroResult {
  source_summary_ja: string;
  intros: StoreIntroLang[];
}

export const SUPPORTED_LANGS: { code: string; label_ja: string; speech: string }[] = [
  { code: "ja", label_ja: "日本語", speech: "ja-JP" },
  { code: "en", label_ja: "英語", speech: "en-US" },
  { code: "zh-Hans", label_ja: "中国語(簡体)", speech: "zh-CN" },
  { code: "zh-Hant", label_ja: "中国語(繁体)", speech: "zh-TW" },
  { code: "ko", label_ja: "韓国語", speech: "ko-KR" },
  { code: "es", label_ja: "スペイン語", speech: "es-ES" },
  { code: "fr", label_ja: "フランス語", speech: "fr-FR" },
  { code: "de", label_ja: "ドイツ語", speech: "de-DE" },
  { code: "it", label_ja: "イタリア語", speech: "it-IT" },
  { code: "pt", label_ja: "ポルトガル語", speech: "pt-BR" },
  { code: "ru", label_ja: "ロシア語", speech: "ru-RU" },
  { code: "th", label_ja: "タイ語", speech: "th-TH" },
  { code: "vi", label_ja: "ベトナム語", speech: "vi-VN" },
  { code: "id", label_ja: "インドネシア語", speech: "id-ID" },
];

export function speechLangFor(bcp47: string): string {
  const found = SUPPORTED_LANGS.find((l) => l.code === bcp47);
  if (found) return found.speech;
  if (bcp47.startsWith("zh")) return "zh-CN";
  if (bcp47.includes("-")) return bcp47;
  return bcp47;
}
