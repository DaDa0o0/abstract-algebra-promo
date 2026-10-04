"""Checks on a rendered MP4.

    python llm-intro/qa.py check VIDEO.mp4                       container facts, loudness, black frames, freezes, silence
    python llm-intro/qa.py contact VIDEO.mp4 --every 2 --out DIR  contact sheets (labelled thumbnails) for reviewing the whole film
    python llm-intro/qa.py frames VIDEO.mp4 --times 5,9.9,10.1 --out DIR   full-size frames at given seconds

ffmpeg must be on PATH (the repo's export.mjs also uses it).
"""
import argparse, os, re, subprocess, sys, tempfile
from PIL import Image, ImageDraw, ImageFont


def ff(*a, capture=True):
    r = subprocess.run(['ffmpeg', '-hide_banner', *a], capture_output=capture, text=True)
    return r.stderr + (r.stdout or '')


def check(video):
    info = ff('-i', video)
    dur = re.search(r'Duration: (\d+):(\d+):([\d.]+)', info)
    secs = int(dur.group(1)) * 3600 + int(dur.group(2)) * 60 + float(dur.group(3)) if dur else -1
    print(f'duration      {secs:.3f} s  (the 2:50 cut should be 170.000)')
    for line in info.splitlines():
        if 'Stream #' in line:
            print('stream       ', line.strip())
    loud = ff('-i', video, '-af', 'ebur128=peak=true', '-f', 'null', '-')
    summ = loud[loud.rfind('Summary:'):]
    for k in ('I:', 'LRA:', 'Peak:'):
        m = re.search(r'^\s*' + re.escape(k) + r'\s+(.*)$', summ, re.M)
        if m:
            print(f'loudness {k:5} {m.group(1).strip()}')
    black = ff('-i', video, '-vf', 'blackdetect=d=0.15:pix_th=0.04', '-an', '-f', 'null', '-')
    for m in re.finditer(r'black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)', black):
        print(f'black frames  {m.group(1)} -> {m.group(2)} s ({m.group(3)} s)')
    freeze = ff('-i', video, '-vf', 'freezedetect=n=-60dB:d=0.6', '-an', '-f', 'null', '-')
    for m in re.finditer(r'freeze_start: ([\d.]+)', freeze):
        end = re.search(r'freeze_end: ([\d.]+)', freeze[m.end():])
        print(f'frozen picture from {m.group(1)} s' + (f' to {end.group(1)} s' if end else ' (to the end)'))
    sil = ff('-i', video, '-af', 'silencedetect=noise=-50dB:d=0.4', '-vn', '-f', 'null', '-')
    for m in re.finditer(r'silence_start: ([\d.]+)', sil):
        end = re.search(r'silence_end: ([\d.]+)', sil[m.end():])
        print(f'silent audio from {m.group(1)} s' + (f' to {end.group(1)} s' if end else ' (to the end)'))


def frames(video, times, out):
    os.makedirs(out, exist_ok=True)
    paths = []
    for t in times:
        p = os.path.join(out, f'f{t:07.2f}.png')
        ff('-y', '-loglevel', 'error', '-ss', f'{t}', '-i', video, '-frames:v', '1', p)
        paths.append(p)
    return paths


def contact(video, every, out, cols=4, rows=4, tw=480, start=0.0, end=None):
    os.makedirs(out, exist_ok=True)
    info = ff('-i', video)
    m = re.search(r'Duration: (\d+):(\d+):([\d.]+)', info)
    total = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
    end = min(total - 0.05, end if end else total)
    times, t = [], start
    while t <= end + 1e-6:
        times.append(round(t, 3)); t += every
    th = tw * 9 // 16
    font = ImageFont.load_default()
    sheets = []
    per = cols * rows
    for si in range(0, len(times), per):
        chunk = times[si:si + per]
        sheet = Image.new('RGB', (cols * tw, rows * th), (8, 8, 12))
        with tempfile.TemporaryDirectory() as d:
            for i, t in enumerate(chunk):
                p = os.path.join(d, f'{i}.png')
                ff('-y', '-loglevel', 'error', '-ss', f'{t}', '-i', video, '-frames:v', '1', '-vf', f'scale={tw}:{th}', p)
                if not os.path.exists(p):
                    continue
                im = Image.open(p).convert('RGB')
                dr = ImageDraw.Draw(im)
                dr.rectangle([0, 0, 64, 16], fill=(0, 0, 0))
                dr.text((4, 2), f'{t:6.2f}s', fill=(255, 220, 120), font=font)
                sheet.paste(im, ((i % cols) * tw, (i // cols) * th))
        name = os.path.join(out, f'sheet_{si // per:02d}_{chunk[0]:05.1f}-{chunk[-1]:05.1f}.jpg')
        sheet.save(name, quality=88)
        sheets.append(name)
    return sheets


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', choices=['check', 'contact', 'frames'])
    ap.add_argument('video')
    ap.add_argument('--every', type=float, default=2.0)
    ap.add_argument('--times', default='')
    ap.add_argument('--start', type=float, default=0.0)
    ap.add_argument('--end', type=float, default=None)
    ap.add_argument('--cols', type=int, default=4)
    ap.add_argument('--rows', type=int, default=4)
    ap.add_argument('--width', type=int, default=480)
    ap.add_argument('--out', default='qa_out')
    a = ap.parse_args()
    if a.cmd == 'check':
        check(a.video)
    elif a.cmd == 'frames':
        for p in frames(a.video, [float(x) for x in a.times.split(',')], a.out):
            print(p)
    else:
        for p in contact(a.video, a.every, a.out, a.cols, a.rows, a.width, a.start, a.end):
            print(p)
