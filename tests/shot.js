const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch();
  for (const [name, f] of [['old', '/home/claude/stickman-game/index.html'], ['new', '/home/claude/proj/index.html']]) {
    const ctx = await b.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + f + '#all'); await p.waitForTimeout(600);
    await p.screenshot({ path: `/tmp/${name}_menu.png` });
    await p.evaluate(() => { __game.startLevel({ kind: 'main', index: 3 }); __game.world.player.x = 1000; __game.world.player.y = 600; __game.cam.snap(__game.world.player, __game.world); });
    await p.waitForTimeout(700); await p.evaluate(() => { __game.state = 'paused'; document.getElementById('pause').classList.add('hidden'); });
    await p.waitForTimeout(100); await p.screenshot({ path: `/tmp/${name}_play.png` }); console.log(name, errs);
  }
  await b.close();
})();
