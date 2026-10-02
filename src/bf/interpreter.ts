/**
 * Núcleo do BF Studio: compilador + máquina virtual de Brainfuck.
 *
 * Tudo aqui é síncrono e independente do React, o que permite testar a lógica
 * sem navegador (veja interpreter.test.ts).
 */

export const TAPE_SIZE = 30000;
/** Limite de bytes impressos antes de abortar a execução. */
export const MAX_OUTPUT = 100000;
/** Limite de instruções usadas pela visualização "ao vivo" do cursor. */
export const LIVE_LIMIT = 300000;
/** Pedaço de execução por vez nos modos contínuos (mantém a interface responsiva). */
export const RUN_CHUNK = 250000;
/** Quantas células no máximo são desenhadas na fita. */
export const MAX_VISIBLE = 1024;
/** Quantos passos dá para desfazer com o botão "Voltar". */
export const HISTORY_SIZE = 65536;

const HIST_FIELDS = 5;
const COMMANDS = new Set(["+", "-", "<", ">", "[", "]", ".", ","]);

export interface Program {
  /** apenas os comandos válidos */
  code: string;
  /** posição de cada comando no texto original */
  pos: number[];
  /** linha (0-based) de cada comando */
  line: Int32Array;
  /** coluna (1-based) de cada comando */
  col: Int32Array;
  /** nível de aninhamento de cada comando (0 = fora de qualquer loop) */
  depth: Int32Array;
  /** para cada `[` o `]` parceiro, e vice-versa */
  jump: Int32Array;
  /** para cada comando, o pc do primeiro comando da linha seguinte (-1 se não houver) */
  nextLineStart: Int32Array;
  /** número de loops `[...]` */
  loops: number;
  error: string | null;
  /** posição no texto original do erro de sintaxe */
  errorPos: number;
  /** linha (0-based) do erro de sintaxe */
  errorLine: number;
  /** índice do comando com erro (-1 se não houver) */
  errorPc: number;
}

/**
 * Transforma o texto digitado em um programa executável.
 *
 * Comentários são descartados, mas guardamos em `pos`/`line`/`col` de onde cada
 * comando veio — é isso que permite destacar no editor a instrução em execução.
 */
export function compile(src: string): Program {
  const chunks: string[] = [];
  const pos: number[] = [];
  const lineArr: number[] = [];
  const colArr: number[] = [];

  let line = 0;
  let lineStart = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "\n") {
      line++;
      lineStart = i + 1;
    } else if (c !== "\r" && COMMANDS.has(c)) {
      chunks.push(c);
      pos.push(i);
      lineArr.push(line);
      colArr.push(i - lineStart + 1);
    }
  }

  const code = chunks.join("");
  const n = code.length;
  const jump = new Int32Array(n);
  const depth = new Int32Array(n);
  const stack: number[] = [];
  let error: string | null = null;
  let errorPos = -1;
  let errorLine = -1;
  let errorPc = -1;
  let loops = 0;

  for (let i = 0; i < n; i++) {
    const c = code[i];
    if (c === "[") {
      stack.push(i);
      loops++;
      depth[i] = stack.length;
    } else if (c === "]") {
      if (stack.length) {
        const j = stack.pop()!;
        jump[i] = j;
        jump[j] = i;
        depth[i] = stack.length + 1;
      } else {
        depth[i] = 0;
        if (!error) {
          error = "Colchete ] sem o [ correspondente";
          errorPos = pos[i];
          errorLine = lineArr[i];
          errorPc = i;
        }
      }
    } else {
      depth[i] = stack.length;
    }
  }

  if (!error && stack.length) {
    const j = stack[stack.length - 1];
    error = "Colchete [ sem o ] correspondente";
    errorPos = pos[j];
    errorLine = lineArr[j];
    errorPc = j;
  }

  /* primeiro pc de cada linha que contém comandos */
  const lineStarts: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i === 0 || lineArr[i] !== lineArr[i - 1]) lineStarts.push(i);
  }
  const nextLineStart = new Int32Array(n);
  let k = 0;
  for (let i = 0; i < n; i++) {
    while (k + 1 < lineStarts.length && i >= lineStarts[k + 1]) k++;
    nextLineStart[i] = k + 1 < lineStarts.length ? lineStarts[k + 1] : -1;
  }

  return {
    code,
    pos,
    line: Int32Array.from(lineArr),
    col: Int32Array.from(colArr),
    depth,
    jump,
    nextLineStart,
    loops,
    error,
    errorPos,
    errorLine,
    errorPc,
  };
}

/** Contagem de cada comando — usada no painel de estatísticas. */
export function stats(p: Program): Record<string, number> {
  const s: Record<string, number> = { ">": 0, "<": 0, "+": 0, "-": 0, ".": 0, ",": 0, "[": 0, "]": 0 };
  for (let i = 0; i < p.code.length; i++) s[p.code[i]]++;
  return s;
}

export interface Machine {
  tape: Uint8Array;
  ptr: number;
  pc: number;
  /** buffer de saída (pode ser maior que a saída real; vale `outLen` bytes) */
  out: Uint8Array;
  outLen: number;
  inPos: number;
  steps: number;
  maxPtr: number;
  lastCell: number;
  halted: boolean;
  error: string | null;
  /** pc onde o erro de execução aconteceu (-1 se não houve erro) */
  errorPc: number;
  atBreakpoint: boolean;
  /** se false, não grava histórico (usado na visualização ao vivo) */
  record: boolean;
  hist: Int32Array;
  histCount: number;
  histHead: number;
}

export function createMachine(record = true): Machine {
  return {
    tape: new Uint8Array(TAPE_SIZE),
    ptr: 0,
    pc: 0,
    out: new Uint8Array(0),
    outLen: 0,
    inPos: 0,
    steps: 0,
    maxPtr: 0,
    lastCell: -1,
    halted: false,
    error: null,
    errorPc: -1,
    atBreakpoint: false,
    record,
    hist: record ? new Int32Array(HISTORY_SIZE * HIST_FIELDS) : new Int32Array(0),
    histCount: 0,
    histHead: 0,
  };
}

/**
 * Executa até `maxSteps` instruções.
 *
 * A execução para antes de executar a instrução `stopPc` (usada pelo "passo a
 * linha" e pelo modo ao vivo) ou ao chegar em qualquer pc de `stops`
 * (breakpoints). Em ambos os casos a máquina NÃO é marcada como finalizada.
 */
export function run(
  p: Program,
  m: Machine,
  input: Uint8Array,
  maxSteps: number,
  stopPc = -1,
  stops: ReadonlySet<number> | null = null,
): void {
  if (m.halted) return;

  const code = p.code;
  const n = code.length;
  const jump = p.jump;
  const tape = m.tape;
  const tapeSize = tape.length;
  const record = m.record;
  const hist = m.hist;
  const hasStops = !!stops && stops.size > 0;

  let pc = m.pc;
  let ptr = m.ptr;
  let maxPtr = m.maxPtr;
  let last = m.lastCell;
  let steps = 0;
  let out = m.out;
  let outLen = m.outLen;
  let inPos = m.inPos;
  let histHead = m.histHead;
  let histCount = m.histCount;
  let err: string | null = null;
  let errPc = -1;
  /**
   * Quando a máquina estava parada justamente em um breakpoint, o primeiro pc
   * não pode disparar o mesmo breakpoint de novo (senão o "continuar" nunca
   * sairia do lugar). Fora isso nenhum pc é ignorado — inclusive na fronteira
   * entre dois pedaços de uma execução contínua.
   */
  const resume = m.atBreakpoint ? pc : -1;

  m.atBreakpoint = false;

  while (steps < maxSteps) {
    if (pc >= n) {
      m.halted = true;
      break;
    }
    if (pc === stopPc) break;
    if (hasStops && pc !== resume && stops!.has(pc)) {
      m.atBreakpoint = true;
      break;
    }

    if (record) {
      const h = histHead * HIST_FIELDS;
      hist[h] = pc;
      hist[h + 1] = ptr;
      hist[h + 2] = tape[ptr];
      hist[h + 3] = outLen;
      hist[h + 4] = inPos;
      histHead = histHead + 1 === HISTORY_SIZE ? 0 : histHead + 1;
      if (histCount < HISTORY_SIZE) histCount++;
    }

    switch (code.charCodeAt(pc)) {
      case 43: // +
        tape[ptr]++;
        last = ptr;
        break;
      case 45: // -
        tape[ptr]--;
        last = ptr;
        break;
      case 62: // >
        if (ptr + 1 >= tapeSize) {
          err = `O ponteiro passou do fim da fita (ela tem ${tapeSize} células)`;
          errPc = pc;
        } else {
          ptr++;
          if (ptr > maxPtr) maxPtr = ptr;
        }
        break;
      case 60: // <
        if (ptr === 0) {
          err = "O ponteiro tentou ir para a esquerda da célula 0";
          errPc = pc;
        } else {
          ptr--;
        }
        break;
      case 91: // [
        if (tape[ptr] === 0) pc = jump[pc];
        break;
      case 93: // ]
        if (tape[ptr] !== 0) pc = jump[pc];
        break;
      case 46: // .
        if (outLen >= MAX_OUTPUT) {
          err = `A saída passou de ${MAX_OUTPUT.toLocaleString("pt-BR")} bytes`;
          errPc = pc;
        } else {
          if (outLen === out.length) {
            const grown = new Uint8Array(Math.min(MAX_OUTPUT, Math.max(1024, out.length * 2)));
            grown.set(out.subarray(0, outLen));
            out = grown;
          }
          out[outLen++] = tape[ptr];
        }
        break;
      case 44: // ,
        tape[ptr] = inPos < input.length ? input[inPos++] : 0;
        last = ptr;
        break;
    }

    if (err) {
      m.error = err;
      m.errorPc = errPc;
      m.halted = true;
      /* a instrução que falhou não chegou a executar: desfaz o registro */
      if (record && histCount > 0) {
        histHead = histHead === 0 ? HISTORY_SIZE - 1 : histHead - 1;
        histCount--;
      }
      break;
    }

    pc++;
    steps++;
  }

  m.pc = pc;
  m.ptr = ptr;
  m.maxPtr = maxPtr;
  m.lastCell = last;
  m.out = out;
  m.outLen = outLen;
  m.inPos = inPos;
  m.histHead = histHead;
  m.histCount = histCount;
  m.steps += steps;
}

/**
 * Desfaz a última instrução executada.
 * Retorna false quando não há mais histórico.
 */
export function stepBack(m: Machine): boolean {
  if (m.histCount === 0) return false;
  const head = m.histHead === 0 ? HISTORY_SIZE - 1 : m.histHead - 1;
  const h = head * HIST_FIELDS;
  m.pc = m.hist[h];
  m.ptr = m.hist[h + 1];
  m.tape[m.ptr] = m.hist[h + 2];
  m.outLen = m.hist[h + 3];
  m.inPos = m.hist[h + 4];
  m.histHead = head;
  m.histCount--;
  m.steps = Math.max(0, m.steps - 1);
  m.lastCell = m.ptr;
  m.halted = false;
  m.error = null;
  m.errorPc = -1;
  m.atBreakpoint = false;
  return true;
}

export interface View {
  tape: Uint8Array;
  ptr: number;
  pc: number;
  out: Uint8Array;
  steps: number;
  maxPtr: number;
  lastCell: number;
  halted: boolean;
  error: string | null;
  errorPc: number;
  atBreakpoint: boolean;
  canStepBack: boolean;
}

export function visibleCells(maxPtr: number): number {
  const n = Math.ceil((maxPtr + 9) / 8) * 8;
  return Math.min(MAX_VISIBLE, TAPE_SIZE, Math.max(32, n));
}

export function snapshot(m: Machine): View {
  return {
    tape: m.tape.slice(0, visibleCells(m.maxPtr)),
    ptr: m.ptr,
    pc: m.pc,
    out: m.out.slice(0, m.outLen),
    steps: m.steps,
    maxPtr: m.maxPtr,
    lastCell: m.lastCell,
    halted: m.halted,
    error: m.error,
    errorPc: m.errorPc,
    atBreakpoint: m.atBreakpoint,
    canStepBack: m.histCount > 0,
  };
}

export type LiveState = "ok" | "unreached" | "limit" | "error" | "syntax";

/** Estado da fita na primeira vez em que a execução chega ao cursor do editor. */
export function liveAt(p: Program, caret: number, input: Uint8Array): { view: View; state: LiveState } {
  const m = createMachine(false);
  if (p.error) return { view: snapshot(m), state: "syntax" };

  /* menor índice de comando cuja posição no texto é >= caret */
  let lo = 0;
  let hi = p.pos.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (p.pos[mid] >= caret) hi = mid;
    else lo = mid + 1;
  }

  run(p, m, input, LIVE_LIMIT, lo);

  let state: LiveState;
  if (m.error) state = "error";
  else if (m.pc === lo) state = "ok";
  else if (m.halted) state = "unreached";
  else state = "limit";
  return { view: snapshot(m), state };
}
