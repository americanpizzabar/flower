"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const MAX_VIDEO_SECONDS = 20;

interface MediaRecorderLike {
  start: (timeslice?: number) => void;
  stop: () => void;
  state: string;
  ondataavailable: ((e: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  onerror: ((e: unknown) => void) | null;
}

interface MediaRecorderCtor {
  new (
    stream: MediaStream,
    options?: { mimeType?: string; videoBitsPerSecond?: number; audioBitsPerSecond?: number },
  ): MediaRecorderLike;
  isTypeSupported?: (mime: string) => boolean;
}

// Tuned to fit ~3MB for a 20-second clip — under Vercel's 4.5MB body limit.
const VIDEO_BITS_PER_SECOND = 1_200_000;
const AUDIO_BITS_PER_SECOND = 64_000;

function pickMimeType(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const MR = (window as unknown as { MediaRecorder?: MediaRecorderCtor }).MediaRecorder;
  if (!MR || !MR.isTypeSupported) return undefined;
  const candidates = [
    "video/mp4;codecs=h264,aac",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const c of candidates) {
    if (MR.isTypeSupported(c)) return c;
  }
  return undefined;
}

function fileExtFor(mime: string | undefined): string {
  if (!mime) return "webm";
  if (mime.startsWith("video/mp4")) return "mp4";
  if (mime.startsWith("video/webm")) return "webm";
  return "webm";
}

export function isInAppCameraSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (!navigator.mediaDevices?.getUserMedia) return false;
  if (!(window as unknown as { MediaRecorder?: unknown }).MediaRecorder) return false;
  return true;
}

export interface InAppCamera {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isOpen: boolean;
  isRecording: boolean;
  elapsedSec: number;
  open: () => Promise<void>;
  close: () => void;
  startRecording: () => void;
  stopRecording: () => void;
  takePhoto: () => Promise<File | null>;
  error: string;
  onCapture: (cb: (file: File) => void) => void;
}

export function useInAppCamera(): InAppCamera {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorderLike | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  const callbackRef = useRef<((file: File) => void) | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [error, setError] = useState("");

  const close = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (tickTimerRef.current) {
      clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    recorderRef.current = null;
    chunksRef.current = [];
    setIsOpen(false);
    setIsRecording(false);
    setElapsedSec(0);
  }, []);

  useEffect(() => {
    return () => close();
  }, [close]);

  const open = useCallback(async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      });
      streamRef.current = stream;
      // The <video> element only mounts once isOpen flips to true, so we
      // attach the stream in the effect below (not here, where the ref is null).
      setIsOpen(true);
    } catch (e) {
      setError(
        e instanceof Error && /permission|denied|notallowed/i.test(e.message + (e.name || ""))
          ? "カメラへのアクセスが許可されませんでした。ブラウザの設定からカメラを許可してください。"
          : `カメラを起動できませんでした: ${e instanceof Error ? e.message : "unknown"}`,
      );
    }
  }, []);

  // Attach the captured stream once the video element is actually mounted.
  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (isOpen && video && stream) {
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      const tryPlay = () => video.play().catch(() => {});
      if (video.readyState >= 1) tryPlay();
      else video.onloadedmetadata = tryPlay;
    }
  }, [isOpen]);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    setError("");
    const mimeType = pickMimeType();
    const MR = (window as unknown as { MediaRecorder: MediaRecorderCtor }).MediaRecorder;
    const recorder = new MR(streamRef.current, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
      audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
    });
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: mimeType || "video/webm",
      });
      const ext = fileExtFor(mimeType);
      const file = new File([blob], `flower-${Date.now()}.${ext}`, {
        type: mimeType || "video/webm",
      });
      setIsRecording(false);
      setElapsedSec(0);
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }
      if (tickTimerRef.current) {
        clearInterval(tickTimerRef.current);
        tickTimerRef.current = null;
      }
      if (file.size > 0) callbackRef.current?.(file);
    };

    recorder.onerror = (e: unknown) => {
      setError(`録画でエラーが発生しました: ${String(e)}`);
      setIsRecording(false);
    };

    try {
      recorder.start();
    } catch (e) {
      setError(`録画開始に失敗しました: ${e instanceof Error ? e.message : "unknown"}`);
      return;
    }
    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    setIsRecording(true);
    setElapsedSec(0);

    tickTimerRef.current = setInterval(() => {
      setElapsedSec(Math.min(MAX_VIDEO_SECONDS, (Date.now() - startedAtRef.current) / 1000));
    }, 200);

    stopTimerRef.current = setTimeout(() => {
      try {
        recorderRef.current?.stop();
      } catch {
        /* ignore */
      }
    }, MAX_VIDEO_SECONDS * 1000);
  }, []);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const takePhoto = useCallback(async (): Promise<File | null> => {
    const video = videoRef.current;
    if (!video || !streamRef.current) return null;
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.88),
    );
    if (!blob) return null;
    const file = new File([blob], `flower-${Date.now()}.jpg`, { type: "image/jpeg" });
    callbackRef.current?.(file);
    return file;
  }, []);

  const onCapture = useCallback((cb: (file: File) => void) => {
    callbackRef.current = cb;
  }, []);

  return {
    videoRef,
    isOpen,
    isRecording,
    elapsedSec,
    open,
    close,
    startRecording,
    stopRecording,
    takePhoto,
    error,
    onCapture,
  };
}

/**
 * Downscale large images and re-encode as JPEG so an in-store snapshot
 * lands well under Vercel's 4.5MB body limit. Images that are already
 * small (< 800KB and <= maxWidth) are returned unchanged.
 */
export async function compressImage(
  file: File,
  maxWidth = 1600,
  quality = 0.8,
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  const img = await loadImage(file);
  const tooBig = file.size > 800_000;
  const tooWide = img.width > maxWidth;
  if (!tooBig && !tooWide) {
    img.remove?.();
    return file;
  }
  const ratio = tooWide ? maxWidth / img.width : 1;
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, w, h);
  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality),
  );
  if (!blob) return file;
  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("画像を読み込めませんでした"));
    };
    img.src = url;
  });
}

/**
 * Grab a representative still frame from a video so its flowers can be used as
 * input to the (image-only) generation/identification step. Returns a JPEG File.
 */
export function captureVideoFrame(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.src = url;
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    const cleanup = () => URL.revokeObjectURL(url);
    v.onloadedmetadata = () => {
      const target = Math.min(1, (v.duration || 2) / 2);
      const seek = () => {
        try {
          v.currentTime = target;
        } catch {
          /* ignore */
        }
      };
      if (v.readyState >= 2) seek();
      else v.oncanplay = seek;
    };
    v.onseeked = () => {
      const w = v.videoWidth || 1280;
      const h = v.videoHeight || 720;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        cleanup();
        reject(new Error("動画フレームを取得できませんでした"));
        return;
      }
      ctx.drawImage(v, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          cleanup();
          if (!blob) {
            reject(new Error("動画フレームを取得できませんでした"));
            return;
          }
          resolve(new File([blob], `frame-${Date.now()}.jpg`, { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.85,
      );
    };
    v.onerror = () => {
      cleanup();
      reject(new Error("動画を読み込めませんでした"));
    };
  });
}

export function videoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(v.duration);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("動画のメタデータを読み取れませんでした"));
    };
    v.src = url;
  });
}

/**
 * Trim a video to the first MAX_VIDEO_SECONDS using <video>.captureStream() + MediaRecorder.
 * Returns the original file if it's already short enough, or a trimmed File if it was longer.
 * Throws if captureStream / MediaRecorder are unavailable.
 */
export async function trimVideo(file: File): Promise<File> {
  const sec = await videoDuration(file).catch(() => 0);
  if (sec === 0 || sec <= MAX_VIDEO_SECONDS) return file;

  const w = window as unknown as { MediaRecorder?: MediaRecorderCtor };
  if (!w.MediaRecorder) {
    throw new Error(
      "このブラウザは動画のトリミングに対応していません。20秒以内の動画を選んでください。",
    );
  }
  const MR = w.MediaRecorder;
  const mime = pickMimeType() || "video/webm";

  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.src = url;
  v.muted = true;
  v.playsInline = true;
  await new Promise<void>((resolve, reject) => {
    v.onloadedmetadata = () => resolve();
    v.onerror = () => reject(new Error("動画を読み込めませんでした"));
  });

  const stream =
    (v as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream?.() ||
    (
      v as HTMLVideoElement & {
        mozCaptureStream?: () => MediaStream;
      }
    ).mozCaptureStream?.();

  if (!stream) {
    URL.revokeObjectURL(url);
    throw new Error(
      "このブラウザは動画のトリミングに対応していません。動画アプリで20秒以内に短くしてから選び直してください。",
    );
  }

  const recorder = new MR(stream, {
    mimeType: mime,
    videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
    audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  return new Promise<File>((resolve, reject) => {
    recorder.onstop = () => {
      URL.revokeObjectURL(url);
      const blob = new Blob(chunks, { type: mime });
      const ext = fileExtFor(mime);
      resolve(new File([blob], `trimmed-${Date.now()}.${ext}`, { type: mime }));
    };
    recorder.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(new Error(`トリミングに失敗しました: ${String(e)}`));
    };
    recorder.start();
    v.play()
      .then(() => {
        setTimeout(() => {
          try {
            recorder.stop();
            v.pause();
          } catch {
            /* ignore */
          }
        }, MAX_VIDEO_SECONDS * 1000);
      })
      .catch((e) => {
        URL.revokeObjectURL(url);
        reject(e);
      });
  });
}
