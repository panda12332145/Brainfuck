import { useState } from "react";
import { highlight } from "./CodeEditor";
import { buildCode, CATEGORIES, COMMANDS, IDIOMS, LESSONS, type Category, type Lesson } from "../bf/lessons";

function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("`").map((p, i) =>
        i % 2 ? (
          <code key={i} className="rounded bg-slate-800 px-1 py-0.5 font-mono text-[12px] text-amber-300">
            {p}
          </code>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

const LEVEL: Record<Lesson["level"], string> = {
  Iniciante: "bg-emerald-500/15 text-emerald-300",
  Intermediário: "bg-amber-500/15 text-amber-300",
  Avançado: "bg-rose-500/15 text-rose-300",
};

export function Lessons({ onLoad, currentCode }: { onLoad: (l: Lesson) => void; currentCode: string }) {
  const [tab, setTab] = useState<"licoes" | "ref">("licoes");
  const [cat, setCat] = useState<Category | "Todas">("Todas");
  const [open, setOpen] = useState<string | null>("numeros-grandes");

  const list = LESSONS.filter((l) => cat === "Todas" || l.category === cat);

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-1 border-b border-slate-800 p-2">
        {(
          [
            ["licoes", "📚 Aprender"],
            ["ref", "⌨️ Referência"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={
              "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors " +
              (tab === k ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200")
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "licoes" ? (
          <>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {(["Todas", ...CATEGORIES] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={
                    "rounded-full border px-2.5 py-1 text-xs transition-colors " +
                    (cat === c
                      ? "border-sky-400 bg-sky-400/15 text-sky-200"
                      : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200")
                  }
                >
                  {c}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {list.map((l) => {
                const isOpen = open === l.id;
                const code = buildCode(l);
                const loaded = code === currentCode;
                return (
                  <div key={l.id} className={"overflow-hidden rounded-xl border " + (isOpen ? "border-slate-600 bg-slate-900" : "border-slate-800 bg-slate-900/50")}>
                    <button onClick={() => setOpen(isOpen ? null : l.id)} className="flex w-full items-start gap-2 p-3 text-left">
                      <span className={"mt-0.5 text-slate-500 transition-transform " + (isOpen ? "rotate-90" : "")}>▶</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-100">{l.title}</span>
                          <span className={"rounded px-1.5 py-0.5 text-[10px] font-semibold " + LEVEL[l.level]}>{l.level}</span>
                          {loaded && <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] text-sky-300">no editor</span>}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-400">
                          <Rich text={l.summary} />
                        </span>
                      </span>
                    </button>
                    {isOpen && (
                      <div className="space-y-3 border-t border-slate-800 p-3">
                        <pre className="max-h-64 overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-[12px] leading-5 whitespace-pre">
                          {highlight(code)}
                        </pre>
                        {l.input && (
                          <p className="text-xs text-slate-400">
                            Entrada sugerida: <code className="rounded bg-slate-800 px-1 py-0.5 text-slate-200">{l.input}</code>
                          </p>
                        )}
                        {l.explain.map((p, i) => (
                          <p key={i} className="text-sm leading-relaxed text-slate-300">
                            <Rich text={p} />
                          </p>
                        ))}
                        {l.tip && (
                          <p className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-2.5 text-xs text-sky-200">💡 {l.tip}</p>
                        )}
                        <button
                          onClick={() => onLoad(l)}
                          className="w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
                        >
                          Carregar no editor
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="space-y-5">
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Os 8 comandos</h3>
              <div className="space-y-1.5">
                {COMMANDS.map((c) => (
                  <div key={c.sym} className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-950 font-mono text-lg font-bold">
                      {highlight(c.sym)}
                    </span>
                    <div className="min-w-0 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-100">{c.name}</span>
                        <code className="font-mono text-xs text-amber-300">{c.c}</code>
                      </div>
                      <p className="text-xs text-slate-400">{c.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Truques (idiomas) mais usados</h3>
              <div className="space-y-1.5">
                {IDIOMS.map((i) => (
                  <div key={i.code} className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-200">{i.title}</span>
                      <code className="rounded bg-slate-950 px-1.5 py-0.5 font-mono text-xs">{highlight(i.code)}</code>
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-slate-500">{i.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-2 text-sm text-slate-300">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Regras desta implementação</h3>
              <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-400">
                <li>Fita de 30.000 células, todas começando em 0.</li>
                <li>Células de 8 bits: 255 + 1 = 0 e 0 − 1 = 255.</li>
                <li>Sair da fita pela esquerda ou direita gera um erro.</li>
                <li>
                  <Rich text="`,` sem entrada disponível grava 0 na célula." />
                </li>
                <li>Qualquer caractere fora dos 8 comandos é comentário.</li>
                <li>Atalhos: Ctrl+Enter executa, F10 dá um passo, Shift+F10 avança uma linha.</li>
              </ul>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
