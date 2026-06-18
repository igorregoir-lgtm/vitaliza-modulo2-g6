"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

export type Msg = { role: "user" | "assistant"; content: string };

export const SCREEN_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard Executivo",
  "/eda": "EDA Interativa",
  "/individual": "Consulta Individual",
  "/carteira": "Visão de Carteira",
  "/principios-de-personalizacao": "Princípios de Personalização (LGPD)",
};

export const WELCOME =
  "Oi, que bom ter você aqui! Eu sou o Tutor do Vitaliza e quero te ajudar, no seu ritmo, a entender este sistema. Pode me perguntar qualquer coisa sobre o repositório — o modelo, as explicações, as telas, a governança — escrevendo ou falando comigo pelo microfone. Como posso ajudar?";

export const SUGESTOES = [
  "O que esta tela mostra?",
  "O que é SHAP e como leio o gráfico?",
  "Por que não contatar os sleeping dogs?",
];

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

export interface TutorChatApi {
  messages: Msg[];
  input: string;
  setInput: (v: string) => void;
  loading: boolean;
  listening: boolean;
  voiceSupported: boolean;
  speakOn: boolean;
  setSpeakOn: React.Dispatch<React.SetStateAction<boolean>>;
  ttsLoading: boolean;
  playing: boolean;
  voiceSourceLabel: string;
  hasMessages: boolean;
  send: (text: string) => void;
  toggleMic: () => void;
  speak: (text: string) => void;
  stopSpeaking: () => void;
  /** Semeia a mensagem de boas-vindas (e fala, se greet=true) — usado no flutuante. */
  seedWelcome: (opts?: { greet?: boolean }) => void;
}

export function useTutorChat(): TutorChatApi {
  const pathname = usePathname();
  const screen = SCREEN_LABELS[pathname] ?? "o sistema";

  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const [speakOn, setSpeakOn] = React.useState(false);
  const [voiceSupported, setVoiceSupported] = React.useState(false);
  const [ttsLoading, setTtsLoading] = React.useState(false);
  const [playing, setPlaying] = React.useState(false);
  const [voiceSourceLabel, setVoiceSourceLabel] = React.useState("voz do navegador");

  const messagesRef = React.useRef<Msg[]>([]);
  const loadingRef = React.useRef(false);
  const speakOnRef = React.useRef(false);
  const screenRef = React.useRef(screen);
  const voiceRef = React.useRef<SpeechSynthesisVoice | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const serverVoiceRef = React.useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = React.useRef<any>(null);

  React.useEffect(() => void (messagesRef.current = messages), [messages]);
  React.useEffect(() => void (loadingRef.current = loading), [loading]);
  React.useEffect(() => void (speakOnRef.current = speakOn), [speakOn]);
  React.useEffect(() => void (screenRef.current = screen), [screen]);

  React.useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVoiceSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

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

  function stopSpeaking() {
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
  }

  function speakBrowser(text: string) {
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
  }

  async function speak(text: string) {
    stopSpeaking();
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
  }

  async function send(text: string) {
    const q = text.trim();
    if (!q || loadingRef.current) return;
    const history = [...messagesRef.current, { role: "user", content: q } as Msg];
    setMessages(history);
    messagesRef.current = history;
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, screen: screenRef.current }),
      });
      const data = await res.json();
      const ans: string = data.answer ?? "Não consegui responder agora.";
      setMessages((m) => [...m, { role: "assistant", content: ans }]);
      if (speakOnRef.current) speak(ans);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Erro ao falar com o tutor. Tente novamente." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function toggleMic() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    let finalText = "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interim += t;
      }
      setInput(finalText || interim);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => {
      setListening(false);
      if (finalText.trim()) send(finalText);
    };
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }

  function seedWelcome(opts?: { greet?: boolean }) {
    if (messagesRef.current.length === 0) {
      const init = [{ role: "assistant", content: WELCOME } as Msg];
      setMessages(init);
      messagesRef.current = init;
      if (opts?.greet) speak(WELCOME);
    }
  }

  return {
    messages,
    input,
    setInput,
    loading,
    listening,
    voiceSupported,
    speakOn,
    setSpeakOn,
    ttsLoading,
    playing,
    voiceSourceLabel,
    hasMessages: messages.length > 0,
    send,
    toggleMic,
    speak,
    stopSpeaking,
    seedWelcome,
  };
}
