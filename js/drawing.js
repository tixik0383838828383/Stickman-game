/* drawing.js — «ожившая бумага»: эскизные примитивы, кэш вариантов рисунка (Path2D),
   HandDrawnAnimator и процедурная бумага. Здесь меняется ТОЛЬКО картинка — физика не затрагивается. */
'use strict';
const FONT = '"Segoe Print","Bradley Hand","Chalkboard SE","Comic Sans MS","Marker Felt","Noto Sans",cursive,sans-serif';

/* ---------- эскизные примитивы: добавляют кривые в Path2D с лёгким дрожанием ---------- */
const Sketch = {
  line(p, x1, y1, x2, y2, rnd, amp, seg) {
    seg = seg || 30;
    const len = Math.hypot(x2 - x1, y2 - y1), n = Math.max(1, Math.round(len / seg));
    const nx = len ? -(y2 - y1) / len : 0, ny = len ? (x2 - x1) / len : 0;
    let px = x1 + (rnd() - 0.5) * amp, py = y1 + (rnd() - 0.5) * amp;
    p.moveTo(px, py);
    for (let i = 1; i <= n; i++) {
      const t = i / n, j = (rnd() * 2 - 1) * amp * (i === n ? 0.6 : 1);
      const cx = x1 + (x2 - x1) * t + nx * j, cy = y1 + (y2 - y1) * t + ny * j;
      p.quadraticCurveTo(px + (cx - px) * 0.5 + nx * (rnd() - 0.5) * amp * 0.8, py + (cy - py) * 0.5 + ny * (rnd() - 0.5) * amp * 0.8, cx, cy);
      px = cx; py = cy;
    }
  },
  rect(p, x, y, w, h, rnd, amp) {
    const o = amp * 1.4;
    Sketch.line(p, x - o * rnd(), y, x + w + o * rnd(), y + (rnd() - 0.5) * amp, rnd, amp);
    Sketch.line(p, x + w, y - o * rnd(), x + w + (rnd() - 0.5) * amp, y + h + o * rnd(), rnd, amp);
    Sketch.line(p, x + w + o * rnd(), y + h, x - o * rnd(), y + h + (rnd() - 0.5) * amp, rnd, amp);
    Sketch.line(p, x, y + h + o * rnd(), x + (rnd() - 0.5) * amp, y - o * rnd(), rnd, amp);
  },
  circle(p, cx, cy, r, rnd, amp, turns) {
    turns = turns || 1.06;
    const n = Math.max(10, Math.round(r * 0.9)), a0 = rnd() * 6.28;
    for (let i = 0; i <= n * turns; i++) {
      const a = a0 + (i / n) * 6.2832, rr = r + (rnd() - 0.5) * amp * 1.4 + (i / n) * amp * 0.5;
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      if (i === 0) p.moveTo(x, y); else p.lineTo(x, y);
    }
  },
  /** диагональная штриховка внутри прямоугольника */
  hatch(p, x, y, w, h, gap, rnd, amp) {
    for (let x0 = x - h; x0 < x + w; x0 += gap) {
      let sx = x0, sy = y + h, ex = x0 + h, ey = y;
      if (sx < x) { sy -= x - sx; sx = x; }
      if (ex > x + w) { ey += ex - (x + w); ex = x + w; }
      if (ex - sx < 2) continue;
      Sketch.line(p, sx + (rnd() - 0.5) * 2, sy, ex, ey + (rnd() - 0.5) * 2, rnd, amp * 0.6, 40);
    }
  },
  zigzag(p, x1, y1, x2, y2, n, a, rnd, amp) {
    const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    p.moveTo(x1, y1);
    for (let i = 1; i <= n; i++) {
      const t = i / n, s = i % 2 ? 1 : -1;
      p.lineTo(x1 + dx * t + nx * a * s * (i === n ? 0 : 1) + (rnd() - 0.5) * amp, y1 + dy * t + ny * a * s * (i === n ? 0 : 1) + (rnd() - 0.5) * amp);
    }
  },
  polygon(p, pts, rnd, amp) {
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      Sketch.line(p, a[0], a[1], b[0], b[1], rnd, amp, 26);
    }
  },
  star(p, cx, cy, r, rnd, amp) {
    const pts = [];
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
    Sketch.polygon(p, pts, rnd, amp * 0.6);
  },
};

/* ---------- HandDrawnAnimator ----------
   Хранит время «перерисовки», интенсивность эффекта и кэш вариантов.
   Вариант = набор Path2D со стилями; переключается 2–10 раз в секунду независимо от физики. */
class HandDrawnAnimator {
  constructor(settings) { this.s = settings; this.time = 0; this.cache = new Map(); this.intensity = settings.handFx; }
  update(dt) { this.time += dt; }
  clear() { this.cache.clear(); this.intensity = this.s.handFx; }
  /** номер варианта: fps — частота смены, phase — фаза объекта, n — число вариантов */
  variant(fps, phase, n) {
    if (this.intensity <= 0) return 0;
    return Math.floor(this.time * fps + phase) % n;
  }
  /** амплитуда дрожания (px) с учётом настройки */
  amp(base) { return base * this.intensity; }
  /** кэш: key -> массив вариантов; builder(variantIndex, rnd) -> {fills:[], strokes:[]} */
  get(key, n, builder) {
    let arr = this.cache.get(key);
    if (!arr) {
      arr = [];
      const seed = Util.hash(key);
      for (let i = 0; i < n; i++) arr.push(builder(i, Util.rng(seed + i * 7919), this.amp.bind(this)));
      this.cache.set(key, arr);
      if (this.cache.size > 4000) { const k = this.cache.keys().next().value; this.cache.delete(k); }
    }
    return arr;
  }
  static render(ctx, v, alpha) {
    if (alpha !== undefined && alpha < 1) ctx.globalAlpha = alpha;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const f of v.fills) { ctx.fillStyle = f.c; ctx.fill(f.p); }
    for (const s of v.strokes) { ctx.strokeStyle = s.c; ctx.lineWidth = s.w; if (s.dash) ctx.setLineDash(s.dash); ctx.stroke(s.p); if (s.dash) ctx.setLineDash([]); }
    if (alpha !== undefined && alpha < 1) ctx.globalAlpha = 1;
  }
}

/* ---------- Art: построители рисунков для каждого типа объектов ---------- */
const Art = {
  /** платформа: тип k, размер w×h */
  platform(k, w, h, seed, amp) {
    return (i, rnd, A) => {
      const a = A(1.5), fills = [], strokes = [];
      const body = new Path2D(), top = new Path2D(), ink = new Path2D(), pen = new Path2D(), hat = new Path2D();
      const jx = () => (rnd() - 0.5) * a * 2;
      const q = [[jx(), jx()], [w + jx(), jx()], [w + jx(), h + jx()], [jx(), h + jx()]];
      if (k === 'oneway') {
        // тонкая доска с «ножками»
        Sketch.line(top, 0, 2, w, 2 + jx() * 0.3, rnd, a);
        Sketch.line(ink, 0, h - 1, w, h - 1 + jx() * 0.3, rnd, a * 0.7);
        for (let x = 12; x < w - 6; x += 22) Sketch.line(pen, x, 3, x + jx() * 0.6, h - 1, rnd, a * 0.4, 20);
        strokes.push({ p: pen, c: INK.pencil, w: 1.4 }, { p: ink, c: INK.black, w: 2 }, { p: top, c: INK.black, w: 3.6 });
        fills.push({ p: (() => { const f = new Path2D(); f.rect(0, 2, w, h - 2); return f; })(), c: 'rgba(230,214,170,0.75)' });
        return { fills, strokes };
      }
      const poly = new Path2D(); poly.moveTo(q[0][0], q[0][1]); for (let n = 1; n < 4; n++) poly.lineTo(q[n][0], q[n][1]); poly.closePath();
      let fillC = 'rgba(232,224,203,0.65)', topC = INK.black, hatC = INK.pencil, hatGap = 14;
      if (k === 'ice') { fillC = 'rgba(190,225,245,0.7)'; topC = INK.blue; hatC = 'rgba(70,120,190,0.7)'; }
      if (k === 'crumble') { fillC = 'rgba(224,200,160,0.72)'; hatC = '#8a6a3c'; }
      if (k === 'vanish') { fillC = 'rgba(210,240,215,0.55)'; topC = INK.green; hatC = 'rgba(47,143,78,0.55)'; }
      if (k === 'paper') { fillC = 'rgba(255,255,255,0.95)'; hatC = 'rgba(100,100,110,0.5)'; hatGap = 20; }
      if (k === 'conveyor') { fillC = 'rgba(225,215,190,0.8)'; }
      if (k === 'gate') { fillC = 'rgba(245,205,200,0.7)'; topC = INK.red; hatC = INK.red; hatGap = 10; }
      if (k === 'weight') { fillC = 'rgba(200,200,210,0.85)'; topC = INK.black; hatC = INK.red; hatGap = 9; }
      if (k === 'spring') { fillC = 'rgba(250,225,150,0.9)'; }
      fills.push({ p: poly, c: fillC });
      // штриховка (только верхняя полоса, чтобы большие блоки не перегружались)
      const hh = Math.min(h, k === 'gate' || k === 'weight' ? h : 84);
      if (k === 'paper') {
        // рваный верх + пунктирная линия сгиба
        const tear = new Path2D(); tear.moveTo(0, 6); for (let x = 0; x < w; x += 10) tear.lineTo(x + 5, rnd() * 5 - 2), tear.lineTo(x + 10, 6 + rnd() * 3);
        strokes.push({ p: tear, c: INK.black, w: 2 });
        Sketch.line(pen, 6, h * 0.55, w - 6, h * 0.55 + jx(), rnd, a); strokes.push({ p: pen, c: INK.pencil, w: 1.4, dash: [5, 6] });
      } else {
        Sketch.hatch(hat, 2, 2, w - 4, hh - 4, hatGap, rnd, a); strokes.push({ p: hat, c: hatC, w: k === 'weight' ? 1.8 : 1.2 });
      }
      if (k === 'crumble') { const cr = new Path2D(); for (let c = 0; c < Math.max(1, w / 50); c++) { const cx = 14 + rnd() * (w - 28); Sketch.zigzag(cr, cx, 2, cx + (rnd() - 0.5) * 16, h - 2, 4, 5, rnd, a); } strokes.push({ p: cr, c: INK.black, w: 1.8 }); }
      if (k === 'ice') { const sh = new Path2D(); for (let x = 20; x < w - 20; x += 46) { sh.moveTo(x, 6); sh.lineTo(x + 10, h * 0.4); } strokes.push({ p: sh, c: '#fff', w: 3 }); }
      if (k === 'conveyor') { const ch = new Path2D(); for (let x = 16; x < w - 10; x += 28) { ch.moveTo(x, 6); ch.lineTo(x + 8, h / 2); ch.lineTo(x, h - 6); } strokes.push({ p: ch, c: INK.pencil, w: 2 }); }
      if (k === 'gate') { const br = new Path2D(); for (let y = 6; y < h; y += 26) { br.moveTo(2, y); br.lineTo(w - 2, y); } strokes.push({ p: br, c: INK.red, w: 1.5 }); }
      if (k === 'weight') { const x = new Path2D(); Sketch.line(x, 6, 6, w - 6, h - 6, rnd, a); Sketch.line(x, w - 6, 6, 6, h - 6, rnd, a); strokes.push({ p: x, c: INK.red, w: 2.4 }); }
      // контур
      Sketch.rect(ink, q[0][0], q[0][1], q[2][0] - q[0][0], q[2][1] - q[0][1], rnd, a);
      strokes.push({ p: ink, c: INK.black, w: 2.4 });
      Sketch.line(top, 0, 1, w, 1 + jx() * 0.4, rnd, a * 0.8);
      strokes.push({ p: top, c: topC, w: k === 'vanish' ? 3 : 4, dash: k === 'vanish' ? [14, 5] : null });
      // «дефекты» — клякса и чёрточки
      if (rnd() < 0.5 && w > 60) { const d = new Path2D(); const dx = 10 + rnd() * (w - 20); d.moveTo(dx, 8); d.lineTo(dx + 3, 12); d.moveTo(dx + 8, 9); d.lineTo(dx + 9, 14); strokes.push({ p: d, c: INK.black, w: 1.4 }); }
      return { fills, strokes };
    };
  },
  spike(n, tw, th, seed) {
    // шипы направлены ВВЕРХ в локальных координатах (0..n*tw, 0..th), основание на y=th
    return (i, rnd, A) => {
      const a = A(1.1), fills = [], strokes = [], ink = new Path2D(), red = new Path2D(), fl = new Path2D();
      for (let k = 0; k < n; k++) {
        const x = k * tw, tip = [x + tw / 2 + (rnd() - 0.5) * a * 2, (rnd() - 0.5) * a * 2.4];
        Sketch.polygon(ink, [[x + 1, th], tip, [x + tw - 1, th]], rnd, a);
        fl.moveTo(x + 1, th); fl.lineTo(tip[0], tip[1]); fl.lineTo(x + tw - 1, th); fl.closePath();
        Sketch.line(red, tip[0], tip[1] + 2, tip[0] + (rnd() - 0.5) * 3, tip[1] + th * 0.45, rnd, a * 0.4);
      }
      Sketch.line(ink, -2, th + 1, n * tw + 2, th + 1 + (rnd() - 0.5), rnd, a);
      fills.push({ p: fl, c: 'rgba(255,255,255,0.9)' });
      strokes.push({ p: red, c: INK.red, w: 3 }, { p: ink, c: INK.black, w: 2.4 });
      return { fills, strokes };
    };
  },
  saw(r, seed, teeth) {
    return (i, rnd, A) => {
      const a = A(1.3), ink = new Path2D(), red = new Path2D(), pen = new Path2D(), fl = new Path2D();
      const n = teeth || 12, pts = [];
      for (let k = 0; k < n * 2; k++) { const ang = (k / (n * 2)) * 6.2832, rr = k % 2 ? r * 0.8 : r * (1 + (rnd() - 0.5) * 0.04); pts.push([Math.cos(ang) * rr + (rnd() - 0.5) * a, Math.sin(ang) * rr + (rnd() - 0.5) * a]); }
      fl.moveTo(pts[0][0], pts[0][1]); for (const p of pts) fl.lineTo(p[0], p[1]); fl.closePath();
      Sketch.polygon(ink, pts, rnd, a * 0.5);
      Sketch.circle(pen, 0, 0, r * 0.22, rnd, a * 0.6);
      for (let k = 0; k < 3; k++) { const ang = k * 2.0944 + 0.4; Sketch.line(pen, Math.cos(ang) * r * 0.25, Math.sin(ang) * r * 0.25, Math.cos(ang) * r * 0.72, Math.sin(ang) * r * 0.72, rnd, a * 0.6, 40); }
      Sketch.circle(red, 0, 0, r * 0.6, rnd, a, 0.9);
      return { fills: [{ p: fl, c: 'rgba(235,235,240,0.92)' }], strokes: [{ p: red, c: INK.red, w: 2.2 }, { p: pen, c: INK.black, w: 2 }, { p: ink, c: INK.black, w: 3 }] };
    };
  },
  coin(kind, r, seed) {
    return (i, rnd, A) => {
      const a = A(1), ink = new Path2D(), mk = new Path2D(), fl = new Path2D(), fills = [], strokes = [];
      if (kind === 'secret') {
        Sketch.star(ink, 0, 0, r, rnd, a); fl.arc(0, 0, r * 0.75, 0, 6.3);
        Sketch.circle(mk, 0, 0, r * 0.35, rnd, a);
        const dot = new Path2D(); Sketch.circle(dot, 0, 0, r * 1.25, rnd, a * 1.5); strokes.push({ p: dot, c: INK.blue, w: 1.4, dash: [3, 5] });
        fills.push({ p: fl, c: 'rgba(170,150,255,0.8)' }); strokes.push({ p: mk, c: INK.blue, w: 2 }, { p: ink, c: INK.black, w: 2.4 });
      } else {
        Sketch.circle(ink, 0, 0, r, rnd, a); fl.arc(0, 0, r, 0, 6.3);
        // значок «монетка» — вертикальная чёрточка и маленькая дуга
        Sketch.line(mk, 0, -r * 0.5, 0 + (rnd() - 0.5), r * 0.5, rnd, a * 0.5);
        mk.moveTo(-r * 0.32, -r * 0.2); mk.quadraticCurveTo(0, -r * 0.7, r * 0.32, -r * 0.2);
        mk.moveTo(-r * 0.32, r * 0.2); mk.quadraticCurveTo(0, r * 0.7, r * 0.32, r * 0.2);
        if (kind === 'big') { const in2 = new Path2D(); Sketch.circle(in2, 0, 0, r * 0.78, rnd, a); strokes.push({ p: in2, c: INK.black, w: 1.6 }); }
        fills.push({ p: fl, c: kind === 'big' ? 'rgba(255,196,60,0.95)' : 'rgba(255,224,90,0.95)' });
        strokes.push({ p: mk, c: INK.black, w: 1.8 }, { p: ink, c: INK.black, w: kind === 'big' ? 3 : 2.4 });
      }
      return { fills, strokes };
    };
  },
  flag(active, seed) {
    return (i, rnd, A) => {
      const a = A(1.2), ink = new Path2D(), cl = new Path2D(), fl = new Path2D();
      Sketch.line(ink, 0, 0, 0, -78, rnd, a);
      const tip = [0, -78];
      const pts = [[1, -76], [34 + (rnd() - 0.5) * 3, -62 + (rnd() - 0.5) * 3], [1, -46]];
      Sketch.polygon(cl, pts, rnd, a * 0.6); fl.moveTo(pts[0][0], pts[0][1]); fl.lineTo(pts[1][0], pts[1][1]); fl.lineTo(pts[2][0], pts[2][1]); fl.closePath();
      Sketch.line(ink, -14, 0, 14, 0, rnd, a); Sketch.circle(ink, 0, -80, 3, rnd, 0.5);
      const chk = new Path2D(); if (active) { chk.moveTo(8, -62); chk.lineTo(14, -56); chk.lineTo(24, -68); }
      return { fills: [{ p: fl, c: active ? 'rgba(80,200,110,0.9)' : 'rgba(255,255,255,0.8)' }], strokes: [{ p: ink, c: INK.black, w: 3 }, { p: cl, c: INK.black, w: 2.4 }, { p: chk, c: INK.black, w: 2.6 }] };
    };
  },
  rope(h, seed) {
    return (i, rnd, A) => {
      const a = A(1.4), p = new Path2D(), kn = new Path2D();
      p.moveTo(0, 0);
      for (let y = 0; y < h; y += 14) p.quadraticCurveTo((rnd() - 0.5) * a * 3, y + 7, (rnd() - 0.5) * a * 1.2, Math.min(h, y + 14));
      for (let y = 20; y < h; y += 34) { kn.moveTo(-5, y); kn.lineTo(5, y + 4); }
      return { fills: [], strokes: [{ p, c: '#7a5a2e', w: 4 }, { p: kn, c: INK.black, w: 2 }] };
    };
  },
  crate(s, seed) {
    return (i, rnd, A) => {
      const a = A(1.3), ink = new Path2D(), x = new Path2D(), fl = new Path2D(); fl.rect(0, 0, s, s);
      Sketch.rect(ink, 0, 0, s, s, rnd, a); Sketch.rect(ink, 6, 6, s - 12, s - 12, rnd, a * 0.8);
      Sketch.line(x, 6, 6, s - 6, s - 6, rnd, a); Sketch.line(x, s - 6, 6, 6, s - 6, rnd, a);
      return { fills: [{ p: fl, c: 'rgba(235,205,150,0.95)' }], strokes: [{ p: x, c: '#8a6a3c', w: 2 }, { p: ink, c: INK.black, w: 2.6 }] };
    };
  },
  block(s, seed) { // шипастый блок (по всем сторонам)
    return (i, rnd, A) => {
      const a = A(1.2), ink = new Path2D(), fl = new Path2D(), x = new Path2D();
      const half = s / 2, n = Math.max(2, Math.round(s / 16)), t = 12;
      const pts = [];
      for (let side = 0; side < 4; side++) for (let k = 0; k < n; k++) {
        const u = -half + (k + 0.5) * (s / n), w2 = s / n / 2;
        const base = [[u - w2, -half], [u, -half - t], [u + w2, -half]];
        for (const b of base) { const [bx, by] = b; pts.push(side === 0 ? [bx, by] : side === 1 ? [-by, bx] : side === 2 ? [-bx, -by] : [by, -bx]); }
      }
      fl.moveTo(pts[0][0], pts[0][1]); for (const p of pts) fl.lineTo(p[0], p[1]); fl.closePath();
      Sketch.polygon(ink, pts, rnd, a * 0.4);
      Sketch.line(x, -half + 6, -half + 6, half - 6, half - 6, rnd, a); Sketch.line(x, half - 6, -half + 6, -half + 6, half - 6, rnd, a);
      return { fills: [{ p: fl, c: 'rgba(235,235,240,0.95)' }], strokes: [{ p: x, c: INK.red, w: 2.4 }, { p: ink, c: INK.black, w: 2.6 }] };
    };
  },
  spinner(L, th, seed) {
    return (i, rnd, A) => {
      const a = A(1.1), ink = new Path2D(), fl = new Path2D(), red = new Path2D();
      fl.rect(-L, -th / 2, L * 2, th);
      Sketch.rect(ink, -L, -th / 2, L * 2, th, rnd, a); Sketch.circle(ink, 0, 0, th * 0.9, rnd, a);
      Sketch.hatch(red, -L, -th / 2, L * 2, th, 10, rnd, a);
      for (const s of [-1, 1]) Sketch.polygon(ink, [[s * L, -th / 2], [s * (L + 14), 0], [s * L, th / 2]], rnd, a * 0.5);
      return { fills: [{ p: fl, c: 'rgba(235,235,240,0.95)' }], strokes: [{ p: red, c: INK.red, w: 1.6 }, { p: ink, c: INK.black, w: 2.6 }] };
    };
  },
  scribbleBox(w, h, col, seed) { // универсальная «коробка» (стрелялки, плиты)
    return (i, rnd, A) => {
      const a = A(1.2), ink = new Path2D(), hat = new Path2D(), fl = new Path2D(); fl.rect(0, 0, w, h);
      Sketch.rect(ink, 0, 0, w, h, rnd, a); Sketch.hatch(hat, 1, 1, w - 2, h - 2, 9, rnd, a);
      return { fills: [{ p: fl, c: 'rgba(240,236,224,0.95)' }], strokes: [{ p: hat, c: col, w: 1.6 }, { p: ink, c: INK.black, w: 2.6 }] };
    };
  },
  deco(kind, size, seed) {
    return (i, rnd, A) => {
      const a = A(1.5), p = new Path2D(), q = new Path2D(), s = size, fills = [];
      switch (kind) {
        case 'star': Sketch.star(p, 0, 0, s, rnd, a); break;
        case 'cloud': for (let k = 0; k < 4; k++) { p.moveTo(-s + k * s * 0.5 + s * 0.3, 0); p.arc(-s * 0.5 + k * s * 0.4, -s * 0.15 * (k % 2 ? 1 : 0.4), s * 0.35 + (k % 2) * 4, Math.PI, 0); } Sketch.line(p, -s * 0.9, 2, s * 0.9, 2, rnd, a); break;
        case 'sun': Sketch.circle(p, 0, 0, s * 0.5, rnd, a); for (let k = 0; k < 10; k++) { const an = k * 0.6283 + (rnd() - 0.5) * 0.1; Sketch.line(q, Math.cos(an) * s * 0.65, Math.sin(an) * s * 0.65, Math.cos(an) * s * 0.95, Math.sin(an) * s * 0.95, rnd, a * 0.5); } break;
        case 'tree': Sketch.line(p, 0, 0, 0, -s * 0.8, rnd, a); Sketch.circle(q, 0, -s * 1.1, s * 0.5, rnd, a); Sketch.circle(q, -s * 0.2, -s * 0.9, s * 0.3, rnd, a); break;
        case 'arrow': p.moveTo(-s, 0); p.quadraticCurveTo(0, -s * 0.5 + (rnd() - 0.5) * 4, s, 0); Sketch.line(q, s, 0, s - 14, -12, rnd, a * 0.4); Sketch.line(q, s, 0, s - 16, 10, rnd, a * 0.4); break;
        case 'spiral': for (let t = 0; t < 22; t += 0.4) { const r = t * s / 22; const x = Math.cos(t) * r, y = Math.sin(t) * r; if (t === 0) p.moveTo(x, y); else p.lineTo(x + (rnd() - 0.5) * a, y + (rnd() - 0.5) * a); } break;
        case 'x': Sketch.line(p, -s * 0.5, -s * 0.5, s * 0.5, s * 0.5, rnd, a); Sketch.line(p, s * 0.5, -s * 0.5, -s * 0.5, s * 0.5, rnd, a); break;
        case 'skull': Sketch.circle(p, 0, 0, s * 0.5, rnd, a); Sketch.circle(q, -s * 0.18, -s * 0.05, s * 0.1, rnd, a * 0.5); Sketch.circle(q, s * 0.18, -s * 0.05, s * 0.1, rnd, a * 0.5); Sketch.line(q, -s * 0.2, s * 0.3, s * 0.2, s * 0.3, rnd, a * 0.5); break;
        default: for (let k = 0; k < 6; k++) Sketch.line(p, -s + rnd() * 6, -s * 0.4 + k * s * 0.16, s - rnd() * 6, -s * 0.4 + k * s * 0.16 + (rnd() - 0.5) * 6, rnd, a * 0.8); // каракуля
      }
      return { fills, strokes: [{ p, c: INK.pencil, w: 1.8 }, { p: q, c: INK.pencil, w: 1.8 }] };
    };
  },
};

/* ---------- Paper: процедурная бумага (рисуется один раз) ---------- */
const Paper = {
  tile: null, doodle: null, ruled: null,
  /** бесшовная текстура: элементы дублируются у краёв */
  makeTile(size) {
    const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
    const rnd = Util.rng(1337);
    x.fillStyle = INK.paper; x.fillRect(0, 0, size, size);
    const wrap = (fn, px, py, r) => { for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) { const X = px + ox * size, Y = py + oy * size; if (X > -r && X < size + r && Y > -r && Y < size + r) fn(X, Y); } };
    for (let i = 0; i < 26; i++) { // неоднородность оттенка
      const px = rnd() * size, py = rnd() * size, r = 60 + rnd() * 120, light = rnd() < 0.5;
      wrap((X, Y) => { const g = x.createRadialGradient(X, Y, 0, X, Y, r); g.addColorStop(0, light ? 'rgba(255,255,250,0.35)' : 'rgba(200,185,150,0.16)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(X - r, Y - r, r * 2, r * 2); }, px, py, r);
    }
    x.lineWidth = 1;
    for (let i = 0; i < 520; i++) { // волокна
      const px = rnd() * size, py = rnd() * size, a = rnd() * 6.28, l = 5 + rnd() * 14;
      x.strokeStyle = rnd() < 0.5 ? 'rgba(150,130,100,0.10)' : 'rgba(255,255,255,0.35)';
      wrap((X, Y) => { x.beginPath(); x.moveTo(X, Y); x.quadraticCurveTo(X + Math.cos(a + 0.6) * l * 0.5, Y + Math.sin(a + 0.6) * l * 0.5, X + Math.cos(a) * l, Y + Math.sin(a) * l); x.stroke(); }, px, py, 20);
    }
    for (let i = 0; i < 160; i++) { const px = rnd() * size, py = rnd() * size; x.fillStyle = `rgba(110,95,70,${0.05 + rnd() * 0.07})`; wrap((X, Y) => x.fillRect(X, Y, 1 + rnd(), 1 + rnd()), px, py, 3); }
    for (let i = 0; i < 5; i++) { // следы карандаша
      const px = rnd() * size, py = rnd() * size, a = rnd() * 6.28, l = 30 + rnd() * 50; x.strokeStyle = 'rgba(90,90,100,0.06)'; x.lineWidth = 2;
      wrap((X, Y) => { x.beginPath(); x.moveTo(X, Y); x.lineTo(X + Math.cos(a) * l, Y + Math.sin(a) * l); x.stroke(); }, px, py, l);
    }
    this.tile = c; return c;
  },
  /** слабые декоративные каракули для параллакс-слоя (тайл 1024) */
  makeDoodles() {
    const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), rnd = Util.rng(77);
    const kinds = ['star', 'cloud', 'spiral', 'arrow', 'x', 'sun', 'tree', 'scribble'];
    x.lineCap = 'round';
    for (let i = 0; i < 16; i++) {
      const k = kinds[i % kinds.length], px = rnd() * S, py = rnd() * S, size = 24 + rnd() * 36;
      const v = Art.deco(k, size, i)(0, Util.rng(i + 50), b => b * 1);
      x.save(); x.translate(px, py); x.rotate((rnd() - 0.5) * 0.6); x.globalAlpha = 0.17; HandDrawnAnimator.render(x, v); x.restore();
    }
    this.doodle = c; return c;
  },
  makeRuled() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 56; const x = c.getContext('2d');
    x.strokeStyle = 'rgba(120,160,215,0.20)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(0, 55.5); x.lineTo(64, 55.5); x.stroke();
    this.ruled = c; return c;
  },
};
