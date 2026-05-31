"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./start.module.css";
import { speechLangFor, type StoreIntroResult } from "@/lib/types";
import { primeMic, speak, stopSpeaking, unlockSpeech } from "@/lib/speech";

const STORAGE_INTRO = "hanakotoba.storeIntro";

// Languages offered as big buttons on the hand-to-customer screen.
const LANGS: { code: string; native: string; flag: string }[] = [
  { code: "ja", native: "日本語", flag: "🇯🇵" },
  { code: "en", native: "English", flag: "🇺🇸" },
  { code: "zh-Hans", native: "简体中文", flag: "🇨🇳" },
  { code: "zh-Hant", native: "繁體中文", flag: "🇹🇼" },
  { code: "ko", native: "한국어", flag: "🇰🇷" },
  { code: "es", native: "Español", flag: "🇪🇸" },
  { code: "fr", native: "Français", flag: "🇫🇷" },
  { code: "de", native: "Deutsch", flag: "🇩🇪" },
  { code: "it", native: "Italiano", flag: "🇮🇹" },
  { code: "pt", native: "Português", flag: "🇵🇹" },
  { code: "ru", native: "Русский", flag: "🇷🇺" },
  { code: "th", native: "ไทย", flag: "🇹🇭" },
  { code: "vi", native: "Tiếng Việt", flag: "🇻🇳" },
  { code: "id", native: "Indonesia", flag: "🇮🇩" },
];

interface Phrases {
  welcome: string;
  pickHint: string;
  introFallback: string;
  question: string;
  optConsult: string;
  optShow: string;
  optConsultDesc: string;
  optShowDesc: string;
  back: string;
  replay: string;
}

// Localized UI for the greeting flow. English is the fallback for any language
// not listed here.
const PHRASES: Record<string, Phrases> = {
  ja: {
    welcome: "ようこそ",
    pickHint: "言語を選んでください",
    introFallback:
      "ようこそ、お花屋さんへ。心を込めて、あなたにぴったりのお花をご用意します。どうぞごゆっくりご覧ください。",
    question: "どちらをご希望ですか？",
    optConsult: "イメージで相談する",
    optShow: "お花を見せてもらう",
    optConsultDesc: "ご希望をお伺いして、ぴったりのお花をご提案します",
    optShowDesc: "店内のお花を見ながら、組み合わせをご提案します",
    back: "戻る",
    replay: "もう一度聞く",
  },
  en: {
    welcome: "Welcome",
    pickHint: "Please choose your language",
    introFallback:
      "Welcome to our flower shop. We would love to help you find the perfect flowers. Please take your time and enjoy.",
    question: "What would you like to do?",
    optConsult: "Tell us what you imagine",
    optShow: "See our flowers",
    optConsultDesc: "We'll ask a few questions and suggest the perfect flowers",
    optShowDesc: "We'll show today's flowers and propose arrangements",
    back: "Back",
    replay: "Play again",
  },
  "zh-Hans": {
    welcome: "欢迎光临",
    pickHint: "请选择您的语言",
    introFallback:
      "欢迎光临本花店。我们很乐意为您挑选最合适的鲜花。请慢慢欣赏。",
    question: "您想要哪一种服务？",
    optConsult: "告诉我们您的想法",
    optShow: "看看店内的鲜花",
    optConsultDesc: "我们会询问几个问题，为您推荐合适的鲜花",
    optShowDesc: "一边看店内鲜花，一边为您搭配建议",
    back: "返回",
    replay: "再听一次",
  },
  "zh-Hant": {
    welcome: "歡迎光臨",
    pickHint: "請選擇您的語言",
    introFallback:
      "歡迎光臨本花店。我們很樂意為您挑選最合適的鮮花。請慢慢欣賞。",
    question: "您想要哪一種服務？",
    optConsult: "告訴我們您的想法",
    optShow: "看看店內的鮮花",
    optConsultDesc: "我們會詢問幾個問題，為您推薦合適的鮮花",
    optShowDesc: "一邊看店內鮮花，一邊為您搭配建議",
    back: "返回",
    replay: "再聽一次",
  },
  ko: {
    welcome: "환영합니다",
    pickHint: "언어를 선택해 주세요",
    introFallback:
      "꽃집에 오신 것을 환영합니다. 당신에게 꼭 맞는 꽃을 정성껏 준비해 드리겠습니다. 천천히 둘러보세요.",
    question: "무엇을 도와드릴까요?",
    optConsult: "원하시는 이미지를 상담하기",
    optShow: "매장의 꽃 보기",
    optConsultDesc: "몇 가지 여쭤보고 알맞은 꽃을 추천해 드립니다",
    optShowDesc: "매장의 꽃을 보면서 조합을 제안해 드립니다",
    back: "뒤로",
    replay: "다시 듣기",
  },
  es: {
    welcome: "Bienvenido",
    pickHint: "Por favor, elija su idioma",
    introFallback:
      "Bienvenido a nuestra floristería. Estaremos encantados de ayudarle a encontrar las flores perfectas. Tómese su tiempo.",
    question: "¿Qué le gustaría hacer?",
    optConsult: "Cuéntenos lo que imagina",
    optShow: "Ver nuestras flores",
    optConsultDesc: "Le haremos unas preguntas y le sugeriremos las flores ideales",
    optShowDesc: "Le mostraremos las flores de hoy y le propondremos arreglos",
    back: "Atrás",
    replay: "Escuchar de nuevo",
  },
  fr: {
    welcome: "Bienvenue",
    pickHint: "Veuillez choisir votre langue",
    introFallback:
      "Bienvenue dans notre boutique de fleurs. Nous serions ravis de vous aider à trouver les fleurs parfaites. Prenez votre temps.",
    question: "Que souhaitez-vous faire ?",
    optConsult: "Dites-nous ce que vous imaginez",
    optShow: "Voir nos fleurs",
    optConsultDesc: "Nous poserons quelques questions et proposerons les fleurs idéales",
    optShowDesc: "Nous montrerons les fleurs du jour et proposerons des compositions",
    back: "Retour",
    replay: "Réécouter",
  },
  de: {
    welcome: "Willkommen",
    pickHint: "Bitte wählen Sie Ihre Sprache",
    introFallback:
      "Willkommen in unserem Blumenladen. Wir helfen Ihnen gerne, die perfekten Blumen zu finden. Lassen Sie sich Zeit.",
    question: "Was möchten Sie tun?",
    optConsult: "Sagen Sie uns, was Sie sich vorstellen",
    optShow: "Unsere Blumen ansehen",
    optConsultDesc: "Wir stellen ein paar Fragen und schlagen die passenden Blumen vor",
    optShowDesc: "Wir zeigen die Blumen des Tages und schlagen Gestecke vor",
    back: "Zurück",
    replay: "Erneut anhören",
  },
  it: {
    welcome: "Benvenuto",
    pickHint: "Scegli la tua lingua",
    introFallback:
      "Benvenuto nel nostro negozio di fiori. Saremo lieti di aiutarti a trovare i fiori perfetti. Prenditi il tuo tempo.",
    question: "Cosa desideri fare?",
    optConsult: "Raccontaci cosa immagini",
    optShow: "Vedere i nostri fiori",
    optConsultDesc: "Faremo alcune domande e suggeriremo i fiori ideali",
    optShowDesc: "Mostreremo i fiori di oggi e proporremo composizioni",
    back: "Indietro",
    replay: "Ascolta di nuovo",
  },
  pt: {
    welcome: "Bem-vindo",
    pickHint: "Por favor, escolha o seu idioma",
    introFallback:
      "Bem-vindo à nossa floricultura. Teremos prazer em ajudá-lo a encontrar as flores perfeitas. Fique à vontade.",
    question: "O que gostaria de fazer?",
    optConsult: "Conte-nos o que imagina",
    optShow: "Ver as nossas flores",
    optConsultDesc: "Faremos algumas perguntas e sugeriremos as flores ideais",
    optShowDesc: "Mostraremos as flores de hoje e proporemos arranjos",
    back: "Voltar",
    replay: "Ouvir novamente",
  },
  ru: {
    welcome: "Добро пожаловать",
    pickHint: "Пожалуйста, выберите язык",
    introFallback:
      "Добро пожаловать в наш цветочный магазин. Мы с радостью поможем вам подобрать идеальные цветы. Не торопитесь.",
    question: "Что бы вы хотели сделать?",
    optConsult: "Расскажите, что вы представляете",
    optShow: "Посмотреть наши цветы",
    optConsultDesc: "Мы зададим несколько вопросов и предложим подходящие цветы",
    optShowDesc: "Покажем сегодняшние цветы и предложим композиции",
    back: "Назад",
    replay: "Прослушать снова",
  },
  th: {
    welcome: "ยินดีต้อนรับ",
    pickHint: "กรุณาเลือกภาษาของคุณ",
    introFallback:
      "ยินดีต้อนรับสู่ร้านดอกไม้ของเรา เรายินดีช่วยคุณเลือกดอกไม้ที่เหมาะที่สุด เชิญชมตามสบายนะคะ",
    question: "คุณต้องการบริการแบบใด?",
    optConsult: "บอกเราถึงสิ่งที่คุณนึกภาพไว้",
    optShow: "ดูดอกไม้ในร้าน",
    optConsultDesc: "เราจะถามคำถามสองสามข้อและแนะนำดอกไม้ที่เหมาะสม",
    optShowDesc: "เราจะให้ดูดอกไม้วันนี้และเสนอการจัดดอกไม้",
    back: "ย้อนกลับ",
    replay: "ฟังอีกครั้ง",
  },
  vi: {
    welcome: "Chào mừng",
    pickHint: "Vui lòng chọn ngôn ngữ của bạn",
    introFallback:
      "Chào mừng đến với cửa hàng hoa của chúng tôi. Chúng tôi rất vui được giúp bạn chọn những bông hoa hoàn hảo. Xin cứ thong thả.",
    question: "Bạn muốn làm gì?",
    optConsult: "Cho chúng tôi biết ý tưởng của bạn",
    optShow: "Xem hoa của chúng tôi",
    optConsultDesc: "Chúng tôi sẽ hỏi vài câu và gợi ý loài hoa phù hợp",
    optShowDesc: "Chúng tôi sẽ cho xem hoa hôm nay và đề xuất cách phối hoa",
    back: "Quay lại",
    replay: "Nghe lại",
  },
  id: {
    welcome: "Selamat datang",
    pickHint: "Silakan pilih bahasa Anda",
    introFallback:
      "Selamat datang di toko bunga kami. Kami dengan senang hati membantu Anda menemukan bunga yang sempurna. Silakan santai saja.",
    question: "Apa yang ingin Anda lakukan?",
    optConsult: "Ceritakan yang Anda bayangkan",
    optShow: "Lihat bunga kami",
    optConsultDesc: "Kami akan bertanya beberapa hal dan menyarankan bunga yang cocok",
    optShowDesc: "Kami akan menunjukkan bunga hari ini dan mengusulkan rangkaian",
    back: "Kembali",
    replay: "Putar lagi",
  },
};

function phrasesFor(lang: string): Phrases {
  return PHRASES[lang] || PHRASES[lang.split("-")[0]] || PHRASES.en;
}

type Stage = "lang" | "intro";

export default function StartPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("lang");
  const [lang, setLang] = useState("en");
  const [intro, setIntro] = useState<StoreIntroResult | null>(null);
  const spokenRef = useRef(false);

  useEffect(() => {
    const cached = localStorage.getItem(STORAGE_INTRO);
    if (cached) {
      try {
        setIntro(JSON.parse(cached));
      } catch {
        /* ignore */
      }
    }
    // iOS Safari loads the voice list asynchronously. Trigger a load so that
    // by the time the user taps a language, getVoices() returns something.
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
    }
    return () => stopSpeaking();
  }, []);

  // Build the spoken/displayed store intro for the chosen language.
  function introTextFor(code: string): string {
    const p = phrasesFor(code);
    const found =
      intro?.intros.find((i) => i.lang === code) ||
      intro?.intros.find((i) => i.lang.split("-")[0] === code.split("-")[0]);
    if (found) {
      return [found.greeting, found.about, found.specialties, found.call_to_action]
        .filter(Boolean)
        .join(" ");
    }
    return p.introFallback;
  }

  function pickLang(code: string) {
    // EVERYTHING here must run synchronously inside the user gesture. iOS
    // Safari refuses to start audio (TTS) or grant mic permission if we hop
    // through a setTimeout / await first.
    unlockSpeech(); // unlock TTS for the rest of the session
    speak(introTextFor(code), speechLangFor(code)); // speak the intro NOW
    void primeMic(); // also surface the mic-permission prompt while we're in-gesture
    setLang(code);
    setStage("intro");
    spokenRef.current = true;
  }

  function replayIntro() {
    speak(introTextFor(lang), speechLangFor(lang));
  }

  function go(path: "consult" | "show") {
    stopSpeaking();
    router.push(`/${path}?lang=${encodeURIComponent(lang)}`);
  }

  if (stage === "lang") {
    return (
      <div className={styles.wrap}>
        <div className={styles.hero}>
          <div className={styles.flower}>🌸</div>
          <h1 className={styles.bigTitle}>Hanakotoba</h1>
          <p className={styles.subtitle}>Welcome ・ ようこそ ・ 欢迎 ・ 환영합니다</p>
          <p className={styles.pickAll}>言語を選んでください / Please choose your language</p>
        </div>
        <div className={styles.langGrid}>
          {LANGS.map((l) => (
            <button key={l.code} className={styles.langBtn} onClick={() => pickLang(l.code)}>
              <span className={styles.langFlag}>{l.flag}</span>
              <span className={styles.langNative}>{l.native}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const p = phrasesFor(lang);
  return (
    <div className={styles.wrap}>
      <div className={styles.introCard}>
        <div className={styles.flower}>🌸</div>
        <h1 className={styles.welcome}>{p.welcome}</h1>
        <p className={styles.introText}>{introTextFor(lang)}</p>
        <button className={styles.replayBtn} onClick={replayIntro}>
          🔊 {p.replay}
        </button>
      </div>

      <h2 className={styles.question}>{p.question}</h2>
      <div className={styles.optionGrid}>
        <button className={styles.optionBtn} onClick={() => go("consult")}>
          <span className={styles.optEmoji}>🎨</span>
          <span className={styles.optTitle}>{p.optConsult}</span>
          <span className={styles.optDesc}>{p.optConsultDesc}</span>
        </button>
        <button className={styles.optionBtn} onClick={() => go("show")}>
          <span className={styles.optEmoji}>📸</span>
          <span className={styles.optTitle}>{p.optShow}</span>
          <span className={styles.optDesc}>{p.optShowDesc}</span>
        </button>
      </div>

      <button
        className={styles.backBtn}
        onClick={() => {
          stopSpeaking();
          setStage("lang");
        }}
      >
        ← {p.back}
      </button>
    </div>
  );
}
