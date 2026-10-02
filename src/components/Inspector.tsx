import { useEffect, useState } from "react";
import { category, charLabel, describe, isPrintable, suggest } from "../bf/ascii";

interface Props {
  index: number;
  value: number;
  isPtr: boolean;
  following: boolean;
  onFollow: () => void;
}

export function Inspector({ index, value, isPtr, following, onFollow }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => setPinned(null), [index]);

  const v = hover ?? pinned ?? value;
  const preview = v !== value;
  const bin = v.toString(2).padStart(8, "0");
  const sug = suggest(v);
  const glyph = isPrintable(v) ? String.fromCharCode(v) : charLabel(v);

  const copy = () => {
    navigator.clipboard?.writeText(sug.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm text-slate-400">
            {preview ? (
              <span className="text-sky-300">Pré-visualizando valor {v}</span>
            ) : (
              <>
                Célula <span className="font-mono font-bold text-slate-100">#{index}</span>
                {isPtr && <span className="ml-2 rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-slate-900">PTR</span>}
              </>
            )}
          </div>
          {!following && (
            <button
              onClick={onFollow}
              className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
            >
              Seguir ponteiro
            </button>
          )}
        </div>

        <div className="flex items-stretch gap-3">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/10 font-mono text-4xl font-bold text-emerald-300">
            {glyph}
          </div>
          <dl className="grid flex-1 grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 font-mono text-sm">
            <dt className="text-slate-500">Dec</dt>
            <dd className="font-bold text-slate-100">{v}</dd>
            <dt className="text-slate-500">Hex</dt>
            <dd className="text-slate-200">0x{v.toString(16).toUpperCase().padStart(2, "0")}</dd>
            <dt className="text-slate-500">Oct</dt>
            <dd className="text-slate-200">{v.toString(8)}</dd>
            <dt className="text-slate-500">Char</dt>
            <dd className="text-slate-200">{v >= 32 && v < 127 ? `'${String.fromCharCode(v)}'` : charLabel(v)}</dd>
          </dl>
        </div>

        <div className="flex gap-1" title="Bits (o bit mais à esquerda vale 128)">
          {bin.split("").map((b, i) => (
            <div
              key={i}
              className={
                "flex flex-1 flex-col items-center rounded-md border py-1 font-mono text-xs " +
                (b === "1" ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-200" : "border-slate-800 bg-slate-900 text-slate-600")
              }
            >
              <span className="font-bold">{b}</span>
              <span className="text-[9px] opacity-70">{128 >> i}</span>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-sky-300">{category(v)}</div>
          <p className="text-slate-300">{describe(v)}</p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Como gerar este valor</span>
            <button onClick={copy} className="rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800">
              {copied ? "Copiado ✓" : "Copiar"}
            </button>
          </div>
          <code className="block max-h-20 overflow-auto break-all rounded bg-slate-950 p-2 font-mono text-xs text-amber-200">{sug.code}</code>
          <p className="mt-1.5 text-xs text-slate-400">{sug.desc}</p>
        </div>
      </div>

      <div className="min-w-0 overflow-x-auto">
        <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold uppercase tracking-wide">Tabela ASCII</span>
          <span>passe o mouse ou clique para pré-visualizar</span>
        </div>
        <div className="grid min-w-[640px] grid-cols-[28px_repeat(16,minmax(0,1fr))] gap-[3px] text-center">
          <div />
          {Array.from({ length: 16 }, (_, c) => (
            <div key={c} className="font-mono text-[10px] text-slate-500">
              _{c.toString(16).toUpperCase()}
            </div>
          ))}
          {Array.from({ length: 8 }, (_, r) => (
            <Row key={r} r={r} cellValue={value} shown={v} onHover={setHover} onPin={(n) => setPinned((p) => (p === n ? null : n))} />
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          O brilho <span className="text-amber-300">amarelo</span> marca o valor mostrado. A borda <span className="text-emerald-300">verde</span> marca o valor real da célula selecionada.
        </p>
      </div>
    </div>
  );
}

function Row({
  r,
  cellValue,
  shown,
  onHover,
  onPin,
}: {
  r: number;
  cellValue: number;
  shown: number;
  onHover: (n: number | null) => void;
  onPin: (n: number) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-center font-mono text-[10px] text-slate-500">{r.toString(16).toUpperCase()}_</div>
      {Array.from({ length: 16 }, (_, c) => {
        const n = r * 16 + c;
        const isShown = n === shown;
        const isCell = n === cellValue;
        return (
          <button
            key={c}
            onMouseEnter={() => onHover(n)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onPin(n)}
            className={
              "flex h-11 flex-col items-center justify-center rounded border transition-colors " +
              (isShown
                ? "border-amber-400 bg-amber-400/25 shadow-[0_0_10px_rgba(251,191,36,0.4)] "
                : isCell
                  ? "border-emerald-400 bg-emerald-500/15 "
                  : "border-slate-800 bg-slate-900/70 hover:border-slate-600 hover:bg-slate-800 ") +
              (n < 32 || n === 127 ? "text-slate-500" : "text-slate-100")
            }
          >
            <span className={"font-mono leading-none " + (n < 32 || n === 127 ? "text-[9px]" : "text-sm font-bold")}>{charLabel(n)}</span>
            <span className="mt-0.5 font-mono text-[9px] leading-none text-slate-500">{n}</span>
          </button>
        );
      })}
    </>
  );
}
