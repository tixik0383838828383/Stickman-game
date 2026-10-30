const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2 })).newPage(); const e = []; p.on('pageerror', x => e.push(x.message));
  await p.goto('file://' + path.resolve('dist/stickman_paper_parkour.html') + '#all'); await p.waitForTimeout(700);
  console.log('Neucha loaded:', await p.evaluate(() => document.fonts.check('20px Neucha') && Array.from(document.fonts).filter(f => f.family.includes('Neucha') && f.status === 'loaded').length));
  await p.screenshot({ path: '/tmp/f_menu.png' });
  await p.evaluate(() => __game.startLevel({ kind: 'main', index: 0 })); await p.waitForTimeout(700); await p.screenshot({ path: '/tmp/f_play.png' });
  await p.evaluate(() => { __game.toMenu(); __game.ui.show('levels'); __game.ui.buildLevelGrid(); }); await p.waitForTimeout(500);
  // прокрутка до конца: нет ли ошибок, элементы без transform
  const r = await p.evaluate(async () => { const g = document.getElementById('levelGrid'); g.scrollTop = 1e6; await new Promise(r => setTimeout(r, 700)); const tr = Array.from(g.querySelectorAll('.lvl')).filter(x => getComputedStyle(x).transform !== 'none').length; return { top: g.scrollTop, max: g.scrollHeight - g.clientHeight, rotated: tr }; });
  console.log(r, e); await p.screenshot({ path: '/tmp/f_levels.png' }); await b.close(); })();
