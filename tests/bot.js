/* Бот-проходимец: ищет последовательность нажатий, приводящую к финишу, используя НАСТОЯЩУЮ физику игры.
   Поиск «лучший-первым» по макро-шагам между путевыми точками (контрольные точки -> финиш).
   Использование: node tests/bot.js [номер уровня | all] [--secrets] */
const { load } = require('./simload');
const X = load(); const { World, PhysicsEngine, PHYS, LEVELS } = X;
const dt = PHYS.dt, MACRO = 6;
const ACTIONS = [
  { l: 0, r: 1, j: 0, d: 0 }, { l: 0, r: 1, j: 1, d: 0 }, { l: 0, r: 0, j: 1, d: 0 }, { l: 1, r: 0, j: 1, d: 0 },
  { l: 1, r: 0, j: 0, d: 0 }, { l: 0, r: 0, j: 0, d: 0 }, { l: 0, r: 1, j: 0, d: 1 }, { l: 1, r: 0, j: 0, d: 1 }, { l: 0, r: 0, j: 0, d: 1 },
];
class Heap { constructor() { this.a = []; } push(it) { const a = this.a; a.push(it); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a; const top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < a.length && a[l].f < a[m].f) m = l; if (r < a.length && a[r].f < a[m].f) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
  get size() { return this.a.length; } }

function runMacro(w, act, prevJ, prevD) {
  const inp = { left: !!act.l, right: !!act.r, jump: !!act.j, down: !!act.d, jumpPressed: false, downPressed: false };
  for (let i = 0; i < MACRO; i++) {
    inp.jumpPressed = i === 0 && act.j && !prevJ; inp.downPressed = i === 0 && act.d && !prevD;
    w.step(dt, inp);
    if (w.player.dead) return 'dead';
    if (w.finished) return 'fin';
  }
  return 'ok';
}
function keyOf(w, dyn) {
  const p = w.player; let k = Math.round(p.x / 8) + ',' + Math.round(p.y / 8) + ',' + Math.round(p.vx / 70) + ',' + Math.round(p.vy / 140) + ',' + (p.onGround ? 1 : 0) + (p.climbing ? 'c' : '') + (p.sliding ? 's' : '') + (p.lockT > 0 ? 'k' : '');
  for (const c of w.crates) k += ',' + Math.round(c.x / 14) + ':' + Math.round(c.y / 14);
  for (const e of w.platforms) if (e.m && e.m.mode === 'trig') k += e.trigged ? 'T' : 'F'; else if (e.kind === 'gate') k += e.open ? 'O' : 'C';
  if (dyn) k += ',t' + Math.floor(w.time / 0.3);
  return k;
}
function search(w, target, opts) {
  const start = w.saveSim(), dyn = opts.dyn, maxN = opts.maxN || 150000;
  const hf = () => { const p = w.player; return Math.hypot(p.cx - target.x, (p.y + p.h - target.y) * 1.25); };
  const heap = new Heap(), seen = new Set(); let n = 0, best = 1e9, bestState = null;
  heap.push({ f: 0, s: start, aj: 0, ad: 0, path: null, t: 0 }); seen.add(keyOf(w, dyn));
  while (heap.size && n < maxN) {
    const node = heap.pop(); n++;
    for (const act of ACTIONS) {
      w.loadSim(node.s);
      const r = runMacro(w, act, node.aj, node.ad);
      if (r === 'dead') continue;
      const h = r === 'fin' ? -1 : hf();
      const reached = r === 'fin' || (!opts.finish && h < 46);
      const child = { s: null, aj: act.j, ad: act.d, path: { a: act, prev: node.path }, t: node.t + MACRO * dt, f: 0 };
      if (reached) { return { ok: true, state: w.saveSim(), path: child.path, n }; }
      const k = keyOf(w, dyn); if (seen.has(k)) continue; seen.add(k);
      child.s = w.saveSim(); child.f = h + child.t * (dyn ? 6 : 1.5);
      if (h < best) { best = h; bestState = child.s; }
      heap.push(child);
    }
  }
  return { ok: false, best, n, state: bestState };
}
function waypointsOf(level) {
  const w = []; const cps = level.obj.filter(o => o.t === 'cp').sort((a, b) => (a.ord || 0) - (b.ord || 0));
  const items = [];
  for (const o of level.obj) if (o.t === 'cp' && !o.start) items.push({ x: o.x, y: o.y, o: o });
  if (level.bot) for (const b of level.bot) items.push({ x: b[0], y: b[1], ord: b[2] });
  const fin = level.obj.find(o => o.t === 'fin');
  return { items, fin };
}
function testLevel(i, verbose) {
  const level = LEVELS[i]; const w = new World(level, {});
  const t0 = Date.now(); const dyn = level.dyn !== undefined ? level.dyn : level.obj.some(o => o.m || (o.t === 'saw' && o.p && o.p.ty !== 'static') || ['sblock', 'spinner', 'dart', 'laser'].includes(o.t) || (o.t === 'plat' && ['crumble', 'vanish', 'paper', 'weight', 'gate'].includes(o.k)));
  // порядок путевых точек: как заданы в level.route (если есть) иначе — контрольные точки по x/слою
  let route = process.env.BOT_ROUTE ? JSON.parse(process.env.BOT_ROUTE) .map(r => ({ x: r[0], y: r[1] })) : level.route ? level.route.map(r => ({ x: r[0], y: r[1] })) : [];
  if (!level.route && !process.env.BOT_ROUTE) { route = level.obj.filter(o => o.t === 'cp' && !o.start).map(o => ({ x: o.x, y: o.y })); }
  const fin = level.obj.find(o => o.t === 'fin'); if (!process.env.BOT_NOFIN) route.push({ x: fin.x, y: fin.y, finish: true });
  let total = 0, steps = 0; let cur = w.saveSim();
  for (let k = 0; k < route.length; k++) {
    w.loadSim(cur); w.player.dead = false;
    const r = search(w, route[k], { dyn, finish: !!route[k].finish, maxN: level.botN || 150000 });
    total += r.n;
    if (!r.ok) { if (verbose) console.log(`  ✗ сегмент ${k + 1}/${route.length} -> (${route[k].x},${route[k].y}) не найден; лучший h=${r.best.toFixed(0)}, узлов ${r.n}`); if (verbose && r.state) console.log('    лучшее положение игрока: x=' + Math.round(r.state.p.x) + ' y=' + Math.round(r.state.p.y) + ' t=' + r.state.time.toFixed(1)); return { ok: false, seg: k, best: r.best, bestState: r.state, n: total, ms: Date.now() - t0 }; }
    cur = r.state; // продолжаем из достигнутого состояния; игрок мог пройти флаг — это нормально
    let len = 0; for (let p = r.path; p; p = p.prev) len++; steps += len;
    if (verbose) console.log(`  ✓ сегмент ${k + 1}/${route.length} (${len * MACRO * dt}s, узлов ${r.n})`);
  }
  return { ok: true, time: (steps * MACRO * dt).toFixed(1), n: total, ms: Date.now() - t0 };
}
module.exports = { testLevel };
if (require.main === module) {
  const arg = process.argv[2] || 'all'; const verbose = !process.argv.includes('-q');
  const list = arg === 'all' ? LEVELS.map((_, i) => i) : [parseInt(arg) - 1];
  let bad = 0;
  for (const i of list) {
    console.log(`Уровень ${i + 1}: ${LEVELS[i].name}`);
    const r = testLevel(i, verbose);
    console.log(r.ok ? `  ПРОХОДИМ ✔ ~${r.time}s игрового времени, узлов ${r.n}, ${r.ms} мс` : `  НЕ ПРОЙДЕН ✘ (сегмент ${r.seg + 1})`);
    if (!r.ok) bad++;
  }
  process.exit(bad ? 1 : 0);
}
