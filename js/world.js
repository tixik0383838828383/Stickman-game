/* world.js — World: собирает мир из JSON-уровня, обновляет объекты, проверяет опасности,
   хранит снимки состояния для контрольных точек. Не зависит от DOM (используется и в автотестах). */
'use strict';
class World {
  /** level — JSON-описание; opts.prevCollected — id монет, собранных в прошлых прохождениях */
  constructor(level, opts = {}) {
    this.level = level; this.w = level.w; this.h = level.h; this.time = 0; this.events = [];
    this.entities = []; this.solids = []; this.crates = []; this.platforms = []; this.hazards = []; this.coins = [];
    this.cps = []; this.ropes = []; this.finishes = []; this.late = []; this.early = []; this.byId = {}; this.groups = {};
    this.prevCollected = opts.prevCollected || new Set();
    this.coinCount = 0; this.coinIds = []; this.secretIds = []; this.deaths = 0; this.finished = false; this.runTime = 0;
    this.nearSaw = 1e9; this.paperFill = null;
    level.obj.forEach((d, i) => {
      const e = EntityFactory.create(d, i); if (!e) return;
      this.entities.push(e); if (d.id) this.byId[d.id] = e;
      if (e instanceof Platform) { this.platforms.push(e); this.solids.push(e); if (e.grp) (this.groups[e.grp] = this.groups[e.grp] || []).push(e); }
      else if (e instanceof Crate) { this.crates.push(e); this.solids.push(e); }
      else if (e instanceof Coin) { e.id = d.id || ('c' + i); this.coins.push(e); }
      else if (e instanceof Checkpoint) this.cps.push(e);
      else if (e instanceof Finish) { this.finishes.push(e); this.late.push(e); }
      else if (e instanceof Rope) this.ropes.push(e);
      else if (e instanceof Plate || e instanceof SecretZone) this.late.push(e);
      else if (e.hazard) { this.hazards.push(e); this.early.push(e); }
    });
    for (const k of Object.keys(this.groups)) { this.groups[k].sort((a, b) => a.x - b.x); this.groups[k].forEach((e, i) => e.gi = i); }
    this.player = new Player();
    this.spawn = { x: level.start.x, y: level.start.y };
    this.player.reset(this.spawn.x, this.spawn.y);
    this.snapshot = this.takeSnapshot();
    this.cpIndex = -1;
  }
  emit(name, data) { if (this.events.length < 200) this.events.push({ name, data }); }

  /* ---------- снимки (контрольные точки) ---------- */
  takeSnapshot() { return this.entities.map(e => e.getState()); }
  restoreSnapshot() { this.entities.forEach((e, i) => e.setState(this.snapshot[i])); }
  respawn() {
    this.restoreSnapshot();
    this.player.reset(this.spawn.x, this.spawn.y);
    // чтобы не появиться внутри платформы после восстановления
    this.emit('respawn', this.player);
  }

  /* ---------- вспомогательные запросы ---------- */
  playerOverlaps(x, y, w, h) { const p = this.player; return !p.dead && Util.overlap({ x, y, w, h }, p); }
  anyBodyOverlaps(g) {
    const p = this.player; if (!p.dead && Util.overlap(g, p)) return true;
    for (const c of this.crates) if (c.alive && Util.overlap(g, c)) return true;
    return false;
  }
  playerBlockedBy(crate, dx) { const p = this.player; return !p.dead && Util.overlap(crate, p); }
  ropeAt(p) {
    for (const r of this.ropes) { const rc = r.rect(); if (p.x + p.w / 2 > rc.x && p.x + p.w / 2 < rc.x + rc.w && p.y + p.h > rc.y && p.y + p.h * 0.35 < rc.y + rc.h) return r; }
    return null;
  }
  killPlayer(reason) {
    const p = this.player; if (p.dead || p.victory) return;
    p.dead = true; p.deathT = 0; this.deaths++; this.emit('death', { reason });
  }

  /* ---------- один шаг симуляции (фиксированный dt) ---------- */
  step(dt, input) {
    this.time += dt; if (!this.finished) this.runTime += dt;
    const p = this.player;
    // фаза A: платформы, ящики, опасности
    for (const e of this.platforms) e.update(dt, this);
    for (const e of this.crates) e.update(dt, this);
    for (const e of this.early) e.update(dt, this);
    // фаза B: игрок
    PhysicsEngine.step(this, input, dt);
    if (p.dead) p.deathT += dt;
    // фаза C: взаимодействия
    for (const e of this.late) e.update(dt, this);
    if (!p.dead && !p.victory) {
      if (p.y > this.h + 160) this.killPlayer('fall');
      else {
        for (const e of this.hazards) { if (e.hits(p)) { this.killPlayer(e instanceof Saw ? 'saw' : 'hazard'); break; } }
        if (!p.dead) for (const e of this.platforms) if (e.kind === 'weight' && e.hits(p)) { this.killPlayer('weight'); break; }
      }
    }
    if (!p.dead) {
      for (const c of this.coins) {
        if (c.hitsPlayer(p)) {
          c.taken = true; this.coinCount += c.value; this.coinIds.push({ id: c.id, value: c.value });
          if (c.kind === 'secret') { this.secretIds.push(c.id); this.emit('secret', c); } else this.emit(c.kind === 'big' ? 'bigcoin' : 'coin', c);
        }
      }
      for (let i = 0; i < this.cps.length; i++) {
        const cp = this.cps[i];
        if (!cp.active && !cp.d.start && Util.overlap(cp.rect(), p)) {
          cp.active = true; this.spawn = { x: cp.x, y: cp.y }; this.cpIndex = i; this.snapshot = this.takeSnapshot(); this.emit('checkpoint', cp);
        }
      }
      if (!p.victory) for (const f of this.finishes) if (Util.overlap(f.rect(), p)) { f.reached = true; p.victory = true; p.vx = 0; this.finished = true; this.emit('finish', f); break; }
    }
    // громкость пил — для звука
    let ns = 1e9; const cx = p.cx, cy = p.cy;
    for (const e of this.hazards) if (e instanceof Saw) { const d = Math.hypot(e.cx - cx, e.cy - cy); if (d < ns) ns = d; }
    this.nearSaw = ns;
  }


  /* ---------- сохранение/загрузка полного состояния (для автотестов-ботов) ---------- */
  saveSim() {
    const p = this.player, ps = {};
    for (const k of Object.keys(p)) { const v = p[k]; if (typeof v === 'number' || typeof v === 'boolean') ps[k] = v; }
    return { time: this.time, runTime: this.runTime, ent: this.entities.map(e => e.getState()), taken: this.coins.map(c => c.taken), p: ps,
      gi: p.ground ? this.solids.indexOf(p.ground) : -1, deaths: this.deaths, finished: this.finished, spawn: { x: this.spawn.x, y: this.spawn.y },
      snapshot: this.snapshot, coinCount: this.coinCount, coinIds: this.coinIds.slice(), secretIds: this.secretIds.slice(), cpIndex: this.cpIndex };
  }
  loadSim(s) {
    this.time = s.time; this.runTime = s.runTime; this.entities.forEach((e, i) => e.setState(s.ent[i]));
    this.coins.forEach((c, i) => c.taken = s.taken[i]);
    Object.assign(this.player, s.p); this.player.ground = s.gi >= 0 ? this.solids[s.gi] : null;
    this.deaths = s.deaths; this.finished = s.finished; this.spawn = { x: s.spawn.x, y: s.spawn.y }; this.snapshot = s.snapshot;
    this.coinCount = s.coinCount; this.coinIds = s.coinIds.slice(); this.secretIds = s.secretIds.slice(); this.cpIndex = s.cpIndex; this.events.length = 0;
  }

  /* ---------- отрисовка (порядок слоёв) ---------- */
  draw(ctx, ha, sheet, view) {
    const vis = e => { const b = e.bounds(); return b.x < view.x + view.w && b.x + b.w > view.x && b.y < view.y + view.h && b.y + b.h > view.y; };
    const layers = [
      e => e instanceof Deco || e instanceof TextNote, e => e instanceof Rope, e => e instanceof Plate,
      e => e instanceof Platform || e instanceof Crate, e => e instanceof Spike, e => e instanceof Checkpoint || e instanceof Finish,
      e => e instanceof Coin, e => e.hazard && !(e instanceof Spike),
    ];
    for (const f of layers) for (const e of this.entities) if (f(e) && vis(e)) e.draw(ctx, ha, this);
    this.player.draw(ctx, sheet, ha, this.time);
    for (const e of this.entities) if (e instanceof SecretZone && vis(e)) e.draw(ctx, ha, this);
  }
}
if (typeof module !== 'undefined') module.exports = { World };
