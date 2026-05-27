export interface ConsultResult {
  detected_language: string;
  language_name_ja: string;
  customer_text_original: string;
  summary_ja: string;
  keywords: {
    color?: string[];
    purpose?: string;
    recipient?: string;
    budget?: string;
    flower_language?: string[];
    occasion?: string;
    style?: string;
    delivery?: string;
  };
  follow_up_questions_ja?: string[];
  reply_to_customer: string;
}

export interface VisualResult {
  detected_language: string;
  language_name_ja: string;
  what_we_see_ja: string;
  description_for_customer: string;
  match_assessment_ja: string;
  follow_up_to_customer: string;
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
