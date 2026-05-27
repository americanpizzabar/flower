"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./show.module.css";
import { SUPPORTED_LANGS, type VisualResult } from "@/lib/types";
import { useSpeechRecognition, speak } from "@/lib/speech";
import {
  isInAppCameraSupported,
  MAX_VIDEO_SECONDS,
  trimVideo,
  useInAppCamera,
  videoDuration,
} from "@/lib/video";

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
  const [trimming, setTrimming] = useState(false);
  const [error, setError] = useState("");
  const [cameraSupported, setCameraSupported] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const camera = useInAppCamera();

  useEffect(() => {
    setCameraSupported(isInAppCameraSupported());
  }, []);

  useEffect(() => {
    camera.onCapture((file) => {
      const kind: "image" | "video" = file.type.startsWith("video/") ? "video" : "image";
      const url = URL.createObjectURL(file);
      setMedia((prev) => [...prev, { file, url, kind }]);
    });
  }, [camera]);

  const speechLang = SUPPORTED_LANGS.find((l) => l.code === lang)?.speech || "en-US";
  const speech = useSpeechRecognition({
    lang: speechLang,
    onFinal: (t) => setWish((prev) => (prev ? `${prev} ${t}` : t)),
  });

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError("");
    const arr = Array.from(files);
    const next: MediaFile[] = [];

    for (const f of arr) {
      const isVideo = f.type.startsWith("video/");
      if (isVideo) {
        const sec = await videoDuration(f).catch(() => 0);
        if (sec > MAX_VIDEO_SECONDS + 0.5) {
          setTrimming(true);
          try {
            const trimmed = await trimVideo(f);
            next.push({
              file: trimmed,
              url: URL.createObjectURL(trimmed),
              kind: "video",
            });
          } catch (e) {
            setError(e instanceof Error ? e.message : "動画のトリミングに失敗しました");
          } finally {
            setTrimming(false);
          }
          continue;
        }
        next.push({ file: f, url: URL.createObjectURL(f), kind: "video" });
      } else {
        next.push({ file: f, url: URL.createObjectURL(f), kind: "image" });
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
      camera.close();
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
    camera.close();
    setStep("wish");
  }

  function backToCapture() {
    setResult(null);
    setStep("capture");
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

  return (
    <div>
      <h1>📸 花を撮って見せる</h1>
      <p className={styles.lead}>
        お客様の希望を聞いた上で、店内の花をカメラで撮影してご案内します。
      </p>

      <ol className={styles.stepper}>
        <li
          className={
            step === "wish"
              ? styles.active
              : step === "capture" || step === "result"
                ? styles.done
                : ""
          }
        >
          1. 希望を聞く
        </li>
        <li
          className={step === "capture" ? styles.active : step === "result" ? styles.done : ""}
        >
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
            店員さんがカメラで店内の花を撮影してください。<br />
            動画は最大 {MAX_VIDEO_SECONDS} 秒。超過分は自動でカットされます。
          </p>

          {/* In-app camera (preferred when supported) */}
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

          {/* Fallback / library */}
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

          {trimming && (
            <p className={styles.note}>動画を {MAX_VIDEO_SECONDS} 秒にトリミング中...</p>
          )}

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

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button
              className="ghost"
              onClick={() => {
                camera.close();
                setStep("wish");
              }}
            >
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
                <video
                  key={i}
                  src={m.url}
                  controls
                  playsInline
                  className={styles.bigMedia}
                />
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
