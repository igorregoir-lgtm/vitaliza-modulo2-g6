"use client";

import * as React from "react";

export interface SpeakApi {
  speak: (text: string) => void;
  stopSpeaking: () => void;
  playing: boolean;
  ttsLoading: boolean;
  voiceSourceLabel: string;
}

// Coordena a reprodução entre várias instâncias de useSpeak (ex.: o tutor e o
// simulador na mesma tela): antes de uma falar, silencia qualquer outra que
// esteja tocando, para duas vozes nunca se sobreporem. De propósito mais leve
// que um Context compartilhado.
const activeSpeakers = new Set<() => void>();
function stopOtherSpeakers(self: () => void): void {
  for (const stop of activeSpeakers) {
    if (stop !== self) stop();
  }
}

// Voz pt-BR mais natural disponível no navegador (fallback do TTS de servidor).
function pickPtVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;
  const pt = voices.filter((v) => /^pt([-_]?br)?/i.test(v.lang));
  const pool = pt.length ? pt : voices;
  const score = (v: SpeechSynthesisVoice) => {
    const n = (v.name || "").toLowerCase();
    let s = 0;
    if (/natural|neural|online|premium|enhanced/.test(n)) s += 9;
    if (/google/.test(n)) s += 5;
    if (/(thalita|francisca|ant[oô]nio|brenda|let[ií]cia|giovanna|manuela|yara|maria|luciana|joana|camila|vit[oó]ria|helena|fernanda|felipe|daniel)/.test(n)) s += 3;
    if (/pt[-_]?br/i.test(v.lang)) s += 3;
    if (v.localService === false) s += 2;
    return s;
  };
  return [...pool].sort((a, b) => score(b) - score(a))[0] ?? null;
}

/** Hook de voz reutilizável: TTS de servidor (`/api/tts`) com fallback para a
 *  síntese de voz do navegador. Extraído de `use-tutor-chat.ts` (contrato §8). */
export function useSpeak(): SpeakApi {
  const [ttsLoading, setTtsLoading] = React.useState(false);
  const [playing, setPlaying] = React.useState(false);
  const [voiceSourceLabel, setVoiceSourceLabel] = React.useState("voz do navegador");

  const voiceRef = React.useRef<SpeechSynthesisVoice | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const serverVoiceRef = React.useRef(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const synth = window.speechSynthesis;
    const refresh = () => {
      const v = pickPtVoice(synth.getVoices());
      if (v) voiceRef.current = v;
    };
    refresh();
    synth.addEventListener?.("voiceschanged", refresh);
    return () => synth.removeEventListener?.("voiceschanged", refresh);
  }, []);

  React.useEffect(() => {
    let alive = true;
    fetch("/api/tts")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (!alive || !s) return;
        const avail = !!s.serverVoiceAvailable;
        serverVoiceRef.current = avail;
        const cfg = (s.providers || []).find(
          (p: { configured: boolean; name: string }) => p.configured,
        );
        setVoiceSourceLabel(avail && cfg ? `voz natural (${cfg.name})` : "voz do navegador");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const stopSpeaking = React.useCallback(() => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    } catch {
      /* noop */
    }
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* noop */
    }
    setPlaying(false);
  }, []);

  // Registra esta instância para que outras possam silenciá-la antes de falar.
  React.useEffect(() => {
    activeSpeakers.add(stopSpeaking);
    return () => {
      activeSpeakers.delete(stopSpeaking);
    };
  }, [stopSpeaking]);

  const speakBrowser = React.useCallback((text: string) => {
    try {
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const voice = voiceRef.current ?? pickPtVoice(synth.getVoices());
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang;
      } else {
        u.lang = "pt-BR";
      }
      u.rate = 1.0;
      u.pitch = 1.0;
      u.onend = () => setPlaying(false);
      u.onerror = () => setPlaying(false);
      setPlaying(true);
      synth.speak(u);
    } catch {
      setPlaying(false);
    }
  }, []);

  const speak = React.useCallback(
    async (text: string) => {
      stopSpeaking();
      stopOtherSpeakers(stopSpeaking);
      if (serverVoiceRef.current) {
        try {
          setTtsLoading(true);
          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
          });
          const ct = res.headers.get("Content-Type") || "";
          if (res.ok && ct.startsWith("audio")) {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audioRef.current = audio;
            audio.onplay = () => setPlaying(true);
            audio.onended = () => {
              setPlaying(false);
              URL.revokeObjectURL(url);
              if (audioRef.current === audio) audioRef.current = null;
            };
            audio.onerror = () => {
              setPlaying(false);
              URL.revokeObjectURL(url);
            };
            setTtsLoading(false);
            await audio.play();
            return;
          }
        } catch {
          /* fallback */
        } finally {
          setTtsLoading(false);
        }
      }
      speakBrowser(text);
    },
    [stopSpeaking, speakBrowser],
  );

  return { speak, stopSpeaking, playing, ttsLoading, voiceSourceLabel };
}
