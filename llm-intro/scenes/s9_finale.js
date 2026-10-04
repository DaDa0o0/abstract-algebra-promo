// s9_finale (2:35-2:50): the whole pipeline lights up icon by icon -> everything collapses to one gold caret -> the title returns -> black.
// Local timeline (seconds):
//   0.4-3.5  Page A1: Text, Tokens, Vectors, Attention, Prediction cards appear and light in turn (a signal travels with the light)
//   4.4-6.5  Page A2: the training row (Pretraining, Fine-tuning) appears and lights;  6.5-8.5 HOLD: the complete chain, nothing on top of it
//   8.5-9.2  exit: text leaves first, then the cards shrink into particles that gather into one gold caret
//   9.2-10.0 the lone caret blinks;  10.0 hit + the gold title (held 10.6-14.0);  14.0-14.85 fade to black
const R = mulberry(20260009);

// ---------------------------------------------------------------- constant tables
const ROW1 = [['文字', 'TEXT'], ['词元', 'TOKENS'], ['向量', 'VECTORS'], ['注意力', 'ATTENTION'], ['预测', 'PREDICTION']].map((l, i) => {
  const tc = .9375 + i * .625;                                         // lighting times on the 1/8-note grid: 0.94, 1.56, 2.19, 2.81, 3.44
  return { zh: l[0], en: l[1], cx: 960 + (i - 2) * 345, cy: 380, w: 280, h: 300, s: 1, tc, t0: tc - .6 };
});
const ROW2 = [['预训练', 'PRETRAINING', 5.0, 4.4], ['微调', 'FINE-TUNING', 6.25, 5.65]].map((l, i) =>
  ({ zh: l[0], en: l[1], cx: 665 + i * 590, cy: 760, w: 500, h: 190, s: 1, tc: l[2], t0: l[3] }));
const ALLC = [...ROW1, ...ROW2];
const T_OUT = 8.5, T_COL = 8.65, T_COL_D = .55;                       // text starts leaving / cards start shrinking / shrink length
const T_HIT = 10.0, T_TITLE = 10.0;                                   // beat 16
const CX = 960, CY = 470, HY = 600;                                   // the caret / title centre; the heading between the two rows

const DUST = Array.from({ length: 150 }, () => ({ x: R() * W, y: R() * H, z: .15 + R() * .85, p: R() * TAU }));
const LOSSN = Array.from({ length: 34 }, () => (R() - .5));
const PART = Array.from({ length: 360 }, () => {                      // particles that fly from the pipeline into the caret
  const c = ALLC[R() < .72 ? Math.floor(R() * 5) : 5 + Math.floor(R() * 2)];
  return { x: c.cx + (R() - .5) * c.w * .9, y: c.cy + (R() - .5) * c.h * .9, d: R() * .22, sw: (R() - .5) * 2, r: .8 + R() * 2.2,
    col: [PAL.cyan, PAL.violet, PAL.blue, PAL.text, PAL.gold][Math.floor(R() * 5)] };
});

// ---------------------------------------------------------------- tiny helpers (alpha-aware via GA)
let GA = 1;
const tx = (s, x, y, o = {}) => text(s, x, y, { ...o, alpha: (o.alpha ?? 1) * GA });
const gls = (x, y, w, h, o = {}) => glass(x, y, w, h, { ...o, alpha: (o.alpha ?? 1) * GA });
const orb = (x, y, r, a = 1, col = 'rgba(110,190,255,A)') => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowDot(x, y, r, col, a * GA); ctx.restore(); };
function bar(x, y, w, h, col, a, glow = 0) {
  ctx.save(); ctx.globalAlpha = a * GA; if (glow) { ctx.shadowColor = col; ctx.shadowBlur = glow; }
  rrect(x, y, w, h, Math.min(h / 2, 8)); ctx.fillStyle = col; ctx.fill(); ctx.restore();
}
function mycaret(x, y, h, a = 1, col = PAL.gold, w = 0, blur = 18) {
  if (a <= 0) return; ctx.save(); ctx.globalAlpha = a * GA; ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = blur;
  ctx.fillRect(x, y - h / 2, w || Math.max(3, h * .09), h); ctx.restore();
}
function chevron(x, y, s, col, a, lw = 3) {
  ctx.save(); ctx.globalAlpha = a * GA; ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x - s * .5, y - s); ctx.lineTo(x + s * .5, y); ctx.lineTo(x - s * .5, y + s); ctx.stroke(); ctx.restore();
}
const lightAt = (lt, tc) => Math.exp(-Math.pow((lt - tc) / .27, 2)) + .3 * sstep(tc - .05, tc + .35, lt);
function softGlow(x, y, r, R_, G_, B_, a) {                          // gaussian-ish falloff: no visible disc edge
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  for (let i = 0; i <= 8; i++) { const u = i / 8; g.addColorStop(u, `rgba(${R_},${G_},${B_},${a * Math.exp(-4 * u * u) * (1 - u * u * u)})`); }
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
}

// ---------------------------------------------------------------- pipeline icons (local coords: icon centre = 0,0)
function icText(lit, lt) {
  tx('The cat sat', -100, -24, { font: F_UI, size: 34, color: '#fff', align: 'left', weight: 500 });
  tx('on the', -100, 24, { font: F_UI, size: 34, color: '#fff', align: 'left', weight: 500 });
  mycaret(-100 + measure('on the', 34, F_UI, 500) + 7, 24, 38, Math.floor(lt * 2.2) % 2 ? .15 : 1);
}
function icTokens(lit) {
  const rows = [[-28, ['The', 'cat', 'sat'], [-84, 0, 84], 0], [26, ['on', 'the'], [-42, 42], 3]];
  for (const [y, ls, xs, o] of rows) ls.forEach((l, i) => chip(l, xs[i], y, { size: 26, h: 44, pad: 12, color: HUES[i + o], lw: 1.8, alpha: GA, fillA: .2 + .08 * Math.min(1, lit) }));
}
const VCL = [                                                           // Vectors icon: three clear clusters of word-points (animals, places to sit, royalty)
  { col: PAL.cyan, pts: [[-66, -22], [-38, -34], [-56, 6], [-26, -4], [-76, -50]] },   // 0 = cat, 1 = dog
  { col: PAL.violet, pts: [[40, -44], [66, -26], [52, -8], [82, -52]] },
  { col: PAL.mint, pts: [[-12, 46], [18, 36], [40, 58], [-34, 62]] },
];
function icVectors(lit, lt) {
  const dr = (i, j) => [Math.sin(lt * .9 + i * 1.7 + j) * 2.5, Math.cos(lt * .8 + i * 2.3 + j * 1.3) * 2.5];
  const P = VCL.map((c, i) => c.pts.map((p, j) => { const d = dr(i, j); return [p[0] + d[0], p[1] + d[1]]; }));
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.globalAlpha = GA;
  const ln = (a, b, col, w) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); };
  ln(P[0][0], P[0][1], 'rgba(190,240,255,.95)', 3); ln(P[0][0], P[0][2], 'rgba(160,230,255,.6)', 2); ln(P[0][0], P[0][3], 'rgba(160,230,255,.6)', 2);   // cat -> nearest neighbours
  ln(P[1][0], P[1][1], 'rgba(200,180,255,.5)', 2); ln(P[2][0], P[2][1], 'rgba(120,255,200,.5)', 2);
  VCL.forEach((c, i) => P[i].forEach((p, j) => { ctx.globalAlpha = GA * (j < 2 && i === 0 ? 1 : .9); ctx.fillStyle = c.col; ctx.beginPath(); ctx.arc(p[0], p[1], j < 2 && i === 0 ? 8 : 6.5, 0, TAU); ctx.fill(); }));
  ctx.restore(); orb(P[0][0][0], P[0][0][1], 26, .85, 'rgba(170,235,255,A)'); orb(P[0][1][0], P[0][1][1], 20, .6, 'rgba(170,235,255,A)');
}
function icAttention(lit, lt) {
  const xs = [-88, -44, 0, 44, 88], by = 36, arcs = [[4, 2, .38], [4, 3, .31], [4, 1, .19], [4, 0, .07], [3, 1, .1], [2, 0, .08], [3, 2, .12]];   // causal: later token -> earlier token
  ctx.save(); ctx.lineCap = 'round';
  for (const [a, b, w] of arcs) {
    const x0 = xs[a], x1 = xs[b], ch = Math.abs(x0 - x1) * .62 + 8;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = GA * (.3 + w * 1.7);
    ctx.strokeStyle = w > .25 ? PAL.cyan : w > .15 ? PAL.violet : PAL.blue; ctx.lineWidth = 1.5 + w * 8;
    ctx.beginPath(); ctx.moveTo(x0, by - 8); ctx.quadraticCurveTo((x0 + x1) / 2, by - 8 - ch * 1.45, x1, by - 8); ctx.stroke();
  }
  ctx.restore();
  xs.forEach((x, i) => orb(x, by, i === 4 ? 22 : (i === 2 || i === 3 || i === 1) ? 17 : 13, i === 4 ? 1 : .8, i === 4 ? 'rgba(240,248,255,A)' : 'rgba(120,200,255,A)'));
}
function icPredict(lit) {
  const w = [.41, .19, .11, .08, .07];
  w.forEach((p, i) => { const L = p / .41 * 172, y = -50 + i * 23; bar(-86, y, 172, 15, 'rgba(160,200,255,.12)', 1, 0); bar(-86, y, Math.max(8, L), 15, i ? PAL.blue : PAL.gold, i ? .78 : 1, i ? 0 : 16 + 10 * lit); });
}
function icLoss(lit) {
  ctx.save(); ctx.globalAlpha = .45 * GA; ctx.strokeStyle = '#8fa3c7'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-88, -52); ctx.lineTo(-88, 52); ctx.lineTo(88, 52); ctx.stroke();
  const g = ctx.createLinearGradient(-88, 0, 88, 0); g.addColorStop(0, PAL.coral); g.addColorStop(1, PAL.mint);
  ctx.globalAlpha = GA; ctx.strokeStyle = g; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.shadowColor = PAL.cyan; ctx.shadowBlur = 8 + 14 * lit; ctx.beginPath();
  let ex = 0, ey = 0;
  LOSSN.forEach((n, i) => { const u = i / (LOSSN.length - 1), f = .12 + .88 * Math.exp(-4.2 * u) + n * .09 * (1 - u * .6);
    ex = -88 + u * 176; ey = -46 + 88 * (1 - f); i ? ctx.lineTo(ex, ey) : ctx.moveTo(ex, ey); });
  ctx.stroke(); ctx.restore(); orb(ex, ey, 20, .9, 'rgba(94,242,176,A)');
}
function icTune(lit) {
  const c = (y, good) => {
    const col = good ? PAL.mint : PAL.coral;
    gls(-84, y, 168, 46, { r: 14, fill: good ? 'rgba(94,242,176,.14)' : 'rgba(255,107,122,.08)', stroke: rgba(col, good ? .85 : .5), lw: 2, glow: good ? rgba(PAL.mint, .5) : null, blur: 16 });
    bar(-66, y + 14, 74, 6, 'rgba(220,235,255,.55)', good ? 1 : .5); bar(-66, y + 27, 48, 6, 'rgba(220,235,255,.4)', good ? 1 : .4);
    ctx.save(); ctx.globalAlpha = GA * (good ? 1 : .8); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
    if (good) { ctx.moveTo(48, y + 24); ctx.lineTo(57, y + 33); ctx.lineTo(72, y + 13); } else { ctx.moveTo(52, y + 15); ctx.lineTo(70, y + 33); ctx.moveTo(70, y + 15); ctx.lineTo(52, y + 33); }
    ctx.stroke(); ctx.restore();
  };
  c(-54, true); c(8, false);
}
const ICONS = [icText, icTokens, icVectors, icAttention, icPredict];

// ---------------------------------------------------------------- pipeline cards
function cardFrame(c, lit) {
  const gl = Math.min(1, lit);
  gls(-c.w / 2, -c.h / 2, c.w, c.h, { r: 24, fill: `rgba(${12 + 8 * lit},${20 + 14 * lit},${42 + 20 * lit},.76)`, stroke: `rgba(${Math.round(150 + 60 * lit)},${Math.round(205 + 30 * lit)},255,${.32 + .55 * lit})`, lw: 1.6 + lit,
    glow: gl > .03 ? `rgba(95,227,255,${.5 * gl})` : null, blur: 18 + 22 * gl });
  if (gl > .03) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .1 * gl * GA; rrect(-c.w / 2, -c.h / 2, c.w, c.h, 24); ctx.fillStyle = PAL.cyan; ctx.fill(); ctx.restore(); }
}
const lerpCol = lit => { const a = [143, 190, 255], b = [255, 255, 255]; return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], Math.min(1, lit)))).join(',')})`; };
const hw = c => c.w * c.s / 2, hh = c => c.h * c.s / 2;                 // half extents on screen
function drawCards(lt) {
  const cu = eio(clamp((lt - T_COL) / T_COL_D)), vis = 1 - sstep(.12, .45, cu);          // cards shrink only after their text has gone
  const tf = 1 - sstep(T_OUT, T_OUT + .15, lt);                          // text, icons and connectors fade (while still) before anything moves
  if (vis <= .003) return;
  const lin = tf;
  // connectors of the chain
  for (let i = 0; i < 4; i++) {
    const a = ROW1[i], b = ROW1[i + 1], x = (a.cx + b.cx) / 2, y = a.cy - 55, lit = lightAt(lt, (a.tc + b.tc) / 2 + .1);
    const ap = eout(clamp((lt - b.t0 - .15) / .5));
    GA = ap * lin; ctx.save(); ctx.globalAlpha = GA * (.35 + .5 * Math.min(1, lit)); ctx.strokeStyle = 'rgba(150,215,255,1)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a.cx + hw(a) + 6, y); ctx.lineTo(b.cx - hw(b) - 6, y); ctx.stroke(); ctx.restore();
    chevron(x + 8, y, 10, PAL.cyan, .4 + .6 * Math.min(1, lit));
  }
  // heading between the rows: how the model gets its abilities, linked down to the training cards and up to the chain
  const hg = eout(clamp((lt - ROW2[0].t0) / .55)) * lin;
  GA = 1; ctx.save(); ctx.globalAlpha = hg * .65; ctx.strokeStyle = PAL.violet; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(CX - 330, HY); ctx.lineTo(CX - 215, HY); ctx.moveTo(CX + 215, HY); ctx.lineTo(CX + 330, HY);
  for (const rc of ROW2) { const ry = rc.cy - hh(rc) - 10; ctx.moveTo(rc.cx, HY); ctx.lineTo(rc.cx, ry); ctx.moveTo(rc.cx - 9, ry - 11); ctx.lineTo(rc.cx, ry); ctx.lineTo(rc.cx + 9, ry - 11); }
  const uy = ROW1[2].cy + hh(ROW1[2]) + 12;                              // upward arrow: training is what shapes the model above
  ctx.moveTo(CX, HY - 26); ctx.lineTo(CX, uy); ctx.moveTo(CX - 9, uy + 11); ctx.lineTo(CX, uy); ctx.lineTo(CX + 9, uy + 11);
  ctx.stroke(); ctx.restore();
  tx('训练 · how it learns', CX, HY, { font: F_UI, size: 32, weight: 600, color: '#f1ecff', alpha: hg });
  // row 2 arrow: pretraining -> fine-tuning
  const a2 = eout(clamp((lt - ROW2[1].t0 - .15) / .45)); GA = a2 * lin; chevron(CX + 6, ROW2[0].cy, 18, PAL.cyan, .75 + .25 * Math.min(1, lightAt(lt, ROW2[1].tc)), 4);
  // cards
  ALLC.forEach((c, i) => {
    const k = eout(clamp((lt - c.t0) / .55)); if (k <= 0) return;
    const hold = sstep(6.5, 7.3, lt) * (1 - sstep(T_OUT, T_OUT + .2, lt));       // all lit together: a very slow shared breathing glow in the hold
    const lit = lightAt(lt, c.tc) + .12 * hold * (.5 + .5 * Math.sin(lt * 2.2 + i * .6)), sc = lerp(.8, 1, k) * lerp(1, .04, cu) * (1 + .018 * Math.min(1, lit)) * c.s;
    const x = lerp(c.cx, CX, cu), y = lerp(c.cy + (1 - k) * 26, CY, cu); GA = k * vis;
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    cardFrame(c, lit);
    GA = k * vis * tf;
    if (GA > .003) {
      if (i < 5) {
        ctx.save(); ctx.translate(0, -55); ICONS[i](lit, lt); ctx.restore();
        tx(c.zh, 0, 56, { size: 44, weight: 700, color: '#fff', glow: null });
        tx(c.en, 0, 106, { font: F_EN, size: 27, ls: 3, color: lerpCol(lit), weight: 600 });
      } else {
        ctx.save(); ctx.translate(-150, 0); (i === 5 ? icLoss : icTune)(lit, lt); ctx.restore();
        tx(c.zh, -30, -28, { size: 48, weight: 700, color: '#fff', align: 'left' });
        tx(c.en, -30, 28, { font: F_EN, size: 28, ls: 3, color: lerpCol(lit), weight: 600, align: 'left' });
      }
    }
    ctx.restore();
  });
  GA = 1;
  // the signal: one soft pulse of light travelling along the chain with the lighting (dimmed while it crosses a card so the icons stay legible)
  const s0 = ROW1[0].tc, so = sstep(s0 - .15, s0, lt) * (1 - sstep(ROW1[4].tc + .05, ROW1[4].tc + .35, lt)) * lin;
  if (so > .01) {
    const u = clamp((lt - s0) / (ROW1[4].tc - s0)), x = lerp(ROW1[0].cx, ROW1[4].cx, u), y = ROW1[0].cy - 55;
    const gapK = px => .3 + .7 * sstep(-6, 22, Math.min(...ROW1.map(c => Math.abs(px - c.cx) - hw(c))));
    for (let k = 7; k >= 0; k--) orb(x - k * 12, y, 26 - k * 1.8, so * (1 - k / 8) * .5 * gapK(x - k * 12), 'rgba(140,215,255,A)');
    orb(x, y, 30, so * .75 * gapK(x), 'rgba(170,230,255,A)');
  }
}

// ---------------------------------------------------------------- collapse + title
const caretOn = lt => lt < 9.6 || (lt >= 9.82 && lt < 9.97);              // one visible blink (off 9.6-9.82) before the hit
function drawCollapse(lt) {
  if (lt > T_COL - .02 && lt < T_COL + T_COL_D + .35) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const p of PART) {
      const u = clamp((lt - T_COL - p.d * .45) / T_COL_D); if (u <= 0) continue;
      const e = eio(u), sw = Math.sin(PI * e) * 70 * p.sw;
      const x = lerp(p.x, CX, e) + sw * (CY - p.y) / 260, y = lerp(p.y, CY + p.sw * 55, e) + sw * (p.x - CX) / 900;
      ctx.globalAlpha = sstep(0, .12, u) * (1 - sstep(.7, .97, u)) * .85; ctx.fillStyle = p.col;
      const r = p.r * (.7 + .8 * (1 - e)); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  // hit: soft bloom + a quick ring that is gone before the title glyphs arrive
  const h = lt - T_HIT;
  if (h > -.08 && h < .8) {
    const g = Math.exp(-Math.max(0, h) * 5) * sstep(-.08, 0, h);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; softGlow(CX, CY, 340 * (.7 + .4 * eout(clamp(h / .5))), 255, 200, 110, .34 * g);
    const ra = Math.max(0, 1 - h / .5); ctx.globalAlpha = ra * .8 * sstep(0, .03, h); ctx.strokeStyle = 'rgba(255,225,170,1)'; ctx.lineWidth = 3 * ra + .5;
    ctx.beginPath(); ctx.arc(CX, CY, 20 + 290 * eout(clamp(h / .5)), 0, TAU); ctx.stroke(); ctx.restore();
  }
  // lonely caret: materialises as the particles arrive, blinks once, then the title takes over
  const ca = sstep(T_COL + T_COL_D - .1, T_COL + T_COL_D + .05, lt) * (caretOn(lt) ? 1 : 0);
  GA = 1; if (ca > 0) mycaret(CX - 4, CY, 150, ca, PAL.gold, 8, 12);
}
function drawTitle(lt) {
  if (lt < T_TITLE) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowDot(CX, CY + 20, 620, 'rgba(255,170,70,A)', .22 * sstep(T_TITLE, T_TITLE + .5, lt)); ctx.restore();   // warm bed
  titleWord('大语言模型', CX, CY, 190, lt, T_TITLE, .08, 14, 1, .5);
  const ea = sstep(T_TITLE + .3, T_TITLE + .7, lt), eaY = (1 - eout(clamp((lt - T_TITLE - .3) / .6))) * 14;
  text('LARGE LANGUAGE MODELS', CX, CY + 150 + eaY, { font: F_EN, size: 46, weight: 600, ls: lerp(26, 14, eout(clamp((lt - T_TITLE - .25) / 1.1))), color: '#e9f1ff', alpha: ea, glow: 'rgba(160,200,255,.5)', blur: 20 });
  const ta = sstep(T_TITLE + .55, T_TITLE + .95, lt);
  text('它如何工作 · 如何训练   /   HOW THEY WORK · HOW THEY LEARN', CX, CY + 232, { font: F_UI, size: 32, weight: 500, ls: 3, color: PAL.gold, alpha: ta });
  const L = titleLayout('大语言模型', CX, 190, 14), cxr = CX + L[0].total / 2 + 20, cr = sstep(T_TITLE + .5, T_TITLE + .6, lt);   // echo of scene 0: the caret, now at the end of the title
  if (cr > 0) caret(cxr, CY, 120, lt - (T_TITLE + .5) + .45, PAL.gold, cr);
  flare(CX, CY, .85 * Math.exp(-Math.max(0, lt - T_TITLE - .1) * 3.2) * sstep(T_TITLE - .1, T_TITLE + .3, lt), 1000);
}

// ---------------------------------------------------------------- the scene
const sfx = [[0, 'whoosh', { dur: .8 }]];
ROW1.forEach((c, i) => sfx.push([c.t0 + .2, 'pop'], [c.tc, 'ping', { midi: 72 + i * 2 }]));
sfx.push([ROW1[0].tc, 'swish', { pitch: .9 }]);
ROW2.forEach((c, i) => sfx.push([c.t0 + .2, 'pop'], [c.tc, 'ding', { midi: 79 + i * 5 }]));
sfx.push([T_OUT, 'riser', { dur: T_HIT - T_OUT }], [T_COL, 'whoosh', { dur: .6 }], [9.375, 'thump'],
  [T_HIT, 'hit', { k: .7 }], [T_HIT + .3, 'swell', { dur: 2.4 }], [T_TITLE, 'shimmer'], [T_TITLE, 'chime', { midi: 79 }], [T_TITLE + .1, 'sparkle', { dur: 1.2 }]);

scene({
  id: 'finale', start: 62, len: 6, fi: .3, fo: .8, mb: 2,
  subs: [
    [.4, 4.2, '文字 → 词元 → 向量 → 注意力 → 预测', 'text → tokens → vectors → attention → a prediction'],
    [4.5, 8.8, '先大量预训练，再靠人类反馈调教', 'first pretrained on vast text, then taught by human feedback'],
    [9.2, 14.2, '规模足够大时，“预测”开始像“理解”', 'At enough scale, prediction starts to look like understanding'],
  ],
  sfx, hits: [[T_HIT, .3]],
  cam: (lt, d) => ({ z: 1 + .03 * sstep(0, 8.6, lt) + .02 * sstep(10, 14.5, lt), x: 6 * Math.sin(lt * .21), y: 4 * Math.sin(lt * .17 + 1) }),
  draw(lt, d, T) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const na = sstep(3.0, 7.0, lt), aa = 1 - na, warm = sstep(9.2, 11.0, lt);
    if (na > 0.001) glDraw(0, { time: 40 + lt, tint: [lerp(.1, .3, warm), lerp(.17, .16, warm), lerp(.5, .42, warm)], amp: .78 });
    if (aa > 0.001) glDraw(1, { time: lt, tint: [.08, .22, .6], amp: .65 }, aa);
    ctx.save(); ctx.fillStyle = warm > .5 ? '#ffe2b0' : '#bcd6ff';                      // depth dust
    for (const p of DUST) {
      const y = ((p.y - lt * 9 * p.z) % H + H) % H, x = p.x + Math.sin(lt * .5 + p.p) * 8 * p.z, r = .8 + p.z * 2.4;
      ctx.globalAlpha = (.12 + .35 * p.z) * (.65 + .35 * Math.sin(lt * 1.6 + p.p)); ctx.fillRect(x, y, r, r);
    }
    ctx.restore();
    drawCards(lt);
    drawCollapse(lt);
    drawTitle(lt);
    const fb = sstep(14.0, 14.85, lt); if (fb > 0) { ctx.fillStyle = `rgba(0,0,0,${fb})`; ctx.fillRect(-40, -40, W + 80, H + 80); }   // clean black end
  },
});
