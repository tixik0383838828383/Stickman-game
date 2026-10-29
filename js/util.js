/* util.js — мелкие вспомогательные функции */
'use strict';
const Util = {
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  sign: v => (v > 0 ? 1 : v < 0 ? -1 : 0),
  /** плавное приближение v к target не более чем на delta */
  approach(v, target, delta) {
    if (v < target) return Math.min(v + delta, target);
    return Math.max(v - delta, target);
  },
  /** детерминированный ГСЧ (mulberry32) — рисунки не меняются между запусками */
  rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
  hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  },
  overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; },
  fmtTime(t) {
    const m = Math.floor(t / 60), s = t - m * 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
  },
  /** расстояние от точки до отрезка */
  distPointSeg(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = x1 + t * dx, cy = y1 + t * dy;
    return Math.hypot(px - cx, py - cy);
  },
  /** пересекается ли отрезок с прямоугольником (метод slab) */
  segRect(x1, y1, x2, y2, r) {
    let t0 = 0, t1 = 1; const dx = x2 - x1, dy = y2 - y1;
    const p = [-dx, dx, -dy, dy], q = [x1 - r.x, r.x + r.w - x1, y1 - r.y, r.y + r.h - y1];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return false; }
      else { const t = q[i] / p[i]; if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; } }
    }
    return true;
  },
  /** окружность vs прямоугольник */
  circleRect(cx, cy, r, b) {
    const nx = Util.clamp(cx, b.x, b.x + b.w), ny = Util.clamp(cy, b.y, b.y + b.h);
    const dx = cx - nx, dy = cy - ny; return dx * dx + dy * dy < r * r;
  },
  /** треугольник (3 точки) vs прямоугольник — SAT */
  triRect(t, b) {
    const pts = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]];
    // оси: x, y
    const minx = Math.min(t[0][0], t[1][0], t[2][0]), maxx = Math.max(t[0][0], t[1][0], t[2][0]);
    const miny = Math.min(t[0][1], t[1][1], t[2][1]), maxy = Math.max(t[0][1], t[1][1], t[2][1]);
    if (maxx < b.x || minx > b.x + b.w || maxy < b.y || miny > b.y + b.h) return false;
    for (let i = 0; i < 3; i++) {
      const a = t[i], c = t[(i + 1) % 3];
      const nx = -(c[1] - a[1]), ny = c[0] - a[0];
      let tmin = Infinity, tmax = -Infinity, bmin = Infinity, bmax = -Infinity;
      for (const p of t) { const d = p[0] * nx + p[1] * ny; if (d < tmin) tmin = d; if (d > tmax) tmax = d; }
      for (const p of pts) { const d = p[0] * nx + p[1] * ny; if (d < bmin) bmin = d; if (d > bmax) bmax = d; }
      if (tmax < bmin || bmax < tmin) return false;
    }
    return true;
  },
};
if (typeof module !== 'undefined') module.exports = Util;
