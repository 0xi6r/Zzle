// zzle and memory 
// game.ts — UI, rendering and input. Rules live in engine.ts, levels in levels.ts.
import { levels } from './levels';
import { Slot, Sim, newSim, step, parseProg } from './engine';
import { hints } from './hints';
import { memory } from './memory';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const cv = $<HTMLCanvasElement>('cv'), g = cv.getContext('2d')!;
const T = 40, COLS = 16, ROWS = 12;
const COL = ['#6c3df0', '#1fb8a8', '#ffb02e'], DARK = ['#5630c4', '#118a7d', '#d98f14'];
const SPEEDS = [420, 170, 45];

let li = 0, prog: Slot[][] = [], sel: [number, number] = [0, 0], sim: Sim, timer = 0, speed = 1;
let solved = new Set<number>();
let fails = 0;
// timer: when on, each level is clocked from load until solved; best times are kept per level
let timing = false, best: Record<number, number> = {}, t0 = 0, tEnd: number | null = null;
try {
  solved = new Set(JSON.parse(localStorage.getItem('zzle-solved') || '[]'));
  li = +(localStorage.getItem('zzle-level') || 0);
  timing = localStorage.getItem('zzle-timer') === '1';
  best = JSON.parse(localStorage.getItem('zzle-times') || '{}');
} catch {}

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
    : `${m}:${String(s % 60).padStart(2, '0')}`;
};
const elapsed = () => (tEnd ?? performance.now()) - t0;

const icon = (a: string) =>
  a === 'u' ? '↑' : a === 'l' ? '↶' : a === 'r' ? '↷' : a[0] === 'c' ? a[1]
  : a ? `<b style="color:${COL[+a[1]]}">✚</b>` : '';

// ---------- rendering ----------
function draw() {
  g.clearRect(0, 0, cv.width, cv.height);
  const ox = Math.floor((COLS - sim.w) / 2), oy = Math.floor((ROWS - sim.h) / 2);
  g.fillStyle = '#2b2b2b';
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) g.fillRect(x * T + 1, y * T + 1, T - 2, T - 2);
  sim.board.forEach((row, y) => row.forEach((c, x) => {
    if (c < 0) return;
    const px = (x + ox) * T, py = (y + oy) * T;
    g.fillStyle = COL[c]; g.beginPath(); g.roundRect(px + 1, py + 1, T - 2, T - 2, 4); g.fill();
    if (c === 1) { // hatching for teal
      g.save(); g.beginPath(); g.rect(px + 1, py + 1, T - 2, T - 2); g.clip();
      g.strokeStyle = DARK[1]; g.lineWidth = 3;
      for (let k = -T; k < T; k += 9) { g.beginPath(); g.moveTo(px + k, py + T); g.lineTo(px + k + T, py); g.stroke(); }
      g.restore();
    }
    if (sim.stars.has(`${x},${y}`)) star(px + T / 2, py + T / 2);
  }));
  // robot
  g.save();
  g.translate((sim.x + ox + 0.5) * T, (sim.y + oy + 0.5) * T);
  g.rotate(sim.d * Math.PI / 2);
  g.globalAlpha = sim.status === 'fell' ? 0.35 : 1;
  g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(0, -14); g.lineTo(11, 11); g.lineTo(0, 5); g.lineTo(-11, 11); g.closePath(); g.fill(); g.stroke();
  g.restore();
}

function star(cx: number, cy: number) {
  g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 5 : 12, a = -Math.PI / 2 + i * Math.PI / 5;
    g[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.closePath(); g.fill(); g.stroke();
}

// ---------- UI building ----------
function buildPalette() {
  const d = levels[li], pal = $('pal'), calls = $('calls');
  pal.innerHTML = calls.innerHTML = '';
  const add = (html: string, fn: () => void, cls: string, host: HTMLElement, tip = '') => {
    const b = document.createElement('button'); b.className = 'btn ' + cls; b.innerHTML = html; b.title = tip; b.onclick = fn; host.append(b);
  };
  for (const ch of 'ulr') if (d.a.includes(ch)) add(icon(ch), () => place(ch), '', pal, { u: 'Forward', l: 'Turn left', r: 'Turn right' }[ch]);
  for (const k of d.k) add('', () => cond(+k), 'k' + k, pal, 'Only run if standing on this colour');
  if (d.a.includes('p')) for (let c = 0; c < 3; c++) add(icon('p' + c), () => place('p' + c), '', pal, 'Paint this tile');
  if (d.a.includes('c')) d.f.forEach((_, f) => add(String(f), () => place('c' + f), '', calls, 'Call function ' + f));
}

function buildEditor() {
  const box = $('funcs'); box.innerHTML = '';
  prog.forEach((slots, f) => {
    const row = document.createElement('div'); row.className = 'frow';
    row.innerHTML = `<span class="lab">${f}</span>`;
    slots.forEach((s, i) => {
      const e = document.createElement('div');
      const act = sim.status === 'run' && sim.active && sim.active[0] === f && sim.active[1] === i;
      e.className = 'slot' + (s && s.c !== null ? ' k' + s.c : '') + (sel[0] === f && sel[1] === i ? ' sel' : '') + (act ? ' act' : '');
      e.innerHTML = s ? icon(s.a) : '';
      e.onclick = () => { sel = [f, i]; buildEditor(); };
      row.append(e);
    });
    box.append(row);
  });
}

function buildDots() {
  const box = $('dots'); box.innerHTML = '';
  levels.forEach((_, i) => {
    const b = document.createElement('button');
    b.className = 'dot' + (solved.has(i) ? ' done' : '') + (i === li ? ' cur' : '');
    b.textContent = String(i + 1); b.title = levels[i].name + (best[i] != null ? ` · best ${fmt(best[i])}` : ''); b.onclick = () => load(i);
    box.append(b);
  });
  $<HTMLButtonElement>('prev').disabled = li === 0;
  $<HTMLButtonElement>('skip').disabled = li === levels.length - 1;
}

// ---------- timer ----------
function drawTimer() {
  const b = $('timer');
  b.classList.toggle('on', timing);
  b.textContent = timing ? `⏱ ${fmt(elapsed())}` : '⏱ Timer';
  b.title = timing ? 'Timer on — click to turn off' : 'Time each level and track your best times';
}
function drawProgress() {
  const p = $('progress'); p.hidden = !timing;
  if (!timing) return;
  const timed = Object.values(best), total = timed.reduce((a, b) => a + b, 0);
  p.innerHTML = `Solved <b>${solved.size}/${levels.length}</b> · timed <b>${timed.length}</b> · total best <b>${fmt(total)}</b>`
    + (best[li] != null ? ` · this level best <b>${fmt(best[li])}</b>` : '');
}
function restartClock() { t0 = performance.now(); tEnd = null; drawTimer(); }
setInterval(() => { if (timing && tEnd === null) drawTimer(); }, 250);

const HOWTO = `<h2>How to play</h2>
<p><b>Goal:</b> collect every ★ with the robot. If it steps off the colored path, it falls.</p>
<p><b>Build a program:</b> click a slot at the bottom, then click a command. The robot starts at function <b>0</b> and runs its slots left to right.</p>
<ul>
<li><b>↑</b> move forward &nbsp; <b>↶ ↷</b> turn left / right</li>
<li><b>0 1 2…</b> call that function, then come back. A function can call itself to repeat.</li>
<li><b>✚</b> paint the tile you stand on with that color.</li>
<li><b>Colored squares</b> are conditions: with the slot selected, click one so the command only runs when the robot stands on that color. Click again to remove it.</li>
</ul>
<p><b>Controls:</b> ▶ run/pause · › single step · ↻ restart · ✕ clear program · ×1 speed. Keys: arrows move the selection, Backspace clears a slot, Enter runs.</p>
<p><b>Timer:</b> click ⏱ Timer to clock each level from when it opens until it's solved. Your best time per level is saved and the line below the buttons shows your overall progress.</p>
<p><b>Tips:</b> tile colors can tell the robot where to turn. Painting lets a tile behave differently the second time you reach it. Stuck? Use <b>Hint</b>.</p>`;
function showModal(html: string) { $('mbody').innerHTML = html; $('modal').hidden = false; }
const closeModal = () => { $('modal').hidden = true; };

const setStatus = (t: string, cls = '') => { const s = $('status'); s.textContent = t; s.className = cls; };

// ---------- editing ----------
function place(a: string) {
  const [f, i] = sel;
  prog[f][i] = { c: prog[f][i]?.c ?? null, a };
  if (i + 1 < prog[f].length) sel = [f, i + 1];
  edited();
}
function cond(c: number) {
  const [f, i] = sel, s = prog[f][i] || { c: null, a: '' };
  s.c = s.c === c ? null : c;
  prog[f][i] = s.c === null && !s.a ? null : s;
  edited();
}
function clearSlot() { prog[sel[0]][sel[1]] = null; edited(); }

function edited() { // any change restarts the simulation
  stop();
  if (tEnd !== null) restartClock(); // replaying a solved level starts a fresh attempt
  sim = newSim(levels[li]);
  $('ov').hidden = true;
  setStatus('Pick a slot, then a command. Press ▶ to run.');
  buildEditor(); draw();
}

function load(i: number) {
  li = Math.max(0, Math.min(levels.length - 1, i || 0));
  const d = levels[li];
  prog = d.f.map(n => Array(n).fill(null));
  sel = [0, 0]; fails = 0; $('help').classList.remove('pulse');
  $('title').textContent = `Level ${li + 1} · ${d.name}`;
  try { localStorage.setItem('zzle-level', String(li)); } catch {}
  restartClock(); drawProgress();
  buildPalette(); buildDots(); edited();
}

// ---------- running ----------
const over = () => ['won', 'fell', 'done', 'loop'].includes(sim.status);
function stop() { clearTimeout(timer); timer = 0; $('run').textContent = '▶'; }

function advance() {
  step(sim, prog); buildEditor(); draw();
  if (over()) finish();
}
function tick() { advance(); if (!over()) timer = window.setTimeout(tick, SPEEDS[speed]); }

function finish() {
  stop();
  if (sim.status === 'won') {
    solved.add(li);
    try { localStorage.setItem('zzle-solved', JSON.stringify([...solved])); } catch {}
    let timeLine = '';
    if (timing && tEnd === null) {
      tEnd = performance.now();
      const t = elapsed(), prev = best[li], record = prev == null || t < prev;
      if (record) {
        best[li] = t;
        try { localStorage.setItem('zzle-times', JSON.stringify(best)); } catch {}
      }
      timeLine = `<div style="font-size:16px">⏱ ${fmt(t)}${record ? (prev == null ? '' : ' · new best!') : ` · best ${fmt(prev!)}`}</div>`;
      drawTimer(); drawProgress();
    }
    buildDots(); setStatus(`Solved in ${sim.steps} steps!`, 'ok');
    const last = li === levels.length - 1, ov = $('ov');
    ov.innerHTML = `<div>${last ? '🎉 All levels solved!' : '★ Level complete'}</div>${timeLine}<div>
      <button class="alt" id="again">Replay</button> ${last ? '' : '<button id="nextlvl">Next level ›</button>'}</div>`;
    ov.hidden = false;
    $('again').onclick = () => edited();
    if (!last) $('nextlvl').onclick = () => load(li + 1);
  } else {
    const n = sim.stars.size;
    setStatus({ fell: 'The robot fell off the path.', done: `Program ended with ${n} star${n === 1 ? '' : 's'} left.`,
      loop: 'Too many steps — probably an infinite loop.' }[sim.status as 'fell' | 'done' | 'loop'], 'bad');
    if (++fails >= 2) { $('help').classList.add('pulse'); $('status').textContent += ' Stuck? Try Hint.'; }
  }
}

$('run').onclick = () => {
  if (timer) return stop();
  if (over()) edited();
  $('run').textContent = '❚❚'; tick();
};
$('step').onclick = () => { stop(); if (over()) edited(); advance(); };
$('reset').onclick = () => edited();
$('clear').onclick = () => { prog = levels[li].f.map(n => Array(n).fill(null)); sel = [0, 0]; edited(); };
$('speed').onclick = () => { speed = (speed + 1) % 3; $('speed').textContent = `×${speed + 1}`; };
$('prev').onclick = () => mode === 'memory' ? memory.go(-1) : load(li - 1);
$('skip').onclick = () => mode === 'memory' ? memory.go(1) : load(li + 1);

// ---------- modes ----------
// The robot puzzles and the memory game share the header, level dots, board overlay and status line.
let mode: 'robot' | 'memory' = 'robot';
try { if (localStorage.getItem('zzle-mode') === 'memory') mode = 'memory'; } catch {}
function setMode(m: typeof mode) {
  mode = m;
  try { localStorage.setItem('zzle-mode', m); } catch {}
  document.body.classList.toggle('memory', m === 'memory');
  document.querySelectorAll<HTMLElement>('#modes [data-m]').forEach(b => b.classList.toggle('cur', b.dataset.m === m));
  if (m === 'memory') { stop(); closeModal(); memory.enter(); }
  else { memory.exit(); $('title').textContent = `Level ${li + 1} · ${levels[li].name}`; buildDots(); edited(); }
}
document.querySelectorAll<HTMLElement>('#modes [data-m]').forEach(b => { b.onclick = () => { if (b.dataset.m !== mode) setMode(b.dataset.m as typeof mode); }; });

$('timer').onclick = () => {
  timing = !timing;
  try { localStorage.setItem('zzle-timer', timing ? '1' : '0'); } catch {}
  restartClock(); drawProgress();
};
$('howto').onclick = () => showModal(HOWTO);
$('help').onclick = () => {
  $('help').classList.remove('pulse');
  showModal(`<h2>Level ${li + 1} · ${levels[li].name}</h2><p>${hints[li] ?? 'Collect every star.'}</p>
    <p class="dim">Still stuck? <button id="sol" class="nav">Show solution</button></p>`);
  $('sol').onclick = () => { prog = parseProg(levels[li].s, levels[li]); sel = [0, 0]; edited(); closeModal(); };
};
$('mclose').onclick = closeModal;
$('modal').onclick = e => { if (e.target === $('modal')) closeModal(); };

addEventListener('keydown', e => {
  if (!$('modal').hidden) { if (e.key === 'Escape') closeModal(); return; }
  if (mode === 'memory') return memory.key(e);
  const [f, i] = sel;
  if (e.key === 'Backspace' || e.key === 'Delete') { clearSlot(); e.preventDefault(); }
  else if (e.key === 'Enter') $('run').click();
  else if (e.key === 'ArrowRight' && prog[f][i + 1] !== undefined) { sel = [f, i + 1]; buildEditor(); }
  else if (e.key === 'ArrowLeft' && prog[f][i - 1] !== undefined) { sel = [f, i - 1]; buildEditor(); }
  else if (e.key === 'ArrowDown' && prog[f + 1]) { sel = [f + 1, Math.min(i, prog[f + 1].length - 1)]; buildEditor(); }
  else if (e.key === 'ArrowUp' && prog[f - 1]) { sel = [f - 1, Math.min(i, prog[f - 1].length - 1)]; buildEditor(); }
});

load(li);
setMode(mode);
