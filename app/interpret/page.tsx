"use client";

import { useState } from "react";
import styles from "./interpret.module.css";
import { SUPPORTED_LANGS, speechLangFor, uiLabel } from "@/lib/types";
import { useSpeechRecognition, speak } from "@/lib/speech";

interface Turn {
  side: "staff" | "customer";
  source_text: string;
  source_lang: string;
  source_lang_name_ja: string;
  translation: string;
  target_lang: string;
  notes_ja?: string;
}

export default function InterpretPage() {
  const [customerLang, setCustomerLang] = useState("en");
  const [staffInput, setStaffInput] = useState("");
  const [customerInput, setCustomerInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState<"staff" | "customer" | null>(null);
  const [error, setError] = useState("");

  const customerSpeechLang = speechLangFor(customerLang);
  const staffSpeech = useSpeechRecognition({
    lang: "ja-JP",
    onFinal: (t) => setStaffInput((p) => (p ? `${p} ${t}` : t)),
  });
  const customerSpeech = useSpeechRecognition({
    lang: customerSpeechLang,
    onFinal: (t) => setCustomerInput((p) => (p ? `${p} ${t}` : t)),
  });

  async function send(side: "staff" | "customer") {
    const text = side === "staff" ? staffInput : customerInput;
    if (!text.trim()) return;
    const sourceHint = side === "staff" ? "ja" : customerLang;
    const targetLang = side === "staff" ? customerLang : "ja";
    setLoading(side);
    setError("");
    try {
      const res = await fetch("/api/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          source_hint: sourceHint,
          target_lang: targetLang,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "失敗しました");
      const turn: Turn = {
        side,
        source_text: text,
        source_lang: data.detected_language,
        source_lang_name_ja: data.language_name_ja,
        translation: data.translation,
        target_lang: targetLang,
        notes_ja: data.notes_ja,
      };
      setTurns((prev) => [...prev, turn]);
      // Auto-speak the translation
      speak(turn.translation, speechLangFor(targetLang));
      if (side === "staff") setStaffInput("");
      else setCustomerInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "通信エラー");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      <h1>🗣️ 通訳モード</h1>
      <p className={styles.lead}>
        日本語とお客様の言語を交互に翻訳します。マイクで話すか入力欄に書いてください。
      </p>

      <div className={styles.langSelector}>
        <label>お客様の言語</label>
        <select value={customerLang} onChange={(e) => setCustomerLang(e.target.value)}>
          {SUPPORTED_LANGS.filter((l) => l.code !== "ja").map((l) => (
            <option key={l.code} value={l.code}>
              {l.label_ja} ({l.code})
            </option>
          ))}
        </select>
      </div>

      <div className={styles.history}>
        {turns.length === 0 && (
          <p className={styles.empty}>
            まだやり取りはありません。下の入力欄から始めてください。
          </p>
        )}
        {turns.map((t, i) => (
          <div
            key={i}
            className={t.side === "staff" ? styles.staffTurn : styles.customerTurn}
          >
            <div className={styles.bubble}>
              <div className={styles.role}>
                {t.side === "staff" ? "店員 → お客様" : "お客様 → 店員"}
                <span className={styles.lang}>{t.source_lang_name_ja}</span>
              </div>
              <div className={styles.original}>{t.source_text}</div>
              <div className={styles.arrow}>↓</div>
              <div className={styles.translated}>{t.translation}</div>
              <div className={styles.bubbleActions}>
                <button
                  className="ghost"
                  onClick={() => speak(t.translation, speechLangFor(t.target_lang))}
                >
                  🔊
                </button>
                {t.notes_ja && (
                  <span className={styles.notes}>💡 {t.notes_ja}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.composers}>
        <div className={styles.composer}>
          <div className={styles.composerLabel}>👤 店員 (日本語)</div>
          <textarea
            value={staffInput + (staffSpeech.interim ? ` ${staffSpeech.interim}` : "")}
            onChange={(e) => setStaffInput(e.target.value)}
            rows={3}
            placeholder="例: いらっしゃいませ。どんな雰囲気のお花をお探しですか？"
          />
          <div className={styles.composerButtons}>
            {staffSpeech.supported && (
              <button
                className={`${styles.micButton} ${staffSpeech.listening ? styles.micActive : ""}`}
                onClick={() => (staffSpeech.listening ? staffSpeech.stop() : staffSpeech.start())}
                disabled={loading !== null}
              >
                <span className={styles.btnIcon}>{staffSpeech.listening ? "⏹" : "🎤"}</span>
                <span className={styles.btnMain}>{staffSpeech.listening ? "停止" : "話す"}</span>
              </button>
            )}
            <button
              className={styles.sendButton}
              onClick={() => send("staff")}
              disabled={loading !== null || !staffInput.trim()}
            >
              <span className={styles.btnIcon}>{loading === "staff" ? "⏳" : "🔄"}</span>
              <span className={styles.btnMain}>翻訳して伝える</span>
              <span className={styles.btnSub}>{uiLabel(customerLang, "send")}</span>
            </button>
          </div>
        </div>

        <div className={styles.composer}>
          <div className={styles.composerLabel}>
            🧑‍🤝‍🧑 お客様 ({SUPPORTED_LANGS.find((l) => l.code === customerLang)?.label_ja})
          </div>
          <textarea
            value={customerInput + (customerSpeech.interim ? ` ${customerSpeech.interim}` : "")}
            onChange={(e) => setCustomerInput(e.target.value)}
            rows={3}
            placeholder="例: I'd like a small bouquet around 30 dollars."
          />
          <div className={styles.composerButtons}>
            {customerSpeech.supported && (
              <button
                className={`${styles.micButton} ${customerSpeech.listening ? styles.micActive : ""}`}
                onClick={() =>
                  customerSpeech.listening ? customerSpeech.stop() : customerSpeech.start()
                }
                disabled={loading !== null}
              >
                <span className={styles.btnIcon}>{customerSpeech.listening ? "⏹" : "🎤"}</span>
                <span className={styles.btnMain}>
                  {customerSpeech.listening ? "停止" : "話す"}
                </span>
                {customerLang !== "ja" && (
                  <span className={styles.btnSub}>
                    {customerSpeech.listening
                      ? uiLabel(customerLang, "stop")
                      : uiLabel(customerLang, "speak")}
                  </span>
                )}
              </button>
            )}
            <button
              className={styles.sendButton}
              onClick={() => send("customer")}
              disabled={loading !== null || !customerInput.trim()}
            >
              <span className={styles.btnIcon}>{loading === "customer" ? "⏳" : "🔄"}</span>
              <span className={styles.btnMain}>翻訳して伝える</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
