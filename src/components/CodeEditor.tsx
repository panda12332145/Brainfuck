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

export function highlight(code: string, activePos = -1, errorPos = -1): ReactNode[] {
  const nodes: ReactNode[] = [];
  let buf = "";
  let cls = "";
  const flush = () => {
    if (buf) nodes.push(<span key={nodes.length} className={cls}>{buf}</span>);
    buf = "";
  };
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    let k = CLS[c] ?? "text-slate-500";
    if (i === errorPos) k = "bg-rose-500 text-white rounded-sm";
    else if (i === activePos) k = "bg-amber-400 text-slate-900 rounded-sm";
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
  taRef: RefObject<HTMLTextAreaElement | null>;
}

export function CodeEditor({ value, onChange, onCaret, activePos, activeLine, errorPos, taRef }: Props) {
  const nodes = useMemo(() => highlight(value, activePos, errorPos), [value, activePos, errorPos]);
  const lineCount = value.split("\n").length;

  return (
    <div className="flex max-h-[440px] min-h-[240px] overflow-auto bg-slate-950 font-mono text-[15px] leading-6">
      <div className="sticky left-0 z-10 shrink-0 select-none border-r border-slate-800 bg-slate-950 py-4 text-right text-xs text-slate-600">
        {Array.from({ length: lineCount }, (_, i) => (
          <div
            key={i}
            className={
              "h-6 px-3 leading-6 " +
              (i === activeLine ? "bg-amber-400/15 font-bold text-amber-300" : "")
            }
          >
            {i + 1}
          </div>
        ))}
      </div>
      <div className="relative min-w-max flex-1">
        <pre className="pointer-events-none m-0 min-h-full whitespace-pre p-4 pr-10 font-mono text-[15px] leading-6" aria-hidden>
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
          className="absolute inset-0 h-full w-full resize-none overflow-hidden whitespace-pre bg-transparent p-4 pr-10 font-mono text-[15px] leading-6 text-transparent caret-white outline-none selection:bg-sky-500/30 placeholder:text-slate-600"
        />
      </div>
    </div>
  );
}
