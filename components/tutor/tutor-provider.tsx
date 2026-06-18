"use client";

import * as React from "react";
import { Loader2, Square, Volume2, VolumeX, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TutorIcon } from "@/components/icons/tutor-icon";
import { useTutorChat } from "./use-tutor-chat";
import { ChatBody } from "./chat-body";

type Seed = { question?: string };

interface TutorApi {
  open: (seed?: Seed) => void;
}
const TutorCtx = React.createContext<TutorApi | null>(null);

export function useTutor(): TutorApi {
  const ctx = React.useContext(TutorCtx);
  return ctx ?? { open: () => {} };
}

/** Provider: chat conversacional FLUTUANTE (botão "Pergunte ao Tutor" que acompanha o
 *  scroll) + contexto `open()` para acionar de qualquer lugar. O chat INLINE
 *  (dos cards) usa o mesmo hook em `TutorInline`. */
export function TutorProvider({ children }: { children: React.ReactNode }) {
  const chat = useTutorChat();
  const [isOpen, setIsOpen] = React.useState(false);

  const open = React.useCallback((seed?: Seed) => {
    setIsOpen(true);
    chat.seedWelcome({ greet: !seed?.question });
    if (seed?.question) chat.send(seed.question);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const api = React.useMemo<TutorApi>(() => ({ open }), [open]);

  return (
    <TutorCtx.Provider value={api}>
      {children}

      {/* Botão flutuante — acompanha o scroll */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => open()}
          aria-label="Pergunte ao Tutor"
          className={cn(
            "group fixed bottom-5 right-5 z-40 inline-flex items-center gap-2.5 rounded-full px-4 py-3",
            "bg-[var(--accent)] text-white shadow-[0_8px_28px_-6px_rgba(20,184,166,0.7)] ring-1 ring-inset ring-white/15",
            "transition-all hover:bg-[var(--accent-deep)] hover:shadow-[0_10px_32px_-6px_rgba(20,184,166,0.8)] active:translate-y-px",
          )}
        >
          <TutorIcon className="h-5 w-5" />
          <span className="text-[13px] font-semibold tracking-tight">Pergunte ao Tutor</span>
          <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-70" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-[var(--accent)] ring-2 ring-[var(--paper-soft)]" />
          </span>
        </button>
      )}

      {/* Painel de chat flutuante */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Tutor conversacional"
          className={cn(
            "fixed inset-x-3 bottom-3 z-50 mx-auto flex h-[72vh] max-h-[620px] max-w-[400px] flex-col overflow-hidden rounded-2xl border border-[var(--rule)] bg-[var(--paper)] shadow-2xl",
            "sm:inset-x-auto sm:right-5 sm:mx-0 sm:w-[400px]",
          )}
        >
          <div className="flex items-center gap-2.5 bg-[var(--ink)] px-4 py-3 text-[var(--paper)]">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-white">
              <TutorIcon className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0 flex-1 leading-none">
              <p className="font-display text-sm font-semibold">Tutor do Vitaliza</p>
              <p className="mt-0.5 text-[11px] text-[var(--steel-soft)]">Só responde sobre este sistema</p>
            </div>
            {(chat.playing || chat.ttsLoading) && (
              <button
                type="button"
                onClick={chat.stopSpeaking}
                aria-label="Parar áudio"
                title="Parar áudio"
                className="rounded-full p-2 text-[var(--accent)] transition-colors hover:bg-white/10"
              >
                {chat.ttsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                chat.setSpeakOn((s) => !s);
                if (chat.speakOn) chat.stopSpeaking();
              }}
              aria-pressed={chat.speakOn}
              aria-label={chat.speakOn ? "Desativar leitura em voz alta" : "Ativar leitura em voz alta"}
              title={chat.speakOn ? "Leitura em voz alta: ligada" : "Leitura em voz alta: desligada"}
              className={cn(
                "rounded-full p-2 transition-colors hover:bg-white/10",
                chat.speakOn && "text-[var(--accent)]",
              )}
            >
              {chat.speakOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                chat.stopSpeaking();
              }}
              aria-label="Fechar o tutor"
              className="rounded-full p-2 transition-colors hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <ChatBody chat={chat} />
        </div>
      )}
    </TutorCtx.Provider>
  );
}
