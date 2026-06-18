"use client";

import * as React from "react";
import { Loader2, Mic, Send, Volume2, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { SUGESTOES, type TutorChatApi } from "./use-tutor-chat";

/** Corpo do chat (lista de mensagens + entrada) — compartilhado entre o painel
 *  flutuante e o painel inline. `compact` ajusta a altura para o uso inline. */
export function ChatBody({ chat, compact = false }: { chat: TutorChatApi; compact?: boolean }) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chat.messages, chat.loading]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    chat.send(chat.input);
  }

  return (
    <>
      <div
        ref={scrollRef}
        className={cn(
          "space-y-3 overflow-y-auto bg-[var(--paper-soft)] px-3 py-3",
          compact ? "max-h-[360px]" : "flex-1",
        )}
      >
        {chat.messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
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
                  onClick={() => chat.speak(m.content)}
                  disabled={chat.ttsLoading}
                  className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent-deep)] hover:underline disabled:opacity-60"
                >
                  {chat.ttsLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Volume2 className="h-3 w-3" />
                  )}{" "}
                  Ouvir
                </button>
              )}
            </div>
          </div>
        ))}

        {chat.messages.length <= 1 && !chat.loading && (
          <div className="flex flex-wrap gap-2 pt-1">
            {SUGESTOES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => chat.send(s)}
                className="rounded-full border border-[var(--rule)] bg-[var(--paper)] px-3 py-1.5 text-xs text-[var(--ink-soft)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--paper-soft)] hover:text-[var(--accent-deep)]"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {chat.loading && (
          <div className="flex justify-start">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-[var(--rule)] bg-[var(--paper)] px-3.5 py-2.5 text-sm text-[var(--steel)]">
              <Loader2 className="h-4 w-4 animate-spin" /> pensando…
            </div>
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="border-t border-[var(--rule)] bg-[var(--paper)] p-2.5">
        <div className="flex items-end gap-2">
          {chat.voiceSupported && (
            <button
              type="button"
              onClick={chat.toggleMic}
              aria-label={chat.listening ? "Parar gravação" : "Falar com o tutor"}
              title={chat.listening ? "Parar" : "Falar (voz)"}
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors",
                chat.listening
                  ? "animate-pulse bg-[#dc2626] text-white"
                  : "bg-[var(--accent-light)] text-[var(--accent-deep)] hover:bg-[var(--accent)] hover:text-white",
              )}
            >
              {chat.listening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
          )}
          <textarea
            value={chat.input}
            onChange={(e) => chat.setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                chat.send(chat.input);
              }
            }}
            rows={1}
            placeholder={chat.listening ? "Ouvindo…" : "Pergunte sobre o sistema…"}
            className="max-h-28 min-h-[40px] flex-1 resize-none rounded-[var(--radius-md)] border border-[var(--rule)] bg-[var(--paper-soft)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            disabled={chat.loading || !chat.input.trim()}
            aria-label="Enviar"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white transition-colors hover:bg-[var(--accent-deep)] disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 px-1 text-[10px] leading-snug text-[var(--steel-soft)]">
          Escopo restrito ao repositório Vitaliza · {chat.voiceSourceLabel}
          {chat.voiceSupported ? " · microfone disponível" : ""}.
        </p>
      </form>
    </>
  );
}
