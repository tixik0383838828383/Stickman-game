const { testLevel } = require('./bot'); const i = +process.argv[2] - 1;
const r = testLevel(i, false); if (!r.ok) { console.error('fail'); process.exit(1); }
require('fs').writeFileSync(process.argv[3], JSON.stringify(r.acts.map(a => [a.l, a.r, a.j, a.d])));
console.log('ok', r.time + 's', r.acts.length, 'macro');
