import { describe, expect, it } from "vitest";
import {
  compile,
  createMachine,
  HISTORY_SIZE,
  liveAt,
  MAX_OUTPUT,
  run,
  snapshot,
  stats,
  stepBack,
  TAPE_SIZE,
  visibleCells,
  type Machine,
  type Program,
} from "./interpreter";

const HELLO =
  "++++++++[>++++[>++>+++>+++>+<<<<-]>+>+>->>+[<]<-]>>.>---.+++++++..+++.>>.<-.<.+++.------.--------.>>+.>++.";

const enc = (s: string) => new TextEncoder().encode(s);

/** Roda um programa até o fim e devolve a saída como texto. */
function exec(src: string, input = "", maxSteps = 5_000_000): { text: string; m: Machine; p: Program } {
  const p = compile(src);
  expect(p.error, `erro de sintaxe em: ${src}`).toBeNull();
  const m = createMachine(false);
  run(p, m, enc(input), maxSteps);
  const v = snapshot(m);
  return { text: new TextDecoder().decode(v.out), m, p };
}

describe("compile", () => {
  it("descarta comentários e guarda a posição original de cada comando", () => {
    const p = compile("ab+cd-ef");
    expect(p.code).toBe("+-");
    expect(p.pos).toEqual([2, 5]);
    expect(p.error).toBeNull();
  });

  it("conta linhas e colunas", () => {
    const p = compile("++\n  >+\n");
    expect(p.code).toBe("++>+");
    expect(Array.from(p.line)).toEqual([0, 0, 1, 1]);
    expect(Array.from(p.col)).toEqual([1, 2, 3, 4]);
  });

  it("ignora \\r sem quebrar linha/coluna (arquivos salvos no Windows)", () => {
    const p = compile("++\r\n>+\r\n");
    expect(p.code).toBe("++>+");
    expect(Array.from(p.line)).toEqual([0, 0, 1, 1]);
    expect(Array.from(p.col)).toEqual([1, 2, 1, 2]);
  });

  it("liga cada [ ao seu ]", () => {
    const p = compile("[[]]");
    expect(p.jump[0]).toBe(3);
    expect(p.jump[3]).toBe(0);
    expect(p.jump[1]).toBe(2);
    expect(p.jump[2]).toBe(1);
    expect(p.loops).toBe(2);
  });

  it("calcula a profundidade de aninhamento", () => {
    const p = compile("+[+[++]+]");
    expect(p.code).toBe("+[+[++]+]");
    expect(Array.from(p.depth)).toEqual([0, 1, 1, 2, 2, 2, 2, 1, 1]);
  });

  it("detecta ] sem par e aponta o lugar certo", () => {
    const p = compile("++]+");
    expect(p.error).toMatch(/Colchete \]/);
    expect(p.errorPos).toBe(2);
    expect(p.errorLine).toBe(0);
  });

  it("detecta [ sem par e aponta o lugar certo", () => {
    const p = compile("+\n+[+");
    expect(p.error).toMatch(/Colchete \[/);
    expect(p.errorPos).toBe(3);
    expect(p.errorLine).toBe(1);
  });

  it("reporta apenas o primeiro erro", () => {
    const p = compile("]]][[[");
    expect(p.error).toMatch(/Colchete \]/);
    expect(p.errorPos).toBe(0);
  });

  it("aponta o pc do começo da próxima linha (usado pelo passo a linha)", () => {
    const p = compile("++\n>+\n<");
    expect(p.code).toBe("++>+<");
    expect(Array.from(p.nextLineStart)).toEqual([2, 2, 4, 4, -1]);
  });

  it("linhas só com comentário não viram parada intermediária", () => {
    const p = compile("++\n\n\n>+");
    expect(p.nextLineStart[0]).toBe(2);
    expect(p.nextLineStart[1]).toBe(2);
    expect(p.nextLineStart[2]).toBe(-1);
  });

  it("programa vazio compila sem erro", () => {
    const p = compile("");
    expect(p.code).toBe("");
    expect(p.error).toBeNull();
    expect(p.pos).toEqual([]);
  });

  it("conta os comandos em stats", () => {
    const s = stats(compile("++>><[-].,"));
    expect(s["+"]).toBe(2);
    expect(s[">"]).toBe(2);
    expect(s["<"]).toBe(1);
    expect(s["["]).toBe(1);
    expect(s["]"]).toBe(1);
    expect(s["."]).toBe(1);
    expect(s[","]).toBe(1);
    expect(s["-"]).toBe(1);
  });
});

describe("run — aritmética e fita", () => {
  it("multiplica e imprime (10 × 7 + 2 = 72 = 'H')", () => {
    expect(exec("++++++++++[>+++++++<-]>++.").text).toBe("H");
  });

  it("a célula dá a volta: 0 - 1 = 255 e 255 + 1 = 0", () => {
    expect(exec("-").m.tape[0]).toBe(255);
    const p = compile("+");
    const m = createMachine(false);
    m.tape[0] = 255;
    run(p, m, new Uint8Array(0), 10);
    expect(m.tape[0]).toBe(0);
  });

  it("[-] zera qualquer célula", () => {
    const { m } = exec("+++++++++++++++++[-]");
    expect(m.tape[0]).toBe(0);
    expect(m.halted).toBe(true);
    // 17 incrementos + '[' inicial + 17 × ('-' , ']')
    expect(m.steps).toBe(17 + 1 + 17 * 2);
  });

  it("move o ponteiro e acompanha o máximo alcançado", () => {
    const { m } = exec(">>>>>>>>>");
    expect(m.ptr).toBe(9);
    expect(m.maxPtr).toBe(9);
  });

  it("erro ao sair da fita pela esquerda", () => {
    const { m } = exec("<");
    expect(m.halted).toBe(true);
    expect(m.error).toMatch(/esquerda da célula 0/);
    expect(m.errorPc).toBe(0);
    expect(m.ptr).toBe(0);
  });

  it("erro ao sair da fita pela direita sem mover o ponteiro", () => {
    const p = compile(">");
    const m = createMachine(false);
    m.ptr = TAPE_SIZE - 1;
    run(p, m, new Uint8Array(0), 10);
    expect(m.halted).toBe(true);
    expect(m.error).toMatch(/fim da fita/);
    expect(m.ptr).toBe(TAPE_SIZE - 1);
    expect(m.errorPc).toBe(0);
  });

  it("loop não executa quando a célula já é 0", () => {
    const { m } = exec("[+++++]");
    expect(m.tape[0]).toBe(0);
    expect(m.steps).toBe(1);
    expect(m.halted).toBe(true);
  });

  it("loop roda o número certo de vezes", () => {
    const { m } = exec("+++[>+<-]");
    expect(m.tape[0]).toBe(0);
    expect(m.tape[1]).toBe(3);
  });
});

describe("run — entrada e saída", () => {
  it("lê a entrada byte a byte", () => {
    expect(exec(",+.,+.,+.", "ABC").text).toBe("BCD");
  });

  it("grava 0 quando a entrada acaba", () => {
    const { m } = exec(",.,.", "A");
    expect(m.tape[0]).toBe(0);
    expect(m.inPos).toBe(1);
  });

  it("entrada com acento (UTF-8 de 2 bytes) sai inteira", () => {
    expect(exec(",[.,]", "ção").text).toBe("ção");
  });

  it("interrompe com erro quando a saída passa do limite", () => {
    const p = compile("+[.]");
    const m = createMachine(false);
    run(p, m, new Uint8Array(0), 5_000_000);
    expect(m.halted).toBe(true);
    expect(m.error).toMatch(/saída passou/);
    expect(m.outLen).toBe(MAX_OUTPUT);
    expect(m.errorPc).toBe(2);
  });

  it("o buffer de saída cresce sem perder a ordem dos bytes", () => {
    const p = compile("+++++.+.+.");
    const m = createMachine(false);
    run(p, m, new Uint8Array(0), 10000);
    expect(m.halted).toBe(true);
    expect(m.outLen).toBe(3);
    expect(Array.from(snapshot(m).out)).toEqual([5, 6, 7]);
  });

  it("o buffer de saída cresce além de 1 KB sem perder bytes", () => {
    const big = "x".repeat(2000);
    const { text, m } = exec(",[.,]", big);
    expect(text).toBe(big);
    expect(m.outLen).toBe(2000);
    expect(m.out.length).toBeGreaterThanOrEqual(2000);
  });
});

describe("run — controle de execução", () => {
  it("respeita maxSteps e continua de onde parou", () => {
    const p = compile("++++++++++.");
    const m = createMachine(false);
    run(p, m, new Uint8Array(0), 3);
    expect(m.steps).toBe(3);
    expect(m.pc).toBe(3);
    expect(m.halted).toBe(false);
    run(p, m, new Uint8Array(0), 100);
    expect(m.halted).toBe(true);
    expect(m.steps).toBe(11);
    expect(m.pc).toBe(p.code.length);
  });

  it("stopPc para ANTES de executar a instrução", () => {
    const p = compile("+++.");
    const m = createMachine(false);
    run(p, m, new Uint8Array(0), 100, 3);
    expect(m.pc).toBe(3);
    expect(m.tape[0]).toBe(3);
    expect(m.outLen).toBe(0);
    expect(m.halted).toBe(false);
  });

  it("não marca como finalizado quando para num breakpoint", () => {
    const p = compile("++.+.");
    const m = createMachine(false);
    run(p, m, new Uint8Array(0), 100, -1, new Set([2]));
    expect(m.halted).toBe(false);
    expect(m.atBreakpoint).toBe(true);
    expect(m.pc).toBe(2);
    expect(m.tape[0]).toBe(2);
  });

  it("continuar depois do breakpoint não para no mesmo lugar", () => {
    const p = compile("++.+.");
    const m = createMachine(false);
    run(p, m, new Uint8Array(0), 100, -1, new Set([2]));
    run(p, m, new Uint8Array(0), 100, -1, new Set([2]));
    expect(m.pc).toBe(p.code.length);
    expect(m.halted).toBe(true);
    expect(m.atBreakpoint).toBe(false);
  });

  it("breakpoint na fronteira entre dois pedaços não é pulado", () => {
    const p = compile("+".repeat(10) + ".");
    const m = createMachine(false);
    run(p, m, new Uint8Array(0), 5); // para no meio, longe de qualquer breakpoint
    expect(m.atBreakpoint).toBe(false);
    run(p, m, new Uint8Array(0), 100, -1, new Set([10]));
    expect(m.atBreakpoint).toBe(true);
    expect(m.pc).toBe(10);
  });

  it("conjunto vazio de breakpoints não interfere", () => {
    const { m } = exec("+++");
    expect(m.tape[0]).toBe(3);
  });

  it("não executa nada se a máquina já terminou", () => {
    const p = compile("+");
    const m = createMachine(false);
    run(p, m, new Uint8Array(0), 10);
    expect(m.halted).toBe(true);
    const before = m.steps;
    run(p, m, new Uint8Array(0), 10);
    expect(m.steps).toBe(before);
  });
});

describe("stepBack — desfazer", () => {
  it("desfaz incremento", () => {
    const p = compile("+++");
    const m = createMachine();
    run(p, m, new Uint8Array(0), 3);
    expect(m.tape[0]).toBe(3);
    expect(stepBack(m)).toBe(true);
    expect(m.tape[0]).toBe(2);
    expect(m.pc).toBe(2);
    expect(m.steps).toBe(2);
  });

  it("desfaz movimento do ponteiro", () => {
    const p = compile("+>+>");
    const m = createMachine();
    run(p, m, new Uint8Array(0), 4);
    expect(m.ptr).toBe(2);
    stepBack(m); // desfaz o '>' final
    expect(m.ptr).toBe(1);
    stepBack(m); // desfaz o '+' da célula 1
    expect(m.ptr).toBe(1);
    expect(m.tape[1]).toBe(0);
    stepBack(m); // desfaz o primeiro '>'
    expect(m.ptr).toBe(0);
    expect(m.tape[0]).toBe(1);
  });

  it("desfaz a saída uma impressão por vez", () => {
    const p = compile("+++++.+.");
    const m = createMachine();
    run(p, m, new Uint8Array(0), 8);
    expect(m.outLen).toBe(2);
    stepBack(m); // desfaz o segundo '.'
    expect(m.outLen).toBe(1);
    stepBack(m); // desfaz o '+' entre as impressões
    expect(m.outLen).toBe(1);
    stepBack(m); // desfaz o primeiro '.'
    expect(m.outLen).toBe(0);
  });

  it("desfaz a leitura de entrada", () => {
    const p = compile(",,");
    const m = createMachine();
    run(p, m, enc("AB"), 2);
    expect(m.inPos).toBe(2);
    expect(m.tape[0]).toBe(66);
    stepBack(m);
    expect(m.inPos).toBe(1);
    expect(m.tape[0]).toBe(65);
  });

  it("volta de um programa finalizado", () => {
    const p = compile("++");
    const m = createMachine();
    run(p, m, new Uint8Array(0), 100);
    expect(m.halted).toBe(true);
    expect(stepBack(m)).toBe(true);
    expect(m.halted).toBe(false);
    expect(m.pc).toBe(1);
    expect(m.tape[0]).toBe(1);
  });

  it("volta de um erro de execução e limpa o erro", () => {
    const p = compile("+<");
    const m = createMachine();
    run(p, m, new Uint8Array(0), 100);
    expect(m.error).toMatch(/esquerda/);
    expect(m.pc).toBe(1);
    expect(stepBack(m)).toBe(true);
    expect(m.error).toBeNull();
    expect(m.errorPc).toBe(-1);
    expect(m.halted).toBe(false);
    expect(m.pc).toBe(0);
    expect(m.tape[0]).toBe(0);
    expect(m.steps).toBe(0);
  });

  it("avisa quando não há mais histórico", () => {
    const m = createMachine();
    expect(stepBack(m)).toBe(false);
    expect(m.steps).toBe(0);
  });

  it("não grava histórico quando record=false", () => {
    const p = compile("+++");
    const m = createMachine(false);
    run(p, m, new Uint8Array(0), 3);
    expect(m.histCount).toBe(0);
    expect(stepBack(m)).toBe(false);
  });

  it("o histórico é circular e mantém os últimos passos", () => {
    const extra = 50;
    const p = compile("+".repeat(HISTORY_SIZE + extra));
    const m = createMachine();
    run(p, m, new Uint8Array(0), HISTORY_SIZE + extra);
    expect(m.histCount).toBe(HISTORY_SIZE);
    for (let i = 0; i < HISTORY_SIZE; i++) expect(stepBack(m)).toBe(true);
    expect(stepBack(m)).toBe(false);
    expect(m.pc).toBe(extra);
    expect(m.tape[0]).toBe(extra);
  });
});

describe("snapshot e visibleCells", () => {
  it("mostra no mínimo 32 células", () => {
    expect(visibleCells(0)).toBe(32);
  });

  it("cresce junto com o ponteiro, em múltiplos de 8", () => {
    expect(visibleCells(3)).toBe(32);
    expect(visibleCells(30)).toBe(40);
    expect(visibleCells(100)).toBe(112);
  });

  it("nunca passa do máximo visível nem do tamanho da fita", () => {
    expect(visibleCells(TAPE_SIZE - 1)).toBe(1024);
    expect(visibleCells(999999)).toBe(1024);
  });

  it("a célula do ponteiro está sempre dentro do recorte mostrado", () => {
    const p = compile(">".repeat(500));
    const m = createMachine(false);
    run(p, m, new Uint8Array(0), 600);
    const v = snapshot(m);
    expect(v.ptr).toBeLessThan(v.tape.length);
  });

  it("a saída copiada não é afetada por execuções seguintes", () => {
    const p = compile("+++++.+.");
    const m = createMachine(false);
    run(p, m, new Uint8Array(0), 6);
    const v1 = snapshot(m);
    run(p, m, new Uint8Array(0), 10);
    expect(v1.out.length).toBe(1);
    expect(m.outLen).toBe(2);
  });

  it("expõe canStepBack para a interface", () => {
    const p = compile("+");
    const m = createMachine();
    expect(snapshot(m).canStepBack).toBe(false);
    run(p, m, new Uint8Array(0), 1);
    expect(snapshot(m).canStepBack).toBe(true);
  });
});

describe("liveAt — visualização ao vivo", () => {
  it("no começo mostra a fita zerada", () => {
    const { view, state } = liveAt(compile("+++++."), 0, new Uint8Array(0));
    expect(state).toBe("ok");
    expect(view.tape[0]).toBe(0);
    expect(view.pc).toBe(0);
  });

  it("no fim mostra o estado depois de executar tudo", () => {
    const src = "+++>++++";
    const { view, state } = liveAt(compile(src), src.length, new Uint8Array(0));
    expect(state).toBe("ok");
    expect(view.tape[0]).toBe(3);
    expect(view.tape[1]).toBe(4);
    expect(view.ptr).toBe(1);
  });

  it("no meio de um comentário mostra o estado do próximo comando", () => {
    const src = "++ abc >+";
    const { view, state } = liveAt(compile(src), 5, new Uint8Array(0));
    expect(state).toBe("ok");
    expect(view.tape[0]).toBe(2);
    expect(view.ptr).toBe(0);
  });

  it("programa sem comandos não quebra", () => {
    const { state } = liveAt(compile("so um comentario"), 3, new Uint8Array(0));
    expect(state).toBe("ok");
  });

  it("erro de sintaxe devolve state=syntax", () => {
    const { state } = liveAt(compile("+++["), 3, new Uint8Array(0));
    expect(state).toBe("syntax");
  });

  it("erro de execução antes do cursor é reportado com o pc certo", () => {
    const src = "+<++++";
    const { view, state } = liveAt(compile(src), src.length, new Uint8Array(0));
    expect(state).toBe("error");
    expect(view.error).toMatch(/esquerda/);
    expect(view.errorPc).toBe(1);
  });

  it("cursor dentro de um loop que nunca roda vira unreached", () => {
    const { state } = liveAt(compile("[+]"), 2, new Uint8Array(0));
    expect(state).toBe("unreached");
  });

  it("cursor depois do último comando mostra o estado final", () => {
    const { view, state } = liveAt(compile("++"), 2, new Uint8Array(0));
    expect(state).toBe("ok");
    expect(view.halted).toBe(true);
    expect(view.pc).toBe(2);
    expect(view.tape[0]).toBe(2);
  });

  it("para de calcular depois do limite de instruções (loop infinito)", () => {
    const src = "+[]"; // loop infinito: a célula nunca zera
    const { state } = liveAt(compile(src), 3, new Uint8Array(0));
    expect(state).toBe("limit");
  });

  it("usa a entrada fornecida", () => {
    const { view } = liveAt(compile(",+."), 3, enc("A"));
    expect(view.tape[0]).toBe(66);
  });
});

describe("programas reais", () => {
  it("Hello World", () => {
    const { text, m } = exec(HELLO);
    expect(text).toBe("Hello World!\n");
    expect(m.halted).toBe(true);
    expect(m.error).toBeNull();
    expect(m.steps).toBeGreaterThan(500);
  });

  it("comentários sem símbolos de comando não mudam nada", () => {
    const src = "isso eh um comentario sem simbolos\n" + HELLO;
    expect(exec(src).text).toBe("Hello World!\n");
  });

  it("símbolo de comando dentro de comentário VIRA comando (armadilha conhecida)", () => {
    // o '+' do comentário incrementa a célula 0 antes do programa começar
    const src = "um comentario com + no meio\n" + HELLO;
    expect(exec(src).text).not.toBe("Hello World!\n");
  });

  it("cat (ecoar a entrada)", () => {
    expect(exec(",[.,]", "ola mundo").text).toBe("ola mundo");
  });

  it("alfabeto de A a Z", () => {
    const src = "++++++++[>++++++++<-]>+" + ">" + "+".repeat(26) + "[<.+>-]";
    expect(exec(src).text).toBe("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
  });

  it("soma dois dígitos da entrada (2 + 3 = 5)", () => {
    const menos48 = "-".repeat(48);
    const mais48 = "+".repeat(48);
    const src = `,${menos48}>,${menos48}[<+>-]<${mais48}.`;
    expect(exec(src, "23").text).toBe("5");
  });

  it("multiplicação 6 × 7 = 42 ('*')", () => {
    expect(exec("++++++[>+++++++<-]>.").text).toBe("*");
  });

  it("inverte uma string da entrada", () => {
    // guarda os bytes a partir da célula 1 e depois volta imprimindo
    const src = ">,[>,]<[.<]";
    expect(exec(src, "abc").text).toBe("cba");
  });
});
