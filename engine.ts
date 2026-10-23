// engine.ts — pure game logic (no DOM), shared by the UI and test.ts
export type Slot = { c: number | null; a: string } | null; // c: condition colour, a: u|l|r|c0-2|p0-2
export interface Def {
  name: string;
  f: number[];                // slot count per function
  a: string;                  // allowed actions: u l r, c = calls, p = paint
  k: string;                  // allowed condition colours, e.g. "012"
  m: string[];                // map: p/t/o = purple/teal/orange tile, UPPERCASE = star, . = empty
  r: [number, number, number];// robot x, y, dir (0 up, 1 right, 2 down, 3 left)
  s: string[];                // reference solution, one string per function
}
export interface Sim {
  def: Def; w: number; h: number; board: number[][]; stars: Set<string>;
  x: number; y: number; d: number; stack: [number, number][]; steps: number;
  status: 'ready' | 'run' | 'won' | 'fell' | 'done' | 'loop'; active: [number, number] | null;
}

export function newSim(def: Def): Sim {
  const board = def.m.map(r => [...r].map(ch => (ch === '.' ? -1 : 'pto'.indexOf(ch.toLowerCase()))));
  const stars = new Set<string>();
  def.m.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.' && ch === ch.toUpperCase()) stars.add(`${x},${y}`); }));
  return {
    def, w: Math.max(...def.m.map(r => r.length)), h: def.m.length, board, stars,
    x: def.r[0], y: def.r[1], d: def.r[2], stack: [[0, 0]], steps: 0, status: 'ready', active: null,
  };
}

export function parseProg(src: string[], def: Def): Slot[][] {
  return src.map((line, f) => {
    const slots: Slot[] = Array(def.f[f]).fill(null);
    line.split(' ').forEach((t, i) => {
      const m = t.match(/^(?:([012])\?)?([ulr]|[cp][0-9])$/)!;
      slots[i] = { c: m[1] === undefined ? null : +m[1], a: m[2] };
    });
    return slots;
  });
}

// Runs until one visible action (move / turn / paint) has happened, or the program ends.
export function step(s: Sim, prog: Slot[][]): void {
  if (s.status !== 'ready' && s.status !== 'run') return;
  s.status = 'run';
  for (let guard = 0; guard < 2000; guard++) {
    const top = s.stack[s.stack.length - 1];
    if (!top) { s.status = 'done'; s.active = null; return; }
    const [f, i] = top;
    if (i >= prog[f].length) { s.stack.pop(); continue; }
    top[1]++;
    const sl = prog[f][i];
    if (!sl || !sl.a) continue;
    if (sl.c !== null && sl.c !== s.board[s.y][s.x]) continue;
    const k = sl.a[0], n = +sl.a[1];
    if (k === 'c') {
      if (top[1] >= prog[f].length) s.stack.pop(); // tail call: don't grow the stack
      s.stack.push([n, 0]);
      if (s.stack.length > 500) { s.status = 'loop'; return; }
      continue;
    }
    s.active = [f, i];
    if (k === 'u') {
      s.x += [0, 1, 0, -1][s.d]; s.y += [-1, 0, 1, 0][s.d];
      if ((s.board[s.y]?.[s.x] ?? -1) < 0) { s.status = 'fell'; return; }
    } else if (k === 'l') s.d = (s.d + 3) % 4;
    else if (k === 'r') s.d = (s.d + 1) % 4;
    else s.board[s.y][s.x] = n;
    if (++s.steps > 3000) { s.status = 'loop'; return; }
    if (s.stars.delete(`${s.x},${s.y}`) && s.stars.size === 0) s.status = 'won';
    return;
  }
  s.status = 'loop';
}
