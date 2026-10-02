import { useEffect, useRef } from "react";
import { charLabel } from "../bf/ascii";
import { TAPE_SIZE, type View } from "../bf/interpreter";

interface Props {
  view: View;
  selected: number;
  userSelected: boolean;
  flash: boolean;
  onSelect: (i: number) => void;
}

export function TapeView({ view, selected, userSelected, flash, onSelect }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const refs = useRef<Map<number, HTMLButtonElement>>(new Map());

  useEffect(() => {
    const el = refs.current.get(view.ptr);
    const c = wrap.current;
    if (!el || !c) return;
    if (el.offsetTop < c.scrollTop + 8) c.scrollTop = Math.max(0, el.offsetTop - 12);
    else if (el.offsetTop + el.offsetHeight > c.scrollTop + c.clientHeight - 8)
      c.scrollTop = el.offsetTop + el.offsetHeight - c.clientHeight + 12;
  }, [view.ptr]);

  const cells = Array.from(view.tape);
  const hidden = Math.min(TAPE_SIZE, view.maxPtr + 1) > cells.length;

  return (
    <div>
      <div
        ref={wrap}
        className="relative grid max-h-[272px] grid-cols-[repeat(auto-fill,minmax(66px,1fr))] gap-2 overflow-y-auto px-1 pb-2 pt-4"
      >
        {cells.map((v, i) => {
          const isPtr = i === view.ptr;
          const isSel = i === selected;
          const isLast = flash && i === view.lastCell;
          return (
            <button
              key={isLast ? `f${view.steps}` : i}
              ref={(el) => {
                if (el) refs.current.set(i, el);
                else refs.current.delete(i);
              }}
              onClick={() => onSelect(i)}
              title={`Célula #${i} = ${v} (${charLabel(v)})`}
              style={{ backgroundColor: `rgba(16,185,129,${0.04 + (v / 255) * 0.38})` }}
              className={
                "relative flex h-[74px] flex-col items-center justify-between rounded-lg border px-1 py-1.5 text-center transition-colors " +
                (isPtr
                  ? "border-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.45)] "
                  : "border-slate-700/80 hover:border-slate-500 ") +
                (isSel && userSelected ? "outline-2 outline-offset-1 outline-sky-400 " : "") +
                (isLast ? "cell-flash " : "")
              }
            >
              {isPtr && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded bg-amber-400 px-1.5 text-[9px] font-extrabold leading-4 text-slate-900">
                  PTR ▼
                </span>
              )}
              <span className="text-[10px] font-medium text-slate-500">#{i}</span>
              <span className="font-mono text-xl font-bold leading-none text-slate-50">{v}</span>
              <span className="font-mono text-[11px] leading-none text-emerald-300/90">{charLabel(v)}</span>
            </button>
          );
        })}
      </div>
      {hidden && (
        <p className="mt-1 text-xs text-slate-500">Mostrando as primeiras {cells.length} células (a fita tem {TAPE_SIZE}).</p>
      )}
    </div>
  );
}
