/* camera.js — плавная камера. Мир -> экран: отдельное преобразование. HUD в камеру не попадает. */
'use strict';
class Camera {
  constructor() { this.x = 0; this.y = 0; this.zoom = 1; this.vw = 800; this.vh = 600; this.shakeT = 0; this.shakeA = 0; this.sx = 0; this.sy = 0; this.slow = 0; this.sw = 800; this.sh = 600; }
  /** подгоняет масштаб под экран: ширина и высота видимой области в «мировых» пикселях */
  resize(sw, sh, userZoom) {
    this.sw = sw; this.sh = sh;
    const portrait = sh > sw;
    const base = portrait ? Math.min(sh / 760, sw / 520) : Math.min(sh / 600, sw / 760);
    this.zoom = Math.max(0.2, base * (userZoom || 1));
    this.vw = sw / this.zoom; this.vh = sh / this.zoom;
  }
  shake(a, t) { this.shakeA = Math.max(this.shakeA, a); this.shakeT = Math.max(this.shakeT, t); }
  _clamp(world) {
    const m = 60;
    this.x = world.w <= this.vw ? world.w / 2 : Util.clamp(this.x, this.vw / 2, world.w - this.vw / 2);
    const hh = world.h + 80;
    this.y = hh <= this.vh ? hh / 2 - 40 : Util.clamp(this.y, this.vh / 2 - m, world.h + 80 - this.vh / 2);
  }
  snap(p, world) { this.x = p.cx; this.y = p.cy - this.vh * 0.08; this._clamp(world); this.slow = 0; }
  update(dt, p, world) {
    const look = p.facing * 80 * Util.clamp(Math.abs(p.vx) / 200, 0.25, 1);
    const tx = p.cx + look, ty = p.cy - this.vh * 0.09;
    const kx = this.slow > 0 ? 3 : 6, ky = this.slow > 0 ? 3 : (p.vy > 500 ? 9 : p.onGround ? 4.5 : 5.5);
    this.x += (tx - this.x) * (1 - Math.exp(-kx * dt));
    const dy = ty - this.y, dz = this.vh * 0.1;                 // вертикальная мёртвая зона
    if (Math.abs(dy) > dz) this.y += (dy - Math.sign(dy) * dz) * (1 - Math.exp(-ky * dt));
    else this.y += dy * (1 - Math.exp(-1.5 * dt)) * 0.3;
    if (this.slow > 0) this.slow -= dt;
    this._clamp(world);
    if (this.shakeT > 0) { this.shakeT -= dt; const a = this.shakeA * Math.min(1, this.shakeT * 6); this.sx = (Math.random() - 0.5) * a; this.sy = (Math.random() - 0.5) * a; if (this.shakeT <= 0) { this.shakeA = 0; this.sx = this.sy = 0; } }
  }
  apply(ctx, dpr) {
    const z = this.zoom * dpr;
    ctx.setTransform(z, 0, 0, z, (-(this.x - this.vw / 2) + this.sx) * z, (-(this.y - this.vh / 2) + this.sy) * z);
  }
  view(pad) { pad = pad || 0; return { x: this.x - this.vw / 2 - pad, y: this.y - this.vh / 2 - pad, w: this.vw + pad * 2, h: this.vh + pad * 2 }; }
  toWorld(sx, sy) { return { x: (sx - this.sw / 2) / this.zoom + this.x, y: (sy - this.sh / 2) / this.zoom + this.y }; }
}
