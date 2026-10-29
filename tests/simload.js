/* Загрузка игровой логики (без DOM) в Node для автотестов: тот же код, что и в браузере. */
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const files = ['config', 'util', 'spritesheet', 'drawing', 'entities', 'player', 'physics', 'world', 'levels'];
function load(extra) {
  const ctx = { console, Math, JSON, Object, Array, Set, Map, Float32Array, performance: { now: () => 0 }, window: {}, document: {}, Path2D: function () {}, setTimeout, module: undefined };
  vm.createContext(ctx);
  let code = '';
  for (const f of files) { const p = path.join(root, 'js', f + '.js'); if (fs.existsSync(p)) code += '\n;' + fs.readFileSync(p, 'utf8').replace(/^'use strict';/m, ''); }
  code += '\n;this.__x = { World, PhysicsEngine, NO_INPUT, PLAYER_CONFIG, PHYS, Util, Platform, Crate, Saw, Spike, EntityFactory, Player, LEVELS: (typeof LEVELS!=="undefined"?LEVELS:null), EXTRA_LEVELS: (typeof EXTRA_LEVELS!=="undefined"?EXTRA_LEVELS:[]) };';
  vm.runInContext(code, ctx, { filename: 'game-bundle.js' });
  return ctx.__x;
}
module.exports = { load };
