/* inspector.js — Sprite Sheet Inspector: просмотр листа, выбор кадров, сборка анимаций, экспорт JSON */
'use strict';
class SpriteInspector {
  constructor(game) {
    this.g = game; this.sel = []; this.last = -1; this.zoom = 0.6; this.showNums = true;
    this.cfg = {};           // пользовательские анимации { имя: {frames,fps,loop,ox,oy,scale} }
    this.t = 0; this.raf = 0; this.bound = false; this.opened = false;
  }
  $(id) { return document.getElementById(id); }
  bind() {
    if (this.bound) return; this.bound = true;
    const $ = id => this.$(id);
    this.cv = $('inSheet'); this.cx = this.cv.getContext('2d'); this.pv = $('inPrev'); this.pc = this.pv.getContext('2d');
    $('inZoom').oninput = e => { this.zoom = +e.target.value; this.layout(); };
    $('inNums').onchange = e => { this.showNums = e.target.checked; this.drawSheet(); };
    $('inClear').onclick = () => { this.sel = []; this.last = -1; this.refresh(); };
    $('inExit').onclick = () => this.g.closeInspector();
    $('inApply').onclick = () => this.apply();
    $('inAddRect').onclick = () => this.addRect();
    $('inSave').onclick = () => this.save();
    $('inReset').onclick = () => this.reset();
    $('inExport').onclick = () => { $('inJson').value = JSON.stringify(this.exportCfg(), null, 1); $('inJson').select(); };
    $('inImport').onclick = () => this.importJson();
    this.cv.addEventListener('pointerdown', e => this.click(e));
    ['inName', 'inFps', 'inLoop', 'inOx', 'inOy', 'inScale'].forEach(id => $(id).addEventListener('input', () => { this.t = 0; }));
  }
  open() {
    this.bind(); this.opened = true;
    this.$('inspector').classList.remove('hidden');
    // текущая раскладка = то, что сейчас в игре (дефолт + пользовательские правки)
    this.cfg = JSON.parse(JSON.stringify(ANIMATIONS));
    this.sel = []; this.layout(); this.refresh();
    cancelAnimationFrame(this.raf); const loop = ts => { if (!this.opened) return; this.preview(ts / 1000); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }
  close() { this.opened = false; cancelAnimationFrame(this.raf); this.$('inspector').classList.add('hidden'); }
  layout() {
    const s = this.g.sheet; if (!s.ready) return;
    this.cv.width = Math.ceil(s.img.width * this.zoom); this.cv.height = Math.ceil(s.img.height * this.zoom);
    this.drawSheet();
  }
  drawSheet() {
    const s = this.g.sheet, c = this.cx, z = this.zoom; if (!s.ready) return;
    c.imageSmoothingEnabled = false; c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#2b2a33'; c.fillRect(0, 0, this.cv.width, this.cv.height);
    c.drawImage(s.img, 0, 0, s.img.width * z, s.img.height * z);
    const selSet = new Set(this.sel.filter(f => typeof f === 'number'));
    c.font = '10px monospace'; c.textBaseline = 'top';
    s.frames.forEach((f, i) => {
      const on = selSet.has(i);
      c.strokeStyle = on ? '#ffd23f' : 'rgba(255,255,255,.18)'; c.lineWidth = on ? 2 : 1;
      c.strokeRect(f.sx * z + .5, f.sy * z + .5, f.sw * z, f.sh * z);
      if (on) { c.fillStyle = 'rgba(255,210,63,.18)'; c.fillRect(f.sx * z, f.sy * z, f.sw * z, f.sh * z); }
      if (this.showNums && z >= 0.4) { c.fillStyle = on ? '#ffd23f' : '#9ad'; c.fillText(String(i), f.sx * z + 2, f.sy * z + 1); }
    });
  }
  hit(e) {
    const r = this.cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * this.g.sheet.img.width, y = (e.clientY - r.top) / r.height * this.g.sheet.img.height;
    const fr = this.g.sheet.frames; let best = -1;
    for (let i = 0; i < fr.length; i++) { const f = fr[i]; if (x >= f.sx && x < f.sx + f.sw && y >= f.sy && y < f.sy + f.sh) { best = i; break; } }
    return { i: best, x: Math.round(x), y: Math.round(y) };
  }
  click(e) {
    const h = this.hit(e); this.$('cx').value = h.x; this.$('cy').value = h.y;
    if (h.i < 0) return;
    if (e.shiftKey && this.last >= 0) {
      const a = Math.min(this.last, h.i), b = Math.max(this.last, h.i);
      for (let k = a; k <= b; k++) if (!this.sel.includes(k)) this.sel.push(k);
    } else if (e.ctrlKey || e.metaKey || e.altKey || this.multi) {
      const k = this.sel.indexOf(h.i); if (k >= 0) this.sel.splice(k, 1); else this.sel.push(h.i);
    } else {
      // обычный клик — добавить кадр в выбор (порядок кликов = порядок кадров анимации); повторный клик убирает
      const k = this.sel.indexOf(h.i); if (k >= 0) this.sel.splice(k, 1); else this.sel.push(h.i);
    }
    this.last = h.i; this.refresh();
  }
  refresh() {
    this.$('inSel').textContent = 'Выбрано: ' + this.sel.length + (this.sel.length ? '  [' + this.sel.map(f => typeof f === 'number' ? f : '▭').join(', ') + ']' : '');
    this.drawSheet(); this.renderList(); this.t = 0;
  }
  addRect() {
    const v = id => Math.round(+this.$(id).value);
    const f = { sx: v('cx'), sy: v('cy'), sw: v('cw'), sh: v('ch') };
    const s = this.g.sheet;
    if (![f.sx, f.sy, f.sw, f.sh].every(Number.isFinite) || f.sw < 1 || f.sh < 1 || f.sx < 0 || f.sy < 0 || f.sx + f.sw > s.img.width || f.sy + f.sh > s.img.height) { this.g.ui.toast('Неверный прямоугольник'); return; }
    this.sel.push(f); this.refresh();
  }
  params() {
    const n = id => +this.$(id).value;
    return { fps: Util.clamp(n('inFps') || 10, 1, 60), loop: this.$('inLoop').checked, ox: n('inOx') || 0, oy: n('inOy') || 0, scale: n('inScale') > 0 ? n('inScale') : 1 };
  }
  apply() {
    const name = this.$('inName').value.trim();
    if (!name) { this.g.ui.toast('Введите имя анимации'); return; }
    if (!this.sel.length) { this.g.ui.toast('Выберите кадры на листе'); return; }
    this.cfg[name] = Object.assign({ frames: this.sel.map(f => typeof f === 'object' ? Object.assign({}, f) : f), note: 'пользовательская' }, this.params());
    this.g.ui.toast('Анимация «' + name + '» создана'); this.renderList();
  }
  renderList() {
    const box = this.$('inList'), dl = this.$('inNames'); box.innerHTML = ''; dl.innerHTML = '';
    Object.keys(this.cfg).forEach(k => {
      const o = document.createElement('option'); o.value = k; dl.appendChild(o);
      const a = this.cfg[k], row = document.createElement('div'); row.className = 'inItem';
      const b = document.createElement('button'); b.className = 'ebtn'; b.textContent = k + ' · ' + a.frames.length + 'к · ' + a.fps + 'fps';
      b.onclick = () => this.load(k);
      row.appendChild(b); box.appendChild(row);
    });
  }
  load(k) {
    const a = this.cfg[k]; if (!a) return;
    this.sel = a.frames.slice(); this.$('inName').value = k; this.$('inFps').value = a.fps; this.$('inLoop').checked = a.loop !== false;
    this.$('inOx').value = a.ox || 0; this.$('inOy').value = a.oy || 0; this.$('inScale').value = a.scale || 1;
    this.last = -1; this.refresh();
    const f0 = a.frames.find(f => typeof f === 'number'); if (f0 !== undefined) { const f = this.g.sheet.frames[f0]; const w = this.cv.parentElement; if (f && w) { w.scrollLeft = f.sx * this.zoom - 40; w.scrollTop = f.sy * this.zoom - 40; } }
  }
  exportCfg() {
    const out = {}; Object.keys(this.cfg).forEach(k => { const a = this.cfg[k]; out[k] = { frames: a.frames, fps: a.fps, loop: a.loop !== false, ox: a.ox || 0, oy: a.oy || 0, scale: a.scale || 1 }; });
    return out;
  }
  importJson() {
    try {
      const raw = JSON.parse(this.$('inJson').value); if (!raw || typeof raw !== 'object') throw 0;
      let n = 0; for (const k of Object.keys(raw)) { const a = raw[k]; if (a && Array.isArray(a.frames) && a.frames.length) { this.cfg[k] = { frames: a.frames, fps: +a.fps || 10, loop: a.loop !== false, ox: +a.ox || 0, oy: +a.oy || 0, scale: +a.scale || 1 }; n++; } }
      this.renderList(); this.g.ui.toast('Импортировано анимаций: ' + n);
    } catch (e) { this.g.ui.toast('Ошибка JSON'); }
  }
  save() {
    this.g.applyAnimConfig(this.exportCfg());
    try { localStorage.setItem(GAME.animKey, JSON.stringify(this.exportCfg())); this.g.ui.toast('Применено и сохранено'); }
    catch (e) { this.g.ui.toast('Применено (хранилище недоступно — до перезагрузки)'); }
  }
  reset() {
    try { localStorage.removeItem(GAME.animKey); } catch (e) { }
    ANIMATIONS = JSON.parse(JSON.stringify(DEFAULT_ANIMATIONS));
    this.cfg = JSON.parse(JSON.stringify(ANIMATIONS)); this.sel = []; this.refresh(); this.g.ui.toast('Анимации сброшены');
  }
  preview(t) {
    const c = this.pc, W = this.pv.width, H = this.pv.height; c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = false;
    c.fillStyle = '#f4efe0'; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(0,0,0,.15)'; c.beginPath(); c.moveTo(0, H - 24.5); c.lineTo(W, H - 24.5); c.stroke();
    if (!this.sel.length || !this.g.sheet.ready) return;
    const p = this.params(), n = this.sel.length;
    let k = Math.floor(t * p.fps); k = p.loop ? k % n : Math.min(k, n - 1);
    this.g.sheet.draw(c, this.sel[k], W / 2 + p.ox, H - 24 + p.oy, 2 * p.scale, false);
  }
}
