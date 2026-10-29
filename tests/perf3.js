const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.6, hasTouch: true, isMobile: true });
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await p.goto('file://' + path.resolve(process.argv[2] || 'dist/stickman_paper_parkour.html') + '#all'); await p.waitForTimeout(800);
  const res = await p.evaluate(async () => {
    const g = __game; const out = {};
    const flush = () => g.ctx.getImageData(0, 0, 1, 1);
    const bench = (name, fn) => { for (let k = 0; k < 5; k++) { fn(); flush(); } const a = []; for (let k = 0; k < 25; k++) { const t = performance.now(); fn(); flush(); a.push(performance.now() - t); } a.sort((x, y) => x - y); out[name] = a[12].toFixed(1); };
    for (const lv of [0, 3, 8]) {
      g.startLevel({ kind: 'main', index: lv }); await new Promise(r => setTimeout(r, 1200)); g.state = 'paused';
      const ctx = g.ctx, dpr = g.dpr, cam = g.cam, w = g.world;
      const base = () => { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#f4efe0'; ctx.fillRect(0, 0, g.W, g.H); };
      bench(`L${lv + 1} clear`, base);
      bench(`L${lv + 1} paper`, () => { base(); cam.apply(ctx, dpr); g.drawPaper(ctx, cam.view(80)); });
      bench(`L${lv + 1} doodles`, () => { base(); g.drawDoodles(ctx, cam.x, cam.y, cam.zoom); });
      bench(`L${lv + 1} world`, () => { base(); cam.apply(ctx, dpr); w.draw(ctx, g.ha, g.sheet, cam.view(120)); });
      bench(`L${lv + 1} full`, () => g.draw(0));
    }
    return out;
  });
  console.log(res); await b.close();
})();
