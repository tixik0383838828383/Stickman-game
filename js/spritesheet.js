/* spritesheet.js — SpriteSheet (загрузка/разбор листа) и AnimationController */
'use strict';
class SpriteSheet {
  constructor() { this.img = null; this.frames = []; this.ready = false; this.info = null; this.keyed = false; }
  /** Загружает лист и разметку кадров. Работает и с file:// (данные встроены в assets/*.js). */
  async load() {
    let info = window.SPRITES_JSON;
    if (!info) { const r = await fetch('assets/sprites.json'); info = await r.json(); }
    this.info = info; this.frames = info.frames;
    const img = new Image();
    const src = window.SHEET_DATA_URI || 'assets/stickman_sheet.png';
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('Не удалось загрузить спрайт-лист')); img.src = src; });
    this.img = img;
    this.ensureTransparent(40);
    this.ready = true;
    return this;
  }
  /** Цветовой ключ: если лист пришёл с непрозрачным почти чёрным фоном — делаем его прозрачным.
      threshold — порог яркости (0..255), всё темнее считается фоном (мягкая кромка). */
  ensureTransparent(threshold) {
    try {
      const c = document.createElement('canvas'); c.width = this.img.width; c.height = this.img.height;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(this.img, 0, 0);
      const d = x.getImageData(0, 0, 4, 4).data;
      const opaque = d[3] === 255 && Math.max(d[0], d[1], d[2]) < threshold;
      if (!opaque) return;                       // уже прозрачный
      const id = x.getImageData(0, 0, c.width, c.height), p = id.data;
      for (let i = 0; i < p.length; i += 4) {
        const m = Math.max(p[i], p[i + 1], p[i + 2]);
        if (m < threshold) p[i + 3] = 0;
        else if (m < threshold * 2) p[i + 3] = Math.round(255 * (m - threshold) / threshold);
      }
      x.putImageData(id, 0, 0);
      this.img = c; this.keyed = true;
    } catch (e) { /* tainted canvas (file:// без встроенных данных) — оставляем как есть */ }
  }
  /** i — номер кадра ИЛИ объект { sx, sy, sw, sh [, ax, ay] } (произвольный прямоугольник исходного изображения) */
  frame(i) {
    if (i && typeof i === 'object') return { sx: i.sx, sy: i.sy, sw: i.sw, sh: i.sh, ax: i.ax !== undefined ? i.ax : i.sx + i.sw / 2, ay: i.ay !== undefined ? i.ay : i.sy + i.sh };
    return this.frames[i] || this.frames[0];
  }
  /** Рисует кадр так, чтобы точка опоры (ax, ay) оказалась в (x, y). flip — отражение по горизонтали. */
  draw(ctx, i, x, y, scale, flip, alpha) {
    const f = this.frame(i); if (!f) return;
    const w = f.sw * scale, h = f.sh * scale, offX = (f.ax - f.sx) * scale, offY = (f.ay - f.sy) * scale;
    if (alpha !== undefined && alpha < 1) ctx.globalAlpha = alpha;
    if (flip) { ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1); ctx.drawImage(this.img, f.sx, f.sy, f.sw, f.sh, -offX, y - offY, w, h); ctx.restore(); }
    else ctx.drawImage(this.img, f.sx, f.sy, f.sw, f.sh, x - offX, y - offY, w, h);
    if (alpha !== undefined && alpha < 1) ctx.globalAlpha = 1;
  }
}

/** AnimationController — скорость анимации задаётся в секундах и не зависит от FPS браузера */
class AnimationController {
  constructor() { this.name = ''; this.t = 0; this.index = 0; this.finished = false; this.speed = 1; }
  play(name, restart = false) {
    if (this.name === name && !restart) return;
    if (!ANIMATIONS[name]) name = 'idle';
    this.name = name; this.t = 0; this.index = 0; this.finished = false;
  }
  get def() { return ANIMATIONS[this.name] || ANIMATIONS.idle; }
  update(dt) {
    const d = this.def, n = d.frames.length;
    this.t += dt * this.speed;
    let k = Math.floor(this.t * d.fps);
    if (d.loop) k = ((k % n) + n) % n;
    else if (k >= n) { k = n - 1; this.finished = true; }
    this.index = k;
  }
  get frame() { const d = this.def; return d.frames[Math.min(this.index, d.frames.length - 1)]; }
}
