/* particles.js — ParticleSystem: ограниченный пул, без создания объектов каждый кадр */
'use strict';
class ParticleSystem {
  constructor(quality) { this.pool = []; this.setQuality(quality); }
  setQuality(q) {
    this.cap = q === 'low' ? 70 : q === 'med' ? 180 : 380;
    this.mul = q === 'low' ? 0.35 : q === 'med' ? 0.65 : 1;
    while (this.pool.length < this.cap) this.pool.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 3, col: '#000', type: 0, g: 0, rot: 0, vr: 0 });
    this.pool.length = Math.max(this.pool.length, this.cap);
  }
  _get() { for (let i = 0; i < this.cap; i++) if (!this.pool[i].on) return this.pool[i]; return null; }
  /** type: 0 точка, 1 квадрат (бумага), 2 штрих, 3 кольцо */
  spawn(x, y, vx, vy, life, size, col, type, g) {
    const p = this._get(); if (!p) return;
    p.on = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life; p.size = size; p.col = col; p.type = type || 0; p.g = g === undefined ? 900 : g; p.rot = Math.random() * 6; p.vr = (Math.random() - 0.5) * 12;
  }
  burst(x, y, n, o) {
    n = Math.max(1, Math.round(n * this.mul)); o = o || {};
    for (let i = 0; i < n; i++) {
      const a = o.up ? -Math.PI / 2 + (Math.random() - 0.5) * (o.spread || 2) : Math.random() * 6.283, s = (o.speed || 200) * (0.35 + Math.random() * 0.8);
      this.spawn(x + (Math.random() - 0.5) * (o.rx || 0), y + (Math.random() - 0.5) * (o.ry || 0), Math.cos(a) * s, Math.sin(a) * s, (o.life || 0.6) * (0.6 + Math.random() * 0.6), (o.size || 4) * (0.6 + Math.random() * 0.8), o.col || INK.black, o.type || 0, o.g);
    }
  }
  ring(x, y, col, size) { this.spawn(x, y, 0, 0, 0.45, size || 8, col || INK.black, 3, 0); }
  update(dt) {
    for (let i = 0; i < this.cap; i++) {
      const p = this.pool[i]; if (!p.on) continue;
      p.life -= dt; if (p.life <= 0) { p.on = false; continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.vx *= (1 - Math.min(1, dt * 1.2));
    }
  }
  draw(ctx) {
    ctx.lineCap = 'round';
    for (let i = 0; i < this.cap; i++) {
      const p = this.pool[i]; if (!p.on) continue;
      const k = p.life / p.max; ctx.globalAlpha = Math.min(1, k * 1.6);
      if (p.type === 3) { ctx.strokeStyle = p.col; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(p.x, p.y, p.size + (1 - k) * 46, 0, 6.3); ctx.stroke(); continue; }
      ctx.fillStyle = p.col; ctx.strokeStyle = p.col;
      if (p.type === 0) { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + k * 0.5), 0, 6.3); ctx.fill(); }
      else if (p.type === 1) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7); ctx.strokeStyle = INK.black; ctx.lineWidth = 1; ctx.strokeRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7); ctx.restore(); }
      else { ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
  }
  clear() { for (const p of this.pool) p.on = false; }
}
