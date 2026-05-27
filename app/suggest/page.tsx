"use client";

import { useState } from "react";
import styles from "./suggest.module.css";
import type { InventoryItemWithFlower } from "@/lib/types";

export default function SuggestPage() {
  const [month, setMonth] = useState<string>("");
  const [day, setDay] = useState<string>("");
  const [keyword, setKeyword] = useState("");
  const [color, setColor] = useState("");
  const [budget, setBudget] = useState("");
  const [todayOnly, setTodayOnly] = useState(false);
  const [preferSeasonal, setPreferSeasonal] = useState(true);

  const [matches, setMatches] = useState<InventoryItemWithFlower[]>([]);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function search() {
    setLoading(true);
    setSubmitted(true);
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: month ? Number(month) : undefined,
          day: day ? Number(day) : undefined,
          keyword: keyword || undefined,
          color: color || undefined,
          budget: budget ? Number(budget) : undefined,
          todayOnly,
          preferSeasonal,
        }),
      });
      const data = await res.json();
      setMatches(data.matches || []);
      setComment(data.comment_ja || "");
    } catch (e) {
      setComment(`エラー: ${e instanceof Error ? e.message : "unknown"}`);
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1>🎂 花を提案</h1>
      <p className={styles.lead}>
        誕生日、花言葉、色、ご予算からお選びください。在庫から最適な花を絞り込みます。
      </p>

      <div className={styles.form}>
        <div className={styles.row}>
          <div>
            <label>誕生日 — 月</label>
            <input
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              placeholder="6"
            />
          </div>
          <div>
            <label>誕生日 — 日</label>
            <input
              type="number"
              min={1}
              max={31}
              value={day}
              onChange={(e) => setDay(e.target.value)}
              placeholder="15"
            />
          </div>
          <div>
            <label>色</label>
            <select value={color} onChange={(e) => setColor(e.target.value)}>
              <option value="">指定なし</option>
              <option value="red">赤</option>
              <option value="pink">ピンク</option>
              <option value="white">白</option>
              <option value="yellow">黄色</option>
              <option value="orange">オレンジ</option>
              <option value="purple">紫</option>
              <option value="blue">青</option>
            </select>
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.grow}>
            <label>花言葉 / 用途 (キーワード)</label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="例: 感謝、母の日、卒業祝い、友情..."
            />
          </div>
          <div>
            <label>予算 (1本あたり 円)</label>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="500"
            />
          </div>
        </div>

        <div className={styles.toggles}>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={todayOnly}
              onChange={(e) => setTodayOnly(e.target.checked)}
            />
            本日の入荷のみ
          </label>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={preferSeasonal}
              onChange={(e) => setPreferSeasonal(e.target.checked)}
            />
            旬の花を優先
          </label>
        </div>

        <button onClick={search} disabled={loading}>
          {loading ? "検索中..." : "提案を見る"}
        </button>
      </div>

      {submitted && !loading && (
        <div className={styles.results}>
          {comment && <p className={styles.comment}>💡 {comment}</p>}
          {matches.length === 0 ? (
            <p className={styles.empty}>該当する花が在庫にありませんでした。</p>
          ) : (
            <div className={styles.cards}>
              {matches.map((m) => (
                <FlowerResultCard key={m.id} item={m} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FlowerResultCard({ item }: { item: InventoryItemWithFlower }) {
  return (
    <div className={styles.card}>
      {item.photo_url ? (
        <img src={item.photo_url} alt={item.flower.names.ja} className={styles.photo} />
      ) : (
        <div className={styles.photoPlaceholder}>🌸</div>
      )}
      <div className={styles.info}>
        <div className={styles.name}>{item.flower.names.ja}</div>
        <div className={styles.meaning}>{(item.flower.meanings.ja || []).join(" · ")}</div>
        <div className={styles.meta}>
          {item.color && <span className={styles.tag}>{item.color}</span>}
          <span>在庫 {item.stock}本</span>
          {item.price && <span>¥{item.price}/本</span>}
        </div>
        {item.flower.notes && <div className={styles.notes}>{item.flower.notes}</div>}
      </div>
    </div>
  );
}
