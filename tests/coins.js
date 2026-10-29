// Проверка достижимости больших (5) и секретных монет ботом: старт -> контрольные точки до монеты -> монета.
const { load } = require('./simload'); const { LEVELS } = load(); const { spawn } = require('child_process');
const jobs = [];
LEVELS.forEach((L, i) => {
  const vertical = L.h > L.w;
  L.obj.filter(o => o.t === 'coin' && (o.v === 5 || o.v === 's')).forEach(c => {
    let base = L.route ? L.route.slice() : L.obj.filter(o => o.t === 'cp' && !o.start).map(o => [o.x, o.y]);
    if (vertical) base = base.filter(r => r[1] > c.y + 200).sort((a, b) => b[1] - a[1]); else base = base.filter(r => r[0] < c.x - 100).sort((a, b) => a[0] - b[0]);
    if (L.route) base = L.route.filter(r => r[0] < c.x - 100);
    jobs.push({ lvl: i + 1, c, route: base.concat([[c.x, c.y + 34]]) });
  });
});
let idx = 0, running = 0; const CONC = 2;
function next() {
  while (running < CONC && idx < jobs.length) {
    const j = jobs[idx++]; running++;
    const ch = spawn('node', ['tests/bot.js', String(j.lvl), '-q'], { env: Object.assign({}, process.env, { BOT_NOFIN: '1', BOT_ROUTE: JSON.stringify(j.route) }) });
    let out = ''; ch.stdout.on('data', d => out += d);
    const to = setTimeout(() => ch.kill(), 600000);
    ch.on('close', () => { clearTimeout(to); running--; console.log(`L${j.lvl} ${j.c.v === 's' ? 'секрет' : 'большая'} (${j.c.x},${j.c.y}): ${/ПРОХОДИМ/.test(out) ? 'OK' : 'НЕ НАЙДЕНО'}`); if (idx >= jobs.length && !running) console.log('DONE'); next(); });
  }
}
console.log(jobs.length, 'монет'); next();
