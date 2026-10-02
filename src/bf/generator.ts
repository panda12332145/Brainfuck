/**
 * Gerador de código: transforma texto comum em um programa Brainfuck que o
 * imprime. Usa sempre o caminho mais curto entre um byte e o seguinte,
 * aproveitando que a célula dá a volta (0 - 1 = 255).
 */

/** Menor distância com sinal entre dois valores de 8 bits (fica em -128..127). */
export function shortestDelta(from: number, to: number): number {
  let d = (to - from) % 256;
  if (d > 128) d -= 256;
  if (d < -128) d += 256;
  return d;
}

/** Quebra o código em linhas de no máximo `width` caracteres, sem cortar no meio de um bloco. */
export function wrapCode(code: string, width: number): string {
  if (width <= 0) return code;
  const tokens = code.match(/\.|[+-]+/g) ?? [];
  const lines: string[] = [];
  let line = "";
  for (const tok of tokens) {
    if (line && line.length + tok.length > width) {
      lines.push(line);
      line = "";
    }
    line += tok;
    if (tok === "." && line.length >= width * 0.6) {
      lines.push(line);
      line = "";
    }
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

/**
 * Gera um programa que imprime `text`.
 *
 * @param text    texto a imprimir (aceita acentos — vira UTF-8)
 * @param width   quebra de linha (0 = linha única)
 */
export function encodeText(text: string, width = 0): string {
  const bytes = new TextEncoder().encode(text);
  let cur = 0;
  let code = "";
  for (let i = 0; i < bytes.length; i++) {
    const d = shortestDelta(cur, bytes[i]);
    if (d > 0) code += "+".repeat(d);
    else if (d < 0) code += "-".repeat(-d);
    code += ".";
    cur = bytes[i];
  }
  return wrapCode(code, width);
}

/** Gera um programa que imprime o número `n` em decimal (0 a 255). */
export function encodeNumber(n: number): string {
  return encodeText(String(Math.max(0, Math.min(255, Math.round(n)))));
}
