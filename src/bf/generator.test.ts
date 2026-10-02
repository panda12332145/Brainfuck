import { describe, expect, it } from "vitest";
import { compile, createMachine, run, snapshot } from "./interpreter";
import { encodeNumber, encodeText, shortestDelta, wrapCode } from "./generator";

/** Roda o código gerado e devolve o que ele imprime. */
function outputOf(code: string): string {
  const p = compile(code);
  expect(p.error, `código gerado inválido: ${code}`).toBeNull();
  const m = createMachine(false);
  run(p, m, new Uint8Array(0), 1_000_000);
  expect(m.error, `código gerado falhou: ${code}`).toBeNull();
  return new TextDecoder().decode(snapshot(m).out);
}

describe("shortestDelta", () => {
  it("escolhe o caminho mais curto dando a volta na célula", () => {
    expect(shortestDelta(0, 5)).toBe(5);
    expect(shortestDelta(0, 250)).toBe(-6); // 6x '-' é melhor que 250x '+'
    expect(shortestDelta(250, 5)).toBe(11); // 250 -> 255 -> 0 -> 5
    expect(shortestDelta(5, 5)).toBe(0);
  });

  it("nunca passa de 128 passos para nenhum par de valores", () => {
    for (let a = 0; a < 256; a += 7) {
      for (let b = 0; b < 256; b += 11) {
        expect(Math.abs(shortestDelta(a, b))).toBeLessThanOrEqual(128);
      }
    }
  });
});

describe("encodeText", () => {
  it("gera código que imprime exatamente o texto pedido", () => {
    for (const text of ["A", "Hello World!\n", "ola", "BF Studio", "0123456789", "aaaaaaaaaa"]) {
      expect(outputOf(encodeText(text))).toBe(text);
    }
  });

  it("funciona com acentos (UTF-8)", () => {
    for (const text of ["ção", "Olá, mundo!", "emoji 😀"]) {
      expect(outputOf(encodeText(text))).toBe(text);
    }
  });

  it("texto vazio gera programa vazio", () => {
    expect(encodeText("")).toBe("");
  });

  it("o programa gerado usa só uma célula", () => {
    const p = compile(encodeText("Teste"));
    expect(p.code).not.toContain(">");
    expect(p.code).not.toContain("<");
  });

  it("quebra de linha não muda o resultado", () => {
    expect(outputOf(encodeText("Hello World", 20))).toBe("Hello World");
  });
});

describe("encodeNumber", () => {
  it("imprime o número em decimal", () => {
    expect(outputOf(encodeNumber(42))).toBe("42");
    expect(outputOf(encodeNumber(0))).toBe("0");
    expect(outputOf(encodeNumber(255))).toBe("255");
  });

  it("prende o valor entre 0 e 255", () => {
    expect(outputOf(encodeNumber(999))).toBe("255");
    expect(outputOf(encodeNumber(-3))).toBe("0");
  });
});

describe("wrapCode", () => {
  it("não corta um bloco de + no meio", () => {
    const wrapped = wrapCode("++++++++++++++++++++.", 10);
    expect(wrapped.split("\n")).toEqual(["++++++++++++++++++++", "."]);
    expect(wrapped.replace(/\n/g, "")).toBe("++++++++++++++++++++.");
  });

  it("width 0 devolve tudo em uma linha", () => {
    expect(wrapCode("+++.+++", 0)).toBe("+++.+++");
  });

  it("juntando as linhas de novo dá o código original", () => {
    const code = encodeText("The quick brown fox jumps over the lazy dog");
    expect(wrapCode(code, 40).replace(/\n/g, "")).toBe(code);
  });
});
