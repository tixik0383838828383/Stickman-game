/* main.js — точка входа */
'use strict';
window.addEventListener('load', () => {
  const game = new Game(); window.__game = game;      // доступ из консоли для отладки/автотестов
  game.init().catch(e => { console.error(e); alert('Ошибка запуска: ' + e.message); });
});
