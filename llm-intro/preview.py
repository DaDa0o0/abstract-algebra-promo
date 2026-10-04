"""Render still frames (or time a range) of a scene without touching anyone else's files.

    python llm-intro/preview.py --scenes s3_attention --times 16,17.5,19 --out /tmp/me
    python llm-intro/preview.py --scenes s3_attention --bench 15,22.5 --out /tmp/me
    python llm-intro/preview.py --times 0,30,59 --out /tmp/all          (all scene files)

Times are GLOBAL seconds (scene start = start_bar * 2.5). Writes <out>/page.html and <out>/shots/tNNNN.NN.jpg
and prints the paths of the JPGs. Needs node, Chrome, network (Google Fonts) and ffmpeg on PATH for full exports.
"""
import argparse, os, subprocess, sys

here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, here)
from build import build

ap = argparse.ArgumentParser()
ap.add_argument('--scenes')
ap.add_argument('--times')
ap.add_argument('--bench')
ap.add_argument('--out', required=True)
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)
page, files = build(a.scenes.split(',') if a.scenes else None, os.path.join(a.out, 'page.html'))
exp = os.path.join(here, os.pardir, 'export.mjs')
if a.bench:
    r = subprocess.run(['node', exp, '--page', page, '--bench', a.bench], capture_output=True, text=True)
    print(r.stdout.strip(), r.stderr.strip())
if a.times:
    shots = os.path.join(a.out, 'shots')
    r = subprocess.run(['node', exp, '--page', page, '--shots', a.times, '--shotdir', shots], capture_output=True, text=True)
    print(r.stdout.strip(), r.stderr.strip())
    for t in a.times.split(','):
        print(os.path.join(shots, f't{float(t):07.2f}.jpg'))
