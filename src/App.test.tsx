/**
 * Teste de fumaça da interface: garante que os componentes renderizam sem
 * quebrar (nada de "undefined is not an object" na primeira tela).
 */
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import App from "./App";
import { CodeEditor } from "./components/CodeEditor";
import { Inspector } from "./components/Inspector";
import { Lessons } from "./components/Lessons";
import { TapeView } from "./components/TapeView";
import { compile, createMachine, run, snapshot } from "./bf/interpreter";
import { charLabel, category, describe as describeChar, suggest } from "./bf/ascii";

const noop = () => {};

describe("renderização", () => {
  it("o App inteiro renderiza sem erro", () => {
    const html = renderToString(<App />);
    expect(html).toContain("BF Studio");
    expect(html).toContain("Fita de memória");
    expect(html).toContain("Inspetor de célula");
  });

  it("a fita renderiza as células e marca o ponteiro", () => {
    const p = compile("+++>+++++");
    const m = createMachine(false);
    run(p, m, new Uint8Array(0), 100);
    const html = renderToString(
      <TapeView view={snapshot(m)} selected={1} userSelected={false} flash={false} onSelect={noop} />,
    );
    expect(html).toContain('data-ptr="1"');
    expect(html).toContain("#0");
    expect(html).toContain("#1");
  });

  it("o editor renderiza a régua de linhas e os breakpoints", () => {
    const html = renderToString(
      <CodeEditor
        value={"++\n>+"}
        onChange={noop}
        onCaret={noop}
        activePos={-1}
        activeLine={-1}
        errorPos={-1}
        errorLine={1}
        pairPos={-1}
        breakpoints={new Set([0])}
        onToggleBreakpoint={noop}
        taRef={{ current: null }}
      />,
    );
    // a linha 1 já tem breakpoint; a linha 2 está oferecendo um
    expect(html).toContain("Remover breakpoint da linha 1");
    expect(html).toContain("Marcar breakpoint na linha 2");
    expect(html).toContain(">2<");
  });

  it("o inspetor mostra o valor em decimal, hex e binário", () => {
    const html = renderToString(
      <Inspector index={3} value={65} isPtr following onFollow={noop} />,
    );
    expect(html).toContain("Hex");
    expect(html).toContain("0x");
    expect(html).toContain(">65<");
    expect(html).toContain("Letra maiúscula");
    // o gerador de valores sugere um loop que produz 65
    expect(html).toContain("++++++++[&gt;++++++++&lt;-]&gt;+");
  });

  it("as lições renderizam a lista e a referência", () => {
    const html = renderToString(<Lessons onLoad={noop} onLoadCode={noop} currentCode="" />);
    expect(html).toContain("Aprender");
    expect(html).toContain("Gerador");
  });
});

describe("ascii", () => {
  it("charLabel cobre os 256 valores sem lançar erro", () => {
    for (let v = 0; v < 256; v++) {
      expect(typeof charLabel(v)).toBe("string");
      expect(charLabel(v).length).toBeGreaterThan(0);
    }
  });

  it("category e describe cobrem os 256 valores", () => {
    for (let v = 0; v < 256; v++) {
      expect(category(v).length).toBeGreaterThan(0);
      expect(describeChar(v).length).toBeGreaterThan(0);
    }
  });

  it("suggest devolve código que realmente produz o valor pedido", () => {
    for (let v = 0; v < 256; v++) {
      const s = suggest(v);
      const p = compile(s.code);
      expect(p.error, `valor ${v}: ${s.code}`).toBeNull();
      const m = createMachine(false);
      run(p, m, new Uint8Array(0), 100000);
      expect(m.error, `valor ${v}: ${s.code}`).toBeNull();
      // o resultado fica na célula atual ou na seguinte, conforme o tipo
      const got = s.kind === "loop" ? m.tape[1] : m.tape[0];
      expect(got, `valor ${v} com ${s.code} (ptr=${m.ptr})`).toBe(v);
    }
  });
});
