/* ui.js — UIManager: меню, HUD, настройки, пауза, экран завершения, тосты, достижения */
'use strict';
const WORLD_NAMES = ['Мир 1: Первые линии', 'Мир 2: Механическая каракуля', 'Мир 3: Ожившая бумага', 'Мир 4: Последний рисунок'];
const ACHIEVEMENTS = [
  { id: 'first', title: 'Первая линия', desc: 'Пройди любой уровень', test: c => c.done >= 1 },
  { id: 'w1', title: 'Первые линии', desc: 'Пройди уровни 1–3', test: c => c.doneRange(0, 2) },
  { id: 'w2', title: 'Механик', desc: 'Пройди уровни 4–6', test: c => c.doneRange(3, 5) },
  { id: 'w3', title: 'Оживший рисунок', desc: 'Пройди уровни 7–9', test: c => c.doneRange(6, 8) },
  { id: 'w4', title: 'Последняя страница', desc: 'Пройди все 12 уровней', test: c => c.doneRange(0, 11) },
  { id: 'clean', title: 'Чистый лист', desc: 'Пройди уровень без смертей', test: c => c.lastDeaths === 0 },
  { id: 'rich', title: 'Копилка', desc: 'Накопи 100 монет', test: c => c.coins >= 100 },
  { id: 'rich2', title: 'Сундук', desc: 'Накопи 250 монет', test: c => c.coins >= 250 },
  { id: 'secret', title: 'Исследователь', desc: 'Найди секретную монету', test: c => c.secrets >= 1 },
  { id: 'secret3', title: 'Кладоискатель', desc: 'Найди 3 секрета', test: c => c.secrets >= 3 },
  { id: 'fast', title: 'Скоростная каракуля', desc: 'Пройди уровень 1 быстрее 14 секунд', test: c => c.best0 > 0 && c.best0 < 14 },
  { id: 'editor', title: 'Художник', desc: 'Сохрани свой уровень в редакторе', test: c => c.custom >= 1 },
];

class UIManager {
  constructor(game) {
    this.g = game; this.$ = id => document.getElementById(id); this.current = null; this.settingsBack = 'menu'; this.toastT = 0; this.vtick = 0;
    this.screens = ['menu', 'levels', 'settings', 'controls', 'pause', 'complete'];
    this._bind(); this._settingsToDom(); this.applySettings();
    setInterval(() => this._wobble(), 280);   // «перерисовка» рамок интерфейса ~3.5 раза в секунду
  }
  /* ---------- экраны ---------- */
  show(name) {
    for (const s of this.screens) this.$(s).classList.toggle('show', s === name);
    this.current = name;
    if (name === 'menu') this.refreshMenu();
    if (name === 'levels') this.buildLevelGrid();
  }
  hideAll() { this.show(null); }
  toast(msg, ms) {
    const t = this.$('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(this._tt);
    this._tt = setTimeout(() => t.classList.remove('show'), ms || 2200);
  }
  confirm(text, yes) {
    const c = this.$('confirm'); this.$('cfText').textContent = text; c.classList.add('show');
    const close = () => { c.classList.remove('show'); };
    this.$('cfYes').onclick = () => { close(); yes(); }; this.$('cfNo').onclick = close;
  }
  _wobble() {
    const fx = this.g.settings; if (fx.handFx <= 0 || fx.lowFx || document.hidden) return;
    const els = document.querySelectorAll('.screen.show .btn, .screen.show .panel, .screen.show .lvl, .hud-box, #hud .hud-btn');
    for (const e of els) { let v = (+e.dataset.v || 0) + 1 + (Math.random() < 0.4 ? 1 : 0); e.dataset.v = v % 3; }
  }
  /* ---------- привязка кнопок ---------- */
  _bind() {
    const g = this.g, $ = this.$;
    const click = (id, fn) => $(id).addEventListener('click', e => { g.audio.unlock(); g.audio.play('click'); fn(e); });
    click('mContinue', () => g.continueGame());
    click('mPlay', () => g.startLevel({ kind: 'main', index: 0 }));
    click('mLevels', () => this.show('levels'));
    click('mSettings', () => { this.settingsBack = 'menu'; this.show('settings'); });
    click('mControls', () => this.show('controls'));
    click('mEditor', () => g.openEditor());
    click('mInspector', () => g.openInspector());
    click('lvBack', () => this.show('menu')); click('cBack', () => this.show('menu'));
    click('sBack', () => { g.save.save(); this.show(this.settingsBack); });
    click('pResume', () => g.resume());
    click('pRestart', () => g.restartLevel());
    click('pSettings', () => { this.settingsBack = 'pause'; this.show('settings'); });
    click('pEditor', () => g.backToEditor());
    click('pMenu', () => g.toMenu());
    click('cNext', () => g.nextLevel()); click('cAgain', () => g.restartLevel()); click('cMenu', () => g.completeExit());
    click('btnPause', () => g.pause());
    click('sFull', () => g.toggleFullscreen());
    click('sReset', () => this.confirm('Сбросить весь прогресс (уровни, монеты, рекорды, достижения)? Настройки и ваши уровни останутся.', () => { g.save.reset(); this.toast('Прогресс сброшен'); this.refreshMenu(); }));
    // настройки
    const s = g.settings, bindRange = (id, key, fmt, after) => {
      $(id).addEventListener('input', () => { s[key] = parseFloat($(id).value); const v = $('v' + id.slice(1)); if (v && fmt) v.textContent = fmt(s[key]); this.applySettings(); if (after) after(); g.save.save(); });
    };
    bindRange('sVolume', 'volume', null, () => g.audio.applySettings());
    bindRange('sHandFx', 'handFx', v => Math.round(v * 100) + '%', () => g.ha.clear());
    bindRange('sUi', 'uiScale', v => Math.round(v * 100) + '%');
    bindRange('sZoom', 'zoom', v => Math.round(v * 100) + '%', () => g.resize());
    bindRange('sTouchSize', 'touchSize', v => Math.round(v * 100) + '%');
    bindRange('sTouchOp', 'touchOpacity', v => Math.round(v * 100) + '%');
    $('sSound').addEventListener('change', () => { s.sound = $('sSound').checked; g.audio.applySettings(); g.save.save(); });
    $('sLowFx').addEventListener('change', () => { s.lowFx = $('sLowFx').checked; this.applySettings(); g.save.save(); });
    $('sShowTouch').addEventListener('change', () => { s.showTouch = $('sShowTouch').value; this.applySettings(); g.save.save(); });
    $('sParticles').addEventListener('change', () => { s.particles = $('sParticles').value; g.particles.setQuality(s.particles); g.save.save(); });
    // экранные кнопки
    g.input.bindTouch($('dpad'), $('btnJump'), $('btnDown'));
  }
  _settingsToDom() {
    const s = this.g.settings, $ = this.$;
    $('sVolume').value = s.volume; $('sSound').checked = s.sound; $('sHandFx').value = s.handFx; $('sUi').value = s.uiScale; $('sZoom').value = s.zoom;
    $('sTouchSize').value = s.touchSize; $('sTouchOp').value = s.touchOpacity; $('sShowTouch').value = s.showTouch; $('sParticles').value = s.particles; $('sLowFx').checked = s.lowFx;
  }
  applySettings() {
    const s = this.g.settings, $ = this.$, r = document.documentElement.style;
    r.setProperty('--ui', s.uiScale); r.setProperty('--tsize', s.touchSize); r.setProperty('--topac', s.touchOpacity);
    $('vHandFx').textContent = Math.round(s.handFx * 100) + '%'; $('vUi').textContent = Math.round(s.uiScale * 100) + '%'; $('vZoom').textContent = Math.round(s.zoom * 100) + '%';
    $('vTouchSize').textContent = Math.round(s.touchSize * 100) + '%'; $('vTouchOp').textContent = Math.round(s.touchOpacity * 100) + '%';
    this.updateTouchVisibility();
  }
  isTouchDevice() { return ('ontouchstart' in window) || navigator.maxTouchPoints > 0; }
  updateTouchVisibility() {
    const s = this.g.settings, playing = this.g.state === 'playing';
    const want = s.showTouch === 'on' || (s.showTouch === 'auto' && this.isTouchDevice());
    this.$('touch').classList.toggle('hidden', !(want && playing));
  }
  /* ---------- меню ---------- */
  refreshMenu() {
    const d = this.g.save.data, doneCount = Object.keys(d.done).length, $ = this.$;
    const has = doneCount > 0 || d.lastLevel > 0;
    $('mContinue').style.display = has ? '' : 'none';
    $('mContinue').textContent = 'Продолжить (уровень ' + (Math.min(d.lastLevel, LEVELS.length - 1) + 1) + ')';
    $('menuFoot').textContent = '🪙 ' + d.coins + '   ·   пройдено ' + doneCount + '/' + LEVELS.length + '   ·   достижения ' + Object.keys(d.ach).length + '/' + ACHIEVEMENTS.length + (this.g.save.persistent ? '' : '   ·   сохранения недоступны');
  }
  buildLevelGrid() {
    const g = this.g, d = g.save.data, grid = this.$('levelGrid'); grid.innerHTML = '';
    this.$('lvCoins').textContent = '🪙 Монеты: ' + d.coins + '   ·   достижения: ' + Object.keys(d.ach).length + '/' + ACHIEVEMENTS.length;
    const unlockAll = location.hash === '#all';
    LEVELS.forEach((L, i) => {
      if (i % 3 === 0) { const h = document.createElement('h3'); h.textContent = WORLD_NAMES[i / 3]; grid.appendChild(h); }
      const unlocked = unlockAll || i < d.unlocked, r = d.done[i], el = document.createElement('div');
      el.className = 'lvl' + (unlocked ? '' : ' locked');
      el.innerHTML = '<b>' + (i + 1) + '</b>' + L.name + '<small>' + (!unlocked ? '🔒 закрыт' : r ? '★ ' + Util.fmtTime(r.time) + ' · 🪙' + r.coins + ' · ☠' + r.deaths + (r.secrets ? ' · ✦' + r.secrets : '') : 'не пройден') + '</small>';
      el.onclick = () => { g.audio.unlock(); if (!unlocked) { g.audio.play('click'); this.toast('Сначала пройди предыдущий уровень'); return; } g.audio.play('click'); g.startLevel({ kind: 'main', index: i }); };
      grid.appendChild(el);
    });
    if (d.custom.length) {
      const h = document.createElement('h3'); h.textContent = 'Мои уровни'; grid.appendChild(h);
      d.custom.forEach((L, i) => {
        const el = document.createElement('div'); el.className = 'lvl'; el.innerHTML = '<b>✎</b>' + (L.name || 'Без названия') + '<small>нажми — играть · ✎ править · 🗑</small><span class="cust"><u data-a="e">✎</u> <u data-a="d">🗑</u></span>';
        el.onclick = ev => {
          g.audio.unlock(); g.audio.play('click'); const a = ev.target.dataset && ev.target.dataset.a;
          if (a === 'e') g.openEditor(JSON.parse(JSON.stringify(L)), i);
          else if (a === 'd') this.confirm('Удалить уровень «' + (L.name || 'Без названия') + '»?', () => { d.custom.splice(i, 1); g.save.save(); this.buildLevelGrid(); });
          else g.startLevel({ kind: 'custom', level: JSON.parse(JSON.stringify(L)) });
        };
        grid.appendChild(el);
      });
    }
    // список достижений
    const h = document.createElement('h3'); h.textContent = 'Достижения'; grid.appendChild(h);
    for (const a of ACHIEVEMENTS) { const el = document.createElement('div'); el.className = 'lvl' + (d.ach[a.id] ? '' : ' locked'); el.style.cursor = 'default'; el.innerHTML = '<b>' + (d.ach[a.id] ? '🏆' : '·') + '</b>' + a.title + '<small>' + a.desc + '</small>'; grid.appendChild(el); }
  }
  /* ---------- HUD ---------- */
  showHud(on) { this.$('hud').classList.toggle('hidden', !on); this.updateTouchVisibility(); }
  hud(world, name, index) {
    const $ = this.$; if (!this._h) this._h = {};
    const set = (k, el, v) => { if (this._h[k] !== v) { this._h[k] = v; $(el).textContent = v; } };
    set('l', 'hudLevel', (index !== null ? (index + 1) + '. ' : '') + name); set('c', 'hudCoins', String(world.coinCount)); set('d', 'hudDeaths', String(world.deaths));
    set('t', 'hudTime', Util.fmtTime(world.runTime));
    const on = world.cpIndex >= 0; if (this._h.cp !== on) { this._h.cp = on; $('hudCp').classList.toggle('on', on); }
  }
  /* ---------- экран завершения ---------- */
  showComplete(res, o) {
    const $ = this.$, last = o.main && o.index === LEVELS.length - 1;
    $('cTitle').textContent = last ? '🎉 ПОБЕДА! 🎉' : o.test ? 'Тест пройден!' : 'Уровень пройден!';
    const rows = [['Время', Util.fmtTime(res.time)], ['Монеты', String(res.coinCount) + (o.gained ? '  (+' + o.gained + ' в копилку)' : '')], ['Смерти', String(res.deaths)], ['Секреты', res.secretIds.length + ' / ' + res.totalSecrets]];
    if (o.main) rows.splice(1, 0, ['Рекорд', Util.fmtTime(o.bestTime)]);
    let html = rows.map(r => '<span>' + r[0] + '</span><b>' + r[1] + '</b>').join('');
    if (o.newBest) html += '<div class="full">★ Новый рекорд!</div>';
    if (o.newAch && o.newAch.length) html += '<div class="full">🏆 ' + o.newAch.join(', ') + '</div>';
    if (last) html += '<div class="full">Ты прошёл все 12 страниц! Всего монет: ' + o.totalCoins + ', смертей: ' + o.totalDeaths + '</div>';
    $('cStats').innerHTML = html;
    $('cNext').style.display = (o.main && !last) ? '' : 'none';
    $('cMenu').textContent = o.test ? 'Назад в редактор' : 'В меню';
    this.show('complete');
  }
}
