#!/usr/bin/env python3
"""Делает css/font.css: подмножество шрифта Neucha (OFL; латиница + кириллица) как base64 @font-face — один и тот же шрифт на ПК и телефоне, офлайн."""
import base64, io, os
from fontTools import subset
from fontTools.ttLib import TTFont
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
opts = subset.Options(); opts.flavor = 'woff'; opts.layout_features = ['kern', 'liga', 'calt']; opts.notdef_outline = True
f = TTFont(os.path.join(R, 'assets/Neucha.ttf'))
sub = subset.Subsetter(opts)
uni = list(range(0x20, 0x7F)) + list(range(0xA0, 0x100)) + list(range(0x400, 0x460)) + [0x2010, 0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2026, 0x2116]
sub.populate(unicodes=uni); sub.subset(f)
f.flavor = 'woff'; buf = io.BytesIO(); f.save(buf); data = buf.getvalue()
css = "@font-face { font-family: 'Neucha'; src: url(data:font/woff;base64,%s) format('woff'); font-weight: 400; font-style: normal; font-display: block; }\n" % base64.b64encode(data).decode()
open(os.path.join(R, 'css/font.css'), 'w').write(css); print('font.css', len(css) // 1024, 'KB')
