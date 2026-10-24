// memlevels.ts — Memory mode rules with no DOM access: difficulty curve and shape generation.

export const MEM_LEVELS = 50;

export interface MemLevel {
  n: number;     // grid is n×n
  size: number;  // filled squares in the shape
  show: number;  // display time in ms
  twist: number; // how strongly growth favours branchy, thin shapes
}

// Grid grows 5×5 → 6×6 → 7×7, the shape covers less of the grid, it is shown for less time
// and it grows branchier as levels rise.
export function memLevel(l: number): MemLevel {
  const t = l / (MEM_LEVELS - 1);
  const n = l < 17 ? 5 : l < 34 ? 6 : 7;
  return { n, size: Math.round((0.56 - 0.26 * t) * n * n), show: Math.round(3200 - 2300 * t), twist: 3 * t };
}

// Grows a connected polyomino one cell at a time from a random seed. Each frontier cell is weighted
// by 1 / (filled neighbours)^twist, so a higher twist yields stringier shapes with more arms.
export function memShape(n: number, size: number, twist: number, rnd = Math.random): Set<number> {
  const cells = new Set([Math.floor(rnd() * n * n)]);
  const nb = (i: number) => {
    const x = i % n, y = (i / n) | 0, r: number[] = [];
    if (x > 0) r.push(i - 1); if (x < n - 1) r.push(i + 1);
    if (y > 0) r.push(i - n); if (y < n - 1) r.push(i + n);
    return r;
  };
  while (cells.size < Math.min(size, n * n)) {
    const front = new Map<number, number>(); // candidate cell -> filled neighbour count
    for (const c of cells) for (const j of nb(c)) if (!cells.has(j)) front.set(j, (front.get(j) || 0) + 1);
    const opts = [...front], w = opts.map(([, k]) => 1 / k ** twist);
    let r = rnd() * w.reduce((a, b) => a + b, 0), pick = opts[opts.length - 1][0];
    for (let i = 0; i < opts.length; i++) if ((r -= w[i]) <= 0) { pick = opts[i][0]; break; }
    cells.add(pick);
  }
  return cells;
}

// True when every cell can be reached from every other through edge-adjacent cells.
export function connected(n: number, cells: Set<number>): boolean {
  const [first] = cells, seen = new Set([first]), todo = [first];
  while (todo.length) {
    const i = todo.pop()!, x = i % n;
    for (const j of [x > 0 ? i - 1 : -1, x < n - 1 ? i + 1 : -1, i - n, i + n])
      if (cells.has(j) && !seen.has(j)) { seen.add(j); todo.push(j); }
  }
  return seen.size === cells.size;
}
