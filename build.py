"""Bundle promo.html and music.mp3 into one self-contained HTML player.

    python build.py        -> 抽象代数宣传片.html
"""
import base64, json, os
here = os.path.dirname(os.path.abspath(__file__))
html = open(os.path.join(here, 'promo.html'), encoding='utf-8').read()
audio = base64.b64encode(open(os.path.join(here, 'music.mp3'), 'rb').read()).decode('ascii')
marker = "<script>\n'use strict';"
assert marker in html
html = html.replace(marker, f'<script>window.EMBED = {json.dumps({"audio": audio})};</script>\n' + marker, 1)
out = os.path.join(here, '抽象代数宣传片.html')
open(out, 'w', encoding='utf-8').write(html)
print(f'wrote {out}  ({os.path.getsize(out) / 1e6:.1f} MB)')
