"""Make the QR code for the error-correction scene and check that it still scans after the tear.

    pip install segno      (OpenCV is only used for the check)
    python qr.py           -> qr.json

The scene tears a jagged piece off the right side of the code. Level H keeps 64 of the 100
codewords of a version-4 symbol for Reed-Solomon parity, so the message survives the tear.
"""
import json
import numpy as np
import segno
import cv2

TEXT = '抽象代数：结构之美'
qr = segno.make(TEXT, error='h', micro=False, boost_error=False)
M = np.array([list(row) for row in qr.matrix], dtype=np.uint8)
n = M.shape[0]
print(f'version {qr.version}, {qr.error} level, {n}x{n} modules')

# jagged bite out of the right edge; avoids finder patterns (rows 0-7), format info (row 8) and the alignment pattern (24-28)
TEAR = [(n + 1, 9.6), (23.2, 10.1), (21.6, 11.6), (20.3, 11.9), (19.2, 13.8), (18.6, 15.2), (19.9, 16.4), (18.4, 18.1),
        (19.1, 19.6), (20.9, 20.3), (22.4, 22.1), (24.3, 22.6), (n + 1, 23.1)]


def inside(px, py, poly):
    c = False
    for i in range(len(poly)):
        x1, y1 = poly[i]; x2, y2 = poly[(i + 1) % len(poly)]
        if (y1 > py) != (y2 > py) and px < (x2 - x1) * (py - y1) / (y2 - y1) + x1:
            c = not c
    return c


torn = [(x, y) for y in range(n) for x in range(n) if inside(x + .5, y + .5, TEAR)]
print(f'torn modules: {len(torn)} ({100 * len(torn) / n / n:.1f}% of the symbol)')


def render(fill_dark):
    s, q = 12, 4                                    # pixels per module, quiet zone
    img = np.full(((n + 2 * q) * s, (n + 2 * q) * s), 255, np.uint8)
    for y in range(n):
        for x in range(n):
            if M[y, x]:
                img[(y + q) * s:(y + q + 1) * s, (x + q) * s:(x + q + 1) * s] = 0
    for x, y in torn:
        img[(y + q) * s:(y + q + 1) * s, (x + q) * s:(x + q + 1) * s] = 0 if fill_dark else 255
    return img


det = cv2.QRCodeDetector()
for dark in (False, True):
    txt, pts, _ = det.detectAndDecode(render(dark))
    print(f'torn area {"dark " if dark else "light"}: decodes', txt == TEXT)
    assert txt == TEXT, 'the torn code no longer scans'
json.dump({'n': n, 'version': qr.version, 'text': TEXT, 'rows': [''.join(map(str, r)) for r in M.tolist()],
           'torn': torn, 'tear': TEAR}, open('qr.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('wrote qr.json')
