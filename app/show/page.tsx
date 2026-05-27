"use client";

import { useRef, useState } from "react";
import styles from "./show.module.css";
import { SUPPORTED_LANGS, type VisualResult } from "@/lib/types";
import { useSpeechRecognition, speak } from "@/lib/speech";

const MAX_VIDEO_SECONDS = 5;

interface MediaFile {
  file: File;
  url: string;
  kind: "image" | "video";
}

export default function ShowPage() {
  const [step, setStep] = useState<"wish" | "capture" | "result">("wish");
  const [lang, setLang] = useState("en");
  const [wish, setWish] = useState("");
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [result, setResult] = useState<VisualResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const speechLang = SUPPORTED_LANGS.find((l) => l.code === lang)?.speech || "en-US";
  const speech = useSpeechRecognition({
    lang: speechLang,
    onFinal: (t) => setWish((prev) => (prev ? `${prev} ${t}` : t)),
  });

  function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError("");
    const next: MediaFile[] = [];
    Array.from(files).forEach(async (f) => {
      const kind: "image" | "video" = f.type.startsWith("video/") ? "video" : "image";
      if (kind === "video") {
        const sec = await videoDuration(f).catch(() => 0);
        if (sec > MAX_VIDEO_SECONDS + 0.5) {
          setError(`動画は ${MAX_VIDEO_SECONDS} 秒以内にしてください (${sec.toFixed(1)}秒)`);
          return;
        }
      }
      next.push({ file: f, url: URL.createObjectURL(f), kind });
      if (next.length === files.length) {
        setMedia((prev) => [...prev, ...next]);
      }
    });
  }

  function removeMedia(idx: number) {
    setMedia((prev) => {
      const updated = prev.slice();
      URL.revokeObjectURL(updated[idx].url);
      updated.splice(idx, 1);
      return updated;
    });
  }

  async function submit() {
    if (!wish.trim() || media.length === 0) return;
    setLoading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("wish", wish);
      form.append("lang", lang);
      media.forEach((m) => form.append("media", m.file));
      const res = await fetch("/api/visual", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "失敗しました");
      setResult(data);
      setStep("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "通信エラー");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    media.forEach((m) => URL.revokeObjectURL(m.url));
    setMedia([]);
    setWish("");
    setResult(null);
    setError("");
    setStep("wish");
  }

  function backToCapture() {
    setResult(null);
    setStep("capture");
  }

  return (
    <div>
      <h1>📸 花を撮って見せる</h1>
      <p className={styles.lead}>
        お客様の希望を聞いた上で、店内の花をカメラで撮影してご案内します。
      </p>

      <ol className={styles.stepper}>
        <li className={step === "wish" ? styles.active : step === "capture" || step === "result" ? styles.done : ""}>
          1. 希望を聞く
        </li>
        <li className={step === "capture" ? styles.active : step === "result" ? styles.done : ""}>
          2. 花を撮る
        </li>
        <li className={step === "result" ? styles.active : ""}>3. お客様に見せる</li>
      </ol>

      {step === "wish" && (
        <div className={styles.card}>
          <label>お客様の言語</label>
          <select value={lang} onChange={(e) => setLang(e.target.value)}>
            {SUPPORTED_LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label_ja} ({l.code})
              </option>
            ))}
          </select>

          <label className={styles.mt}>お客様の希望</label>
          <textarea
            value={wish + (speech.interim ? ` ${speech.interim}` : "")}
            onChange={(e) => setWish(e.target.value)}
            rows={5}
            placeholder="例: I want something pink and elegant for an anniversary..."
          />

          <div className={styles.actions}>
            {speech.supported &&
              (speech.listening ? (
                <button className="ghost" onClick={speech.stop}>
                  ⏹ 停止
                </button>
              ) : (
                <button className="ghost" onClick={speech.start}>
                  🎤 音声で入力
                </button>
              ))}
            <button onClick={() => setStep("capture")} disabled={!wish.trim()}>
              次へ: 花を撮る
            </button>
          </div>
        </div>
      )}

      {step === "capture" && (
        <div className={styles.card}>
          <p className={styles.note}>
            店員さんがスマホ・タブレットのカメラで店内の花を撮影してください。<br />
            動画は最大 {MAX_VIDEO_SECONDS} 秒、合計 18MB まで。
          </p>

          <div className={styles.captureRow}>
            <button
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.accept = "image/*";
                  fileInputRef.current.removeAttribute("capture");
                  fileInputRef.current.setAttribute("capture", "environment");
                  fileInputRef.current.click();
                }
              }}
            >
              📷 写真を撮る
            </button>
            <button
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.accept = "video/*";
                  fileInputRef.current.setAttribute("capture", "environment");
                  fileInputRef.current.click();
                }
              }}
            >
              🎥 動画を撮る ({MAX_VIDEO_SECONDS}秒以内)
            </button>
            <button
              className="ghost"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.accept = "image/*,video/*";
                  fileInputRef.current.removeAttribute("capture");
                  fileInputRef.current.click();
                }
              }}
            >
              📁 ライブラリから選ぶ
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={(e) => onFiles(e.target.files)}
          />

          {media.length > 0 && (
            <div className={styles.previewGrid}>
              {media.map((m, i) => (
                <div key={i} className={styles.preview}>
                  {m.kind === "image" ? (
                    <img src={m.url} alt="" />
                  ) : (
                    <video src={m.url} controls />
                  )}
                  <button className={styles.removeBtn} onClick={() => removeMedia(i)}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button className="ghost" onClick={() => setStep("wish")}>
              ← 戻る
            </button>
            <button onClick={submit} disabled={loading || media.length === 0}>
              {loading ? "AI 解析中..." : "お客様に見せる"}
            </button>
          </div>
        </div>
      )}

      {step === "result" && result && (
        <div className={styles.result}>
          <div className={styles.mediaShow}>
            {media.map((m, i) =>
              m.kind === "image" ? (
                <img key={i} src={m.url} alt="" className={styles.bigMedia} />
              ) : (
                <video key={i} src={m.url} controls className={styles.bigMedia} />
              ),
            )}
          </div>

          <div className={styles.customerBox}>
            <div className={styles.tagRow}>
              <span className={styles.langTag}>{result.language_name_ja}</span>
            </div>
            <h2>お客様へ</h2>
            <p className={styles.bigText}>{result.description_for_customer}</p>
            <button
              className="ghost"
              onClick={() => speak(result.description_for_customer, speechLang)}
            >
              🔊 読み上げる
            </button>

            <p className={styles.followUp}>{result.follow_up_to_customer}</p>
            <button
              className="ghost"
              onClick={() => speak(result.follow_up_to_customer, speechLang)}
            >
              🔊 質問を読み上げる
            </button>
          </div>

          <details className={styles.staffBox}>
            <summary>店員向けメモ (日本語)</summary>
            <p>
              <strong>写っているもの:</strong> {result.what_we_see_ja}
            </p>
            <p>
              <strong>希望との合致度:</strong> {result.match_assessment_ja}
            </p>
          </details>

          <div className={styles.bottomActions}>
            <button className="ghost" onClick={backToCapture}>
              ← 別の花を撮る
            </button>
            <button onClick={reset}>最初から</button>
          </div>
        </div>
      )}
    </div>
  );
}

function videoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(v.duration);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("video metadata error"));
    };
    v.src = url;
  });
}

