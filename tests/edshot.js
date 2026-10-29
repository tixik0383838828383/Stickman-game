const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }); const p = await ctx.newPage(); const e = []; p.on('pageerror', x => e.push(x.message));
  await p.goto('file://' + path.resolve('dist/stickman_paper_parkour.html') + '#all'); await p.waitForTimeout(500);
  await p.evaluate(() => { const L = JSON.parse(JSON.stringify(LEVELS[3])); __game.openEditor(L, undefined); }); await p.waitForTimeout(700);
  await p.screenshot({ path: '/tmp/ed1.png' });
  // undo test
  const r = await p.evaluate(() => { const ed = __game.editor, n = ed.level.obj.length; ed.pushUndo(); ed.level.obj.push({ t: 'coin', x: 100, y: 100, v: 1 }); ed.undo(); const n1 = ed.level.obj.length; ed.redo(); return [n, n1, ed.level.obj.length]; });
  console.log('undo', r, e); await b.close(); })();
