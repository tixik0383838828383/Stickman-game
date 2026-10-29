const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.6, hasTouch: true, isMobile: true });
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await p.goto('file://' + path.resolve(process.argv[2] || 'dist/stickman_paper_parkour.html') + '#all'); await p.waitForTimeout(800);
  for (const lv of [0, 3, 8]) {
    const r = await p.evaluate(async i => {
      const g = __game; g.startLevel({ kind: 'main', index: i }); await new Promise(r => setTimeout(r, 1500));
      const T = {}; const wrap = (o, n, f) => { const orig = o[f].bind(o); o[f] = function () { const t = performance.now(); const r = orig.apply(null, arguments); T[n] = (T[n] || []).concat(performance.now() - t); return r; }; };
      wrap(g, 'paper', 'drawPaper'); wrap(g, 'doodles', 'drawDoodles'); wrap(g.world, 'world', 'draw'); wrap(g.particles, 'part', 'draw'); wrap(g, 'edges', 'drawWorldEdges');
      await new Promise(r => setTimeout(r, 2500));
      const o = {}; for (const k in T) { const a = T[k].slice(5).sort((x, y) => x - y); o[k] = a[a.length >> 1].toFixed(1); } return o;
    }, lv);
    console.log('L' + (lv + 1), JSON.stringify(r));
  }
  await b.close();
})();
