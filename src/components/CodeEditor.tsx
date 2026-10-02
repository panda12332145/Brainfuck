import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
} from "react";

const CLS: Record<string, string> = {
  ">": "text-sky-400",
  "<": "text-sky-400",
  "+": "text-emerald-400",
  "-": "text-rose-400",
  "[": "text-amber-300",
  "]": "text-amber-300",
  ".": "text-fuchsia-400",
  ",": "text-fuchsia-400",
};

export interface HighlightOptions {
  /** comando em execução (fundo âmbar) */
  activePos?: number;
  /** comando com erro (fundo vermelho) */
  errorPos?: number;
  /** colchete parceiro do comando ativo (fundo azul) */
  pairPos?: number;
}

/** Pinta o código por grupos de caracteres com a mesma classe (evita 1 <span> por letra). */
export function highlight(code: string, activePos = -1, errorPos = -1, pairPos = -1): ReactNode[] {
  const nodes: ReactNode[] = [];
  let buf = "";
  let cls = "";
  const flush = () => {
    if (buf) {
      nodes.push(
        <span key={nodes.length} className={cls}>
          {buf}
        </span>,
      );
      buf = "";
    }
  };
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    let k = CLS[c] ?? "text-slate-500";
    if (i === errorPos) k = "rounded-sm bg-rose-500 font-bold text-white";
    else if (i === activePos) k = "rounded-sm bg-amber-400 font-bold text-slate-900";
    else if (i === pairPos) k = "rounded-sm bg-sky-500/40 text-sky-100";
    if (k !== cls) {
      flush();
      cls = k;
    }
    buf += c;
  }
  flush();
  return nodes;
}

/* useLayoutEffect não existe no servidor; assim o teste de renderização não reclama */
const useBeforePaint = typeof window !== "undefined" ? useLayoutEffect : useEffect;

let canvasCtx: CanvasRenderingContext2D | null | undefined;
function measureCtx(): CanvasRenderingContext2D | null {
  if (canvasCtx === undefined) canvasCtx = document.createElement("canvas").getContext("2d");
  return canvasCtx;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  onCaret: (pos: number) => void;
  activePos: number;
  activeLine: number;
  errorPos: number;
  errorLine: number;
  pairPos: number;
  /** linhas (0-based) marcadas como breakpoint */
  breakpoints: ReadonlySet<number>;
  onToggleBreakpoint: (line: number) => void;
  taRef: RefObject<HTMLTextAreaElement | null>;
}

export function CodeEditor({
  value,
  onChange,
  onCaret,
  activePos,
  activeLine,
  errorPos,
  errorLine,
  pairPos,
  breakpoints,
  onToggleBreakpoint,
  taRef,
}: Props) {
  const nodes = useMemo(
    () => highlight(value, activePos, errorPos, pairPos),
    [value, activePos, errorPos, pairPos],
  );
  const lineCount = useMemo(() => value.split("\n").length, [value]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLDivElement>(null);

  /**
   * O segredo deste editor: o <textarea> é invisível e fica exatamente em cima
   * do <pre> colorido. Se os dois saírem do lugar um em relação ao outro, você
   * vê uma linha e digita em outra. Por isso:
   *
   *  1. o <textarea> tem SEMPRE a altura do conteúdo inteiro (ele nunca rola
   *     por dentro — quem rola é o contêiner externo, junto com o <pre>);
   *  2. `syncScroll` zera o scroll interno dele e rola o contêiner externo até
   *     o cursor ficar visível.
   */
  const syncScroll = useCallback(() => {
    const ta = taRef.current;
    const box = scrollRef.current;
    const code = codeRef.current;
    if (!ta || !box || !code) return;

    /* 1) o textarea nunca pode ter rolagem própria */
    if (ta.scrollTop !== 0) ta.scrollTop = 0;
    if (ta.scrollLeft !== 0) ta.scrollLeft = 0;

    /* 2) métricas reais, lidas do próprio elemento (não depende de classe) */
    const cs = getComputedStyle(ta);
    const lh = parseFloat(cs.lineHeight) || 24;
    const padTop = parseFloat(cs.paddingTop) || 0;
    const padLeft = parseFloat(cs.paddingLeft) || 0;
    let cw = 9;
    const ctx = measureCtx();
    if (ctx) {
      ctx.font =
        cs.font ||
        `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} / ${cs.lineHeight} ${cs.fontFamily}`;
      const w = ctx.measureText("M").width;
      if (w > 0) cw = w;
    }
    const gutter = code.offsetLeft; // largura da régua de linhas + borda

    /* 3) onde o cursor está, em pixels */
    const pos = ta.selectionStart ?? 0;
    const before = ta.value.slice(0, pos);
    const nl = before.lastIndexOf("\n");
    const line = nl < 0 ? 0 : before.split("\n").length - 1;
    const col = pos - nl - 1;
    const y = padTop + line * lh;
    const x = gutter + padLeft + col * cw;

    /* 4) rola o contêiner externo o mínimo necessário para o cursor aparecer */
    if (y < box.scrollTop + 8) {
      box.scrollTop = Math.max(0, y - lh);
    } else if (y + lh > box.scrollTop + box.clientHeight - 8) {
      box.scrollTop = y + lh - box.clientHeight + lh;
    }
    if (x < box.scrollLeft + gutter + 8) {
      box.scrollLeft = Math.max(0, x - gutter - cw * 4);
    } else if (x + cw > box.scrollLeft + box.clientWidth - 16) {
      box.scrollLeft = x + cw - box.clientWidth + cw * 4;
    }
  }, [taRef]);

  /* reaplica depois de cada mudança de conteúdo, antes do navegador pintar */
  useBeforePaint(() => {
    syncScroll();
  }, [value, syncScroll]);

  /* se a janela mudar de tamanho, as medidas mudam junto */
  useEffect(() => {
    const onResize = () => syncScroll();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [syncScroll]);

  const handleSelect = (e: SyntheticEvent<HTMLTextAreaElement>) => {
    onCaret(e.currentTarget.selectionStart);
    syncScroll();
  };

  return (
    <div
      ref={scrollRef}
      className="min-h-[240px] overflow-auto bg-slate-950 font-mono text-[15px] leading-6"
      style={{ maxHeight: "min(60vh, 640px)" }}
    >
      {/* items-start: cada coluna fica com a SUA altura real. Com o padrão
          (stretch) o navegador achatava a coluna do código para os 440px do
          contêiner e o textarea passava a rolar sozinho por dentro. */}
      <div className="flex min-w-max items-start">
        {/* régua de linhas — clique para marcar um breakpoint */}
        <div className="sticky left-0 z-10 shrink-0 self-stretch border-r border-slate-800 bg-slate-950 py-4 text-right select-none">
          {Array.from({ length: lineCount }, (_, i) => {
            const bp = breakpoints.has(i);
            const active = i === activeLine;
            const failed = i === errorLine;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onToggleBreakpoint(i)}
                title={bp ? `Remover breakpoint da linha ${i + 1}` : `Marcar breakpoint na linha ${i + 1}`}
                className={
                  "group flex h-6 w-[74px] items-center justify-end gap-1.5 px-2 text-xs leading-6 transition-colors " +
                  (active
                    ? "bg-amber-400/15 font-bold text-amber-300"
                    : failed
                      ? "bg-rose-500/15 font-bold text-rose-300"
                      : "text-slate-600 hover:bg-slate-800/70 hover:text-slate-300")
                }
              >
                <span
                  className={
                    "h-2 w-2 shrink-0 rounded-full transition-opacity " +
                    (bp
                      ? "bg-rose-500 opacity-100 shadow-[0_0_6px_rgba(244,63,94,0.9)]"
                      : failed
                        ? "bg-rose-500 opacity-60"
                        : "bg-rose-500 opacity-0 group-hover:opacity-30")
                  }
                />
                <span className="tabular-nums">{i + 1}</span>
              </button>
            );
          })}
        </div>

        <div ref={codeRef} className="relative min-h-[240px]">
          <pre
            className="pointer-events-none m-0 p-4 pr-10 font-mono text-[15px] leading-6 whitespace-pre"
            aria-hidden="true"
          >
            {nodes}
            {"\n"}
          </pre>
          <textarea
            ref={taRef}
            value={value}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            wrap="off"
            rows={lineCount + 1}
            aria-label="Editor de código Brainfuck"
            placeholder="Escreva seu código Brainfuck aqui…"
            onChange={(e) => {
              onChange(e.target.value);
              onCaret(e.currentTarget.selectionStart);
              syncScroll();
            }}
            onSelect={handleSelect}
            onKeyUp={handleSelect}
            onClick={handleSelect}
            onFocus={handleSelect}
            onScroll={() => {
              /* rede de segurança: se algum navegador insistir em rolar o
                 textarea por dentro, desfaz na hora */
              const ta = taRef.current;
              if (ta && (ta.scrollTop !== 0 || ta.scrollLeft !== 0)) {
                ta.scrollTop = 0;
                ta.scrollLeft = 0;
              }
            }}
            className="absolute inset-0 h-full w-full resize-none overflow-hidden bg-transparent p-4 pr-10 font-mono text-[15px] leading-6 whitespace-pre text-transparent caret-white outline-none selection:bg-sky-500/30 placeholder:text-slate-600"
          />
        </div>
      </div>
    </div>
  );
}
