import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CodeEditor } from "./components/CodeEditor";
import { TapeView } from "./components/TapeView";
import { Inspector } from "./components/Inspector";
import { Lessons } from "./components/Lessons";
import { buildCode, LESSONS, type Lesson } from "./bf/lessons";
import {
  compile,
  createMachine,
  liveAt,
  run,
  snapshot,
  type LiveState,
  type Machine,
  type Program,
  type View,
} from "./bf/interpreter";
import { charLabel } from "./bf/ascii";

type Status = "idle" | "paused" | "running" | "auto" | "done" | "error";

const DEFAULT_CODE = buildCode(LESSONS.find((l) => l.id === "numeros-grandes")!);

const STATUS_LABEL: Record<Status, string> = {
  idle: "Pronto",
  paused: "Pausado",
  running: "Executando…",
  auto: "Passo automático",
  done: "Finalizado",
  error: "Erro",
};

const STATUS_STYLE: Record<Status, string> = {
  idle: "bg-slate-700/60 text-slate-300",
  paused: "bg-amber-400/20 text-amber-300",
  running: "bg-sky-500/20 text-sky-300",
  auto: "bg-sky-500/20 text-sky-300",
  done: "bg-emerald-500/20 text-emerald-300",
  error: "bg-rose-500/20 text-rose-300",
};

// velocidade 1..10 -> [atraso em ms, passos por tick]
const SPEEDS: [number, number][] = [
  [1000, 1],
  [650, 1],
  [400, 1],
  [250, 1],
  [150, 1],
  [90, 1],
  [50, 1],
  [25, 1],
  [10, 1],
  [0, 20],
];

const PALETTE: { ch: string; color: string; tip: string }[] = [
  { ch: ">", color: "text-sky-400", tip: "Ponteiro para a direita" },
  { ch: "<", color: "text-sky-400", tip: "Ponteiro para a esquerda" },
  { ch: "+", color: "text-emerald-400", tip: "Soma 1 na célula" },
  { ch: "-", color: "text-rose-400", tip: "Tira 1 da célula" },
  { ch: "[", color: "text-amber-300", tip: "Início do loop (enquanto ≠ 0)" },
  { ch: "]", color: "text-amber-300", tip: "Fim do loop" },
  { ch: ".", color: "text-fuchsia-400", tip: "Imprime o caractere da célula" },
  { ch: ",", color: "text-fuchsia-400", tip: "Lê um caractere da entrada" },
];

function Btn({
  children,
  onClick,
  disabled,
  tone = "slate",
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "slate" | "green" | "red" | "blue" | "amber";
  title?: string;
}) {
  const tones = {
    slate: "bg-slate-800 text-slate-100 hover:bg-slate-700",
    green: "bg-emerald-500 text-slate-950 hover:bg-emerald-400",
    red: "bg-rose-500 text-white hover:bg-rose-400",
    blue: "bg-sky-500 text-slate-950 hover:bg-sky-400",
    amber: "bg-amber-400 text-slate-950 hover:bg-amber-300",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 " +
        tones[tone]
      }
    >
      {children}
    </button>
  );
}

function Card({
  title,
  right,
  children,
  className = "",
}: {
  title: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={"rounded-2xl border border-slate-800 bg-slate-900/70 shadow-xl shadow-black/20 " + className}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-2.5">
        <h2 className="text-sm font-semibold tracking-wide text-slate-200">{title}</h2>
        {right}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default function App() {
  const [code, setCode] = useState(() => {
    try {
      return localStorage.getItem("bf-code") ?? DEFAULT_CODE;
    } catch {
      return DEFAULT_CODE;
    }
  });
  const [input, setInput] = useState("");
  const [caret, setCaret] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [debug, setDebug] = useState<View | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [speed, setSpeed] = useState(5);
  const [outMode, setOutMode] = useState<"text" | "bytes">("text");

  const machineRef = useRef<Machine | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRef = useRef(0);
  const speedRef = useRef(speed);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const lastGood = useRef<View | null>(null);

  speedRef.current = speed;

  const program: Program = useMemo(() => compile(code), [code]);
  const inputBytes = useMemo(() => new TextEncoder().encode(input), [input]);

  useEffect(() => {
    try {
      localStorage.setItem("bf-code", code);
    } catch {
      /* ignore */
    }
  }, [code]);

  /* ---------- controle de sessão (depuração) ---------- */
  const halt = useCallback(() => {
    tokenRef.current++;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const resetSession = useCallback(() => {
    halt();
    machineRef.current = null;
    setDebug(null);
    setStatus("idle");
  }, [halt]);

  useEffect(() => () => halt(), [halt]);

  const changeCode = (v: string) => {
    setCode(v);
    resetSession();
  };

  const changeInput = (v: string) => {
    setInput(v);
    resetSession();
  };

  const begin = (): Machine | null => {
    if (program.error) {
      setStatus("error");
      return null;
    }
    const m = createMachine();
    machineRef.current = m;
    return m;
  };

  const getMachine = (): Machine | null => {
    const m = machineRef.current;
    if (!m || m.halted) return begin();
    return m;
  };

  const publish = (m: Machine, forced?: Status) => {
    setDebug(snapshot(m));
    setStatus(forced ?? (m.error ? "error" : m.halted ? "done" : "paused"));
  };

  const stepOnce = () => {
    halt();
    const m = getMachine();
    if (!m) return;
    run(program, m, inputBytes, 1);
    publish(m);
  };

  const stepLine = () => {
    halt();
    const m = getMachine();
    if (!m) return;
    const startLine = m.pc < program.code.length ? program.line[m.pc] : -1;
    let guard = 0;
    do {
      run(program, m, inputBytes, 1);
      guard++;
    } while (!m.halted && program.line[m.pc] === startLine && guard < 1_000_000);
    publish(m);
  };

  const runAll = () => {
    halt();
    const m = getMachine();
    if (!m) return;
    const token = ++tokenRef.current;
    setStatus("running");
    const tick = () => {
      if (token !== tokenRef.current) return;
      run(program, m, inputBytes, 400_000);
      if (m.halted) {
        publish(m);
        return;
      }
      setDebug(snapshot(m));
      timerRef.current = setTimeout(tick, 0);
    };
    tick();
  };

  const autoStep = () => {
    halt();
    const m = getMachine();
    if (!m) return;
    const token = ++tokenRef.current;
    setStatus("auto");
    const tick = () => {
      if (token !== tokenRef.current) return;
      const [delay, per] = SPEEDS[speedRef.current - 1];
      run(program, m, inputBytes, per);
      if (m.halted) {
        publish(m);
        return;
      }
      setDebug(snapshot(m));
      timerRef.current = setTimeout(tick, delay);
    };
    tick();
  };

  const pause = () => {
    halt();
    const m = machineRef.current;
    if (m) publish(m);
  };

  const busy = status === "running" || status === "auto";

  // atalhos de teclado
  const actions = useRef({ runAll, stepOnce, stepLine, busy, pause });
  actions.current = { runAll, stepOnce, stepLine, busy, pause };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const a = actions.current;
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (a.busy) a.pause();
        else a.runAll();
      } else if (e.key === "F10") {
        e.preventDefault();
        if (e.shiftKey) a.stepLine();
        else a.stepOnce();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---------- visualização ao vivo (cursor do editor) ---------- */
  const live = useMemo(() => {
    if (debug) return null;
    return liveAt(program, caret, inputBytes);
  }, [debug, program, caret, inputBytes]);

  let view: View;
  let liveState: LiveState = "ok";
  if (debug) view = debug;
  else {
    liveState = live!.state;
    if (liveState === "syntax" && lastGood.current) view = lastGood.current;
    else view = live!.view;
    if (liveState !== "syntax") lastGood.current = live!.view;
  }

  const outText = useMemo(() => new TextDecoder().decode(view.out), [view.out]);

  const shownCell = selected !== null && selected < view.tape.length ? selected : view.ptr;
  const userSelected = selected !== null && selected < view.tape.length;
  const cellValue = view.tape[shownCell] ?? 0;

  const pcValid = !!debug && view.pc < program.code.length;
  const activePos = pcValid ? program.pos[view.pc] : -1;
  const activeLine = pcValid ? program.line[view.pc] : -1;
  const errorPos = view.error && pcValid ? program.pos[view.pc] : program.error ? program.errorPos : -1;

  const before = code.slice(0, caret);
  const curLine = before.split("\n").length;
  const curCol = caret - before.lastIndexOf("\n");
  const cmdCount = program.code.length;

  /* ---------- ações ---------- */
  const loadLesson = (l: Lesson) => {
    const c = buildCode(l);
    setCode(c);
    setInput(l.input ?? "");
    setCaret(c.length);
    setSelected(null);
    resetSession();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const insert = (ch: string) => {
    const ta = taRef.current;
    const s = ta ? ta.selectionStart : code.length;
    const e = ta ? ta.selectionEnd : code.length;
    changeCode(code.slice(0, s) + ch + code.slice(e));
    setCaret(s + 1);
    requestAnimationFrame(() => {
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(s + 1, s + 1);
    });
  };

  const copyOut = () => navigator.clipboard?.writeText(outText);

  const liveMessage = (): { tone: string; text: string } | null => {
    switch (liveState) {
      case "syntax":
        return { tone: "text-amber-300", text: "Colchetes desbalanceados — mostrando o último estado válido." };
      case "unreached":
        return { tone: "text-amber-300", text: "O programa nunca chega até o cursor (loop não executado). Mostrando o estado final." };
      case "limit":
        return { tone: "text-amber-300", text: "Muitas instruções até o cursor (loop infinito?). Mostrando um estado parcial." };
      case "error":
        return { tone: "text-rose-300", text: "Erro de execução antes de chegar ao cursor: " + (view.error ?? "") };
      default:
        return null;
    }
  };
  const lm = debug ? null : liveMessage();

  return (
    <div className="min-h-screen bg-[#0a0f1e] bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.10),transparent_55%)] text-slate-200">
      {/* Cabeçalho */}
      <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-sky-500 font-mono text-lg font-black text-slate-950 shadow-lg shadow-emerald-500/20">
              [+]
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight tracking-tight text-white">BF Studio</h1>
              <p className="text-xs text-slate-400">Compilador, depurador e escola de Brainfuck</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="rounded-full border border-slate-700 px-2.5 py-1">30.000 células</span>
            <span className="rounded-full border border-slate-700 px-2.5 py-1">8 bits (0–255)</span>
            <span className="hidden rounded-full border border-slate-700 px-2.5 py-1 sm:inline">Ctrl+Enter executa · F10 passo</span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1500px] gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-4">
          {/* Editor */}
          <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 shadow-xl shadow-black/20">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 p-3">
              {busy && status === "running" ? (
                <Btn tone="red" onClick={pause} title="Parar execução (Ctrl+Enter)">
                  ■ Parar
                </Btn>
              ) : (
                <Btn tone="green" onClick={runAll} disabled={!!program.error || status === "auto"} title="Executar tudo (Ctrl+Enter)">
                  ▶ Executar
                </Btn>
              )}
              <Btn tone="blue" onClick={stepOnce} disabled={!!program.error || busy} title="Executa uma instrução (F10)">
                ⏭ Passo
              </Btn>
              <Btn onClick={stepLine} disabled={!!program.error || busy} title="Executa até mudar de linha (Shift+F10)">
                ↧ Linha
              </Btn>
              {status === "auto" ? (
                <Btn tone="amber" onClick={pause}>
                  ⏸ Pausar
                </Btn>
              ) : (
                <Btn onClick={autoStep} disabled={!!program.error || status === "running"} title="Executa passo a passo automaticamente">
                  ⏵ Auto
                </Btn>
              )}
              <Btn onClick={resetSession} disabled={!debug && status === "idle"} title="Volta ao modo ao vivo">
                ↻ Reiniciar
              </Btn>

              <label className="ml-auto flex items-center gap-2 text-xs text-slate-400">
                Velocidade
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="w-24 accent-sky-400"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 bg-slate-950/40 px-3 py-2">
              <span className="mr-1 text-[11px] uppercase tracking-wide text-slate-500">Inserir</span>
              {PALETTE.map((p) => (
                <button
                  key={p.ch}
                  title={p.tip}
                  onClick={() => insert(p.ch)}
                  className={"h-8 w-8 rounded-md border border-slate-700 bg-slate-900 font-mono text-base font-bold hover:bg-slate-800 " + p.color}
                >
                  {p.ch}
                </button>
              ))}
              <button
                onClick={() => {
                  changeCode("");
                  setCaret(0);
                  taRef.current?.focus();
                }}
                className="ml-auto rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                Limpar
              </button>
            </div>

            <CodeEditor
              value={code}
              onChange={changeCode}
              onCaret={setCaret}
              activePos={activePos}
              activeLine={activeLine}
              errorPos={errorPos}
              taRef={taRef}
            />

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-800 bg-slate-950/50 px-4 py-2 text-xs text-slate-400">
              <span className={"rounded-full px-2.5 py-0.5 font-semibold " + STATUS_STYLE[status]}>{STATUS_LABEL[status]}</span>
              <span>
                Ln {curLine}, Col {curCol}
              </span>
              <span>{cmdCount} comandos</span>
              <span>{view.steps.toLocaleString("pt-BR")} passos</span>
              {(program.error || view.error) && (
                <span className="font-medium text-rose-300">⚠ {view.error && debug ? view.error : program.error}</span>
              )}
            </div>
          </section>

          {/* Fita */}
          <Card
            title="Fita de memória"
            right={
              debug ? (
                <span className="flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 font-semibold text-amber-300">DEPURANDO</span>
                  <span className="text-slate-400">
                    passo {view.steps.toLocaleString("pt-BR")} · ponteiro na célula #{view.ptr}
                  </span>
                </span>
              ) : (
                <span className="flex items-center gap-2 text-xs">
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 font-semibold text-emerald-300">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                    AO VIVO
                  </span>
                  <span className="text-slate-400">
                    no cursor (Ln {curLine}, Col {curCol}) · ponteiro em #{view.ptr} = {view.tape[view.ptr]}
                  </span>
                </span>
              )
            }
          >
            {lm && <p className={"mb-2 text-xs " + lm.tone}>⚠ {lm.text}</p>}
            <TapeView
              view={view}
              selected={shownCell}
              userSelected={userSelected}
              flash={!!debug && status !== "running"}
              onSelect={(i) => setSelected(i === selected ? null : i)}
            />
            <p className="mt-2 text-xs text-slate-500">
              {debug
                ? "Estado real da execução. Edite o código ou clique em Reiniciar para voltar ao modo ao vivo."
                : "Mova o cursor ou digite no editor: a fita mostra como ela estará na primeira vez que a execução chegar ali."}{" "}
              Clique numa célula para inspecioná-la.
            </p>
          </Card>

          {/* Entrada / saída */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card
              title="Saída"
              right={
                <div className="flex items-center gap-1 text-xs">
                  <button
                    onClick={() => setOutMode("text")}
                    className={"rounded px-2 py-1 " + (outMode === "text" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200")}
                  >
                    Texto
                  </button>
                  <button
                    onClick={() => setOutMode("bytes")}
                    className={"rounded px-2 py-1 " + (outMode === "bytes" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200")}
                  >
                    Bytes
                  </button>
                  <button onClick={copyOut} className="rounded px-2 py-1 text-slate-400 hover:text-slate-200">
                    Copiar
                  </button>
                </div>
              }
            >
              <pre className="min-h-[96px] max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-950 p-3 font-mono text-sm text-emerald-300">
                {view.out.length === 0 ? (
                  <span className="text-slate-600">(sem saída ainda — use o comando . para imprimir)</span>
                ) : outMode === "text" ? (
                  outText
                ) : (
                  Array.from(view.out).join(" ")
                )}
              </pre>
              <p className="mt-1.5 text-xs text-slate-500">{view.out.length} byte(s) impressos</p>
            </Card>

            <Card title="Entrada (para o comando ,)">
              <textarea
                value={input}
                onChange={(e) => changeInput(e.target.value)}
                spellCheck={false}
                placeholder="Digite aqui o texto que o programa vai ler com ,"
                className="min-h-[96px] w-full resize-y rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-sky-500"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                {inputBytes.length} byte(s). Quando acabar, <code className="text-amber-300">,</code> grava 0 na célula.
              </p>
            </Card>
          </div>

          {/* Inspetor */}
          <Card
            title="Inspetor de célula e tabela ASCII"
            right={<span className="text-xs text-slate-500">{userSelected ? "célula escolhida por você" : "seguindo o ponteiro"}</span>}
          >
            <Inspector
              index={shownCell}
              value={cellValue}
              isPtr={shownCell === view.ptr}
              following={!userSelected}
              onFollow={() => setSelected(null)}
            />
            <p className="mt-3 text-xs text-slate-500">
              Valor atual da célula #{shownCell}: <span className="font-mono text-slate-300">{cellValue}</span> = <span className="font-mono text-emerald-300">{charLabel(cellValue)}</span>
            </p>
          </Card>
        </div>

        {/* Lateral: aprendizado */}
        <aside className="min-w-0">
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 shadow-xl shadow-black/20 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
            <Lessons onLoad={loadLesson} currentCode={code} />
          </div>
        </aside>
      </main>

      <footer className="mx-auto max-w-[1500px] px-4 pb-8 pt-2 text-center text-xs text-slate-600">
        BF Studio — aprenda Brainfuck experimentando. Tudo roda no seu navegador.
      </footer>
    </div>
  );
}
