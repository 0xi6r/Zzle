// memory.ts — Memory mode UI: a shape flashes on a grid, then the player redraws it from memory.
// Shares the page's header, level dots, board overlay and status line with the robot game.
import { MEM_LEVELS, memLevel, memShape } from './memlevels';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
type Phase = 'start' | 'memo' | 'recall' | 'result';
type Btn = [label: string, fn: () => void, cls?: string];

let lv = 0, cleared = new Set<number>(), phase: Phase = 'start', timer = 0;
let target = new Set<number>(), picks = new Set<number>(), primary: (() => void) | null = null;
try {
  cleared = new Set(JSON.parse(localStorage.getItem('zzle-mem-cleared') || '[]'));
  lv = +(localStorage.getItem('zzle-mem-level') || 0);
} catch {}
const save = () => {
  try {
    localStorage.setItem('zzle-mem-cleared', JSON.stringify([...cleared]));
    localStorage.setItem('zzle-mem-level', String(lv));
  } catch {}
};
const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

// ---------- rendering ----------
function render() {
  const { n } = memLevel(lv), box = $('mem');
  if (box.children.length !== n * n) {
    box.style.setProperty('--n', String(n)); box.innerHTML = '';
    for (let i = 0; i < n * n; i++) {
      const b = document.createElement('button');
      b.className = 'mc'; b.onclick = () => pick(i);
      b.setAttribute('aria-label', `Row ${((i / n) | 0) + 1}, column ${(i % n) + 1}`);
      box.append(b);
    }
  }
  [...box.children].forEach((e, i) => {
    const t = target.has(i), p = picks.has(i);
    e.className = 'mc' + (phase === 'memo' && t ? ' on' : phase === 'recall' && p ? ' pick'
      : phase === 'result' ? (t ? (p ? ' hit' : ' miss') : p ? ' wrong' : '') : '');
    e.setAttribute('aria-pressed', String(phase === 'recall' && p));
  });
  box.classList.toggle('live', phase === 'recall');
}

function setPhase(p: Phase, cls = '') {
  phase = p;
  const order = ['memo', 'recall', 'result'], at = order.indexOf(p);
  document.querySelectorAll<HTMLElement>('#mphases [data-p]').forEach(e => {
    const k = order.indexOf(e.dataset.p!);
    e.className = k === at ? 'cur ' + cls : k < at ? 'past' : '';
  });
  if (p !== 'memo') { const b = $('mbar'); b.style.transition = 'none'; b.style.width = '0%'; }
}

function countdown(ms: number) {
  const b = $('mbar');
  b.style.transition = 'none'; b.style.width = '100%';
  void b.offsetWidth; // restart the transition
  b.style.transition = `width ${ms}ms linear`; b.style.width = '0%';
}

function header() {
  const { n } = memLevel(lv);
  $('title').textContent = `Memory · Level ${lv + 1} · ${n}×${n}`;
  const box = $('dots'); box.innerHTML = '';
  for (let i = 0; i < MEM_LEVELS; i++) {
    const b = document.createElement('button'), c = memLevel(i);
    b.className = 'dot' + (cleared.has(i) ? ' done' : '') + (i === lv ? ' cur' : '');
    b.textContent = String(i + 1); b.title = `${c.n}×${c.n} · ${c.size} squares · ${secs(c.show)}`;
    b.onclick = () => load(i);
    box.append(b);
  }
  $<HTMLButtonElement>('prev').disabled = lv === 0;
  $<HTMLButtonElement>('skip').disabled = lv === MEM_LEVELS - 1;
}

const status = (html: string) => { const s = $('status'); s.innerHTML = html; s.className = ''; };

function makeButtons(host: HTMLElement, btns: Btn[]) {
  for (const [label, fn, cls] of btns) {
    const b = document.createElement('button');
    b.className = cls || ''; b.innerHTML = label; b.onclick = fn; host.append(b);
  }
}
function actions(btns: Btn[]) { const box = $('mact'); box.innerHTML = ''; makeButtons(box, btns.map(([l, f, c]) => [l, f, 'nav ' + (c || '')])); }

// Start, win and restart screens; the last button is the Enter-key action.
function overlay(head: string, sub: string, btns: Btn[]) {
  const ov = $('ov'), row = document.createElement('div');
  ov.innerHTML = `<div>${head}</div><div class="ovsub">${sub}</div>`;
  makeButtons(row, btns); row.className = 'ovrow'; ov.append(row); ov.hidden = false;
  primary = btns[btns.length - 1][1];
}

// ---------- phases ----------
function load(i: number) {
  clearTimeout(timer);
  lv = Math.max(0, Math.min(MEM_LEVELS - 1, i || 0)); save();
  target = new Set(); picks = new Set();
  setPhase('start'); header(); render(); actions([]);
  begin();
}

function begin() {
  clearTimeout(timer); $('ov').hidden = true; primary = null;
  const c = memLevel(lv);
  target = memShape(c.n, c.size, c.twist); picks = new Set();
  setPhase('memo'); render(); countdown(c.show); actions([]);
  status('Memorize the shape');
  timer = window.setTimeout(() => { setPhase('recall'); render(); recallUi(); }, c.show);
}

function recallUi() {
  const { size } = memLevel(lv);
  status(`Redraw the shape · <b>${picks.size}/${size}</b> squares`);
  actions([]); primary = null;
}

function pick(i: number) {
  if (phase !== 'recall') return;
  if (picks.has(i)) return;
  picks.add(i);
  // a wrong square ends the round; the last correct square finishes it
  if (!target.has(i) || picks.size === target.size) return check();
  render(); recallUi();
}

function check() {
  const hits = [...picks].filter(i => target.has(i)).length, ok = hits === target.size && picks.size === hits;
  setPhase('result', ok ? 'ok' : 'bad'); render();
  if (ok) {
    cleared.add(lv); save(); header();
    if (lv === MEM_LEVELS - 1) { status('<span class="ok">✓ Perfect!</span>'); actions([]); primary = win; timer = window.setTimeout(win, 1200); return; }
    status(`<span class="ok">✓ Perfect · all ${target.size} squares right</span>`);
    actions([['Replay', begin], ['Next level ›', () => load(lv + 1), 'go']]);
    primary = () => load(lv + 1);
  } else {
    status(`<span class="bad">✗ Wrong square · game over</span>
      <span class="lg"><i class="hit"></i>correct <i class="wrong"></i>wrong <i class="miss"></i>missed</span>`);
    actions([['↺ Restart', confirmRestart], ['Try again', begin, 'go']]);
    primary = begin;
  }
}

function win() {
  clearTimeout(timer); actions([]);
  status(`<span class="ok">All ${MEM_LEVELS} levels cleared</span>`);
  overlay('🏆 You cleared all 50 levels!', 'A 7×7 grid in under a second. That is a sharp memory.', [['Play again', restart]]);
}

function confirmRestart() {
  clearTimeout(timer);
  overlay('Restart from level 1?', `This clears your ${cleared.size} cleared level${cleared.size === 1 ? '' : 's'}.`,
    [['Cancel', () => load(lv), 'alt'], ['Restart', restart]]);
}
function restart() { cleared.clear(); load(0); }

// ---------- hooks used by game.ts ----------
export const memory = {
  enter() { load(lv); },
  exit() { clearTimeout(timer); primary = null; $('ov').hidden = true; $('mact').innerHTML = ''; },
  go(d: number) { load(lv + d); },
  key(e: KeyboardEvent) {
    if ((e.key === 'Enter' || e.key === ' ') && primary) { e.preventDefault(); primary(); }
  },
};
