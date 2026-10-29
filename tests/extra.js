const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 915, height: 412 } })).newPage(); const e = []; p.on('pageerror', x => e.push(x.message));
  await p.goto('file://' + path.resolve('dist/stickman_paper_parkour.html')); await p.waitForTimeout(500);
  await p.evaluate(() => { __game.ui.show('levels'); __game.ui.buildLevelGrid(); });
  const t = await p.evaluate(() => Array.from(document.querySelectorAll('#levelGrid .lvl')).filter(x => /11б/.test(x.textContent)).map(x => { x.click(); return x.textContent; }));
  await p.waitForTimeout(600); console.log(t, await p.evaluate(() => [__game.state, __game.run.kind, __game.world.player.x]), e); await b.close(); })();
