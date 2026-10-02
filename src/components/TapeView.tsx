import { memo, useCallback, useEffect, useRef } from "react";
import { charLabel } from "../bf/ascii";
import { TAPE_SIZE, type View } from "../bf/interpreter";

interface CellProps {
  i: number;
  v: number;
  isPtr: boolean;
  isSel: boolean;
  isLast: boolean;
  onSelect: (i: number) => void;
}

/**
 * Uma célula da fita. É `memo` de propósito: num passo só 2 ou 3 células mudam,
 * então as outras ~1000 não precisam ser renderizadas de novo.
 */
const Cell = memo(function Cell({ i, v, isPtr, isSel, isLast, onSelect }: CellProps) {
  return (
    <button
      type="button"
      data-ptr={isPtr ? "1" : undefined}
      onClick={() => onSelect(i)}
      title={`Célula #${i} = ${v} (${charLabel(v)})`}
      style={{ backgroundColor: `rgba(16,185,129,${(0.04 + (v / 255) * 0.38).toFixed(3)})` }}
      className={
        "relative flex h-[74px] flex-col items-center justify-between rounded-lg border px-1 py-1.5 text-center transition-colors " +
        (isPtr
          ? "border-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.45)] "
          : "border-slate-700/80 hover:border-slate-500 ") +
        (isSel ? "outline-2 outline-offset-1 outline-sky-400 " : "") +
        (isLast ? "cell-flash " : "")
      }
    >
      {isPtr && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded bg-amber-400 px-1.5 text-[9px] font-extrabold leading-4 text-slate-900">
          PTR ▼
        </span>
      )}
      <span className="text-[10px] font-medium text-slate-500">#{i}</span>
      <span className="font-mono text-xl leading-none font-bold text-slate-50">{v}</span>
      <span className="font-mono text-[11px] leading-none text-emerald-300/90">{charLabel(v)}</span>
    </button>
  );
});

interface Props {
  view: View;
  selected: number;
  userSelected: boolean;
  flash: boolean;
  onSelect: (i: number) => void;
}

export function TapeView({ view, selected, userSelected, flash, onSelect }: Props) {
  const wrap = useRef<HTMLDivElement>(null);

  /* mantém o callback estável para o memo das células funcionar */
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const handleSelect = useCallback((i: number) => selectRef.current(i), []);

  /* rola a fita até o ponteiro quando ele sai da área visível */
  useEffect(() => {
    const c = wrap.current;
    const el = c?.querySelector<HTMLElement>('[data-ptr="1"]');
    if (!el || !c) return;
    if (el.offsetTop < c.scrollTop + 8) {
      c.scrollTop = Math.max(0, el.offsetTop - 12);
    } else if (el.offsetTop + el.offsetHeight > c.scrollTop + c.clientHeight - 8) {
      c.scrollTop = el.offsetTop + el.offsetHeight - c.clientHeight + 12;
    }
  }, [view.ptr]);

  const tape = view.tape;
  const hidden = Math.min(TAPE_SIZE, view.maxPtr + 1) > tape.length;
  const isDebug = flash;

  return (
    <div>
      <div
        ref={wrap}
        role="grid"
        aria-label="Fita de memória"
        className="relative grid max-h-[272px] grid-cols-[repeat(auto-fill,minmax(66px,1fr))] gap-2 overflow-y-auto px-1 pt-4 pb-2"
      >
        {Array.from(tape, (v, i) => {
          const isLast = isDebug && i === view.lastCell;
          return (
            <Cell
              key={isLast ? `f${i}-${view.steps}` : i}
              i={i}
              v={v}
              isPtr={i === view.ptr}
              isSel={userSelected && i === selected}
              isLast={isLast}
              onSelect={handleSelect}
            />
          );
        })}
      </div>
      {hidden && (
        <p className="mt-1 text-xs text-slate-500">
          Mostrando as primeiras {tape.length} células (a fita tem {TAPE_SIZE.toLocaleString("pt-BR")}).
        </p>
      )}
    </div>
  );
}
