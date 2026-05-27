"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Minimal cross-browser SpeechRecognition typing
type SR = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { results: { 0: { transcript: string } }[][] & { length: number } }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

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

export function useSpeechRecognition(opts: { lang: string; onFinal?: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [supported, setSupported] = useState(true);
  const recRef = useRef<SR | null>(null);

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setSupported(false);
      return;
    }
    const rec = new Ctor();
    rec.lang = opts.lang;
    rec.continuous = false;
    rec.interimResults = true;
    let finalText = "";
    rec.onresult = (e) => {
      const results = e.results as unknown as Array<{ 0: { transcript: string }; isFinal?: boolean }>;
      let text = "";
      for (let i = 0; i < (results as unknown as { length: number }).length; i++) {
        const r = results[i];
        const transcript = r[0].transcript;
        if (r.isFinal) finalText += transcript;
        else text += transcript;
      }
      setInterim(text);
    };
    rec.onerror = () => {
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
      if (finalText && opts.onFinal) opts.onFinal(finalText.trim());
    };
    rec.start();
    recRef.current = rec;
    setListening(true);
  }, [opts]);

  const stop = useCallback(() => {
    recRef.current?.stop();
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
