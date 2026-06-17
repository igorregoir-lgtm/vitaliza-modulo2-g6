"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Loader2, Mic, Send, Volume2, VolumeX, X, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { TutorIcon } from "@/components/icons/tutor-icon";

type Msg = { role: "user" | "assistant"; content: string };
type Seed = { question?: string };

interface TutorApi {
  open: (seed?: Seed) => void;
}
const TutorCtx = React.createContext<TutorApi | null>(null);

export function useTutor(): TutorApi {
  const ctx = React.useContext(TutorCtx);
  if (!ctx) return { open: () => {} };
  return ctx;
}

const SCREEN_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard Executivo",
  "/eda": "EDA Interativa",
  "/individual": "Consulta Individual",
  "/carteira": "Visão de Carteira",
  "/principios-de-personalizacao": "Princípios de Personalização (LGPD)",
};

const WELCOME =
  "Oi, que bom ter você aqui! Eu sou o Tutor do Vitaliza e quero te ajudar, no seu ritmo, a entender este sistema. Pode me perguntar qualquer coisa sobre o repositório — o modelo, as explicações, as telas, a governança — escrevendo ou falando comigo pelo microfone. Como posso ajudar?";

const SUGESTOES = [
  "O que esta tela mostra?",
  "O que é SHAP e como leio o gráfico?",
  "Por que não contatar os sleeping dogs?",
];

export function TutorProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const screen = SCREEN_LABELS[pathname] ?? "o sistema";

  const [isOpen, setIsOpen] = React.useState(false);
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
  const scrollRef = React.useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = React.useRef<any>(null);

  React.useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  React.useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);
  React.useEffect(() => {
    speakOnRef.current = speakOn;
  }, [speakOn]);
  React.useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  React.useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    setVoiceSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  function speak(text: string) {
    try {
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "pt-BR";
      u.rate = 1.03;
      window.speechSynthesis.speak(u);
    } catch {
      /* TTS indisponível */
    }
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

  const open = React.useCallback((seed?: Seed) => {
    setIsOpen(true);
    const firstTime = messagesRef.current.length === 0;
    if (firstTime) {
      const init = [{ role: "assistant", content: WELCOME } as Msg];
      setMessages(init);
      messagesRef.current = init;
    }
    if (seed?.question) {
      send(seed.question);
    } else if (firstTime) {
      // Saudação falada ao abrir pelo botão flutuante (gesto do usuário permite TTS).
      speak(WELCOME);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const api = React.useMemo<TutorApi>(() => ({ open }), [open]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  return (
    <TutorCtx.Provider value={api}>
      {children}

      {/* Botão flutuante — acompanha o scroll */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => open()}
          aria-label="Abrir o tutor"
          className={cn(
            "group fixed bottom-5 right-5 z-40 inline-flex items-center gap-2.5 rounded-full px-4 py-3",
            "bg-[var(--accent)] text-white shadow-[0_8px_28px_-6px_rgba(20,184,166,0.7)] ring-1 ring-inset ring-white/15",
            "transition-all hover:bg-[var(--accent-deep)] hover:shadow-[0_10px_32px_-6px_rgba(20,184,166,0.8)] active:translate-y-px",
          )}
        >
          <TutorIcon className="h-5 w-5" />
          <span className="text-[13px] font-semibold tracking-tight">Tutor</span>
          <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-70" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-[var(--accent)] ring-2 ring-[var(--paper-soft)]" />
          </span>
        </button>
      )}

      {/* Painel de chat */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Tutor conversacional"
          className={cn(
            "fixed inset-x-3 bottom-3 z-50 mx-auto flex h-[72vh] max-h-[620px] max-w-[400px] flex-col overflow-hidden rounded-2xl border border-[var(--rule)] bg-[var(--paper)] shadow-2xl",
            "sm:inset-x-auto sm:right-5 sm:mx-0 sm:w-[400px]",
          )}
        >
          {/* Cabeçalho */}
          <div className="flex items-center gap-2.5 bg-[var(--ink)] px-4 py-3 text-[var(--paper)]">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-white">
              <TutorIcon className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0 flex-1 leading-none">
              <p className="font-display text-sm font-semibold">Tutor do Vitaliza</p>
              <p className="mt-0.5 text-[11px] text-[var(--steel-soft)]">Só responde sobre este sistema</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSpeakOn((s) => !s);
                if (speakOn && typeof window !== "undefined") window.speechSynthesis?.cancel();
              }}
              aria-pressed={speakOn}
              aria-label={speakOn ? "Desativar leitura em voz alta" : "Ativar leitura em voz alta"}
              title={speakOn ? "Leitura em voz alta: ligada" : "Leitura em voz alta: desligada"}
              className={cn(
                "rounded-full p-2 transition-colors hover:bg-white/10",
                speakOn && "text-[var(--accent)]",
              )}
            >
              {speakOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                if (typeof window !== "undefined") window.speechSynthesis?.cancel();
              }}
              aria-label="Fechar o tutor"
              className="rounded-full p-2 transition-colors hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Mensagens */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-[var(--paper-soft)] px-3 py-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                    m.role === "user"
                      ? "bg-[var(--primary)] text-white"
                      : "border border-[var(--rule)] bg-[var(--paper)] text-[var(--ink-soft)]",
                  )}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  {m.role === "assistant" && (
                    <button
                      type="button"
                      onClick={() => speak(m.content)}
                      className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent-deep)] hover:underline"
                    >
                      <Volume2 className="h-3 w-3" /> Ouvir
                    </button>
                  )}
                </div>
              </div>
            ))}

            {messages.length <= 1 && !loading && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGESTOES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-full border border-[var(--rule)] bg-[var(--paper)] px-3 py-1.5 text-xs text-[var(--ink-soft)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent-deep)]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-2xl border border-[var(--rule)] bg-[var(--paper)] px-3.5 py-2.5 text-sm text-[var(--steel)]">
                  <Loader2 className="h-4 w-4 animate-spin" /> pensando…
                </div>
              </div>
            )}
          </div>

          {/* Entrada */}
          <form onSubmit={onSubmit} className="border-t border-[var(--rule)] bg-[var(--paper)] p-2.5">
            <div className="flex items-end gap-2">
              {voiceSupported && (
                <button
                  type="button"
                  onClick={toggleMic}
                  aria-label={listening ? "Parar gravação" : "Falar com o tutor"}
                  title={listening ? "Parar" : "Falar (voz)"}
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors",
                    listening
                      ? "animate-pulse bg-[#dc2626] text-white"
                      : "bg-[var(--accent-light)] text-[var(--accent-deep)] hover:bg-[var(--accent)] hover:text-white",
                  )}
                >
                  {listening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
              )}
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                placeholder={listening ? "Ouvindo…" : "Pergunte sobre o sistema…"}
                className="max-h-28 min-h-[40px] flex-1 resize-none rounded-[var(--radius-md)] border border-[var(--rule)] bg-[var(--paper-soft)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                aria-label="Enviar"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white transition-colors hover:bg-[var(--accent-deep)] disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1.5 px-1 text-[10px] leading-snug text-[var(--steel-soft)]">
              Escopo restrito ao repositório Vitaliza · {voiceSupported ? "voz e leitura em voz alta disponíveis" : "leitura em voz alta disponível"}.
            </p>
          </form>
        </div>
      )}
    </TutorCtx.Provider>
  );
}
