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

// A microphone stream shared across the whole app (module scope survives client
// navigations). The welcome flow primes it up front via primeMic(); every later
// SpeechRecognition session then reuses an already-warm mic, so the engine never
// has to cold-start and the opening words are not dropped.
let sharedMicStream: MediaStream | null = null;

/**
 * Acquire (and keep) the microphone so later speech recognition starts warm.
 * Safe to call repeatedly — it reuses the existing stream. Best called from a
 * user gesture (e.g. a button on the welcome screen) so the permission prompt
 * appears at a natural moment.
 */
export async function primeMic(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return false;
  if (sharedMicStream && sharedMicStream.getTracks().some((t) => t.readyState === "live")) {
    return true;
  }
  try {
    sharedMicStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return true;
  } catch {
    return false;
  }
}

export function isMicPrimed(): boolean {
  return !!sharedMicStream && sharedMicStream.getTracks().some((t) => t.readyState === "live");
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

  useEffect(() => {
    return () => {
      try {
        recRef.current?.abort();
      } catch {
        /* ignore */
      }
      // The mic stream is shared app-wide (see primeMic); leave it running so
      // navigating between pages keeps the mic warm.
    };
  }, []);

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
    // Auto-stop on silence so the user doesn't need a separate Stop button:
    // speak → pause → engine ends → final text goes to onFinal.
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
    // Must run synchronously inside the user gesture — on iOS Safari any async
    // hop (await, .then, setTimeout) drops the gesture and the engine refuses
    // to listen. SR has its own internal audio capture so we don't need to
    // await getUserMedia here.
    beginRecognition();
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

// Unlock speechSynthesis on iOS by speaking an empty utterance inside a user
// gesture. Subsequent speak() calls (even later, not in a gesture) then work.
// Safe to call repeatedly; only the first call has any effect.
let synthUnlocked = false;
export function unlockSpeech() {
  if (typeof window === "undefined" || synthUnlocked) return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    synth.speak(u);
    synthUnlocked = true;
  } catch {
    /* ignore */
  }
}

export function speak(text: string, lang: string) {
  if (typeof window === "undefined" || !text) return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  // Stop anything currently being said. The tiny rAF gap before speaking avoids
  // an iOS quirk where cancel()+speak() back-to-back swallows the new utterance.
  try {
    synth.cancel();
  } catch {
    /* ignore */
  }
  const run = () => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 1.0;
    u.pitch = 1.0;
    // Pick an explicit matching voice when available — iOS sometimes fails to
    // auto-select one for `u.lang` and stays silent.
    const voices = synth.getVoices?.() || [];
    if (voices.length > 0) {
      const base = lang.split("-")[0];
      const match =
        voices.find((v) => v.lang === lang) ||
        voices.find((v) => v.lang.toLowerCase().startsWith(base.toLowerCase()));
      if (match) u.voice = match;
    }
    synth.speak(u);
  };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
  else setTimeout(run, 0);
}

export function stopSpeaking() {
  if (typeof window === "undefined") return;
  window.speechSynthesis?.cancel();
}
