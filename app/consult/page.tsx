"use client";

import { useState } from "react";
import styles from "./consult.module.css";
import { SUPPORTED_LANGS, type ConsultResult } from "@/lib/types";
import { useSpeechRecognition, speak } from "@/lib/speech";

export default function ConsultPage() {
  const [lang, setLang] = useState("en");
  const [text, setText] = useState("");
  const [result, setResult] = useState<ConsultResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const speechLang = SUPPORTED_LANGS.find((l) => l.code === lang)?.speech || "en-US";
  const speech = useSpeechRecognition({
    lang: speechLang,
    onFinal: (t) => setText((prev) => (prev ? `${prev} ${t}` : t)),
  });

  async function submit() {
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/consult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "失敗しました");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "通信エラー");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setText("");
    setResult(null);
    setError("");
  }

  return (
    <div>
      <h1>🎨 イメージで提案</h1>
      <p className={styles.lead}>
        お客様にタブレットを向けて、希望のイメージを話してもらうか入力してもらってください。
      </p>

      {!result && (
        <div className={styles.card}>
          <label>お客様の言語</label>
          <select value={lang} onChange={(e) => setLang(e.target.value)}>
            {SUPPORTED_LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label_ja} ({l.code})
              </option>
            ))}
          </select>

          <label className={styles.mt}>希望のイメージ</label>
          <textarea
            value={text + (speech.interim ? ` ${speech.interim}` : "")}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="例: I want a bright bouquet for my mother's birthday, around 50 dollars..."
          />

          <div className={styles.actions}>
            {speech.supported ? (
              speech.listening ? (
                <button className="ghost" onClick={speech.stop}>
                  ⏹ 停止
                </button>
              ) : (
                <button className="ghost" onClick={speech.start}>
                  🎤 音声で入力
                </button>
              )
            ) : (
              <span className={styles.note}>
                ※ このブラウザは音声入力に対応していません
              </span>
            )}
            <button onClick={submit} disabled={loading || !text.trim()}>
              {loading ? "解析中..." : "店員に伝える"}
            </button>
          </div>
          {error && <p className={styles.error}>{error}</p>}
        </div>
      )}

      {result && (
        <div className={styles.result}>
          <div className={styles.summaryBox}>
            <div className={styles.tagRow}>
              <span className={styles.langTag}>{result.language_name_ja}</span>
            </div>
            <h2>📋 店員さんへ</h2>
            <p className={styles.summary}>{result.summary_ja}</p>

            <div className={styles.keywords}>
              {result.keywords.color && result.keywords.color.length > 0 && (
                <Tag label="色" value={result.keywords.color.join(" / ")} />
              )}
              {result.keywords.purpose && (
                <Tag label="用途" value={result.keywords.purpose} />
              )}
              {result.keywords.recipient && (
                <Tag label="贈る相手" value={result.keywords.recipient} />
              )}
              {result.keywords.occasion && (
                <Tag label="場面" value={result.keywords.occasion} />
              )}
              {result.keywords.budget && (
                <Tag label="予算" value={result.keywords.budget} />
              )}
              {result.keywords.style && (
                <Tag label="雰囲気" value={result.keywords.style} />
              )}
              {result.keywords.flower_language &&
                result.keywords.flower_language.length > 0 && (
                  <Tag label="花言葉" value={result.keywords.flower_language.join(" / ")} />
                )}
              {result.keywords.delivery && (
                <Tag label="配送" value={result.keywords.delivery} />
              )}
            </div>

            {result.follow_up_questions_ja && result.follow_up_questions_ja.length > 0 && (
              <div className={styles.followUps}>
                <h3>確認したい点</h3>
                <ul>
                  {result.follow_up_questions_ja.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className={styles.replyBox}>
            <h2>📣 お客様への確認</h2>
            <p className={styles.reply}>{result.reply_to_customer}</p>
            <button
              className="ghost"
              onClick={() => speak(result.reply_to_customer, speechLang)}
            >
              🔊 読み上げる
            </button>
          </div>

          <div className={styles.bottomActions}>
            <button onClick={reset}>もう一度</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Tag({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.tag}>
      <span className={styles.tagLabel}>{label}</span>
      <span className={styles.tagValue}>{value}</span>
    </div>
  );
}
