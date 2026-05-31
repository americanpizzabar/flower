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

/**
 * Surface the microphone-permission prompt up front (e.g. from a button on the
 * welcome screen) so it appears at a natural moment.
 *
 * IMPORTANT: we must NOT keep the stream open. On Android Chrome the
 * SpeechRecognition engine needs exclusive access to the microphone; if a
 * getUserMedia stream is still holding it, recognition receives no audio and
 * silently transcribes nothing. So we request the mic only to trigger/cache the
 * permission, then immediately stop every track to release it.
 */
export async function primeMic(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return false;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
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
    };
  }, []);

  const start = useCallback(() => {
    // Must run synchronously inside the user gesture — any async hop (await,
    // .then, setTimeout) before .start() drops the gesture and the engine
    // refuses to listen. SpeechRecognition manages its own microphone capture,
    // so we do NOT open a getUserMedia stream here (that would steal the mic).
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
    // Auto-stop on silence so no separate Stop button is needed:
    // tap 🎤 → speak → pause → engine ends → final text goes to onFinal.
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

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
  }, []);

  return { listening, interim, supported, start, stop };
}

// On the very first speak() of a session, the engine cold-starts and tends to
// clip the opening syllable. We absorb that ramp with one near-silent lead-in
// utterance (see speak()), tracked by this flag.
let leadInDone = false;

export function speak(text: string, lang: string) {
  if (typeof window === "undefined" || !text) return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  // Only clear the queue if something is actually playing/queued. Calling
  // cancel() unconditionally right after the engine starts can clip the first
  // word of the new utterance (the cause of the "途切れる" opening).
  try {
    if (synth.speaking || synth.pending) synth.cancel();
  } catch {
    /* ignore */
  }
  const voices = synth.getVoices?.() || [];
  const pickVoice = (u: SpeechSynthesisUtterance) => {
    if (voices.length === 0) return;
    const base = lang.split("-")[0].toLowerCase();
    const match =
      voices.find((v) => v.lang === lang) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(base));
    if (match) u.voice = match;
  };
  // Queue a very short, near-silent lead-in first. The engine spends its
  // cold-start ramp on this throwaway utterance, so the real sentence starts
  // cleanly without the first syllable being cut off.
  if (!leadInDone) {
    const lead = new SpeechSynthesisUtterance("、");
    lead.lang = lang;
    lead.volume = 0.01;
    pickVoice(lead);
    synth.speak(lead);
    leadInDone = true;
  }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = 1.0;
  u.pitch = 1.0;
  pickVoice(u);
  synth.speak(u);
  // Chrome can get stuck in a paused state after cancel(); nudge it back.
  try {
    synth.resume();
  } catch {
    /* ignore */
  }
}

export function stopSpeaking() {
  if (typeof window === "undefined") return;
  window.speechSynthesis?.cancel();
}
