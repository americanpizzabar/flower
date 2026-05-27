import Link from "next/link";
import styles from "./page.module.css";

export default function HomePage() {
  return (
    <div>
      <h1 className={styles.hero}>🌸 ようこそ、Hanakotoba へ</h1>
      <p className={styles.lead}>
        外国人のお客様にも、その日の在庫から最適な一輪をご提案します。
      </p>

      <div className={styles.cards}>
        <Link href="/chat" className={styles.card}>
          <div className={styles.emoji}>💬</div>
          <h2>接客チャット</h2>
          <p>
            お客様にタブレットを向けて、母国語で会話。AI
            がお客様の言葉を自動で見極め、店員さんには日本語で意図をお伝えします。
          </p>
        </Link>

        <Link href="/suggest" className={styles.card}>
          <div className={styles.emoji}>🎂</div>
          <h2>花を提案</h2>
          <p>
            誕生日や花言葉、色、ご予算から、現在の在庫の中で最適な花を絞り込みます。
          </p>
        </Link>

        <Link href="/inventory" className={styles.card}>
          <div className={styles.emoji}>📦</div>
          <h2>在庫管理</h2>
          <p>
            本日の入荷を写真付きで登録。在庫数や価格、色を一覧で管理できます。
          </p>
        </Link>
      </div>
    </div>
  );
}
