// s8_finale: chat demo -> the whole pipeline lights up -> everything collapses to one gold caret -> title returns -> black.
const R = mulberry(20260008);

// ---------------------------------------------------------------- constant tables
const CH = { x: 280, y: 225, w: 1360, h: 520 };                       // chat window
const USER_TXT = 'What is a large language model?';
const ANS = ['A', ' language', ' model', ' predicts', ' the', ' next', ' token', ',', ' one', ' at', ' a', ' time', ',', ' after', ' learning', ' from', ' trillions', ' of', ' words', '.'];
const T_USER0 = .35, T_SEND = 1.45, T_ANS0 = 1.75, T_ANS_DT = .085;     // typing, send, answer streaming (local seconds)
const T_PULL = 3.85, T_FADE = 3.95;                                  // camera starts pulling back / chat shrinks (beat 6); chat gone by T_FADE+.45, before the first card
const ROW1 = [['文字', 'TEXT'], ['词元', 'TOKENS'], ['向量', 'VECTORS'], ['注意力', 'ATTENTION'], ['预测', 'PREDICTION']].map((l, i) =>
  ({ zh: l[0], en: l[1], cx: 300 + i * 330, cy: 410, w: 262, h: 280, s: 1.06, tc: 4.375 + i * .3125, t0: 4.05 + i * .04 }));
const ROW2 = [['预训练', 'PRETRAINING'], ['微调', 'FINE-TUNING']].map((l, i) =>
  ({ zh: l[0], en: l[1], cx: 665 + i * 590, cy: 775, w: 500, h: 190, s: 1, tc: 5.0 + i * .3125, t0: 4.3 + i * .1 }));
const ALLC = [...ROW1, ...ROW2];
const T_COL = 6.85, T_COL_D = .45, T_HIT = 7.5, T_TITLE = 7.5;             // collapse start / length, hit, title reveal
const CX = 960, CY = 470;                                              // the final caret / title centre

const DUST = Array.from({ length: 150 }, () => ({ x: R() * W, y: R() * H, z: .15 + R() * .85, p: R() * TAU }));
const LOSSN = Array.from({ length: 34 }, () => (R() - .5));
const PART = Array.from({ length: 560 }, () => {                        // particles that fly from the pipeline into the caret
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
function chevron(x, y, s, col, a) {
  ctx.save(); ctx.globalAlpha = a * GA; ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x - s * .5, y - s); ctx.lineTo(x + s * .5, y); ctx.lineTo(x - s * .5, y + s); ctx.stroke(); ctx.restore();
}
const lightAt = (lt, tc) => Math.exp(-Math.pow((lt - tc) / .27, 2)) + .3 * sstep(tc - .05, tc + .35, lt);

// ---------------------------------------------------------------- the chat window
function layoutAnswer(size, x0, maxX, lineH, y0) {
  const out = []; let x = x0, y = y0;
  for (const raw of ANS) {
    let s = raw, w = measure(s, size, F_UI, 400);
    if (x + w > maxX && x > x0) { x = x0; y += lineH; s = s.trimStart(); w = measure(s, size, F_UI, 400); }
    else if (x === x0) { s = s.trimStart(); w = measure(s, size, F_UI, 400); }
    out.push({ s, x, y, w }); x += w;
  }
  return out;
}
function drawChat(lt) {
  const op = .88 + .12 * eexpo(clamp(lt / .8)), e = eio(clamp((lt - T_PULL) / .65));
  const s = op * lerp(1, .5, e), px = 960, py = lerp(485, 420, e);
  GA = sstep(0, .4, lt) * (1 - sstep(T_FADE, T_FADE + .35, lt)); if (GA <= .004) { GA = 1; return; }
  ctx.save(); ctx.translate(px, py); ctx.scale(s, s); ctx.translate(-960, -485);
  const { x: X, y: Y, w: Wd, h: Hh } = CH;
  // window
  gls(X, Y, Wd, Hh, { r: 30, fill: 'rgba(10,17,38,.80)', glow: 'rgba(95,200,255,.30)', blur: 40, stroke: 'rgba(160,210,255,.42)', lw: 1.8 });
  ctx.save(); ctx.globalAlpha = .5 * GA; const hg = ctx.createLinearGradient(X, Y, X + Wd, Y);
  hg.addColorStop(0, 'rgba(95,227,255,0)'); hg.addColorStop(.5, 'rgba(200,235,255,.9)'); hg.addColorStop(1, 'rgba(169,139,255,0)');
  ctx.fillStyle = hg; ctx.fillRect(X + 60, Y + 1, Wd - 120, 2); ctx.restore();
  { const sw = clamp((lt - .05) / 1.0), sa = Math.sin(PI * sw);                                   // soft light sweep along the top edge as the window opens
    if (sa > .01) { const sx = X + 40 + (Wd - 80) * eio(sw), g2 = ctx.createLinearGradient(sx - 260, 0, sx + 260, 0);
      g2.addColorStop(0, 'rgba(180,230,255,0)'); g2.addColorStop(.5, 'rgba(220,245,255,1)'); g2.addColorStop(1, 'rgba(180,230,255,0)');
      ctx.save(); rrect(X, Y, Wd, Hh, 30); ctx.clip(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .75 * sa * GA; ctx.fillStyle = g2; ctx.fillRect(sx - 260, Y - 1, 520, 4);
      ctx.globalAlpha = .12 * sa * GA; ctx.fillRect(sx - 260, Y - 1, 520, 90); ctx.restore(); } }
  // header
  orb(X + 54, Y + 38, 40, .9); ctx.save(); ctx.globalAlpha = GA; ctx.strokeStyle = PAL.cyan; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(X + 54, Y + 38, 11, 0, TAU); ctx.stroke(); ctx.restore();
  tx('Assistant', X + 92, Y + 38, { font: F_UI, size: 30, weight: 600, color: '#cfe0ff', align: 'left' });
  ctx.save(); ctx.globalAlpha = .22 * GA; ctx.fillStyle = '#9fc4ff'; ctx.fillRect(X + 30, Y + 76, Wd - 60, 1.5); ctx.restore();

  // user message: typed in the input bar, then sent up into a bubble
  const full = measure(USER_TXT, 36, F_UI, 400), n = Math.floor((lt - T_USER0) / .034), e2 = eio(clamp((lt - T_SEND) / .45));
  const bl = X + Wd - 50 - 32 - full, tx0 = lerp(X + 84, bl, e2), ty = lerp(Y + Hh - 74, Y + 138, e2);
  const IBY = Y + Hh - 107, IBX = X + 40, IBW = Wd - 80;          // input bar
  const ibA = 1 - .65 * sstep(T_SEND + .1, T_SEND + .5, lt);
  gls(IBX, IBY, IBW, 66, { r: 33, fill: 'rgba(6,12,28,.7)', stroke: `rgba(160,210,255,${.28 + .2 * (n > 0 && lt < T_SEND ? 1 : 0)})`, lw: 1.6, alpha: ibA });
  const phA = 1 - sstep(.18, .34, lt);
  tx('Ask anything…', X + 84, IBY + 33, { font: F_UI, size: 32, color: PAL.faint, align: 'left', alpha: phA });
  const act = n > 0 && lt < T_SEND + .3 ? 1 : 0;                       // send button
  const sbx = IBX + IBW - 40, sby = IBY + 33, press = 1 - .12 * Math.exp(-Math.pow((lt - T_SEND) / .08, 2));
  ctx.save(); ctx.globalAlpha = GA * ibA; ctx.translate(sbx, sby); ctx.scale(press, press); ctx.beginPath(); ctx.arc(0, 0, 25, 0, TAU);
  ctx.fillStyle = `rgba(95,227,255,${.12 + .5 * act})`; ctx.fill(); ctx.strokeStyle = `rgba(160,230,255,${.4 + .5 * act})`; ctx.lineWidth = 1.8; ctx.stroke();
  ctx.strokeStyle = act ? '#fff' : '#6d80a8'; ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, -10); ctx.moveTo(-9, -1); ctx.lineTo(0, -10); ctx.lineTo(9, -1); ctx.stroke(); ctx.restore();
  if (n > 0) {
    const shown = typed(USER_TXT, n), pad = 32 * e2;
    if (e2 > 0) { gls(tx0 - pad, ty - 38 * e2, full + pad * 2, 76 * e2, { r: 24, fill: 'rgba(79,140,255,.30)', stroke: 'rgba(120,200,255,.6)', lw: 1.8, glow: 'rgba(79,140,255,.5)', blur: 24, alpha: e2 }); }
    tx(shown, tx0, ty + 1, { font: F_UI, size: 36, color: '#fff', align: 'left' });
    if (lt < T_SEND) mycaret(tx0 + measure(shown, 36, F_UI, 400) + 4, ty, 44, 1);
  } else if (lt >= T_USER0 - .02 && lt < T_USER0 + .1) mycaret(X + 84, Y + Hh - 74, 44, 1);
  else if (lt < T_USER0) mycaret(X + 84, Y + Hh - 74, 44, Math.floor(lt * 2.2) % 2 ? 0 : 1);

  // assistant answer, token by token
  const aa = eout(clamp((lt - T_ANS0 + .15) / .4)), ay = Y + 256;
  if (aa > 0) {
    orb(X + 78, ay + 8, 46, aa); ctx.save(); ctx.globalAlpha = aa * GA; ctx.strokeStyle = PAL.cyan; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(X + 78, ay + 8, 12, 0, TAU); ctx.stroke(); ctx.restore();
    const L = layoutAnswer(46, X + 136, X + Wd - 60, 70, ay); let last = null, prev = null;
    L.forEach((t, i) => {
      const age = lt - (T_ANS0 + i * T_ANS_DT); if (age < 0) return;
      const k = eout(clamp(age / .22)), kb = Math.max(sstep(0, .1, age), age > .1 ? 1 : 0), gA = 1 - sstep(.1, .45, age);   // base text reaches full alpha fast, gold glow lingers on top
      const o = { font: F_UI, size: 46, align: 'left', alpha: kb, color: '#f2f7ff' };
      tx(t.s, t.x, t.y + (1 - k) * 12, o);
      if (gA > .01) tx(t.s, t.x, t.y + (1 - k) * 12, { ...o, color: PAL.gold, alpha: k * gA * .9, glow: PAL.gold, blur: 12 });
      prev = last && last.t.y === t.y ? last.t : null; last = { t, age, prev };
    });
    if (last) {
      const solid = last.age < .5 && lt < T_ANS0 + ANS.length * T_ANS_DT;
      const on = solid || !(Math.floor((lt - T_ANS0) * 2.2) % 2);
      const ce = last.t.x + last.t.w, cs = last.prev ? last.prev.x + last.prev.w : last.t.x;
      mycaret(lerp(cs, ce, sstep(.03, .07, last.age)) + 5, last.t.y, 52, on ? 1 : 0);
    }
  }
  ctx.restore(); GA = 1;
}

// ---------------------------------------------------------------- pipeline icons (local coords: icon centre = 0,0)
function icText(lit, lt) {
  tx('The cat sat', -92, -22, { font: F_UI, size: 31, color: '#fff', align: 'left', weight: 500 });
  tx('on the', -92, 22, { font: F_UI, size: 31, color: '#fff', align: 'left', weight: 500 });
  mycaret(-92 + measure('on the', 31, F_UI, 500) + 6, 22, 34, Math.floor(lt * 2.2) % 2 ? .15 : 1);
}
function icTokens(lit) {
  const rows = [[-26, ['The', 'cat', 'sat'], [-72, 0, 72], 0], [24, ['on', 'the'], [-36, 36], 3]];
  for (const [y, ls, xs, o] of rows) ls.forEach((l, i) => chip(l, xs[i], y, { size: 25, h: 40, pad: 13, color: HUES[i + o], lw: 1.8, alpha: GA, fillA: .2 + .08 * Math.min(1, lit) }));
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
  const xs = [-88, -44, 0, 44, 88], by = 30, arcs = [[4, 2, .38], [4, 3, .31], [4, 1, .19], [4, 0, .07], [3, 1, .1], [2, 0, .08], [3, 2, .12]];
  ctx.save(); ctx.lineCap = 'round';
  for (const [a, b, w] of arcs) {
    const x0 = xs[a], x1 = xs[b], ch = Math.abs(x0 - x1) * .62 + 8;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = GA * (.3 + w * 1.7);
    ctx.strokeStyle = w > .25 ? PAL.cyan : w > .15 ? PAL.violet : PAL.blue; ctx.lineWidth = 1.5 + w * 8;
    ctx.beginPath(); ctx.moveTo(x0, by - 8); ctx.quadraticCurveTo((x0 + x1) / 2, by - 8 - ch * 2, x1, by - 8); ctx.stroke();
  }
  ctx.restore();
  xs.forEach((x, i) => orb(x, by, i === 4 ? 22 : (i === 2 || i === 3 || i === 1) ? 17 : 13, i === 4 ? 1 : .8, i === 4 ? 'rgba(240,248,255,A)' : 'rgba(120,200,255,A)'));
}
function icPredict(lit) {
  const w = [.41, .19, .11, .08, .07];
  w.forEach((p, i) => { const L = p / .41 * 172, y = -48 + i * 22; bar(-86, y, 172, 14, 'rgba(160,200,255,.12)', 1, 0); bar(-86, y, Math.max(8, L), 14, i ? PAL.blue : PAL.gold, i ? .78 : 1, i ? 0 : 16 + 10 * lit); });
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
function cardFrame(c, lit, gold = 0) {
  const gl = Math.min(1, lit), sr = lerp(150 + 60 * lit, 255, gold), sg = lerp(205 + 30 * lit, 215, gold), sb = lerp(255, 120, gold);
  gls(-c.w / 2, -c.h / 2, c.w, c.h, { r: 24, fill: `rgba(${12 + 8 * lit},${20 + 14 * lit},${42 + 20 * lit},.74)`, stroke: `rgba(${Math.round(sr)},${Math.round(sg)},${Math.round(sb)},${.3 + .55 * Math.max(lit, gold)})`, lw: 1.6 + lit + gold,
    glow: gl > .03 ? (gold > .1 ? `rgba(255,205,110,${.5 * gold})` : `rgba(95,227,255,${.5 * gl})`) : null, blur: 18 + 22 * Math.max(gl, gold) });
  if (gl > .03) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .1 * gl * GA; rrect(-c.w / 2, -c.h / 2, c.w, c.h, 24); ctx.fillStyle = PAL.cyan; ctx.fill(); ctx.restore(); }
}
const hw = c => c.w * c.s / 2, hh = c => c.h * c.s / 2;                 // half extents on screen
const GOLD_A = 5.6, GOLD_B = 6.25, WRONG_B = T_COL;                      // "looks like understanding" gold halo, then the "can still be wrong" coral beat
function drawCards(lt) {
  const cu = eio(clamp((lt - T_COL) / T_COL_D)), vis = 1 - sstep(.12, .45, cu);
  if (vis <= .003) return;
  const lin = 1 - sstep(0, .25, cu);                                  // connectors vanish first
  // connectors, chain
  const ap0 = eout(clamp((lt - 4.2) / .5));
  for (let i = 0; i < 4; i++) {
    const a = ROW1[i], b = ROW1[i + 1], x = (a.cx + b.cx) / 2, y = a.cy - 55, lit = lightAt(lt, (a.tc + b.tc) / 2);
    GA = ap0 * lin; ctx.save(); ctx.globalAlpha = GA * (.35 + .5 * Math.min(1, lit)); ctx.strokeStyle = 'rgba(150,215,255,1)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a.cx + hw(a) + 6, y); ctx.lineTo(b.cx - hw(b) - 6, y); ctx.stroke(); ctx.restore();
    chevron(x + 8, y, 9, PAL.cyan, .4 + .6 * Math.min(1, lit));
  }
  // heading between the rows: how the model gets its abilities (centred on the screen axis)
  const hg = eout(clamp((lt - 4.5) / .6)) * lin, hy = 622;
  GA = 1; ctx.save(); ctx.globalAlpha = hg * .6; ctx.strokeStyle = PAL.violet; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(CX - 330, hy); ctx.lineTo(CX - 215, hy); ctx.moveTo(CX + 215, hy); ctx.lineTo(CX + 330, hy); ctx.stroke(); ctx.restore();
  tx('训练 · how it learns', CX, hy, { font: F_UI, size: 32, weight: 600, color: '#f1ecff', alpha: hg });
  // row 2 arrow
  const a2 = eout(clamp((lt - 4.7) / .5)); GA = a2 * lin; chevron(CX + 6, ROW2[0].cy, 11, PAL.cyan, .5 + .5 * Math.min(1, lightAt(lt, 5.15)));
  // cards
  const gold = sstep(GOLD_A - .1, GOLD_A + .15, lt) * (1 - sstep(GOLD_B, GOLD_B + .2, lt));                      // gold halo on Prediction: the answer that looks like understanding
  const wrong = sstep(GOLD_B - .05, GOLD_B + .2, lt) * (1 - sstep(WRONG_B - .08, WRONG_B, lt));                // steady coral outline + '?': it can still be wrong
  ALLC.forEach((c, i) => {
    const k = eout(clamp((lt - c.t0) / .5)); if (k <= 0) return;
    const lit = lightAt(lt, c.tc), sc = lerp(.78, 1, k) * lerp(1, .04, cu) * (1 + .018 * Math.min(1, lit)) * c.s;
    const x = lerp(c.cx, CX, cu), y = lerp(c.cy + (1 - k) * 26, CY, cu); GA = k * vis;
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    if (i === 4 && gold > .01) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = GA; softGlow(0, 0, 300, 255, 205, 110, .3 * gold); ctx.restore(); }
    cardFrame(c, lit, i === 4 ? gold : 0);
    GA = k * vis * (1 - sstep(0, .2, cu));                            // icons + labels fade first so no smeared glyphs fly in
    if (GA > .003) {
      if (i < 5) {
        ctx.save(); ctx.translate(0, -55); ICONS[i](lit, lt); ctx.restore();
        tx(c.zh, 0, 50, { size: 42, weight: 700, color: '#fff', glow: null });
        tx(c.en, 0, 98, { font: F_EN, size: 26, ls: 3, color: lerpCol(lit), weight: 600 });
      } else {
        ctx.save(); ctx.translate(-150, 0); (i === 5 ? icLoss : icTune)(lit, lt); ctx.restore();
        tx(c.zh, -30, -26, { size: 44, weight: 700, color: '#fff', align: 'left' });
        tx(c.en, -30, 26, { font: F_EN, size: 26, ls: 3, color: lerpCol(lit), weight: 600, align: 'left' });
      }
    }
    if (i === 4 && wrong > .01 && GA > .01) {                         // slow 2.5 Hz pulse: coral dashed outline, a large '?' on the card's corner and a small chip underneath
      const pu = .8 + .2 * Math.sin(lt * 15.7), qa = wrong * pu * GA;
      ctx.save(); ctx.globalAlpha = qa; ctx.strokeStyle = PAL.coral; ctx.lineWidth = 4.5; ctx.setLineDash([3, 13]); ctx.lineCap = 'round'; ctx.shadowColor = PAL.coral; ctx.shadowBlur = 16;
      rrect(-c.w / 2 - 10, -c.h / 2 - 10, c.w + 20, c.h + 20, 32); ctx.stroke(); ctx.restore();
      const bx = c.w / 2 - 6, by = -c.h / 2 - 8;
      ctx.save(); ctx.globalAlpha = wrong * GA; ctx.beginPath(); ctx.arc(bx, by, 50, 0, TAU); ctx.fillStyle = 'rgba(40,10,22,.88)'; ctx.fill(); ctx.strokeStyle = PAL.coral; ctx.lineWidth = 3; ctx.shadowColor = PAL.coral; ctx.shadowBlur = 16; ctx.stroke(); ctx.restore();
      tx('?', bx, by + 3, { font: F_UI, size: 80, weight: 700, color: PAL.coral, glow: PAL.coral, blur: 14, alpha: wrong * pu });
      const cy2 = c.h / 2 + 52, cw = 350;
      gls(-cw / 2, cy2 - 28, cw, 56, { r: 28, fill: 'rgba(60,14,28,.8)', stroke: rgba(PAL.coral, .8), lw: 2, glow: rgba(PAL.coral, .4), blur: 14, alpha: wrong });
      tx('可能出错 · can be wrong', 0, cy2 + 1, { font: F_UI, size: 26, weight: 600, color: '#ffd9de', alpha: wrong });
    }
    ctx.restore();
  });
  GA = 1;
  // the signal
  const s0 = ROW1[0].tc, so = sstep(s0 - .1, s0, lt) * (1 - sstep(ROW1[4].tc + .1, ROW1[4].tc + .3, lt)) * lin;
  if (so > .01) {
    const u = clamp((lt - s0) / (ROW1[4].tc - s0)), x = lerp(ROW1[0].cx, ROW1[4].cx, u), y = ROW1[0].cy - 55;
    const gapK = px => .3 + .7 * sstep(-6, 22, Math.min(...ROW1.map(c => Math.abs(px - c.cx) - hw(c))));   // dim while it crosses a card so icons stay legible
    for (let k = 7; k >= 0; k--) orb(x - k * 12, y, 26 - k * 1.8, so * (1 - k / 8) * .5 * gapK(x - k * 12), 'rgba(140,215,255,A)');
    orb(x, y, 30, so * .75 * gapK(x), 'rgba(170,230,255,A)');
  }
}
const lerpCol = lit => { const a = [143, 190, 255], b = [255, 255, 255]; return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], Math.min(1, lit)))).join(',')})`; };

// ---------------------------------------------------------------- collapse + title
function softGlow(x, y, r, R_, G_, B_, a) {                          // gaussian-ish falloff: no visible disc edge
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  for (let i = 0; i <= 8; i++) { const u = i / 8; g.addColorStop(u, `rgba(${R_},${G_},${B_},${a * Math.exp(-4 * u * u) * (1 - u * u * u)})`); }
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
}
function drawCollapse(lt) {
  // particles
  if (lt > T_COL - .02 && lt < T_HIT) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const p of PART) {
      const u = clamp((lt - T_COL - p.d * .6) / (T_COL_D + .05)); if (u <= 0) continue;
      const e = eio(u), sw = Math.sin(PI * e) * 70 * p.sw;
      const x = lerp(p.x, CX, e) + sw * (CY - p.y) / 260, y = lerp(p.y, CY + p.sw * 55, e) + sw * (p.x - CX) / 900;
      ctx.globalAlpha = sstep(0, .12, u) * (1 - sstep(.7, .97, u)) * .85; ctx.fillStyle = p.col;
      const r = p.r * (.7 + .8 * (1 - e)); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  // hit (faked here, inside the picture band; the global flash overlay is off): soft bloom + a quick ring that is gone before the title glyphs arrive
  const h = lt - T_HIT;
  if (h > -.08 && h < .8) {
    const g = Math.exp(-Math.max(0, h) * 5) * sstep(-.08, 0, h);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; softGlow(CX, CY, 340 * (.7 + .4 * eout(clamp(h / .5))), 255, 200, 110, .34 * g);
    const ra = Math.max(0, 1 - h / .5); ctx.globalAlpha = ra * .8 * sstep(0, .03, h); ctx.strokeStyle = 'rgba(255,225,170,1)'; ctx.lineWidth = 3 * ra + .5;
    ctx.beginPath(); ctx.arc(CX, CY, 20 + 290 * eout(clamp(h / .5)), 0, TAU); ctx.stroke(); ctx.restore();
  }
  // lonely caret: materialises as the particles arrive, blinks off once, then the title takes over
  const ca = sstep(T_COL + .22, T_COL + .36, lt) * (1 - sstep(T_TITLE - .02, T_TITLE + .08, lt));
  GA = 1; if (ca > 0) mycaret(CX - 4, CY, 150, ca, PAL.gold, 8, 12);
}
function drawTitle(lt) {
  const k = clamp((lt - T_TITLE) / 2.0); if (lt < T_TITLE) return;
  // warm bed
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowDot(CX, CY + 20, 620, 'rgba(255,170,70,A)', .22 * sstep(T_TITLE, T_TITLE + .5, lt)); ctx.restore();
  titleWord('大语言模型', CX, CY, 190, lt, T_TITLE, .08, 14, 1, .5);
  const ea = sstep(T_TITLE + .3, T_TITLE + .7, lt), eaY = (1 - eout(clamp((lt - T_TITLE - .3) / .6))) * 14;
  text('LARGE LANGUAGE MODELS', CX, CY + 150 + eaY, { font: F_EN, size: 46, weight: 600, ls: lerp(26, 14, eout(clamp((lt - T_TITLE - .25) / 1.1))), color: '#e9f1ff', alpha: ea, glow: 'rgba(160,200,255,.5)', blur: 20 });
  const ta = sstep(T_TITLE + .55, T_TITLE + .95, lt);
  text('它如何工作 · 如何训练   /   HOW THEY WORK · HOW THEY LEARN', CX, CY + 232, { font: F_UI, size: 30, weight: 500, ls: 3, color: PAL.gold, alpha: ta });
  // echo of scene 0: the caret, now at the end of the title
  const L = titleLayout('大语言模型', CX, 190, 14), cxr = CX + L[0].total / 2 + 20, cr = sstep(T_TITLE + .5, T_TITLE + .6, lt);
  if (cr > 0) caret(cxr, CY, 120, lt - (T_TITLE + .5), PAL.gold, cr);
  flare(CX, CY, .85 * Math.exp(-Math.max(0, lt - T_TITLE - .1) * 3.2) * sstep(T_TITLE - .1, T_TITLE + .3, lt), 1000);
}

// ---------------------------------------------------------------- the scene
const sfx = [[0, 'whoosh', { dur: .7 }]];
for (let i = 0; i < USER_TXT.length; i += 3) sfx.push([T_USER0 + i * .034, 'type']);
sfx.push([T_SEND, 'swish', { pitch: 1.2 }]);
ANS.forEach((_, i) => { if (i % 3 === 0) sfx.push([T_ANS0 + i * T_ANS_DT, 'type']); });
sfx.push([T_ANS0 + ANS.length * T_ANS_DT + .05, 'chime', { midi: 84 }], [T_PULL + .05, 'whoosh', { dur: 1.2 }]);
sfx.push([ROW1[0].t0 + .1, 'pop']);
ROW1.forEach((c, i) => sfx.push([c.tc, 'ping', { midi: 72 + i * 2 }]));
sfx.push([ROW1[0].tc, 'swish', { pitch: .9 }], [GOLD_A, 'sparkle', { dur: .6 }], [ROW2[0].tc, 'ding', { midi: 79 }], [ROW2[1].tc, 'ding', { midi: 84 }], [GOLD_B + .05, 'down'],
  [6.2, 'riser', { dur: 1.3 }], [T_HIT, 'hit', { k: .7 }], [T_HIT + .3, 'swell', { dur: 2.2 }],
  [T_TITLE, 'shimmer'], [T_TITLE, 'chime', { midi: 79 }], [T_TITLE + .1, 'sparkle', { dur: 1.2 }], [9.375, 'thump']);

scene({
  id: 'finale', start: 20, len: 4, fi: .25, fo: .6, mb: 2,
  subs: [
    [.3, 2.4, '于是，你输入一句话', 'So you type a sentence'],
    [2.6, 4.7, '它一个词一个词地接下去——', 'and it continues, one word at a time —'],
    [4.9, 9.0, '规模足够大时，“预测”开始像“理解”——但它仍会出错', 'at enough scale, prediction starts to look like understanding — though it can still be wrong'],
  ],
  sfx, hits: [[T_HIT, .06]],
  cam: (lt, d) => ({ z: 1 + .08 * (1 - eio(clamp((lt - 2.9) / 2.0))) + .03 * sstep(5, 10, lt), x: 6 * Math.sin(lt * .21), y: 4 * Math.sin(lt * .17 + 1) }),
  draw(lt, d, T) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const na = sstep(2.6, 6.0, lt), aa = 1 - na;
    const warm = sstep(6.8, 8.4, lt);
    if (na > 0.001) glDraw(0, { time: 40 + lt, tint: [lerp(.1, .3, warm), lerp(.17, .16, warm), lerp(.5, .42, warm)], amp: .78 });
    if (aa > 0.001) glDraw(1, { time: lt, tint: [.08, .22, .6], amp: .65 }, aa);
    // depth dust
    ctx.save(); ctx.fillStyle = warm > .5 ? '#ffe2b0' : '#bcd6ff';
    for (const p of DUST) {
      const y = ((p.y - lt * 9 * p.z) % H + H) % H, x = p.x + Math.sin(lt * .5 + p.p) * 8 * p.z, r = .8 + p.z * 2.4;
      ctx.globalAlpha = (.12 + .35 * p.z) * (.65 + .35 * Math.sin(lt * 1.6 + p.p)); ctx.fillRect(x, y, r, r);
    }
    ctx.restore();
    drawChat(lt);
    drawCards(lt);
    drawCollapse(lt);
    drawTitle(lt);
    // clean black end
    const fb = sstep(9.45, 9.85, lt); if (fb > 0) { ctx.fillStyle = `rgba(0,0,0,${fb})`; ctx.fillRect(-20, -20, W + 40, H + 40); }
  },
});
