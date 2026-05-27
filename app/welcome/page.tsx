"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./welcome.module.css";
import { speechLangFor, type StoreIntroResult } from "@/lib/types";
import { speak } from "@/lib/speech";

const STORAGE_URL = "hanakotoba.storeUrl";
const STORAGE_INTRO = "hanakotoba.storeIntro";
const DEFAULT_LANGS = ["ja", "en", "zh-Hans", "ko", "es", "fr", "de"];

export default function WelcomePage() {
  const [url, setUrl] = useState("");
  const [savedUrl, setSavedUrl] = useState("");
  const [intro, setIntro] = useState<StoreIntroResult | null>(null);
  const [activeLang, setActiveLang] = useState("ja");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const u = localStorage.getItem(STORAGE_URL);
    if (u) {
      setUrl(u);
      setSavedUrl(u);
    }
    const cached = localStorage.getItem(STORAGE_INTRO);
    if (cached) {
      try {
        setIntro(JSON.parse(cached));
      } catch {
        /* ignore */
      }
    }
  }, []);

  async function fetchIntro() {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/intro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, langs: DEFAULT_LANGS }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "失敗しました");
      setIntro(data);
      setSavedUrl(url);
      localStorage.setItem(STORAGE_URL, url);
      localStorage.setItem(STORAGE_INTRO, JSON.stringify(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : "通信エラー");
    } finally {
      setLoading(false);
    }
  }

  function clearCache() {
    localStorage.removeItem(STORAGE_URL);
    localStorage.removeItem(STORAGE_INTRO);
    setSavedUrl("");
    setIntro(null);
  }

  const active = intro?.intros.find((i) => i.lang === activeLang) || intro?.intros[0];
  const fullText = active
    ? [active.greeting, active.about, active.specialties, active.hours_access, active.call_to_action]
        .filter(Boolean)
        .join(" ")
    : "";

  return (
    <div>
      <h1>🏪 店舗紹介</h1>
      <p className={styles.lead}>
        お店の URL を入れると、AI が読み取って多言語の紹介文を作ります。
      </p>

      <div className={styles.urlForm}>
        <label>お店の URL (ホームページ・SNS・Google Maps など)</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          inputMode="url"
        />
        <div className={styles.urlActions}>
          <button onClick={fetchIntro} disabled={loading || !url.trim()}>
            {loading ? "AI が読み込み中..." : intro ? "再生成" : "紹介を作る"}
          </button>
          {savedUrl && (
            <button className="ghost" onClick={clearCache}>
              キャッシュをクリア
            </button>
          )}
        </div>
        {savedUrl && (
          <p className={styles.savedHint}>保存済み: {savedUrl}</p>
        )}
        {error && <p className={styles.error}>{error}</p>}
      </div>

      {intro && active && (
        <div className={styles.introBox}>
          <div className={styles.langTabs}>
            {intro.intros.map((i) => (
              <button
                key={i.lang}
                className={i.lang === activeLang ? styles.langTabActive : styles.langTab}
                onClick={() => setActiveLang(i.lang)}
              >
                {i.language_name_ja}
              </button>
            ))}
          </div>

          <div className={styles.introContent}>
            <h2 className={styles.greeting}>{active.greeting}</h2>
            <p className={styles.section}>{active.about}</p>
            {active.specialties && (
              <p className={styles.section}>
                <strong>💐 </strong>
                {active.specialties}
              </p>
            )}
            {active.hours_access && (
              <p className={styles.section}>
                <strong>📍 </strong>
                {active.hours_access}
              </p>
            )}
            <p className={styles.cta}>{active.call_to_action}</p>

            <button
              className="ghost"
              onClick={() => speak(fullText, speechLangFor(active.lang))}
            >
              🔊 読み上げる
            </button>
          </div>

          <details className={styles.sourceBox}>
            <summary>店員向け: AI が読み取った店の情報</summary>
            <p>{intro.source_summary_ja}</p>
          </details>

          <div className={styles.nextSteps}>
            <h3>次は？</h3>
            <div className={styles.nextGrid}>
              <Link href="/consult" className={styles.nextCard}>
                🎨 イメージで相談
              </Link>
              <Link href="/show" className={styles.nextCard}>
                📸 お店の花を見せる
              </Link>
              <Link href="/interpret" className={styles.nextCard}>
                🗣️ 通訳する
              </Link>
            </div>
          </div>
        </div>
      )}

      {!intro && (
        <div className={styles.help}>
          <h3>💡 こんな URL が使えます</h3>
          <ul>
            <li>お店のホームページ</li>
            <li>Google マップの店舗ページ</li>
            <li>Instagram のプロフィールページ</li>
            <li>食べログ等の店舗紹介ページ</li>
          </ul>
          <p className={styles.smallNote}>
            ※ JavaScript で動的に描画されるページは読み取れない場合があります。
            その場合はホームページや Google マップなど、静的な情報があるサイトを試してください。
          </p>
        </div>
      )}

    </div>
  );
}
