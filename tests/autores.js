const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.6, hasTouch: true, isMobile: true });
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: +process.argv[2] });
  await p.goto('file://' + path.resolve('dist/stickman_paper_parkour.html') + '#all'); await p.waitForTimeout(500);
  await p.evaluate(() => __game.startLevel({ kind: 'main', index: 3 }));
  for (let i = 0; i < 6; i++) { await p.waitForTimeout(1500); console.log(await p.evaluate(() => ({ dpr: __game.dpr, fps: __game.fps }))); }
  console.log(errs); await b.close();
})();
