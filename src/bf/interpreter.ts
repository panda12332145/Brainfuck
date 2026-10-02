export const TAPE_SIZE = 30000;
export const MAX_OUTPUT = 100000;
export const LIVE_LIMIT = 300000;
const MAX_VISIBLE = 1024;

export interface Program {
  /** apenas os comandos válidos */
  code: string;
  /** posição de cada comando no texto original */
  pos: number[];
  /** linha (0-based) de cada comando */
  line: Int32Array;
  /** salto dos colchetes */
  jump: Int32Array;
  error: string | null;
  errorPos: number;
}

export function compile(src: string): Program {
  const cmds = "+-<>[].,";
  let code = "";
  const pos: number[] = [];
  const lineArr: number[] = [];
  let line = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "\n") line++;
    else if (cmds.includes(c)) {
      code += c;
      pos.push(i);
      lineArr.push(line);
    }
  }
  const jump = new Int32Array(code.length);
  const stack: number[] = [];
  let error: string | null = null;
  let errorPos = -1;
  for (let i = 0; i < code.length; i++) {
    if (code[i] === "[") stack.push(i);
    else if (code[i] === "]") {
      if (!stack.length) {
        error = "Colchete ] sem o [ correspondente";
        errorPos = pos[i];
        break;
      }
      const j = stack.pop()!;
      jump[i] = j;
      jump[j] = i;
    }
  }
  if (!error && stack.length) {
    error = "Colchete [ sem o ] correspondente";
    errorPos = pos[stack[stack.length - 1]];
  }
  return { code, pos, line: Int32Array.from(lineArr), jump, error, errorPos };
}

export interface Machine {
  tape: Uint8Array;
  ptr: number;
  pc: number;
  out: number[];
  inPos: number;
  steps: number;
  maxPtr: number;
  lastCell: number;
  halted: boolean;
  error: string | null;
}

export function createMachine(): Machine {
  return {
    tape: new Uint8Array(TAPE_SIZE),
    ptr: 0,
    pc: 0,
    out: [],
    inPos: 0,
    steps: 0,
    maxPtr: 0,
    lastCell: -1,
    halted: false,
    error: null,
  };
}

/** Executa até `maxSteps` instruções, ou até o pc chegar em `stopPc`. */
export function run(p: Program, m: Machine, input: Uint8Array, maxSteps: number, stopPc = -1): void {
  if (m.halted) return;
  const code = p.code;
  const n = code.length;
  const jump = p.jump;
  const tape = m.tape;
  let pc = m.pc;
  let ptr = m.ptr;
  let maxPtr = m.maxPtr;
  let last = m.lastCell;
  let steps = 0;
  let err: string | null = null;

  while (steps < maxSteps) {
    if (pc === stopPc) break;
    if (pc >= n) {
      m.halted = true;
      break;
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
        if (ptr + 1 >= TAPE_SIZE) err = "O ponteiro passou do fim da fita (célula " + TAPE_SIZE + ")";
        else {
          ptr++;
          if (ptr > maxPtr) maxPtr = ptr;
        }
        break;
      case 60: // <
        if (ptr === 0) err = "O ponteiro tentou ir para a esquerda da célula 0";
        else ptr--;
        break;
      case 91: // [
        if (tape[ptr] === 0) pc = jump[pc];
        break;
      case 93: // ]
        if (tape[ptr] !== 0) pc = jump[pc];
        break;
      case 46: // .
        m.out.push(tape[ptr]);
        if (m.out.length > MAX_OUTPUT) err = "A saída passou de " + MAX_OUTPUT + " bytes";
        break;
      case 44: // ,
        tape[ptr] = m.inPos < input.length ? input[m.inPos++] : 0;
        last = ptr;
        break;
    }
    if (err) {
      m.error = err;
      m.halted = true;
      break;
    }
    pc++;
    steps++;
  }
  m.pc = pc;
  m.ptr = ptr;
  m.maxPtr = maxPtr;
  m.lastCell = last;
  m.steps += steps;
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
    out: Uint8Array.from(m.out),
    steps: m.steps,
    maxPtr: m.maxPtr,
    lastCell: m.lastCell,
    halted: m.halted,
    error: m.error,
  };
}

export type LiveState = "ok" | "unreached" | "limit" | "error" | "syntax";

/** Estado da fita na primeira vez em que a execução chega ao cursor do editor. */
export function liveAt(p: Program, caret: number, input: Uint8Array): { view: View; state: LiveState } {
  const m = createMachine();
  if (p.error) return { view: snapshot(m), state: "syntax" };
  let lo = 0;
  let hi = p.pos.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (p.pos[mid] >= caret) hi = mid;
    else lo = mid + 1;
  }
  const target = lo;
  run(p, m, input, LIVE_LIMIT, target);
  let state: LiveState;
  if (m.error) state = "error";
  else if (m.pc === target) state = "ok";
  else if (m.halted) state = "unreached";
  else state = "limit";
  return { view: snapshot(m), state };
}
