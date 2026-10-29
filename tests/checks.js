const { chromium } = require('playwright'); const path = require('path');
const ok = (n, c, x) => console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x) : ''));
(async () => {
  const b = await chromium.launch(); const errs = [];
  const url = 'file://' + path.resolve('dist/stickman_paper_parkour.html') + '#all';
  const ctx = await b.newContext({ viewport: { width: 1100, height: 650 }, hasTouch: true });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(url); await p.waitForTimeout(600);
  const G = f => p.evaluate(f);
  const start = i => p.evaluate(i => window.__game.startLevel({ kind: 'main', index: i }), i);
  await start(0); await p.waitForTimeout(300);
  // death + respawn (checkpoint-less: spawn at start)
  await G(() => { const w = __game.world; w.killPlayer('test'); });
  await p.waitForTimeout(300); ok('death flag', await G(() => __game.world.player.dead));
  await p.waitForTimeout(1300); ok('respawn', await G(() => !__game.world.player.dead && __game.world.deaths === 1));
  // coin once
  const c0 = await G(() => { const w = __game.world, c = w.coins[0]; const n0 = w.coinCount; w.player.x = c.x; w.player.y = c.y; return n0; });
  await p.waitForTimeout(200);
  const c1 = await G(() => __game.world.coinCount); await p.waitForTimeout(300);
  const c2 = await G(() => __game.world.coinCount); ok('coin collected once', c1 > c0 && c2 === c1, [c0, c1, c2]);
  // frame-rate independence: sim time vs wall
  const t0 = await G(() => __game.world.time); await p.waitForTimeout(1000); const t1 = await G(() => __game.world.time);
  ok('sim speed ~1x', Math.abs((t1 - t0) - 1) < 0.15, t1 - t0);
  // touch multitouch: hold dpad right + jump
  const tc = await G(() => { const r = id => document.getElementById(id) && document.getElementById(id).getBoundingClientRect(); return { ids: Array.from(document.querySelectorAll('#touch *[id]')).map(e => e.id) }; });
  console.log('touch ids', tc.ids);
  // finish -> complete
  await G(() => { const w = __game.world, f = w.finishes[0], r = f.rect(); w.player.x = r.x + 5; w.player.y = r.y + 10; });
  await p.waitForTimeout(2200); ok('complete screen', await G(() => __game.state === 'complete'));
  ok('level2 unlocked & saved', await G(() => __game.save.data.done[0] != null));
  await p.screenshot({ path: '/tmp/s_complete.png' });
  await p.evaluate(() => document.getElementById('cNext').click()); await p.waitForTimeout(300);
  ok('next level loads', await G(() => __game.run.index === 1 && __game.state === 'playing'));
  // save persistence across reload
  await p.reload(); await p.waitForTimeout(600);
  ok('save persists', await G(() => !!__game.save.data.done[0] && __game.save.data.coins >= 1), await G(() => __game.save.data.coins));
  // pause stops sim
  // editor export/import
  await G(() => __game.openEditor(null)); await p.waitForTimeout(200);
  const ex = await G(() => { const e = __game.editor; const j = e.collect(); return JSON.stringify(j).length; });
  ok('editor collect', ex > 50, ex);
  // blocked storage
  const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await ctx2.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
  const q = await ctx2.newPage(); const e2 = []; q.on('pageerror', e => e2.push(e.message));
  await q.goto(url); await q.waitForTimeout(800);
  ok('works w/o storage', await q.evaluate(() => !!window.__game) && e2.length === 0, e2);
  await q.evaluate(() => __game.startLevel({ kind: 'main', index: 5 })); await q.waitForTimeout(600);
  await q.screenshot({ path: '/tmp/s_portrait.png' });
  // multitouch via CDP
  const cdp = await ctx2.newCDPSession(q);
  const rect = id => q.evaluate(id => { const r = document.getElementById(id).getBoundingClientRect(); return [r.x + r.width * .8, r.y + r.height / 2]; }, id);
  console.log('touch els', await q.evaluate(() => Array.from(document.querySelectorAll('[id]')).map(e => e.id).filter(i => /dpad|tJump|tDown|touch/i.test(i))));
  await b.close();
  console.log('errors:', errs);
})();
