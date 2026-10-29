/* validator.js — проверка корректности уровня для редактора (эвристика, не доказательство проходимости) */
'use strict';
const LevelValidator = {
  analyze(level) {
    const errors = [], warnings = [], obj = level.obj || [];
    const solids = obj.filter(o => o.t === 'plat' && o.k !== 'oneway').map(o => ({ x: o.x, y: o.y, w: o.w, h: o.h }));
    const fins = obj.filter(o => o.t === 'fin');
    if (!level.start) errors.push('Нет стартовой точки.');
    if (fins.length === 0) errors.push('Нет финиша.'); else if (fins.length > 1) warnings.push('Финишей несколько — сработает любой.');
    const inside = (x, y, w, h) => solids.some(s => Util.overlap(s, { x, y, w, h }));
    if (level.start && inside(level.start.x - 13, level.start.y - 66, 26, 64)) errors.push('Старт находится внутри платформы.');
    for (const f of fins) if (inside(f.x - 26, f.y - 90, 52, 86)) errors.push('Финиш находится внутри платформы.');
    obj.forEach((o, i) => {
      if (o.t === 'coin' && inside(o.x - 10, o.y - 10, 20, 20)) warnings.push('Монета #' + i + ' внутри платформы.');
      if (o.t === 'plate') for (const id of (o.tg || [])) if (!obj.some(q => q.id === id)) warnings.push('Плита #' + i + ': нет объекта с id "' + id + '".');
      if (o.x < -50 || o.x > level.w + 50 || o.y < -800 || o.y > level.h + 400) warnings.push('Объект #' + i + ' (' + o.t + ') за границами уровня.');
    });
    if (level.start && fins.length) {
      const r = LevelValidator.reach(level);
      if (!r.finish) warnings.push('Финиш, возможно, недостижим (эвристика; прыжки от стен и ящики она не учитывает). Проверьте ботом 🤖.');
      for (const c of obj.filter(o => o.t === 'coin' && o.v === 's')) if (!r.near(c.x, c.y)) warnings.push('Секретная монета (' + Math.round(c.x) + ',' + Math.round(c.y) + ') выглядит недостижимой.');
    }
    return { errors, warnings, ok: errors.length === 0 };
  },
  /** грубый граф поверхностей и прыжков */
  reach(level) {
    const S = [];
    const addPlat = (o, x, y) => S.push({ x1: x, x2: x + o.w, y, spring: o.k === 'spring' });
    for (const o of level.obj) {
      if (o.t !== 'plat') continue;
      if (o.m && o.m.mode !== 'trig') { for (const f of [0, 0.5, 1]) addPlat(o, o.x + o.m.mx * f, o.y + o.m.my * f); }
      else if (o.m) { addPlat(o, o.x, o.y); addPlat(o, o.x + o.m.mx, o.y + o.m.my); }
      else addPlat(o, o.x, o.y);
    }
    const ropes = level.obj.filter(o => o.t === 'rope');
    const can = (A, B) => {
      const gap = Math.max(0, B.x1 - A.x2, A.x1 - B.x2), rise = A.y - B.y;
      if (A.spring && rise <= 250 && gap <= 170) return true;
      if (rise > 108) { return false; }
      const maxGap = rise >= 0 ? 205 - rise * 0.95 : 205 + Math.min(80, Math.sqrt(-rise) * 7);
      return gap <= maxGap;
    };
    const start = level.start; let cur = S.filter(s => start.x >= s.x1 - 14 && start.x <= s.x2 + 14 && Math.abs(s.y - start.y) < 6);
    const seen = new Set(cur), q = cur.slice();
    while (q.length) {
      const A = q.pop();
      for (const B of S) if (!seen.has(B) && can(A, B)) { seen.add(B); q.push(B); }
      for (const r of ropes) { // верёвка: от поверхности рядом до любой поверхности у её верха
        if (A.x1 - 90 < r.x && A.x2 + 90 > r.x && A.y >= r.y - 10 && A.y <= r.y + r.h + 10) for (const B of S) if (!seen.has(B) && B.x1 - 40 < r.x && B.x2 + 40 > r.x && B.y >= r.y - 20 && B.y <= r.y + r.h + 20) { seen.add(B); q.push(B); }
      }
    }
    const near = (x, y) => { for (const s of seen) if (x > s.x1 - 160 && x < s.x2 + 160 && y < s.y + 40 && y > s.y - 330) return true; return false; };
    const fin = level.obj.find(o => o.t === 'fin');
    return { finish: near(fin.x, fin.y - 10) && [...seen].some(s => fin.x > s.x1 - 40 && fin.x < s.x2 + 40 && Math.abs(s.y - fin.y) < 30), near };
  },
};
