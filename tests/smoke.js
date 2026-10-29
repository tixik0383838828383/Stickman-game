const { chromium } = require('playwright');
(async () => {
  const file = process.argv[2] || 'dist/stickman_paper_parkour.html';
  const b = await chromium.launch(); const errs = [];
  const p = await b.newPage({ viewport: { width: 1100, height: 650 } });
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto('file://' + require('path').resolve(file)); await p.waitForTimeout(1500);
  console.log('game?', await p.evaluate(() => !!window.__game && window.__game.state));
  await p.screenshot({ path: '/tmp/s_menu.png' });
  console.log('errors:', errs);
  await b.close();
})();
