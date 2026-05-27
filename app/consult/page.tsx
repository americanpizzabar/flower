"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./consult.module.css";
import {
  CONSULT_SLOTS,
  type ConsultKeywords,
  type ConsultResult,
  type ConsultTurn,
  type SlotKey,
  SUPPORTED_LANGS,
} from "@/lib/types";
import { speak, useSpeechRecognition } from "@/lib/speech";

interface ChatTurn {
  role: "customer" | "assistant";
  text: string;
  language?: string;
}

export default function ConsultPage() {
  const [lang, setLang] = useState("en");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [state, setState] = useState<ConsultResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [autoSpeak, setAutoSpeak] = useState(true);
  const historyEndRef = useRef<HTMLDivElement>(null);

  const speechLang = SUPPORTED_LANGS.find((l) => l.code === lang)?.speech || "en-US";
  const speech = useSpeechRecognition({
    lang: speechLang,
    onFinal: (t) => setInput((prev) => (prev ? `${prev} ${t}` : t)),
  });

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError("");
    setLoading(true);

    const nextTurns: ChatTurn[] = [...turns, { role: "customer", text }];
    setTurns(nextTurns);

    try {
      const apiHistory: ConsultTurn[] = turns.map((t) => ({
        role: t.role,
        text: t.text,
      }));
      const res = await fetch("/api/consult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, history: apiHistory, lang }),
      });

      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        const t = await res.text();
        throw new Error(`サーバーから予期しない応答 (HTTP ${res.status}): ${t.slice(0, 120)}`);
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "失敗しました");

      const result = data as ConsultResult;
      setState(result);
      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          text: result.reply_to_customer,
          language: result.detected_language,
        },
      ]);
      if (autoSpeak && result.reply_to_customer) {
        speak(result.reply_to_customer, speechLang);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "通信エラー");
      setTurns((prev) => prev.slice(0, -1));
      setInput(text);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setTurns([]);
    setState(null);
    setInput("");
    setError("");
  }

  const filled = new Set<SlotKey>(state?.filled_slots || []);
  const isReady = state?.is_ready === true;

  return (
    <div>
      <h1>🎨 イメージで提案</h1>
      <p className={styles.lead}>
        お客様と AI が会話しながら、必要な情報を順番に聞き出します。
        十分集まったら店員さんに伝わる形で要約されます。
      </p>

      {turns.length === 0 && (
        <div className={styles.langPickerBox}>
          <label>お客様の言語</label>
          <select value={lang} onChange={(e) => setLang(e.target.value)}>
            {SUPPORTED_LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label_ja} ({l.code})
              </option>
            ))}
          </select>
          <p className={styles.hint}>
            最初に話したいことをお客様に入力 / 発話してもらってください。
            その後は AI が必要な質問を投げかけていきます。
          </p>
        </div>
      )}

      {/* Slot progress */}
      {state && (
        <div className={styles.slotBoard}>
          <div className={styles.slotHeader}>
            <span>聞き取り状況</span>
            {isReady && <span className={styles.readyBadge}>✓ 十分情報が集まりました</span>}
          </div>
          <div className={styles.slotGrid}>
            {CONSULT_SLOTS.map((s) => {
              const value = state.keywords[s.key as keyof ConsultKeywords];
              const display = Array.isArray(value)
                ? value.join(" / ")
                : typeof value === "string"
                  ? value
                  : "";
              const isFilled = filled.has(s.key);
              return (
                <div
                  key={s.key}
                  className={`${styles.slot} ${isFilled ? styles.slotFilled : ""} ${
                    s.required ? styles.slotRequired : ""
                  }`}
                >
                  <div className={styles.slotLabel}>
                    {isFilled ? "✓" : s.required ? "●" : "○"} {s.label_ja}
                  </div>
                  <div className={styles.slotValue}>
                    {display || <span className={styles.slotEmpty}>未取得</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Chat history */}
      <div className={styles.chat}>
        {turns.length === 0 && (
          <div className={styles.empty}>
            まだ会話はありません。お客様にタブレットを向けて、希望を入力してもらってください。
          </div>
        )}
        {turns.map((t, i) => (
          <div
            key={i}
            className={t.role === "customer" ? styles.customerRow : styles.assistantRow}
          >
            <div className={styles.bubble}>
              <div className={styles.role}>
                {t.role === "customer" ? "お客様" : "AI"}
                {t.language && <span className={styles.langTag}>{t.language}</span>}
              </div>
              <div className={styles.text}>{t.text}</div>
              {t.role === "assistant" && (
                <button
                  className="ghost"
                  onClick={() => speak(t.text, speechLang)}
                  style={{ marginTop: 6, padding: "4px 10px", fontSize: "0.85rem" }}
                >
                  🔊 読み上げ
                </button>
              )}
            </div>
          </div>
        ))}
        <div ref={historyEndRef} />
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.composer}>
        <textarea
          value={input + (speech.interim ? ` ${speech.interim}` : "")}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          placeholder={
            turns.length === 0
              ? "例: I'd like flowers for my mother's birthday..."
              : "お客様の返事を入力 / 音声で..."
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
        />
        <div className={styles.composerSide}>
          {speech.supported &&
            (speech.listening ? (
              <button className="ghost" onClick={speech.stop}>
                ⏹
              </button>
            ) : (
              <button className="ghost" onClick={speech.start}>
                🎤
              </button>
            ))}
          <button onClick={send} disabled={loading || !input.trim()}>
            {loading ? "..." : "送信"}
          </button>
        </div>
      </div>

      <div className={styles.controlsRow}>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={autoSpeak}
            onChange={(e) => setAutoSpeak(e.target.checked)}
          />
          AI の返答を自動で読み上げる
        </label>
        {turns.length > 0 && (
          <button className="ghost" onClick={reset}>
            新しいお客様で始める
          </button>
        )}
      </div>

      {/* Staff summary panel */}
      {state && (
        <div className={styles.staffPanel}>
          <h2>📋 店員さんへ</h2>
          <p className={styles.summary}>{state.cumulative_summary_ja}</p>
          {state.staff_note_ja && (
            <p className={styles.staffNote}>💡 {state.staff_note_ja}</p>
          )}
          {!isReady && state.next_question_to_customer && (
            <p className={styles.nextHint}>
              次にお客様へ:「{state.next_question_to_customer}」
            </p>
          )}
        </div>
      )}
    </div>
  );
}
