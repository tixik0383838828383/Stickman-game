#!/usr/bin/env python3
"""Генерирует иконки Android из assets/icon.jpg в android/app/src/main/res (запускается в workflow после `cap add android`).
Использование: python3 tools/make_icons.py [путь_к_res]"""
import os, sys
from PIL import Image, ImageDraw
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
res = sys.argv[1] if len(sys.argv) > 1 else os.path.join(R, 'android/app/src/main/res')
src = Image.open(os.path.join(R, 'assets/icon.jpg')).convert('RGB')
W, H = src.size
paper = src.getpixel((W // 2, 40))                       # цвет бумаги — для фона адаптивной иконки
# 1) внутренняя часть без тёмной окантовки (квадрат по центру)
ins = 44; side = min(W, H) - 2 * ins
cx, cy = W // 2, H // 2
inner = src.crop((cx - side // 2, cy - side // 2, cx + side // 2, cy + side // 2))
# 2) обычная иконка: скруглённый квадрат на прозрачном фоне
def rounded(img, size, radius_frac, circle=False):
    im = img.resize((size, size), Image.LANCZOS).convert('RGBA')
    m = Image.new('L', (size * 4, size * 4), 0); d = ImageDraw.Draw(m)
    if circle: d.ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    else: d.rounded_rectangle((0, 0, size * 4 - 1, size * 4 - 1), radius=int(size * 4 * radius_frac), fill=255)
    im.putalpha(m.resize((size, size), Image.LANCZOS)); return im
full = src.crop((cx - side // 2 - 10, cy - side // 2 - 10, cx + side // 2 + 10, cy + side // 2 + 10))   # чуть шире внутренней части, но без углов-теней
legacy = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
fore = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}
for d in legacy:
    folder = os.path.join(res, 'mipmap-' + d); os.makedirs(folder, exist_ok=True)
    rounded(full, legacy[d], 0.18).save(os.path.join(folder, 'ic_launcher.png'))
    rounded(full, legacy[d], 0, circle=True).save(os.path.join(folder, 'ic_launcher_round.png'))
    # адаптивная: рисунок 80% по центру на цвете бумаги (видимая зона маски ~66% — рисунок целиком внутри)
    S = fore[d]; canvas = Image.new('RGBA', (S, S), paper + (255,))
    k = int(S * 0.80); canvas.paste(inner.resize((k, k), Image.LANCZOS).convert('RGBA'), ((S - k) // 2, (S - k) // 2))
    canvas.save(os.path.join(folder, 'ic_launcher_foreground.png'))
bgx = os.path.join(res, 'values', 'ic_launcher_background.xml')
if os.path.isdir(os.path.dirname(bgx)):
    open(bgx, 'w').write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#%02X%02X%02X</color>\n</resources>\n' % paper)
print('icons ok', paper)
