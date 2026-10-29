const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.6, hasTouch: true, isMobile: true });
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: +(process.argv[3] || 4) });
  await p.goto('file://' + path.resolve(process.argv[2] || 'dist/stickman_paper_parkour.html') + '#all'); await p.waitForTimeout(800);
  for (const lv of [0, 3, 8, 10]) {
    await p.evaluate(i => { __game.startLevel({ kind: 'main', index: i }); window.__ft = []; const g = __game, o = g.draw.bind(g); g.draw = function () { const t = performance.now(); o(); window.__ft.push(performance.now() - t); }; }, lv);
    await p.waitForTimeout(3000);
    const r = await p.evaluate(() => { const a = window.__ft.slice(10).sort((x, y) => x - y); return { n: a.length, med: a[a.length >> 1].toFixed(1), p95: a[Math.floor(a.length * .95)].toFixed(1), dpr: __game.dpr, cw: __game.canvas.width, ch: __game.canvas.height }; });
    console.log('L' + (lv + 1), JSON.stringify(r));
  }
  await b.close();
})();
