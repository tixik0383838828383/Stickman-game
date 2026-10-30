/* main.js — точка входа */
'use strict';
window.addEventListener('load', () => {
  // ждём встроенный шрифт (не дольше 1.5 с), чтобы первая отрисовка сразу была нужным шрифтом
  const fontReady = (document.fonts && document.fonts.load) ? Promise.race([document.fonts.load('24px Neucha'), new Promise(r => setTimeout(r, 1500))]).catch(() => {}) : Promise.resolve();
  fontReady.then(() => {
    const game = new Game(); window.__game = game;      // доступ из консоли для отладки/автотестов
    game.init().catch(e => { console.error(e); alert('Ошибка запуска: ' + e.message); });
  });
});
