/* entities.js — объекты мира: платформы, шипы, пилы, ловушки, монеты, флажки и т.д.
   Логика (update/hits) не зависит от DOM и от рисунка. Рисунок (draw) использует HandDrawnAnimator. */
'use strict';

class Entity {
  constructor(d, idx) {
    this.d = d; this.idx = idx;
    this.id = d.id || ('o' + idx);
    this.x = d.x || 0; this.y = d.y || 0;
    this.phase = (Util.hash(this.id + ':' + idx) % 1000) / 1000 * 4;   // фаза «перерисовки»
    this.stateKeys = [];
    this.hazard = false;
  }
  getState() { const s = {}; for (const k of this.stateKeys) { const v = this[k]; s[k] = (v && typeof v === 'object') ? JSON.parse(JSON.stringify(v)) : v; } return s; }
  setState(s) { for (const k of this.stateKeys) { const v = s[k]; this[k] = (v && typeof v === 'object') ? JSON.parse(JSON.stringify(v)) : v; } }
  update(dt, world) {}
  activate(world) {}
  deactivate(world) {}
  hits(r) { return false; }
  bounds() { return { x: this.x, y: this.y, w: 0, h: 0 }; }
  draw(ctx, ha, world) {}
}

/* ============================== ПЛАТФОРМЫ ============================== */
/** kind: solid | ice | oneway | crumble | vanish | paper | spring | conveyor | gate | weight
    move (опц.): {mx,my,sp,ph,mode:'pp'|'swing'|'trig'} */
class Platform extends Entity {
  constructor(d, idx) {
    super(d, idx);
    this.w = d.w; this.h = d.h; this.kind = d.k || 'solid';
    this.x0 = this.x; this.y0 = this.y;
    this.oneway = this.kind === 'oneway';
    this.ice = this.kind === 'ice';
    this.belt = this.kind === 'conveyor' ? (d.dir || 1) * PLAYER_CONFIG.conveyorSpeed : 0;
    this.m = d.m || null;
    this.grp = d.grp || null;
    this.solid = true; this.state = 'idle'; this.timer = 0; this.alpha = 1; this.vy = 0;
    this.t = 0; this.trigged = false; this.compress = 0; this.open = false; this.cool = 0;
    this.dx = 0; this.dy = 0; this.slamT = 0;
    this.wall = this.kind !== 'ice' && this.kind !== 'oneway';      // от стены можно отталкиваться
    this.stateKeys = ['x', 'y', 'solid', 'state', 'timer', 'alpha', 'vy', 't', 'trigged', 'compress', 'open', 'cool', 'slamT'];
    if (this.kind === 'weight') { this.hazardFall = false; this.stateKeys.push('hazardFall'); }
  }
  get isHazardNow() { return this.kind === 'weight' && this.state === 'fall'; }
  hits(r) { return this.isHazardNow && Util.overlap(this, { x: r.x, y: r.y, w: r.w, h: r.h }); }
  bounds() { return { x: this.x - 4, y: this.y - 24 - (this.m && this.m.mode === 'swing' ? 200 : 0) - (this.kind === 'spring' ? 20 : 0), w: this.w + 8, h: this.h + 60 + (this.m && this.m.mode === 'swing' ? 200 : 0) }; }

  /** вызывается физикой, когда игрок стоит на платформе */
  onStand(world) {
    if (this.state !== 'idle') return;
    if (this.kind === 'crumble') {
      this.state = 'shake'; this.timer = 0.42;
      if (this.grp) for (const o of world.groups[this.grp] || []) if (o !== this && o.state === 'idle') { o.state = 'shake'; o.timer = 0.35 + 0.28 * Math.abs(o.gi - this.gi); }
      world.emit('crack', this);
    } else if (this.kind === 'vanish') { this.state = 'blink'; this.timer = 1.5; }
    else if (this.kind === 'paper') { this.state = 'tear'; this.timer = 0.3; world.emit('crack', this); }
  }
  activate(world) {
    if (this.kind === 'gate') this.open = true;
    else if (this.kind === 'weight') { if (this.state === 'rest' || this.state === 'idle') { this.state = 'shake'; this.timer = 0.5; } }
    else if (this.m && this.m.mode === 'trig') this.trigged = true;
  }
  deactivate(world) { if (this.kind === 'gate') this.open = false; }

  _movePos() {
    const m = this.m; if (!m) return;
    if (m.mode === 'swing') {
      const th = Math.sin(this.t * 6.2832 / (m.sp || 4) + (m.ph || 0) * 6.2832);
      this.x = this.x0 + (m.mx || 0) * th; this.y = this.y0 + (m.my || 0) * (1 - Math.cos(th * 1.2)) * 0.5;
    } else if (m.mode === 'trig') {
      if (!this.trigged) { this.x = this.x0; this.y = this.y0; return; }
      const dist = Math.hypot(m.mx, m.my) || 1, u = Math.min(1, (this.t * m.sp) / dist);
      const e = 1 - (1 - u) * (1 - u);
      this.x = this.x0 + m.mx * e; this.y = this.y0 + m.my * e;
    } else {
      const dist = Math.hypot(m.mx, m.my) || 1, T = 2 * dist / m.sp + (m.pause || 0) * 2;
      let s = (this.t + (m.ph || 0) * T) % T; const half = T / 2;
      let u; if (s < half) u = Math.min(1, s / (half - (m.pause || 0))); else u = Math.max(0, 1 - (s - half) / (half - (m.pause || 0)));
      const e = 0.5 - 0.5 * Math.cos(Math.PI * u);
      this.x = this.x0 + m.mx * e; this.y = this.y0 + m.my * e;
    }
  }

  update(dt, world) {
    const ox = this.x, oy = this.y;
    if (this.m) { if (this.m.mode !== 'trig' || this.trigged) this.t += dt; this._movePos(); }
    switch (this.kind) {
      case 'crumble':
        if (this.state === 'shake') { this.timer -= dt; if (this.timer <= 0) { this.state = 'fall'; this.solid = false; this.vy = 0; this.timer = 2.8; world.emit('break', this); } }
        else if (this.state === 'fall') { this.vy += 1500 * dt; this.y += this.vy * dt; this.timer -= dt; this.alpha = Math.max(0, this.timer / 0.5 > 1 ? 1 : this.timer / 0.5); if (this.timer <= 0) { this.state = 'gone'; this.timer = 1.5; this.alpha = 0; } }
        else if (this.state === 'gone') { this.timer -= dt; if (this.timer <= 0 && !world.playerOverlaps(this.x0, this.y0, this.w, this.h)) { this.state = 'idle'; this.x = this.x0; this.y = this.y0; this.solid = true; this.alpha = 1; } }
        break;
      case 'vanish':
        if (this.state === 'blink') { this.timer -= dt; if (this.timer <= 0) { this.state = 'gone'; this.solid = false; this.timer = 2.2; } }
        else if (this.state === 'gone') { this.timer -= dt; if (this.timer <= 0 && !world.playerOverlaps(this.x, this.y, this.w, this.h)) { this.state = 'idle'; this.solid = true; } }
        break;
      case 'paper':
        if (this.state === 'tear') { this.timer -= dt; if (this.timer <= 0) { this.state = 'broken'; this.solid = false; this.timer = 4.5; world.emit('break', this); } }
        else if (this.state === 'broken') { this.timer -= dt; if (this.timer <= 0 && !world.playerOverlaps(this.x, this.y, this.w, this.h)) { this.state = 'idle'; this.solid = true; } }
        break;
      case 'spring': if (this.compress > 0) this.compress = Math.max(0, this.compress - dt * 5); break;
      case 'gate': {
        const target = this.open ? this.y0 - this.h + 6 : this.y0;
        if (this.y !== target) {
          const step = 280 * dt, prev = this.y;
          this.y = Util.approach(this.y, target, step);
          if (this.y > prev && world.anyBodyOverlaps(this)) this.y = prev;   // не закрываемся на игроке/ящике
        }
        break;
      }
      case 'weight': this._updateWeight(dt, world); break;
    }
    this.dx = this.x - ox; this.dy = this.y - oy;
  }

  _updateWeight(dt, world) {
    if (this.state === 'idle') this.state = 'rest';
    if (this.cool > 0) this.cool -= dt;
    if (this.state === 'rest') {
      const p = world.player;
      if (this.d.tr !== 'plate' && this.cool <= 0 && !p.dead) {
        const cx = p.x + p.w / 2, under = cx > this.x - 8 && cx < this.x + this.w + 8 && p.y > this.y + this.h - 4 && p.y < this.y + this.h + (this.d.range || 620);
        if (under) { this.state = 'shake'; this.timer = 0.55; }
      }
    } else if (this.state === 'shake') {
      this.timer -= dt; if (this.timer <= 0) { this.state = 'fall'; this.solid = false; this.vy = 0; }
    } else if (this.state === 'fall') {
      this.vy = Math.min(1500, this.vy + 2600 * dt);
      const ny = this.y + this.vy * dt, probe = { x: this.x, y: this.y + this.h, w: this.w, h: Math.max(1, ny - this.y) };
      let hit = null;
      for (const b of world.solids) if (b !== this && b.solid && !b.oneway && b.kind !== 'weight' && Util.overlap(b, probe)) { if (!hit || b.y < hit.y) hit = b; }
      if (hit) { this.y = hit.y - this.h; this.state = 'slam'; this.solid = true; this.timer = 1.6; world.emit('slam', this); }
      else this.y = ny;
    } else if (this.state === 'slam') {
      this.timer -= dt; if (this.timer <= 0) this.state = 'rise';
    } else if (this.state === 'rise') {
      this.y -= 100 * dt;
      if (this.y <= this.y0) { this.y = this.y0; this.state = 'rest'; this.cool = 1.2; }
    }
  }

  draw(ctx, ha, world) {
    if (this.state === 'broken' || this.state === 'gone' && this.kind === 'crumble') return;
    const k = this.kind, w = this.w, h = this.h;
    // подвесные платформы — верёвки до потолка
    if (this.m && this.m.mode === 'swing') {
      const ax1 = this.x0 + 8, ax2 = this.x0 + w - 8, top = this.y0 - (this.m.len || 220);
      ctx.strokeStyle = INK.pencil; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(this.x + 8, this.y); ctx.lineTo(ax1, top); ctx.moveTo(this.x + w - 8, this.y); ctx.lineTo(ax2, top); ctx.stroke();
      ctx.fillStyle = INK.black; ctx.beginPath(); ctx.arc(ax1, top, 3, 0, 6.3); ctx.arc(ax2, top, 3, 0, 6.3); ctx.fill();
    }
    let alpha = this.alpha, ox = 0, oy = 0;
    if (this.state === 'shake') { ox = Math.sin(world.time * 90) * 2.2; oy = Math.cos(world.time * 70) * 1.2; }
    if (k === 'weight' && this.state === 'shake') { ox = Math.sin(world.time * 80) * 2.5; }
    if (k === 'vanish') { if (this.state === 'blink') alpha = (Math.floor(world.time * (6 + (1.5 - this.timer) * 10)) % 2) ? 0.45 : 1; else if (this.state === 'gone') alpha = 0.14; }
    if (k === 'paper' && this.state === 'tear') ox = Math.sin(world.time * 120) * 1.5;
    if (k === 'spring') { this._drawSpring(ctx, ha); return; }
    if (k === 'weight') { // цепь к потолку
      ctx.strokeStyle = INK.pencil; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.moveTo(this.x + w / 2, this.y); ctx.lineTo(this.x + w / 2, this.y0 - 160); ctx.stroke(); ctx.setLineDash([]);
    }
    const key = 'p|' + k + '|' + w + '|' + h;
    const vs = ha.get(key, 3, Art.platform(k, w, h));
    const v = vs[ha.variant(HAND_FPS.platform, this.phase, 3)];
    ctx.save(); ctx.translate(this.x + ox, this.y + oy);
    HandDrawnAnimator.render(ctx, v, alpha);
    if (k === 'paper' && this.state === 'tear') { ctx.strokeStyle = INK.black; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w * 0.3, 0); ctx.lineTo(w * 0.35, h * 0.5); ctx.lineTo(w * 0.28, h); ctx.moveTo(w * 0.7, 0); ctx.lineTo(w * 0.66, h * 0.6); ctx.stroke(); }
    if (k === 'weight') { ctx.fillStyle = INK.red; ctx.font = 'bold 22px ' + FONT; ctx.textAlign = 'center'; ctx.fillText('!', w / 2, h / 2 + 8); }
    ctx.restore();
  }
  _drawSpring(ctx, ha) {
    const x = this.x, y = this.y, w = this.w, h = this.h, c = this.compress, ph = h * (1 - 0.55 * c);
    ctx.save(); ctx.translate(x, y); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = INK.black; ctx.lineWidth = 3; ctx.beginPath();
    const n = 5, y0 = h, y1 = h - ph + 6; ctx.moveTo(w * 0.5, y0);
    for (let i = 1; i <= n; i++) ctx.lineTo(w * 0.5 + (i % 2 ? 1 : -1) * w * 0.28, y0 + (y1 - y0) * i / n);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,214,90,0.95)'; ctx.lineWidth = 2.6;
    const vv = ha.variant(HAND_FPS.platform, this.phase, 3);
    ctx.beginPath(); ctx.moveTo(1, h - ph + 1 + vv * 0.6); ctx.lineTo(w - 1, h - ph + 1); ctx.lineTo(w - 3, h - ph - 7); ctx.lineTo(3, h - ph - 7 - vv * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}

/* ============================== ЯЩИК ============================== */
class Crate extends Entity {
  constructor(d, idx) {
    super(d, idx);
    this.w = d.s || 46; this.h = this.w; this.vx = 0; this.vy = 0; this.alive = true;
    this.solid = true; this.oneway = false; this.ice = false; this.kind = 'crate'; this.isCrate = true; this.wall = true; this.dx = 0; this.dy = 0; this.belt = 0;
    this.ground = null;
    this.stateKeys = ['x', 'y', 'vy', 'alive'];
  }
  bounds() { return { x: this.x - 6, y: this.y - 6, w: this.w + 12, h: this.h + 12 }; }
  /** толчок по горизонтали; возвращает фактическое смещение */
  pushX(dx, world) {
    if (!this.alive || dx === 0) return 0;
    const old = this.x; this.x += dx;
    for (const b of world.solids) {
      if (b === this || !b.solid || b.oneway) continue;
      if (Util.overlap(this, b)) { this.x = old; return 0; }
    }
    if (world.playerBlockedBy(this, dx)) { this.x = old; return 0; }
    return dx;
  }
  update(dt, world) {
    if (!this.alive) return;
    this.dx = 0; this.dy = 0;
    const oy = this.y, ox = this.x;
    // едем вместе с платформой под нами
    if (this.ground && this.ground.solid && (this.ground.dx || this.ground.dy)) { this.pushX(this.ground.dx, world); this.y += this.ground.dy; }
    this.vy = Math.min(900, this.vy + PLAYER_CONFIG.gravity * dt);
    let dy = this.vy * dt; const n = Math.max(1, Math.ceil(Math.abs(dy) / 6)), st = dy / n; this.ground = null;
    for (let i = 0; i < n; i++) {
      this.y += st;
      for (const b of world.solids) {
        if (b === this || !b.solid) continue;
        if (b.oneway) { if (st > 0 && this.y + this.h - st <= b.y + 2 && Util.overlap(this, b)) { this.y = b.y - this.h; this.vy = 0; this.ground = b; } continue; }
        if (Util.overlap(this, b)) { if (st > 0) { this.y = b.y - this.h; this.vy = 0; this.ground = b; } else { this.y = b.y + b.h; this.vy = 0; } }
      }
    }
    if (this.y > world.h + 300) this.alive = false;
    this.dx = this.x - ox; this.dy = this.y - oy;
  }
  draw(ctx, ha, world) {
    if (!this.alive) return;
    const vs = ha.get('c|' + this.w, 3, Art.crate(this.w)), v = vs[ha.variant(HAND_FPS.crate, this.phase, 3)];
    ctx.save(); ctx.translate(this.x, this.y); HandDrawnAnimator.render(ctx, v); ctx.restore();
  }
}

/* ============================== ШИПЫ ============================== */
class Spike extends Entity {
  constructor(d, idx) {
    super(d, idx);
    this.n = d.n || 1; this.dir = d.dir || 'u'; this.tw = 22; this.th = 22;
    const horiz = this.dir === 'u' || this.dir === 'd';
    this.w = horiz ? this.n * this.tw : this.th; this.h = horiz ? this.th : this.n * this.tw;
    this.hid = !!d.hid; this.state = this.hid ? 'hidden' : 'out'; this.ext = this.hid ? 0 : 1; this.timer = 0;
    this.hazard = true; this.stateKeys = ['state', 'ext', 'timer'];
  }
  bounds() { return { x: this.x - 4, y: this.y - 4, w: this.w + 8, h: this.h + 8 }; }
  activate() { if (this.hid && this.state === 'hidden') { this.state = 'warn'; this.timer = 0.4; } }
  update(dt) {
    if (this.state === 'warn') { this.timer -= dt; if (this.timer <= 0) this.state = 'out'; }
    else if (this.state === 'out' && this.ext < 1) this.ext = Math.min(1, this.ext + dt * 9);
  }
  /** локальные (вдоль полосы, вверх от основания) -> мировые координаты */
  toWorld(lx, ly) {
    const x = this.x, y = this.y, w = this.w, h = this.h;
    switch (this.dir) {
      case 'u': return [x + lx, y + ly];
      case 'd': return [x + w - lx, y + h - ly];
      case 'r': return [x + this.th - ly, y + lx];
      default: return [x + ly, y + h - lx];   // 'l'
    }
  }
  hits(r) {
    if (this.ext < 0.55) return false;
    const rr = { x: r.x + 3, y: r.y + 3, w: r.w - 6, h: r.h - 6 };
    // быстрый отсев по прямоугольнику
    if (!Util.overlap(this, rr)) return false;
    for (let k = 0; k < this.n; k++) {
      const a = this.toWorld(k * this.tw + 3, this.th), b = this.toWorld(k * this.tw + this.tw / 2, this.th * (1 - this.ext) + 4), c = this.toWorld(k * this.tw + this.tw - 3, this.th);
      if (Util.triRect([a, b, c], rr)) return true;
    }
    return false;
  }
  draw(ctx, ha, world) {
    if (this.state === 'hidden' || this.state === 'warn') {
      // подсказка: чернильные точки на месте будущих шипов
      ctx.fillStyle = INK.red;
      const warn = this.state === 'warn' && (Math.floor(world.time * 16) % 2);
      for (let k = 0; k < this.n; k++) { const p = this.toWorld(k * this.tw + this.tw / 2, 3); ctx.beginPath(); ctx.arc(p[0], p[1], warn ? 3.5 : 2, 0, 6.3); ctx.fill(); }
      if (this.state === 'hidden') return;
    }
    const key = 's|' + this.n + '|' + this.tw + '|' + this.th;
    const vs = ha.get(key, 3, Art.spike(this.n, this.tw, this.th)), v = vs[ha.variant(HAND_FPS.spike, this.phase, 3)];
    ctx.save();
    const o = this.toWorld(0, 0), ang = { u: 0, d: Math.PI, r: Math.PI / 2, l: -Math.PI / 2 }[this.dir];
    ctx.translate(o[0], o[1]); ctx.rotate(ang);
    if (this.ext < 1) ctx.scale(1, this.ext);
    ctx.translate(0, 0); HandDrawnAnimator.render(ctx, v); ctx.restore();
  }
}

/* ============================== ПИЛЫ ============================== */
/** d.p: {ty:'static'|'h'|'v'|'pend'|'circ'|'trig', rg, sp, ph, ang, mx, my, tr} */
class Saw extends Entity {
  constructor(d, idx) {
    super(d, idx);
    this.r = d.r || 36; this.p = d.p || { ty: 'static' };
    this.x0 = d.x; this.y0 = d.y; this.cx = d.x; this.cy = d.y; this.t = 0; this.spin = 0;
    this.state = 'idle'; this.timer = 0; this.moved = 0;
    this.hazard = true; this.stateKeys = ['t', 'state', 'timer', 'moved', 'cx', 'cy'];
    this._pos();
  }
  bounds() {
    const p = this.p, r = this.r + 10;
    let x1 = this.x0 - r, x2 = this.x0 + r, y1 = this.y0 - r, y2 = this.y0 + r;
    if (p.ty === 'h') { x1 -= p.rg; x2 += p.rg; } else if (p.ty === 'v') { y1 -= p.rg; y2 += p.rg; }
    else if (p.ty === 'pend' || p.ty === 'circ') { x1 -= p.rg; x2 += p.rg; y1 -= p.ty === 'circ' ? p.rg : 0; y2 += p.rg; }
    else if (p.ty === 'trig') { x2 = Math.max(x2, this.x0 + (p.mx || 0) + r); x1 = Math.min(x1, this.x0 + (p.mx || 0) - r); y2 = Math.max(y2, this.y0 + (p.my || 0) + r); y1 = Math.min(y1, this.y0 + (p.my || 0) - r); }
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }
  activate() { if (this.p.ty === 'trig' && this.state === 'idle') { this.state = 'warn'; this.timer = 0.45; } }
  _tri(t, len) { // треугольная волна 0..1..0 с периодом 2*len/sp
    const T = 2 * len, s = ((t % T) + T) % T; return s < len ? s / len : 2 - s / len;
  }
  _pos() {
    const p = this.p, t = this.t + (p.ph || 0) * 4;
    switch (p.ty) {
      case 'h': { const u = this._tri(t * p.sp, p.rg * 2) * 2 - 1; this.cx = this.x0 + u * p.rg; this.cy = this.y0; break; }
      case 'v': { const u = this._tri(t * p.sp, p.rg * 2) * 2 - 1; this.cx = this.x0; this.cy = this.y0 + u * p.rg; break; }
      case 'pend': { const A = (p.ang || 60) * Math.PI / 180, th = A * Math.sin(t * 6.2832 / (p.sp || 3)); this.cx = this.x0 + Math.sin(th) * p.rg; this.cy = this.y0 + Math.cos(th) * p.rg; break; }
      case 'circ': { const a = t * (p.sp || 1.5); this.cx = this.x0 + Math.cos(a) * p.rg; this.cy = this.y0 + Math.sin(a) * p.rg; break; }
      case 'trig': { const dist = Math.hypot(p.mx || 0, p.my || 0) || 1, u = Math.min(1, this.moved / dist); this.cx = this.x0 + (p.mx || 0) * u; this.cy = this.y0 + (p.my || 0) * u; break; }
      default: this.cx = this.x0; this.cy = this.y0;
    }
  }
  update(dt, world) {
    this.spin += dt * (this.state === 'idle' && this.p.ty === 'trig' ? 3 : 14);
    const ty = this.p.ty;
    if (ty === 'trig') {
      if (this.state === 'idle') {
        const pl = world.player, R = this.p.tr || 260;
        if (!pl.dead && Math.abs(pl.x + pl.w / 2 - this.x0) < R && Math.abs(pl.y + pl.h / 2 - this.y0) < R * 0.8) { this.state = 'warn'; this.timer = 0.45; }
      } else if (this.state === 'warn') { this.timer -= dt; if (this.timer <= 0) this.state = 'go'; }
      else if (this.state === 'go') { this.moved += (this.p.sp || 420) * dt; }
    } else this.t += dt;
    this._pos();
  }
  hits(r) { return Util.circleRect(this.cx, this.cy, this.r * 0.82, { x: r.x + 3, y: r.y + 3, w: r.w - 6, h: r.h - 6 }); }
  draw(ctx, ha, world) {
    const p = this.p;
    // рельс / подвес — тонкий карандаш
    ctx.strokeStyle = 'rgba(80,80,90,0.55)'; ctx.lineWidth = 1.6; ctx.setLineDash([4, 7]); ctx.beginPath();
    if (p.ty === 'h') { ctx.moveTo(this.x0 - p.rg, this.y0); ctx.lineTo(this.x0 + p.rg, this.y0); }
    else if (p.ty === 'v') { ctx.moveTo(this.x0, this.y0 - p.rg); ctx.lineTo(this.x0, this.y0 + p.rg); }
    else if (p.ty === 'pend') { ctx.setLineDash([]); ctx.lineWidth = 2.4; ctx.moveTo(this.x0, this.y0); ctx.lineTo(this.cx, this.cy); }
    else if (p.ty === 'circ') { ctx.arc(this.x0, this.y0, p.rg, 0, 6.3); }
    else if (p.ty === 'trig') { ctx.moveTo(this.x0, this.y0); ctx.lineTo(this.x0 + (p.mx || 0), this.y0 + (p.my || 0)); }
    ctx.stroke(); ctx.setLineDash([]);
    if (p.ty === 'pend') { ctx.fillStyle = INK.black; ctx.beginPath(); ctx.arc(this.x0, this.y0, 4, 0, 6.3); ctx.fill(); }
    const r = this.r, vs = ha.get('w|' + r, 4, Art.saw(r, 0)), v = vs[ha.variant(HAND_FPS.saw, this.phase, 4)];
    ctx.save(); ctx.translate(this.cx, this.cy);
    if (p.ty === 'trig' && this.state === 'warn') { ctx.translate(Math.sin(world.time * 100) * 2.5, 0); }
    ctx.rotate(this.spin); HandDrawnAnimator.render(ctx, v, p.ty === 'trig' && this.state === 'idle' ? 0.75 : 1);
    ctx.restore();
    if (p.ty === 'trig' && this.state === 'warn') { ctx.fillStyle = INK.red; ctx.font = 'bold 30px ' + FONT; ctx.textAlign = 'center'; ctx.fillText('!', this.cx, this.cy - r - 8); }
  }
}

/* ============================== ШИПАСТЫЙ БЛОК ============================== */
class SpikeBlock extends Entity {
  constructor(d, idx) {
    super(d, idx);
    this.s = d.s || 56; this.m = d.m || { mx: 0, my: 0, sp: 100 }; this.x0 = d.x; this.y0 = d.y; this.cx = d.x; this.cy = d.y; this.t = 0;
    this.hazard = true; this.stateKeys = ['t', 'cx', 'cy']; this._pos();
  }
  bounds() { const m = this.m, s = this.s / 2 + 16; return { x: Math.min(this.x0, this.x0 + m.mx) - s, y: Math.min(this.y0, this.y0 + m.my) - s, w: Math.abs(m.mx) + s * 2, h: Math.abs(m.my) + s * 2 }; }
  _pos() {
    const m = this.m, dist = Math.hypot(m.mx, m.my) || 1, T = 2 * dist / m.sp, s = (this.t + (m.ph || 0) * T) % T, u = s < T / 2 ? s / (T / 2) : 2 - s / (T / 2);
    this.cx = this.x0 + m.mx * u; this.cy = this.y0 + m.my * u;
  }
  update(dt) { this.t += dt; this._pos(); }
  hits(r) { const h = this.s / 2 + 8; return Util.overlap({ x: this.cx - h, y: this.cy - h, w: h * 2, h: h * 2 }, { x: r.x + 4, y: r.y + 4, w: r.w - 8, h: r.h - 8 }); }
  draw(ctx, ha, world) {
    const m = this.m; ctx.strokeStyle = 'rgba(80,80,90,0.5)'; ctx.lineWidth = 1.6; ctx.setLineDash([4, 7]); ctx.beginPath(); ctx.moveTo(this.x0, this.y0); ctx.lineTo(this.x0 + m.mx, this.y0 + m.my); ctx.stroke(); ctx.setLineDash([]);
    const vs = ha.get('b|' + this.s, 3, Art.block(this.s)), v = vs[ha.variant(HAND_FPS.hazard, this.phase, 3)];
    ctx.save(); ctx.translate(this.cx, this.cy); HandDrawnAnimator.render(ctx, v); ctx.restore();
  }
}

/* ============================== ВРАЩАЮЩИЙСЯ МЕХАНИЗМ ============================== */
class Spinner extends Entity {
  constructor(d, idx) {
    super(d, idx);
    this.L = d.L || 90; this.th = 14; this.sp = d.sp || 1.8; this.a0 = d.a0 || 0; this.t = 0; this.ang = this.a0;
    this.hazard = true; this.stateKeys = ['t', 'ang'];
  }
  bounds() { const L = this.L + 30; return { x: this.x - L, y: this.y - L, w: L * 2, h: L * 2 }; }
  update(dt) { this.t += dt; this.ang = this.a0 + this.t * this.sp; }
  hits(r) {
    const c = Math.cos(this.ang), s = Math.sin(this.ang), L = this.L, g = this.th / 2 + 1;
    const rr = { x: r.x + 3 - g, y: r.y + 3 - g, w: r.w - 6 + g * 2, h: r.h - 6 + g * 2 };
    if (Math.hypot(r.x + r.w / 2 - this.x, r.y + r.h / 2 - this.y) > L + 60) return false;
    return Util.segRect(this.x - c * L, this.y - s * L, this.x + c * L, this.y + s * L, rr);
  }
  draw(ctx, ha) {
    const vs = ha.get('sp|' + this.L, 3, Art.spinner(this.L, this.th)), v = vs[ha.variant(HAND_FPS.hazard, this.phase, 3)];
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.ang); HandDrawnAnimator.render(ctx, v); ctx.restore();
  }
}

/* ============================== СТРЕЛЯЛКА ДРОТИКАМИ ============================== */
class DartShooter extends Entity {
  constructor(d, idx) {
    super(d, idx);
    this.w = 38; this.h = 38; this.dir = d.dir || 'l'; this.per = d.per || 2.2; this.off = d.off || 0; this.sp = d.sp || 380;
    this.t = 0; this.darts = []; this.burst = 0; this.burstT = 0; this.warn = 0; this.hazard = true;
    this.stateKeys = ['t', 'darts', 'burst', 'burstT', 'warn'];
  }
  bounds() { return { x: this.x - 20, y: this.y - 20, w: this.w + 40 + (this.dir === 'l' || this.dir === 'r' ? 700 : 0), h: this.h + 40 + (this.dir === 'u' || this.dir === 'd' ? 700 : 0) }; }
  activate() { this.burst = this.d.nb || 3; this.burstT = 0.35; }
  _muzzle() {
    switch (this.dir) { case 'l': return [this.x - 4, this.y + this.h / 2, -1, 0]; case 'r': return [this.x + this.w + 4, this.y + this.h / 2, 1, 0]; case 'u': return [this.x + this.w / 2, this.y - 4, 0, -1]; default: return [this.x + this.w / 2, this.y + this.h + 4, 0, 1]; }
  }
  _fire(world) { const m = this._muzzle(); this.darts.push({ x: m[0], y: m[1], vx: m[2] * this.sp, vy: m[3] * this.sp, age: 0 }); world.emit('dart', this); }
  update(dt, world) {
    this.t += dt;
    if (this.d.tr !== 'plate') {
      const T = this.per, s = (this.t + this.off) % T;
      this.warn = s > T - 0.5 ? 1 : 0;
      if (this._lastS !== undefined && s < this._lastS) this._fire(world);
      this._lastS = s;
    } else if (this.burst > 0) {
      this.warn = 1; this.burstT -= dt;
      if (this.burstT <= 0) { this._fire(world); this.burst--; this.burstT = 0.28; if (this.burst === 0) this.warn = 0; }
    }
    for (const d of this.darts) {
      d.x += d.vx * dt; d.y += d.vy * dt; d.age += dt;
      if (d.age > 5 || d.x < -100 || d.x > world.w + 100 || d.y < -300 || d.y > world.h + 200) d.dead = true;
      else for (const b of world.solids) if (b.solid && !b.oneway && !b.isCrate && d.x > b.x && d.x < b.x + b.w && d.y > b.y && d.y < b.y + b.h) { d.dead = true; break; }
    }
    if (this.darts.length && this.darts.some(d => d.dead)) this.darts = this.darts.filter(d => !d.dead);
  }
  hits(r) {
    for (const d of this.darts) {
      const hw = d.vx ? 16 : 4, hh = d.vx ? 4 : 16;
      if (Util.overlap({ x: d.x - hw, y: d.y - hh, w: hw * 2, h: hh * 2 }, { x: r.x + 3, y: r.y + 3, w: r.w - 6, h: r.h - 6 })) return true;
    }
    return false;
  }
  draw(ctx, ha, world) {
    const vs = ha.get('ds|', 3, Art.scribbleBox(this.w, this.h, INK.pencil)), v = vs[ha.variant(HAND_FPS.hazard, this.phase, 3)];
    ctx.save(); ctx.translate(this.x, this.y); HandDrawnAnimator.render(ctx, v);
    // «дуло» + предупреждение
    const m = this._muzzle(); ctx.restore();
    ctx.fillStyle = this.warn && (Math.floor(world.time * 14) % 2) ? INK.red : INK.black;
    ctx.beginPath(); ctx.arc(m[0] - m[2] * 4, m[1] - m[3] * 4, 6, 0, 6.3); ctx.fill();
    if (this.warn) { ctx.strokeStyle = 'rgba(214,53,44,0.55)'; ctx.lineWidth = 2; ctx.setLineDash([3, 9]); ctx.beginPath(); ctx.moveTo(m[0], m[1]); ctx.lineTo(m[0] + m[2] * 360, m[1] + m[3] * 360); ctx.stroke(); ctx.setLineDash([]); }
    for (const d of this.darts) {
      ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(Math.atan2(d.vy, d.vx)); ctx.strokeStyle = INK.black; ctx.fillStyle = INK.red; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(10, 0); ctx.stroke(); ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(7, -5); ctx.lineTo(7, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-19, -5); ctx.moveTo(-14, 0); ctx.lineTo(-19, 5); ctx.stroke(); ctx.restore();
    }
  }
}

/* ============================== ЛАЗЕР ============================== */
class Laser extends Entity {
  constructor(d, idx) {
    super(d, idx);
    this.len = d.len || 200; this.vert = d.o === 'v'; this.on = d.on || 1.5; this.off = d.off || 1.4; this.ph = d.ph || 0; this.t = 0; this.active = false; this.warn = false;
    this.hazard = true; this.stateKeys = ['t', 'active', 'warn'];
  }
  bounds() { return this.vert ? { x: this.x - 20, y: this.y - 12, w: 40, h: this.len + 24 } : { x: this.x - 12, y: this.y - 20, w: this.len + 24, h: 40 }; }
  update(dt) {
    this.t += dt; const T = this.on + this.off, s = (this.t + this.ph * T) % T;
    this.active = s < this.on; this.warn = !this.active && s > T - 0.65;
  }
  _rect() { return this.vert ? { x: this.x - 4, y: this.y, w: 8, h: this.len } : { x: this.x, y: this.y - 4, w: this.len, h: 8 }; }
  hits(r) { return this.active && Util.overlap(this._rect(), { x: r.x + 3, y: r.y + 3, w: r.w - 6, h: r.h - 6 }); }
  draw(ctx, ha, world) {
    const x2 = this.vert ? this.x : this.x + this.len, y2 = this.vert ? this.y + this.len : this.y;
    if (this.warn || this.active) {
      const f = ha.variant(HAND_FPS.hazard * 2, this.phase, 3), j = f * 0.9 - 0.9;
      ctx.lineCap = 'round';
      if (this.active) { ctx.strokeStyle = INK.red; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(x2 + (this.vert ? j : 0), y2 + (this.vert ? 0 : j)); ctx.stroke(); ctx.strokeStyle = 'rgba(255,200,190,0.9)'; ctx.lineWidth = 2; ctx.stroke(); }
      else { ctx.strokeStyle = 'rgba(214,53,44,0.5)'; ctx.lineWidth = 2.4; ctx.setLineDash([5, 9]); ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([]); }
    }
    ctx.fillStyle = 'rgba(240,236,224,0.95)'; ctx.strokeStyle = INK.black; ctx.lineWidth = 2.6;
    for (const [px, py] of [[this.x, this.y], [x2, y2]]) { ctx.beginPath(); ctx.arc(px, py, 9, 0, 6.3); ctx.fill(); ctx.stroke(); ctx.fillStyle = this.active ? INK.red : INK.black; ctx.beginPath(); ctx.arc(px, py, 3, 0, 6.3); ctx.fill(); ctx.fillStyle = 'rgba(240,236,224,0.95)'; }
  }
}

/* ============================== НАЖИМНАЯ ПЛИТА ============================== */
class Plate extends Entity {
  constructor(d, idx) {
    super(d, idx);
    this.w = d.w || 64; this.h = 10; this.tg = d.tg || []; this.hold = d.hold !== false && !d.once; this.pressed = false; this.used = false; this.sink = 0;
    this.stateKeys = ['pressed', 'used', 'sink'];
  }
  bounds() { return { x: this.x - 4, y: this.y - 30, w: this.w + 8, h: 50 }; }
  update(dt, world) {
    const zone = { x: this.x + 2, y: this.y - 6, w: this.w - 4, h: 10 };
    const p = world.player;
    let on = (!p.dead && Util.overlap(zone, { x: p.x, y: p.y + p.h - 3, w: p.w, h: 5 }));
    if (!on) for (const c of world.crates) if (c.alive && Util.overlap(zone, { x: c.x, y: c.y + c.h - 3, w: c.w, h: 5 })) { on = true; break; }
    if (on && !this.pressed && !(this.used && !this.hold)) {
      this.pressed = true; this.used = true; world.emit('plate', this);
      for (const id of this.tg) { const e = world.byId[id]; if (e) e.activate(world); }
    } else if (!on && this.pressed && this.hold) {
      this.pressed = false; for (const id of this.tg) { const e = world.byId[id]; if (e) e.deactivate(world); }
    }
    this.sink = Util.approach(this.sink, this.pressed ? 1 : 0, dt * 8);
  }
  draw(ctx, ha) {
    const vs = ha.get('pl|' + this.w, 3, Art.scribbleBox(this.w, 8, INK.red)), v = vs[ha.variant(HAND_FPS.hazard, this.phase, 3)];
    ctx.save(); ctx.translate(this.x, this.y + 2 + this.sink * 6); HandDrawnAnimator.render(ctx, v);
    ctx.strokeStyle = INK.black; ctx.lineWidth = 2; ctx.beginPath(); const cx = this.w / 2; ctx.moveTo(cx, -26); ctx.lineTo(cx, -10); ctx.lineTo(cx - 6, -16); ctx.moveTo(cx, -10); ctx.lineTo(cx + 6, -16); ctx.stroke();
    ctx.restore();
  }
}

/* ============================== СБОРНЫЕ ПРЕДМЕТЫ / ТОЧКИ ============================== */
class Coin extends Entity {
  constructor(d, idx) {
    super(d, idx);
    this.v = d.v || 1; this.kind = this.v === 's' ? 'secret' : this.v === 5 ? 'big' : 'coin';
    this.r = this.kind === 'big' ? 20 : this.kind === 'secret' ? 19 : 14;
    this.value = this.kind === 'secret' ? 10 : this.v; this.taken = false; this.stateKeys = [];
  }
  bounds() { return { x: this.x - 30, y: this.y - 30, w: 60, h: 60 }; }
  hitsPlayer(p) { return !this.taken && Util.circleRect(this.x, this.y, this.r + 4, p); }
  draw(ctx, ha, world) {
    if (this.taken) return;
    const bob = Math.sin(world.time * 3 + this.phase * 2) * 3.5;
    const vs = ha.get('co|' + this.kind, 3, Art.coin(this.kind, this.r)), v = vs[ha.variant(HAND_FPS.coin, this.phase, 3)];
    ctx.save(); ctx.translate(this.x, this.y + bob); if (this.kind === 'secret') ctx.rotate(Math.sin(world.time * 2 + this.phase) * 0.2);
    HandDrawnAnimator.render(ctx, v); ctx.restore();
  }
}

class Checkpoint extends Entity {
  constructor(d, idx) { super(d, idx); this.active = !!d.start; this.stateKeys = ['active']; }
  bounds() { return { x: this.x - 40, y: this.y - 110, w: 100, h: 130 }; }
  rect() { return { x: this.x - 22, y: this.y - 90, w: 44, h: 90 }; }
  draw(ctx, ha, world) {
    if (this.d.start) return;
    const vs = ha.get('f|' + this.active, 3, Art.flag(this.active)), v = vs[ha.variant(HAND_FPS.flag, this.phase, 3)];
    ctx.save(); ctx.translate(this.x, this.y); HandDrawnAnimator.render(ctx, v); ctx.restore();
  }
}

class Finish extends Entity {
  constructor(d, idx) { super(d, idx); this.reached = false; this.openT = 0; this.stateKeys = ['reached', 'openT']; }
  bounds() { return { x: this.x - 70, y: this.y - 150, w: 140, h: 170 }; }
  rect() { return { x: this.x - 26, y: this.y - 96, w: 52, h: 96 }; }
  update(dt) { if (this.reached) this.openT = Math.min(1, this.openT + dt * 3); }
  draw(ctx, ha, world) {
    const v = ha.variant(HAND_FPS.finish, this.phase, 3), j = (v - 1) * 1.1, x = this.x, y = this.y;
    ctx.save(); ctx.translate(x, y); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.fillStyle = this.openT > 0 ? 'rgba(255,240,170,0.95)' : 'rgba(240,236,224,0.95)'; ctx.strokeStyle = INK.black; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(-34 + j, 0); ctx.lineTo(-34, -88); ctx.quadraticCurveTo(0 + j, -122, 34, -88 + j); ctx.lineTo(34 + j, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    // створка
    const open = this.openT; ctx.fillStyle = 'rgba(190,150,100,0.95)';
    ctx.beginPath(); ctx.moveTo(-28, -4); ctx.lineTo(-28, -86); ctx.lineTo(-28 + 56 * (1 - open) * 0.5 - open * 6, -86 + 0); ctx.lineTo(-28 + 56 * (1 - open) * 0.5 - open * 6, -4); ctx.closePath(); ctx.fill(); ctx.lineWidth = 2.4; ctx.stroke();
    ctx.fillStyle = INK.black; ctx.font = 'bold 17px ' + FONT; ctx.textAlign = 'center'; ctx.fillText('FINISH', j, -132 + (v - 1) * 0.6);
    ctx.strokeStyle = INK.red; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-40, -150); ctx.lineTo(40, -146 + j); ctx.stroke();
    ctx.restore();
  }
}

class Rope extends Entity {
  constructor(d, idx) { super(d, idx); this.h = d.h || 200; }
  rect() { return { x: this.x - 12, y: this.y, w: 24, h: this.h }; }
  bounds() { return { x: this.x - 20, y: this.y - 10, w: 40, h: this.h + 20 }; }
  draw(ctx, ha) {
    const vs = ha.get('r|' + this.h, 3, Art.rope(this.h)), v = vs[ha.variant(HAND_FPS.rope, this.phase, 3)];
    ctx.save(); ctx.translate(this.x, this.y); HandDrawnAnimator.render(ctx, v); ctx.restore();
  }
}

/** Секретная зона: «закрашенная» комната, исчезающая при входе игрока */
class SecretZone extends Entity {
  constructor(d, idx) { super(d, idx); this.w = d.w; this.h = d.h; this.found = false; this.fade = 1; this.stateKeys = ['found', 'fade']; }
  bounds() { return { x: this.x - 8, y: this.y - 8, w: this.w + 16, h: this.h + 16 }; }
  update(dt, world) {
    const p = world.player;
    if (!this.found && !p.dead && Util.overlap(this, p)) { this.found = true; world.emit('reveal', this); }
    if (this.found) this.fade = Math.max(0, this.fade - dt * 2.5);
  }
  draw(ctx, ha, world) {
    if (this.fade <= 0.01) return;
    ctx.save(); ctx.globalAlpha = this.fade;
    ctx.fillStyle = world.paperFill || INK.paper; ctx.fillRect(this.x - 3, this.y - 3, this.w + 6, this.h + 6);
    // каракули поверх, как будто комнату замалевали
    const key = 'sz|' + this.w + '|' + this.h, vs = ha.get(key, 3, (i, rnd, A) => {
      const p = new Path2D(), a = A(2); Sketch.hatch(p, 0, 0, this.w, this.h, 13, rnd, a); const q = new Path2D(); Sketch.rect(q, 0, 0, this.w, this.h, rnd, a);
      return { fills: [], strokes: [{ p, c: INK.pencil, w: 1.3 }, { p: q, c: INK.black, w: 2.2, dash: [10, 7] }] };
    });
    ctx.translate(this.x, this.y); HandDrawnAnimator.render(ctx, vs[ha.variant(HAND_FPS.deco, this.phase, 3)]);
    ctx.restore();
  }
}

/** Декорации и надписи (физики нет) */
class Deco extends Entity {
  constructor(d, idx) { super(d, idx); this.sz = d.sz || 40; this.kind = d.k || 'scribble'; }
  bounds() { const s = this.sz * 2; return { x: this.x - s, y: this.y - s * 1.5, w: s * 2, h: s * 2 }; }
  draw(ctx, ha) {
    const vs = ha.get('d|' + this.kind + '|' + this.sz, 3, Art.deco(this.kind, this.sz)), v = vs[ha.variant(HAND_FPS.deco, this.phase, 3)];
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.d.rot || 0); HandDrawnAnimator.render(ctx, v); ctx.restore();
  }
}
class TextNote extends Entity {
  constructor(d, idx) { super(d, idx); this.s = d.s || ''; this.sz = d.sz || 26; this.lines = this.s.split('\n'); }
  bounds() { const w = Math.max(...this.lines.map(l => l.length)) * this.sz * 0.6; return { x: this.x - w / 2 - 10, y: this.y - this.sz * 1.3, w: w + 20, h: this.sz * 1.6 * this.lines.length + 10 }; }
  draw(ctx, ha) {
    const v = ha.variant(HAND_FPS.deco, this.phase, 3), jx = (v - 1) * 0.9 * ha.intensity, jy = ((v * 2) % 3 - 1) * 0.7 * ha.intensity;
    ctx.save(); ctx.translate(this.x + jx, this.y + jy); ctx.rotate((this.d.rot || 0) + (v - 1) * 0.006 * ha.intensity);
    ctx.font = this.sz + 'px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = this.d.c || 'rgba(60,60,75,0.85)';
    this.lines.forEach((l, i) => ctx.fillText(l, 0, i * this.sz * 1.25)); ctx.restore();
  }
}

/** Фабрика: JSON-описание -> объект */
const EntityFactory = {
  create(d, idx) {
    switch (d.t) {
      case 'plat': return new Platform(d, idx);
      case 'crate': return new Crate(d, idx);
      case 'spike': return new Spike(d, idx);
      case 'saw': return new Saw(d, idx);
      case 'sblock': return new SpikeBlock(d, idx);
      case 'spinner': return new Spinner(d, idx);
      case 'dart': return new DartShooter(d, idx);
      case 'laser': return new Laser(d, idx);
      case 'plate': return new Plate(d, idx);
      case 'coin': return new Coin(d, idx);
      case 'cp': return new Checkpoint(d, idx);
      case 'fin': return new Finish(d, idx);
      case 'rope': return new Rope(d, idx);
      case 'secret': return new SecretZone(d, idx);
      case 'deco': return new Deco(d, idx);
      case 'txt': return new TextNote(d, idx);
      default: return null;
    }
  },
};
if (typeof module !== 'undefined') module.exports = { EntityFactory };
