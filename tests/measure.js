const { load } = require('./simload');
const X = load(); const { World, PhysicsEngine, PHYS } = X;
const dt = PHYS.dt;
function mk(obj, start) { return new World({ w: 4000, h: 1200, start, obj }, {}); }
const inp = (o) => Object.assign({ left: false, right: false, jump: false, down: false, jumpPressed: false, downPressed: false }, o);
// 1) полный прыжок с места на ровной земле, удержание, бег вправо
function jumpTest(hold, run) {
  const w = mk([{ t: 'plat', x: 0, y: 800, w: 4000, h: 200 }], { x: 200, y: 800 });
  for (let i = 0; i < 120; i++) PhysicsEngine.step(w, inp({ right: run }), dt);
  const p = w.player; const x0 = p.x, y0 = p.y; let minY = y0, t = 0, first = true, ground = false;
  for (let i = 0; i < 400; i++) {
    const hj = (i * dt) < hold;
    PhysicsEngine.step(w, inp({ right: run, jump: hj, jumpPressed: i === 0 }), dt);
    minY = Math.min(minY, p.y); t += dt;
    if (i > 5 && p.onGround) { ground = true; break; }
  }
  return { rise: (y0 - minY).toFixed(1), dist: (p.x - x0).toFixed(1), air: t.toFixed(2) };
}
console.log('jump full no run', jumpTest(1, false));
console.log('jump full run', jumpTest(1, true));
console.log('jump tap run', jumpTest(0.05, true));
console.log('jump half run', jumpTest(0.18, true));
console.log('speed check');
{
  const w = mk([{ t: 'plat', x: 0, y: 800, w: 4000, h: 200 }], { x: 200, y: 800 });
  for (let i = 0; i < 240; i++) PhysicsEngine.step(w, inp({ right: true }), dt);
  console.log('x after 2s run', w.player.x.toFixed(1), 'vx', w.player.vx, 'onGround', w.player.onGround);
}
