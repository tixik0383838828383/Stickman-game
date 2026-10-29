const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
(async () => {
  const lvl = +process.argv[2] - 1, acts = JSON.parse(fs.readFileSync(process.argv[3])), out = process.argv[4];
  fs.rmSync('/tmp/vid', { recursive: true, force: true });
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 960, height: 540 }, recordVideo: { dir: '/tmp/vid', size: { width: 960, height: 540 } } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('dist/stickman_paper_parkour.html') + '#all'); await p.waitForTimeout(800);
  await p.evaluate(({ lvl, acts }) => {
    const g = __game; g.startLevel({ kind: 'main', index: lvl });
    let n = 0, pj = 0, pd = 0; window.__n = 0;
    g.input.snapshot = () => {
      const m = Math.floor(n / 6), i = n % 6, a = acts[Math.min(m, acts.length - 1)]; n++; window.__n = n;
      if (m >= acts.length) return { left: false, right: false, jump: false, down: false, jumpPressed: false, downPressed: false };
      const o = { left: !!a[0], right: !!a[1], jump: !!a[2], down: !!a[3], jumpPressed: i === 0 && !!a[2] && !pj, downPressed: i === 0 && !!a[3] && !pd };
      if (i === 5) { pj = a[2]; pd = a[3]; }
      return o;
    };
  }, { lvl, acts });
  const t0 = Date.now(); let st;
  while (Date.now() - t0 < 120000) { await p.waitForTimeout(500); st = await p.evaluate(() => ({ s: __game.state, d: __game.world.deaths, f: __game.world.finished, t: __game.world.runTime.toFixed(1) })); if (st.s === 'complete') break; }
  await p.waitForTimeout(1500); console.log(JSON.stringify(st), errs);
  await ctx.close(); const f = fs.readdirSync('/tmp/vid')[0]; fs.copyFileSync('/tmp/vid/' + f, out.replace('.mp4', '.webm')); await b.close();
})();
