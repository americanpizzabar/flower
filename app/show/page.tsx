"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./show.module.css";
import {
  SUPPORTED_LANGS,
  uiLabel,
  type ConsultTurn,
  type ProposalResult,
  type VisualBriefResult,
} from "@/lib/types";
import { useSpeechRecognition, speak } from "@/lib/speech";
import {
  captureVideoFrame,
  compressImage,
  isInAppCameraSupported,
  MAX_VIDEO_SECONDS,
  trimVideo,
  useInAppCamera,
  videoDuration,
} from "@/lib/video";

type Step = "hearing" | "capture" | "result";

interface MediaFile {
  file: File;
  url: string;
  kind: "image" | "video";
}

interface ChatTurn {
  role: "customer" | "assistant";
  text: string;
}

export default function ShowPage() {
  const [step, setStep] = useState<Step>("hearing");
  const [lang, setLang] = useState("en");

  // Hearing
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [brief, setBrief] = useState<VisualBriefResult | null>(null);
  const [hearLoading, setHearLoading] = useState(false);
  const [staffAsk, setStaffAsk] = useState("");
  const [asking, setAsking] = useState(false);

  // Capture
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [trimming, setTrimming] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(false);
  const [captureComment, setCaptureComment] = useState("");
  const [commenting, setCommenting] = useState(false);

  // Generate
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<ProposalResult | null>(null);

  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const camera = useInAppCamera();

  useEffect(() => {
    setCameraSupported(isInAppCameraSupported());
  }, []);

  useEffect(() => {
    camera.onCapture(async (file) => {
      if (file.type.startsWith("video/")) {
        const url = URL.createObjectURL(file);
        setMedia((prev) => [...prev, { file, url, kind: "video" }]);
        return;
      }
      const compressed = await compressImage(file).catch(() => file);
      const url = URL.createObjectURL(compressed);
      setMedia((prev) => [...prev, { file: compressed, url, kind: "image" }]);
    });
  }, [camera]);

  const speechLang = SUPPORTED_LANGS.find((l) => l.code === lang)?.speech || "en-US";
  const speech = useSpeechRecognition({
    lang: speechLang,
    onFinal: (t) => setInput((prev) => (prev ? `${prev} ${t}` : t)),
  });

  async function sendHearing() {
    const text = input.trim();
    if (!text || hearLoading) return;
    setInput("");
    setError("");
    setHearLoading(true);
    const history: ConsultTurn[] = turns.map((t) => ({ role: t.role, text: t.text }));
    setTurns((prev) => [...prev, { role: "customer", text }]);
    try {
      const res = await fetch("/api/visual/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, history, lang }),
      });
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        const t = await res.text();
        throw new Error(`サーバーから予期しない応答 (HTTP ${res.status}): ${t.slice(0, 120)}`);
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "失敗しました");
      const b = data as VisualBriefResult;
      setBrief(b);
      setTurns((prev) => [...prev, { role: "assistant", text: b.reply_to_customer }]);
      speak(b.reply_to_customer, speechLang);
    } catch (e) {
      setError(e instanceof Error ? e.message : "通信エラー");
      setTurns((prev) => prev.slice(0, -1));
      setInput(text);
    } finally {
      setHearLoading(false);
    }
  }

  // Staff asks a question during hearing (Japanese -> customer language, added to chat)
  async function askInHearing() {
    const customJa = staffAsk.trim();
    if (!customJa || asking) return;
    setError("");
    setAsking(true);
    try {
      const history: ConsultTurn[] = turns.map((t) => ({ role: t.role, text: t.text }));
      const res = await fetch("/api/consult/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "custom", custom_ja: customJa, lang, history }),
      });
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        const t = await res.text();
        throw new Error(`サーバーから予期しない応答 (HTTP ${res.status}): ${t.slice(0, 120)}`);
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "失敗しました");
      setTurns((prev) => [...prev, { role: "assistant", text: data.question_customer_lang }]);
      setStaffAsk("");
      speak(data.question_customer_lang, speechLang);
    } catch (e) {
      setError(e instanceof Error ? e.message : "通信エラー");
    } finally {
      setAsking(false);
    }
  }

  // Staff says something to the customer during capture (Japanese -> customer language,
  // spoken and recorded in the conversation so it feeds the generation brief).
  async function sayInCapture() {
    const text = captureComment.trim();
    if (!text || commenting) return;
    setError("");
    setCommenting(true);
    try {
      const res = await fetch("/api/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, source_hint: "ja", target_lang: lang }),
      });
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        const t = await res.text();
        throw new Error(`サーバーから予期しない応答 (HTTP ${res.status}): ${t.slice(0, 120)}`);
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "失敗しました");
      setTurns((prev) => [...prev, { role: "assistant", text: data.translation }]);
      setCaptureComment("");
      speak(data.translation, speechLang);
    } catch (e) {
      setError(e instanceof Error ? e.message : "通信エラー");
    } finally {
      setCommenting(false);
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError("");
    const arr = Array.from(files);
    const next: MediaFile[] = [];
    for (const f of arr) {
      if (f.type.startsWith("video/")) {
        const sec = await videoDuration(f).catch(() => 0);
        if (sec > MAX_VIDEO_SECONDS + 0.5) {
          setTrimming(true);
          try {
            const trimmed = await trimVideo(f);
            next.push({ file: trimmed, url: URL.createObjectURL(trimmed), kind: "video" });
          } catch (e) {
            setError(e instanceof Error ? e.message : "動画のトリミングに失敗しました");
          } finally {
            setTrimming(false);
          }
          continue;
        }
        next.push({ file: f, url: URL.createObjectURL(f), kind: "video" });
      } else {
        const compressed = await compressImage(f).catch(() => f);
        next.push({ file: compressed, url: URL.createObjectURL(compressed), kind: "image" });
      }
    }
    if (next.length > 0) setMedia((prev) => [...prev, ...next]);
  }

  function removeMedia(idx: number) {
    setMedia((prev) => {
      const updated = prev.slice();
      URL.revokeObjectURL(updated[idx].url);
      updated.splice(idx, 1);
      return updated;
    });
  }

  function briefText(): string {
    const parts: string[] = [];
    if (brief) {
      if (brief.brief_ja) parts.push(brief.brief_ja);
      if (brief.flower_language_ja) parts.push(`花言葉: ${brief.flower_language_ja}`);
    }
    if (turns.length > 0) {
      const convo = turns
        .map((t) => `${t.role === "customer" ? "お客様" : "店員"}: ${t.text}`)
        .join("\n");
      parts.push(`これまでのやりとり:\n${convo}`);
    }
    return parts.length > 0 ? parts.join("\n\n") : turns.map((t) => t.text).join(" / ");
  }

  async function generate() {
    if (media.length === 0) {
      setError("組み合わせ画像の生成には花の写真または動画が必要です。1つ以上追加してください。");
      return;
    }
    setGenerating(true);
    setError("");
    camera.close();
    try {
      // Photos go in directly; videos contribute a representative still frame
      // so the flowers shown in the video are honored in the generation input.
      const photoFiles: File[] = media.filter((m) => m.kind === "image").map((m) => m.file);
      const videoMedia = media.filter((m) => m.kind === "video");
      for (const v of videoMedia) {
        try {
          const frame = await captureVideoFrame(v.file);
          const compressed = await compressImage(frame).catch(() => frame);
          photoFiles.push(compressed);
        } catch {
          /* skip frames we can't extract */
        }
      }
      if (photoFiles.length === 0) {
        throw new Error("写真または動画から花の画像を取得できませんでした。");
      }

      const totalMb = photoFiles.reduce((s, f) => s + f.size, 0) / (1024 * 1024);
      if (totalMb > 4) {
        throw new Error(
          `画像の合計サイズが ${totalMb.toFixed(1)}MB です。上限 (4MB) を超えるため枚数を減らしてください。`,
        );
      }
      const form = new FormData();
      form.append("brief", briefText());
      form.append("lang", lang);
      photoFiles.forEach((f) => form.append("media", f));
      const res = await fetch("/api/visual/generate", { method: "POST", body: form });

      if (res.status === 413) {
        throw new Error("写真の合計サイズが大きすぎます。枚数を減らしてください。");
      }
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        const t = await res.text();
        throw new Error(`サーバーから予期しない応答 (HTTP ${res.status}): ${t.slice(0, 120)}`);
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "失敗しました");
      setResult(data as ProposalResult);
      setStep("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "通信エラー");
    } finally {
      setGenerating(false);
    }
  }

  function reset() {
    media.forEach((m) => URL.revokeObjectURL(m.url));
    setMedia([]);
    setTurns([]);
    setBrief(null);
    setInput("");
    setStaffAsk("");
    setCaptureComment("");
    setResult(null);
    setError("");
    camera.close();
    setStep("hearing");
  }

  function openLibrary() {
    if (fileInputRef.current) {
      fileInputRef.current.accept = "image/*,video/*";
      fileInputRef.current.removeAttribute("capture");
      fileInputRef.current.click();
    }
  }

  function openOsCamera(kind: "image" | "video") {
    if (fileInputRef.current) {
      fileInputRef.current.accept = kind === "image" ? "image/*" : "video/*";
      fileInputRef.current.setAttribute("capture", "environment");
      fileInputRef.current.click();
    }
  }

  function renderChat() {
    if (turns.length === 0) return null;
    return (
      <div className={styles.chat}>
        {turns.map((t, i) => (
          <div
            key={i}
            className={t.role === "customer" ? styles.customerRow : styles.assistantRow}
          >
            <div className={styles.bubble}>
              <div className={styles.bubbleRole}>{t.role === "customer" ? "お客様" : "AI / 店員"}</div>
              <div>{t.text}</div>
              {t.role === "assistant" && (
                <button
                  className="ghost"
                  style={{ marginTop: 6, padding: "4px 10px", fontSize: "0.85rem" }}
                  onClick={() => speak(t.text, speechLang)}
                >
                  🔊 読み上げ
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <h1>📸 花を見せる（組み合わせ提案）</h1>
      <p className={styles.lead}>
        お客様の要望を花言葉も含めて伺い、店内の花を撮影すると、AI
        が組み合わせの提案画像を生成します。
      </p>

      <ol className={styles.stepper}>
        <li className={step === "hearing" ? styles.active : styles.done}>1. 要望を伺う</li>
        <li
          className={step === "capture" ? styles.active : step === "result" ? styles.done : ""}
        >
          2. 花を撮る
        </li>
        <li className={step === "result" ? styles.active : ""}>3. 提案画像を見せる</li>
      </ol>

      {/* Step 1: hearing */}
      {step === "hearing" && (
        <div className={styles.card}>
          {turns.length === 0 && (
            <>
              <label>お客様の言語</label>
              <select value={lang} onChange={(e) => setLang(e.target.value)}>
                {SUPPORTED_LANGS.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label_ja} ({l.code})
                  </option>
                ))}
              </select>
            </>
          )}

          {renderChat()}

          <label className={styles.mt}>
            {turns.length === 0 ? "お客様の要望（花言葉や雰囲気など）" : "お客様の返事"}
          </label>
          <textarea
            value={input + (speech.interim ? ` ${speech.interim}` : "")}
            onChange={(e) => setInput(e.target.value)}
            rows={4}
            placeholder="例: A romantic red bouquet for a wedding anniversary, meaning deep love..."
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
            <button onClick={sendHearing} disabled={hearLoading || !input.trim()}>
              {hearLoading ? "整理中..." : "送信"}
            </button>
          </div>

          {turns.length > 0 && (
            <div className={styles.askBox}>
              <div className={styles.askLabel}>
                店員さんから質問・コメント（日本語で入力 → お客様の言語に翻訳して伝えます）
              </div>
              <div className={styles.customAskRow}>
                <input
                  value={staffAsk}
                  onChange={(e) => setStaffAsk(e.target.value)}
                  placeholder="例: ご予算はどのくらいですか？ / 季節のお花もおすすめできます"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && staffAsk.trim()) {
                      e.preventDefault();
                      askInHearing();
                    }
                  }}
                />
                <button onClick={askInHearing} disabled={asking || !staffAsk.trim()}>
                  {asking ? "..." : "お客様へ"}
                </button>
              </div>
            </div>
          )}

          {brief && (
            <div className={styles.briefBox}>
              <div className={styles.briefTitle}>📋 ここまでの要望（店員向け）</div>
              <p>{brief.brief_ja}</p>
              {brief.flower_language_ja && (
                <p className={styles.flowerLang}>🌸 花言葉: {brief.flower_language_ja}</p>
              )}
              {brief.follow_up_ja && (
                <p className={styles.nextHint}>次の確認（日本語）: {brief.follow_up_ja}</p>
              )}
            </div>
          )}

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button onClick={() => setStep("capture")} disabled={!brief}>
              次へ: 花を撮る →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: capture */}
      {step === "capture" && (
        <div className={styles.card}>
          <p className={styles.note}>
            店内の花を撮影 / アップロードしてください。複数の花を組み合わせた提案画像を生成します。
            <br />
            写真・動画どちらも使えます（動画は代表フレームを使用）。生成画像には、写したお花だけが使われます。
          </p>

          {cameraSupported && (
            <div className={styles.cameraBlock}>
              {!camera.isOpen ? (
                <button onClick={camera.open}>📷 カメラを起動する</button>
              ) : (
                <>
                  <div className={styles.cameraWrap}>
                    <video
                      ref={camera.videoRef}
                      autoPlay
                      playsInline
                      muted
                      className={styles.cameraPreview}
                    />
                    {camera.isRecording && (
                      <div className={styles.recBadge}>
                        ● 録画中 {camera.elapsedSec.toFixed(1)}s / {MAX_VIDEO_SECONDS}s
                      </div>
                    )}
                  </div>
                  <div className={styles.cameraActions}>
                    {!camera.isRecording ? (
                      <>
                        <button onClick={() => camera.takePhoto()}>📷 写真</button>
                        <button onClick={camera.startRecording}>
                          🎥 録画 (最大 {MAX_VIDEO_SECONDS}秒)
                        </button>
                        <button className="ghost" onClick={camera.close}>
                          閉じる
                        </button>
                      </>
                    ) : (
                      <button onClick={camera.stopRecording}>⏹ 録画停止</button>
                    )}
                  </div>
                  {camera.error && <p className={styles.error}>{camera.error}</p>}
                </>
              )}
            </div>
          )}

          <div className={styles.fallbackRow}>
            {!cameraSupported && (
              <>
                <button onClick={() => openOsCamera("image")}>📷 写真を撮る</button>
                <button onClick={() => openOsCamera("video")}>🎥 動画を撮る</button>
              </>
            )}
            <button className="ghost" onClick={openLibrary}>
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

          {trimming && <p className={styles.note}>動画を {MAX_VIDEO_SECONDS} 秒にトリミング中...</p>}

          {media.length > 0 && (
            <div className={styles.previewGrid}>
              {media.map((m, i) => (
                <div key={i} className={styles.preview}>
                  {m.kind === "image" ? (
                    <img src={m.url} alt="" />
                  ) : (
                    <video src={m.url} controls playsInline />
                  )}
                  <button className={styles.removeBtn} onClick={() => removeMedia(i)}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className={styles.askBox}>
            <div className={styles.askLabel}>
              やりとり（この内容も提案画像の要件に反映されます）
            </div>

            {renderChat()}

            {/* Customer input (language carried over from the previous screen) */}
            <label className={styles.mt}>お客様の入力 / 音声</label>
            <textarea
              value={input + (speech.interim ? ` ${speech.interim}` : "")}
              onChange={(e) => setInput(e.target.value)}
              rows={2}
              placeholder="お客様: 例) I'd prefer the lighter pink ones..."
            />
            <div className={styles.actions}>
              {speech.supported &&
                (speech.listening ? (
                  <button className="ghost" onClick={speech.stop}>
                    ⏹ 停止
                  </button>
                ) : (
                  <button className="ghost" onClick={speech.start}>
                    🎤 お客様が音声入力
                  </button>
                ))}
              <button onClick={sendHearing} disabled={hearLoading || !input.trim()}>
                {hearLoading ? "整理中..." : "お客様の発言を送信"}
              </button>
            </div>

            {/* Staff comment (Japanese -> customer language) */}
            <div className={styles.customAskRow} style={{ marginTop: 8 }}>
              <input
                value={captureComment}
                onChange={(e) => setCaptureComment(e.target.value)}
                placeholder="店員から一言（日本語）例: こちらのバラはいかがですか？"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && captureComment.trim()) {
                    e.preventDefault();
                    sayInCapture();
                  }
                }}
              />
              <button onClick={sayInCapture} disabled={commenting || !captureComment.trim()}>
                {commenting ? "..." : "お客様へ"}
              </button>
            </div>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button
              className="ghost"
              onClick={() => {
                camera.close();
                setStep("hearing");
              }}
            >
              ← 戻る
            </button>
            <button onClick={generate} disabled={generating || media.length === 0}>
              {generating ? "提案画像を生成中..." : "✨ 提案画像を生成"}
            </button>
          </div>

          {generating && (
            <p className={styles.note}>
              AI が花を組み合わせた提案画像を作成しています（数秒〜十数秒かかります）...
            </p>
          )}
        </div>
      )}

      {/* Step 3: result */}
      {step === "result" && result && (
        <div className={styles.result}>
          <img src={result.image_data_url} alt="提案アレンジ" className={styles.generatedImage} />

          <div className={styles.customerBox}>
            <h2>お客様へ</h2>
            <p className={styles.bigText}>{result.description_customer}</p>
            <button
              className="ghost"
              onClick={() => speak(result.description_customer, speechLang)}
            >
              🔊 読み上げる
            </button>
          </div>

          {!result.verified && result.unverified_note_ja && (
            <p className={styles.warn}>⚠️ {result.unverified_note_ja}</p>
          )}

          <details className={styles.staffBox} open>
            <summary>店員向け（日本語）</summary>
            <p>{result.description_ja}</p>
            {result.used_flowers_ja && (
              <p className={styles.flowerLang}>
                📷 写真から使用した花: {result.used_flowers_ja}
              </p>
            )}
            {result.flower_meanings_ja && (
              <p className={styles.flowerLang}>🌸 花言葉: {result.flower_meanings_ja}</p>
            )}
          </details>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.bottomActions}>
            <button className="ghost" onClick={() => setStep("capture")}>
              ← 花を撮り直す
            </button>
            <button className="ghost" onClick={generate} disabled={generating}>
              {generating ? "生成中..." : "🔁 別の組み合わせを生成"}
            </button>
            <button onClick={reset}>最初から</button>
          </div>
        </div>
      )}
    </div>
  );
}
