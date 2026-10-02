import { describe, expect, it } from "vitest";
import { compile, createMachine, run, snapshot } from "./interpreter";
import { buildCode, CATEGORIES, COMMANDS, IDIOMS, LESSONS } from "./lessons";

/** Roda o código de uma lição até o fim e devolve a saída. */
function runLesson(code: string, input = "") {
  const p = compile(code);
  const m = createMachine(false);
  run(p, m, new TextEncoder().encode(input), 2_000_000);
  return { p, m, text: new TextDecoder().decode(snapshot(m).out) };
}

describe("catálogo de lições", () => {
  it("tem lições e ids únicos", () => {
    expect(LESSONS.length).toBeGreaterThan(5);
    const ids = LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("toda lição usa uma categoria existente", () => {
    for (const l of LESSONS) {
      expect(CATEGORIES, `categoria inválida em ${l.id}`).toContain(l.category);
    }
  });

  it("toda lição tem título, resumo e explicação", () => {
    for (const l of LESSONS) {
      expect(l.title.length, l.id).toBeGreaterThan(2);
      expect(l.summary.length, l.id).toBeGreaterThan(2);
      expect(l.explain.length, l.id).toBeGreaterThan(0);
      expect(l.lines.length, l.id).toBeGreaterThan(0);
    }
  });

  it("o código de toda lição compila sem erro de sintaxe", () => {
    for (const l of LESSONS) {
      const { p } = runLesson(buildCode(l));
      expect(p.error, `lição ${l.id}: ${p.error ?? ""}`).toBeNull();
    }
  });

  it("nenhum comentário de lição vaza símbolo de comando", () => {
    for (const l of LESSONS) {
      const code = buildCode(l);
      const semComando = code.replace(/[-+<>[\].,]/g, "");
      // o que sobra é só texto de comentário: não pode ter colchetes nem pontos
      expect(semComando, `lição ${l.id}`).not.toMatch(/[<>+[\].,]/);
    }
  });

  it("toda lição roda até o fim sem erro de execução", () => {
    for (const l of LESSONS) {
      const { m } = runLesson(buildCode(l), l.input ?? "");
      expect(m.error, `lição ${l.id}: ${m.error ?? ""}`).toBeNull();
      expect(m.halted, `lição ${l.id} não terminou`).toBe(true);
    }
  });

  it("buildCode alinha os comentários na mesma coluna", () => {
    const l = LESSONS.find((x) => x.lines.some(([bf, c]) => bf && c))!;
    const cols = buildCode(l)
      .split("\n")
      .map((line) => line.search(/[^\-+<>[\].,\s]/))
      .filter((c) => c > 0);
    expect(new Set(cols).size).toBe(1);
  });
});

describe("conteúdo das lições", () => {
  it("a lição do alfabeto imprime de A a Z", () => {
    const l = LESSONS.find((x) => x.id === "alfabeto")!;
    expect(runLesson(buildCode(l)).text).toBe("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
  });

  it("a lição do Hello World imprime Hello World", () => {
    const l = LESSONS.find((x) => x.id === "hello")!;
    expect(runLesson(buildCode(l)).text).toContain("Hello World");
  });

  it("a lição de entrada aplica a cifra na entrada sugerida", () => {
    const l = LESSONS.find((x) => x.id === "entrada")!;
    expect(runLesson(buildCode(l), l.input).text).toBe("IBM");
  });

  it("a lição 'numeros-grandes' existe e é usada como código inicial", () => {
    expect(LESSONS.find((x) => x.id === "numeros-grandes")).toBeTruthy();
  });
});

describe("referência", () => {
  it("lista os 8 comandos", () => {
    expect(COMMANDS).toHaveLength(8);
    expect(COMMANDS.map((c) => c.sym).sort().join("")).toBe("+-<>[].,".split("").sort().join(""));
  });

  it("todo idioma da referência compila", () => {
    for (const i of IDIOMS) {
      const p = compile("+" + i.code); // um '+' antes garante que os loops executem
      expect(p.error, `idioma ${i.code}: ${p.error ?? ""}`).toBeNull();
    }
  });

  it("todo idioma tem título e descrição", () => {
    for (const i of IDIOMS) {
      expect(i.title.length).toBeGreaterThan(2);
      expect(i.desc.length).toBeGreaterThan(0);
    }
  });
});
