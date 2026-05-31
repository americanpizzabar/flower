import Link from "next/link";
import styles from "./page.module.css";

const TOOLS = [
  {
    href: "/consult",
    emoji: "🎨",
    title: "イメージで提案",
    desc: "お客様に話したり書いてもらった希望を、日本語に要約。店員さんが店内の花を見繕えるようにします。",
  },
  {
    href: "/show",
    emoji: "📸",
    title: "花を撮って見せる",
    desc: "お客様の希望を聞いた上で、店内の花をスマホで撮影。AI がお客様の言語で説明します。",
  },
  {
    href: "/interpret",
    emoji: "🗣️",
    title: "通訳モード",
    desc: "店員さんとお客様の言葉をリアルタイムに通訳。音声入力・読み上げにも対応します。",
  },
  {
    href: "/welcome",
    emoji: "🏪",
    title: "店舗紹介",
    desc: "お店の URL を入れるだけで、多言語の店舗紹介を自動生成。観光客の最初の一歩に。",
  },
  {
    href: "/manual",
    emoji: "📖",
    title: "使い方マニュアル",
    desc: "はじめての方向けに、4 つの機能をわかりやすく説明しています。困ったときにご覧ください。",
  },
];

export default function HomePage() {
  return (
    <div>
      <h1 className={styles.hero}>🌸 ようこそ、Hanakotoba へ</h1>
      <p className={styles.lead}>
        4つの営業ツールと使い方マニュアルで、世界中のお客様と花でつながります。
      </p>

      <Link href="/start" className={styles.handoff}>
        <div className={styles.handoffEmoji}>👋</div>
        <div>
          <h2>お客様にお渡しする</h2>
          <p>
            言語を選んでもらい、店舗紹介のあと「相談」か「お花を見せる」へご案内します。
            まずはこの画面をお客様に渡してください。
          </p>
        </div>
      </Link>

      <div className={styles.cards}>
        {TOOLS.map((t) => (
          <Link key={t.href} href={t.href} className={styles.card}>
            <div className={styles.emoji}>{t.emoji}</div>
            <h2>{t.title}</h2>
            <p>{t.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
