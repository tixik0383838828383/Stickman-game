#!/usr/bin/env python3
"""Разбор спрайт-листа: находит фигуры, строит сетку, считает точки опоры.
Использование: python3 tools/prep_sprites.py sheet.png assets/sprites.json
Фон должен быть прозрачным ИЛИ почти чёрным (тогда вырезается цветовым ключом)."""
import sys, json
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from collections import Counter

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGBA')
a = np.array(im)
alpha = a[..., 3] > 20
if alpha.all():                       # непрозрачный фон -> ключ по яркости
    alpha = a[..., :3].max(axis=2) > 60
mask = alpha
lab, n = ndi.label(ndi.binary_dilation(mask, iterations=6))
boxes = []
for i, s in enumerate(ndi.find_objects(lab)):
    m = mask[s] & (lab[s] == i + 1)
    yy, xx = np.where(m)
    if len(yy) == 0: continue
    boxes.append([int(s[0].start + yy.min()), int(s[1].start + xx.min()),
                  int(s[0].start + yy.max() + 1), int(s[1].start + xx.max() + 1)])
# строки
boxes.sort(key=lambda b: (b[0] + b[2]) / 2)
rows, cur = [], [boxes[0]]
for b in boxes[1:]:
    c = np.mean([(x[0] + x[2]) / 2 for x in cur])
    if abs((b[0] + b[2]) / 2 - c) > 40: rows.append(cur); cur = [b]
    else: cur.append(b)
rows.append(cur)
for r in rows: r.sort(key=lambda b: b[1])
# шаг сетки и центры столбцов
allc = [(b[1] + b[3]) / 2 for r in rows for b in r]
x0 = min(allc); pitch = 128.2
colOf = lambda cx: int(round((cx - x0) / pitch))
cols = {}
for r in rows:
    for b in r: cols.setdefault(colOf((b[1] + b[3]) / 2), []).append((b[1] + b[3]) / 2)
colC = {k: float(np.median(v)) for k, v in cols.items()}
frames = []
for ri, r in enumerate(rows):
    base = Counter(b[2] for b in r).most_common(1)[0][0]
    # mode среди «стоячих» кадров: берём самое частое дно
    for b in r:
        k = colOf((b[1] + b[3]) / 2)
        frames.append(dict(i=len(frames), row=ri, col=k, sx=b[1], sy=b[0], sw=b[3] - b[1], sh=b[2] - b[0],
                           ax=round(colC[k], 1), ay=base))
json.dump(dict(sheetW=im.width, sheetH=im.height, pitch=pitch, frames=frames), open(out, 'w'))
print(len(frames), 'frames,', len(rows), 'rows,', len(colC), 'cols')
