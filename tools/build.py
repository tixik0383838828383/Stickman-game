#!/usr/bin/env python3
"""Генерирует assets/sprites.js, assets/sheet_data.js и одиночный dist/stickman_paper_parkour.html + zip."""
import base64, json, re, os, zipfile, sys
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(R, *a)
sj = json.load(open(P('assets/sprites.json')))
open(P('assets/sprites.js'), 'w').write('window.SPRITES_JSON=' + json.dumps(sj, separators=(',', ':')) + ';\n')
b64 = base64.b64encode(open(P('assets/stickman_sheet.png'), 'rb').read()).decode()
open(P('assets/sheet_data.js'), 'w').write('window.SHEET_DATA_URI="data:image/png;base64,' + b64 + '";\n')
html = open(P('index.html'), encoding='utf-8').read()
html = re.sub(r'<link[^>]*href="css/style.css"[^>]*>', lambda m: '<style>\n' + open(P('css/style.css'), encoding='utf-8').read() + '\n</style>', html)
def inl(m):
    src = m.group(1)
    return '<script>\n' + open(P(src), encoding='utf-8').read().replace('</script', '<\\/script') + '\n</script>'
html = re.sub(r'<script src="([^"]+)"></script>', inl, html)
os.makedirs(P('dist'), exist_ok=True)
if '--start' in sys.argv:   # тестовая сборка: python3 tools/build.py --start 12  -> dist/stickman_L12_test.html (открывается сразу на уровне 12)
    n = int(sys.argv[sys.argv.index('--start') + 1])
    h2 = html.replace('<script>', '<script>window.__AUTOSTART=%d;</script>\n<script>' % (n - 1), 1)
    assert h2 != html, 'не нашёл место вставки'
    open(P('dist/stickman_L%d_test.html' % n), 'w', encoding='utf-8').write(h2); print('test build L%d' % n); sys.exit(0)
out = P('dist/stickman_paper_parkour.html'); open(out, 'w', encoding='utf-8').write(html)
print('single file', os.path.getsize(out) // 1024, 'KB')
z = P('dist/stickman_paper_parkour_project.zip')
with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as zf:
    for d, ds, fs in os.walk(R):
        ds[:] = [x for x in ds if x not in ('dist', 'node_modules', '__pycache__', '.git')]
        for f in fs: zf.write(os.path.join(d, f), os.path.join('stickman_paper_parkour', os.path.relpath(os.path.join(d, f), R)))
print('zip', os.path.getsize(z) // 1024, 'KB')
