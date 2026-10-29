// Для каждой секретной монеты: бот идёт старт -> (маршрут уровня до ближайшей части) -> монета. Прогон через общий testLevel с BOT_ROUTE.
const { load } = require('./simload'); const { LEVELS } = load();
const { execSync } = require('child_process');
let bad = 0;
LEVELS.forEach((L, i) => {
  L.obj.filter(o => o.t === 'coin' && o.v === 's').forEach(c => {
    // маршрут: оригинальные точки уровня, отсортированные по близости по X до монеты, затем сама монета
    const base = (L.route || L.obj.filter(o => o.t === 'cp' && !o.start).map(o => [o.x, o.y])).filter(r => r[0] < c.x);
    const route = base.concat([[c.x, c.y]]);
    try {
      const out = execSync(`BOT_NOFIN=1 BOT_ROUTE='${JSON.stringify(route)}' node tests/bot.js ${i + 1} -q`, { encoding: 'utf8' });
      console.log(`L${i + 1} secret (${c.x},${c.y}):`, /ПРОХОДИМ/.test(out) ? 'OK' : 'FAIL');
    } catch (e) { bad++; console.log(`L${i + 1} secret (${c.x},${c.y}): FAIL`); }
  });
});
process.exit(bad ? 1 : 0);
