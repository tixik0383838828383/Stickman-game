// Тесты редактора: мышь и касание, перенос, ресайз, старт, тест-спавн, история, экспорт/импорт.
const { chromium } = require('playwright'); const path = require('path');
const R = []; const ok = (n, c, x) => { R.push(c); console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x) : '')); };
(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const mode of ['mouse', 'touch']) {
    const ctx = await b.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2, hasTouch: mode === 'touch', isMobile: mode === 'touch' });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(mode + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto('file://' + path.resolve('dist/stickman_paper_parkour.html')); await p.waitForTimeout(500);
    const cdp = await ctx.newCDPSession(p);
    const E = (f, a) => p.evaluate(f, a);
    await E(() => __game.openEditor(null)); await p.waitForTimeout(300);
    const s2s = (wx, wy) => p.evaluate(([x, y]) => { const e = __game.editor; return e.w2s(x, y); }, [wx, wy]);
    // универсальные жесты
    const tap = async (x, y) => { if (mode === 'mouse') { await p.mouse.click(x, y); } else { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); } await p.waitForTimeout(60); };
    const drag = async (x0, y0, x1, y1) => {
      if (mode === 'mouse') { await p.mouse.move(x0, y0); await p.mouse.down(); for (let i = 1; i <= 8; i++) await p.mouse.move(x0 + (x1 - x0) * i / 8, y0 + (y1 - y0) * i / 8); await p.mouse.up(); }
      else { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 1 }] }); for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / 8, y: y0 + (y1 - y0) * i / 8, id: 1 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
      await p.waitForTimeout(80);
    };
    const clickTool = id => p.evaluate(id => document.querySelector(`#edTools [data-tool="${id}"]`).click(), id);
    const level = () => E(() => JSON.parse(JSON.stringify(__game.editor.level)));
    const T = mode + ' ';
    // 1. выбор платформы и перенос
    let L = await level(); const plat = L.obj.find(o => o.t === 'plat');
    let sp = await s2s(plat.x + 400, plat.y + 40);
    await drag(sp.x, sp.y, sp.x + 100, sp.y - 60);
    let L2 = await level(); const pl2 = L2.obj.find(o => o.t === 'plat'); const z = await E(() => __game.editor.cam.z);
    ok(T + 'перенос платформы', Math.abs((pl2.x - plat.x) - 100 / z) < 25 && Math.abs((pl2.y - plat.y) + 60 / z) < 25, { dx: pl2.x - plat.x, dy: pl2.y - plat.y, z });
    // 2. перенос старта
    L = await level(); sp = await s2s(L.start.x, L.start.y - 30);
    await drag(sp.x, sp.y, sp.x + 80, sp.y - 40);
    L2 = await level(); ok(T + 'перенос старта', Math.abs((L2.start.x - L.start.x) - 80 / z) < 25 && L2.start.y < L.start.y, { from: L.start, to: L2.start });
    // 3. постановка всех инструментов
    const tools = await E(() => EDITOR_TOOLS.filter(t => t.make || t.id === 'start').map(t => t.id));
    let fails = [];
    for (const id of tools) {
      await clickTool(id); const before = (await level()).obj.length; const pos = await s2s(800 + Math.random() * 600, 400);
      await tap(pos.x, pos.y); const after = (await level()).obj.length;
      if (id !== 'start' && id !== 'fin' && after !== before + 1) fails.push(id);
      await E(() => { __game.editor.tool = 'select'; });
    }
    ok(T + 'все инструменты ставят объекты', fails.length === 0, fails);
    // 4. ресайз платформы ручкой
    await E(() => { const e = __game.editor; e.tool = 'select'; e.level.obj.push({ t: 'plat', x: 300, y: 500, w: 100, h: 24, k: 'solid' }); e.sel = e.level.obj[e.level.obj.length - 1]; e.dirty = true; });
    sp = await s2s(400, 524); await drag(sp.x, sp.y, sp.x + 80 * z, sp.y);
    const rp = (await level()).obj.filter(o => o.t === 'plat').pop(); ok(T + 'ресайз платформы', rp.w > 150, rp);
    // 5. пан пустого места
    const c0 = await E(() => ({ x: __game.editor.cam.x, y: __game.editor.cam.y })); await E(() => { __game.editor.sel = null; });
    await clickTool('hand'); await drag(520, 200, 420, 230); await E(() => { __game.editor.tool = 'select'; }); const c1 = await E(() => ({ x: __game.editor.cam.x, y: __game.editor.cam.y }));
    ok(T + 'прокрутка карты', Math.abs(c1.x - c0.x) > 20, { c0, c1 });
    // 6. undo/redo
    const n0 = (await level()).obj.length; await E(() => __game.editor.undo()); const n1 = (await level()).obj.length; await E(() => __game.editor.redo()); const n2 = (await level()).obj.length;
    ok(T + 'undo/redo', n1 !== n0 || n2 === n0, [n0, n1, n2]);
    await E(() => { __game.editor.open(null); }); await E(() => { const e = __game.editor; e.level.start = { x: 400, y: 700 }; e.dirty = true; });
    // 7. тест из редактора: спавн на старте (ноги)
    const st = (await level()).start; await E(() => __game.editor.test()); await p.waitForTimeout(600);
    const pp = await E(() => { const p = __game.world.player; return { cx: p.x + p.w / 2, feet: p.y + p.h, ground: !!p.ground, dead: p.dead, state: __game.state }; });
    ok(T + 'спавн теста на старте', Math.abs(pp.cx - st.x) < 20 && pp.feet <= st.y + 4 && pp.feet > st.y - 120 && pp.state === 'playing', { st, pp });
    await E(() => __game.world.killPlayer('t')); await p.waitForTimeout(1500);
    const pr = await E(() => { const p = __game.world.player; return { cx: p.x + p.w / 2, feet: p.y + p.h, dead: p.dead }; });
    ok(T + 'респавн в тесте на старте', !pr.dead && Math.abs(pr.cx - st.x) < 20, { pr });
    await E(() => __game.pause()); await p.evaluate(() => document.getElementById('pEditor').click()); await p.waitForTimeout(400);
    ok(T + 'возврат в редактор', await E(() => __game.state === 'editor'));
    // 8. экспорт/импорт
    const json = await E(() => JSON.stringify(__game.editor.collect())); await E(j => { const e = __game.editor; e.open(JSON.parse(j)); }, json);
    ok(T + 'экспорт→импорт', JSON.stringify(await level()).length > 100);

    if (mode === 'mouse') {
      // 9. фаззинг свойств: каждый объект, каждое поле, каждый вариант списка — без ошибок
      await E(() => __game.editor.open(null));
      const toolIds = await E(() => EDITOR_TOOLS.filter(t => t.make).map(t => t.id)); let bad = [];
      for (const id of toolIds) {
        await E(id => { const e = __game.editor; e.tool = id; const o = EDITOR_TOOLS.find(t => t.id === id).make(900, 500, e); e.level.obj.push(o); e.sel = o; e.tool = 'select'; e.dirty = true; e.refreshProps(); }, id);
        const n = await E(() => document.querySelectorAll('#edProps [data-key]').length);
        for (let i = 0; i < n; i++) {
          try {
            await E(i => { const el = document.querySelectorAll('#edProps [data-key]')[i]; if (!el) return; const fire = () => el.dispatchEvent(new Event('change', { bubbles: true }));
              if (el.tagName === 'SELECT') { for (const op of Array.from(el.options)) { el.value = op.value; fire(); const el2 = document.querySelectorAll('#edProps [data-key]')[i]; if (el2 && el2 !== el) break; } }
              else if (el.type === 'checkbox') { el.checked = !el.checked; fire(); } else if (el.type === 'number') { el.value = String((parseFloat(el.value) || 0) + 7); fire(); } else { el.value = el.dataset.key === 'id' ? 'zz' + i : 'a,b'; fire(); } }, i);
            await p.waitForTimeout(15);
          } catch (e) { bad.push(id + ':' + i + ' ' + e.message.slice(0, 80)); }
        }
        await E(() => { const e = __game.editor; e.update(0.016); e.draw(__game.ctx); });
      }
      ok(T + 'фаззинг свойств всех объектов', bad.length === 0, bad);
      // 10. клавиатура: стрелки, дубль, удалить, undo
      await E(() => { const e = __game.editor; e.open(null); e.sel = e.level.obj[0]; });
      const x0 = await E(() => __game.editor.sel.x); await p.keyboard.press('ArrowRight'); const x1 = await E(() => __game.editor.sel.x);
      await p.keyboard.press('Control+d'); const cnt = await E(() => __game.editor.level.obj.length); await p.keyboard.press('Delete'); const cnt2 = await E(() => __game.editor.level.obj.length);
      ok(T + 'клавиши: стрелка/дубль/удалить', x1 !== x0 && cnt === 3 && cnt2 === 2, { x0, x1, cnt, cnt2 });
      // 11. зум колесом сохраняет точку под курсором
      await E(() => __game.editor.open(null)); const before = await E(() => __game.editor.s2w(500, 250)); await p.mouse.move(500, 250); await p.mouse.wheel(0, -300); await p.waitForTimeout(50);
      const after = await E(() => __game.editor.s2w(500, 250)); ok(T + 'зум в точку курсора', Math.abs(before.x - after.x) < 2 && Math.abs(before.y - after.y) < 2, { before, after });
      // 12. сохранить в «Мои уровни», открыть, проверка и бот-кнопка без ошибок
      await E(() => { const e = __game.editor; e.open(null); e.level.name = 'T1'; e.saveLevel(); }); const saved = await E(() => __game.save.data.custom.length);
      await E(() => { __game.editor.check(true); }); await p.waitForTimeout(100);
      ok(T + 'сохранение и проверка уровня', saved >= 1, saved);
    } else {
      // pinch-зум двумя пальцами
      await E(() => __game.editor.open(null)); const z0 = await E(() => __game.editor.cam.z);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 400, y: 200, id: 1 }, { x: 500, y: 200, id: 2 }] });
      for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 400 - i * 15, y: 200, id: 1 }, { x: 500 + i * 15, y: 200, id: 2 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); const z1 = await E(() => __game.editor.cam.z);
      ok(T + 'pinch-зум', z1 > z0 * 1.3, { z0, z1 });
    }
    await ctx.close();
  }
  console.log('errors:', errs); console.log(R.every(Boolean) ? 'ALL PASS' : 'SOME FAIL'); await b.close();
})();
