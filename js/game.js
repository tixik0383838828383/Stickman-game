/* game.js — Game: основной цикл (фиксированный шаг физики + requestAnimationFrame), состояния,
   события мира -> звук/частицы, камера, фон-бумага, прохождение и сохранение результатов. */
'use strict';
class Game {
  constructor() {
    this.canvas = document.getElementById('game'); this.ctx = this.canvas.getContext('2d');
    this.save = new SaveManager(); this.settings = this.save.data.settings;
    this.audio = new AudioManager(this.settings); this.input = new InputManager(); this.sheet = new SpriteSheet();
    this.ha = new HandDrawnAnimator(this.settings); this.cam = new Camera(); this.particles = new ParticleSystem(this.settings.particles);
    this.state = 'boot'; this.world = null; this.run = null; this.accum = 0; this.last = 0; this.dpr = 1; this.W = 800; this.H = 600;
    this.finishT = 0; this.completeShown = false; this.menu = { x: -80, t: 0, jump: 0, anim: new AnimationController() };
    this.ui = new UIManager(this); this.editor = new LevelEditor(this); this.inspector = new SpriteInspector(this);
    this.fps = 0; this._fc = 0; this._ft = 0;
  }
  async init() {
    try { await this.sheet.load(); } catch (e) { this.ui.toast('Ошибка загрузки спрайтов: ' + e.message, 6000); }
    this.loadAnimOverrides();
    Paper.makeTile(512); Paper.makeDoodles(); Paper.makeRuled();
    this.paperPat = this.ctx.createPattern(Paper.tile, 'repeat'); this.ruledPat = this.ctx.createPattern(Paper.ruled, 'repeat');
    window.addEventListener('resize', () => this.resize()); window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
    window.addEventListener('blur', () => { if (this.state === 'playing') this.pause(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'playing') this.pause(); });
    this.input.onPause = () => this.onEsc(); this.input.onRestart = () => this.quickRespawn();
    this.input.onAnyKey = () => this.audio.unlock();
    document.addEventListener('pointerdown', () => this.audio.unlock(), { passive: true });
    document.addEventListener('contextmenu', e => { if (this.state === 'playing' || this.state === 'editor') e.preventDefault(); });
    this.resize();
    this.state = 'menu'; this.ui.show('menu');
    this.last = performance.now(); requestAnimationFrame(t => this.frame(t));
  }
  /* ---------- анимации: пользовательская раскладка из Sprite Inspector ---------- */
  loadAnimOverrides() {
    try {
      const raw = JSON.parse(localStorage.getItem(GAME.animKey) || 'null'); if (!raw) return;
      this.applyAnimConfig(raw);
    } catch (e) { /* повреждённые данные — игнорируем */ }
  }
  applyAnimConfig(cfg) {
    const okFrame = f => (typeof f === 'number' && f >= 0 && f < this.sheet.frames.length) || (f && typeof f === 'object' && [f.sx, f.sy, f.sw, f.sh].every(Number.isFinite));
    for (const k of Object.keys(cfg || {})) {
      const a = cfg[k]; if (!a || !Array.isArray(a.frames) || !a.frames.length || !a.frames.every(okFrame)) continue;
      ANIMATIONS[k] = { frames: a.frames, fps: Util.clamp(+a.fps || 10, 1, 60), loop: a.loop !== false, ox: +a.ox || 0, oy: +a.oy || 0, scale: +a.scale || 1, note: a.note || 'пользовательская' };
    }
  }
  /* ---------- размер экрана ---------- */
  resize() {
    this.dprCap = this.dprCap || 2;
    this.dpr = this.settings.lowFx ? 1 : Math.min(window.devicePixelRatio || 1, this.dprCap);
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.canvas.width = Math.round(this.W * this.dpr); this.canvas.height = Math.round(this.H * this.dpr);
    this.cam.resize(this.W, this.H, this.settings.zoom);
    if (this.world && this.state !== 'menu') this.cam.snap(this.world.player, this.world);
    this.editor.resize();
  }
  toggleFullscreen() {
    try {
      const d = document, el = d.documentElement;
      if (!d.fullscreenElement && !d.webkitFullscreenElement) (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
      else (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    } catch (e) { this.ui.toast('Полноэкранный режим недоступен'); }
  }
  /* ---------- состояния ---------- */
  onEsc() {
    if (this.state === 'playing') this.pause();
    else if (this.state === 'paused') this.resume();
    else if (this.state === 'menu' && ['levels', 'controls', 'settings'].includes(this.ui.current)) { const b = { levels: 'lvBack', controls: 'cBack', settings: 'sBack' }[this.ui.current]; document.getElementById(b).click(); }
  }
  continueGame() { const d = this.save.data; this.startLevel({ kind: 'main', index: Math.min(d.lastLevel, d.unlocked - 1, LEVELS.length - 1) }); }
  startLevel(ref) {
    this.run = ref;
    const level = ref.kind === 'main' ? LEVELS[ref.index] : ref.level;
    const prev = ref.kind === 'main' ? this.save.collectedSet(ref.index) : new Set();
    this.world = new World(level, { prevCollected: prev }); this.world.paperFill = this.paperPat;
    this.accum = 0; this.finishT = 0; this.completeShown = false; this.particles.clear(); this.input.clear();
    this.cam.resize(this.W, this.H, this.settings.zoom); this.cam.snap(this.world.player, this.world);
    if (ref.kind === 'main') { this.save.data.lastLevel = ref.index; this.save.save(); }
    this.state = 'playing'; this.input.enabled = true; this.ui.hideAll(); this.ui.showHud(true); this._hudReset();
    this.ui.toast(level.name, 1800);
    this.last = performance.now();
  }
  _hudReset() { this.ui._h = {}; }
  restartLevel() { if (this.run) this.startLevel(this.run); }
  nextLevel() { if (this.run && this.run.kind === 'main' && this.run.index + 1 < LEVELS.length) this.startLevel({ kind: 'main', index: this.run.index + 1 }); }
  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused'; this.input.clear(); this.input.enabled = false; this.audio.setSawLevel(0);
    document.getElementById('pEditor').style.display = this.run && this.run.fromEditor ? '' : 'none';
    this.ui.show('pause'); this.ui.updateTouchVisibility();
  }
  resume() { if (this.state !== 'paused') return; this.state = 'playing'; this.input.enabled = true; this.accum = 0; this.ui.hideAll(); this.ui.updateTouchVisibility(); this.last = performance.now(); }
  toMenu() { this.state = 'menu'; this.world = null; this.input.clear(); this.audio.setSawLevel(0); this.ui.showHud(false); this.ui.show('menu'); }
  completeExit() { if (this.run && this.run.fromEditor) this.backToEditor(); else this.toMenu(); }
  quickRespawn() { if (this.state === 'playing' && this.world && !this.world.player.dead && !this.world.finished) { this.world.respawn(); this.cam.slow = 0.5; this.audio.play('respawn'); } }
  /* ---------- редактор / инспектор ---------- */
  openEditor(level, customIndex) {
    this.state = 'editor'; this.world = null; this.input.clear(); this.input.enabled = false; this.audio.setSawLevel(0);
    this.ui.hideAll(); this.ui.showHud(false); document.getElementById('editorUI').classList.remove('hidden'); this.editor.open(level, customIndex);
  }
  backToEditor() {
    this.state = 'editor'; this.world = null; this.input.clear(); this.input.enabled = false; this.audio.setSawLevel(0);
    this.ui.hideAll(); this.ui.showHud(false); document.getElementById('editorUI').classList.remove('hidden'); this.editor.resume();
  }
  closeEditor() { document.getElementById('editorUI').classList.add('hidden'); this.toMenu(); }
  testFromEditor(level) { document.getElementById('editorUI').classList.add('hidden'); this.startLevel({ kind: 'custom', level, fromEditor: true }); }
  openInspector() { this.state = 'inspector'; this.ui.hideAll(); this.inspector.open(); }
  closeInspector() { this.inspector.close(); this.toMenu(); }
  /* ---------- главный цикл ---------- */
  frame(now) {
    requestAnimationFrame(t => this.frame(t));
    let dt = (now - this.last) / 1000; this.last = now; this.autoRes(dt); if (!(dt > 0)) dt = 0; if (dt > PHYS.maxFrame) dt = PHYS.maxFrame;
    this._ft += dt; this._fc++; if (this._ft > 0.5) { this.fps = Math.round(this._fc / this._ft); this._fc = 0; this._ft = 0; }
    this.ha.update(dt);
    try {
      if (this.state === 'playing') this.updatePlay(dt);
      else if (this.state === 'complete') this.updateVisual(dt);
      else if (this.state === 'editor') this.editor.update(dt);
      this.draw(dt);
    } catch (e) { console.error(e); this.errCount = (this.errCount || 0) + 1; if (this.errCount === 1) this.ui.toast('Ошибка: ' + e.message, 5000); }
  }
  /** авто-разрешение: если на слабом телефоне кадр стабильно дольше ~26 мс, плавно снижаем разрешение холста (2 → 1.5 → 1.25 → 1) */
  autoRes(raw) {
    if (this.state !== 'playing' || raw > 0.25 || document.hidden) { this._slow = 0; return; }
    this._slow = raw > 0.026 ? (this._slow || 0) + raw : Math.max(0, (this._slow || 0) - raw * 2);
    if (this._slow > 1.5 && this.dpr > 1.01) {
      const steps = [2, 1.5, 1.25, 1], next = steps.find(v => v < this.dpr - 0.01) || 1;
      this.dprCap = next; this._slow = 0; this.resize();
    }
  }
  updatePlay(dt) {
    const w = this.world; this.accum += dt;
    let guard = 0;
    while (this.accum >= PHYS.dt && guard++ < 40) { w.step(PHYS.dt, this.input.snapshot()); this.accum -= PHYS.dt; }
    this.handleEvents(); this.updateVisual(dt);
    const p = w.player;
    if (p.dead && p.deathT > 0.95) { w.respawn(); this.cam.slow = 0.55; this.cam.snapY = true; }
    if (w.finished) { this.finishT += dt; if (this.finishT > 1.5 && !this.completeShown) this.completeLevel(); }
    this.audio.setSawLevel(Util.clamp(1 - w.nearSaw / 520, 0, 1));
    this.ui.hud(w, this.run.kind === 'main' ? LEVELS[this.run.index].name : (this.run.level.name || 'Мой уровень'), this.run.kind === 'main' ? this.run.index : null);
  }
  updateVisual(dt) {
    const w = this.world; if (!w) return;
    w.player.updateAnim(dt, null); this.particles.update(dt);
    this.cam.update(dt, w.player, w);
    if (this.state === 'complete' && this.run && this.run.kind === 'main' && this.run.index === LEVELS.length - 1) this.confetti(dt);
  }
  confetti(dt) {
    const v = this.cam.view(0), cols = ['#f2b82a', '#d4352c', '#2b4fb8', '#2f8f4e', '#e8711a'];
    if (Math.random() < dt * 60) this.particles.spawn(v.x + Math.random() * v.w, v.y - 10, (Math.random() - 0.5) * 120, 80 + Math.random() * 120, 3.5, 7 + Math.random() * 6, cols[(Math.random() * 5) | 0], 1, 120);
  }
  handleEvents() {
    const w = this.world, ev = w.events, A = this.audio, P = this.particles, p = w.player;
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i], d = e.data;
      switch (e.name) {
        case 'jump': A.play('jump'); P.burst(p.cx, p.y + p.h, 4, { up: true, spread: 2.6, speed: 90, life: 0.35, size: 3, col: INK.pencil, g: 300 }); break;
        case 'walljump': A.play('walljump'); P.burst(p.cx - p.facing * 14, p.cy, 5, { speed: 110, life: 0.3, size: 3, col: INK.pencil, g: 200 }); break;
        case 'land': A.play('land'); P.burst(p.cx, p.y + p.h, 7, { up: true, spread: 3, speed: 150, life: 0.4, size: 3, col: INK.pencil, g: 400, rx: 18 }); break;
        case 'slide': A.play('slide'); break;
        case 'coin': A.play('coin'); P.burst(d.x, d.y, 7, { speed: 150, life: 0.5, size: 4, col: INK.yellow, g: 200 }); break;
        case 'bigcoin': A.play('bigcoin'); P.burst(d.x, d.y, 12, { speed: 200, life: 0.6, size: 5, col: INK.yellow, g: 200 }); P.ring(d.x, d.y, INK.yellow, 12); break;
        case 'secret': A.play('secret'); P.burst(d.x, d.y, 18, { speed: 240, life: 0.8, size: 5, col: INK.blue, g: 120 }); P.ring(d.x, d.y, INK.blue, 14); this.ui.toast('✦ Секретная монета!', 1800); break;
        case 'reveal': A.play('checkpoint'); this.ui.toast('Секретная комната!', 1600); break;
        case 'checkpoint': A.play('checkpoint'); P.ring(d.x, d.y - 40, INK.green, 10); P.burst(d.x, d.y - 60, 8, { speed: 130, life: 0.6, size: 4, col: INK.green, g: 100 }); this.ui.toast('⚑ Контрольная точка', 1400); break;
        case 'death': A.play('death'); P.burst(p.cx, p.cy, 22, { speed: 330, life: 0.8, size: 5, col: INK.black, g: 700 }); P.burst(p.cx, p.cy, 10, { speed: 260, life: 0.7, size: 5, col: '#e8711a', g: 600 }); if (!this.settings.lowFx) this.cam.shake(9, 0.3); break;
        case 'respawn': A.play('respawn'); P.ring(p.cx, p.y + p.h - 6, INK.black, 8); break;
        case 'break': A.play('break'); if (d && d.w) P.burst(d.x + d.w / 2, d.y + d.h / 2, 10, { speed: 160, life: 0.8, size: 7, col: '#fff', type: 1, g: 800, rx: d.w * 0.8 }); break;
        case 'slam': A.play('slam'); if (!this.settings.lowFx) this.cam.shake(7, 0.3); P.burst(d.x + d.w / 2, d.y + d.h, 10, { up: true, spread: 3, speed: 200, life: 0.5, size: 4, col: INK.pencil, g: 500, rx: d.w }); break;
        case 'dart': if (Math.hypot(d.x - p.cx, d.y - p.cy) < 650) A.play('dart'); break;
        case 'plate': A.play('plate'); break;
        case 'spring': A.play('spring'); P.ring(p.cx, p.y + p.h, '#e8a01a', 8); break;
        case 'finish': A.play('finish'); P.burst(d.x, d.y - 60, 24, { speed: 300, life: 1, size: 6, col: INK.yellow, g: 300 }); break;
        case 'crack': break;
      }
    }
    ev.length = 0;
  }
  completeLevel() {
    this.completeShown = true; this.state = 'complete'; this.input.clear(); this.input.enabled = false; this.audio.play('victory'); this.audio.setSawLevel(0);
    const w = this.world, run = this.run, res = { time: w.runTime, deaths: w.deaths, coinCount: w.coinCount, coinIds: w.coinIds, secretIds: w.secretIds, totalSecrets: w.coins.filter(c => c.kind === 'secret').length };
    const o = { main: run.kind === 'main', index: run.index, test: !!run.fromEditor };
    if (run.kind === 'main') {
      const r = this.save.completeLevel(run.index, res, LEVELS.length); o.gained = r.gained; o.newBest = r.newBest; o.bestTime = this.save.data.done[run.index].time;
      this.save.data.totalDeaths += w.deaths; this.save.save();
      o.newAch = this.checkAchievements(res); o.totalCoins = this.save.data.coins; o.totalDeaths = this.save.data.totalDeaths;
    }
    this.ui.showComplete(res, o); this.ui.updateTouchVisibility();
  }
  checkAchievements(res) {
    const d = this.save.data, secrets = Object.values(d.secrets).reduce((a, b) => a + b.length, 0);
    const c = { done: Object.keys(d.done).length, doneRange: (a, b) => { for (let i = a; i <= b; i++) if (!d.done[i]) return false; return true; }, lastDeaths: res ? res.deaths : -1, coins: d.coins, secrets, best0: d.done[0] ? d.done[0].time : 0, custom: d.custom.length };
    const got = [];
    for (const a of ACHIEVEMENTS) if (!d.ach[a.id] && a.test(c)) { d.ach[a.id] = true; got.push(a.title); }
    if (got.length) this.save.save();
    return got;
  }
  /* ---------- отрисовка ---------- */
  /** Кэш фона под текущий масштаб: бумага и каракули заранее масштабируются до целых пикселей устройства,
      поэтому каждый кадр это несколько быстрых blit'ов без пересэмплирования (картинка не меняется). */
  bgCache(z, dz) {
    const key = z.toFixed(3) + '|' + dz.toFixed(3); this._bg = this._bg || {};
    if (this._bg[key]) return this._bg[key];
    const mk = (src, w) => { const c = document.createElement('canvas'); c.width = c.height = w; const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, w, w); return c; };
    const e = { tile: mk(Paper.tile, Math.max(64, Math.round(512 * z))), tw: Math.max(64, Math.round(512 * z)), doodle: null };
    const dw = Math.round(1024 * dz);
    if (Paper.doodle && dw >= 64 && dw <= 2048) e.doodle = mk(Paper.doodle, dw);
    this._bg = { [key]: e }; return e;            // хранится только один набор — память не растёт
  }
  /** Фон в экранных координатах. ox, oy — мировая точка в левом верхнем углу экрана; z — пикселей устройства на мировую единицу */
  drawBackdrop(ctx, ox, oy, z, doodles, ruled, dox, doy) {
    const W = this.canvas.width, H = this.canvas.height, bg = this.bgCache(z, z * 0.9);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
    const vw = W / z, vh = H / z, T = 512;
    const i0 = Math.floor(ox / T), i1 = Math.floor((ox + vw) / T), j0 = Math.floor(oy / T), j1 = Math.floor((oy + vh) / T);
    for (let i = i0; i <= i1; i++) { const x0 = Math.round((i * T - ox) * z), x1 = Math.round(((i + 1) * T - ox) * z);
      for (let j = j0; j <= j1; j++) { const y0 = Math.round((j * T - oy) * z), y1 = Math.round(((j + 1) * T - oy) * z); ctx.drawImage(bg.tile, x0, y0, x1 - x0, y1 - y0); } }
    if (ruled) {
      ctx.strokeStyle = 'rgba(120,160,215,0.20)'; ctx.lineWidth = Math.max(1, Math.round(1.2 * z)); ctx.beginPath();
      for (let k = Math.floor((oy - 55.5) / 56); k * 56 + 55.5 <= oy + vh; k++) { const y = Math.round(((k * 56 + 55.5) - oy) * z) + 0.5; ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
    }
    if (doodles && bg.doodle) {
      const D = bg.doodle.width, dx = -Math.round((dox * 0.5 * z) % D), dy = -Math.round((doy * 0.5 * z) % D);
      for (let x = dx - D; x < W; x += D) for (let y = dy - D; y < H; y += D) ctx.drawImage(bg.doodle, x, y);
    }
  }
  drawPaper(ctx, view) {
    const cam = this.cam, z = cam.zoom * this.dpr, lo = this.settings.lowFx;
    this.drawBackdrop(ctx, cam.x - cam.vw / 2 - cam.sx, cam.y - cam.vh / 2 - cam.sy, z, !lo, !lo, cam.x, cam.y);
  }
  drawDoodles() { /* каракули теперь рисуются вместе с фоном в drawBackdrop */ }
  draw(dt) {
    const ctx = this.ctx, dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = INK.paper; ctx.fillRect(0, 0, this.W, this.H);
    if (this.state === 'editor') { this.editor.draw(ctx); this.drawFps(ctx); return; }
    if (this.world && ['playing', 'paused', 'complete'].includes(this.state)) {
      const cam = this.cam, w = this.world, view = cam.view(80);
      this.drawPaper(ctx, view); cam.apply(ctx, dpr);
      this.drawWorldEdges(ctx, w, view);
      w.draw(ctx, this.ha, this.sheet, cam.view(120)); this.particles.draw(ctx);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    } else this.drawMenuScene(ctx, dt || 0);
    this.drawFps(ctx);
  }
  drawFps(ctx) { if (location.hash.indexOf('fps') >= 0) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.font = '14px monospace'; ctx.fillText(this.fps + ' fps', 8, this.H - 8); } }
  drawWorldEdges(ctx, w, view) {
    ctx.save(); ctx.lineWidth = 3; ctx.setLineDash([14, 10]);
    ctx.strokeStyle = 'rgba(212,53,44,.45)'; ctx.beginPath(); ctx.moveTo(0, view.y); ctx.lineTo(0, view.y + view.h); ctx.stroke();
    ctx.strokeStyle = 'rgba(43,79,184,.45)'; ctx.beginPath(); ctx.moveTo(w.w, view.y); ctx.lineTo(w.w, view.y + view.h); ctx.stroke(); ctx.setLineDash([]);
    if (view.y + view.h > w.h) { ctx.fillStyle = 'rgba(27,27,33,.14)'; ctx.fillRect(view.x, w.h + 40, view.w, view.y + view.h - w.h); }
    ctx.restore();
  }
  /** фон главного меню: бумага, каракули, рисованный пол и бегущий стикмен */
  drawMenuScene(ctx, dt) {
    const W = this.W, H = this.H, m = this.menu; m.t += dt;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawBackdrop(ctx, 0, 0, this.dpr, !this.settings.lowFx, false, m.t * 40, 0);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const floorY = Math.round(H * 0.82);
    const v = this.ha.get('menu|' + Math.round(W), 3, Art.platform('solid', Math.round(W) + 40, 60)); ctx.save(); ctx.translate(-20, floorY); HandDrawnAnimator.render(ctx, v[this.ha.variant(HAND_FPS.platform, 0, 3)]); ctx.restore();
    if (!this.sheet.ready) return;
    // бегущий стикмен (только пока видно главное меню/уровни)
    const sc = PLAYER_CONFIG.spriteScale * 1.6, a = m.anim;
    m.x += 150 * dt; if (m.x > W + 80) { m.x = -80; }
    let y = floorY;
    const cyc = (m.t % 4);
    if (cyc > 2.6 && cyc < 3.3) { const u = (cyc - 2.6) / 0.7; y -= Math.sin(u * Math.PI) * 90; a.play(u < 0.5 ? 'jump' : 'fall'); } else a.play('run');
    a.speed = 1; a.update(dt);
    ctx.save(); ctx.imageSmoothingEnabled = false; this.sheet.draw(ctx, a.frame, m.x, y, sc, false); ctx.restore();
  }
}
