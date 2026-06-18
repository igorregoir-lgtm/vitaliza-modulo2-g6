import * as React from "react";

/**
 * Ícone do tutor — inspirado na identidade allla.
 * Combina três motivos da marca:
 *  - balão de conversa (a pergunta / o diálogo com o tutor);
 *  - três barras ascendentes (os três "l" do logotipo — aprendizado/crescimento);
 *  - ponto/faísca (a energia de inteligência — o "ponto" teal da marca).
 * Desenhado em traço (stroke = currentColor), cantos arredondados, no estilo
 * dos ícones SVG inline da allla. Herda a cor do contexto (branco no botão teal,
 * teal nos rótulos). Uso: <TutorIcon className="h-4 w-4" />.
 */
export function TutorIcon({
  className,
  strokeWidth = 1.6,
  ...props
}: React.SVGProps<SVGSVGElement> & { strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Balão de conversa — perguntar */}
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      {/* Três barras ascendentes — motivo allla (aprendizado que cresce) */}
      <path d="M8 13.5V11.6" strokeWidth={1.9} />
      <path d="M12 13.5V9.6" strokeWidth={1.9} />
      <path d="M16 13.5V8" strokeWidth={1.9} />
      {/* Faísca de inteligência (ponto) sobre a barra mais alta */}
      <circle cx="16" cy="5.7" r="0.95" fill="currentColor" stroke="none" />
    </svg>
  );
}
