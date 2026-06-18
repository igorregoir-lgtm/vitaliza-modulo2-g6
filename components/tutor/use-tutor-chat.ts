"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useSpeak } from "./use-speak";

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

  const { speak, stopSpeaking, playing, ttsLoading, voiceSourceLabel } = useSpeak();

  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const [speakOn, setSpeakOn] = React.useState(false);
  const [voiceSupported, setVoiceSupported] = React.useState(false);

  const messagesRef = React.useRef<Msg[]>([]);
  const loadingRef = React.useRef(false);
  const speakOnRef = React.useRef(false);
  const screenRef = React.useRef(screen);
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
