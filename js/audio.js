/* audio.js — AudioManager: процедурные звуки через Web Audio API.
   AudioContext создаётся только после первого действия пользователя. */
'use strict';
class AudioManager {
  constructor(settings) {
    this.s = settings; this.ctx = null; this.master = null; this.sawGain = null; this.last = {};
  }
  /** вызывать из обработчика пользовательского события */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
        this._buildSaw();
      } catch (e) { this.ctx = null; return; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.applySettings();
  }
  applySettings() { if (this.master) this.master.gain.value = this.s.sound ? this.s.volume : 0; }
  _noiseBuffer(sec) {
    const n = Math.floor(this.ctx.sampleRate * sec), b = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  _buildSaw() {
    const src = this.ctx.createBufferSource(); src.buffer = this._noiseBuffer(1.5); src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 3;
    this.sawGain = this.ctx.createGain(); this.sawGain.gain.value = 0;
    src.connect(f); f.connect(this.sawGain); this.sawGain.connect(this.master); src.start();
  }
  /** громкость тихого цикла пил (0..1), зависит от расстояния до ближайшей */
  setSawLevel(v) { if (this.sawGain && this.ctx) this.sawGain.gain.setTargetAtTime(v * 0.05, this.ctx.currentTime, 0.08); }
  _tone(freq, dur, type = 'square', vol = 0.15, slideTo = null, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  _noise(dur, vol = 0.2, freq = 1200, type = 'lowpass', delay = 0) {
    const c = this.ctx, t = c.currentTime + delay, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this._noiseBuffer(dur + 0.05); f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t);
  }
  /** name: jump land coin bigcoin secret checkpoint death respawn break finish victory click spring walljump plate dart laser slide */
  play(name) {
    if (!this.ctx || !this.s.sound) return;
    const now = performance.now();
    if (this.last[name] && now - this.last[name] < 45) return; // защита от «спама» звуком
    this.last[name] = now;
    switch (name) {
      case 'jump': this._tone(280, 0.14, 'square', 0.09, 560); break;
      case 'walljump': this._tone(340, 0.12, 'triangle', 0.12, 700); this._noise(0.05, 0.08, 2500); break;
      case 'land': this._noise(0.09, 0.14, 500); break;
      case 'coin': this._tone(880, 0.07, 'square', 0.08); this._tone(1320, 0.12, 'square', 0.08, null, 0.06); break;
      case 'bigcoin': this._tone(660, 0.08, 'square', 0.1); this._tone(990, 0.08, 'square', 0.1, null, 0.07); this._tone(1480, 0.16, 'square', 0.1, null, 0.14); break;
      case 'secret': [523, 659, 784, 1046, 1318].forEach((f, i) => this._tone(f, 0.16, 'triangle', 0.12, null, i * 0.08)); break;
      case 'checkpoint': [392, 523, 659].forEach((f, i) => this._tone(f, 0.14, 'triangle', 0.12, null, i * 0.07)); break;
      case 'death': this._noise(0.35, 0.22, 900); this._tone(420, 0.45, 'sawtooth', 0.12, 70); break;
      case 'respawn': this._tone(200, 0.3, 'sine', 0.14, 800); break;
      case 'break': this._noise(0.25, 0.2, 3000, 'highpass'); this._noise(0.2, 0.12, 400); break;
      case 'finish': [523, 784, 1046].forEach((f, i) => this._tone(f, 0.25, 'triangle', 0.13, null, i * 0.1)); break;
      case 'victory': [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this._tone(f, 0.2, 'square', 0.09, null, i * 0.11)); break;
      case 'click': this._tone(520, 0.05, 'square', 0.07, 380); break;
      case 'spring': this._tone(200, 0.25, 'sine', 0.2, 900); break;
      case 'plate': this._tone(150, 0.12, 'square', 0.14, 90); break;
      case 'dart': this._noise(0.12, 0.1, 3500, 'highpass'); break;
      case 'laser': this._tone(1100, 0.1, 'sawtooth', 0.05, 800); break;
      case 'slam': this._noise(0.3, 0.3, 300); this._tone(90, 0.25, 'sine', 0.3, 40); break;
      case 'slide': this._noise(0.12, 0.06, 2200, 'bandpass'); break;
    }
  }
}
