"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface MediaRecorderLike {
  start: (timeslice?: number) => void;
  stop: () => void;
  state: string;
  ondataavailable: ((e: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  onerror: ((e: unknown) => void) | null;
}

interface MediaRecorderCtor {
  new (stream: MediaStream, options?: { mimeType?: string; audioBitsPerSecond?: number }): MediaRecorderLike;
  isTypeSupported?: (mime: string) => boolean;
}

function getMediaRecorderCtor(): MediaRecorderCtor | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { MediaRecorder?: MediaRecorderCtor }).MediaRecorder || null;
}

function pickAudioMime(): string | undefined {
  const MR = getMediaRecorderCtor();
  if (!MR || !MR.isTypeSupported) return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  for (const c of candidates) {
    if (MR.isTypeSupported(c)) return c;
  }
  return undefined;
}

/**
 * Microphone capture + transcription.
 *
 * We deliberately do NOT use the streaming Web Speech API (webkitSpeechRecognition):
 * its recognition engine has an unavoidable cold-start window during which the
 * first ~1 second of audio is silently dropped, and there is no event that tells
 * us when it is actually ready. That is why the opening words kept getting lost.
 *
 * Instead we record raw audio with MediaRecorder — which captures every sample
 * from the very first millisecond — and transcribe the finished clip with Gemini
 * (POST /api/transcribe). Nothing at the start is dropped.
 *
 * The returned shape is unchanged so callers don't need to change:
 *   { listening, interim, supported, start, stop }
 * `interim` now surfaces a status hint ("聞き取り中…") while transcribing.
 */
export function useSpeechRecognition(opts: {
  lang: string;
  onFinal?: (text: string) => void;
  onError?: (error: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [supported, setSupported] = useState(true);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorderLike | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef<string | undefined>(undefined);
  const cancelledRef = useRef(false);

  const langRef = useRef(opts.lang);
  const onFinalRef = useRef(opts.onFinal);
  const onErrorRef = useRef(opts.onError);

  useEffect(() => {
    langRef.current = opts.lang;
    onFinalRef.current = opts.onFinal;
    onErrorRef.current = opts.onError;
  }, [opts.lang, opts.onFinal, opts.onError]);

  useEffect(() => {
    setSupported(
      typeof navigator !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        getMediaRecorderCtor() !== null,
    );
  }, []);

  // Release the mic when the component unmounts.
  useEffect(() => {
    return () => {
      try {
        if (recorderRef.current && recorderRef.current.state !== "inactive") {
          cancelledRef.current = true;
          recorderRef.current.stop();
        }
      } catch {
        /* ignore */
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  async function transcribe(blob: Blob) {
    if (blob.size === 0) {
      setInterim("");
      return;
    }
    setInterim("聞き取り中…");
    try {
      const form = new FormData();
      const ext = (mimeRef.current || "audio/webm").includes("mp4") ? "mp4" : "webm";
      form.append("audio", new File([blob], `speech.${ext}`, { type: mimeRef.current || "audio/webm" }));
      // Send the broad language part as a hint (e.g. "en-US" -> "en"); the model
      // still auto-detects if the speaker uses a different language.
      form.append("lang", (langRef.current || "auto").split("-")[0]);
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        const t = await res.text();
        throw new Error(`サーバーから予期しない応答 (HTTP ${res.status}): ${t.slice(0, 120)}`);
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "音声を認識できませんでした");
      const text = (data.transcript || "").trim();
      if (text) onFinalRef.current?.(text);
    } catch (e) {
      onErrorRef.current?.(e instanceof Error ? e.message : "音声認識に失敗しました");
    } finally {
      setInterim("");
    }
  }

  const start = useCallback(async () => {
    const MR = getMediaRecorderCtor();
    if (!MR || !navigator.mediaDevices?.getUserMedia) {
      setSupported(false);
      return;
    }
    if (listening) return;
    cancelledRef.current = false;
    setInterim("");
    try {
      const stream =
        streamRef.current ||
        (await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        }));
      streamRef.current = stream;

      const mime = pickAudioMime();
      mimeRef.current = mime;
      const recorder = new MR(stream, {
        ...(mime ? { mimeType: mime } : {}),
        audioBitsPerSecond: 96_000,
      });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        setListening(false);
        const blob = new Blob(chunksRef.current, { type: mime || "audio/webm" });
        chunksRef.current = [];
        if (!cancelledRef.current) void transcribe(blob);
      };
      recorder.onerror = (err) => {
        setListening(false);
        onErrorRef.current?.(`録音でエラーが発生しました: ${String(err)}`);
      };

      // Capturing starts immediately — the first word is recorded from t=0.
      recorder.start();
      recorderRef.current = recorder;
      setListening(true);
    } catch (e) {
      setListening(false);
      const msg = e instanceof Error ? e.message : "マイクを起動できませんでした";
      onErrorRef.current?.(
        /permission|denied|notallowed/i.test(msg)
          ? "マイクへのアクセスが許可されませんでした。ブラウザの設定でマイクを許可してください。"
          : msg,
      );
    }
  }, [listening]);

  const stop = useCallback(() => {
    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop(); // -> onstop -> transcribe()
      }
    } catch {
      /* ignore */
    }
  }, []);

  return { listening, interim, supported, start, stop };
}

export function speak(text: string, lang: string) {
  if (typeof window === "undefined") return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = 1.0;
  u.pitch = 1.0;
  synth.speak(u);
}

export function stopSpeaking() {
  if (typeof window === "undefined") return;
  window.speechSynthesis?.cancel();
}
