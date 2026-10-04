// s5_read: pretraining I. A torrent of text (trillions of tokens), then one example is pulled out, its next word is
// hidden, an untrained model guesses almost flat, the truth drops in and the loss = -ln(0.01) = 4.6 flashes.
const R = mulberry(20260005);

// ---------------------------------------------------------------- the data: five kinds of source
const CATS = [
  { zh: '书籍', en: 'Books', col: PAL.cyan, font: F_IT, style: 'italic', weight: 500, k: 1.15, lines: [
    'It was the best of times,', 'Call me Ishmael. Some years ago,',
    'All happy families are alike;', '在很久很久以前，山里有一座小小的寺庙，',
    'Chapter 12. The rain had not stopped.', '“你去哪儿？”她轻声问，没有回头。', 'She walked on through the quiet snow,' ] },
  { zh: '网页', en: 'Web', col: PAL.blue, font: F_UI, style: '', weight: 500, k: .8, lines: [
    'How to bake sourdough: 7 steps', 'Top 10 hiking trails near you', '欢迎来到我们的网站，请登录或注册',
    'Frequently asked questions', 'Breaking: markets rally', '最新资讯 · 科技 · 生活 · 旅行',
    'Privacy policy  |  Terms of use' ] },
  { zh: '代码', en: 'Code', col: PAL.violet, font: F_MONO, style: '', weight: 400, k: .78, lines: [
    'def softmax(x): return exp(x)/sum', 'for (let i = 0; i < n; i++)', 'SELECT name FROM users WHERE id = 42;',
    'if (x > 0) { return x; }', 'import numpy as np  # load the data', 'while True: step(model, batch)', '<div class="card">hello</div>' ] },
  { zh: '论文', en: 'Papers', col: PAL.pink, font: F_MATH, style: '', weight: 400, k: 1.0, lines: [
    'E = mc²', '∇ · E = ρ / ε₀', '∫ f(x) dx = F(b) − F(a)', 'Abstract. We propose a new network',
    'Σ p(xᵢ) = 1,   p(x) ≥ 0', 'Theorem 2. Prime-order groups are cyclic.', 'λ v = A v' ] },
  { zh: '对话', en: 'Dialogue', col: '#c3f26b', font: F_UI, style: '', weight: 500, k: .8, lines: [
    '“Where are you going?”', 'A: Can you help me with this?', '你吃饭了吗？还没呢！', 'Thanks so much, that really helped!',
    'Q: Why is the sky blue?', '好的，没问题，明天见！', 'haha ok see you at 8 then' ] },
];
const SENT = 'The cat sat on the mat';
const PRE = 'The cat sat on the ';

// ---------------------------------------------------------------- tunnel tables (3D billboards flying at the camera)
const ZMIN = .5, ZMAX = 7, ZR = ZMAX - ZMIN, VPX = 960, VPY = 505, FOC = 680;
// ~135 billboards: a golden-angle spread of directions and an even spread of depths, so the stream is evenly filled (the draw loop
// additionally fades any line that would overprint a nearer one)
const SN = Array.from({ length: 135 }, (_, i) => {
  const c = i % 5, cat = CATS[c], th = i * 2.39996 + R() * .4, r = .85 + ((i * .381966 + R() * .1) % 1) * 2.1;
  return { c, line: cat.lines[Math.floor(R() * cat.lines.length)], x: Math.cos(th) * r * 1.5, y: Math.sin(th) * r * .85 + 1.0, u: ((i * .618034) % 1) * ZR, base: (86 + R() * 30) * cat.k };
});
const BASEPX = 44, CATFONT = CATS.map(c => `${c.style} ${c.weight} ${BASEPX}px ${c.font}`);
const DUST = Array.from({ length: 330 }, () => { const th = R() * TAU, r = .35 + Math.pow(R(), .7) * 3.2; return { x: Math.cos(th) * r * 1.5, y: Math.sin(th) * r * .95, u: R() * ZR, a: .25 + R() * .6 }; });

// time warp: 1 = full torrent speed; decays to a crawl as the example is pulled out
const SLOW0 = 2.55, SLOWL = 1.6, SFLOOR = .12;      // the stream never stops dead: it keeps drifting as a dim backdrop
function warp(lt) {
  const u = clamp((lt - SLOW0) / SLOWL), g = lt < SLOW0 ? lt : SLOW0 + SLOWL * (1 - Math.pow(1 - u, 3)) / 3;
  return SFLOOR * lt + (1 - SFLOOR) * g;
}
const speedAt = lt => SFLOOR + (1 - SFLOOR) * (lt < SLOW0 ? 1 : Math.pow(1 - clamp((lt - SLOW0) / SLOWL), 2));
const SPD = 1.4;                        // world z units per warp-second

const ca_ = lt => win(lt, 0, 3.4, .3, .4);                    // fade of the counter / tags (held ~1.1 s after it locks)
const calm_ = lt => win(lt, 0, 4.0, .3, .5);                  // the torrent keeps clear of the counter / tags until they are gone

// ---------------------------------------------------------------- the story geometry (beat 2)
const SENT_SIZE = 92, SENT_Y = 238, SLOTDX = 12;
let wPre = 0, wMat = 0, wFull = 0;                        // measured at draw time, after the fonts are loaded
function layout() { wPre = measure(PRE, SENT_SIZE, F_UI, 600); wMat = measure('mat', SENT_SIZE, F_UI, 600); wFull = wPre + wMat; }
const BX = 130, BY = 384, BW = 860, BH = 470, GX = 1070, GW = 720;           // bars panel, gauge panel
const ROW0 = BY + 108, ROWP = 56, ROWX = 4, LABX = BX + 48, BARX = BX + 240, BSCALE = 7500;
const T_LOCK = 3.75, T_TRUTH = 5.625, T_LOSS = 6.25;                                        // example settles (beat 6) / the true word lands (beat 9)
const mixHex = (a, b, t) => { const p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16), f = (sh) => Math.round(lerp((p >> sh) & 255, (q >> sh) & 255, t)); return `${f(16)},${f(8)},${f(0)}`; };     // 'r,g,b'
const UNT = STORY.untrained;
const MATROW = UNT.findIndex(r => r[0] === 'mat');
const GCX = GX + GW / 2, GCY = 666, GR = 140, LOSS = -Math.log(.01);
const TAGS = [.3, .65, 1.0, 1.35, 1.7], T_CNT = 1.875;            // source tags; the counter locks on beat 3
const TAGGAP = 22;
const CNT_FINAL = '10,000,000,000,000';

scene({
  id: 'read', start: 11, len: 3, mb: 2, bloom: 1, fo: .18, grade: { ca: .0012 },
  ch: ['05', '预训练', 'PRETRAINING'],
  subs: [
    [0.3, 3.7, '它先“阅读”：书籍、网页、代码……数万亿个词', 'First it reads: books, web pages, code… trillions of words'],
    [3.9, 7.3, '练习很简单：遮住下一个词，让它去猜', 'The exercise is simple: hide the next word and let it guess'],
  ],
  sfx: [
    [0.0, 'whoosh', { dur: 1.6 }], [0.3, 'count', { dur: 1.6 }], [0.9, 'swish', { pitch: 1.3 }], [1.2, 'ping', { midi: 84 }],
    ...TAGS.map((t, i) => [t, 'chip', { midi: 62 + [0, 2, 4, 7, 9][i] }]),
    [T_CNT, 'hit', { k: .5 }], [1.7, 'whoosh', { dur: .6, rev: 1 }],
    [T_LOCK, 'chip', { midi: 72 }],
    [3.9, 'swish', { pitch: .8 }], [4.375, 'pop'],
    [3.85, 'pop'], ...UNT.map((_, i) => [3.95 + i * .1, 'blip', { midi: 55 + i * 2 }]),
    [T_TRUTH, 'chip', { midi: 79 }], [T_TRUTH, 'up'],
    [5.775, 'scan', { dur: .22 }], [5.95, 'count', { dur: .3 }], [T_LOSS, 'down'], [T_LOSS, 'hit', { k: .4 }], [6.875, 'thump'],
  ],
  hits: [[T_CNT, .3], [T_LOSS, .35]],
  cam: lt => ({ z: 1 + .035 * lt / 7.5 + .02 * Math.exp(-Math.pow(lt - T_CNT, 2) * 3) + .012 * Math.exp(-Math.pow(lt - T_LOSS, 2) * 3), x: 6 * Math.sin(lt * .21), y: 4 * Math.sin(lt * .17 + 1) }),

  draw(lt) {
    layout();
    const ph = warp(lt), sp = speedAt(lt);
    const tunnelA = 1 - .9 * sstep(3.2, 4.6, lt);                 // the torrent recedes into a dim, slowly drifting backdrop
    const b2 = sstep(3.4, 4.8, lt);                               // 0 = torrent beat, 1 = example beat

    // ---- hero sentence geometry (needed early: the torrent gives way around it)
    const hA = sstep(1.8, 2.15, lt), hP = sstep(1.7, 2.0, lt);          // sentence alpha / plate + stream-clearing alpha (the plate is solid almost at once)
    const zh = lerp(3.2, 2.2, eio(clamp((lt - 1.6) / 1.5)));
    const hx0 = VPX + FOC * -.5 / zh, hy0 = VPY + FOC * -.95 / zh, hs0 = (150 / zh) / SENT_SIZE;
    const bl = eio(clamp((lt - 2.6) / (T_LOCK - 2.6)));
    const hcx = lerp(hx0, W / 2, bl), hcy = lerp(hy0, SENT_Y, bl), hsc = lerp(hs0, 1, bl);
    const heroHW = wFull * hsc / 2 + 90, heroHH = 80 * hsc + 30 + 40 * bl, heroDim = hP;

    // ---- backdrop: cool grid floor racing under the horizon
    glDraw(2, { time: ph * 1.15 + 40, tint: [.07, .2, .52], amp: lerp(.8, .5, b2), horizon: (H / 2 - VPY) / (H / 2) });

    // ---- light at the vanishing point
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const pulse = 1 + .05 * Math.sin(lt * 5);
    glowDot(VPX, VPY, 520 * pulse, 'rgba(70,130,255,A)', .2 * tunnelA);
    ctx.restore();

    // ---- speed dust: radial streaks
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      for (const d of DUST) {
        if ((d.a > .55) !== (pass === 1)) continue;
        const z = ZMAX - ((d.u + ph * SPD) % ZR), z2 = Math.min(ZMAX + 1, z + .22 * sp + .01);
        const x1 = VPX + FOC * d.x / z, y1 = VPY + FOC * d.y / z, x2 = VPX + FOC * d.x / z2, y2 = VPY + FOC * d.y / z2;
        if (x1 < -60 || x1 > W + 60 || y1 < -60 || y1 > H + 60) continue;
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      }
      ctx.lineWidth = pass ? 2 : 1.3; ctx.strokeStyle = pass ? 'rgba(150,210,255,.5)' : 'rgba(110,160,255,.3)';
      ctx.globalAlpha = tunnelA * (pass ? .9 : .75); ctx.stroke();
    }
    ctx.restore();

    // ---- the torrent of text: one font per source kind, depth by scale. Lines are placed near-to-far; a line that would overprint a nearer one fades out.
    if (tunnelA > .01) {
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const cornerOn = 1 - sstep(4.0, 4.6, lt), ca0 = calm_(lt);                                  // keep the chapter-label corner calm
      const tgs = CATS.map((_, ci) => TAGS[ci] < lt ? Math.exp(-(lt - TAGS[ci]) * 1.7) : 0);     // a source tag lights its own kind of text
      const vis = [];
      for (const s of SN) {
        const z = ZMAX - ((s.u + ph * SPD) % ZR), t = (z - ZMIN) / ZR, size = s.base / z;
        const sx = VPX + FOC * s.x / z, sy = VPY + FOC * s.y / z;
        if (size < 18 || sx < -500 || sx > W + 500 || sy < -80 || sy > H + 80) continue;
        const tg = tgs[s.c];
        let a = Math.pow(1 - t, .75) * sstep(1, .86, t) * (.5 + .5 * sstep(0, .1, t)) * 1.25 * (1 + 1.6 * tg) * lerp(1, sstep(1.8, 4.2, z), b2);
        a *= tunnelA * sstep(2.2, 3.2, z) * (1 - sstep(790, 900, sy));          // near (fast, big) words dissolve; nothing runs into the subtitle zone
        if (a < .02) continue;
        ctx.font = CATFONT[s.c]; const hw = ctx.measureText(s.line).width * size / BASEPX / 2;
        if (cornerOn > 0 && sy < 200) a *= 1 - .9 * cornerOn * (1 - sstep(700, 900, sx - hw)) * (1 - sstep(130, 200, sy));
        if (ca0 > 0) { const dx = Math.max(0, Math.abs(sx - W / 2) - hw - 640), dy = Math.max(0, Math.abs(sy - 555) - size * .6 - 150); a *= 1 - .92 * ca0 * (1 - sstep(0, 50, Math.hypot(dx, dy))); }   // calm zone around the counter and the source tags
        if (heroDim > 0) { const dx = Math.max(0, Math.abs(sx - hcx) - hw - heroHW), dy = Math.max(0, Math.abs(sy - hcy) - size * .6 - heroHH); a *= 1 - .95 * heroDim * (1 - sstep(0, 70, Math.hypot(dx, dy))); }
        if (b2 > 0) { const dx = Math.max(0, Math.abs(sx - W / 2) - hw - 900), dy = Math.max(0, Math.abs(sy - 610) - size * .6 - 290); a *= 1 - .95 * b2 * (1 - sstep(0, 50, Math.hypot(dx, dy))); }   // the two panels
        if (a < .02) continue;
        vis.push({ s, z, sx, sy, size, hw, a, tg });
      }
      vis.sort((p, q) => p.z - q.z);                                                         // near first
      const kept = [];
      for (const v of vis) {
        const x0 = v.sx - v.hw - 24, x1 = v.sx + v.hw + 24, y0 = v.sy - v.size * .8 - 8, y1 = v.sy + v.size * .8 + 8, area = (x1 - x0) * (y1 - y0);
        let keep = 1;
        for (const k of kept) { const iw = Math.min(x1, k.x1) - Math.max(x0, k.x0), ih = Math.min(y1, k.y1) - Math.max(y0, k.y0); if (iw > 0 && ih > 0) keep *= 1 - sstep(0, .1, iw * ih / Math.min(area, k.area)) * Math.min(1, k.v.a * 25); }
        v.a *= keep; if (v.a < .02) continue;
        kept.push({ x0, x1, y0, y1, area, v });
      }
      for (let i = kept.length - 1; i >= 0; i--) {                                           // far to near
        const v = kept[i].v, cat = CATS[v.s.c];
        ctx.font = CATFONT[v.s.c]; ctx.fillStyle = v.tg > .15 ? `rgb(${mixHex(cat.col, '#ffffff', .35)})` : rgba(cat.col, .95); ctx.shadowColor = cat.col; ctx.shadowBlur = v.tg > .2 ? 14 : 0;
        ctx.globalAlpha = Math.min(1, v.a);
        const k = v.size / BASEPX; ctx.save(); ctx.translate(v.sx, v.sy); ctx.scale(k, k); ctx.fillText(v.s.line, 0, 0); ctx.restore();
      }
      ctx.restore();
    }

    // ---- counter: TOKENS READ racing up through the orders of magnitude (beat 1); it locks on beat 3 and the final number is held ~1.3 s
    const ca = ca_(lt);
    if (ca > .01) {
      const lq = Math.floor(lt * 30 + .5) / 30, k = clamp((lq - .25) / (T_CNT - 0.25 - .02)), p = 1 - Math.pow(1 - k, 1.5), v = Math.pow(10, 1.6 + 11.4 * p);
      let digs = String(Math.round(v)); if (k >= 1) digs = '10000000000000';
      if (k < 1) digs = [...digs].map((c, i) => i < 2 ? c : String(Math.floor(hash1(Math.floor(lq * 15 + .25) * 13 + i * 5.3) * 10))).join('');
      const s = digs.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      const size = 92, wFin = measure(CNT_FINAL, size, F_MONO, 700), wPlus = measure('+', size, F_MONO, 700), cx = W / 2 - wPlus / 2;
      const lock = lt >= T_CNT ? lt - T_CNT : -1, settle = 0;
      // dark scrim keeps the numerals readable over the torrent
      ctx.save(); ctx.translate(W / 2, 535); ctx.scale(1.9, 1); const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 380);
      g.addColorStop(0, `rgba(2,5,14,${.82 * ca})`); g.addColorStop(.6, `rgba(2,5,14,${.5 * ca})`); g.addColorStop(1, 'rgba(2,5,14,0)'); ctx.fillStyle = g; ctx.fillRect(-400, -300, 800, 600); ctx.restore();
      text('已读词元  ·  TOKENS READ', W / 2, 442, { font: F_UI, weight: 600, size: 30, ls: 7, color: '#bfe4ff', alpha: ca });
      const flash = lock >= 0 ? Math.exp(-lock * 4) : 0;
      text(s, cx, 538, { font: F_MONO, weight: 700, size, color: '#fff', alpha: ca, glow: 'rgba(110,190,255,.9)', blur: 18 + 6 * Math.max(flash, settle) });
      text('例如  ·  e.g.  数量级示意  ·  illustrative scale', W / 2, 610, { font: F_UI, weight: 500, size: 24, color: '#a9c8f4', alpha: ca * sstep(1.9, 2.4, lt) });
      if (lock >= 0) {
        const e = eback(clamp(lock / .45));
        text('+', cx + wFin / 2 + wPlus / 2, 538 - (1 - e) * 24, { font: F_MONO, weight: 700, size, color: PAL.cyan, alpha: ca * clamp(lock / .15), glow: 'rgba(110,190,255,.9)', blur: 30 });
        flare(W / 2, 538, Math.exp(-lock * 9) * .4 * ca, 760);
      }
      // source tags
      const ty = 660, TAGW = CATS.map(c => measure(c.zh + '  ' + c.en, 30, F_UI, 500) + 52), TAGTOT = TAGW.reduce((a, b) => a + b, 0) + TAGGAP * 4; let x = W / 2 - TAGTOT / 2;
      CATS.forEach((c, i) => {
        const kk = clamp((lt - TAGS[i]) / .5), cxm = x + TAGW[i] / 2; x += TAGW[i] + TAGGAP;
        if (kk <= 0) return;
        const e = eback(kk), al = ca * clamp(kk * 3), fl = Math.exp(-(lt - TAGS[i]) * 5);
        ctx.save(); ctx.translate(cxm, ty + (1 - e) * 36);
        ctx.save(); ctx.globalAlpha = al * .85; rrect(-TAGW[i] / 2, -25.5, TAGW[i], 51, 14); ctx.fillStyle = 'rgba(3,8,20,.9)'; ctx.fill(); ctx.restore();   // dark backing: the label stays crisp over the torrent
        chip(c.zh + '  ' + c.en, 0, 0, { size: 30, font: F_UI, weight: 500, color: c.col, textColor: `rgb(${mixHex(c.col, '#ffffff', .8)})`, pad: 26, alpha: al, glow: 8 + 22 * fl, fillA: .12 + .3 * fl, strokeA: 1 });
        ctx.restore();
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowDot(cxm, ty, 140 * (1 + fl), hexA(c.col), .16 * fl * al); ctx.restore();
      });
    }

    // ---- hero sentence: pulled out of the stream along a bright streak, then settles as the example
    if (hA > 0) {
      const sliding = 1 - bl, since = lt - T_LOCK;
      if (sliding > .01) {                                          // trail from the vanishing point
        const tx0 = lerp(VPX, hcx, .42), ty0 = lerp(VPY, hcy, .42);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
        const g = ctx.createLinearGradient(tx0, ty0, hcx, hcy); g.addColorStop(0, 'rgba(160,215,255,0)'); g.addColorStop(1, 'rgba(235,248,255,.95)');
        ctx.strokeStyle = g; ctx.lineWidth = 4; ctx.globalAlpha = .8 * hA * Math.min(1, sliding * 1.6); ctx.beginPath(); ctx.moveTo(tx0, ty0); ctx.lineTo(hcx, hcy); ctx.stroke();
        ctx.restore();
      }
      ctx.save(); ctx.translate(hcx, hcy); ctx.scale(hsc, hsc);
      if (sliding > .01) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowDot(0, 0, 360, 'rgba(120,200,255,A)', .3 * sliding * hA); ctx.restore(); }
      const plate = hP * (1 - sstep(3.55, 3.95, lt));               // dark glass plate keeps the example readable until the stream has faded
      if (plate > .01) glass(-wFull / 2 - 34, -80, wFull + 68, 160, { alpha: plate, r: 30, fill: 'rgba(3,8,22,.97)', stroke: 'rgba(170,225,255,.95)', lw: 3, glow: 'rgba(110,190,255,.8)', blur: 36 });
      drawSentence(lt, hA);
      if (since > 0 && since < .9) {                                // gold-white pulse as the example locks in
        const f = Math.exp(-since * 5.5);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowDot(0, 0, 520, 'rgba(255,222,150,A)', .33 * f);
        ctx.strokeStyle = `rgba(255,236,190,${.7 * f})`; ctx.lineWidth = 3; rrect(-wFull / 2 - 34 - 70 * since, -80 - 40 * since, wFull + 68 + 140 * since, 160 + 80 * since, 30 + 20 * since); ctx.stroke(); ctx.restore();
      }
      ctx.restore();
    }

    // ---- beat 2: hidden word, untrained guess, truth, loss
    if (lt > 3.5) beatTwo(lt);
  },
});

// the sentence in local coords (centre 0,0, base size SENT_SIZE). Handles the mask over "mat" and the mint answer that drops into it.
function drawSentence(lt, a) {
  const x0 = -wFull / 2, S = SENT_SIZE;
  const wf = clamp((lt - 3.8) / .2);                          // the visible "mat" fades out first ...
  const mk = eio(clamp((lt - 3.95) / .425));                    // ... then the mask wipes in over its slot (lands on beat 7, 4.375 s)
  const drop = clamp((lt - T_TRUTH) / .5), de = eout(drop);   // the true word settles into the slot
  text(PRE.trimEnd(), x0, 0, { font: F_UI, weight: 600, size: S, align: 'left', color: '#f4f9ff', alpha: a, glow: 'rgba(120,190,255,.55)', blur: 18 });
  const mx = x0 + wPre + SLOTDX, mw = wMat;           // the answer slot sits a little right of the word space, so it never reads as 'the[mat]'
  const wordA = a * (1 - wf) * (1 - clamp(drop * 4));
  if (wordA > .01) text('mat', mx - SLOTDX, 0, { font: F_UI, weight: 600, size: S, align: 'left', color: '#f4f9ff', alpha: wordA, glow: 'rgba(120,190,255,.55)', blur: 18 });
  if (mk > 0) {
    const padX = 16, h = S * 1.2, answered = drop > 0;
    const col = answered ? PAL.mint : PAL.cyan, pulse = .5 + .5 * Math.sin(lt * 6);
    ctx.save();                                                          // the pill grows from its left edge (no clip, so the glow is never cut off)
    glass(mx - padX, -h / 2, Math.max(4, (mw + padX * 2) * mk), h, { r: 22, fill: answered ? 'rgba(10,40,34,.78)' : 'rgba(10,24,52,.88)', stroke: rgba(col, .95), lw: 3, glow: rgba(col, .8 * clamp(mk * 2)), blur: 26 + 14 * pulse * (answered ? 0 : 1), alpha: clamp(mk * 4) });
    ctx.restore();
    const qa = a * sstep(.5, 1, mk) * (1 - sstep(0, .2, drop));          // the "?" is gone before the true word falls through it
    if (qa > .01) text('?', mx + mw / 2, S * .02 - 14 * sstep(0, .2, drop), { font: F_UI, weight: 700, size: S, color: '#fff', alpha: qa, glow: 'rgba(120,200,255,.9)', blur: 22 + 12 * pulse });
    if (answered) {
      const yy = -(1 - de) * 46;
      text('mat', mx, yy + S * .0, { font: F_UI, weight: 600, size: S, align: 'left', color: PAL.mint, alpha: a * sstep(.2, .55, drop), glow: 'rgba(94,242,176,.9)', blur: 30 });
      const ring = 1 - drop;
      if (ring > 0 && ring < 1) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = rgba(PAL.mint, .6 * ring); ctx.lineWidth = 3; rrect(mx - padX - 40 * drop, -h / 2 - 40 * drop, mw + padX * 2 + 80 * drop, h + 80 * drop, 30); ctx.stroke(); ctx.restore(); }
    }
  }
}

function beatTwo(lt) {
  // ---- labels under the sentence
  const LY = SENT_Y + 104;
  const hid = sstep(4.4, 4.65, lt) * (1 - sstep(5.35, 5.6, lt)), tru = sstep(5.9, 6.2, lt);
  const slotX = W / 2 - wFull / 2 + wPre + SLOTDX + wMat / 2;
  const ex = sstep(3.5, 3.8, lt) * (1 - sstep(4.0, 4.3, lt));
  if (ex > 0) text('海量文本中的一个训练样例  ·  one training example from the data', W / 2, LY, { font: F_UI, weight: 500, size: 26, color: '#a9c8f4', alpha: ex });
  if (hid > 0) text('被遮住的下一个词  ·  the hidden next word', slotX, LY, { font: F_UI, weight: 500, size: 26, color: '#a9c8f4', alpha: hid });
  if (tru > 0) text('真正的下一个词  ·  the true next word', slotX, LY, { font: F_UI, weight: 500, size: 26, color: PAL.mint, alpha: tru });

  // slow push-in on the two panels through the last seconds
  const push = 1 + .012 * sstep(5.6, 7.5, lt);
  ctx.save(); ctx.translate(W / 2, 640); ctx.scale(push, push); ctx.translate(-W / 2, -640);

  // ---- bars: the untrained model's guess (the panel appears together with its first bars)
  const lq0 = Math.floor(lt * 30 + .5) / 30, pa = sstep(3.85, 4.15, lt);
  const hl = sstep(T_TRUTH + .2, T_TRUTH + .55, lt), tr = sstep(T_TRUTH + .1, T_TRUTH + .4, lt);                  // "mat" row is highlighted / turns mint once the truth has landed
  if (pa > 0) {
    glass(BX, BY, BW, BH, { alpha: pa, r: 24, fill: 'rgba(5,10,26,.88)', stroke: 'rgba(150,190,255,.3)' });
    text('未训练的模型的猜测  ·  UNTRAINED MODEL’S GUESS', BX + 48, BY + 38, { font: F_UI, weight: 600, size: 24, ls: 2.5, align: 'left', color: '#bcd2f5', alpha: pa });
    text('示意数值  ·  e.g. illustrative values', BX + 48, BY + 70, { font: F_UI, weight: 500, size: 22, align: 'left', color: '#a9bde4', alpha: pa });
    UNT.forEach(([label, p], i) => {
      const t0 = 3.95 + i * .1, k = eout(clamp((lt - t0) / .45)), kt = eout(clamp((lq0 - t0) / .45)); if (k <= 0) return;
      const other = label === '…', y = ROW0 + i * ROWP + (other ? ROWX : 0), isMat = i === MATROW, rgb = isMat ? mixHex(PAL.cyan, PAL.mint, tr) : null, col = isMat ? `rgb(${rgb})` : other ? '#7f93bd' : PAL.cyan;
      const dim = 1 - .35 * hl * (isMat ? 0 : 1);
      const w = p * BSCALE * k, a = pa * dim * clamp(k * 3);
      if (other) { ctx.save(); ctx.fillStyle = '#e6f0ff'; ctx.globalAlpha = a; for (let q = 0; q < 3; q++) { ctx.beginPath(); ctx.arc(LABX + 10 + q * 16, y, 3.5, 0, TAU); ctx.fill(); } ctx.restore(); }
      else text(label, LABX, y, { font: F_MONO, size: 32, weight: isMat && hl > .5 ? 700 : 400, align: 'left', color: isMat && hl > .3 ? PAL.mint : '#e6f0ff', alpha: a });
      if (other) {                                          // the rest of the vocabulary: thousands of tiny equal ticks, axis-broken (they sum to 85 %)
        const L1 = 240, L = L1 * k;
        ctx.save(); ctx.globalAlpha = a * .75; ctx.fillStyle = col; ctx.beginPath();
        for (let x = 0; x < L - 20; x += 6) ctx.rect(BARX + x, y - 11, 3, 22);
        ctx.fill(); ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = 3;
        ctx.beginPath(); for (const dx of [0, 12]) { ctx.moveTo(BARX + L - 6 + dx, y + 15); ctx.lineTo(BARX + L + 6 + dx, y - 15); } ctx.stroke(); ctx.restore();
        text(Math.round(p * 100) + ' %', BARX + L1 + 36, y, { font: F_MONO, size: 30, align: 'left', color: '#fff', alpha: a * sstep(.5, 1, k) });
        text('其余数万个词', BARX + L1 + 128, y - 15, { font: F_UI, size: 24, weight: 500, align: 'left', color: '#b9cbee', alpha: a * .95 * sstep(.5, 1, k) });
        text('every other word', BARX + L1 + 128, y + 15, { font: F_UI, size: 24, weight: 500, align: 'left', color: '#b9cbee', alpha: a * .95 * sstep(.5, 1, k) });
        return;
      }
      const g = ctx.createLinearGradient(BARX, 0, BARX + w, 0); g.addColorStop(0, isMat ? `rgba(${rgb},.3)` : rgba(col, .3)); g.addColorStop(1, isMat ? `rgba(${rgb},.95)` : rgba(col, .95));
      ctx.save(); ctx.globalAlpha = a; ctx.shadowColor = col; ctx.shadowBlur = isMat && hl > 0 ? 18 + 18 * hl : 12; ctx.fillStyle = g; rrect(BARX, y - 13, Math.max(4, w), 26, 13); ctx.fill(); ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowDot(BARX + w, y, 28, isMat ? `rgba(${rgb},A)` : hexA(col), .5 * a); ctx.restore();
      const big = isMat ? 1 + .12 * hl : 1;
      text(Math.round(p * 100 * kt) + ' %', BARX + p * BSCALE * kt + 20, y, { font: F_MONO, size: 30 * big, weight: isMat && hl > .5 ? 700 : 400, align: 'left', color: isMat && hl > .3 ? PAL.mint : '#fff', alpha: a, glow: isMat && hl > 0 ? 'rgba(94,242,176,.8)' : undefined, blur: 18 });
      if (isMat && hl > 0) {
        text('正确答案  ·  the true answer', BARX + w + 126, y, { font: F_UI, size: 22, weight: 600, align: 'left', color: PAL.mint, alpha: a * hl });
        ctx.save(); ctx.globalAlpha = a * hl; rrect(BX + 24, y - 27, BW - 48, 54, 14); ctx.strokeStyle = rgba(PAL.mint, .55 + .3 * Math.sin(lt * 7)); ctx.lineWidth = 2; ctx.shadowColor = PAL.mint; ctx.shadowBlur = 16; ctx.stroke(); ctx.restore();
      }
    });
  }

  // ---- the "goal" line: says what the number is for (sets up the next scene)
  const goal = sstep(6.55, 6.9, lt);
  if (goal > 0) text('目标  ·  goal: raise P(mat), lower the loss', BX + BW / 2, BY + BH - 24, { font: F_UI, weight: 500, size: 24, color: '#9ff3cd', alpha: pa * goal });

  // ---- connection light: the 1 % travels to the loss gauge (the line grows with it), then the gauge counts up
  const CT0 = T_TRUTH + .15, CT1 = 6.0, GT0 = 5.95;                  // light leaves the mat row / reaches the gauge / the gauge starts to count (lands on T_LOSS)
  const gp = sstep(5.3, 5.65, lt), gl_ = sstep(GT0, GT0 + .2, lt), ga = gl_;     // the gauge panel waits, solid and empty, until the 1 % reaches it
  const my = ROW0 + MATROW * ROWP;
  if (lt > CT0) {
    const kk = clamp((lt - CT0) / (CT1 - CT0)), sx = BX + BW - 24, c1x = sx + 40, ex2 = GX, ey = GCY - 20;
    const bez = t => { const u = 1 - t; return [u * u * u * sx + 3 * u * u * t * c1x + 3 * u * t * t * (ex2 - 40) + t * t * t * ex2, u * u * u * my + 3 * u * u * t * my + 3 * u * t * t * ey + t * t * t * ey]; };
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = rgba(PAL.coral, .55); ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -lt * 60;
    ctx.beginPath(); ctx.moveTo(sx, my); for (let q = 1; q <= 24; q++) { const [bx, by] = bez(kk * q / 24); ctx.lineTo(bx, by); } ctx.stroke(); ctx.setLineDash([]);
    if (kk < 1) { const [bx, by] = bez(kk); glowDot(bx, by, 44, 'rgba(255,107,122,A)', .9); }
    else { for (let q = 0; q < 3; q++) { const u = (((lt - CT1) * 1.3 + q / 3) % 1 + 1) % 1, [bx, by] = bez(u); glowDot(bx, by, 26, 'rgba(255,107,122,A)', .8 * Math.sin(PI * u)); } }
    ctx.restore();
  }
  if (gp > 0) {
    const fl = Math.max(lt > T_LOSS ? Math.exp(-(lt - T_LOSS) * 3.5) : 0, lt > 6.875 ? .6 * Math.exp(-(lt - 6.875) * 4) : 0);     // flash on the `down` hit, and once more on the next beat
    const pan = gp * (.75 + .25 * gl_);
    glass(GX, BY, GW, BH, { alpha: pan, r: 24, fill: 'rgba(24,8,18,.9)', stroke: rgba(PAL.coral, .3 + .2 * gl_ + .4 * fl), glow: rgba(PAL.coral, .6 * gl_), blur: 16 + 60 * fl });
    text('损失  ·  LOSS', GCX, BY + 38, { font: F_UI, weight: 600, size: 26, ls: 4, color: '#ffb2ba', alpha: pan });
    text('−ln P(mat)', GCX, BY + 80, { font: F_MATH, weight: 400, size: 40, color: '#f2dfe2', alpha: pan });
    // arc gauge: 0 .. 7
    const lq = Math.floor(lt * 30 + .5) / 30, kk = lt < GT0 ? 0 : eexpo(clamp((lq - GT0) / (T_LOSS - GT0))), val = LOSS * kk, a0 = PI, a1 = TAU, ang = a0 + (a1 - a0) * (val / 7);
    ctx.save(); ctx.globalAlpha = pan; ctx.lineCap = 'round';
    ctx.lineWidth = 16; ctx.strokeStyle = 'rgba(160,190,255,.16)'; ctx.beginPath(); ctx.arc(GCX, GCY, GR, a0, a1); ctx.stroke();
    if (val > .02) {
      ctx.shadowColor = PAL.coral; ctx.shadowBlur = 24; ctx.strokeStyle = PAL.coral; ctx.beginPath(); ctx.arc(GCX, GCY, GR, a0, ang); ctx.stroke(); ctx.shadowBlur = 0;
    }
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(200,215,255,.45)';
    for (let i = 0; i <= 7; i++) { const aa = a0 + (a1 - a0) * i / 7, c = Math.cos(aa), s = Math.sin(aa); ctx.beginPath(); ctx.moveTo(GCX + c * (GR + 20), GCY + s * (GR + 20)); ctx.lineTo(GCX + c * (GR + 32), GCY + s * (GR + 32)); ctx.stroke(); }
    ctx.restore();
    text('0', GCX - GR, GCY + 34, { font: F_MONO, size: 24, color: '#b9cbee', alpha: pan }); text('7', GCX + GR, GCY + 34, { font: F_MONO, size: 24, color: '#b9cbee', alpha: pan });
    if (val > .02) {
      const tx = GCX + Math.cos(ang) * GR, ty = GCY + Math.sin(ang) * GR;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowDot(tx, ty, 34 + 30 * fl, 'rgba(255,107,122,A)', .75); ctx.restore();
    }
    const shown = kk >= .999 ? LOSS : Math.floor(val * 10) / 10;           // quantised so the digits never ghost between sub-frames
    if (val > .02) text(shown.toFixed(1), GCX, GCY - 36, { font: F_MONO, weight: 700, size: 104, color: '#fff', alpha: pan, glow: 'rgba(255,107,122,.95)', blur: 18 + 12 * fl });
    else text('?', GCX, GCY - 36, { font: F_MONO, weight: 700, size: 104, color: '#9fb2d8', alpha: pan * .55 });
    text('= −ln(0.01)', GCX, GCY + 70, { font: F_MATH, weight: 400, size: 38, color: '#ffc4ca', alpha: ga * sstep(6.0, 6.3, lt) });
    const pl = sstep(6.2, 6.55, lt);                       // the plain-words reading of the number
    text('错得越离谱，损失越大', GCX, GCY + 108, { font: F_UI, size: 28, weight: 500, color: '#ffe3e6', alpha: ga * pl });
    text('the more wrong the guess, the bigger the loss', GCX, GCY + 142, { font: F_UI, size: 24, weight: 500, color: '#ffc4ca', alpha: ga * pl });
  }
  ctx.restore();
}
