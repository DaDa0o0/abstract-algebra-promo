// s5_read: pretraining I (2:50 cut, 6 bars = 15 s).
//   Page A (0-7):  a clean torrent of text (five rows, one per source kind), the TOKENS READ counter, the five source tags, the "tens of thousands of years" anchor.
//   Page B (7-15): one example is pulled out of the stream ("The cat sat on the mat"), "mat" is hidden, the UNTRAINED model's flat guess,
//                  the true word drops in (mint), P(mat) = 1 %, and the coral loss gauge: -ln(0.01) = 4.6.
// Beats (0.625 s): 2.5 counter locks, 8.125 example settles, 8.75 mask lands, 11.5625 true word, 12.5 loss lands.
const R = mulberry(20260005);

// ---------------------------------------------------------------- the data: five kinds of source (tag order = row order of the legend)
const CATS = [
  { zh: '书籍', en: 'Books', col: PAL.cyan, font: F_IT, style: 'italic', weight: 600, lines: [
    'It was the best of times, it was the worst of times,', 'Call me Ishmael. Some years ago,',
    'All happy families are alike;', '在很久很久以前，山里有一座小小的寺庙，',
    'Chapter 12. The rain had not stopped.', '“你去哪儿？”她轻声问，没有回头。', 'She walked on through the quiet snow,' ] },
  { zh: '网页', en: 'Web', col: PAL.blue, font: F_UI, style: '', weight: 600, lines: [
    'How to bake sourdough: 7 steps', 'Top 10 hiking trails near you', '欢迎来到我们的网站，请登录或注册',
    'Frequently asked questions', 'Breaking: markets rally', '最新资讯 · 科技 · 生活 · 旅行',
    'Privacy policy  |  Terms of use' ] },
  { zh: '代码', en: 'Code', col: PAL.violet, font: F_MONO, style: '', weight: 500, lines: [
    'def softmax(x): return exp(x)/sum', 'for (let i = 0; i < n; i++)', 'SELECT name FROM users WHERE id = 42;',
    'if (x > 0) { return x; }', 'import numpy as np  # load the data', 'while True: step(model, batch)', '<div class="card">hello</div>' ] },
  { zh: '论文', en: 'Papers', col: PAL.pink, font: F_MATH, style: '', weight: 400, lines: [
    'E = mc²', '∇ · E = ρ / ε₀', '∫ f(x) dx = F(b) − F(a)', 'Abstract. We propose a new network',
    'Σ p(xᵢ) = 1,   p(x) ≥ 0', 'Theorem 2. Prime-order groups are cyclic.', 'λ v = A v' ] },
  { zh: '对话', en: 'Dialogue', col: '#c3f26b', font: F_UI, style: '', weight: 500, lines: [
    '“Where are you going?”', 'A: Can you help me with this?', '你吃饭了吗？还没呢！', 'Thanks so much, that really helped!',
    'Q: Why is the sky blue?', '好的，没问题，明天见！', 'haha ok see you at 8 then' ] },
];
const SENT = 'The cat sat on the mat';
const PRE = 'The cat sat on the ';
const SENT_SIZE = 92, SENT_Y = 236, SLOTDX = 16;

// ---------------------------------------------------------------- the torrent: five rows, each in its own horizontal band (never overlapping)
// c = source kind (index into CATS), y = band centre, size = text size, v = px/s (sign = direction, all <= 340 so the text stays crisp), a = brightness
const ROWS = [
  { c: 0, y: 178, size: 34, v: -240, a: .8,  ph: R() * 3000 },
  { c: 1, y: SENT_Y, size: 44, v: 300, a: .92, ex: true },          // the web row carries the example sentence
  { c: 3, y: 292, size: 30, v: -190, a: .78, ph: R() * 3000 },
  { c: 2, y: 796, size: 30, v: 340, a: .8,  ph: R() * 3000 },
  { c: 4, y: 850, size: 36, v: -280, a: .9,  ph: R() * 3000 },
];
const GAP = 110, EX_X0 = 780, T_EXR = 7.15;                         // the example is at x 780 at t = 7.3 (it enters from the left around 4.8 s)
const T_ROWFADE = 6.9, T_ROWGONE = 7.3;
const T_GLIDE1 = 8.125;                                            // example settled in the middle (beat 13)
const DUST = Array.from({ length: 120 }, () => ({ x: R() * W, y: 150 + R() * 740, z: .3 + R() * .7, p: R() * TAU }));

// ---------------------------------------------------------------- page A timings
const T_CNT0 = .45, T_CNT = 2.5;                                  // counter races .45 -> 2.5 and locks on beat 4
const TAGS = [3.125, 3.28125, 3.4375, 3.59375, 3.75];             // source tags, sixteenth notes after the lock
const T_ANCH = 4.375;                                             // the anchor lands on the eighth after the tags
const CNT_FINAL = '10,000,000,000,000';
const grpOut = lt => 1 - sstep(6.9, 7.3, lt);
const grpIn = lt => sstep(.3, .65, lt);

// ---------------------------------------------------------------- page B timings and geometry
const T_LOCK = T_GLIDE1, T_MASK0 = 8.4, T_MASK1 = 8.75, T_PANEL = 8.75, T_BAR0 = 8.95, T_TRUTH = 11.5625, T_LOSS = 12.5;
const GT0 = 12.2;                                                  // the gauge starts to count (lands on T_LOSS)
const BX = 100, BY = 392, BW = 900, BH = 470, GX = 1070, GW = 740;
const BARX = BX + 270, ROW0 = BY + 106, ROWP = 54, UNIT = 4200, TH = 28;
const UNT = STORY.untrained;
const MATROW = UNT.findIndex(r => r[0] === 'mat');
const GCX = GX + GW / 2, GCY = 668, GR = 140, LOSS = -Math.log(.01);
let wPre = 0, wMat = 0, wFull = 0;                                 // measured at draw time, after the fonts are loaded
function layout() { wPre = measure(PRE, SENT_SIZE, F_UI, 600); wMat = measure('mat', SENT_SIZE, F_UI, 600); wFull = wPre + wMat; }
const hex2 = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mixH = (a, b, t) => { const A = hex2(a), B = hex2(b); const c = i => Math.round(lerp(A[i], B[i], clamp(t))).toString(16).padStart(2, '0'); return '#' + c(0) + c(1) + c(2); };
const SPR = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(190,225,255,1)'); g.addColorStop(.35, 'rgba(120,170,255,.5)'); g.addColorStop(1, 'rgba(120,170,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return c; })();

scene({
  id: 'read', start: 32, len: 6, mb: 2, bloom: 1, fo: .25, grade: { ca: .0012 },
  ch: ['05', '预训练', 'PRETRAINING'],
  subs: [
    [0.4, 3.7, '它是怎么学会的？先读——', 'How did it learn? First, by reading —'],
    [3.9, 6.9, '书籍、网页、代码……数万亿个词', 'books, web pages, code… trillions of words'],
    [7.3, 11.7, '练习很简单：遮住下一个词，让它去猜', 'The exercise is simple: hide the next word and let it guess'],
    [12.0, 14.8, '猜得越离谱，“损失”越大', 'The further off, the bigger the loss'],
  ],
  sfx: [
    [0.0, 'whoosh', { dur: 1.5 }], [T_CNT0, 'count', { dur: T_CNT - T_CNT0 }],
    [T_CNT, 'hit', { k: .5 }],
    ...TAGS.map((t, i) => [t, 'chip', { midi: 62 + [0, 2, 4, 7, 9][i] }]),
    [T_ANCH, 'chime', { midi: 79 }], [T_ANCH + .02, 'sparkle', { dur: 1 }],
    [6.9, 'swish', { pitch: .8 }], [7.3, 'whoosh', { dur: .8 }],
    [T_LOCK, 'chip', { midi: 72 }],
    [T_MASK0, 'swish', { pitch: 1.1 }], [T_MASK1, 'pop'],
    [T_PANEL, 'pop'], ...UNT.map((_, i) => [T_BAR0 + i * .1, 'blip', { midi: 55 + i * 2 }]),
    [T_TRUTH, 'chip', { midi: 79 }], [T_TRUTH, 'up'],
    [11.95, 'scan', { dur: .4 }], [GT0, 'count', { dur: T_LOSS - GT0 }], [T_LOSS, 'down'], [T_LOSS, 'hit', { k: .4 }], [13.125, 'thump'],
  ],
  hits: [[T_CNT, .3], [T_LOSS, .35]],
  cam: lt => ({ z: 1 + .03 * lt / 15 + .014 * Math.exp(-Math.pow(lt - T_CNT, 2) * 3) + .012 * Math.exp(-Math.pow(lt - T_LOSS, 2) * 3), x: 5 * Math.sin(lt * .21), y: 3 * Math.sin(lt * .17 + 1) }),

  draw(lt) {
    layout();
    const lq = Math.round(lt * 30) / 30;                           // UI text and counters use the exact frame time in every motion-blur sub-frame
    const b2 = sstep(6.9, 8.0, lt);                                // 0 = torrent page, 1 = example page

    // ---- backdrop: cool grid floor racing under the horizon, dimmer on page B
    glDraw(2, { time: lt * 1.15 + 40, tint: [.07, .2, .52], amp: lerp(.8, .5, b2), horizon: -.04 });
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    glowDot(960, 505, 520 * (1 + .05 * Math.sin(lt * 5)), 'rgba(70,130,255,A)', .2 * (1 - .6 * b2));
    ctx.restore();
    // ---- ambient motes (depth): tiny soft points drifting slowly
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const d of DUST) {
      const x = ((d.x + lt * 9 * d.z) % W + W) % W, y = d.y + Math.sin(lt * .4 + d.p) * 6, s = 3 + d.z * 6;
      ctx.globalAlpha = (.18 + .22 * d.z) * (.6 + .4 * Math.sin(lt * 1.3 + d.p)) * (1 - .5 * b2);
      ctx.drawImage(SPR, x - s, y - s, 2 * s, 2 * s);
    }
    ctx.restore();

    const ex = rows(lq, lt);
    if (lt < 7.4) counterGroup(lq, lq);
    if (lt >= T_ROWFADE - .01) hero(lq, ex);
    if (lt > 7.6) beatTwo(lq, lq);
  },
});

// ================================================================ page A: rows
function rowGeo(row) {
  const cat = CATS[row.c], font = `${cat.style} ${cat.weight} ${row.size}px ${cat.font}`;
  const lines = row.ex ? [...cat.lines.slice(0, 3), SENT, ...cat.lines.slice(3)] : cat.lines;
  ctx.save(); ctx.font = font;
  let segs = [], cum = 0; for (const s of lines) { const w = ctx.measureText(s).width; segs.push({ s, w, cum }); cum += w + GAP; }
  ctx.restore();
  const maxw = Math.max(...segs.map(s => s.w)), reps = row.ex ? 1 : Math.ceil((W + 2 * maxw + 2 * GAP) / cum);
  if (reps > 1) { const base = segs.slice(); for (let r = 1; r < reps; r++) for (const s of base) segs.push({ s: s.s, w: s.w, cum: s.cum + r * cum }); }
  return { cat, font, segs, chainW: cum * reps, off: maxw + GAP };
}
const modp = (a, n) => ((a % n) + n) % n;
// draws the five rows; returns the example's current row state (centre x, width) for the hero
function rows(lq, lt) {
  const out = 1 - sstep(T_ROWFADE, T_ROWGONE, lt), tgs = CATS.map((_, i) => lt > TAGS[i] ? Math.exp(-(lt - TAGS[i]) * 1.5) : 0);
  let exs = null;
  for (const row of ROWS) {
    const g = rowGeo(row), cat = g.cat;
    let phase = row.ph || 0;
    if (row.ex) { const s = g.segs.find(q => q.s === SENT); phase = EX_X0 - s.w / 2 - s.cum - row.v * T_EXR; }
    const shift = row.v * lt + phase, tg = tgs[row.c], a = clamp(row.a * (1 + .7 * tg)) * out * sstep(0, .35, lt);
    if (row.ex) { const s = g.segs.find(q => q.s === SENT); exs = { cx: modp(s.cum + row.v * lq + phase + g.off, g.chainW) - g.off + s.w / 2, w: s.w, size: row.size, a: row.a }; }
    if (a < .01) continue;
    const col = mixH(cat.col, '#ffffff', .35 * tg), c3 = hex2(col);
    const gr = ctx.createLinearGradient(0, 0, W, 0);
    gr.addColorStop(0, `rgba(${c3},0)`); gr.addColorStop(.13, `rgba(${c3},${a})`); gr.addColorStop(.87, `rgba(${c3},${a})`); gr.addColorStop(1, `rgba(${c3},0)`);
    ctx.save(); ctx.font = g.font; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = gr;
    if (tg > .1) { ctx.shadowColor = cat.col; ctx.shadowBlur = 16 * tg; }
    for (const s of g.segs) {
      if (row.ex && s.s === SENT && lt >= T_ROWFADE) continue;     // from here the hero draws the example
      const p = modp(s.cum + shift + g.off, g.chainW) - g.off;
      if (p > W + 10 || p + s.w < -10) continue;
      ctx.fillText(s.s, p, row.y);
    }
    ctx.restore();
  }
  return exs;
}

// ================================================================ page A: counter, source tags, anchor
function counterGroup(lq, lt) {
  const ga = grpIn(lt) * grpOut(lt); if (ga < .01) return;
  const size = 96, wFin = measure(CNT_FINAL, size, F_MONO, 700), wPlus = measure('+', size, F_MONO, 700), xr = W / 2 + (wFin - wPlus) / 2;
  const k = clamp((lq - T_CNT0) / (T_CNT - T_CNT0 - .02)), p = 1 - Math.pow(1 - k, 1.5), v = Math.pow(10, 1.6 + 11.4 * p);
  let digs = String(Math.round(v)); if (k >= 1) digs = '10000000000000';
  if (k < 1) digs = [...digs].map((c, i) => i < 2 ? c : String(Math.floor(hash1(Math.floor(lq * 15 + .25) * 13 + i * 5.3) * 10))).join('');
  const s = digs.replace(/\B(?=(\d{3})+(?!\d))/g, ','), lock = lt >= T_CNT ? lt - T_CNT : -1, flash = lock >= 0 ? Math.exp(-lock * 4) : 0;
  text('已读词元  ·  TOKENS READ', W / 2, 352, { font: F_UI, weight: 600, size: 32, ls: 7, color: '#c6e8ff', alpha: ga });
  const cw = measure('0', size, F_MONO, 700), left = xr - cw * CNT_FINAL.length, pad = CNT_FINAL.length - s.length;   // odometer: dim placeholders to the left of the live digits
  for (let i = 0; i < CNT_FINAL.length; i++) {
    const live = i >= pad, ch = live ? s[i - pad] : (CNT_FINAL[i] === ',' ? ',' : '0');
    text(ch, left + i * cw + cw / 2, 442, { font: F_MONO, weight: 700, size, color: '#fff', alpha: ga * (live ? 1 : .13), glow: live ? 'rgba(110,190,255,.9)' : undefined, blur: 16 + 12 * flash });
  }
  if (lock >= 0) {
    const e = eback(clamp(lock / .45));
    text('+', xr + wPlus / 2 + 4, 442 - (1 - e) * 24, { font: F_MONO, weight: 700, size, color: PAL.cyan, alpha: ga * clamp(lock / .15), glow: 'rgba(110,190,255,.9)', blur: 24 });
    flare(W / 2, 442, Math.exp(-lock * 9) * .4 * ga, 760);
  }
  text('数量级示意  ·  illustrative scale', W / 2, 510, { font: F_UI, weight: 500, size: 24, color: '#aac8f2', alpha: ga * sstep(2.7, 3.1, lt) });
  // source tags: each lights its own row of text
  const ty = 582, TAGW = CATS.map(c => measure(c.zh + '  ' + c.en, 32, F_UI, 500) + 56), GAPT = 22, TOT = TAGW.reduce((a, b) => a + b, 0) + GAPT * 4; let x = W / 2 - TOT / 2;
  CATS.forEach((c, i) => {
    const kk = clamp((lt - TAGS[i]) / .45), cxm = x + TAGW[i] / 2; x += TAGW[i] + GAPT;
    if (kk <= 0) return;
    const e = eback(kk), al = ga * clamp(kk * 3), fl = Math.exp(-(lt - TAGS[i]) * 5);
    ctx.save(); ctx.translate(cxm, ty + (1 - e) * 30);
    ctx.save(); ctx.globalAlpha = al * .9; rrect(-TAGW[i] / 2, -28, TAGW[i], 56, 15); ctx.fillStyle = 'rgba(3,8,20,.92)'; ctx.fill(); ctx.restore();
    chip(c.zh + '  ' + c.en, 0, 0, { size: 32, font: F_UI, weight: 500, color: c.col, textColor: mixH(c.col, '#ffffff', .8), pad: 28, h: 56, alpha: al, glow: 8 + 20 * fl, fillA: .12 + .3 * fl, strokeA: 1 });
    ctx.restore();
  });
  // anchor: a rough sense of the scale in human terms
  const aa = ga * sstep(T_ANCH, T_ANCH + .5, lt);
  if (aa > .01) {
    const pw = 1160, ph = 112, cy = 692, px = W / 2 - pw / 2, k2 = eout(clamp((lt - T_ANCH) / .6));
    ctx.save(); ctx.translate(0, (1 - k2) * 18);
    glass(px, cy - ph / 2, pw, ph, { alpha: aa, r: 26, fill: 'rgba(5,10,26,.9)', stroke: 'rgba(255,200,130,.5)', glow: 'rgba(255,180,90,.25)', blur: 24 });
    const ix = px + 84;                                             // a clock: time, with a slow hand
    ctx.save(); ctx.globalAlpha = aa; ctx.lineWidth = 4; ctx.strokeStyle = PAL.amber; ctx.shadowColor = PAL.amber; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(ix, cy, 34, 0, TAU); ctx.stroke(); ctx.shadowBlur = 0; ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,200,130,.6)';
    for (let i = 0; i < 12; i++) { const an = i * TAU / 12; ctx.beginPath(); ctx.moveTo(ix + Math.cos(an) * 27, cy + Math.sin(an) * 27); ctx.lineTo(ix + Math.cos(an) * 31, cy + Math.sin(an) * 31); ctx.stroke(); }
    const hand = lt * TAU / 7 - PI / 2; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(ix, cy); ctx.lineTo(ix + Math.cos(hand) * 24, cy + Math.sin(hand) * 24); ctx.stroke();
    ctx.restore();
    text('≈ 一个人不眠不休读数万年', px + 160, cy - 22, { font: F_ZH, weight: 700, size: 40, align: 'left', color: '#fff', alpha: aa });
    text('roughly tens of thousands of years of nonstop human reading', px + 160, cy + 26, { font: F_UI, weight: 500, size: 28, align: 'left', color: '#ffe2b8', alpha: aa });
    ctx.restore();
  }
}

// ================================================================ the example sentence: leaves the stream, grows, settles; the mask and the true word
function hero(lt, ex) {
  const u = clamp((lt - T_EXR) / (T_GLIDE1 - T_EXR)), e = sstep(0, 1, u), rowc = ex.cx;
  const cx = lerp(rowc, W / 2, e), sc = lerp(ex.size / SENT_SIZE, 1, e), kc = sstep(6.9, 7.9, lt);
  const a = lerp(ex.a, 1, kc) * sstep(0, .35, lt);
  ctx.save(); ctx.translate(cx, SENT_Y); ctx.scale(sc, sc);
  if (u > 0) { const f = Math.exp(-Math.max(0, lt - T_LOCK) * 5.5) * (lt >= T_LOCK ? 1 : 0); if (f > .02) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowDot(0, 0, 520, 'rgba(255,222,150,A)', .3 * f); ctx.restore(); } }
  drawSentence(lt, a, mixH(PAL.blue, '#f4f9ff', kc), sstep(7.0, 7.9, lt));
  ctx.restore();
}
// the sentence in local coords (centre 0,0, base size SENT_SIZE)
function drawSentence(lt, a, col, glowA) {
  const x0 = -wFull / 2, S = SENT_SIZE, gl_ = `rgba(120,190,255,${.42 * glowA})`;
  const wf = clamp((lt - 8.25) / .2);                                // the visible "mat" fades out first ...
  const mk = eio(clamp((lt - T_MASK0) / (T_MASK1 - T_MASK0)));       // ... then the mask wipes in over its slot (lands on beat 14)
  const drop = clamp((lt - T_TRUTH) / .6), de = eout(drop);          // the true word settles into the slot
  text(PRE.trimEnd(), x0, 0, { font: F_UI, weight: 600, size: S, align: 'left', color: col, alpha: a, glow: glowA > .02 ? gl_ : undefined, blur: 14 });
  const mx = x0 + wPre + SLOTDX;
  const wordA = a * (1 - wf) * (1 - clamp(drop * 4));
  if (wordA > .01) text('mat', x0 + wPre, 0, { font: F_UI, weight: 600, size: S, align: 'left', color: col, alpha: wordA, glow: glowA > .02 ? gl_ : undefined, blur: 14 });
  if (mk > 0) {
    const padX = 10, h = S * 1.2, answered = drop > 0;
    const c2 = answered ? PAL.mint : PAL.cyan, pulse = .5 + .5 * Math.sin(lt * 6);
    glass(mx - padX, -h / 2, Math.max(4, (wMat + padX * 2) * mk), h, { r: 22, fill: answered ? 'rgba(10,40,34,.78)' : 'rgba(10,24,52,.88)', stroke: rgba(c2, .95), lw: 3, glow: rgba(c2, .8 * clamp(mk * 2)), blur: 24 + 10 * pulse * (answered ? 0 : 1), alpha: clamp(mk * 4) });
    const qa = a * sstep(.5, 1, mk) * (1 - sstep(0, .2, drop));      // the "?" is gone before the true word falls into the slot
    if (qa > .01) text('?', mx + wMat / 2, S * .02, { font: F_UI, weight: 700, size: S, color: '#fff', alpha: qa, glow: 'rgba(120,200,255,.9)', blur: 20 + 8 * pulse });
    if (answered) {
      text('mat', mx, -(1 - de) * 46, { font: F_UI, weight: 600, size: S, align: 'left', color: PAL.mint, alpha: a * sstep(.15, .5, drop), glow: 'rgba(94,242,176,.8)', blur: 18 });
      const ring = 1 - drop;
      if (ring > 0 && ring < 1) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = rgba(PAL.mint, .6 * ring); ctx.lineWidth = 3; rrect(mx - padX - 40 * drop, -h / 2 - 40 * drop, wMat + padX * 2 + 80 * drop, h + 80 * drop, 30); ctx.stroke(); ctx.restore(); }
    }
  }
}

// ================================================================ page B: bars, truth, loss gauge
// the probability bar, same look as s4_predict: label left (Inter 600, right-aligned), glowing capsule, percentage right of the tip in mono
function pbar(label, p, y, o) {
  const { k, a, hot = 0, other = false } = o, size = 32;
  const len = other ? 250 * k : Math.max(TH, p * UNIT * k), tipX = BARX + len, fullTip = BARX + (other ? 250 : Math.max(TH, p * UNIT)), a2 = a * clamp(k * 5);
  if (a2 < .01) return;
  ctx.save(); ctx.globalAlpha = a2 * .55; rrect(BARX, y - TH / 2, 500, TH, TH / 2); ctx.fillStyle = 'rgba(150,185,255,.07)'; ctx.fill();   // faint track
  ctx.globalAlpha = a2;
  const g = ctx.createLinearGradient(BARX, 0, BARX + Math.max(len, 80), 0);
  if (other) { g.addColorStop(0, '#4b5f8f'); g.addColorStop(1, '#8fa4d6'); } else { g.addColorStop(0, mixH('#2fa6e0', '#1fbf86', hot)); g.addColorStop(1, mixH('#6a4ff0', '#8dffd0', hot)); }
  ctx.shadowColor = hot > .01 ? 'rgba(94,242,176,.7)' : 'rgba(110,170,255,.7)'; ctx.shadowBlur = 14 + 6 * hot;
  rrect(BARX, y - TH / 2, len, TH, TH / 2); ctx.fillStyle = g; ctx.fill(); ctx.shadowBlur = 0;
  ctx.globalAlpha = a2 * .16; rrect(BARX + 4, y - TH / 2 + 3, Math.max(0, len - 8), TH * .3, TH * .15); ctx.fillStyle = '#fff'; ctx.fill();   // top sheen
  if (other && k > .5) {                                              // axis break: this bar is not to scale
    const bx = BARX + 168;
    ctx.globalAlpha = a2; ctx.fillStyle = 'rgba(5,10,26,1)'; ctx.beginPath(); ctx.moveTo(bx - 4, y + TH / 2 + 4); ctx.lineTo(bx + 8, y - TH / 2 - 4); ctx.lineTo(bx + 22, y - TH / 2 - 4); ctx.lineTo(bx + 10, y + TH / 2 + 4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(210,225,255,.85)'; ctx.lineWidth = 2.5; for (const dx of [-4, 10]) { ctx.beginPath(); ctx.moveTo(bx + dx, y + TH / 2 + 4); ctx.lineTo(bx + dx + 12, y - TH / 2 - 4); ctx.stroke(); }
  }
  ctx.globalCompositeOperation = 'lighter';
  { const c0 = hot > .3 ? '110,255,190' : other ? '150,175,235' : '120,170,255', gg = ctx.createRadialGradient(tipX - TH / 2, y, 0, tipX - TH / 2, y, TH * 1.5); gg.addColorStop(0, `rgba(${c0},${(other ? .22 : .32) * a2})`); gg.addColorStop(1, `rgba(${c0},0)`); ctx.fillStyle = gg; ctx.fillRect(tipX - TH * 2, y - TH * 1.5, TH * 3, TH * 3); }
  ctx.restore();
  text(label, BARX - 28, y + 1, { font: F_UI, weight: 600, size, color: mixH('#dfe9ff', PAL.mint, hot), alpha: a, align: 'right' });
  const pa = sstep(.55, 1, k);
  if (pa > 0) text(`${Math.round(p * 100)}%`, fullTip + 20, y + 1, { font: F_MONO, weight: 700, size, color: mixH('#ffffff', PAL.mint, hot), alpha: a * pa, align: 'left' });
}

function beatTwo(lq, lt) {
  const LY = SENT_Y + 112;
  const ex = sstep(7.7, 8.0, lt) * (1 - sstep(8.3, 8.55, lt)), hid = sstep(8.85, 9.15, lt) * (1 - sstep(11.3, 11.55, lt)), tru = sstep(11.8, 12.1, lt);
  const slotX = W / 2 - wFull / 2 + wPre + SLOTDX + wMat / 2;
  if (ex > 0) text('海量文本中的一个训练样例  ·  one training example from the data', W / 2, LY, { font: F_UI, weight: 500, size: 28, color: '#b4d0f6', alpha: ex });
  if (hid > 0) text('被遮住的下一个词  ·  the hidden next word', slotX, LY, { font: F_UI, weight: 500, size: 28, color: '#b4d0f6', alpha: hid });
  if (tru > 0) text('真正的下一个词  ·  the true next word', slotX, LY, { font: F_UI, weight: 500, size: 28, color: PAL.mint, alpha: tru });

  // ---- the untrained model's guess (the panel appears together with its first bars)
  const pa = sstep(T_PANEL, T_PANEL + .3, lt), hl = sstep(T_TRUTH + .35, T_TRUTH + .7, lt), tr = sstep(T_TRUTH + .2, T_TRUTH + .55, lt);
  if (pa > 0) {
    glass(BX, BY, BW, BH, { alpha: pa, r: 24, fill: 'rgba(5,10,26,.9)', stroke: 'rgba(150,190,255,.3)' });
    text('未训练的模型的猜测  ·  UNTRAINED MODEL’S GUESS', BX + 40, BY + 38, { font: F_UI, weight: 600, size: 24, ls: 2, align: 'left', color: '#c4d8fa', alpha: pa });
    text('示意数值  ·  e.g. illustrative values', BX + 40, BY + 72, { font: F_UI, weight: 500, size: 24, align: 'left', color: '#b0c4ec', alpha: pa });
    UNT.forEach(([label, p], i) => {
      const t0 = T_BAR0 + i * .1, k = eout(clamp((lq - t0) / .45)); if (k <= 0) return;
      const other = label === '…', y = ROW0 + i * ROWP + (other ? 10 : 0), isMat = i === MATROW;
      const dim = 1 - .35 * hl * (isMat ? 0 : 1);
      pbar(other ? '其他词 other' : label, p, y, { k, a: pa * dim, hot: isMat ? tr : 0, other });
      if (isMat && hl > 0) {
        const fa = pa * hl; text('正确答案  ·  the true answer', BARX + p * UNIT + 126, y, { font: F_UI, size: 24, weight: 600, align: 'left', color: PAL.mint, alpha: fa });
        ctx.save(); ctx.globalAlpha = fa; rrect(BX + 18, y - 28, BW - 36, 56, 16); ctx.strokeStyle = rgba(PAL.mint, .5 + .25 * Math.sin(lt * 5)); ctx.lineWidth = 2; ctx.shadowColor = PAL.mint; ctx.shadowBlur = 14; ctx.stroke(); ctx.restore();
      }
    });
  }
  // ---- the goal line: says what the number is for (sets up the next scene)
  const goal = sstep(13.3, 13.65, lt);
  if (goal > 0) text('目标  ·  goal: raise P(mat), lower the loss', BX + BW / 2, BY + BH - 30, { font: F_UI, weight: 500, size: 26, color: '#9ff3cd', alpha: pa * goal });

  // ---- connection light: the 1 % travels from the mat row to the loss gauge, then the gauge counts up
  const CT0 = 11.95, CT1 = 12.35, my = ROW0 + MATROW * ROWP;
  const gp = sstep(11.8, 12.1, lt), gl_ = sstep(GT0, GT0 + .15, lt);
  if (lt > CT0) {
    const kk = clamp((lt - CT0) / (CT1 - CT0)), sx = BX + BW - 18, c1x = sx + 40, ex2 = GX, ey = GCY - 20;
    const bez = t => { const u = 1 - t; return [u * u * u * sx + 3 * u * u * t * c1x + 3 * u * t * t * (ex2 - 40) + t * t * t * ex2, u * u * u * my + 3 * u * u * t * my + 3 * u * t * t * ey + t * t * t * ey]; };
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = rgba(PAL.coral, .55); ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -lt * 40;
    ctx.beginPath(); ctx.moveTo(sx, my); for (let q = 1; q <= 24; q++) { const [bx, by] = bez(kk * q / 24); ctx.lineTo(bx, by); } ctx.stroke(); ctx.setLineDash([]);
    if (kk < 1) { const [bx, by] = bez(kk); glowDot(bx, by, 44, 'rgba(255,107,122,A)', .9); }
    else { for (let q = 0; q < 3; q++) { const u = (((lt - CT1) * .9 + q / 3) % 1 + 1) % 1, [bx, by] = bez(u); glowDot(bx, by, 26, 'rgba(255,107,122,A)', .8 * Math.sin(PI * u)); } }
    ctx.restore();
  }
  if (gp > 0) {
    const fl = lt > T_LOSS ? Math.exp(-(lt - T_LOSS) * 3.5) : 0;
    const pan = gp * (.8 + .2 * gl_);
    glass(GX, BY, GW, BH, { alpha: pan, r: 24, fill: 'rgba(24,8,18,.93)', stroke: rgba(PAL.coral, .3 + .2 * gl_ + .4 * fl), glow: rgba(PAL.coral, .5 * gl_), blur: 16 + 50 * fl });
    text('损失  ·  LOSS', GCX, BY + 38, { font: F_UI, weight: 600, size: 28, ls: 4, color: '#ffc0c7', alpha: pan });
    text('−ln P(mat)', GCX, BY + 84, { font: F_MATH, weight: 400, size: 42, color: '#f7e6e9', alpha: pan });
    const kk = lt < GT0 ? 0 : eexpo(clamp((lq - GT0) / (T_LOSS - GT0))), val = LOSS * kk, a0 = PI, a1 = TAU, ang = a0 + (a1 - a0) * (val / 7);
    ctx.save(); ctx.globalAlpha = pan; ctx.lineCap = 'round';
    ctx.lineWidth = 16; ctx.strokeStyle = 'rgba(160,190,255,.16)'; ctx.beginPath(); ctx.arc(GCX, GCY, GR, a0, a1); ctx.stroke();
    if (val > .02) { ctx.shadowColor = PAL.coral; ctx.shadowBlur = 22; ctx.strokeStyle = PAL.coral; ctx.beginPath(); ctx.arc(GCX, GCY, GR, a0, ang); ctx.stroke(); ctx.shadowBlur = 0; }
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(200,215,255,.45)';
    for (let i = 0; i <= 7; i++) { const aa = a0 + (a1 - a0) * i / 7, c = Math.cos(aa), s = Math.sin(aa); ctx.beginPath(); ctx.moveTo(GCX + c * (GR + 20), GCY + s * (GR + 20)); ctx.lineTo(GCX + c * (GR + 32), GCY + s * (GR + 32)); ctx.stroke(); }
    ctx.restore();
    text('0', GCX - GR, GCY + 36, { font: F_MONO, size: 26, color: '#d2defa', alpha: pan }); text('7', GCX + GR, GCY + 36, { font: F_MONO, size: 26, color: '#d2defa', alpha: pan });
    if (val > .02) { const tx = GCX + Math.cos(ang) * GR, ty = GCY + Math.sin(ang) * GR; ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowDot(tx, ty, 34 + 26 * fl, 'rgba(255,107,122,A)', .75); ctx.restore(); }
    const shown = kk >= .999 ? LOSS : Math.floor(val * 10) / 10;
    if (val > .02) text(shown.toFixed(1), GCX, GCY - 36, { font: F_MONO, weight: 700, size: 104, color: '#fff', alpha: pan, glow: 'rgba(255,107,122,.9)', blur: 16 + 12 * fl });
    else text('?', GCX, GCY - 36, { font: F_MONO, weight: 700, size: 104, color: '#9fb2d8', alpha: pan * .55 });
    text('= −ln(0.01)', GCX, GCY + 74, { font: F_MATH, weight: 400, size: 40, color: '#ffd0d5', alpha: pan * sstep(12.3, 12.6, lt) });
    const pl = sstep(12.7, 13.05, lt);                                // the plain-words reading of the number
    text('错得越离谱，损失越大', GCX, GCY + 124, { font: F_UI, size: 30, weight: 500, color: '#ffe8ea', alpha: pan * pl });
    text('the more wrong the guess, the bigger the loss', GCX, GCY + 160, { font: F_UI, size: 26, weight: 500, color: '#ffcdd2', alpha: pan * pl });
  }
}
