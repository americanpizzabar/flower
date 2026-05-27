"use client";

import { useEffect, useState } from "react";
import styles from "./inventory.module.css";
import type { Flower, InventoryItemWithFlower } from "@/lib/types";

export default function InventoryPage() {
  const [flowers, setFlowers] = useState<Flower[]>([]);
  const [items, setItems] = useState<InventoryItemWithFlower[]>([]);
  const [filter, setFilter] = useState<"today" | "in_stock" | "all">("in_stock");
  const [loading, setLoading] = useState(false);

  const [flowerId, setFlowerId] = useState<string>("");
  const [color, setColor] = useState("");
  const [stock, setStock] = useState("");
  const [receivedAt, setReceivedAt] = useState(new Date().toISOString().slice(0, 10));
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadFlowers() {
    const res = await fetch("/api/flowers");
    if (res.ok) setFlowers(await res.json());
  }

  async function loadItems() {
    setLoading(true);
    const param = filter === "in_stock" ? "" : `?filter=${filter}`;
    const res = await fetch(`/api/inventory${param}`);
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    loadFlowers();
  }, []);

  useEffect(() => {
    loadItems();
  }, [filter]);

  async function uploadPhoto(file: File) {
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "アップロード失敗");
      setPhotoUrl(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown");
    } finally {
      setUploading(false);
    }
  }

  async function addItem() {
    if (!flowerId) {
      setError("花を選択してください");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flower_id: Number(flowerId),
          color: color || null,
          stock: Number(stock || 0),
          received_at: receivedAt,
          price: price ? Number(price) : null,
          photo_url: photoUrl || null,
          note: note || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "登録失敗");
      }
      setFlowerId("");
      setColor("");
      setStock("");
      setPrice("");
      setNote("");
      setPhotoUrl("");
      await loadItems();
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown");
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(id: number) {
    if (!confirm("削除しますか？")) return;
    await fetch(`/api/inventory/${id}`, { method: "DELETE" });
    await loadItems();
  }

  async function updateStock(id: number, stock: number) {
    await fetch(`/api/inventory/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stock }),
    });
    await loadItems();
  }

  return (
    <div>
      <h1>📦 在庫管理</h1>

      <section className={styles.addForm}>
        <h2>新しい入荷を登録</h2>
        <div className={styles.row}>
          <div className={styles.grow}>
            <label>花の種類 *</label>
            <select value={flowerId} onChange={(e) => setFlowerId(e.target.value)}>
              <option value="">選択してください</option>
              {flowers.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.names.ja} ({f.names.en})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>色</label>
            <input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="red, pink, white..."
            />
          </div>
          <div>
            <label>本数</label>
            <input
              type="number"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="20"
            />
          </div>
        </div>

        <div className={styles.row}>
          <div>
            <label>入荷日</label>
            <input
              type="date"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
            />
          </div>
          <div>
            <label>価格 (1本あたり 円)</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="350"
            />
          </div>
          <div className={styles.grow}>
            <label>メモ</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例: 朝採れ、香り強い、贈答向き"
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.grow}>
            <label>写真</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadPhoto(f);
              }}
            />
            {uploading && <p className={styles.uploading}>アップロード中...</p>}
            {photoUrl && (
              <img src={photoUrl} alt="プレビュー" className={styles.preview} />
            )}
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button onClick={addItem} disabled={saving || uploading}>
          {saving ? "登録中..." : "在庫に追加"}
        </button>
      </section>

      <section className={styles.list}>
        <div className={styles.filters}>
          <button
            className={filter === "today" ? "" : "ghost"}
            onClick={() => setFilter("today")}
          >
            本日の入荷
          </button>
          <button
            className={filter === "in_stock" ? "" : "ghost"}
            onClick={() => setFilter("in_stock")}
          >
            在庫あり
          </button>
          <button
            className={filter === "all" ? "" : "ghost"}
            onClick={() => setFilter("all")}
          >
            すべて
          </button>
        </div>

        {loading ? (
          <p>読み込み中...</p>
        ) : items.length === 0 ? (
          <p className={styles.empty}>表示する在庫がありません。</p>
        ) : (
          <div className={styles.cards}>
            {items.map((item) => (
              <div key={item.id} className={styles.card}>
                {item.photo_url ? (
                  <img src={item.photo_url} alt={item.flower.names.ja} className={styles.photo} />
                ) : (
                  <div className={styles.photoPlaceholder}>🌸</div>
                )}
                <div className={styles.info}>
                  <div className={styles.name}>{item.flower.names.ja}</div>
                  <div className={styles.meta}>
                    {item.color && <span className={styles.tag}>{item.color}</span>}
                    <span>入荷: {item.received_at.slice(0, 10)}</span>
                    {item.price && <span>¥{item.price}/本</span>}
                  </div>
                  <div className={styles.stockRow}>
                    <label>在庫</label>
                    <input
                      type="number"
                      defaultValue={item.stock}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== item.stock) updateStock(item.id, v);
                      }}
                    />
                    <span>本</span>
                  </div>
                  {item.note && <div className={styles.note}>{item.note}</div>}
                  <button
                    className="ghost"
                    onClick={() => deleteItem(item.id)}
                    style={{ marginTop: 8 }}
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
