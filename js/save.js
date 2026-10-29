/* save.js — SaveManager: localStorage с проверкой данных и запасным режимом «только в памяти» */
'use strict';
class SaveManager {
  constructor() {
    this.persistent = true;
    this.data = this.load();
  }
  static defaults() {
    return {
      v: 1,
      unlocked: 1,            // сколько уровней открыто (подряд)
      done: {},               // idx -> {time, deaths, coins, secrets}
      coins: 0,               // постоянная валюта (за собранные впервые монеты)
      collected: {},          // idx -> [id монет, собранных ранее]
      secrets: {},            // idx -> [id секретов]
      ach: {},                // достижения
      settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
      lastLevel: 0,
      totalDeaths: 0,
      custom: [],             // пользовательские уровни (JSON)
    };
  }
  /** Приводит прочитанные данные к ожидаемому виду; мусор отбрасывается. */
  static sanitize(raw) {
    const d = SaveManager.defaults();
    if (!raw || typeof raw !== 'object') return d;
    const num = (v, def, lo = 0, hi = 1e9) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def);
    d.unlocked = Math.floor(num(raw.unlocked, 1, 1, 999));
    d.coins = Math.floor(num(raw.coins, 0));
    d.lastLevel = Math.floor(num(raw.lastLevel, 0, 0, 999));
    d.totalDeaths = Math.floor(num(raw.totalDeaths, 0));
    if (raw.done && typeof raw.done === 'object') {
      for (const k of Object.keys(raw.done)) {
        const r = raw.done[k];
        if (r && typeof r === 'object') d.done[k] = { time: num(r.time, 0), deaths: Math.floor(num(r.deaths, 0)), coins: Math.floor(num(r.coins, 0)), secrets: Math.floor(num(r.secrets, 0)) };
      }
    }
    for (const key of ['collected', 'secrets']) {
      if (raw[key] && typeof raw[key] === 'object') {
        for (const k of Object.keys(raw[key])) if (Array.isArray(raw[key][k])) d[key][k] = raw[key][k].filter(x => typeof x === 'string').slice(0, 500);
      }
    }
    if (raw.ach && typeof raw.ach === 'object') for (const k of Object.keys(raw.ach)) if (raw.ach[k] === true) d.ach[k] = true;
    if (raw.settings && typeof raw.settings === 'object') {
      const s = d.settings, r = raw.settings;
      s.volume = num(r.volume, s.volume, 0, 1);
      s.sound = r.sound !== false;
      s.handFx = num(r.handFx, s.handFx, 0, 2);
      s.uiScale = num(r.uiScale, s.uiScale, 0.7, 1.6);
      s.touchSize = num(r.touchSize, s.touchSize, 0.6, 1.8);
      s.touchOpacity = num(r.touchOpacity, s.touchOpacity, 0.15, 1);
      s.zoom = num(r.zoom, s.zoom, 0.7, 1.5);
      s.particles = ['low', 'med', 'high'].includes(r.particles) ? r.particles : s.particles;
      s.lowFx = !!r.lowFx;
      s.showTouch = ['auto', 'on', 'off'].includes(r.showTouch) ? r.showTouch : 'auto';
    }
    if (Array.isArray(raw.custom)) d.custom = raw.custom.filter(l => l && typeof l === 'object' && Array.isArray(l.obj)).slice(0, 30);
    return d;
  }
  load() {
    try {
      const txt = window.localStorage.getItem(GAME.saveKey);
      if (!txt) return SaveManager.defaults();
      return SaveManager.sanitize(JSON.parse(txt));
    } catch (e) {
      // повреждённые данные или заблокированное хранилище -> настройки по умолчанию
      try { window.localStorage.getItem('x'); } catch (e2) { this.persistent = false; }
      return SaveManager.defaults();
    }
  }
  save() {
    try { window.localStorage.setItem(GAME.saveKey, JSON.stringify(this.data)); this.persistent = true; }
    catch (e) { this.persistent = false; /* работаем без сохранений */ }
  }
  reset() {
    const keepSettings = this.data.settings, keepCustom = this.data.custom;
    this.data = SaveManager.defaults();
    this.data.settings = keepSettings; this.data.custom = keepCustom;
    this.save();
  }
  isDone(i) { return !!this.data.done[i]; }
  collectedSet(i) { return new Set(this.data.collected[i] || []); }
  /** Записывает результат прохождения. Возвращает информацию о награде. */
  completeLevel(i, res, totalLevels) {
    const d = this.data;
    const prev = d.done[i];
    const newBest = !prev || res.time < prev.time;
    // постоянные монеты: только впервые собранные id
    const had = new Set(d.collected[i] || []);
    let gained = 0;
    for (const c of res.coinIds) if (!had.has(c.id)) { had.add(c.id); gained += c.value; }
    d.collected[i] = Array.from(had);
    d.coins += gained;
    const sec = new Set(d.secrets[i] || []);
    for (const s of res.secretIds) sec.add(s);
    d.secrets[i] = Array.from(sec);
    d.done[i] = {
      time: newBest ? res.time : prev.time,
      deaths: prev ? Math.min(prev.deaths, res.deaths) : res.deaths,
      coins: Math.max(prev ? prev.coins : 0, res.coinCount),
      secrets: Math.max(prev ? prev.secrets : 0, res.secretIds.length),
    };
    d.unlocked = Math.max(d.unlocked, Math.min(totalLevels, i + 2));
    d.lastLevel = Math.min(totalLevels - 1, i + 1);
    this.save();
    return { gained, newBest };
  }
}
