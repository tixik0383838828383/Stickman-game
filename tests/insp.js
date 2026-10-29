const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1100, height: 650 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('dist/stickman_paper_parkour.html')); await p.waitForTimeout(500);
  await p.evaluate(() => __game.openInspector()); await p.waitForTimeout(200);
  const pos = await p.evaluate(() => { const f = __game.sheet.frames, r = document.getElementById('inSheet').getBoundingClientRect(); return [3, 4, 5].map(i => [r.x + (f[i].sx + f[i].sw / 2) * __game.inspector.zoom, r.y + (f[i].sy + f[i].sh / 2) * __game.inspector.zoom]); });
  for (const [x, y] of pos) await p.mouse.click(x, y);
  await p.fill('#inName', 'test'); await p.fill('#inFps', '12'); await p.click('#inApply'); await p.click('#inSave');
  console.log('anim', await p.evaluate(() => JSON.stringify(ANIMATIONS.test)));
  await p.click('#inExport'); console.log('export has test', (await p.inputValue('#inJson')).includes('"test"'));
  await p.reload(); await p.waitForTimeout(500);
  console.log('persisted', await p.evaluate(() => !!ANIMATIONS.test), errs);
  await p.screenshot({ path: '/tmp/s_insp2.png' }); await b.close();
})();
