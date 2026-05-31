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
  used_flowers_ja: string;
  verified: boolean;
  unverified_note_ja: string;
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

// Short UI labels for the big mic/send buttons, shown in the customer's
// selected language alongside the Japanese label so both staff and customer
// understand the button at a glance.
export type UiKey = "speak" | "stop" | "send";

const UI_LABELS: Record<string, Record<UiKey, string>> = {
  ja: { speak: "話す", stop: "停止", send: "送信" },
  en: { speak: "Speak", stop: "Stop", send: "Send" },
  "zh-Hans": { speak: "说话", stop: "停止", send: "发送" },
  "zh-Hant": { speak: "說話", stop: "停止", send: "傳送" },
  ko: { speak: "말하기", stop: "정지", send: "보내기" },
  es: { speak: "Hablar", stop: "Parar", send: "Enviar" },
  fr: { speak: "Parler", stop: "Arrêter", send: "Envoyer" },
  de: { speak: "Sprechen", stop: "Stopp", send: "Senden" },
  it: { speak: "Parla", stop: "Ferma", send: "Invia" },
  pt: { speak: "Falar", stop: "Parar", send: "Enviar" },
  ru: { speak: "Говорить", stop: "Стоп", send: "Отправить" },
  th: { speak: "พูด", stop: "หยุด", send: "ส่ง" },
  vi: { speak: "Nói", stop: "Dừng", send: "Gửi" },
  id: { speak: "Bicara", stop: "Berhenti", send: "Kirim" },
};

export function uiLabel(lang: string, key: UiKey): string {
  const table = UI_LABELS[lang] || UI_LABELS[lang.split("-")[0]] || UI_LABELS.en;
  return table[key];
}

// Spoken + written usage guide shown to the customer when the consult screen
// opens, in their own language. Encourages them to describe what they want by
// voice (🎤) or text.
const CONSULT_GUIDE: Record<string, string> = {
  ja: "ご希望のお花についてお聞かせください。「誰に」「どんな場面で」「ご予算」などをお話しいただければ、ぴったりのお花をご提案します。下の「話す」ボタンを押して話すか、入力欄に書いて送信してください。",
  en: "Please tell us about the flowers you'd like. Share who they're for, the occasion, and your budget, and we'll suggest the perfect flowers. Tap the “Speak” button and talk, or type in the box and send.",
  "zh-Hans": "请告诉我们您想要的鲜花。说明送给谁、什么场合、预算多少，我们就会为您推荐最合适的鲜花。点击下方“说话”按钮讲话，或在输入框中输入后发送。",
  "zh-Hant": "請告訴我們您想要的鮮花。說明送給誰、什麼場合、預算多少，我們就會為您推薦最合適的鮮花。點擊下方「說話」按鈕講話，或在輸入框中輸入後傳送。",
  ko: "원하시는 꽃에 대해 알려주세요. 누구에게, 어떤 상황에, 예산은 어느 정도인지 말씀해 주시면 알맞은 꽃을 추천해 드립니다. 아래 “말하기” 버튼을 눌러 말씀하시거나 입력란에 적어 보내주세요.",
  es: "Cuéntenos qué flores desea. Indíquenos para quién son, la ocasión y su presupuesto, y le sugeriremos las flores ideales. Pulse el botón “Hablar” y hable, o escriba en el cuadro y envíe.",
  fr: "Dites-nous quelles fleurs vous souhaitez. Précisez pour qui, l'occasion et votre budget, et nous vous proposerons les fleurs idéales. Appuyez sur le bouton « Parler » et parlez, ou écrivez dans le champ et envoyez.",
  de: "Sagen Sie uns, welche Blumen Sie möchten. Nennen Sie für wen, den Anlass und Ihr Budget, und wir schlagen die passenden Blumen vor. Tippen Sie auf „Sprechen“ und sprechen Sie, oder schreiben Sie ins Feld und senden Sie.",
  it: "Ci dica quali fiori desidera. Indichi per chi sono, l'occasione e il suo budget, e le suggeriremo i fiori ideali. Tocchi il pulsante “Parla” e parli, oppure scriva nel riquadro e invii.",
  pt: "Conte-nos quais flores deseja. Diga para quem são, a ocasião e o seu orçamento, e sugeriremos as flores ideais. Toque no botão “Falar” e fale, ou escreva na caixa e envie.",
  ru: "Расскажите, какие цветы вы хотите. Укажите, для кого они, по какому случаю и ваш бюджет, и мы предложим идеальные цветы. Нажмите кнопку «Говорить» и говорите или напишите в поле и отправьте.",
  th: "โปรดบอกเราเกี่ยวกับดอกไม้ที่คุณต้องการ บอกว่าให้ใคร โอกาสใด และงบประมาณเท่าไร แล้วเราจะแนะนำดอกไม้ที่เหมาะที่สุด กดปุ่ม “พูด” แล้วพูด หรือพิมพ์ในช่องแล้วส่ง",
  vi: "Hãy cho chúng tôi biết về loài hoa bạn muốn. Cho biết tặng ai, dịp nào và ngân sách của bạn, chúng tôi sẽ gợi ý loài hoa phù hợp nhất. Nhấn nút “Nói” và nói, hoặc nhập vào ô rồi gửi.",
  id: "Ceritakan bunga yang Anda inginkan. Sebutkan untuk siapa, acaranya, dan anggaran Anda, lalu kami akan menyarankan bunga yang paling cocok. Ketuk tombol “Bicara” lalu bicara, atau ketik di kotak dan kirim.",
};

export function consultGuide(lang: string): string {
  return CONSULT_GUIDE[lang] || CONSULT_GUIDE[lang.split("-")[0]] || CONSULT_GUIDE.en;
}

// Spoken + written usage guide for the "show flowers" screen, in the customer's
// language. Explains that we'll hear their wish, then show real flowers and
// generate a proposal image.
const SHOW_GUIDE: Record<string, string> = {
  ja: "ご希望のお花のイメージをお聞かせください。雰囲気・色・贈る相手・ご予算などをお話しいただければ、店内のお花で組み合わせの提案画像をお作りします。下の「話す」ボタンを押して話すか、入力欄に書いて送信してください。",
  en: "Please tell us the flower arrangement you have in mind. Share the mood, colors, who it's for, and your budget, and we'll create a proposal image using our in-store flowers. Tap the “Speak” button and talk, or type in the box and send.",
  "zh-Hans": "请告诉我们您心目中的花艺。说明氛围、颜色、送给谁、预算多少，我们就会用店内的鲜花为您制作搭配提案图。点击下方“说话”按钮讲话，或在输入框中输入后发送。",
  "zh-Hant": "請告訴我們您心目中的花藝。說明氛圍、顏色、送給誰、預算多少，我們就會用店內的鮮花為您製作搭配提案圖。點擊下方「說話」按鈕講話，或在輸入框中輸入後傳送。",
  ko: "원하시는 꽃 이미지를 알려주세요. 분위기, 색상, 받는 사람, 예산 등을 말씀해 주시면 매장의 꽃으로 조합 제안 이미지를 만들어 드립니다. 아래 “말하기” 버튼을 눌러 말씀하시거나 입력란에 적어 보내주세요.",
  es: "Cuéntenos el arreglo floral que tiene en mente. Indique el ambiente, los colores, para quién es y su presupuesto, y crearemos una imagen de propuesta con nuestras flores. Pulse “Hablar” y hable, o escriba en el cuadro y envíe.",
  fr: "Décrivez-nous la composition florale que vous imaginez. Précisez l'ambiance, les couleurs, pour qui et votre budget, et nous créerons une image de proposition avec nos fleurs. Appuyez sur « Parler » et parlez, ou écrivez et envoyez.",
  de: "Beschreiben Sie uns das Blumengesteck, das Sie sich vorstellen. Nennen Sie Stimmung, Farben, für wen und Ihr Budget, und wir erstellen ein Vorschlagsbild mit unseren Blumen. Tippen Sie auf „Sprechen“ und sprechen Sie, oder schreiben und senden Sie.",
  it: "Ci descriva la composizione floreale che immagina. Indichi atmosfera, colori, per chi è e il budget, e creeremo un'immagine di proposta con i nostri fiori. Tocchi “Parla” e parli, oppure scriva e invii.",
  pt: "Descreva o arranjo floral que imagina. Diga o clima, as cores, para quem é e o seu orçamento, e criaremos uma imagem de proposta com as nossas flores. Toque em “Falar” e fale, ou escreva e envie.",
  ru: "Опишите цветочную композицию, которую вы представляете. Укажите настроение, цвета, для кого и ваш бюджет, и мы создадим изображение-предложение из наших цветов. Нажмите «Говорить» и говорите или напишите и отправьте.",
  th: "โปรดบอกภาพการจัดดอกไม้ที่คุณต้องการ บอกบรรยากาศ สี ให้ใคร และงบประมาณ แล้วเราจะสร้างภาพข้อเสนอด้วยดอกไม้ในร้าน กดปุ่ม “พูด” แล้วพูด หรือพิมพ์ในช่องแล้วส่ง",
  vi: "Hãy mô tả mẫu hoa bạn hình dung. Cho biết không khí, màu sắc, tặng ai và ngân sách, chúng tôi sẽ tạo ảnh đề xuất bằng hoa trong cửa hàng. Nhấn nút “Nói” và nói, hoặc nhập vào ô rồi gửi.",
  id: "Ceritakan rangkaian bunga yang Anda bayangkan. Sebutkan suasana, warna, untuk siapa, dan anggaran, lalu kami akan membuat gambar usulan dengan bunga di toko kami. Ketuk tombol “Bicara” lalu bicara, atau ketik di kotak dan kirim.",
};

export function showGuide(lang: string): string {
  return SHOW_GUIDE[lang] || SHOW_GUIDE[lang.split("-")[0]] || SHOW_GUIDE.en;
}
