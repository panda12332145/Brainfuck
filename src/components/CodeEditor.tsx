import { useMemo, type ReactNode, type RefObject } from "react";

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

  return (
    <div className="flex max-h-[440px] min-h-[240px] overflow-auto bg-slate-950 font-mono text-[15px] leading-6">
      {/* régua de linhas — clique para marcar um breakpoint */}
      <div className="sticky left-0 z-10 shrink-0 select-none border-r border-slate-800 bg-slate-950 py-4 text-right">
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

      <div className="relative min-w-max flex-1">
        <pre
          className="pointer-events-none m-0 min-h-full p-4 pr-10 font-mono text-[15px] leading-6 whitespace-pre"
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
          aria-label="Editor de código Brainfuck"
          placeholder="Escreva seu código Brainfuck aqui…"
          onChange={(e) => {
            onChange(e.target.value);
            onCaret(e.target.selectionStart);
          }}
          onSelect={(e) => onCaret(e.currentTarget.selectionStart)}
          onKeyUp={(e) => onCaret(e.currentTarget.selectionStart)}
          onClick={(e) => onCaret(e.currentTarget.selectionStart)}
          onFocus={(e) => onCaret(e.currentTarget.selectionStart)}
          className="absolute inset-0 h-full w-full resize-none overflow-hidden bg-transparent p-4 pr-10 font-mono text-[15px] leading-6 whitespace-pre text-transparent caret-white outline-none selection:bg-sky-500/30 placeholder:text-slate-600"
        />
      </div>
    </div>
  );
}
