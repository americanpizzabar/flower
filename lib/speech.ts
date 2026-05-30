"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface SRAlternative {
  transcript: string;
}
interface SRResult {
  isFinal: boolean;
  length: number;
  0: SRAlternative;
}
interface SRResultList {
  length: number;
  [index: number]: SRResult;
}
interface SREvent {
  results: SRResultList;
  resultIndex: number;
}
interface SRErrorEvent {
  error: string;
}

interface SR {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SRCtor {
  new (): SR;
}

function getRecognitionCtor(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SRCtor;
    webkitSpeechRecognition?: SRCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useSpeechRecognition(opts: {
  lang: string;
  onFinal?: (text: string) => void;
  onError?: (error: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [supported, setSupported] = useState(true);
  const recRef = useRef<SR | null>(null);
  const finalTextRef = useRef("");
  const onFinalRef = useRef(opts.onFinal);
  const onErrorRef = useRef(opts.onError);

  useEffect(() => {
    onFinalRef.current = opts.onFinal;
    onErrorRef.current = opts.onError;
  }, [opts.onFinal, opts.onError]);

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
  }, []);

  // Tracks whether we've already obtained mic permission this session, so we
  // only pay the getUserMedia warm-up cost on the very first start().
  const micReadyRef = useRef(false);

  const beginRecognition = useCallback(() => {
    if (recRef.current) {
      try {
        recRef.current.abort();
      } catch {
        /* ignore */
      }
      recRef.current = null;
    }
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setSupported(false);
      return;
    }
    const rec = new Ctor();
    rec.lang = opts.lang;
    rec.continuous = false;
    rec.interimResults = true;
    finalTextRef.current = "";

    rec.onresult = (e) => {
      let interimText = "";
      let appendedFinal = "";
      for (let i = e.resultIndex || 0; i < e.results.length; i++) {
        const r = e.results[i];
        const transcript = r[0]?.transcript || "";
        if (r.isFinal) appendedFinal += transcript;
        else interimText += transcript;
      }
      if (appendedFinal) finalTextRef.current += appendedFinal;
      setInterim(interimText);
    };

    rec.onerror = (e) => {
      setListening(false);
      setInterim("");
      if (e.error && e.error !== "no-speech" && e.error !== "aborted") {
        onErrorRef.current?.(e.error);
      }
    };

    rec.onend = () => {
      setListening(false);
      setInterim("");
      const finalText = finalTextRef.current.trim();
      if (finalText) onFinalRef.current?.(finalText);
      finalTextRef.current = "";
    };

    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch (e) {
      setListening(false);
      onErrorRef.current?.(e instanceof Error ? e.message : "start failed");
    }
  }, [opts.lang]);

  const start = useCallback(() => {
    // On the very first use, the browser shows a microphone-permission prompt.
    // If we start SpeechRecognition straight away, that first session is often
    // discarded while the user is still deciding, so the opening utterance is
    // never recognized. Pre-warm the permission with getUserMedia first, then
    // begin recognition — subsequent starts skip this and begin immediately.
    if (micReadyRef.current || !navigator.mediaDevices?.getUserMedia) {
      beginRecognition();
      return;
    }
    setListening(true);
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        stream.getTracks().forEach((t) => t.stop());
        micReadyRef.current = true;
        beginRecognition();
      })
      .catch((e) => {
        setListening(false);
        onErrorRef.current?.(e instanceof Error ? e.message : "mic permission denied");
      });
  }, [beginRecognition]);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
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
