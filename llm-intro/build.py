"""Assemble the LLM intro page from core.js + scenes/*.js + timeline.js.

    python llm-intro/build.py                              -> llm-intro/index.html   (loads music.mp3 next to it)
    python llm-intro/build.py --embed                      -> 大语言模型简介.html      (single file, music embedded)
    python llm-intro/build.py --scenes s3_attention,s4 --out /tmp/prev.html
                                                          -> a preview page with only those scene files

Every scene file is wrapped in its own function scope and its own <script> tag, so a scene may declare any
names it likes and a broken scene cannot stop the others from loading. A scene file with a syntax error is
reported and skipped.
"""
import argparse, base64, json, os, subprocess, sys

here = os.path.dirname(os.path.abspath(__file__))


def read(p):
    return open(p, encoding='utf-8').read()


def pick(names):
    files = sorted(f for f in os.listdir(os.path.join(here, 'scenes')) if f.endswith('.js'))
    if not names:
        return files
    out = []
    for n in names:
        hit = [f for f in files if f == n or f == n + '.js' or f.startswith(n + '_') or f.startswith(n + '.')]
        if not hit:
            sys.exit(f'no scene file matches "{n}" (have: {", ".join(files)})')
        out += hit
    return out


def syntax_ok(path):
    r = subprocess.run(['node', '--check', path], capture_output=True, text=True)
    if r.returncode:
        print(f'ERROR: syntax error in {os.path.relpath(path)} (scene skipped):\n{r.stderr.strip()}', file=sys.stderr)
    return r.returncode == 0


def build(scenes=None, out=None, embed=False, audio=None):
    files = pick(scenes)
    parts, chars = [], set()
    for f in ['core.js'] + [os.path.join('scenes', s) for s in files] + ['timeline.js']:
        p = os.path.join(here, f)
        if f.startswith('scenes') and not syntax_ok(p):
            continue
        src = read(p)
        chars |= {c for c in src if ord(c) > 127}
        if f.startswith('scenes'):
            src = ("(() => { 'use strict'; try {\n" + src + "\n} catch (e) { console.error('scene file " + os.path.basename(f) + ":', e && e.stack || e); } })();")
        parts.append(f'<script>\n{src}\n</script>')
    head = [f'<script>window.__CHARS = {json.dumps("".join(sorted(chars)))};</script>']
    if embed:
        mp3 = audio or os.path.join(here, 'music.mp3')
        head.append('<script>window.EMBED = ' + json.dumps({'audio': base64.b64encode(open(mp3, 'rb').read()).decode('ascii')}) + ';</script>')
    html = read(os.path.join(here, 'index.template.html')).replace('{{SCRIPTS}}', '\n'.join(head + parts))
    out = out or os.path.join(here, os.pardir, '大语言模型简介.html') if embed else out or os.path.join(here, 'index.html')
    out = os.path.abspath(out)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, 'w', encoding='utf-8').write(html)
    return out, files


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--scenes', help='comma separated scene file names or prefixes (default: all)')
    ap.add_argument('--out')
    ap.add_argument('--embed', action='store_true', help='embed music.mp3 (single-file player)')
    ap.add_argument('--audio', help='mp3 to embed (default llm-intro/music.mp3)')
    a = ap.parse_args()
    o, fs = build(a.scenes.split(',') if a.scenes else None, a.out, a.embed, a.audio)
    print(f'wrote {o}  ({os.path.getsize(o) / 1e6:.2f} MB, scenes: {", ".join(fs) or "none"})')
