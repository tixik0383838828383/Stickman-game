const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.6, hasTouch: true, isMobile: true });
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await p.goto('file://' + path.resolve(process.argv[2] || 'dist/stickman_paper_parkour.html') + '#all'); await p.waitForTimeout(800);
  console.log(await p.evaluate(async () => {
    const g = __game, out = {}; const flush = () => g.ctx.getImageData(0, 0, 1, 1);
    for (const lv of [0, 3, 8]) {
      g.startLevel({ kind: 'main', index: lv }); await new Promise(r => setTimeout(r, 1200)); g.state = 'paused';
      const w = g.world, cam = g.cam, c = g.ctx, dpr = g.dpr, view = cam.view(120);
      const vis = e => { const b = e.bounds(); return b.x < view.x + view.w && b.x + b.w > view.x && b.y < view.y + view.h && b.y + b.h > view.y; };
      const groups = { plat: e => e instanceof Platform, spike: e => e instanceof Spike, hazard: e => e.hazard && !(e instanceof Spike), coin: e => e instanceof Coin, deco: e => e instanceof Deco || e instanceof TextNote };
      for (const n in groups) {
        const es = w.entities.filter(e => groups[n](e) && vis(e));
        const a = []; for (let k = 0; k < 20; k++) { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 50, 50); cam.apply(c, dpr); const t = performance.now(); for (const e of es) e.draw(c, g.ha, w); flush(); a.push(performance.now() - t); }
        a.sort((x, y) => x - y); out[`L${lv + 1} ${n}(${es.length})`] = a[10].toFixed(1);
      }
      const t = performance.now(); w.player.draw(c, g.sheet, g.ha, w.time); flush(); out[`L${lv + 1} player`] = (performance.now() - t).toFixed(1);
    }
    return JSON.stringify(out, null, 1);
  }));
  await b.close();
})();
