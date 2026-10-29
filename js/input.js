/* input.js — InputManager: клавиатура, мышь (кнопки) и мультитач */
'use strict';
class InputManager {
  constructor() {
    this.keys = new Set();
    this.touch = { left: false, right: false, jump: false, down: false };
    this.edge = { jump: false, down: false };
    this.onPause = null; this.onRestart = null; this.onAnyKey = null;
    this.enabled = true;
    this._bound = [];
    this._on(window, 'keydown', e => this._kd(e));
    this._on(window, 'keyup', e => this._ku(e));
    this._on(window, 'blur', () => this.clear());               // потеря фокуса — отпускаем все клавиши
    this._on(document, 'visibilitychange', () => { if (document.hidden) this.clear(); });
  }
  _on(t, ev, fn, opt) { t.addEventListener(ev, fn, opt); this._bound.push([t, ev, fn, opt]); }
  destroy() { for (const [t, ev, fn, opt] of this._bound) t.removeEventListener(ev, fn, opt); this._bound = []; }
  clear() { this.keys.clear(); this.touch.left = this.touch.right = this.touch.jump = this.touch.down = false; }
  static isGameKey(c) {
    return ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD', 'KeyW', 'KeyS'].includes(c);
  }
  _kd(e) {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (this.onAnyKey) this.onAnyKey(e);
    if (!this.enabled) return;
    if (InputManager.isGameKey(e.code)) e.preventDefault();
    if (e.repeat) return;
    const c = e.code;
    if (c === 'Space' || c === 'KeyW' || c === 'ArrowUp') this.edge.jump = true;
    if (c === 'KeyS' || c === 'ArrowDown') this.edge.down = true;
    if (c === 'Escape' || c === 'KeyP') { if (this.onPause) this.onPause(); }
    if (c === 'KeyR') { if (this.onRestart) this.onRestart(); }
    this.keys.add(c);
  }
  _ku(e) { this.keys.delete(e.code); }
  get left()  { return this.keys.has('KeyA') || this.keys.has('ArrowLeft') || this.touch.left; }
  get right() { return this.keys.has('KeyD') || this.keys.has('ArrowRight') || this.touch.right; }
  get jump()  { return this.keys.has('Space') || this.keys.has('KeyW') || this.keys.has('ArrowUp') || this.touch.jump; }
  get down()  { return this.keys.has('KeyS') || this.keys.has('ArrowDown') || this.touch.down; }
  /** Состояние на один шаг физики. Фронты (нажатие) сбрасываются после чтения. */
  snapshot() {
    const s = { left: this.left, right: this.right, jump: this.jump, down: this.down, jumpPressed: this.edge.jump, downPressed: this.edge.down };
    if (!this.enabled) { s.left = s.right = s.jump = s.down = s.jumpPressed = s.downPressed = false; }
    this.edge.jump = false; this.edge.down = false;
    return s;
  }
  /** Подключает экранные кнопки. dpad — зона ←/→ (можно водить пальцем), jump/down — кнопки. */
  bindTouch(dpad, jumpBtn, downBtn) {
    const pointers = new Map(); // id -> 'left'|'right'
    const dirOf = (e) => {
      const r = dpad.getBoundingClientRect(), x = (e.clientX - r.left) / r.width;
      return x < 0.5 ? 'left' : 'right';
    };
    const refresh = () => {
      let l = false, r = false;
      for (const d of pointers.values()) { if (d === 'left') l = true; else r = true; }
      this.touch.left = l; this.touch.right = r;
      dpad.classList.toggle('lt', l); dpad.classList.toggle('rt', r);
    };
    const dDown = e => { e.preventDefault(); dpad.setPointerCapture && dpad.setPointerCapture(e.pointerId); pointers.set(e.pointerId, dirOf(e)); refresh(); if (this.onAnyKey) this.onAnyKey(e); };
    const dMove = e => { if (pointers.has(e.pointerId)) { pointers.set(e.pointerId, dirOf(e)); refresh(); } };
    const dUp = e => { pointers.delete(e.pointerId); refresh(); };
    dpad.addEventListener('pointerdown', dDown); dpad.addEventListener('pointermove', dMove);
    dpad.addEventListener('pointerup', dUp); dpad.addEventListener('pointercancel', dUp); dpad.addEventListener('lostpointercapture', dUp);
    const button = (el, key, edgeKey) => {
      const ids = new Set();
      const set = () => { this.touch[key] = ids.size > 0; el.classList.toggle('on', ids.size > 0); };
      el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture && el.setPointerCapture(e.pointerId); ids.add(e.pointerId); if (edgeKey) this.edge[edgeKey] = true; set(); if (this.onAnyKey) this.onAnyKey(e); });
      const up = e => { ids.delete(e.pointerId); set(); };
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
    };
    button(jumpBtn, 'jump', 'jump'); button(downBtn, 'down', 'down');
    for (const el of [dpad, jumpBtn, downBtn]) el.addEventListener('contextmenu', e => e.preventDefault());
  }
}
