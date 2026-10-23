import { levels } from './levels';
import { newSim, step, parseProg } from './engine';
let bad = 0;
levels.forEach((d, i) => {
  const p = parseProg(d.s, d), s = newSim(d);
  while (s.status === 'ready' || s.status === 'run') step(s, p);
  if (s.status !== 'won') bad++;
  console.log(`${s.status === 'won' ? '✓' : '✗'} ${i + 1} ${d.name} (${s.status}, ${s.steps} steps)`);
});
process.exit(bad ? 1 : 0);
