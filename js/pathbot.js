/* pathbot.js — «бот-проверка»: ищет прохождение уровня, используя ту же физику, что и игра.
   Поиск «лучший-первым» по макро-шагам между путевыми точками (контрольные точки -> финиш).
   Работает асинхронно (кусками), чтобы не подвешивать интерфейс. Это не доказательство проходимости,
   а практическая проверка: если бот нашёл путь — уровень точно проходим. */
'use strict';
class PathBot {
  constructor() { this.cancel = false; }
  static get ACTIONS() {
    return [{ l: 0, r: 1, j: 0, d: 0 }, { l: 0, r: 1, j: 1, d: 0 }, { l: 0, r: 0, j: 1, d: 0 }, { l: 1, r: 0, j: 1, d: 0 }, { l: 1, r: 0, j: 0, d: 0 },
      { l: 0, r: 0, j: 0, d: 0 }, { l: 0, r: 1, j: 0, d: 1 }, { l: 1, r: 0, j: 0, d: 1 }, { l: 0, r: 0, j: 0, d: 1 }];
  }
  static isDynamic(level) {
    return level.obj.some(o => o.m || (o.t === 'saw' && o.p && o.p.ty !== 'static') || ['sblock', 'spinner', 'dart', 'laser'].includes(o.t) || (o.t === 'plat' && ['crumble', 'vanish', 'paper', 'weight', 'gate'].includes(o.k)));
  }
  _macro(w, act, pj, pd) {
    const inp = { left: !!act.l, right: !!act.r, jump: !!act.j, down: !!act.d, jumpPressed: false, downPressed: false };
    for (let i = 0; i < 6; i++) {
      inp.jumpPressed = i === 0 && !!act.j && !pj; inp.downPressed = i === 0 && !!act.d && !pd;
      w.step(PHYS.dt, inp);
      if (w.player.dead) return 'dead'; if (w.finished) return 'fin';
    }
    return 'ok';
  }
  _key(w, dyn) {
    const p = w.player; let k = Math.round(p.x / 8) + ',' + Math.round(p.y / 8) + ',' + Math.round(p.vx / 70) + ',' + Math.round(p.vy / 140) + ',' + (p.onGround ? 1 : 0) + (p.climbing ? 'c' : '') + (p.sliding ? 's' : '') + (p.lockT > 0 ? 'k' : '');
    for (const c of w.crates) k += ',' + Math.round(c.x / 14) + ':' + Math.round(c.y / 14);
    for (const e of w.platforms) { if (e.m && e.m.mode === 'trig') k += e.trigged ? 'T' : 'F'; else if (e.kind === 'gate') k += e.open ? 'O' : 'C'; }
    return dyn ? k + ',t' + Math.floor(w.time / 0.3) : k;
  }
  /** Возвращает Promise<{ok, segments, nodes, time, failedAt}> */
  async run(level, opts = {}) {
    this.cancel = false;
    const w = new World(JSON.parse(JSON.stringify(level)), {}), dyn = PathBot.isDynamic(level), maxN = opts.budget || 60000;
    const fin = level.obj.find(o => o.t === 'fin'); if (!fin) return { ok: false, reason: 'нет финиша' };
    let route = level.route ? level.route.map(r => ({ x: r[0], y: r[1] })) : level.obj.filter(o => o.t === 'cp' && !o.start).map(o => ({ x: o.x, y: o.y }));
    route.push({ x: fin.x, y: fin.y, finish: true });
    let cur = w.saveSim(), nodes = 0, steps = 0, lastYield = Date.now();
    for (let k = 0; k < route.length; k++) {
      const tgt = route[k]; w.loadSim(cur); w.player.dead = false;
      const start = w.saveSim(), heap = [], seen = new Set(); let found = null, best = 1e9, n = 0;
      const push = it => { heap.push(it); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p].f <= heap[i].f) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
      const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l].f < heap[m].f) m = l; if (r < heap.length && heap[r].f < heap[m].f) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
      push({ f: 0, s: start, aj: 0, ad: 0, t: 0, len: 0 }); seen.add(this._key(w, dyn));
      while (heap.length && n < maxN && !found) {
        if (this.cancel) return { ok: false, reason: 'отменено' };
        const node = pop(); n++;
        for (const act of PathBot.ACTIONS) {
          w.loadSim(node.s); const r = this._macro(w, act, node.aj, node.ad); if (r === 'dead') continue;
          const p = w.player, h = r === 'fin' ? -1 : Math.hypot(p.cx - tgt.x, (p.y + p.h - tgt.y) * 1.25);
          if (r === 'fin' || (!tgt.finish && h < 46)) { found = { state: w.saveSim(), len: node.len + 1 }; break; }
          const key = this._key(w, dyn); if (seen.has(key)) continue; seen.add(key);
          const t = node.t + 0.05; if (h < best) best = h;
          push({ f: h + t * (dyn ? 6 : 1.5), s: w.saveSim(), aj: act.j, ad: act.d, t, len: node.len + 1 });
        }
        if (Date.now() - lastYield > 20) { if (opts.onProgress) opts.onProgress({ seg: k + 1, segs: route.length, nodes: nodes + n }); await new Promise(r => setTimeout(r, 0)); lastYield = Date.now(); }
      }
      nodes += n;
      if (!found) return { ok: false, failedAt: tgt, segment: k + 1, segments: route.length, nodes, best: Math.round(best) };
      cur = found.state; steps += found.len;
    }
    return { ok: true, segments: route.length, nodes, time: steps * 0.05 };
  }
}
