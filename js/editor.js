/* editor.js — LevelEditor: размещение/перемещение/удаление/изменение объектов, траектории,
   тест, проверка, бот-проверка, экспорт/импорт JSON, копии, сохранение. Мышь и сенсорный ввод. */
'use strict';
const PLAT_KINDS = ['solid', 'ice', 'oneway', 'crumble', 'vanish', 'paper', 'spring', 'conveyor', 'gate', 'weight'];
const DECO_KINDS = ['scribble', 'star', 'cloud', 'sun', 'tree', 'arrow', 'spiral', 'x', 'skull'];
/* палитра: id, группа, подпись, фабрика объекта */
const EDITOR_TOOLS = [
  { id: 'select', g: 'Инструменты', l: '↖ Выбор' }, { id: 'hand', l: '✋ Рука' }, { id: 'erase', l: '🗑 Ластик' },
  { id: 'start', g: 'Точки', l: '🏁 Старт' }, { id: 'fin', l: '🚪 Финиш', make: (x, y) => ({ t: 'fin', x, y }) }, { id: 'cp', l: '⚑ Чекпоинт', make: (x, y) => ({ t: 'cp', x, y }) },
  { id: 'p_solid', g: 'Платформы', l: '▭ Обычная', make: (x, y) => ({ t: 'plat', x, y, w: 200, h: 24, k: 'solid' }) },
  { id: 'p_ground', l: '▬ Земля', make: (x, y) => ({ t: 'plat', x, y, w: 400, h: 260, k: 'solid' }) },
  { id: 'p_ice', l: '❄ Лёд', make: (x, y) => ({ t: 'plat', x, y, w: 240, h: 24, k: 'ice' }) },
  { id: 'p_oneway', l: '▔ Тонкая', make: (x, y) => ({ t: 'plat', x, y, w: 160, h: 16, k: 'oneway' }) },
  { id: 'p_crumble', l: '▒ Падающая', make: (x, y) => ({ t: 'plat', x, y, w: 110, h: 24, k: 'crumble' }) },
  { id: 'p_vanish', l: '◌ Исчезающая', make: (x, y) => ({ t: 'plat', x, y, w: 120, h: 24, k: 'vanish' }) },
  { id: 'p_paper', l: '▤ Бумажная', make: (x, y) => ({ t: 'plat', x, y, w: 130, h: 24, k: 'paper' }) },
  { id: 'p_spring', l: '⌇ Пружина', make: (x, y) => ({ t: 'plat', x, y, w: 44, h: 16, k: 'spring' }) },
  { id: 'p_conv', l: '⇨ Лента', make: (x, y) => ({ t: 'plat', x, y, w: 300, h: 24, k: 'conveyor', dir: 1 }) },
  { id: 'p_move', l: '↔ Движущаяся', make: (x, y) => ({ t: 'plat', x, y, w: 110, h: 24, k: 'solid', m: { mx: 300, my: 0, sp: 90, mode: 'pp' } }) },
  { id: 'p_lift', l: '↕ Лифт', make: (x, y) => ({ t: 'plat', x, y, w: 100, h: 24, k: 'solid', m: { mx: 0, my: -220, sp: 70, mode: 'pp' } }) },
  { id: 'p_swing', l: '⌒ Подвесная', make: (x, y) => ({ t: 'plat', x, y, w: 160, h: 20, k: 'solid', m: { mx: 120, my: 40, sp: 4, mode: 'swing', len: 220 } }) },
  { id: 'p_gate', l: '▮ Ворота', make: (x, y, ed) => ({ t: 'plat', x, y, w: 50, h: 260, k: 'gate', id: ed.newId('g') }) },
  { id: 'p_weight', l: '▣ Груз', make: (x, y, ed) => ({ t: 'plat', x, y, w: 120, h: 80, k: 'weight', id: ed.newId('w') }) },
  { id: 'ceil', l: '▭ Потолок', make: (x, y) => ({ t: 'plat', x, y, w: 300, h: 200, k: 'solid' }) },
  { id: 'spike', g: 'Опасности', l: '▲ Шипы', make: (x, y) => ({ t: 'spike', x, y, n: 3, dir: 'u' }) },
  { id: 'spike_h', l: '▲ Шипы (скрытые)', make: (x, y, ed) => ({ t: 'spike', x, y, n: 4, dir: 'u', hid: true, id: ed.newId('s') }) },
  { id: 'saw', l: '✹ Пила', make: (x, y) => ({ t: 'saw', x, y, r: 36, p: { ty: 'static' } }) },
  { id: 'saw_h', l: '✹ Пила ↔', make: (x, y) => ({ t: 'saw', x, y, r: 36, p: { ty: 'h', rg: 150, sp: 140 } }) },
  { id: 'saw_v', l: '✹ Пила ↕', make: (x, y) => ({ t: 'saw', x, y, r: 36, p: { ty: 'v', rg: 100, sp: 140 } }) },
  { id: 'saw_p', l: '✹ Маятник', make: (x, y) => ({ t: 'saw', x, y, r: 34, p: { ty: 'pend', rg: 220, ang: 50, sp: 3.6 } }) },
  { id: 'saw_c', l: '✹ По кругу', make: (x, y) => ({ t: 'saw', x, y, r: 30, p: { ty: 'circ', rg: 100, sp: 1.5 } }) },
  { id: 'saw_t', l: '✹ Засада', make: (x, y, ed) => ({ t: 'saw', x, y, r: 36, id: ed.newId('z'), p: { ty: 'trig', mx: -400, my: 0, sp: 520, tr: 260 } }) },
  { id: 'sblock', l: '✱ Шипастый блок', make: (x, y) => ({ t: 'sblock', x, y, s: 64, m: { mx: 0, my: -170, sp: 140 } }) },
  { id: 'spinner', l: '✢ Вертушка', make: (x, y) => ({ t: 'spinner', x, y, L: 110, sp: 1.5 }) },
  { id: 'dart', l: '➤ Дротики', make: (x, y, ed) => ({ t: 'dart', x, y, dir: 'l', per: 2.2, off: 0, id: ed.newId('d') }) },
  { id: 'laser', l: '⎮ Лазер', make: (x, y) => ({ t: 'laser', x, y, len: 280, o: 'v', on: 1.4, off: 1.6, ph: 0 }) },
  { id: 'plate', l: '▂ Нажимная плита', make: (x, y) => ({ t: 'plate', x, y, w: 64, tg: [], hold: true }) },
  { id: 'coin', g: 'Предметы', l: '● Монета', make: (x, y) => ({ t: 'coin', x, y, v: 1 }) },
  { id: 'coin5', l: '◉ Большая (5)', make: (x, y) => ({ t: 'coin', x, y, v: 5 }) },
  { id: 'coins', l: '✦ Секретная', make: (x, y) => ({ t: 'coin', x, y, v: 's' }) },
  { id: 'rope', l: '〰 Верёвка', make: (x, y) => ({ t: 'rope', x, y, h: 240 }) },
  { id: 'crate', l: '▢ Ящик', make: (x, y) => ({ t: 'crate', x, y, s: 46 }) },
  { id: 'secret', l: '▨ Секретная зона', make: (x, y) => ({ t: 'secret', x, y, w: 300, h: 180 }) },
  { id: 'txt', l: 'T Надпись', make: (x, y) => ({ t: 'txt', x, y, s: 'Привет!', sz: 26 }) },
  { id: 'deco', l: '☁ Рисунок', make: (x, y) => ({ t: 'deco', x, y, k: 'star', sz: 40 }) },
];
/* свойства объектов для панели (ключи — пути вида "p.rg") */
const EDITOR_PROPS = {
  plat: [['k', 'тип', 'sel', PLAT_KINDS], ['w', 'ширина', 'num', 10], ['h', 'высота', 'num', 10], ['id', 'id', 'txt'], ['grp', 'группа', 'txt'], ['dir', 'лента ±1', 'num', 2], ['tr', 'груз: plate', 'sel', ['', 'plate']]],
  spike: [['n', 'зубцов', 'num', 1], ['dir', 'направл.', 'sel', ['u', 'd', 'l', 'r']], ['hid', 'скрытые', 'bool'], ['id', 'id', 'txt']],
  saw: [['r', 'радиус', 'num', 2], ['p.ty', 'траектория', 'sel', ['static', 'h', 'v', 'pend', 'circ', 'trig']], ['p.rg', 'размах', 'num', 10], ['p.sp', 'скорость', 'num', 10], ['p.ph', 'фаза', 'num', 0.1], ['p.ang', 'угол°', 'num', 5], ['p.mx', 'сдвиг X', 'num', 10], ['p.my', 'сдвиг Y', 'num', 10], ['p.tr', 'радиус сраб.', 'num', 20], ['id', 'id', 'txt']],
  sblock: [['s', 'размер', 'num', 8], ['m.mx', 'сдвиг X', 'num', 10], ['m.my', 'сдвиг Y', 'num', 10], ['m.sp', 'скорость', 'num', 10], ['m.ph', 'фаза', 'num', 0.1]],
  spinner: [['L', 'длина', 'num', 10], ['sp', 'скорость', 'num', 0.1], ['a0', 'угол0', 'num', 0.1]],
  dart: [['dir', 'направл.', 'sel', ['l', 'r', 'u', 'd']], ['per', 'период', 'num', 0.1], ['off', 'сдвиг', 'num', 0.1], ['sp', 'скорость', 'num', 20], ['tr', 'режим', 'sel', ['', 'plate']], ['nb', 'залп', 'num', 1], ['id', 'id', 'txt']],
  laser: [['o', 'ориент.', 'sel', ['h', 'v']], ['len', 'длина', 'num', 10], ['on', 'вкл, с', 'num', 0.1], ['off', 'выкл, с', 'num', 0.1], ['ph', 'фаза', 'num', 0.1]],
  plate: [['w', 'ширина', 'num', 8], ['tg', 'цели (id)', 'list'], ['hold', 'держать', 'bool'], ['once', 'один раз', 'bool'], ['id', 'id', 'txt']],
  coin: [['v', 'ценность', 'sel', [1, 5, 's']]], crate: [['s', 'размер', 'num', 2]], rope: [['h', 'длина', 'num', 10]], secret: [['w', 'ширина', 'num', 10], ['h', 'высота', 'num', 10]],
  txt: [['s', 'текст', 'txt'], ['sz', 'размер', 'num', 2], ['rot', 'поворот', 'num', 0.05]], deco: [['k', 'вид', 'sel', DECO_KINDS], ['sz', 'размер', 'num', 4], ['rot', 'поворот', 'num', 0.1]],
  cp: [], fin: [],
};
const KNOWN_TYPES = ['plat', 'spike', 'saw', 'sblock', 'spinner', 'dart', 'laser', 'plate', 'coin', 'cp', 'fin', 'rope', 'crate', 'secret', 'deco', 'txt'];

class LevelEditor {
  constructor(game) {
    this.g = game; this.$ = id => document.getElementById(id);
    this.level = null; this.customIndex = -1; this.tool = 'select'; this.sel = null; this.cam = { x: 600, y: 450, z: 0.7 };
    this.grid = 20; this.showGrid = true; this.undoStack = []; this.redoStack = []; this.dirty = true; this.world = null; this.t = 0;
    this.pointers = new Map(); this.drag = null; this.cursor = null; this.space = false; this.msgT = 0; this.bot = null; this.W = 800; this.H = 600;
    this._buildTools(); this._bind();
  }
  /* ---------- уровень ---------- */
  static blank() { return { name: 'Новый уровень', world: 0, hint: '', w: 3200, h: 900, start: { x: 120, y: 700 }, obj: [{ t: 'plat', x: 0, y: 700, w: 3200, h: 260, k: 'solid' }, { t: 'fin', x: 3000, y: 700 }] }; }
  static sanitize(raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.obj)) throw new Error('Неверный формат: нужен объект с массивом "obj".');
    const num = (v, d) => (Number.isFinite(+v) ? +v : d), cl = (v, a, b) => Math.min(b, Math.max(a, v));
    const L = { name: String(raw.name || 'Без названия').slice(0, 40), world: 0, hint: String(raw.hint || '').slice(0, 200), w: cl(num(raw.w, 3200), 800, 20000), h: cl(num(raw.h, 900), 600, 6000),
      start: { x: num(raw.start && raw.start.x, 120), y: num(raw.start && raw.start.y, 700) }, obj: [] };
    if (Array.isArray(raw.route)) L.route = raw.route.filter(r => Array.isArray(r) && r.length >= 2).map(r => [num(r[0], 0), num(r[1], 0)]).slice(0, 100);
    const clean = (v, depth) => {
      if (typeof v === 'number') return Number.isFinite(v) ? cl(v, -1e5, 1e5) : 0;
      if (typeof v === 'string') return v.slice(0, 200);
      if (typeof v === 'boolean') return v;
      if (Array.isArray(v)) return v.slice(0, 50).map(x => clean(x, depth + 1));
      if (v && typeof v === 'object' && depth < 3) { const o = {}; for (const k of Object.keys(v).slice(0, 30)) o[k] = clean(v[k], depth + 1); return o; }
      return undefined;
    };
    for (const o of raw.obj.slice(0, 3000)) {
      if (!o || !KNOWN_TYPES.includes(o.t) || !Number.isFinite(+o.x) || !Number.isFinite(+o.y)) continue;
      if ((o.t === 'plat' || o.t === 'secret') && !(num(o.w, 0) > 0 && num(o.h, 0) > 0)) continue;
      L.obj.push(clean(o, 0));
    }
    return L;
  }
  open(level, customIndex) {
    this.level = level ? LevelEditor.sanitize(level) : LevelEditor.blank(); this.customIndex = customIndex === undefined ? -1 : customIndex;
    this.sel = null; this.tool = 'select'; this.undoStack = []; this.redoStack = []; this.dirty = true;
    this.$('edName').value = this.level.name; this.$('edW').value = this.level.w; this.$('edH').value = this.level.h;
    this.cam = { x: Math.min(this.level.w / 2, 700), y: this.level.h / 2, z: Math.min(this.W / 1300, this.H / (this.level.h + 120)) };
    // поле видно между панелью инструментов (слева ~130px) и свойствами (справа ~230px), под верхней панелью (~85px)
    const availW = Math.max(200, this.W - 380), availH = Math.max(200, this.H - 100);
    this.cam.z = Util.clamp(Math.min(availW / 1300, availH / (this.level.h + 60)), 0.2, 1.2);
    this.cam.x = (this.W / 2 - 140) / this.cam.z; this.cam.y = this.level.h / 2 - (-20) / this.cam.z;
    this.refreshTools(); this.refreshProps(); this.msg('Редактор: выбери инструмент слева и кликни по полю. Колесо — зум, перетаскивание пустого места — прокрутка.', 6000);
  }
  resume() { this.dirty = true; this.refreshTools(); this.refreshProps(); this.msg('Возврат из теста.', 2000); }
  resize() { this.W = this.g.W; this.H = this.g.H; }
  newId(p) { let i = 1; const used = new Set(this.level.obj.map(o => o.id)); while (used.has(p + i)) i++; return p + i; }
  /* ---------- история ---------- */
  snap() { return JSON.stringify({ name: this.level.name, w: this.level.w, h: this.level.h, start: this.level.start, obj: this.level.obj, hint: this.level.hint, route: this.level.route }); }
  pushUndo() { this.undoStack.push(this.snap()); if (this.undoStack.length > 80) this.undoStack.shift(); this.redoStack = []; }
  undo() { if (!this.undoStack.length) return; this.redoStack.push(this.snap()); this._restore(this.undoStack.pop()); }
  redo() { if (!this.redoStack.length) return; this.undoStack.push(this.snap()); this._restore(this.redoStack.pop()); }
  _restore(s) { const o = JSON.parse(s); Object.assign(this.level, o); this.sel = null; this.dirty = true; this.$('edW').value = this.level.w; this.$('edH').value = this.level.h; this.refreshProps(); }
  /* ---------- интерфейс ---------- */
  msg(text, ms) { this.$('edMsg').textContent = text; clearTimeout(this._mt); this._mt = setTimeout(() => { this.$('edMsg').textContent = ''; }, ms || 3500); }
  _buildTools() {
    const box = this.$('edTools'); box.innerHTML = '';
    for (const t of EDITOR_TOOLS) {
      if (t.g) { const h = document.createElement('div'); h.className = 'grp'; h.textContent = t.g; box.appendChild(h); }
      const b = document.createElement('button'); b.className = 'ebtn'; b.textContent = t.l; b.dataset.tool = t.id;
      b.onclick = () => { this.tool = t.id; if (t.id !== 'select') this.sel = null; this.refreshTools(); this.refreshProps(); };
      box.appendChild(b);
    }
  }
  refreshTools() { for (const b of this.$('edTools').children) if (b.dataset.tool) b.classList.toggle('on', b.dataset.tool === this.tool); this.$('edGrid').classList.toggle('on', this.showGrid); }
  _bind() {
    const $ = this.$, g = this.g, c = g.canvas;
    const on = (id, fn) => $(id).addEventListener('click', e => { g.audio.unlock(); fn(e); });
    on('edExit', () => this.exit()); on('edTest', () => this.test()); on('edCheck', () => this.check(true)); on('edBot', () => this.runBot());
    on('edSave', () => this.saveLevel()); on('edCopy', () => this.copyLevel()); on('edExport', () => this.exportJson()); on('edImport', () => this.importDialog());
    on('edUndo', () => this.undo()); on('edRedo', () => this.redo()); on('edGrid', () => { this.showGrid = !this.showGrid; this.refreshTools(); }); on('edMy', () => this.myDialog());
    $('edName').addEventListener('input', () => { this.level.name = $('edName').value; });
    $('edW').addEventListener('change', () => { this.pushUndo(); this.level.w = Util.clamp(+$('edW').value || 3200, 800, 20000); this.dirty = true; });
    $('edH').addEventListener('change', () => { this.pushUndo(); this.level.h = Util.clamp(+$('edH').value || 900, 600, 6000); this.dirty = true; });
    $('edDlgCancel').onclick = () => $('edDialog').classList.add('hidden');
    $('edFile').addEventListener('change', e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { $('edDlgText').value = String(r.result); }; r.readAsText(f); e.target.value = ''; });
    c.addEventListener('pointerdown', e => this.pd(e)); c.addEventListener('pointermove', e => this.pm(e)); c.addEventListener('pointerup', e => this.pu(e)); c.addEventListener('pointercancel', e => this.pu(e));
    c.addEventListener('wheel', e => { if (g.state !== 'editor') return; e.preventDefault(); this.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
    window.addEventListener('keydown', e => this.key(e)); window.addEventListener('keyup', e => { if (e.code === 'Space') this.space = false; });
  }
  /* ---------- координаты ---------- */
  s2w(sx, sy) { return { x: (sx - this.W / 2) / this.cam.z + this.cam.x, y: (sy - this.H / 2) / this.cam.z + this.cam.y }; }
  w2s(x, y) { return { x: (x - this.cam.x) * this.cam.z + this.W / 2, y: (y - this.cam.y) * this.cam.z + this.H / 2 }; }
  zoomAt(sx, sy, f) { const before = this.s2w(sx, sy); this.cam.z = Util.clamp(this.cam.z * f, 0.12, 2.5); const after = this.s2w(sx, sy); this.cam.x += before.x - after.x; this.cam.y += before.y - after.y; }
  snapV(v) { return this.showGrid ? Math.round(v / this.grid) * this.grid : Math.round(v); }
  /* ---------- габариты и ручки ---------- */
  bbox(o) {
    switch (o.t) {
      case 'plat': case 'secret': return { x: o.x, y: o.y, w: o.w, h: o.h };
      case 'spike': { const h = o.dir === 'u' || o.dir === 'd'; return { x: o.x, y: o.y, w: h ? o.n * 22 : 22, h: h ? 22 : o.n * 22 }; }
      case 'saw': return { x: o.x - o.r, y: o.y - o.r, w: o.r * 2, h: o.r * 2 };
      case 'coin': return { x: o.x - 18, y: o.y - 18, w: 36, h: 36 };
      case 'cp': return { x: o.x - 22, y: o.y - 90, w: 44, h: 90 };
      case 'fin': return { x: o.x - 34, y: o.y - 120, w: 68, h: 120 };
      case 'rope': return { x: o.x - 14, y: o.y, w: 28, h: o.h };
      case 'crate': return { x: o.x, y: o.y, w: o.s || 46, h: o.s || 46 };
      case 'sblock': return { x: o.x - o.s / 2, y: o.y - o.s / 2, w: o.s, h: o.s };
      case 'spinner': return { x: o.x - 20, y: o.y - 20, w: 40, h: 40 };
      case 'dart': return { x: o.x, y: o.y, w: 38, h: 38 };
      case 'laser': return o.o === 'v' ? { x: o.x - 12, y: o.y - 10, w: 24, h: o.len + 20 } : { x: o.x - 10, y: o.y - 12, w: o.len + 20, h: 24 };
      case 'plate': return { x: o.x, y: o.y - 14, w: o.w, h: 24 };
      case 'txt': { const s = o.sz || 26, w = Math.max(1, ...String(o.s).split('\n').map(l => l.length)) * s * 0.6; return { x: o.x - w / 2, y: o.y - s, w, h: s * 1.4 * String(o.s).split('\n').length }; }
      case 'deco': return { x: o.x - o.sz, y: o.y - o.sz, w: o.sz * 2, h: o.sz * 2 };
    }
    return { x: o.x, y: o.y, w: 10, h: 10 };
  }
  handles(o) {
    const H = [], sv = v => this.snapV(v);
    switch (o.t) {
      case 'plat':
        H.push({ x: o.x + o.w, y: o.y + o.h, set: (x, y) => { o.w = Math.max(16, sv(x) - o.x); o.h = Math.max(8, sv(y) - o.y); } });
        if (o.m) H.push({ x: o.x + o.m.mx + o.w / 2, y: o.y + o.m.my + o.h / 2, c: '#2b4fb8', set: (x, y) => { o.m.mx = sv(x - o.w / 2) - o.x; o.m.my = sv(y - o.h / 2) - o.y; } });
        break;
      case 'secret': H.push({ x: o.x + o.w, y: o.y + o.h, set: (x, y) => { o.w = Math.max(40, sv(x) - o.x); o.h = Math.max(40, sv(y) - o.y); } }); break;
      case 'plate': H.push({ x: o.x + o.w, y: o.y, set: (x) => { o.w = Math.max(30, sv(x) - o.x); } }); break;
      case 'saw': {
        const p = o.p || (o.p = { ty: 'static' });
        H.push({ x: o.x + o.r, y: o.y, set: x => { o.r = Util.clamp(Math.round(Math.abs(x - o.x)), 14, 90); } });
        if (p.ty === 'h' || p.ty === 'circ') H.push({ x: o.x + p.rg, y: o.y + 24, c: '#2b4fb8', set: x => { p.rg = Math.max(20, Math.abs(sv(x) - o.x)); } });
        if (p.ty === 'v' || p.ty === 'pend') H.push({ x: o.x, y: o.y + p.rg, c: '#2b4fb8', set: (x, y) => { p.rg = Math.max(20, Math.abs(sv(y) - o.y)); } });
        if (p.ty === 'trig') H.push({ x: o.x + (p.mx || 0), y: o.y + (p.my || 0), c: '#2b4fb8', set: (x, y) => { p.mx = sv(x) - o.x; p.my = sv(y) - o.y; } });
        break;
      }
      case 'sblock': H.push({ x: o.x + o.m.mx, y: o.y + o.m.my, c: '#2b4fb8', set: (x, y) => { o.m.mx = sv(x) - o.x; o.m.my = sv(y) - o.y; } }); break;
      case 'laser': H.push(o.o === 'v' ? { x: o.x, y: o.y + o.len, set: (x, y) => { o.len = Math.max(20, sv(y) - o.y); } } : { x: o.x + o.len, y: o.y, set: x => { o.len = Math.max(20, sv(x) - o.x); } }); break;
      case 'rope': H.push({ x: o.x, y: o.y + o.h, set: (x, y) => { o.h = Math.max(40, sv(y) - o.y); } }); break;
      case 'spinner': H.push({ x: o.x + o.L, y: o.y, set: x => { o.L = Math.max(30, Math.abs(sv(x) - o.x)); } }); break;
      case 'spike': { const horiz = o.dir === 'u' || o.dir === 'd'; H.push({ x: horiz ? o.x + o.n * 22 : o.x + 11, y: horiz ? o.y + 11 : o.y + o.n * 22, set: (x, y) => { o.n = Math.max(1, Math.round(((horiz ? x - o.x : y - o.y)) / 22)); } }); break; }
    }
    return H;
  }
  /* ---------- указатель ---------- */
  hit(wx, wy) {
    let best = null, ba = 1e18;
    for (const o of this.level.obj) { const b = this.bbox(o); if (wx >= b.x && wx <= b.x + b.w && wy >= b.y && wy <= b.y + b.h) { const a = b.w * b.h; if (a <= ba) { ba = a; best = o; } } }
    const s = this.level.start; if (Math.abs(wx - s.x) < 22 && wy > s.y - 80 && wy < s.y + 6) return 'start';
    return best;
  }
  pd(e) {
    if (this.g.state !== 'editor') return;
    this.g.canvas.setPointerCapture && this.g.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) { this.drag = { type: 'pinch' }; const [a, b] = [...this.pointers.values()]; this.drag.d = Math.hypot(a.x - b.x, a.y - b.y); return; }
    const w = this.s2w(e.clientX, e.clientY);
    if (e.button === 1 || e.button === 2 || this.space || this.tool === 'hand') { this.drag = { type: 'pan', sx: e.clientX, sy: e.clientY, cx: this.cam.x, cy: this.cam.y }; return; }
    if (this.tool === 'erase') { const o = this.hit(w.x, w.y); if (o && o !== 'start') { this.pushUndo(); this.level.obj.splice(this.level.obj.indexOf(o), 1); this.dirty = true; } return; }
    if (this.tool !== 'select') { this.place(w.x, w.y); return; }
    // выбор / ручки / перемещение
    if (this.sel && this.sel !== 'start') {
      for (const h of this.handles(this.sel)) { const s = this.w2s(h.x, h.y); if (Math.hypot(s.x - e.clientX, s.y - e.clientY) < 16) { this.drag = { type: 'handle', h, undo: false }; return; } }
    }
    const o = this.hit(w.x, w.y);
    if (o) { this.sel = o; this.refreshProps(); const p = o === 'start' ? this.level.start : o; this.drag = { type: 'move', o, ox: w.x - p.x, oy: w.y - p.y, undo: false, moved: false }; }
    else { this.sel = null; this.refreshProps(); this.drag = { type: 'pan', sx: e.clientX, sy: e.clientY, cx: this.cam.x, cy: this.cam.y }; }
  }
  pm(e) {
    if (this.g.state !== 'editor') return;
    this.cursor = { x: e.clientX, y: e.clientY };
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const d = this.drag; if (!d) return;
    if (d.type === 'pinch' && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()], nd = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (d.d > 0) this.zoomAt(mx, my, nd / d.d); d.d = nd; return;
    }
    if (d.type === 'pan') { this.cam.x = d.cx - (e.clientX - d.sx) / this.cam.z; this.cam.y = d.cy - (e.clientY - d.sy) / this.cam.z; return; }
    const w = this.s2w(e.clientX, e.clientY);
    if (d.type === 'handle') { if (!d.undo) { this.pushUndo(); d.undo = true; } d.h.set(w.x, w.y); this.dirty = true; this.refreshProps(true); return; }
    if (d.type === 'move') {
      const nx = this.snapV(w.x - d.ox), ny = this.snapV(w.y - d.oy), t = d.o === 'start' ? this.level.start : d.o;
      if (nx !== t.x || ny !== t.y) { if (!d.undo) { this.pushUndo(); d.undo = true; } t.x = nx; t.y = ny; this.dirty = true; this.refreshProps(true); }
    }
  }
  pu(e) {
    this.pointers.delete(e.pointerId);
    if (this.drag && (this.drag.type === 'pinch' ? this.pointers.size < 2 : true)) this.drag = this.pointers.size ? { type: 'none' } : null;
  }
  place(wx, wy) {
    const tool = EDITOR_TOOLS.find(t => t.id === this.tool); if (!tool) return;
    const x = this.snapV(wx), y = this.snapV(wy);
    this.pushUndo();
    if (tool.id === 'start') { this.level.start = { x, y }; this.dirty = true; return; }
    const o = tool.make(x, y, this);
    if (o.t === 'fin') { const old = this.level.obj.find(q => q.t === 'fin'); if (old) { old.x = x; old.y = y; this.dirty = true; this.sel = old; this.refreshProps(); return; } }
    this.level.obj.push(o); this.dirty = true; this.sel = o; this.tool = 'select'; this.refreshTools(); this.refreshProps();
  }
  key(e) {
    if (this.g.state !== 'editor') return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.code === 'Space') { this.space = true; e.preventDefault(); }
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.code === 'KeyZ') { e.preventDefault(); e.shiftKey ? this.redo() : this.undo(); }
    else if (ctrl && e.code === 'KeyY') { e.preventDefault(); this.redo(); }
    else if (ctrl && e.code === 'KeyD') { e.preventDefault(); this.duplicate(); }
    else if (e.code === 'Delete' || e.code === 'Backspace') { this.deleteSel(); }
    else if (e.code === 'Escape') { this.sel = null; this.tool = 'select'; this.refreshTools(); this.refreshProps(); }
    else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code) && this.sel) {
      e.preventDefault(); const t = this.sel === 'start' ? this.level.start : this.sel, s = this.showGrid ? this.grid : 5; this.pushUndo();
      if (e.code === 'ArrowLeft') t.x -= s; if (e.code === 'ArrowRight') t.x += s; if (e.code === 'ArrowUp') t.y -= s; if (e.code === 'ArrowDown') t.y += s; this.dirty = true; this.refreshProps(true);
    }
  }
  deleteSel() { if (!this.sel || this.sel === 'start') return; this.pushUndo(); const i = this.level.obj.indexOf(this.sel); if (i >= 0) this.level.obj.splice(i, 1); this.sel = null; this.dirty = true; this.refreshProps(); }
  duplicate() {
    if (!this.sel || this.sel === 'start') return; this.pushUndo(); const c = JSON.parse(JSON.stringify(this.sel)); c.x += 40; c.y += 40; if (c.id) c.id = this.newId(c.id.replace(/\d+$/, ''));
    this.level.obj.push(c); this.sel = c; this.dirty = true; this.refreshProps();
  }
  /* ---------- панель свойств ---------- */
  refreshProps(soft) {
    const box = this.$('edProps'), o = this.sel;
    if (!o || o === 'start') { box.classList.add('hidden'); if (o === 'start') this.msg('Старт: перетащи, чтобы переместить.', 1500); return; }
    if (soft && box.dataset.for === String(this.level.obj.indexOf(o))) { this._syncProps(); return; }
    box.dataset.for = String(this.level.obj.indexOf(o)); box.classList.remove('hidden'); box.innerHTML = '<b>' + o.t + '</b><br>';
    const get = (obj, path) => path.split('.').reduce((a, k) => (a === undefined || a === null ? undefined : a[k]), obj);
    const set = (obj, path, val) => { const ks = path.split('.'); let t = obj; for (let i = 0; i < ks.length - 1; i++) { if (!t[ks[i]]) t[ks[i]] = {}; t = t[ks[i]]; } t[ks[ks.length - 1]] = val; };
    const fields = EDITOR_PROPS[o.t] || [];
    for (const [key, label, type, extra] of fields) {
      if (key === 'dir' && o.t === 'plat' && o.k !== 'conveyor') continue; if (key === 'tr' && o.t === 'plat' && o.k !== 'weight') continue;
      if (o.t === 'saw' && key.startsWith('p.') && key !== 'p.ty') { const ty = (o.p || {}).ty; const ok = { 'p.rg': ['h', 'v', 'pend', 'circ'], 'p.sp': ['h', 'v', 'pend', 'circ', 'trig'], 'p.ph': ['h', 'v', 'pend', 'circ'], 'p.ang': ['pend'], 'p.mx': ['trig'], 'p.my': ['trig'], 'p.tr': ['trig'] }[key]; if (!ok.includes(ty)) continue; }
      const lab = document.createElement('label'); lab.append(label); let inp;
      if (type === 'sel') { inp = document.createElement('select'); for (const v of extra) { const op = document.createElement('option'); op.value = String(v); op.textContent = String(v) || '—'; inp.appendChild(op); } inp.value = String(get(o, key) === undefined ? extra[0] : get(o, key)); }
      else if (type === 'bool') { inp = document.createElement('input'); inp.type = 'checkbox'; inp.checked = !!get(o, key); }
      else if (type === 'list') { inp = document.createElement('input'); inp.value = (get(o, key) || []).join(','); }
      else if (type === 'num') { inp = document.createElement('input'); inp.type = 'number'; inp.step = extra; inp.value = get(o, key) === undefined ? '' : get(o, key); }
      else { inp = document.createElement('input'); inp.value = get(o, key) === undefined ? '' : get(o, key); }
      inp.dataset.key = key;
      inp.addEventListener('change', () => {
        this.pushUndo(); let v;
        if (type === 'bool') v = inp.checked; else if (type === 'list') v = inp.value.split(',').map(s => s.trim()).filter(Boolean);
        else if (type === 'num') v = inp.value === '' ? undefined : parseFloat(inp.value); else if (type === 'sel') { v = inp.value; if (/^-?\d+(\.\d+)?$/.test(v)) v = parseFloat(v); } else v = inp.value;
        if (v === undefined || v === '' || (type === 'sel' && v === '')) { const ks = key.split('.'); let t = o; for (let i = 0; i < ks.length - 1; i++) t = t[ks[i]] || {}; delete t[ks[ks.length - 1]]; } else set(o, key, v);
        if (o.t === 'saw' && key === 'p.ty') { const p = o.p; if (p.rg === undefined) p.rg = 120; if (p.sp === undefined) p.sp = p.ty === 'pend' ? 3.6 : p.ty === 'circ' ? 1.5 : 140; if (p.ty === 'trig' && p.mx === undefined) { p.mx = -400; p.my = 0; p.tr = 260; } this.refreshProps(); }
        if (o.t === 'plat' && key === 'k' && o.k === 'gate' && !o.id) o.id = this.newId('g');
        this.dirty = true;
      });
      lab.appendChild(inp); box.appendChild(lab);
    }
    if (o.t === 'plat') { // режим движения платформы
      const lab = document.createElement('label'); lab.append('движение'); const sel = document.createElement('select');
      for (const v of ['нет', 'pp', 'swing', 'trig']) { const op = document.createElement('option'); op.value = v; op.textContent = v; sel.appendChild(op); } sel.value = o.m ? o.m.mode || 'pp' : 'нет';
      sel.addEventListener('change', () => { this.pushUndo(); if (sel.value === 'нет') delete o.m; else { o.m = o.m || { mx: 200, my: 0, sp: 90 }; o.m.mode = sel.value; if (sel.value === 'swing') { o.m.sp = 4; o.m.len = o.m.len || 220; } } this.dirty = true; this.refreshProps(); });
      lab.appendChild(sel); box.appendChild(lab);
      if (o.m) for (const [k, l, st] of [['mx', 'сдвиг X', 10], ['my', 'сдвиг Y', 10], ['sp', o.m.mode === 'swing' ? 'период, с' : 'скорость', 1], ['ph', 'фаза', 0.1], ['pause', 'пауза, с', 0.1]]) {
        const lb = document.createElement('label'); lb.append(l); const i = document.createElement('input'); i.type = 'number'; i.step = st; i.value = o.m[k] === undefined ? '' : o.m[k]; i.dataset.key = 'm.' + k;
        i.addEventListener('change', () => { this.pushUndo(); if (i.value === '') delete o.m[k]; else o.m[k] = parseFloat(i.value); this.dirty = true; }); lb.appendChild(i); box.appendChild(lb);
      }
    }
    const row = document.createElement('div'); row.className = 'row';
    for (const [t, fn] of [['⧉ дубль', () => this.duplicate()], ['🗑 удалить', () => this.deleteSel()]]) { const b = document.createElement('button'); b.className = 'ebtn'; b.textContent = t; b.onclick = fn; row.appendChild(b); }
    box.appendChild(row);
  }
  _syncProps() {
    const o = this.sel; if (!o) return;
    for (const i of this.$('edProps').querySelectorAll('input[data-key]')) {
      if (document.activeElement === i) continue; const v = i.dataset.key.split('.').reduce((a, k) => (a === undefined || a === null ? undefined : a[k]), o);
      if (i.type === 'checkbox') i.checked = !!v; else if (v !== undefined) i.value = Array.isArray(v) ? v.join(',') : v;
    }
  }
  /* ---------- действия ---------- */
  exit() { this.g.ui.confirm('Выйти из редактора? Несохранённые изменения будут потеряны.', () => this.g.closeEditor()); }
  collect() { const L = LevelEditor.sanitize(Object.assign({}, this.level, { obj: this.level.obj })); L.name = this.$('edName').value.trim() || 'Без названия'; return L; }
  check(showDialog) {
    const L = this.collect(), r = LevelValidator.analyze(L);
    const lines = [...r.errors.map(e => '✘ ' + e), ...r.warnings.map(w => '⚠ ' + w)];
    this.msg(r.ok ? (lines.length ? lines[0] + (lines.length > 1 ? ' (+' + (lines.length - 1) + ')' : '') : '✔ Ошибок не найдено. Уровень выглядит корректным.') : lines[0], 6000);
    if (showDialog && lines.length) this.dialog('Проверка уровня', lines.join('\n'), null, true);
    return r;
  }
  test() {
    const r = this.check(false); if (!r.ok) { this.dialog('Тест невозможен', r.errors.join('\n'), null, true); return; }
    this.g.testFromEditor(this.collect());
  }
  async runBot() {
    if (this.bot) { this.bot.cancel = true; this.bot = null; this.msg('Бот остановлен.'); return; }
    const r = this.check(false); if (!r.ok) { this.dialog('Проверка невозможна', r.errors.join('\n'), null, true); return; }
    const L = this.collect(); this.bot = new PathBot(); const bot = this.bot; this.msg('🤖 Бот ищет прохождение… (нажми «Бот» ещё раз, чтобы остановить)', 60000);
    const res = await bot.run(L, { budget: 60000, onProgress: p => this.msg('🤖 Бот: участок ' + p.seg + '/' + p.segs + ', состояний ' + p.nodes, 60000) });
    this.bot = null;
    if (res.ok) this.msg('🤖 Путь найден: уровень проходим (≈' + res.time.toFixed(1) + ' с).', 8000);
    else this.msg('🤖 ' + (res.reason ? res.reason : 'Путь не найден на участке ' + res.segment + '/' + res.segments + ' около (' + Math.round(res.failedAt.x) + ',' + Math.round(res.failedAt.y) + '). Это не доказывает непроходимость — добавьте контрольные точки.'), 9000);
  }
  saveLevel() {
    const L = this.collect(), d = this.g.save.data;
    if (this.customIndex >= 0 && d.custom[this.customIndex]) d.custom[this.customIndex] = L; else { d.custom.push(L); this.customIndex = d.custom.length - 1; }
    this.g.save.save(); const got = this.g.checkAchievements(null);
    this.msg('💾 Сохранено в «Мои уровни»' + (this.g.save.persistent ? '' : ' (хранилище недоступно — только на время сессии)') + (got.length ? ' · 🏆 ' + got.join(', ') : ''), 4000);
  }
  copyLevel() {
    const L = this.collect(); L.name = (L.name + ' (копия)').slice(0, 40); const d = this.g.save.data; d.custom.push(L); this.customIndex = d.custom.length - 1; this.g.save.save();
    this.level.name = L.name; this.$('edName').value = L.name; this.msg('⧉ Создана копия уровня (редактируется копия).', 3500);
  }
  exportJson() { this.dialog('Экспорт уровня (JSON)', JSON.stringify(this.collect()), null, false); }
  importDialog() {
    this.dialog('Импорт уровня: вставьте JSON', '', txt => {
      try { const L = LevelEditor.sanitize(JSON.parse(txt)); this.pushUndo(); this.level = L; this.sel = null; this.dirty = true; this.$('edName').value = L.name; this.$('edW').value = L.w; this.$('edH').value = L.h; this.customIndex = -1; this.refreshProps(); this.msg('⤒ Импортировано объектов: ' + L.obj.length, 3500); this.$('edDialog').classList.add('hidden'); }
      catch (e) { this.msg('Ошибка импорта: ' + e.message, 6000); }
    }, false, true);
  }
  myDialog() {
    const d = this.g.save.data.custom, dlg = this.$('edDialog'); this.dialog('Мои уровни', d.length ? '' : 'Пока нет сохранённых уровней. Нажмите 💾 Сохранить.', null, true);
    if (!d.length) return; const ta = this.$('edDlgText'); ta.style.display = 'none';
    let box = this.$('edMyBox'); if (!box) { box = document.createElement('div'); box.id = 'edMyBox'; ta.parentNode.insertBefore(box, ta); } box.innerHTML = '';
    d.forEach((L, i) => { const b = document.createElement('button'); b.className = 'btn small'; b.style.display = 'block'; b.style.margin = '4px auto'; b.textContent = (L.name || 'Без названия') + ' (' + L.obj.length + ' объектов)';
      b.onclick = () => { this.pushUndo(); this.level = LevelEditor.sanitize(L); this.customIndex = i; this.sel = null; this.dirty = true; this.$('edName').value = this.level.name; this.$('edW').value = this.level.w; this.$('edH').value = this.level.h; this.refreshProps(); dlg.classList.add('hidden'); ta.style.display = ''; box.innerHTML = ''; }; box.appendChild(b); });
  }
  dialog(title, text, onOk, readOnly, input) {
    const $ = this.$; $('edDlgTitle').textContent = title; const ta = $('edDlgText'); ta.value = text; ta.readOnly = !!readOnly && !input; ta.style.display = ''; const box = $('edMyBox'); if (box) box.innerHTML = '';
    $('edDlgOk').style.display = onOk ? '' : 'none'; $('edDlgOk').onclick = () => onOk && onOk(ta.value);
    $('edDlgCopy').style.display = (!input) ? '' : 'none'; $('edDlgFile').style.display = '';
    $('edDlgCopy').onclick = () => { ta.select(); try { navigator.clipboard.writeText(ta.value).catch(() => document.execCommand('copy')); } catch (e) { document.execCommand('copy'); } this.msg('Скопировано.', 1500); };
    $('edDlgFile').textContent = input ? 'Открыть файл…' : 'Скачать .json';
    $('edDlgFile').onclick = () => {
      if (input) { $('edFile').click(); return; }
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ta.value], { type: 'application/json' })); a.download = (this.level.name || 'level').replace(/[^\wа-яё-]+/gi, '_') + '.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    };
    $('edDialog').classList.remove('hidden');
  }
  /* ---------- отрисовка ---------- */
  update(dt) {
    this.t += dt;
    if (this.dirty || !this.world) {
      try {
        const L = JSON.parse(JSON.stringify(this.level)); this.world = new World(L, {}); this.world.paperFill = null;
        for (const e of this.world.entities) if (e instanceof SecretZone) e.fade = 0.3;
        this.world.player.spawnT = 0; this.world.player.anim.play('idle', true);
      } catch (e) { console.error(e); }
      this.dirty = false;
    }
    if (this.world) { this.world.time = this.t; this.world.player.anim.update(dt); }
  }
  draw(ctx) {
    const g = this.g, dpr = g.dpr, z = this.cam.z, W = this.W, H = this.H;
    const view = { x: this.cam.x - W / 2 / z, y: this.cam.y - H / 2 / z, w: W / z, h: H / z };
    ctx.setTransform(dpr * z, 0, 0, dpr * z, (-view.x * z) * dpr, (-view.y * z) * dpr);
    ctx.fillStyle = g.paperPat; ctx.fillRect(view.x, view.y, view.w, view.h);   // фон редактора: узор в мировых координатах (двигается вместе с картой)
    ctx.fillStyle = g.ruledPat; ctx.fillRect(view.x, view.y, view.w, view.h);
    // сетка
    if (this.showGrid) {
      let step = this.grid; while (step * z < 14) step *= 2;
      ctx.strokeStyle = 'rgba(80,110,170,.22)'; ctx.lineWidth = 1 / z; ctx.beginPath();
      for (let x = Math.floor(view.x / step) * step; x < view.x + view.w; x += step) { ctx.moveTo(x, view.y); ctx.lineTo(x, view.y + view.h); }
      for (let y = Math.floor(view.y / step) * step; y < view.y + view.h; y += step) { ctx.moveTo(view.x, y); ctx.lineTo(view.x + view.w, y); }
      ctx.stroke();
    }
    // границы уровня
    ctx.strokeStyle = INK.red; ctx.lineWidth = 3 / z; ctx.setLineDash([14 / z, 8 / z]); ctx.strokeRect(0, 0, this.level.w, this.level.h); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(27,27,33,.12)'; ctx.fillRect(view.x, this.level.h + 160, view.w, Math.max(0, view.y + view.h - this.level.h - 160));
    if (this.world) this.world.draw(ctx, g.ha, g.sheet, { x: view.x - 100, y: view.y - 100, w: view.w + 200, h: view.h + 200 });
    this.drawOverlays(ctx, z);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // подсказка и курсор-призрак
    if (this.tool !== 'select' && this.tool !== 'hand' && this.tool !== 'erase' && this.cursor) {
      const t = EDITOR_TOOLS.find(q => q.id === this.tool); if (t) { ctx.fillStyle = 'rgba(232,113,26,.9)'; ctx.font = '13px sans-serif'; ctx.fillText('клик — поставить: ' + t.l, this.cursor.x + 14, this.cursor.y - 8); }
    }
  }
  drawOverlays(ctx, z) {
    const lw = 2 / z, L = this.level;
    ctx.save(); ctx.lineWidth = lw;
    // стартовая отметка
    const s = L.start; ctx.strokeStyle = INK.green; ctx.fillStyle = 'rgba(47,143,78,.25)'; ctx.setLineDash([6 / z, 4 / z]); ctx.strokeRect(s.x - 13, s.y - 68, 26, 68); ctx.fillRect(s.x - 13, s.y - 68, 26, 68); ctx.setLineDash([]);
    ctx.fillStyle = INK.green; ctx.font = (13 / z) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('СТАРТ', s.x, s.y - 74);
    // пути движущихся объектов и связи плит
    for (const o of L.obj) {
      ctx.strokeStyle = 'rgba(43,79,184,.7)'; ctx.setLineDash([6 / z, 5 / z]);
      if (o.t === 'plat' && o.m && o.m.mode !== 'swing') { ctx.strokeRect(o.x + o.m.mx, o.y + o.m.my, o.w, o.h); ctx.beginPath(); ctx.moveTo(o.x + o.w / 2, o.y + o.h / 2); ctx.lineTo(o.x + o.m.mx + o.w / 2, o.y + o.m.my + o.h / 2); ctx.stroke(); }
      if (o.t === 'sblock') { ctx.strokeRect(o.x + o.m.mx - o.s / 2, o.y + o.m.my - o.s / 2, o.s, o.s); }
      if (o.t === 'saw' && o.p && o.p.ty === 'trig') { ctx.beginPath(); ctx.arc(o.x + (o.p.mx || 0), o.y + (o.p.my || 0), o.r, 0, 6.3); ctx.stroke(); }
      if (o.t === 'plate') for (const id of (o.tg || [])) { const t = L.obj.find(q => q.id === id); if (t) { const b = this.bbox(t); ctx.strokeStyle = 'rgba(212,53,44,.7)'; ctx.beginPath(); ctx.moveTo(o.x + o.w / 2, o.y); ctx.lineTo(b.x + b.w / 2, b.y + b.h / 2); ctx.stroke(); } }
      ctx.setLineDash([]);
      if (o.id && z > 0.35) { const b = this.bbox(o); ctx.fillStyle = 'rgba(43,79,184,.95)'; ctx.font = (11 / z) + 'px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('#' + o.id, b.x + 2, b.y - 3 / z); }
    }
    // выделение и ручки
    const sel = this.sel;
    if (sel) {
      const b = sel === 'start' ? { x: s.x - 13, y: s.y - 68, w: 26, h: 68 } : this.bbox(sel);
      ctx.strokeStyle = '#e8711a'; ctx.lineWidth = 2.5 / z; ctx.setLineDash([8 / z, 5 / z]); ctx.strokeRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6); ctx.setLineDash([]);
      if (sel !== 'start') for (const h of this.handles(sel)) { ctx.fillStyle = h.c || '#e8711a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 / z; const r = 7 / z; ctx.fillRect(h.x - r, h.y - r, r * 2, r * 2); ctx.strokeRect(h.x - r, h.y - r, r * 2, r * 2); }
    }
    ctx.restore();
  }
}
