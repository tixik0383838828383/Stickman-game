const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1100, height: 650 }, hasTouch: true });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto('file://' + require('path').resolve('dist/stickman_paper_parkour.html') + '#all'); await p.waitForTimeout(800);
  const R = {};
  await p.evaluate(() => window.__game.startLevel({kind:'main',index:0})); await p.waitForTimeout(500);
  R.x0 = await p.evaluate(() => window.__game.world.player.x);
  await p.keyboard.down('d'); await p.waitForTimeout(1200); R.x1 = await p.evaluate(() => window.__game.world.player.x);
  await p.keyboard.press('Space'); await p.waitForTimeout(150); R.vy = await p.evaluate(() => window.__game.world.player.vy);
  await p.keyboard.up('d'); await p.waitForTimeout(600);
  await p.screenshot({ path: '/tmp/s_play.png' });
  // pause
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  const a = await p.evaluate(() => window.__game.world.player.x); await p.waitForTimeout(500);
  R.pausedStable = a === await p.evaluate(() => window.__game.world.player.x);
  R.state = await p.evaluate(() => window.__game.state);
  await p.screenshot({ path: '/tmp/s_pause.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  // all levels start without error + screenshots
  for (let i = 0; i < 12; i++) { await p.evaluate(i => window.__game.startLevel({kind:'main',index:i}), i); await p.waitForTimeout(400); if (i % 4 === 0 || i === 5) await p.screenshot({ path: `/tmp/s_l${i + 1}.png` }); }
  // inspector + editor
  await p.evaluate(() => window.__game.toMenu()); await p.evaluate(() => window.__game.openInspector()); await p.waitForTimeout(500);
  await p.screenshot({ path: '/tmp/s_insp.png' });
  await p.evaluate(() => window.__game.closeInspector()); await p.evaluate(() => window.__game.openEditor && window.__game.openEditor(null)); await p.waitForTimeout(500);
  await p.screenshot({ path: '/tmp/s_edit.png' });
  console.log(JSON.stringify(R), 'errors:', errs);
  await b.close();
})();
