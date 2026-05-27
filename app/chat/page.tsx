"use client";

import { useState } from "react";
import styles from "./chat.module.css";
import type { InventoryItemWithFlower } from "@/lib/types";

interface Turn {
  role: "customer" | "staff";
  text: string;
  language?: string;
  language_name_ja?: string;
  translation_ja?: string;
  suggested?: InventoryItemWithFlower[];
  reason_ja?: string;
}

export default function ChatPage() {
  const [history, setHistory] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send() {
    if (!input.trim() || loading) return;
    const userText = input.trim();
    setInput("");
    setLoading(true);
    const newHistory: Turn[] = [...history, { role: "customer", text: userText }];
    setHistory(newHistory);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          history: history.map((h) => ({ role: h.role, text: h.text })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setHistory([
          ...newHistory,
          { role: "staff", text: `[エラー] ${data.error || "通信に失敗しました"}` },
        ]);
        return;
      }
      setHistory((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          language: data.detected_language,
          language_name_ja: data.language_name_ja,
          translation_ja: data.translated_for_staff_ja,
        };
        updated.push({
          role: "staff",
          text: data.reply_to_customer,
          suggested: data.suggested || [],
          reason_ja: data.reason_ja,
        });
        return updated;
      });
    } catch (e) {
      setHistory((prev) => [
        ...prev,
        { role: "staff", text: `[エラー] ${e instanceof Error ? e.message : "unknown"}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1>💬 接客チャット</h1>
      <p className={styles.lead}>
        お客様にタブレットを向けて、お客様の言葉で入力いただいてください。
      </p>

      <div className={styles.history}>
        {history.length === 0 && (
          <p className={styles.empty}>
            まだ会話はありません。下の入力欄にお客様の言葉を入れてください。
          </p>
        )}
        {history.map((t, i) => (
          <div
            key={i}
            className={t.role === "customer" ? styles.customerTurn : styles.staffTurn}
          >
            <div className={styles.bubble}>
              <div className={styles.role}>
                {t.role === "customer" ? "お客様" : "店員 (AI)"}
                {t.language_name_ja && <span className={styles.lang}>{t.language_name_ja}</span>}
              </div>
              <div className={styles.text}>{t.text}</div>
              {t.translation_ja && (
                <div className={styles.translation}>
                  <strong>店員向け訳:</strong> {t.translation_ja}
                </div>
              )}
              {t.reason_ja && <div className={styles.reason}>💡 {t.reason_ja}</div>}
              {t.suggested && t.suggested.length > 0 && (
                <div className={styles.cards}>
                  {t.suggested.map((s) => (
                    <FlowerCard
                      key={s.id}
                      item={s}
                      lang={
                        history
                          .slice()
                          .reverse()
                          .find((h) => h.language)?.language || "ja"
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.composer}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
          rows={3}
          placeholder="お客様の言葉を入力 (Ctrl/Cmd + Enter で送信) — 例: I'm looking for a gift for my mother..."
        />
        <button onClick={send} disabled={loading || !input.trim()}>
          {loading ? "送信中..." : "送信"}
        </button>
      </div>
    </div>
  );
}

function FlowerCard({ item, lang }: { item: InventoryItemWithFlower; lang: string }) {
  const name = item.flower.names[lang] || item.flower.names.ja || item.flower.names.en;
  const nameJa = item.flower.names.ja;
  const meanings = item.flower.meanings[lang] || item.flower.meanings.en || [];
  return (
    <div className={styles.flowerCard}>
      {item.photo_url ? (
        <img src={item.photo_url} alt={name} className={styles.photo} />
      ) : (
        <div className={styles.photoPlaceholder}>🌸</div>
      )}
      <div className={styles.flowerInfo}>
        <div className={styles.flowerName}>
          {name}
          {lang !== "ja" && nameJa && <span className={styles.subname}> / {nameJa}</span>}
        </div>
        <div className={styles.meaning}>{meanings.join(" · ")}</div>
        <div className={styles.meta}>
          {item.color && <span>{item.color}</span>}
          <span>在庫 {item.stock}本</span>
          {item.price && <span>¥{item.price}</span>}
        </div>
      </div>
    </div>
  );
}
