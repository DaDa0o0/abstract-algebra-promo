// s4_predict: scores -> probabilities -> sample -> append -> repeat.   Local time 0..5 s (global 22.5..27.5).
// Beats (0.625 s): 0.625 vector hits the vocabulary field, 2.5 the roulette lands on "mat" (a gold chip lifts off its bar label),
// 3.125 "mat" settles into the sentence, then the appended tokens arrive on 8th notes: 3.4375 " and", 3.75 " purred", 4.0625 "."
// so the finished sentence is stable for ~0.5 s (plus the fade-out) at the end.
//
// PROBABILITY BAR LOOK (reused by scenes 0, 5, 6):  label left (Inter 600, right-aligned 28 px before the bar, near-white),
// a rounded capsule 26 px thick whose gradient runs cyan -> violet (gold gradient when it is "the answer"), a faint track behind it,
// a hot end cap that glows (lighter), and the percentage right of the tip in JetBrains Mono 700.
// Bar length = p * 1500 px (here scaled by UNIT).

const R = mulberry(20260004);

// ---------- layout constants
const BX = 665, BY0 = 316, PITCH = 56, UNIT = 1800, TH = 30;       // bars: x of the baseline, y of row 0, row pitch, px per unit probability, thickness
const VX = 960, VY = 220, IMPACT = [960, 520];                     // where the vector from scene 3 arrives / hits the field
const NEXT = STORY.next;
const COLS = ['The', 'cat', 'sat', 'on', 'the'];                   // sentence chips (leading spaces trimmed for display)
const LAND = 2.5;                                                  // the roulette stops on "mat" (beat 4)
const T_MAT = 3.125;                                               // "mat" settles into the sentence (beat 5)
// appended tokens, t = the moment the token lands in the sentence
const APP = [
  { s: 'mat', col: PAL.gold, t: T_MAT },
  { s: STORY.afterwards[0].trim(), col: PAL.blue, t: 3.4375 },
  { s: STORY.afterwards[1].trim(), col: PAL.pink, t: 3.75 },
  { s: STORY.afterwards[2].trim(), col: PAL.cyan, t: 4.0625 },
];
// the mini chart before each new token: which bar is picked (not always the tallest: sampling) and the (illustrative) bar shape
const PICKS = [
  { t: 3.4375, c: 1, tgt: [.8, .5, .36, .24, .15, .1, .06, .04] },
  { t: 3.75, c: 0, tgt: [1, .58, .34, .2, .13, .09, .06, .04] },
  { t: 4.0625, c: 2, tgt: [.66, .58, .46, .24, .14, .09, .06, .04] },
];
const CSIZE = 44, CPAD = 22, CH = 72, GAP = 14;
const SEN_Y0 = 815, SEN_Y1 = 540, RISE0 = 2.65, RISE1 = 3.2;
const SCORE = NEXT.map(([, p]) => (Math.log(p) + 6.1).toFixed(1));  // illustrative raw scores (logits): softmax of these gives STORY.next

// ---------- vocabulary field (a thousand dots stand in for tens of thousands of tokens)
const DOTS_HI = [], DOTS_LO = [];
{
  let n = 0;
  while (n < 1100) {
    const x = 200 + R() * 1520, y = 292 + R() * 450, ex = (x - 960) / 780, ey = (y - 520) / 235;
    if (ex * ex + ey * ey > 1) continue;
    const s = Math.pow(R(), 5);
    const d = { x, y, s, dist: Math.hypot((x - IMPACT[0]) / 1.9, y - IMPACT[1]), sz: 2 + R() * 2.6, ph: R() * TAU, dl: R() * .2, tx: BX - 4 + R() * 84, ty: BY0 + 7 * PITCH + (R() - .5) * 14, cx: (R() - .5) * 70 };
    (s > .22 ? DOTS_HI : DOTS_LO).push(d); n++;
  }
}
function makeSprite(r, g, b) {                                   // soft round point, built once at load time
  const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d');
  const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, `rgba(${r},${g},${b},1)`); gr.addColorStop(.35, `rgba(${r},${g},${b},.55)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = gr; x.fillRect(0, 0, 32, 32); return c;
}
const SPR_LO = makeSprite(120, 160, 235), SPR_HI = makeSprite(215, 232, 255);
// the seven named candidates sit at fixed places in the field (y ordered like their rows, so the flights do not cross) and fly to their rows
const NAMED = [[1230, 370], [860, 422], [1420, 474], [700, 526], [1100, 578], [1530, 630], [540, 682]].map(([x, y], i) => ({ x, y, i, bend: (i % 2 ? 1 : -1) * 22 }));
// vector components (signed), 12 columns (= s3's HV, so the hand-off is the same object)
const VEC = Array.from({ length: 12 }, () => (R() - .5) * 2).map((v, i) => Math.sign(v) * (.28 + Math.abs(v) * .72));

// ---------- small helpers
const hex2 = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mixHex = (a, b, k) => { const A = hex2(a), B = hex2(b); const c = i => Math.round(lerp(A[i], B[i], clamp(k))).toString(16).padStart(2, '0'); return '#' + c(0) + c(1) + c(2); };
const rowY = i => BY0 + i * PITCH;
const rowFly0 = i => .95 + .06 * i, FLY = .5;                       // flight window for row i
const rowArr = i => rowFly0(i) + FLY;
const rowGrow = (t, i) => eout(clamp((t - rowArr(i)) / .4));
const bez = (a, c, b, u) => (1 - u) * (1 - u) * a + 2 * (1 - u) * u * c + u * u * b;
const cub = (a, b, c, d, u) => { const v = 1 - u; return v * v * v * a + 3 * v * v * u * b + 3 * v * u * u * c + u * u * u * d; };
const sm = k => k * k * (3 - 2 * k);
const MAT_LABEL_W = measure('mat', 30, F_UI, 600);

// roulette: the ball hops from row to row, dwelling longer on likelier rows, and finally stops on row 0 (mat) exactly on the beat
const ROUL_ROWS = [5, 1, 6, 2, 7, 4, 3, 0];
const ROUL = (() => {
  const tr = .045, arr = [], lv = []; let t = 0;
  ROUL_ROWS.forEach((r, j) => { arr.push(t); const dw = j === ROUL_ROWS.length - 1 ? 0 : .03 + .55 * NEXT[r][1]; lv.push(t + dw); t += dw + tr; });
  const T0 = 1.8, f = (LAND - T0) / arr[arr.length - 1];
  return { arr: arr.map(x => T0 + x * f), lv: lv.map(x => T0 + x * f) };
})();
function rouletteRow(t) {
  const n = ROUL_ROWS.length;
  if (t <= ROUL.arr[0]) return ROUL_ROWS[0];
  for (let j = 0; j < n - 1; j++) {
    if (t < ROUL.lv[j]) return ROUL_ROWS[j];
    if (t < ROUL.arr[j + 1]) return lerp(ROUL_ROWS[j], ROUL_ROWS[j + 1], eio((t - ROUL.lv[j]) / (ROUL.arr[j + 1] - ROUL.lv[j])));
  }
  return 0;
}

// ---------- the bar (see header). The percentage sits at its final position and fades in once the bar has grown (no counting: it would smear).
function pbar(label, p, x, y, o = {}) {
  const k = o.k ?? 1, a = o.a ?? 1, hot = o.hot || 0, th = o.th || TH, unit = o.unit || UNIT, la = o.la ?? 1, size = o.size || 30;
  if (a <= .004) return;
  const len = Math.max(th, p * unit * k), lx = o.lx ?? x - 28, tipX = x + len, fullTip = x + Math.max(th, p * unit), a2 = a * clamp(k * 5);
  ctx.save();
  ctx.globalAlpha = a2 * .55; rrect(x, y - th / 2, unit * .5, th, th / 2); ctx.fillStyle = 'rgba(150,185,255,.07)'; ctx.fill();   // faint track
  ctx.globalAlpha = a2;
  const g = ctx.createLinearGradient(x, 0, x + Math.max(len, 80), 0);
  g.addColorStop(0, mixHex('#2fa6e0', '#dc8a1e', hot));
  g.addColorStop(1, mixHex('#6a4ff0', '#f5b545', hot));
  ctx.shadowColor = hot > .01 ? 'rgba(255,190,100,.55)' : 'rgba(110,170,255,.7)'; ctx.shadowBlur = 14 + 4 * hot;
  rrect(x, y - th / 2, len, th, th / 2); ctx.fillStyle = g; ctx.fill(); ctx.shadowBlur = 0;
  ctx.globalAlpha = a2 * .16 * (1 - .8 * hot); rrect(x + 4, y - th / 2 + 3, Math.max(0, len - 8), th * .3, th * .15); ctx.fillStyle = '#fff'; ctx.fill();   // top sheen
  ctx.globalCompositeOperation = 'lighter'; { const gg = ctx.createRadialGradient(tipX - th / 2, y, 0, tipX - th / 2, y, th * 1.5); const c0 = hot > .3 ? '255,170,80' : '120,170,255'; gg.addColorStop(0, `rgba(${c0},${(.55 - .38 * hot) * a2})`); gg.addColorStop(1, `rgba(${c0},0)`); ctx.fillStyle = gg; ctx.fillRect(tipX - th * 2, y - th * 1.5, th * 3, th * 3); }
  ctx.restore();
  if (la > 0) text(label, lx, y + 1, { font: F_UI, weight: 600, size, color: mixHex('#dfe9ff', PAL.gold, hot), alpha: a * la, align: 'right' });
  const pa = sstep(.55, 1, k);
  if (pa > 0) text(`${Math.round(p * 100)}%`, fullTip + 20, y + 1, { font: F_MONO, weight: 700, size, color: mixHex('#ffffff', PAL.gold, hot), alpha: a * pa, align: 'left' });
}

// ---------- the vector (what scene 3 hands over): 12 signed bars in brackets. Identical to s3's vector at t = 0 (scale 1),
// then it swells to ~1.4x so it owns the frame, and each bar drops into the field in turn.
function drawVector(t) {
  const n = VEC.length, vs = .3, fall = .26, stag = .008;
  const vsc = 1 + .4 * eout(sstep(0, .3, t)), step = 30 * vsc;
  const x0 = VX - (n - 1) * step / 2;
  const pul = 1 + .03 * Math.sin(t * 9), drift = 8 * sstep(0, .38, t);
  const kc = clamp((t - vs - 5.5 * stag) / fall), cy = lerp(VY + drift, IMPACT[1], ein(kc));
  ctx.save();
  if (kc < 1) {
    ctx.globalCompositeOperation = 'lighter'; glowDot(VX, cy, (240 - 80 * kc) * vsc, 'rgba(140,170,255,A)', .5 * (1 - kc));
    if (kc > 0) {                                      // streak behind the falling vector
      const g = ctx.createLinearGradient(0, VY, 0, cy); g.addColorStop(0, 'rgba(160,190,255,0)'); g.addColorStop(1, `rgba(200,225,255,${.5 * kc})`);
      ctx.fillStyle = g; ctx.fillRect(VX - 3, VY, 6, cy - VY);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  for (let i = 0; i < n; i++) {
    const ki = clamp((t - vs - i * stag) / fall), e = ein(ki);
    const al = 1 - sstep(.88, 1, ki); if (al <= .01) continue;
    const v = VEC[i], x = lerp(x0 + i * step, VX + (i - 5.5) * step * .6, e), y = lerp(VY + drift, IMPACT[1], e), h = (Math.abs(v) * 54 * vsc * (1 + .05 * Math.sin(t * 9 + i)) * (1 - .4 * ki) + 5) * pul;
    const col = v > 0 ? PAL.cyan : PAL.violet;
    ctx.globalAlpha = al; ctx.shadowColor = col; ctx.shadowBlur = 16; ctx.fillStyle = mixHex(col, '#ffffff', .55);
    rrect(x - 5 * vsc, v > 0 ? y - h : y, 10 * vsc, h, 5); ctx.fill();
  }
  const ba = 1 - sstep(.85, 1, kc);
  if (ba > .01) {
    ctx.globalAlpha = ba; ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(210,225,255,.55)'; ctx.lineWidth = 2.5;
    const bw = (n * step / 2 + 18) * (1 - .4 * kc) + 8 * (1 - kc), bh = 74 * vsc * pul;
    ctx.beginPath(); ctx.moveTo(VX - bw + 14, cy - bh); ctx.lineTo(VX - bw, cy - bh); ctx.lineTo(VX - bw, cy + bh); ctx.lineTo(VX - bw + 14, cy + bh);
    ctx.moveTo(VX + bw - 14, cy - bh); ctx.lineTo(VX + bw, cy - bh); ctx.lineTo(VX + bw, cy + bh); ctx.lineTo(VX + bw - 14, cy + bh); ctx.stroke();
  }
  ctx.restore();
  return vsc;
}

// ---------- the growing sentence. A chip grows from .82 to full size while its slot opens, so nothing overlaps its neighbours.
function sentence(t) {
  const items = [];
  COLS.forEach((s, i) => items.push({ s, col: HUES[i], p: 1, vis: clamp((t - 1.5 - i * .06) / .4), w: measure(s, CSIZE, F_MONO, 600) + CPAD * 2 }));
  APP.forEach((a, j) => {
    const p = j === 0 ? 1 : sstep(a.t - .12, a.t, t), w = measure(a.s, CSIZE, F_MONO, 600) + CPAD * 2;
    items.push({ s: a.s, col: a.col, p, vis: j === 0 ? clamp((t - 1.5 - 5 * .06) / .4) : 1, w, app: j, t0: a.t });
  });
  let total = -GAP; for (const it of items) total += (it.w * lerp(.82, 1, it.p) + GAP) * it.p;
  const head = VX - total / 2; let x = head, edge = head;
  for (const it of items) {
    const sc = lerp(.82, 1, it.p); it.sc = sc; it.cx = x + it.w * sc / 2;
    if (it.p > .01 && it.vis > .01) edge = Math.max(edge, it.cx + it.w * sc / 2);
    x += (it.w * sc + GAP) * it.p;
  }
  return { items, tail: edge, head, y: SEN_Y0 + (SEN_Y1 - SEN_Y0) * sstep(RISE0, RISE1, t) };
}
// flickering histogram "next word?" panel at a fixed place above the sentence: re-draws its bars before every token, gold bar = the pick
const PANEL = { cx: 960, cy: 358, w: 380, h: 200 };
function miniBars(S, t, a) {
  if (a <= .01) return;
  let j = PICKS.findIndex(p => t < p.t + .05); if (j < 0) j = PICKS.length - 1;
  const pk = PICKS[j], s0 = j ? PICKS[j - 1].t + .05 : 3.1, u = clamp((t - s0) / (pk.t - s0));
  const flick = 1 - sstep(.3, .6, u), { cx, cy, w, h } = PANEL;
  glass(cx - w / 2, cy - h / 2, w, h, { alpha: a, r: 18, fill: 'rgba(14,22,44,.8)', stroke: 'rgba(160,200,255,.4)' });
  ctx.save();
  for (let b = 0; b < 8; b++) {
    const r = hash1(j * 13.7 + b * 3.1 + Math.floor(t * 20) * 1.93), bh = 8 + 84 * lerp(pk.tgt[b], r, flick);
    const hot = b === pk.c ? sstep(.55, .8, u) : 0;
    ctx.globalAlpha = a * (.75 + .25 * hot); ctx.fillStyle = mixHex('#52c9e8', '#f2b447', hot); rrect(cx - 145 + b * 38, cy + 34 - bh, 24, bh, 5); ctx.fill();
  }
  ctx.restore();
  text('NEXT WORD? · 下一个词', cx, cy + 72, { font: F_UI, weight: 600, size: 22, ls: 1, color: '#c8d6f5', alpha: a });
  text('e.g.', cx + w / 2 - 16, cy - h / 2 + 22, { font: F_UI, weight: 500, size: 18, color: '#8fa3c7', alpha: a, align: 'right' });
  ctx.save(); ctx.globalAlpha = a * .8; ctx.fillStyle = 'rgba(14,22,44,.95)'; ctx.strokeStyle = 'rgba(160,200,255,.4)'; ctx.lineWidth = 1.5;   // little pointer: the chart belongs to the next slot
  ctx.beginPath(); ctx.moveTo(cx - 12, cy + h / 2 - .5); ctx.lineTo(cx, cy + h / 2 + 12); ctx.lineTo(cx + 12, cy + h / 2 - .5); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}
function goldPlate(w, a) {                                // solid gold plate behind a freshly chosen token (dark ink text on top)
  if (a <= .01) return;
  ctx.save(); ctx.globalAlpha = a; const g = ctx.createLinearGradient(0, -CH / 2, 0, CH / 2); g.addColorStop(0, '#ecc577'); g.addColorStop(1, '#cf9a42');
  ctx.shadowColor = 'rgba(255,190,90,.5)'; ctx.shadowBlur = 18; rrect(-w / 2, -CH / 2, w, CH, CH * .28); ctx.fillStyle = g; ctx.fill(); ctx.restore();
}
// the loop: a wide arc from the end of the sentence back round under the whole sentence (a bracket), with a pulse travelling along it each time a token is added
const PULSES = [T_MAT, 3.4375, 3.75, 4.0625, 4.45];
function loopArc(S, a, t) {
  if (a <= .01) return;
  const bx = S.tail - 40, ex = S.head + 40, by = S.y + CH / 2 + 22, cy = by + 118;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  ctx.strokeStyle = PAL.cyan;                                                                         // soft halo = a wide faint stroke under the line (no shadowBlur: much cheaper)
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.bezierCurveTo(bx, cy, ex, cy, ex, by + 12);
  ctx.globalAlpha = a * .14; ctx.lineWidth = 14; ctx.stroke(); ctx.globalAlpha = a * .7; ctx.lineWidth = 4; ctx.stroke();
  ctx.globalAlpha = a * .38; ctx.lineWidth = 2;                                                       // bracket under the whole sentence: the new token joins the input
  ctx.beginPath(); ctx.moveTo(S.head, by - 14); ctx.lineTo(S.head, by - 8); ctx.lineTo(S.tail, by - 8); ctx.lineTo(S.tail, by - 14); ctx.stroke();
  ctx.shadowBlur = 0; ctx.globalAlpha = a * .85; ctx.fillStyle = '#bff2ff';                         // arrowhead pointing up into the sentence
  ctx.beginPath(); ctx.moveTo(ex, by - 8); ctx.lineTo(ex - 15, by + 20); ctx.lineTo(ex + 15, by + 20); ctx.closePath(); ctx.fill();
  for (const t0 of PULSES) {
    const u = clamp((t - t0) / .55); if (u <= 0 || u >= 1) continue;
    const e = eio(u), x = cub(bx, bx, ex, ex, e), y = cub(by, cy, cy, by + 12, e), g = Math.sin(u * PI);
    glowDot(x, y, 34, 'rgba(160,235,255,A)', .85 * g * a);
  }
  ctx.restore();
  text('AUTOREGRESSIVE · 自回归', VX, by + 118 * .75 + 38, { font: F_UI, weight: 600, size: 30, ls: 4, color: '#c8d6f5', alpha: a * .95 });
}

// ---------- the scene
const CUES = [
  [.3, 'swish', { pitch: 1.1 }],
  [.625, 'hit', { k: .3 }], [.66, 'sparkle', { dur: .9 }],
  [.95, 'whoosh', { dur: .7 }],
  ...Array.from({ length: 7 }, (_, i) => [rowArr(i), 'tick', { hi: true }]),
  [rowArr(7) + .02, 'tick'],
  [1.7, 'swish', { pitch: .9 }],
  ...ROUL.arr.slice(0, 7).map(t => [t, 'tick', { hi: false }]),
  [LAND, 'hit', { k: .5 }], [LAND, 'up'], [LAND, 'chime', { midi: 84 }], [LAND + .03, 'shimmer'],
  [2.6, 'swish', { pitch: 1.3 }],
  [2.7, 'swell', { dur: 1.4 }],
  [T_MAT, 'chip', { midi: 76 }],
  [3.28, 'tick', { hi: true }], [3.4375, 'chip', { midi: 79 }],
  [3.6, 'tick', { hi: true }], [3.75, 'chip', { midi: 83 }],
  [3.9, 'tick', { hi: true }], [4.0625, 'chip', { midi: 88 }],
  [4.45, 'ping', { midi: 91 }],
].sort((a, b) => a[0] - b[0]);

scene({
  id: 'predict', start: 9, len: 2, fi: .1, fo: .25, mb: 2, bloom: .5,
  ch: ['04', '预测', 'PREDICTION'],
  cam: camPush(.06),
  subs: [[.3, 2.6, '给词表里的每个词打分，再按概率抽出一个', 'Score every word in the vocabulary, then draw one by probability'],
         [2.7, 4.9, '接在句末，再来一遍——一次一个词', 'Append it and repeat — one token at a time']],
  sfx: CUES,
  hits: [[.625, .22], [LAND, .25]],
  draw(lt, d, T) {
    // text and UI are drawn at the exact frame time (tq) in every motion-blur sub-frame so they stay crisp (only the glows, the dots and the vector smear);
    // tm is the real sub-frame time
    const tm = lt, t = Math.round(lt * 30) / 30;
    const S = sentence(t), sy = S.y;
    // ---- backdrop: violet nebula with a touch of gold
    glDraw(0, { time: tm + 22.5 + 40, tint: [.30, .15, .46], amp: .8 });
    // a warm pool of light that follows the action and stays behind the growing sentence
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const warm = sstep(2.5, 2.9, t) * (1 - .35 * sstep(3.4, 4.0, t)) * .5;
    if (warm > 0) glowDot(960, lerp(470, sy + 20, sstep(2.7, 3.4, t)), 760, 'rgba(255,170,90,A)', warm * .12);
    ctx.restore();

    // ---- the vocabulary field: soft round points, there from the first frame, lit by the shock wave from the vector, then drained into the bars
    const r = Math.max(0, tm - .625) * 760, fa = .35 + .65 * sstep(0, .4, tm);
    const drawDots = (arr, spr, sc) => {
      for (const q of arr) {
        const dist = q.dist, lit = sstep(0, 1, (r - dist) / 170), ring = Math.exp(-Math.pow((r - dist) / 48, 2)) * (r > 0 ? 1 : 0);
        let x = q.x + Math.sin(tm * .8 + q.ph) * 3, y = q.y + Math.cos(tm * .7 + q.ph) * 3, al = fa * (.26 + .8 * q.s * lit * sc + .55 * ring * (.4 + q.s)) * (.85 + .15 * Math.sin(tm * 3 + q.ph));
        const k = clamp((tm - 1.0 - q.dl) / .45);
        if (k > 0) { const e = eio(k); x = lerp(x, q.tx, e) + Math.sin(k * PI) * q.cx; y = lerp(y, q.ty, e) + Math.sin(k * PI) * (q.y < 520 ? -12 : 12); al *= 1 - sstep(.45, 1, k); }
        if (al <= .03) continue;
        ctx.globalAlpha = Math.min(1, al);
        const s = q.sz * (1 + .6 * q.s * lit + .7 * ring) * 1.15;
        ctx.drawImage(spr, x - s, y - s, 2 * s, 2 * s);
      }
    };
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (tm < 1.7) { drawDots(DOTS_LO, SPR_LO, 1.4); drawDots(DOTS_HI, SPR_HI, 1); }
    ctx.restore();
    if (r > 0 && r < 280) {                               // the shock ring itself (fades before it can touch the captions)
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(IMPACT[0], IMPACT[1]); ctx.scale(1.9, 1);
      ctx.lineWidth = 3 / 1.9 * 1.4; ctx.strokeStyle = `rgba(170,200,255,${.5 * (1 - sstep(170, 280, r)) * (1 - r / 700)})`; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); ctx.restore();
    }

    // ---- the vector arrives (hand-off from scene 3), swells, its bars drop one by one into the field
    if (tm < .75) {
      drawVector(tm);
      text('上下文向量 · CONTEXT VECTOR', VX, lerp(332, 362, sstep(0, .26, t)), { font: F_UI, weight: 600, size: 24, ls: 4, color: '#c8d6f5', alpha: 1 - sstep(.1, .26, t) });
    }
    if (t >= .5) {                                        // impact flash (soft, capped)
      const f = Math.exp(-Math.max(0, t - .625) * 6) * sstep(.5, .625, t);
      if (f > .02) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowDot(IMPACT[0], IMPACT[1], 280 * (1 - f * .3), 'rgba(150,180,255,A)', f * .28); ctx.restore(); }
    }

    // ---- captions (the heading hands over cleanly; the long one is fully on by 1.6)
    const CAP = { font: F_UI, weight: 600, size: 30 };
    text('VOCABULARY · 词表', VX, 238, { ...CAP, ls: 6, color: '#c8d6f5', alpha: win(t, .5, 1.05, .25, .15) });
    text('SCORES · 分数', VX, 238, { ...CAP, ls: 6, color: '#c8d6f5', alpha: win(t, .95, 1.5, .2, .15) });
    text('≈ 100,000 tokens (e.g.)', VX, 274, { font: F_UI, weight: 500, size: 22, ls: 2, color: '#a9bfe8', alpha: win(t, .55, 1.4, .25, .25) * .9 });
    text('SCORES → SOFTMAX → PROBABILITIES  ·  概率', VX, 238, { ...CAP, ls: 4, color: '#c8d6f5', alpha: win(t, 1.35, 2.85, .25, .3) * .95 });

    // ---- the seven named candidates: light up with a raw score, fly into their rows (label attached the whole way), become bars
    const land = sstep(LAND, LAND + .15, t);             // hot (gold) mix for "mat"
    for (const n of NAMED) {
      const i = n.i, p = NEXT[i][1], lab = NEXT[i][0];
      const vis = sstep(.7, 1.0, t), k = clamp((t - rowFly0(i)) / FLY), e = sm(k);
      const tx = BX, ty = rowY(i);
      const px = k >= 1 ? tx : bez(n.x, (n.x + tx) / 2 + n.bend * .5, tx, e), py = k >= 1 ? ty : bez(n.y, (n.y + ty) / 2 - n.bend, ty, e);
      const gr = rowGrow(t, i);
      const R0 = 9 + p * 40;
      const rowA = i === 0 ? 1 - sstep(2.62, 2.92, t) : 1 - sstep(2.5, 2.72, t);
      const labOn = i === 0 ? 1 - sstep(LAND - .01, LAND + .01, t) : 1;     // "mat": the label hands over to the flying chip
      if (k < 1) {                                        // still a dot in the field (or flying)
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const pulse = 1 + .12 * Math.sin(t * 6 + i);
        glowDot(px, py, (R0 * 2.4) * pulse * lerp(1, .6, e), 'rgba(170,205,255,A)', vis * .9);
        ctx.restore();
        if (vis > .01) {
          text(lab, px - lerp(R0 + 14, 28, e), py + 1, { font: F_UI, weight: 600, size: 30, color: '#e8f0ff', alpha: vis, align: 'right' });
          const na = vis * sstep(.95, 1.2, t) * (1 - sstep(0, .35, k));
          if (na > .01) text(SCORE[i], px + (R0 + 14), py + 1, { font: F_MONO, weight: 500, size: 24, color: '#9fc4ff', alpha: na, align: 'left' });
        }
      } else if (gr <= 0) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowDot(px, py, 26, 'rgba(170,205,255,A)', .9); ctx.restore();
        text(lab, tx - 28, ty + 1, { font: F_UI, weight: 600, size: 30, color: '#e8f0ff', alpha: 1, align: 'right' });
      }
      if (k >= 1 && gr > 0) pbar(lab, p, BX, ty, { k: gr, a: rowA, hot: i === 0 ? land : 0, la: labOn });
    }
    // "other words": the rest of the vocabulary, arriving as the swarm of dim dots
    {
      const gr = rowGrow(t, 7), rowA = 1 - sstep(2.5, 2.72, t);
      if (gr > 0) pbar('其他词 other', NEXT[7][1], BX, rowY(7), { k: Math.max(gr, .0001), a: rowA, la: 1, size: 30 });
    }

    // ---- roulette: a gold ball hops over the rows and stops on "mat" at 2.5 s
    {
      const a = sstep(1.75, 1.9, t) * (1 - sstep(LAND + .2, LAND + .4, t));
      if (a > 0) {
        const rr = rouletteRow(t), y = BY0 + rr * PITCH, x = BX - 270;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const band = ctx.createLinearGradient(BX - 320, 0, BX + 900, 0); band.addColorStop(0, 'rgba(255,210,122,.14)'); band.addColorStop(.6, 'rgba(255,210,122,.04)'); band.addColorStop(1, 'rgba(255,210,122,0)');
        ctx.globalAlpha = a; ctx.fillStyle = band; rrect(BX - 320, y - 26, 1220, 52, 26); ctx.fill();
        glowDot(x, y, 40, 'rgba(255,190,100,A)', a * .7);
        ctx.globalAlpha = a; ctx.fillStyle = '#fff4d0'; ctx.beginPath(); ctx.arc(x, y, 8.5, 0, TAU); ctx.fill();
        ctx.restore();
        if (t >= LAND) {                                  // gold pulse races along the winning bar
          const u = clamp((t - LAND) / .45), tip = BX + NEXT[0][1] * UNIT;
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowDot(lerp(BX, tip, eout(u)), BY0, 40, 'rgba(255,215,140,A)', (1 - u) * .1 * a); ctx.restore();
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowDot(x, y, 100 * eout(clamp((t - LAND) / .5)), 'rgba(255,215,140,A)', (1 - clamp((t - LAND) / .5)) * .28); ctx.restore();
        }
      }
    }

    // ---- the sentence: appears under the bars, "mat" lifts off its bar label into the slot, everything rises and the sentence grows
    {
      for (const it of S.items) {
        if (it.vis <= 0 || it.p <= 0) continue;
        const isMat = it.app === 0;
        if (isMat && t < T_MAT) {                          // the slot waiting for the answer
          const va = sstep(1.5, 1.9, t);
          ctx.save(); ctx.globalAlpha = va * (1 - sstep(T_MAT - .12, T_MAT, t)); ctx.setLineDash([9, 8]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,210,122,.6)';
          rrect(it.cx - it.w / 2, sy - CH / 2, it.w, CH, CH * .28); ctx.stroke(); ctx.restore();
          caret(it.cx - 6, sy, 40, t, PAL.gold, va);
          continue;
        }
        let col = it.col, tcol = '#fff', kk = 1;
        const isApp = it.app !== undefined;
        if (isApp) {                                       // appended tokens: solid gold plate with dark ink, then plate and ink melt into their hue
          kk = sstep(it.t0, it.t0 + .32, t);
          col = mixHex(PAL.gold, it.col, kk); tcol = mixHex('#1a1000', '#ffffff', sstep(.68, .9, kk));
        }
        const al = isApp ? clamp(it.p * 4) : it.vis * .92, yOff = (1 - it.vis) * 22;
        ctx.save(); ctx.translate(it.cx, sy + yOff); ctx.scale(it.sc, it.sc);
        if (isApp) goldPlate(it.w, al * (1 - sstep(.4, .85, kk)));
        chip(it.s, 0, 0, { weight: 600, size: CSIZE, color: col, h: CH, alpha: al, glow: isApp && kk < 1 ? 4 + 8 * (1 - kk) : undefined, textColor: tcol, fillA: isApp ? (isMat ? .24 : .14) * kk : .14 });
        ctx.restore();
        if (isMat && t >= T_MAT + .1) {                    // the answer keeps a gold underline for the rest of the scene
          const ua = sstep(T_MAT + .1, T_MAT + .35, t);
          ctx.save(); ctx.globalAlpha = ua * .95; ctx.fillStyle = PAL.gold; ctx.shadowColor = 'rgba(255,200,110,.8)'; ctx.shadowBlur = 10;
          rrect(it.cx - it.w * .3, sy + CH / 2 + 6, it.w * .6, 3, 1.5); ctx.fill(); ctx.restore();
        }
        if (isApp && t > it.t0 && t < it.t0 + .5) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowDot(it.cx, sy, 130 * eout((t - it.t0) / .5), 'rgba(255,215,140,A)', (1 - (t - it.t0) / .5) * .22); ctx.restore(); }
      }
      // "mat" lifting off its bar label: the same gold chip, full-contrast ink on gold, never dimmed
      if (t >= LAND && t < T_MAT) {
        const matItem = S.items[5], f0 = LAND + .1, k = clamp((t - f0) / (T_MAT - f0));
        const sx = BX - 28 - MAT_LABEL_W / 2, syy = BY0, ex = matItem.cx, ey = sy;
        const pos = kq => { const e = lerp(kq, sm(kq), .5); return [cub(sx, sx + 140, ex, ex, e), cub(syy, syy + 200, ey - 200, ey, e)]; };   // leaves down-right, lands straight down from above (never crosses the other chips)
        const [x, y] = pos(k), sc = lerp(.72, 1, sm(k)), al = sstep(LAND, LAND + .04, t);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';            // soft comet trail
        for (let j = 1; j <= 8; j++) { const [qx, qy] = pos(clamp(k - j * .035)); glowDot(qx, qy, 28 - j * 2, 'rgba(255,200,110,A)', .16 * (1 - j / 9) * clamp(k * 6)); }
        ctx.restore();
        ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
        goldPlate(matItem.w, al);
        chip('mat', 0, 0, { weight: 600, size: CSIZE, color: PAL.gold, h: CH, alpha: al, textColor: '#1a1000', fillA: 0 });
        ctx.restore();
      }
      // the tail: caret, and the flickering "next word?" chart that precedes every new token
      if (t > T_MAT) {
        const ta = sstep(T_MAT + .05, T_MAT + .2, t);
        caret(S.tail + 24, sy, 46, t, PAL.gold, ta);
        miniBars(S, t, sstep(3.1, 3.25, t) * (1 - sstep(4.3, 4.5, t)));
      }
      // loop arc
      loopArc(S, sstep(3.1, 3.3, t), t);
    }
  },
});
