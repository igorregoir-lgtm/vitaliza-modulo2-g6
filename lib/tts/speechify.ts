// ============================================================================
// Normalização de texto para fala (pt-BR). Transforma a resposta "escrita" do
// LLM em algo natural de ouvir: remove markdown/URLs, trata símbolos, moeda,
// porcentagem, siglas/abreviações, reduz enumerações e melhora a prosódia.
// Funções PURAS (sem efeitos) — fáceis de testar.
// ============================================================================

const ABBREV: [RegExp, string][] = [
  [/\bp\.?\s?ex\.?\b/gi, "por exemplo"],
  [/\bex\.:/gi, "por exemplo:"],
  [/\betc\.?\b/gi, "etcétera"],
  [/\bvs\.?\b/gi, "versus"],
  [/\bn[ºo]\.?\s?(?=\d)/gi, "número "],
  [/\bart\.\s?(?=\d)/gi, "artigo "],
  [/\bDra\.\s/g, "Doutora "],
  [/\bDr\.\s/g, "Doutor "],
  [/\bSr\.\s/g, "Senhor "],
  [/\bSra\.\s/g, "Senhora "],
];

/** Normaliza o texto para soar natural quando lido por um TTS pt-BR. */
export function normalizeForSpeech(input: string): string {
  if (!input) return "";
  let t = input;

  // Blocos de código e código inline (não faláveis).
  t = t.replace(/```[\s\S]*?```/g, " ");
  t = t.replace(/`([^`]+)`/g, "$1");

  // Imagens e links markdown -> texto; URLs cruas removidas.
  t = t.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  t = t.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  t = t.replace(/https?:\/\/[^\s)]+/g, "");
  t = t.replace(/\bwww\.[^\s)]+/g, "");

  // Títulos, citações e marcadores de lista (reduz enumeração).
  t = t.replace(/^\s{0,3}#{1,6}\s*/gm, "");
  t = t.replace(/^\s{0,3}>\s?/gm, "");
  t = t.replace(/^\s*[-*+•]\s+/gm, "");
  t = t.replace(/^\s*\d+[.)]\s+/gm, "");

  // Ênfase markdown ** * __ _ ~~.
  t = t.replace(/(\*\*|\*|__|_|~~)(.*?)\1/g, "$2");

  // Moeda e porcentagem (pt-BR).
  t = t.replace(/R\$\s?([\d.,]+)/g, "$1 reais");
  t = t.replace(/%/g, " por cento");

  // Símbolos que soam mal.
  t = t.replace(/&/g, " e ");
  t = t.replace(/\s*[—–]\s*/g, ", ");
  t = t.replace(/\s*\/\s*/g, " "); // LTV/CAC -> "LTV CAC"
  t = t.replace(/[=<>|^~*#]+/g, " ");
  t = t.replace(/\.{3,}/g, "…");

  // Abreviações comuns.
  for (const [re, rep] of ABBREV) t = t.replace(re, rep);

  // Emojis / setas / dingbats.
  t = t.replace(
    /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu,
    "",
  );

  // Espaçamento e prosódia.
  t = t.replace(/[ \t]{2,}/g, " ");
  t = t.replace(/[ \t]*\n{2,}[ \t]*/g, ". "); // parágrafos -> pausa forte
  t = t.replace(/[ \t]*\n[ \t]*/g, ". "); // quebras -> pausa
  t = t.replace(/(?:\.\s*){2,}/g, ". "); // colapsa ".. ." em ". "
  t = t.replace(/\s+([,.;:!?…])/g, "$1"); // sem espaço antes de pontuação
  t = t.replace(/([,;:])(?=\S)/g, "$1 "); // espaço após pontuação
  t = t.replace(/\s{2,}/g, " ").trim();

  if (t && !/[.!?…]$/.test(t)) t += ".";
  return t;
}

/** Quebra um texto longo em blocos faláveis (limite por bloco), por frase. */
export function chunkForSpeech(text: string, maxChars = 600): string[] {
  const clean = normalizeForSpeech(text);
  if (clean.length <= maxChars) return clean ? [clean] : [];
  const sentences = clean.match(/[^.!?…]+[.!?…]*/g) ?? [clean];
  const chunks: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if ((cur + s).length > maxChars && cur) {
      chunks.push(cur.trim());
      cur = "";
    }
    cur += s;
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}
