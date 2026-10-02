const CTRL = [
  "NUL", "SOH", "STX", "ETX", "EOT", "ENQ", "ACK", "BEL", "BS", "TAB", "LF", "VT", "FF", "CR", "SO", "SI",
  "DLE", "DC1", "DC2", "DC3", "DC4", "NAK", "SYN", "ETB", "CAN", "EM", "SUB", "ESC", "FS", "GS", "RS", "US",
];

const CTRL_DESC: Record<number, string> = {
  0: "Nulo — marca o fim de textos em muitas linguagens",
  7: "Sino (beep)",
  8: "Backspace (apagar)",
  9: "Tabulação",
  10: "Nova linha (Enter / \\n)",
  13: "Retorno de carro (\\r)",
  27: "Escape",
  32: "Espaço",
  127: "Delete",
};

/** Rótulo curto para mostrar dentro de uma célula. */
export function charLabel(v: number): string {
  if (v < 32) return CTRL[v];
  if (v === 32) return "␣";
  if (v < 127) return String.fromCharCode(v);
  if (v === 127) return "DEL";
  return "·";
}

export function isPrintable(v: number): boolean {
  return v >= 33 && v < 127;
}

export function category(v: number): string {
  if (v < 32 || v === 127) return "Caractere de controle";
  if (v === 32) return "Espaço";
  if (v >= 48 && v <= 57) return "Dígito";
  if (v >= 65 && v <= 90) return "Letra maiúscula";
  if (v >= 97 && v <= 122) return "Letra minúscula";
  if (v < 127) return "Pontuação / símbolo";
  return "Fora do ASCII padrão (128–255)";
}

export function describe(v: number): string {
  if (CTRL_DESC[v]) return CTRL_DESC[v];
  if (v < 32) return "Caractere de controle invisível";
  if (v >= 48 && v <= 57) return `O dígito ${v - 48}. Para converter em número, subtraia 48.`;
  if (v >= 65 && v <= 90) return `A ${v - 64}ª letra do alfabeto (maiúscula). Some 32 para virar minúscula.`;
  if (v >= 97 && v <= 122) return `A ${v - 96}ª letra do alfabeto (minúscula). Subtraia 32 para virar maiúscula.`;
  if (v < 127) return "Símbolo imprimível";
  return "Não faz parte da tabela ASCII padrão; o resultado depende da codificação do terminal.";
}

export interface Suggestion {
  code: string;
  kind: "direct" | "loop";
  desc: string;
}

/** Sugere um jeito curto de produzir o valor v. */
export function suggest(v: number): Suggestion {
  if (v === 0) return { code: "[-]", kind: "direct", desc: "Zera a célula atual" };
  let best = "+".repeat(v);
  let bestCost = v;
  let kind: "direct" | "loop" = "direct";
  let desc = `${v} vezes + direto na célula`;
  if (v > 128) {
    best = "-".repeat(256 - v);
    bestCost = 256 - v;
    desc = `${256 - v} vezes - (a célula dá a volta: 0 − ${256 - v} = ${v})`;
  }
  for (let a = 2; a <= 16; a++) {
    for (const b of [Math.floor(v / a), Math.ceil(v / a)]) {
      if (b < 1) continue;
      const c = v - a * b;
      const cost = a + b + Math.abs(c) + 6;
      if (cost < bestCost) {
        bestCost = cost;
        kind = "loop";
        best = "+".repeat(a) + "[>" + "+".repeat(b) + "<-]>" + (c >= 0 ? "+".repeat(c) : "-".repeat(-c));
        desc = `${a} × ${b}${c === 0 ? "" : c > 0 ? " + " + c : " − " + -c} = ${v}. A célula atual vira contador e o resultado fica na próxima.`;
      }
    }
  }
  return { code: best, kind, desc };
}
