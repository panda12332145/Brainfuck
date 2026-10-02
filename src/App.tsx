import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
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
  RUN_CHUNK,
  snapshot,
  stats,
  stepBack,
  TAPE_SIZE,
  type LiveState,
  type Machine,
  type Program,
  type View,
} from "./bf/interpreter";
import { charLabel } from "./bf/ascii";
import { buildSharePayload, downloadText, readSharePayload } from "./utils/share";

type Status = "idle" | "paused" | "running" | "auto" | "bp" | "done" | "error";

const DEFAULT_CODE = buildCode(LESSONS.find((l) => l.id === "numeros-grandes")!);

const STATUS_LABEL: Record<Status, string> = {
  idle: "Pronto",
  paused: "Pausado",
  running: "Executando…",
  auto: "Passo automático",
  bp: "Parado no breakpoint",
  done: "Finalizado",
  error: "Erro",
};

const STATUS_STYLE: Record<Status, string> = {
  idle: "bg-slate-700/60 text-slate-300",
  paused: "bg-amber-400/20 text-amber-300",
  running: "bg-sky-500/20 text-sky-300",
  auto: "bg-sky-500/20 text-sky-300",
  bp: "bg-rose-500/25 text-rose-200",
  done: "bg-emerald-500/20 text-emerald-300",
  error: "bg-rose-500/20 text-rose-300",
};

/** velocidade 1..10 -> [atraso em ms, passos por tick] */
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
  [0, 500],
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

/** Intervalo mínimo entre duas atualizações da tela nos modos contínuos. */
const PAINT_MS = 60;

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
      type="button"
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

/** Botão discreto de barra de ferramentas. */
function Tool({
  children,
  onClick,
  title,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
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
  const [input, setInput] = useState(() => {
    try {
      return localStorage.getItem("bf-input") ?? "";
    } catch {
      return "";
    }
  });
  const [caret, setCaret] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [debug, setDebug] = useState<View | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [speed, setSpeed] = useState(5);
  const [outMode, setOutMode] = useState<"text" | "bytes">("text");
  const [bpLines, setBpLines] = useState<ReadonlySet<number>>(() => new Set<number>());
  const [toast, setToast] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const machineRef = useRef<Machine | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRef = useRef(0);
  const speedRef = useRef(speed);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const lastGood = useRef<View | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  speedRef.current = speed;

  const program: Program = useMemo(() => compile(code), [code]);
  const inputBytes = useMemo(() => new TextEncoder().encode(input), [input]);
  const counts = useMemo(() => stats(program), [program]);

  /** pcs que correspondem às linhas marcadas como breakpoint */
  const breakpoints = useMemo(() => {
    const s = new Set<number>();
    if (bpLines.size === 0 || program.error) return s;
    for (let pc = 0; pc < program.code.length; pc++) {
      if (bpLines.has(program.line[pc])) s.add(pc);
    }
    return s;
  }, [bpLines, program]);

  const say = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("bf-code", code);
    } catch {
      /* modo privado / sem espaço: ignora */
    }
  }, [code]);

  useEffect(() => {
    try {
      localStorage.setItem("bf-input", input);
    } catch {
      /* ignora */
    }
  }, [input]);

  /* abre um programa que chegou por link compartilhado (#c=...) */
  useEffect(() => {
    const shared = readSharePayload(window.location.hash);
    if (!shared) return;
    setCode(shared.code);
    setInput(shared.input);
    setCaret(shared.code.length);
    say("Programa do link carregado");
  }, [say]);

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

  useEffect(
    () => () => {
      halt();
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [halt],
  );

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
    const m = createMachine(true);
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
    setStatus(forced ?? (m.error ? "error" : m.atBreakpoint ? "bp" : m.halted ? "done" : "paused"));
  };

  const stepOnce = () => {
    halt();
    const m = getMachine();
    if (!m) return;
    run(program, m, inputBytes, 1);
    publish(m);
  };

  const stepBackOne = () => {
    halt();
    const m = machineRef.current;
    if (!m || !stepBack(m)) return;
    publish(m);
  };

  /**
   * Avança até o primeiro comando da linha seguinte. Usa o mapa `nextLineStart`
   * do compilador em vez de girar instrução por instrução, e libera a interface
   * a cada pedaço para não travar em linhas com loops grandes.
   */
  const stepLine = () => {
    halt();
    const m = getMachine();
    if (!m) return;
    const token = ++tokenRef.current;
    const stop = m.pc < program.code.length ? program.nextLineStart[m.pc] : -1;
    setStatus("running");
    let lastPaint = performance.now();
    const tick = () => {
      if (token !== tokenRef.current) return;
      run(program, m, inputBytes, RUN_CHUNK, stop);
      if (m.halted || m.pc === stop) {
        publish(m);
        return;
      }
      const now = performance.now();
      if (now - lastPaint >= PAINT_MS) {
        lastPaint = now;
        setDebug(snapshot(m));
      }
      timerRef.current = setTimeout(tick, 0);
    };
    tick();
  };

  const runAll = () => {
    halt();
    const m = getMachine();
    if (!m) return;
    const token = ++tokenRef.current;
    setStatus("running");
    let lastPaint = performance.now();
    const tick = () => {
      if (token !== tokenRef.current) return;
      run(program, m, inputBytes, RUN_CHUNK, -1, breakpoints);
      if (m.halted || m.atBreakpoint) {
        publish(m);
        return;
      }
      const now = performance.now();
      if (now - lastPaint >= PAINT_MS) {
        lastPaint = now;
        setDebug(snapshot(m));
      }
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
    let lastPaint = 0;
    const tick = () => {
      if (token !== tokenRef.current) return;
      const [delay, per] = SPEEDS[speedRef.current - 1];
      run(program, m, inputBytes, per, -1, breakpoints);
      if (m.halted || m.atBreakpoint) {
        publish(m);
        return;
      }
      const now = performance.now();
      if (now - lastPaint >= PAINT_MS) {
        lastPaint = now;
        setDebug(snapshot(m));
      }
      timerRef.current = setTimeout(tick, delay);
    };
    tick();
  };

  const pause = () => {
    halt();
    const m = machineRef.current;
    if (m) publish(m);
  };

  const toggleBreakpoint = useCallback((line: number) => {
    setBpLines((prev) => {
      const next = new Set(prev);
      if (next.has(line)) next.delete(line);
      else next.add(line);
      return next;
    });
  }, []);

  const busy = status === "running" || status === "auto";

  /* ---------- arquivos ---------- */
  const openFile = () => fileRef.current?.click();

  const loadFile = async (file: File) => {
    try {
      const text = await file.text();
      changeCode(text.replace(/\r\n/g, "\n"));
      setCaret(0);
      setSelected(null);
      say(`“${file.name}” carregado`);
    } catch {
      say("Não foi possível ler o arquivo");
    }
  };

  const onFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // permite abrir o mesmo arquivo de novo
    if (f) void loadFile(f);
  };

  const saveFile = () => {
    downloadText("programa.bf", code);
    say("programa.bf salvo");
  };

  const share = async () => {
    const hash = "#c=" + buildSharePayload(code, input);
    const url = window.location.origin + window.location.pathname + hash;
    try {
      window.history.replaceState(null, "", hash);
      await navigator.clipboard.writeText(url);
      say("Link copiado para a área de transferência");
    } catch {
      say("Copie o link da barra de endereços");
    }
  };

  /* ---------- atalhos de teclado ---------- */
  const caretLine = useMemo(() => code.slice(0, caret).split("\n").length - 1, [code, caret]);
  const actions = useRef({ runAll, stepOnce, stepLine, stepBackOne, busy, pause, caretLine, toggleBreakpoint });
  actions.current = { runAll, stepOnce, stepLine, stepBackOne, busy, pause, caretLine, toggleBreakpoint };

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
      } else if (e.key === "F9") {
        e.preventDefault();
        a.toggleBreakpoint(a.caretLine);
      } else if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        a.stepBackOne();
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
  if (debug) {
    view = debug;
  } else {
    liveState = live!.state;
    if (liveState === "syntax" && lastGood.current) view = lastGood.current;
    else view = live!.view;
    if (liveState !== "syntax") lastGood.current = live!.view;
  }

  const outText = useMemo(() => new TextDecoder().decode(view.out), [view.out]);

  const saveOutput = () => {
    downloadText("saida.txt", outText);
    say("saida.txt salva");
  };

  const shownCell = selected !== null && selected < view.tape.length ? selected : view.ptr;
  const userSelected = selected !== null && selected < view.tape.length;
  const cellValue = view.tape[shownCell] ?? 0;

  const pcValid = !!debug && view.pc < program.code.length;
  const activePos = pcValid ? program.pos[view.pc] : -1;
  const activeLine = pcValid ? program.line[view.pc] : -1;

  /* erro de sintaxe tem prioridade; senão mostra onde a execução falhou */
  const runErrPc = view.error !== null ? view.errorPc : -1;
  const errorPos = program.error ? program.errorPos : runErrPc >= 0 && runErrPc < program.pos.length ? program.pos[runErrPc] : -1;
  const errorLine = program.error
    ? program.errorLine
    : runErrPc >= 0 && runErrPc < program.line.length
      ? program.line[runErrPc]
      : -1;

  /* destaca o colchete parceiro da instrução em execução */
  const pairPos = useMemo(() => {
    if (!pcValid) return -1;
    const c = program.code[view.pc];
    if (c !== "[" && c !== "]") return -1;
    const j = program.jump[view.pc];
    return j >= 0 && j < program.pos.length ? program.pos[j] : -1;
  }, [pcValid, program, view.pc]);

  const before = code.slice(0, caret);
  const curLine = before.split("\n").length;
  const curCol = caret - before.lastIndexOf("\n");
  const cmdCount = program.code.length;
  const errorMessage = view.error ?? program.error;

  /* ---------- ações ---------- */
  /** Troca o conteúdo do editor e volta ao modo ao vivo. */
  const loadCode = (c: string, newInput?: string) => {
    setCode(c);
    if (newInput !== undefined) setInput(newInput);
    setCaret(c.length);
    setSelected(null);
    resetSession();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const loadLesson = (l: Lesson) => loadCode(buildCode(l), l.input ?? "");

  const insert = (ch: string) => {
    const ta = taRef.current;
    const s = ta ? ta.selectionStart : code.length;
    const e = ta ? ta.selectionEnd : code.length;
    changeCode(code.slice(0, s) + ch + code.slice(e));
    setCaret(s + ch.length);
    requestAnimationFrame(() => {
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(s + ch.length, s + ch.length);
    });
  };

  const copyOut = async () => {
    try {
      await navigator.clipboard.writeText(outText);
      say("Saída copiada");
    } catch {
      say("Não foi possível copiar");
    }
  };

  const clearBreakpoints = () => {
    setBpLines(new Set());
    say("Breakpoints removidos");
  };

  const liveMessage = (): { tone: string; text: string } | null => {
    switch (liveState) {
      case "syntax":
        return { tone: "text-amber-300", text: "Colchetes desbalanceados — mostrando o último estado válido." };
      case "unreached":
        return {
          tone: "text-amber-300",
          text: "O programa nunca chega até o cursor (loop não executado). Mostrando o estado final.",
        };
      case "limit":
        return {
          tone: "text-amber-300",
          text: "Muitas instruções até o cursor (loop infinito?). Mostrando um estado parcial.",
        };
      case "error":
        return { tone: "text-rose-300", text: "Erro de execução antes de chegar ao cursor: " + (view.error ?? "") };
      default:
        return null;
    }
  };
  const lm = debug ? null : liveMessage();

  return (
    <div className="min-h-screen bg-[#0a0f1e] bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.10),transparent_55%)] text-slate-200">
      <input
        ref={fileRef}
        type="file"
        accept=".bf,.b,.i,.txt,.bs,text/plain"
        className="hidden"
        onChange={onFileInput}
      />

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full border border-slate-700 bg-slate-900/95 px-4 py-2 text-sm text-slate-100 shadow-2xl shadow-black/50">
          {toast}
        </div>
      )}

      {/* Cabeçalho */}
      <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-sky-500 font-mono text-lg font-black text-slate-950 shadow-lg shadow-emerald-500/20">
              [+]
            </div>
            <div>
              <h1 className="text-lg leading-tight font-bold tracking-tight text-white">BF Studio</h1>
              <p className="text-xs text-slate-400">Compilador, depurador e escola de Brainfuck</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="rounded-full border border-slate-700 px-2.5 py-1">
              {TAPE_SIZE.toLocaleString("pt-BR")} células
            </span>
            <span className="rounded-full border border-slate-700 px-2.5 py-1">8 bits (0–255)</span>
            <span className="hidden rounded-full border border-slate-700 px-2.5 py-1 lg:inline">
              Ctrl+Enter executa · F10 passo · F9 breakpoint
            </span>
            <a
              href="https://github.com/panda12332145/Brainfuck"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-slate-700 px-2.5 py-1 transition-colors hover:border-slate-500 hover:text-slate-200"
            >
              GitHub ↗
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1500px] gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-4">
          {/* Editor */}
          <section
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void loadFile(f);
            }}
            className={
              "overflow-hidden rounded-2xl border bg-slate-900/70 shadow-xl shadow-black/20 transition-colors " +
              (dragging ? "border-sky-400 bg-sky-500/5" : "border-slate-800")
            }
          >
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 p-3">
              {status === "running" ? (
                <Btn tone="red" onClick={pause} title="Parar execução (Ctrl+Enter)">
                  ■ Parar
                </Btn>
              ) : (
                <Btn
                  tone="green"
                  onClick={runAll}
                  disabled={!!program.error || status === "auto"}
                  title="Executar tudo (Ctrl+Enter)"
                >
                  ▶ Executar
                </Btn>
              )}
              <Btn tone="blue" onClick={stepOnce} disabled={!!program.error || busy} title="Executa uma instrução (F10)">
                ⏭ Passo
              </Btn>
              <Btn onClick={stepLine} disabled={!!program.error || busy} title="Executa até a próxima linha (Shift+F10)">
                ↧ Linha
              </Btn>
              <Btn
                onClick={stepBackOne}
                disabled={busy || !debug?.canStepBack}
                title="Desfaz a última instrução (Alt+←)"
              >
                ⏮ Voltar
              </Btn>
              {status === "auto" ? (
                <Btn tone="amber" onClick={pause}>
                  ⏸ Pausar
                </Btn>
              ) : (
                <Btn
                  onClick={autoStep}
                  disabled={!!program.error || status === "running"}
                  title="Executa passo a passo automaticamente"
                >
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
                  aria-label="Velocidade do passo automático"
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="w-24 accent-sky-400"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 bg-slate-950/40 px-3 py-2">
              <span className="mr-1 text-[11px] tracking-wide text-slate-500 uppercase">Inserir</span>
              {PALETTE.map((p) => (
                <button
                  key={p.ch}
                  type="button"
                  title={p.tip}
                  onClick={() => insert(p.ch)}
                  className={
                    "h-8 w-8 rounded-md border border-slate-700 bg-slate-900 font-mono text-base font-bold hover:bg-slate-800 " +
                    p.color
                  }
                >
                  {p.ch}
                </button>
              ))}

              <span className="mx-1 h-5 w-px bg-slate-800" />

              <Tool onClick={openFile} title="Abrir um arquivo .bf">
                📂 Abrir
              </Tool>
              <Tool onClick={saveFile} title="Baixar o código como programa.bf" disabled={!code}>
                💾 Salvar
              </Tool>
              <Tool onClick={share} title="Copiar um link com o código e a entrada atuais">
                🔗 Compartilhar
              </Tool>
              {bpLines.size > 0 && (
                <Tool onClick={clearBreakpoints} title="Remover todos os breakpoints">
                  ⦿ {bpLines.size} breakpoint{bpLines.size > 1 ? "s" : ""}
                </Tool>
              )}
              <Tool
                onClick={() => {
                  changeCode("");
                  setCaret(0);
                  taRef.current?.focus();
                }}
                title="Apagar todo o código"
                disabled={!code}
              >
                🗑 Limpar
              </Tool>
            </div>

            <CodeEditor
              value={code}
              onChange={changeCode}
              onCaret={setCaret}
              activePos={activePos}
              activeLine={activeLine}
              errorPos={errorPos}
              errorLine={errorLine}
              pairPos={pairPos}
              breakpoints={bpLines}
              onToggleBreakpoint={toggleBreakpoint}
              taRef={taRef}
            />

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-800 bg-slate-950/50 px-4 py-2 text-xs text-slate-400">
              <span className={"rounded-full px-2.5 py-0.5 font-semibold " + STATUS_STYLE[status]}>
                {STATUS_LABEL[status]}
              </span>
              <span>
                Ln {curLine}, Col {curCol}
              </span>
              <span>
                {cmdCount.toLocaleString("pt-BR")} comandos · {program.loops} loop{program.loops === 1 ? "" : "s"}
              </span>
              <span>{view.steps.toLocaleString("pt-BR")} passos</span>
              {errorMessage && <span className="font-medium text-rose-300">⚠ {errorMessage}</span>}
            </div>
          </section>

          {/* Fita */}
          <Card
            title="Fita de memória"
            right={
              debug ? (
                <span className="flex items-center gap-2 text-xs">
                  <span
                    className={
                      "rounded-full px-2.5 py-0.5 font-semibold " +
                      (view.atBreakpoint ? "bg-rose-500/25 text-rose-200" : "bg-amber-400/20 text-amber-300")
                    }
                  >
                    {view.atBreakpoint ? "BREAKPOINT" : "DEPURANDO"}
                  </span>
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
                    no cursor (Ln {curLine}, Col {curCol}) · ponteiro em #{view.ptr} = {view.tape[view.ptr] ?? 0}
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
              flash={!!debug && !busy}
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
                    type="button"
                    onClick={() => setOutMode("text")}
                    className={
                      "rounded px-2 py-1 " + (outMode === "text" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200")
                    }
                  >
                    Texto
                  </button>
                  <button
                    type="button"
                    onClick={() => setOutMode("bytes")}
                    className={
                      "rounded px-2 py-1 " + (outMode === "bytes" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200")
                    }
                  >
                    Bytes
                  </button>
                  <button
                    type="button"
                    onClick={copyOut}
                    disabled={view.out.length === 0}
                    className="rounded px-2 py-1 text-slate-400 hover:text-slate-200 disabled:opacity-40"
                  >
                    Copiar
                  </button>
                  <button
                    type="button"
                    onClick={saveOutput}
                    disabled={view.out.length === 0}
                    className="rounded px-2 py-1 text-slate-400 hover:text-slate-200 disabled:opacity-40"
                  >
                    Baixar
                  </button>
                </div>
              }
            >
              <pre className="min-h-[96px] max-h-56 overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-sm break-all whitespace-pre-wrap text-emerald-300">
                {view.out.length === 0 ? (
                  <span className="text-slate-600">(sem saída ainda — use o comando . para imprimir)</span>
                ) : outMode === "text" ? (
                  outText
                ) : (
                  Array.from(view.out).join(" ")
                )}
              </pre>
              <p className="mt-1.5 text-xs text-slate-500">{view.out.length.toLocaleString("pt-BR")} byte(s) impressos</p>
            </Card>

            <Card title="Entrada (para o comando ,)">
              <textarea
                value={input}
                onChange={(e) => changeInput(e.target.value)}
                spellCheck={false}
                aria-label="Entrada do programa"
                placeholder="Digite aqui o texto que o programa vai ler com ,"
                className="min-h-[96px] w-full resize-y rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-sky-500"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                {inputBytes.length.toLocaleString("pt-BR")} byte(s). Quando acabar, <code className="text-amber-300">,</code>{" "}
                grava 0 na célula.
              </p>
            </Card>
          </div>

          {/* Inspetor */}
          <Card
            title="Inspetor de célula e tabela ASCII"
            right={
              <span className="text-xs text-slate-500">
                {userSelected ? "célula escolhida por você" : "seguindo o ponteiro"}
              </span>
            }
          >
            <Inspector
              index={shownCell}
              value={cellValue}
              isPtr={shownCell === view.ptr}
              following={!userSelected}
              onFollow={() => setSelected(null)}
            />
            <p className="mt-3 text-xs text-slate-500">
              Valor atual da célula #{shownCell}: <span className="font-mono text-slate-300">{cellValue}</span> ={" "}
              <span className="font-mono text-emerald-300">{charLabel(cellValue)}</span>
            </p>
          </Card>

          {/* Estatísticas */}
          <Card title="Análise do programa">
            <div className="flex flex-wrap gap-2">
              {PALETTE.map((p) => (
                <span
                  key={p.ch}
                  title={p.tip}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-1.5 font-mono text-xs"
                >
                  <span className={"text-base font-bold " + p.color}>{p.ch}</span>
                  <span className="text-slate-300 tabular-nums">{counts[p.ch]}</span>
                </span>
              ))}
              <span className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-1.5 text-xs text-slate-400">
                {cmdCount.toLocaleString("pt-BR")} comandos no total
              </span>
            </div>
            {program.error && program.errorPc >= 0 && (
              <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-200">
                ⚠ {program.error} — linha {program.errorLine + 1}, coluna {program.col[program.errorPc]}
              </p>
            )}
          </Card>
        </div>

        {/* Lateral: aprendizado */}
        <aside className="min-w-0">
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 shadow-xl shadow-black/20 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
            <Lessons onLoad={loadLesson} onLoadCode={(c) => loadCode(c)} currentCode={code} />
          </div>
        </aside>
      </main>

      <footer className="mx-auto max-w-[1500px] px-4 pt-2 pb-8 text-center text-xs text-slate-600">
        BF Studio — aprenda Brainfuck experimentando. Tudo roda no seu navegador, nada é enviado para servidores.
      </footer>
    </div>
  );
}
