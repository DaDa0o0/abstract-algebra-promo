// s8_chat: a quiet glass chat window. Page A: you type, the answer streams in token by token while a slim strip shows the next-token candidates.
// Page B: a new chat about a book that does not exist (labelled as an example): a fluent, confident, made-up answer, then a gentle "sounds right != is right" warning.
const R = mulberry(20260008);

// ---------------------------------------------------------------- constant tables
const CH = { x: 240, y: 185, w: 1440, h: 630 };                       // chat window
const X = CH.x, Y = CH.y, Wd = CH.w, Hh = CH.h;
const FS = 36, AS = 44;                                                 // user text size, answer text size

const mkTimes = (n, t0, dt, seed) => { const a = []; let t = t0; for (let i = 0; i < n; i++) { a.push(t); t += dt * (.72 + .56 * hash1(seed + i * 3.1)); } return a; };

// page A: the loop in use
const USER_A = [['What is a large language model?', 0]];
const ANS_A = ['A', ' large', ' language', ' model', ' predicts', ' the', ' next', ' token', ',', ' one', ' at', ' a', ' time', ',', ' after', ' learning', ' from', ' trillions', ' of', ' words', '.'];
const PA = { send: 3.125, typeT: mkTimes(31, .72, .068, 1), a0: 3.72, dt: .125, out0: 8.2, out1: 8.6 };
PA.aEnd = PA.a0 + (ANS_A.length - 1) * PA.dt;                          // 6.22: last token lands, the reply then rests for 2 s
// illustrative candidates for each step: [alt1, p1, alt2, p2] and the probability of the token that was drawn (a few draws are NOT the top candidate: it is a random draw)
const STEPS = [
  ['The', .21, 'In', .12, .46], [' language', .18, ' neural', .09, .52], [' model', .05, ' neural', .03, .88], [' models', .03, ' AI', .02, .93],
  [' is', .41, ' learns', .12, .33], [' text', .22, ' words', .14, .47], [' most', .12, ' following', .05, .71], [' word', .38, ' piece', .06, .44],
  [' in', .24, '.', .21, .39], [' based', .28, ' given', .12, .35], [' by', .06, ' after', .02, .86], [' the', .03, ' once', .01, .94],
  [' step', .01, ' moment', .01, .97], [' after', .20, '.', .12, .58], [' based', .27, ' having', .15, .31], [' being', .20, ' training', .17, .52],
  [' on', .13, ' patterns', .03, .79], [' vast', .27, ' large', .21, .18], [' for', .02, ' and', .02, .96], [' text', .35, ' tokens', .10, .40],
  [',', .10, ' and', .04, .81],
];
const CAND = ANS_A.map((tok, i) => { const s = STEPS[i], c = [[tok, s[4], 1], [s[0], s[1], 0], [s[2], s[3], 0]]; return c.sort((a, b) => b[1] - a[1]); });

// page B: a made-up title, labelled as an example
const USER_B = [['Who wrote the novel ', 0], ['The Glass Orchard of Mars', 1], ['?', 0]];
const LEN_B = USER_B.reduce((n, s) => n + [...s[0]].length, 0);
const ANS_B = ['It', ' was', ' written', ' by', ' Elena', ' Marchetti', ' and', ' published', ' in', ' 1974', '.'];
const PB = { in0: 8.7, send: 10.0, typeT: mkTimes(LEN_B, 8.72, .027, 7), a0: 10.38, dt: .07 };
PB.aEnd = PB.a0 + (ANS_B.length - 1) * PB.dt;
const T_WARN = 11.25;                                                  // the warning starts to fade in once the answer has been read as "fine"

const DUST = Array.from({ length: 90 }, () => ({ x: R() * W, y: R() * H, z: .15 + R() * .85, p: R() * TAU }));

// ---------------------------------------------------------------- tiny helpers (alpha-aware via GA)
let GA = 1;
const tx = (s, x, y, o = {}) => text(s, x, y, { ...o, alpha: (o.alpha ?? 1) * GA });
const gls = (x, y, w, h, o = {}) => glass(x, y, w, h, { ...o, alpha: (o.alpha ?? 1) * GA });
const orb = (x, y, r, a = 1, col = 'rgba(110,190,255,A)') => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowDot(x, y, r, col, a * GA); ctx.restore(); };
function mycaret(x, y, h, a = 1, col = PAL.gold, w = 0, blur = 18) {
  if (a <= 0) return; ctx.save(); ctx.globalAlpha = a * GA; ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = blur;
  ctx.fillRect(x, y - h / 2, w || Math.max(3, h * .09), h); ctx.restore();
}
const mwS = (s, size, it) => { ctx.save(); ctx.font = `${it ? 'italic ' : ''}400 ${size}px ${F_UI}`; const w = ctx.measureText('x' + s).width - ctx.measureText('x').width; ctx.restore(); return w; };   // 'x' guard: leading spaces count
// segmented user text ([text, italic]); the first k characters; returns the x where it ends
function drawSegs(segs, k, x, y, size, a = 1) {
  let left = k;
  for (const [s, it] of segs) {
    const n = Math.min(left, [...s].length); if (n <= 0) break;
    const part = typed(s, n);
    tx(part, x, y, { font: F_UI, style: it ? 'italic' : '', size, color: it ? '#e6dcff' : '#fff', align: 'left', alpha: a });
    x += mwS(part, size, it); left -= n;
  }
  return x;
}
const segW = (segs, size) => segs.reduce((w, [s, it]) => w + mwS(s, size, it), 0);
const countT = (arr, lt) => { let n = 0; while (n < arr.length && arr[n] <= lt) n++; return n; };

function layoutTokens(toks, size, x0, maxX, lineH, y0) {
  const out = []; let x = x0, y = y0;
  for (const raw of toks) {
    let s = raw, w = mwS(s, size, 0);
    const keep = raw === ' a' ? mwS(' time', size, 0) : raw === ' Elena' ? mwS(' Marchetti', size, 0) : 0;      // keep a few phrases together on one line
    if (x + w + keep > maxX && x > x0) { x = x0; y += lineH; s = s.trimStart(); w = mwS(s, size, 0); }
    else if (x === x0) { s = s.trimStart(); w = mwS(s, size, 0); }
    out.push({ s, x, y, w }); x += w;
  }
  return out;
}
const AX = X + 136, AMAX = X + Wd - 70, AY = Y + 262, ALH = 68;
let LAY_A, LAY_B, BOX_B;                                                // measured per frame (cheap): the fonts are not loaded yet when the file runs
function layouts() {
  LAY_A = layoutTokens(ANS_A, AS, AX, AMAX, ALH, AY); LAY_B = layoutTokens(ANS_B, AS, AX, AMAX, ALH, AY);
  const x1 = Math.max(...LAY_B.map(t => t.x + t.w)), y1 = LAY_B[LAY_B.length - 1].y; BOX_B = { x: AX - 30, y: AY - 44, w: x1 - AX + 60, h: y1 - AY + 88 };
}

// streaming answer: each token fades/slides in, a soft gold glow lingers a moment on the newest ones
function drawAnswer(L, a0, dt, lt, pa, aEnd) {
  const aa = eout(clamp((lt - a0 + .2) / .5)) * pa; if (aa <= 0) return;
  const ay = L[0].y;
  orb(X + 78, ay + 4, 32, .6 * aa); ctx.save(); ctx.globalAlpha = aa * GA; ctx.strokeStyle = PAL.cyan; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(X + 78, ay + 4, 12, 0, TAU); ctx.stroke(); ctx.restore();
  let last = null;
  L.forEach((t, i) => {
    const age = lt - (a0 + i * dt); if (age < 0) return;
    const k = eout(clamp(age / .3)), kb = sstep(0, .12, age), gA = 1 - sstep(.1, .45, age);
    const o = { font: F_UI, size: AS, align: 'left', alpha: kb * pa, color: '#e2ecff' };
    tx(t.s, t.x, t.y + (1 - k) * 9, o);
    if (gA > .01) tx(t.s, t.x, t.y + (1 - k) * 9, { ...o, color: PAL.gold, alpha: k * gA * .5 * pa, glow: PAL.gold, blur: 8 });
    last = t;
  });
  if (last) {                                                           // steady while streaming, blinking once the reply is complete
    const t1 = lt - (aEnd + .1), on = lt < aEnd + .1 || !(Math.floor(t1 * 2.2) % 2);
    if (on) mycaret(last.x + last.w + 5, last.y, 50, pa);
  }
}

// ---------------------------------------------------------------- the slim next-token strip (page A)
const SL = [X + 610, X + 910, X + 1210], SY = Y + 452;
function drawStrip(lt, pa) {
  if (pa <= .004) return;
  const a0 = PA.a0 - .06;
  const loopA = sstep(a0 - .5, a0 - .1, lt) * pa; if (loopA <= 0) return;
  // frame: loop icon, label, note
  const ix = X + 76;
  ctx.save(); ctx.globalAlpha = GA * loopA * .9; ctx.translate(ix, SY); ctx.rotate(lt * 1.6); ctx.strokeStyle = PAL.cyan; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.arc(0, 0, 15, .5, TAU - 1.0); ctx.stroke(); ctx.beginPath(); ctx.moveTo(15 * Math.cos(-1.0) - 2, 15 * Math.sin(-1.0) - 9); ctx.lineTo(15 * Math.cos(-1.0) + 1, 15 * Math.sin(-1.0) + 2); ctx.lineTo(15 * Math.cos(-1.0) + 11, 15 * Math.sin(-1.0) - 5); ctx.stroke(); ctx.restore();
  tx('下一个词 · next token', X + 112, SY - 15, { font: F_UI, size: 26, weight: 500, color: '#b9cdf2', align: 'left', alpha: loopA });
  tx('示例概率 · illustrative', X + 112, SY + 19, { font: F_UI, size: 24, weight: 500, color: PAL.dim, align: 'left', alpha: loopA * .9 });
  // candidates for the token being written (the previous set cross-fades out)
  const n = ANS_A.length, cur = clamp(Math.floor((lt - a0) / PA.dt), 0, n - 1);                       // hard switch per step: never two sets of text on top of each other
  const sets = lt < a0 ? [] : [[cur, 1]];
  for (const [k, w] of sets) {
    if (w <= .01) continue;
    CAND[k].forEach((c, r) => {
      const lbl = (c[0].trim() || '·') + ' ' + Math.round(c[1] * 100) + '%', ch = c[2];
      chip(lbl, SL[r], SY, { size: 28, h: 52, pad: 18, minW: 236, color: ch ? PAL.gold : PAL.blue, fillA: ch ? .22 : .1, strokeA: ch ? .95 : .5, lw: ch ? 2.4 : 1.6, glow: ch ? 14 : 0,
        alpha: w * loopA * GA * (ch ? 1 : .8), textColor: ch ? '#fff6dc' : '#bcd0f5' });
    });
  }
}

// ---------------------------------------------------------------- page B warning: calm, a little coral, nothing alarming
function drawWarning(lt) {
  const o = sstep(T_WARN, T_WARN + .8, lt); if (o <= .004) return;
  const br = .9 + .1 * Math.sin(lt * 2.2), b = BOX_B, oa = o * br;
  // dashed outline around the answer
  ctx.save(); ctx.globalAlpha = oa * .62 * GA; ctx.strokeStyle = PAL.coral; ctx.lineWidth = 3.2; ctx.setLineDash([2, 13]); ctx.lineCap = 'round'; ctx.shadowColor = PAL.coral; ctx.shadowBlur = 5;
  rrect(b.x, b.y, b.w, b.h, 26); ctx.stroke(); ctx.restore();
  // soft coral tint behind the text
  ctx.save(); ctx.globalAlpha = o * .07 * GA; rrect(b.x, b.y, b.w, b.h, 26); ctx.fillStyle = PAL.coral; ctx.fill(); ctx.restore();
  // "?" badge on the corner
  const bo = sstep(T_WARN + .15, T_WARN + .8, lt), bx = b.x + b.w + 4, by = b.y - 2;
  if (bo > .004) {
    ctx.save(); ctx.globalAlpha = bo * GA; ctx.beginPath(); ctx.arc(bx, by, 38, 0, TAU); ctx.fillStyle = 'rgba(40,12,24,.9)'; ctx.fill(); ctx.strokeStyle = PAL.coral; ctx.lineWidth = 2.4; ctx.shadowColor = PAL.coral; ctx.shadowBlur = 6; ctx.stroke(); ctx.restore();
    tx('?', bx, by + 3, { font: F_UI, size: 54, weight: 700, color: '#ffb3bc', alpha: bo });
  }
  // the chip
  const co = sstep(T_WARN + .4, T_WARN + 1.1, lt), cy = Y + 458 + (1 - eout(clamp((lt - T_WARN - .4) / .8))) * 10;
  if (co > .004) {
    const cw = 640;
    gls(960 - cw / 2, cy - 44, cw, 88, { r: 30, fill: 'rgba(52,16,30,.82)', stroke: rgba(PAL.coral, .62), lw: 1.8, glow: rgba(PAL.coral, .16), blur: 10, alpha: co });
    tx('听起来很对 ≠ 一定是对的', 960, cy - 14, { font: F_UI, size: 34, weight: 700, color: '#ffe3e6', alpha: co });
    tx('sounds right ≠ is right', 960, cy + 24, { font: F_UI, size: 26, weight: 500, color: '#ffc4cb', alpha: co });
  }
}

// ---------------------------------------------------------------- the chat window
function drawChat(lt) {
  const op = sstep(0, .7, lt); if (op <= .004) return;
  layouts();
  const rise = (1 - eout(clamp(lt / 1.0))) * 18;
  GA = op; ctx.save(); ctx.translate(0, rise);
  // window
  gls(X, Y, Wd, Hh, { r: 30, fill: 'rgba(10,17,38,.80)', glow: 'rgba(95,200,255,.28)', blur: 40, stroke: 'rgba(160,210,255,.42)', lw: 1.8 });
  ctx.save(); ctx.globalAlpha = .5 * GA; const hg = ctx.createLinearGradient(X, Y, X + Wd, Y);
  hg.addColorStop(0, 'rgba(95,227,255,0)'); hg.addColorStop(.5, 'rgba(200,235,255,.9)'); hg.addColorStop(1, 'rgba(169,139,255,0)');
  ctx.fillStyle = hg; ctx.fillRect(X + 60, Y + 1, Wd - 120, 2); ctx.restore();
  { const sw = clamp((lt - .1) / 1.6), sa = Math.sin(PI * sw);                                   // soft light sweep along the top edge as the window opens
    if (sa > .01) { const sx = X + 40 + (Wd - 80) * eio(sw), g2 = ctx.createLinearGradient(sx - 300, 0, sx + 300, 0);
      g2.addColorStop(0, 'rgba(180,230,255,0)'); g2.addColorStop(.5, 'rgba(220,245,255,1)'); g2.addColorStop(1, 'rgba(180,230,255,0)');
      ctx.save(); rrect(X, Y, Wd, Hh, 30); ctx.clip(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .7 * sa * GA; ctx.fillStyle = g2; ctx.fillRect(sx - 300, Y - 1, 600, 4);
      ctx.globalAlpha = .1 * sa * GA; ctx.fillRect(sx - 300, Y - 1, 600, 90); ctx.restore(); } }
  // header
  orb(X + 54, Y + 38, 30, .55 + .1 * Math.sin(lt * 1.3)); ctx.save(); ctx.globalAlpha = GA; ctx.strokeStyle = PAL.cyan; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(X + 54, Y + 38, 11, 0, TAU); ctx.stroke(); ctx.restore();
  tx('Assistant', X + 92, Y + 38, { font: F_UI, size: 30, weight: 600, color: '#cfe0ff', align: 'left' });
  ctx.save(); ctx.globalAlpha = .22 * GA; ctx.fillStyle = '#9fc4ff'; ctx.fillRect(X + 30, Y + 76, Wd - 60, 1.5); ctx.restore();
  { const ta = sstep(PB.in0, PB.in0 + .4, lt);                         // the example label, there from the moment the made-up title appears
    if (ta > .004) { const lbl1 = '示例：这本书并不存在', lbl2 = ' · example: this book does not exist';
      ctx.save(); ctx.font = `500 25px ${F_UI}`; const w1 = ctx.measureText(lbl1).width, w2 = ctx.measureText(lbl2).width; ctx.restore();
      const pw = w1 + w2 + 44, px = X + Wd - 40 - pw;
      gls(px, Y + 38 - 23, pw, 46, { r: 23, fill: 'rgba(60,40,110,.45)', stroke: rgba(PAL.violet, .75), lw: 1.8, alpha: ta });
      tx(lbl1, px + 22, Y + 39, { font: F_UI, size: 25, weight: 600, color: '#e6dcff', align: 'left', alpha: ta });
      tx(lbl2, px + 22 + w1, Y + 39, { font: F_UI, size: 25, weight: 500, color: '#cdbdf5', align: 'left', alpha: ta }); } }

  // ---- input bar (shared by both pages): placeholder, typed text, send button
  const IBY = Y + Hh - 107, IBX = X + 40, IBW = Wd - 80, inB = lt >= 8.4;
  const ibA = 1 - .6 * sstep(PA.send + .1, PA.send + .5, lt) + .6 * sstep(8.4, 8.8, lt) - .6 * sstep(PB.send + .1, PB.send + .5, lt);
  const nA = countT(PA.typeT, lt), nB = lt >= PB.in0 ? countT(PB.typeT, lt) : 0, n = inB ? nB : nA;
  const sendT = inB ? PB.send : PA.send, segs = inB ? USER_B : USER_A;
  gls(IBX, IBY, IBW, 66, { r: 33, fill: 'rgba(6,12,28,.7)', stroke: `rgba(160,210,255,${.28 + .2 * (n > 0 && lt < sendT ? 1 : 0)})`, lw: 1.6, alpha: ibA });
  const phA = Math.max(1 - sstep(.62, .72, lt), sstep(8.3, 8.6, lt) * (1 - sstep(PB.in0 - .04, PB.in0 + .04, lt))) * (lt < 3 || lt > 8.2 ? 1 : 0);
  tx('Ask anything…', X + 84, IBY + 33, { font: F_UI, size: 32, color: PAL.faint, align: 'left', alpha: phA * ibA });
  const act = n > 0 && lt < sendT + .3 ? 1 : 0, sbx = IBX + IBW - 40, sby = IBY + 33, press = 1 - .12 * Math.exp(-Math.pow((lt - sendT) / .08, 2));
  ctx.save(); ctx.globalAlpha = GA * ibA; ctx.translate(sbx, sby); ctx.scale(press, press); ctx.beginPath(); ctx.arc(0, 0, 25, 0, TAU);
  ctx.fillStyle = `rgba(95,227,255,${.12 + .5 * act})`; ctx.fill(); ctx.strokeStyle = `rgba(160,230,255,${.4 + .5 * act})`; ctx.lineWidth = 1.8; ctx.stroke();
  ctx.strokeStyle = act ? '#fff' : '#6d80a8'; ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, -10); ctx.moveTo(-9, -1); ctx.lineTo(0, -10); ctx.lineTo(9, -1); ctx.stroke(); ctx.restore();
  const inA = inB ? 1 : 1, tA = (1 - sstep(sendT, sendT + .25, lt)) * ibA * inA;                   // typed text fades from the bar while the bubble fades in above
  const barVisible = inB || lt < PA.out0;
  if (barVisible && n > 0 && tA > .004) {
    const endx = drawSegs(segs, n, X + 84, IBY + 34, FS, Math.max(tA, 0));
    if (lt < sendT) { const idle = lt - (inB ? PB.typeT[n - 1] : PA.typeT[n - 1]); mycaret(endx + 4, IBY + 33, 44, idle < .3 || !(Math.floor((idle - .3) * 2.2) % 2) ? 1 : 0); }
  } else if (barVisible && lt < (inB ? PB.in0 + .1 : .8) && lt >= (inB ? 8.6 : .2)) mycaret(X + 84, IBY + 33, 44, Math.floor(lt * 2.2) % 2 ? 0 : 1);

  // ---- user bubbles + answers
  const bubble = (segsX, send, outA, y0) => {
    const e = sstep(send + .06, send + .45, lt) * outA; if (e <= .004) return;
    const full = segW(segsX, FS), bl = X + Wd - 50 - 32 - full, ty = y0 + (1 - eout(clamp((lt - send - .06) / .5))) * 14;
    gls(bl - 32, ty - 38, full + 64, 76, { r: 24, fill: 'rgba(79,140,255,.28)', stroke: 'rgba(120,200,255,.55)', lw: 1.8, glow: 'rgba(79,140,255,.4)', blur: 22, alpha: e });
    drawSegs(segsX, 999, bl, ty + 1, FS, e);
  };
  const outA = 1 - sstep(PA.out0, PA.out1, lt);
  bubble(USER_A, PA.send, outA, Y + 138);
  drawAnswer(LAY_A, PA.a0, PA.dt, lt, outA, PA.aEnd);
  drawStrip(lt, outA);
  if (lt >= PB.send) { bubble(USER_B, PB.send, 1, Y + 138); drawAnswer(LAY_B, PB.a0, PB.dt, lt, 1, PB.aEnd); drawWarning(lt); }
  ctx.restore(); GA = 1;
}

// ---------------------------------------------------------------- depth: faint conversations behind the window, a soft floor glow
function drawBack(lt) {
  const op = sstep(.2, 1.4, lt);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(960, 830, 0, 960, 830, 760); g.addColorStop(0, `rgba(80,170,255,${.11 * op})`); g.addColorStop(1, 'rgba(80,170,255,0)');
  ctx.translate(0, 830); ctx.scale(1, .22); ctx.translate(0, -830); ctx.fillStyle = g; ctx.fillRect(160, 600, 1600, 520); ctx.restore();
  ctx.save();
  for (const [dx, dy, s, a] of [[-150, -34, .9, .07], [140, 26, .86, .06]]) {
    const ox = dx + 9 * Math.sin(lt * .3 + dx), oy = dy + 5 * Math.sin(lt * .27 + dy);
    ctx.save(); ctx.translate(960 + ox, 500 + oy); ctx.scale(s, s); ctx.translate(-960, -500);
    glass(X, Y + 20, Wd, Hh - 40, { r: 30, fill: 'rgba(12,20,44,.5)', stroke: 'rgba(160,200,255,.6)', lw: 1.4, alpha: a * 5 * op * .6 });
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- sound
const sfx = [[0, 'swell', { dur: 1.6 }], [.1, 'shimmer']];
PA.typeT.forEach((t, i) => { if (i % 3 === 0) sfx.push([t, 'type']); });
sfx.push([PA.send, 'swish', { pitch: 1.2 }]);
ANS_A.forEach((_, i) => { if (i % 2 === 0) sfx.push([PA.a0 + i * PA.dt, 'chip', { midi: [72, 76, 79, 83, 79, 76][(i / 2) % 6] }]); });
sfx.push([PA.aEnd + .1, 'chime', { midi: 84 }], [PA.out0, 'whoosh', { dur: .6 }]);
PB.typeT.forEach((t, i) => { if (i % 4 === 0) sfx.push([t, 'type']); });
sfx.push([PB.send, 'swish', { pitch: 1.2 }]);
ANS_B.forEach((_, i) => { if (i % 2 === 0) sfx.push([PB.a0 + i * PB.dt, 'type']); });
sfx.push([T_WARN + .1, 'swell', { dur: 1.4 }], [T_WARN + .25, 'down'], [T_WARN + .9, 'ding', { midi: 67 }]);

scene({
  id: 'chat', start: 56, len: 6, fi: .3, fo: .4, mb: 2, bloom: .9,
  ch: ['08', '对话', 'CHAT'],
  subs: [
    [.4, 3.4, '现在，你输入一句话', 'Now you type a sentence'],
    [3.6, 8.2, '它一个词一个词地接下去，直到写完整段回答', 'and it continues one token at a time until the reply is complete'],
    [8.5, 14.8, '但它预测的是“最可能的话”，并不查证事实——所以会一本正经地出错', 'But it predicts likely text and does not check facts, so it can be confidently wrong'],
  ],
  sfx, hits: [],
  cam: (lt, d) => ({ z: 1 + .03 * lt / d, x: 7 * Math.sin(lt * .21), y: 4 * Math.sin(lt * .17 + 1) }),
  draw(lt, d, T) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const na = sstep(8.3, 9.1, lt), aa = 1 - na;
    if (na > .001) glDraw(0, { time: 52 + lt, tint: [.12, .15, .46], amp: .76 });
    if (aa > .001) glDraw(1, { time: lt, tint: [.07, .2, .58], amp: .66 }, aa);
    ctx.save(); ctx.fillStyle = '#bcd6ff';                              // depth dust
    for (const p of DUST) {
      const y = ((p.y - lt * 8 * p.z) % H + H) % H, x = p.x + Math.sin(lt * .5 + p.p) * 8 * p.z, r = .8 + p.z * 2.2;
      ctx.globalAlpha = (.1 + .3 * p.z) * (.65 + .35 * Math.sin(lt * 1.6 + p.p)); ctx.fillRect(x, y, r, r);
    }
    ctx.restore();
    drawBack(lt);
    drawChat(lt);
  },
});
