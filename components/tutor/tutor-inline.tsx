"use client";

import * as React from "react";
import { Loader2, Square, Volume2, VolumeX, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TutorIcon } from "@/components/icons/tutor-icon";
import { useTutorChat } from "./use-tutor-chat";
import { ChatBody } from "./chat-body";

/** Chat do tutor renderizado INLINE (dentro do card, no fluxo da página). */
export function TutorInline({
  seedQuestion,
  onClose,
}: {
  seedQuestion?: string;
  onClose?: () => void;
}) {
  const chat = useTutorChat();
  const askedRef = React.useRef(false);

  React.useEffect(() => {
    if (!askedRef.current && seedQuestion) {
      askedRef.current = true;
      chat.send(seedQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mt-3 overflow-hidden rounded-[var(--radius-md)] border border-[var(--rule)] bg-[var(--paper)]">
      <div className="flex items-center gap-2 border-b border-[var(--rule)] bg-[var(--ink)] px-3 py-2 text-[var(--paper)]">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-white">
          <TutorIcon className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-semibold">Tutor — aqui nesta tela</span>
        {(chat.playing || chat.ttsLoading) && (
          <button
            type="button"
            onClick={chat.stopSpeaking}
            aria-label="Parar áudio"
            title="Parar áudio"
            className="rounded-full p-1.5 text-[var(--accent)] transition-colors hover:bg-white/10"
          >
            {chat.ttsLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Square className="h-3.5 w-3.5" />
            )}
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
            "rounded-full p-1.5 transition-colors hover:bg-white/10",
            chat.speakOn && "text-[var(--accent)]",
          )}
        >
          {chat.speakOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
        </button>
        {onClose && (
          <button
            type="button"
            onClick={() => {
              chat.stopSpeaking();
              onClose();
            }}
            aria-label="Fechar tutor"
            className="rounded-full p-1.5 transition-colors hover:bg-white/10"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <ChatBody chat={chat} compact />
    </div>
  );
}
