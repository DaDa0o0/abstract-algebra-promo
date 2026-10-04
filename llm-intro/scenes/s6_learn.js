// s6_learn: pretraining II. A wrong guess is turned into thousands of tiny nudges; the next-word bars sharpen, the loss curve falls.
const R = mulberry(20260006);

// ---------------------------------------------------------------- timing
// The scene opens on the error handed over from scene 5 (P(mat)=1 %, LOSS 4.6): a coral "wrong" beat, then the first back-pass at ~0.4 s.
const TS = .4, T_END = 6.25, CYC = 1.25, CG = 0;           // training starts at 0.4 s, converges on beat 10 (6.25 s); cycle grid origin CG
const LAST_C = 4;                                           // ripples stop after cycle 4 so the network calms before the convergence hit
const prog = lt => clamp((lt - TS) / (T_END - TS));         // u: 0 -> 1
const nrm = (a, u) => (Math.exp(-a * u) - Math.exp(-a)) / (1 - Math.exp(-a));
const LF = -Math.log(.41), L0 = -Math.log(.01);             // loss on THIS sentence: -ln P(mat): 4.6 at the start, 0.89 once P(mat) = 41 %
const shape = u => .62 * nrm(4.2, u) + .38 * nrm(1.3, u);    // 1 -> 0, steep first, then flattening
const exLoss = u => LF + (L0 - LF) * shape(u);
const mixHex = (a, b, t) => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const f = s => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, t));
  return `rgb(${f(16)},${f(8)},${f(0)})`;
};

// ---------------------------------------------------------------- the network (3D, projected)
const NL = 8, NY = 7, NZ = 4, LPN = 2;                      // 8 layers of 7 x 4 nodes, 2 outgoing links per node
const NODES = [], LINKS = [];
for (let l = 0; l < NL; l++) {
  const tp = .78 + .22 * Math.sin(PI * (l + .5) / NL);
  for (let j = 0; j < NY; j++) for (let k = 0; k < NZ; k++)
    NODES.push({ l, j, k, v: [(l - (NL - 1) / 2) * .9, (3 - j) * .46 * tp, (k - 1.5) * .5 * tp], ph: R() * TAU });
}
for (const n of NODES) {
  if (n.l === NL - 1) continue;
  for (let s = 0; s < LPN; s++) {
    const j2 = clamp(n.j + Math.floor(R() * 5) - 2, 0, NY - 1), k2 = Math.floor(R() * NZ);
    LINKS.push({ a: NODES.indexOf(n), b: (n.l + 1) * NY * NZ + j2 * NZ + k2, l: n.l });
  }
}
const MAT_NODE = (NL - 1) * NY * NZ + 3 * NZ + 1;            // the output node that "means" mat
const DUST = Array.from({ length: 420 }, () => ({ v: [(R() * 2 - 1) * 3.5, (R() * 2 - 1) * 1.7, (R() * 2 - 1) * 1.2], p: R() * TAU, g: Math.floor(R() * 3) }));
const SPARK = Array.from({ length: 150 }, () => ({ x: 100 + R() * 880, y: 190 + R() * 480, sp: 30 + R() * 90, p: R(), g: Math.floor(R() * 4), s: 1 + R() * 2 }));
const NET = { cx: 530, cy: 432, F: 905 };
const netProj = v => proj(v, -.2, .16, NET.cx, NET.cy, NET.F, 7);   // fixed view: the layers stand as clear left-to-right columns
const PS = NODES.map(n => netProj(n.v)), scl = p => 7 / (7 - p[2]);
// static art is built once into two offscreen canvases (under / over the animated links)
const mkCanvas = () => { const c = document.createElement('canvas'); c.width = 1000; c.height = 720; return c; };
const NET_BOT = mkCanvas(), NET_TOP = mkCanvas();
{
  const c = NET_BOT.getContext('2d'), cols = ['150,200,255', '170,150,255', '120,230,255'];
  for (let gI = 0; gI < 3; gI++) {                            // parameter dust
    c.fillStyle = `rgba(${cols[gI]},.4)`; c.beginPath();
    for (const q of DUST) { if (q.g !== gI) continue; const p = netProj(q.v), s = scl(p) * 1.5; c.rect(p[0], p[1], s, s); }
    c.fill();
  }
  for (let l = 0; l < NL; l++) {                              // faint translucent sheet per layer
    const ys = (3.5 - 0 ) * .46 * (.78 + .22 * Math.sin(PI * (l + .5) / NL)), zs = .95, x = (l - (NL - 1) / 2) * .9;
    const q = [[x, ys, -zs], [x, ys, zs], [x, -ys, zs], [x, -ys, -zs]].map(v => netProj(v));
    c.beginPath(); q.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath();
    c.fillStyle = 'rgba(110,140,255,.07)'; c.fill(); c.strokeStyle = 'rgba(150,180,255,.26)'; c.lineWidth = 1.2; c.stroke();
  }
  c.strokeStyle = 'rgba(120,160,255,.22)'; c.lineWidth = 1; c.beginPath();
  for (const L of LINKS) { c.moveTo(PS[L.a][0], PS[L.a][1]); c.lineTo(PS[L.b][0], PS[L.b][1]); }
  c.stroke();
  const t = NET_TOP.getContext('2d'); t.fillStyle = 'rgba(215,230,255,.95)'; t.beginPath();
  NODES.forEach((n, i) => { const p = PS[i], r = 3.3 * scl(p) ** 2; t.moveTo(p[0] + r, p[1]); t.arc(p[0], p[1], r, 0, TAU); });
  t.fill();
}

// a wave (forward activation, then error flowing back) crosses the layers once per 2 beats
const fwdOff = q => .42 * (q + 1) / 9 * CYC, bwdOff = q => (.5 + .5 * (8 - q) / 9) * CYC;
function pass(lt, q, off, rate, seed, fwd) {                // glow of position q, decaying after the wave front passed
  let c = Math.floor((lt - CG - off(q)) / CYC);
  if (c < (fwd ? 1 : 0) || c > LAST_C) return [0, c];
  const age = lt - (CG + c * CYC + off(q));
  return [Math.exp(-age * rate) * (hash1(seed * 3.7 + c * 17.3) < (fwd ? .45 : .27) ? 1 : 0), c];
}
function phase(lt) { const x = (lt - CG) / CYC, c = Math.floor(x); return { c, ph: x - c }; }

// nudge-value pills: each rides on one link and is shown (eased, >= 0.6 s at full alpha) in the cycles where that link is hit
const PILLS = [[1, 11], [2, 4], [3, 19], [4, 26], [5, 8], [6, 15]].map(([l, k]) => ({ l, li: (l * NY * NZ + k) * LPN + 1 }));
function pillState(pl, lt) {
  const L = LINKS[pl.li], q = L.l + .5;
  const c = Math.floor((lt - CG - bwdOff(q) + .1) / CYC); if (c < 0 || c > LAST_C) return { al: 0 };
  const age = lt - (CG + c * CYC + bwdOff(q));
  const on = hash1(pl.li * 3.7 + c * 11.9) < .5;
  const al = on ? sstep(-.05, .2, age) * (1 - sstep(.8, 1.1, age)) : 0;
  return { al, L, up: hash1(pl.li * 5.1 + c * 2.3) > .5, val: (1 + Math.floor(hash1(c * 3.1 + pl.l * 7.7 + pl.li) * 9)) / 1000 };
}

// ---------------------------------------------------------------- next-word bars (fixed final order, values glide untrained -> next)
const UN = new Map(STORY.untrained), NX = new Map(STORY.next);
const ROWS = ['mat', 'floor', 'couch', 'bed', 'sofa', 'roof', 'rug', 'banana', 'quantum', 'seven', 'purple', '…'].map(w => ({ w, v0: UN.get(w) ?? 0, v1: NX.get(w) ?? 0, bad: UN.has(w) && w !== 'mat' && w !== '…' }));
const BX = 1090, BY = 156, BW = 700, BH = 388;
const LY = 566, LH = 302;                                  // loss panel
const BAR_TX = 140, BAR_TW = 470, BAR_MAX = .45;
// P(mat) = exp(-loss on this sentence); every other row interpolates and is rescaled so the column always sums to 100 %
function rowVals(lq, u) {
  const L = exLoss(u), pm = Math.exp(-L), bR = clamp((L0 - L) / (L0 - LF));
  const raw = ROWS.map((r, i) => i === 0 ? 0 : lerp(r.v0, r.v1, bR) * (r.w === '…' || i === 0 ? 1 : 1 + .03 * Math.sin(lq * 8 + i * 2.1) * (1 - sstep(.6, .92, u)) * (u > 0 ? 1 : 0)));
  const sum = raw.reduce((a, b) => a + b, 0), k = (1 - pm) / sum;
  return raw.map((v, i) => i === 0 ? pm : v * k);
}
const fmtPct = v => v < .0095 ? (v * 100).toFixed(1) + '%' : Math.round(v * 100) + '%';

// ---------------------------------------------------------------- loss curve (noisy per-step training loss around the smooth loss on this sentence)
const NT = (() => { const o = [], k = [], K = 130; for (let i = 0; i <= K + 2; i++) k.push(R() - .5); const f = x => { const i = Math.floor(x), t = x - i, s = t * t * (3 - 2 * t); return lerp(k[i], k[i + 1], s); };
  for (let i = 0; i <= 600; i++) o.push(f(i / 600 * K) * .8 + f(i / 600 * K * 3 % K) * .35); return o; })();
const noiseAt = u => { const x = clamp(u) * 600, i = Math.min(599, Math.floor(x)); return lerp(NT[i], NT[i + 1], x - i); };
const lossAt = u => { const b = exLoss(u); return Math.max(.5, b + noiseAt(u) * (.07 + .5 * (b - LF) / (L0 - LF)) * (u > 0 ? 1 : 0) * (1 - sstep(.96, 1, u))); };
const PX0 = BX + 80, PX1 = BX + BW - 30, PY0 = 650, PY1 = 826, LMAX = 5;
const lx = u => PX0 + u * (PX1 - PX0), ly = L => PY1 - clamp(L / LMAX) * (PY1 - PY0);   // linear y axis: steep first, then flattening

// ---------------------------------------------------------------- cue sheet
const STEPS = (() => { const o = []; for (let n = 1; n <= 46; n++) o.push(['step', TS + (-1 + Math.sqrt(1 + n))]); return o.map(([nm, t]) => [+t.toFixed(3), nm]); })();
const cyT = k => CG + k * CYC + .625;                         // back-pass start of cycle k
const SFX = [[0, 'whoosh', { dur: .8 }], [.05, 'down'],
  ...[0, 1, 2, 3, 4].map(k => [+cyT(k).toFixed(3), 'blip', { midi: 62 + k * 2 }]),
  ...[1, 2, 3, 4].map(k => [+(CG + k * CYC).toFixed(3), 'swish', { pitch: 1 + k * .12 }]),
  [3.75, 'riser', { dur: 2.5 }], ...STEPS.map(([t, n]) => [t, n]),
  [T_END, 'hit', { k: .5 }], [T_END, 'up'], [T_END + .02, 'chime', { midi: 88 }], [T_END + .1, 'sparkle', { dur: 1.2 }]];

// ---------------------------------------------------------------- drawing helpers
let GA = 1;                                                // entrance alpha for text(), which would otherwise ignore ctx.globalAlpha
const tt = (s, x, y, o = {}) => text(s, x, y, { ...o, alpha: (o.alpha ?? 1) * GA });
const LBL = '#c9d8f2';                                     // bright secondary label colour
function glassPanel(x, y, w, h, a, glowCol, glowA = 0) {   // dark panel; the glow is an additive edge only, never tinting the interior
  ctx.save(); ctx.globalAlpha = a;
  if (glowA > .02) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; rrect(x, y, w, h, 22); ctx.strokeStyle = rgba(glowCol, .5 * glowA); ctx.lineWidth = 3; ctx.shadowColor = glowCol; ctx.shadowBlur = 14 + 26 * glowA; ctx.stroke(); ctx.restore(); }
  rrect(x, y, w, h, 22); ctx.fillStyle = 'rgba(7,12,28,.8)'; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = glowA > .02 ? rgba(glowCol, .35 + .4 * glowA) : 'rgba(160,200,255,.32)'; ctx.stroke(); ctx.restore();
}
function plate(x, y, w, h, a = .55) { ctx.save(); rrect(x, y, w, h, 20); ctx.fillStyle = `rgba(5,9,24,${a})`; ctx.fill(); ctx.restore(); }
function pill(label, cx, cy, size, col, textCol, a, weight = 700) {   // dark pill with a 1 px colour outline
  const w = measure(label, size, F_UI, weight) + 26, h = size + 14;
  ctx.save(); ctx.globalAlpha = a * GA; rrect(cx - w / 2, cy - h / 2, w, h, h / 2); ctx.fillStyle = 'rgba(5,9,22,.92)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = col; ctx.stroke(); ctx.restore();
  tt(label, cx, cy + 1, { font: F_UI, size, weight, color: textCol, alpha: a });
}
function softDot(x, y, r, rgb, a) {                         // coloured glow without a white core (no clipping)
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
}
function bezier(p0, p1, p2, t) { const u = 1 - t; return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]; }
function comet(p0, p1, p2, t, rgb, a, len = .22, rr = 20) {          // bright head with a fading tail along a quadratic curve; fades out before the end and leaves a ring
  if (t <= 0 || t >= 1.35 || a <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const fade = 1 - sstep(.72, 1, t);
  for (let i = 0; i < 12; i++) { const q = t - i * len / 12; if (q < 0 || q > 1) continue; const p = bezier(p0, p1, p2, q); softDot(p[0], p[1], 12 - i * .6, rgb, a * fade * (1 - i / 12) * .8); }
  if (t > .85) { const k = clamp((t - .85) / .5); ctx.strokeStyle = `rgba(${rgb},${a * .85 * (1 - k)})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(p2[0], p2[1], 8 + rr * eout(k), 0, TAU); ctx.stroke(); }
  ctx.restore();
}
function arrow(x, y, s, up, col, a) { ctx.save(); ctx.globalAlpha = a * GA; ctx.fillStyle = col; ctx.beginPath(); if (up) { ctx.moveTo(x, y - s); ctx.lineTo(x + s, y + s * .8); ctx.lineTo(x - s, y + s * .8); } else { ctx.moveTo(x, y + s); ctx.lineTo(x + s, y - s * .8); ctx.lineTo(x - s, y - s * .8); } ctx.closePath(); ctx.fill(); ctx.restore(); }
function gtt(s, x, y, o = {}) {                            // glowing text with a crisp pass on top (glow alone smears small type)
  if (o.glow) tt(s, x, y, { ...o, alpha: (o.alpha ?? 1) * .6 });
  tt(s, x, y, { ...o, glow: null });
}
function strokeBuckets(B, cols, lws) {                      // draw bucketed segment lists: one path per bucket
  B.forEach((seg, k) => { if (!seg.length) return; ctx.strokeStyle = cols[k]; ctx.lineWidth = lws[k]; ctx.beginPath(); for (const s of seg) { ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); } ctx.stroke(); });
}

scene({ id: 'learn', start: 14, len: 3, mb: 1, fi: .15, ch: ['06', '学习', 'LEARNING'],
  subs: [[.3, 4.3, '猜错了，就微调数十亿个参数，让正确答案的概率高一点点', 'When it guesses wrong, nudge billions of parameters so the right answer gets a little more likely'],
    [4.5, 7.3, '重复亿万次，错误一路下降', 'Repeat it billions of times — the error keeps falling']],
  sfx: SFX, hits: [[T_END, .15]], bloom: .75,
  cam: lt => ({ z: 1 + .012 * lt / 7.5, x: 6 * Math.sin(lt * .21), y: 4 * Math.sin(lt * .17 + 1) }),   // gentle push so the panels stay inside the safe margins
  draw(lt, d, T) {
    const lq = Math.round(lt * 30) / 30;                    // numbers are quantised to the frame so every sub-frame shows the same digits
    const u = prog(lt), uq = prog(lq), en = .55 + .45 * clamp(lt / T_END);
    const { c: cyc, ph } = phase(lt), cOn = cyc >= 0 && cyc <= LAST_C;
    const done = sstep(T_END, T_END + .15, lt) * (1 - sstep(T_END + .15, T_END + 1.4, lt));      // convergence flare
    glDraw(1, { time: T * 1.2, tint: [.2, .36, .82], amp: .5 + .22 * en + .06 * done });
    const vals = rowVals(lq, uq), pm = vals[0], Lq = -Math.log(pm), b = clamp((L0 - exLoss(u)) / (L0 - LF));

    // entrance (fast: scene 5 hands over its error panel)
    const aN = sstep(0, .5, lt), aB = sstep(0, .5, lt), aL = sstep(0, .5, lt), aT = sstep(0, .5, lt);
    const sN = lerp(.93, 1, eout(clamp(lt / .9)));
    const wrong = win(lt, .3, 1.05, .2, .45);                // the opening "wrong guess" beat

    // ================= LEFT: the network
    const P = PS, sc = scl;
    ctx.save(); ctx.translate(NET.cx, NET.cy); ctx.scale(sN, sN); ctx.translate(-NET.cx, -NET.cy); ctx.globalAlpha = aN;
    ctx.globalCompositeOperation = 'lighter';
    let g = ctx.createRadialGradient(NET.cx, NET.cy, 0, NET.cx, NET.cy, 480); g.addColorStop(0, `rgba(70,110,255,${.1 * en})`); g.addColorStop(1, 'rgba(70,110,255,0)');
    ctx.fillStyle = g; ctx.fillRect(NET.cx - 490, NET.cy - 490, 980, 980);
    ctx.globalAlpha = aN * (.85 + .15 * Math.sin(lt * 1.7));
    ctx.drawImage(NET_BOT, 0, 0);                              // layer sheets, parameter dust and the calm base links (built once at load)
    ctx.globalAlpha = aN;
    // the forward pulse (pale blue) and the nudges (saturated cyan = up, coral = down) as they ripple back
    const FW = [[], [], []], BU = [[], [], []], BD = [[], [], []];
    LINKS.forEach((L, i) => {
      const q = L.l + .5, a = P[L.a], bb = P[L.b];
      const [gf] = pass(lt, q, fwdOff, 6, i, true), [gb, c2] = pass(lt, q, bwdOff, 4, i + 1000, false);
      if (gf > .05) FW[gf > .6 ? 2 : gf > .3 ? 1 : 0].push([a[0], a[1], bb[0], bb[1]]);
      if (gb > .05) { const up = hash1(i * 5.1 + c2 * 2.3) > .5; (up ? BU : BD)[gb > .6 ? 2 : gb > .3 ? 1 : 0].push([a[0], a[1], bb[0], bb[1]]); }
    });
    strokeBuckets(FW, [`rgba(140,190,255,${.12 * en})`, `rgba(140,190,255,${.2 * en})`, `rgba(160,205,255,${.3 * en})`], [1, 1.4, 1.8]);
    ctx.globalCompositeOperation = 'source-over';
    strokeBuckets(BU, ['rgba(60,214,255,.4)', 'rgba(60,220,255,.62)', 'rgba(70,228,255,.8)'], [1.1, 1.5, 1.9]);
    strokeBuckets(BD, ['rgba(255,86,104,.4)', 'rgba(255,92,108,.62)', 'rgba(255,100,116,.8)'], [1.1, 1.5, 1.9]);
    for (const pl of PILLS) { const st = pillState(pl, lt); if (st.al < .02) continue; const a = P[st.L.a], bb = P[st.L.b]; ctx.strokeStyle = st.up ? `rgba(70,228,255,${.95 * st.al})` : `rgba(255,100,116,${.95 * st.al})`; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(bb[0], bb[1]); ctx.stroke(); }
    ctx.drawImage(NET_TOP, 0, 0);                              // nodes
    ctx.globalCompositeOperation = 'lighter';
    {
      const gF = [], gG = [];
      NODES.forEach((n, i) => {
        const [gf] = pass(lt, n.l, fwdOff, 6, i * 1.3, true), p = P[i], s = sc(p) ** 2;
        if (gf > .12) gF.push([p[0], p[1], s, gf]);
        if (lt > T_END) { const ag = lt - T_END - n.l * .06; if (ag > 0 && ag < 1.2) gG.push([p[0], p[1], s, Math.exp(-ag * 3.5)]); }
      });
      for (const [arr_, rgb, a0, ro] of [[gF, '130,185,255', .25, 9], [gG, '255,196,110', .26, 6]]) {   // the post-convergence gold wave is kept warm and capped (no blown-out whites)
        if (!arr_.length) continue;
        ctx.fillStyle = `rgba(${rgb},${a0 * .5})`; ctx.beginPath(); for (const [x, y, s, a] of arr_) { const r = ro * s * (.6 + .4 * a); ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); } ctx.fill();
        ctx.fillStyle = `rgba(${rgb},${a0 + .3})`; ctx.beginPath(); for (const [x, y, s] of arr_) { const r = 3.6 * s; ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); } ctx.fill();
      }
    }
    // the output node that means "mat": a capped gold glow, a ring, and (on convergence) rings pulsing out
    const mp = P[MAT_NODE], ms = sc(mp);
    softDot(mp[0], mp[1], (30 + 14 * b) * ms, '255,200,100', Math.min(.3, .2 + .1 * b + .02 * done));
    ctx.strokeStyle = `rgba(255,214,130,${.8 + .2 * b})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(mp[0], mp[1], (9 + 3 * b) * ms, 0, TAU); ctx.stroke();
    for (let r = 0; r < 3; r++) { const k = clamp((lt - T_END - .04 - r * .24) / .8); if (k <= 0 || k >= 1) continue; ctx.strokeStyle = `rgba(255,214,130,${.85 * (1 - k) ** 1.5})`; ctx.lineWidth = 3.2 - 1.6 * k; ctx.beginPath(); ctx.arc(mp[0], mp[1], (12 + 92 * eout(k)) * ms, 0, TAU); ctx.stroke(); }
    ctx.restore();

    // network labels, plus nudge-value pills riding on a few links (same transform as the network so they stay attached)
    ctx.save(); ctx.translate(NET.cx, NET.cy); ctx.scale(sN, sN); ctx.translate(-NET.cx, -NET.cy); ctx.globalAlpha = aN; GA = aN;
    {
      const pcx = mp[0] - 38, pcy = mp[1] - 46;
      ctx.save(); ctx.globalAlpha = aN; ctx.strokeStyle = rgba(PAL.gold, .85); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pcx + 22, pcy + 18); ctx.lineTo(mp[0] - 7, mp[1] - 8); ctx.stroke(); ctx.restore();   // leader: pill -> ring
      pill('mat', pcx, pcy, 26, rgba(PAL.gold, .9), PAL.gold, 1);
      const l0 = P.filter((_, i) => NODES[i].l === 0), l7 = P.filter((_, i) => NODES[i].l === NL - 1);
      const x0 = l0.reduce((a, p) => a + p[0], 0) / l0.length, y0_ = Math.min(645, Math.max(...l0.map(p => p[1])) + 36);
      const x7 = l7.reduce((a, p) => a + p[0], 0) / l7.length, y7 = Math.min(...l7.map(p => p[1])) - 34;
      const lw0 = measure('input · 输入', 24, F_UI, 600) + 20, lw7 = measure('output · 输出', 24, F_UI, 600) + 20;
      plate(x0 + 10 - lw0 / 2, y0_ - 18, lw0, 36, .72); plate(x7 - 10 - lw7 / 2, y7 - 18, lw7, 36, .72);
      tt('input · 输入', x0 + 10, y0_, { font: F_UI, size: 24, weight: 600, color: '#e8f0ff' });
      tt('output · 输出', x7 - 10, y7, { font: F_UI, size: 24, weight: 600, color: '#e8f0ff' });
    }
    for (const pl of PILLS) {
      const st = pillState(pl, lt); if (st.al < .02) continue;
      const a = P[st.L.a], bb = P[st.L.b], mx = clamp((a[0] + bb[0]) / 2, 170, 900), my = clamp((a[1] + bb[1]) / 2 - 16, 290, 630);
      if (Math.abs(mx - mp[0] + 38) < 130 && Math.abs(my - mp[1] + 46) < 50) continue;
      const lab = (st.up ? '+' : '\u2212') + st.val.toFixed(3), w = measure(lab, 22, F_MONO, 700) + 16, al = st.al * aN;
      ctx.save(); ctx.globalAlpha = Math.min(1, st.al * 3) * aN; rrect(mx - w / 2, my - 15, w, 30, 8); ctx.fillStyle = 'rgb(5,9,22)'; ctx.fill();   // near-opaque fill so links never run through the digits
      ctx.globalAlpha = al; ctx.strokeStyle = st.up ? rgba(PAL.cyan, .95) : rgba(PAL.coral, .95); ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
      tt(lab, mx, my + 1, { font: F_MONO, size: 22, weight: 700, color: st.up ? PAL.cyan : '#ff9ba6', alpha: st.al });
    }
    ctx.restore();

    // legend (just above the network), counters, caption
    ctx.save(); ctx.globalAlpha = aT; GA = aT;
    arrow(120, 206, 9, true, PAL.cyan, 1); tt('nudge up', 142, 207, { font: F_UI, size: 26, weight: 600, color: '#d8f3ff', align: 'left', glow: 'rgba(0,0,0,.9)', blur: 8 });
    arrow(332, 206, 9, false, PAL.coral, 1); tt('nudge down', 354, 207, { font: F_UI, size: 26, weight: 600, color: '#ffd6da', align: 'left', glow: 'rgba(0,0,0,.9)', blur: 8 });
    plate(100, 668, 880, 200, .5);
    tt('PARAMETERS · 参数', 124, 696, { font: F_UI, size: 24, weight: 600, ls: 3, color: LBL, align: 'left' });
        gtt('≈ ' + fmtInt(70e9), 124, 742, { font: F_MONO, size: 46, weight: 700, color: '#fff', align: 'left', glow: 'rgba(95,227,255,.5)', blur: 8 });
    GA = aT * .7; tt('(e.g.)', 590, 750, { font: F_UI, size: 24, color: LBL, align: 'left' }); GA = aT;
    const onB = ph >= .48 && ph < .9, onD = ph >= .9 || ph < .25, hb = onB ? 1 : .8, hg = onD ? 1 : .8;
    const w1 = measure('backpropagation', 30, F_UI, 600), w2 = measure('gradient descent', 30, F_UI, 600);
    gtt('backpropagation', 124, 794, { font: F_UI, size: 30, weight: 600, color: PAL.coral, align: 'left', glow: cOn && onB ? PAL.coral : null, blur: 6, alpha: hb });
    tt('→', 124 + w1 + 14, 794, { font: F_UI, size: 30, color: LBL, align: 'left' });
    gtt('gradient descent', 124 + w1 + 52, 794, { font: F_UI, size: 30, weight: 600, color: PAL.cyan, align: 'left', glow: cOn && onD ? PAL.cyan : null, blur: 6, alpha: hg });
    GA = aT * .7; tt('反向传播 → 梯度下降', 124 + w1 + 52 + w2 + 34, 796, { font: F_UI, size: 24, color: LBL, align: 'left' });
    // GPU grid
    ctx.save(); ctx.globalAlpha = aT * .7;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) {
      const v = Math.pow(.5 + .5 * Math.sin(lt * (4 + en * 6) + i * 1.3 + hash1(i * 7) * 6), 3), hot = hash1(i * 3.3 + Math.floor(lt * 3)) > .9;
      ctx.fillStyle = hot ? `rgba(255,210,122,${.4 + .6 * v})` : `rgba(95,227,255,${.14 + .6 * v})`; ctx.fillRect(124 + i * 23, 828, 18, 18);
    }
    ctx.restore();
    tt('GPU × thousands · weeks to months', 124 + 14 * 23 + 12, 838, { font: F_UI, size: 24, color: LBL, align: 'left' });
    ctx.restore();

    // ================= TOP RIGHT: next-word bars
    const bx = BX + (1 - eout(clamp(lt / .5))) * 50, hitP = lt > T_END ? Math.exp(-(lt - T_END) * 6) * sstep(0, .06, lt - T_END) : 0, flashB = cOn ? sstep(.38, .5, ph) * Math.exp(-Math.max(0, ph - .5) * 6) : 0;
    const pcol = mixHex(PAL.coral, PAL.gold, clamp(b * 2.2));
    GA = aB; ctx.save(); ctx.globalAlpha = aB;
    glassPanel(bx, BY, BW, BH, aB, wrong > .02 ? PAL.coral : PAL.gold, Math.max(done * .8, flashB * .35, wrong * .6));
    tt('The cat sat on the', bx + 30, BY + 40, { font: F_MONO, size: 30, color: '#fff', align: 'left' });
    { const w = measure('The cat sat on the ', 30); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(bx + 30 + w, BY + 58, 54, 3); }
    tt('P(mat)', bx + BW - 138, BY + 40, { font: F_MONO, size: 30, weight: 600, color: pcol, align: 'right' });
    ctx.save(); ctx.translate(bx + BW - 30, BY + 40); ctx.scale(1 + .16 * hitP, 1 + .16 * hitP); gtt(fmtPct(pm), 0, 0, { font: F_MONO, size: 42, weight: 700, color: pcol, align: 'right', glow: pcol, blur: 8 }); ctx.restore();
    const y0 = BY + 88, tx = bx + BAR_TX, tw = BAR_TW;
    // the 4 junk rows fade out one after another from the bottom; '(other)' climbs into each slot only after that row is gone, and the pitch widens smoothly (no overlap, no dead gap)
    const jb = clamp((b - .3) / .4), PJ = .25, FJ = .09, slotO = 11 - [0, 1, 2, 3].reduce((acc, k) => acc + sstep(k * PJ + FJ, (k + 1) * PJ, jb), 0), pitch = 25.2 + 12 * sstep(0, 1, jb);
    const junkA = i => 1 - sstep((10 - i) * PJ, (10 - i) * PJ + FJ, jb);
    const rowY = i => y0 + pitch * (i <= 10 ? i : slotO);
    const RA = ROWS.map((r, i) => { const grow = sstep(.002, .014, vals[i]); return i === 0 || r.w === '…' ? 1 : r.bad ? Math.min(grow, junkA(i)) : Math.max(.28, grow); });   // real rows start as dim ghosts
    const dv = vals.slice(); ROWS.forEach((r, i) => { if (r.bad) dv[11] += vals[i] * (1 - RA[i]); });   // mass of faded-out rows moves into '(other)' so the visible column always sums to 100 %
    ROWS.forEach((r, i) => {
      const y = rowY(i), v = dv[i], isMat = i === 0, isEll = r.w === '…', ra = RA[i], grow = sstep(.002, .014, vals[i]);
      if (ra < .01) return;
      const GA0 = GA; GA = GA0 * ra;
      const wd = clamp(v / BAR_MAX) * tw, col = isMat ? PAL.gold : r.bad ? PAL.coral : PAL.cyan;
      ctx.save(); ctx.globalAlpha = ra * aB;
      const rs = isMat ? 1 + .14 * hitP : 1;
      ctx.save(); ctx.translate(bx + 28, y); ctx.scale(rs, rs);
      tt(isEll ? '(other)' : r.w, 0, 0, { font: F_MONO, size: 22, weight: isMat ? 700 : 400, color: isMat ? PAL.gold : isEll ? LBL : '#dfeaff', align: 'left' }); ctx.restore();
      ctx.fillStyle = 'rgba(160,200,255,.08)'; rrect(tx, y - 8, tw, 16, 8); ctx.fill();
      if (wd > 1) {
        ctx.save();
        const gr = ctx.createLinearGradient(tx, 0, tx + Math.max(wd, 40), 0);
        if (isEll) { gr.addColorStop(0, 'rgba(120,140,190,.5)'); gr.addColorStop(1, 'rgba(120,140,190,.32)'); }
        else if (isMat) { const k = clamp(b * 2.5); gr.addColorStop(0, mixHex(PAL.coral, PAL.amber, k)); gr.addColorStop(1, mixHex(PAL.coral, PAL.gold, k)); }
        else if (r.bad) { gr.addColorStop(0, rgba(PAL.coral, .4)); gr.addColorStop(1, rgba(PAL.coral, .85)); }
        else { gr.addColorStop(0, rgba(PAL.blue, .55)); gr.addColorStop(1, rgba(PAL.cyan, .9)); }
        ctx.fillStyle = gr;
        rrect(tx, y - 8, wd, 16, 8); ctx.fill(); ctx.restore();
        if (isMat) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; softDot(tx + wd, y, 30, '255,205,110', Math.min(.6, .3 + .3 * done)); softDot(tx + wd / 2, y, 70, '255,205,110', .1 + .12 * done); ctx.restore(); }
      }
      if (isMat || isEll || r.bad || grow > .3) { ctx.save(); ctx.translate(bx + BW - 28, y); ctx.scale(rs, rs); tt(fmtPct(v), 0, 0, { font: F_MONO, size: 22, weight: isMat ? 700 : 400, color: isMat ? PAL.gold : col === PAL.coral ? '#ffb3bb' : '#cfe2ff', align: 'right', alpha: isMat || isEll || r.bad ? 1 : grow }); ctx.restore(); }
      ctx.restore(); GA = GA0;
    });
    { const tk = tx + clamp(.41 / BAR_MAX) * tw; ctx.save(); ctx.globalAlpha = aB * (.45 + .55 * Math.max(done, hitP)); ctx.strokeStyle = PAL.mint; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tk, y0 - 13); ctx.lineTo(tk, y0 + 13); ctx.stroke(); ctx.restore(); }
    if (wrong > .02) pill('wrong · 猜错', tx + 250, y0, 24, rgba(PAL.coral, .95), '#ff9ba6', wrong);
    ctx.restore();

    // ================= BOTTOM RIGHT: loss curve
    const ly0 = (1 - eout(clamp(lt / .5))) * 40, step = Math.round(uq * 100) * 1e4;
    GA = aL; ctx.save(); ctx.globalAlpha = aL; ctx.translate(0, ly0);
    const flashL = cOn ? sstep(.44, .52, ph) * Math.exp(-Math.max(0, ph - .52) * 7) : 0;
    glassPanel(BX, LY, BW, LH, aL, PAL.coral, Math.max(flashL * .5, wrong * .8));
    const tcol = mixHex(PAL.coral, PAL.mint, clamp(b * 1.1));
    tt('LOSS', BX + 30, LY + 40, { font: F_UI, size: 30, weight: 700, ls: 4, color: tcol, align: 'left' });
    gtt(Lq.toFixed(1), BX + 140, LY + 40, { font: F_MONO, size: 42, weight: 700, color: tcol, align: 'left', glow: tcol, blur: 8 });
    tt('STEP', BX + 240, LY + 42, { font: F_UI, size: 24, weight: 600, ls: 3, color: LBL, align: 'left' });
    tt(fmtInt(step), BX + 506, LY + 42, { font: F_MONO, size: 30, weight: 700, color: '#fff', align: 'right' });
    tt('/ 1,000,000', BX + BW - 24, LY + 44, { font: F_MONO, size: 22, color: LBL, align: 'right' });
    // grid + axes
    ctx.lineWidth = 1;
    for (const L of [2, 4]) { const y = ly(L); ctx.strokeStyle = 'rgba(160,200,255,.14)'; ctx.beginPath(); ctx.moveTo(PX0, y); ctx.lineTo(PX1, y); ctx.stroke(); tt(String(L), PX0 - 16, y, { font: F_MONO, size: 22, color: LBL, align: 'right' }); }
    ctx.strokeStyle = 'rgba(160,200,255,.3)'; ctx.beginPath(); ctx.moveTo(PX0, PY0 - 10); ctx.lineTo(PX0, PY1); ctx.lineTo(PX1, PY1); ctx.stroke();
    tt('training steps (time-lapse) · loss on this sentence →', (PX0 + PX1) / 2, LY + LH - 26, { font: F_UI, size: 22, color: LBL });
    // the goal: loss on this sentence once P(mat) = 41 %
    ctx.save(); ctx.setLineDash([8, 8]); ctx.strokeStyle = 'rgba(94,242,176,.4)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PX0, ly(LF)); ctx.lineTo(PX1, ly(LF)); ctx.stroke(); ctx.restore();
    tt('target ≈ 0.9', PX0 + 10, ly(LF) + 18, { font: F_UI, size: 22, color: '#9ff3cf', align: 'left' });   // left end: the curve and its end dot never cross it
    // faint ghost of where the curve is heading, so the plot is never an empty box
    { ctx.save(); ctx.setLineDash([3, 8]); ctx.strokeStyle = `rgba(190,210,255,${.34 * (1 - sstep(.3, .55, u))})`; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i <= 60; i++) { const uu = i / 60; i ? ctx.lineTo(lx(uu), ly(exLoss(uu))) : ctx.moveTo(lx(uu), ly(exLoss(uu))); } ctx.stroke(); ctx.restore(); }
    // curve
    const N = 300, n = Math.max(1, Math.floor(u * N)), pts = [];
    for (let i = 0; i <= n; i++) { const uu = i === n ? u : i / N; pts.push([lx(uu), ly(lossAt(uu))]); }
    if (pts.length > 1) {
      ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      const fg = ctx.createLinearGradient(0, ly(4.6), 0, ly(1.0)); fg.addColorStop(0, 'rgba(255,107,122,.28)'); fg.addColorStop(1, 'rgba(95,227,255,.02)');
      ctx.beginPath(); ctx.moveTo(pts[0][0], PY1); pts.forEach(p => ctx.lineTo(p[0], p[1])); ctx.lineTo(pts[pts.length - 1][0], PY1); ctx.closePath(); ctx.fillStyle = fg; ctx.fill();
      const sg = ctx.createLinearGradient(PX0, 0, PX1, 0); sg.addColorStop(0, PAL.coral); sg.addColorStop(.35, PAL.pink); sg.addColorStop(1, PAL.cyan);
      ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
      ctx.strokeStyle = sg; ctx.globalAlpha = .22 * aL; ctx.lineWidth = 9; ctx.stroke();      // cheap glow instead of shadowBlur
      ctx.globalAlpha = aL; ctx.lineWidth = 3.2; ctx.stroke(); ctx.restore();
    }
    { const hp = pts[pts.length - 1]; ctx.save();
      ctx.setLineDash([4, 7]); ctx.strokeStyle = 'rgba(200,215,240,.3)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PX0, hp[1]); ctx.lineTo(hp[0], hp[1]); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalCompositeOperation = 'lighter'; const rgb = tcol.slice(4, -1); softDot(hp[0], hp[1], 26, rgb, .55);
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = tcol; ctx.beginPath(); ctx.arc(hp[0], hp[1], 6, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore(); }
    {                                                           // "converged" tag on the convergence hit
      const kc = sstep(T_END + .05, T_END + .5, lt);
      if (kc > .01) {
        const cx_ = PX0 + 380, cy_ = ly(LF) - 62 + (1 - eout(kc)) * 12, lab = 'converged', w = measure(lab, 24, F_UI, 700) + 62;
        ctx.save(); ctx.globalAlpha = aL * kc; rrect(cx_ - w / 2, cy_ - 19, w, 38, 19); ctx.fillStyle = 'rgba(5,22,20,.92)'; ctx.fill(); ctx.strokeStyle = rgba(PAL.mint, .95); ctx.lineWidth = 2; ctx.stroke();
        ctx.lineWidth = 3.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = PAL.mint; ctx.beginPath(); ctx.moveTo(cx_ - w / 2 + 15, cy_ + 1); ctx.lineTo(cx_ - w / 2 + 21, cy_ + 7); ctx.lineTo(cx_ - w / 2 + 32, cy_ - 7); ctx.stroke(); ctx.restore();
        tt(lab, cx_ + 12, cy_ + 1, { font: F_UI, size: 24, weight: 700, color: '#b5ffe0', alpha: kc });
      }
    }
    ctx.restore();

    GA = 1;
    // ================= links between the three elements: output -> bars (gold), loss -> error flows back into the network (coral)
    const oS = [NET.cx + (mp[0] - NET.cx) * sN, NET.cy + (mp[1] - NET.cy) * sN];
    const A0 = [oS[0] + 16, oS[1] + 2], A1 = [1060, oS[1] - 30], A2 = [BX + 6, BY + 98];
    const B0 = [BX + 6, LY + 150], B1 = [1040, LY + 120], B2 = [oS[0] + 10, oS[1] + 14];
    ctx.save(); ctx.globalAlpha = Math.min(aN, aB, aL); ctx.lineWidth = 2.5 + 1.2 * (1 - sstep(.6, 2.6, lt));
    for (const [p0, p1, p2, col] of [[A0, A1, A2, '255,214,130'], [B0, B1, B2, '255,107,122']]) { ctx.strokeStyle = `rgba(${col},${.5 + .35 * (1 - sstep(.6, 2.6, lt))})`; ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.quadraticCurveTo(p1[0], p1[1], p2[0], p2[1]); ctx.stroke(); }
    { const eb = bezier(B0, B1, B2, .3); GA = Math.min(aN, aB, aL); pill('error', eb[0] - 14, eb[1] + 6, 24, rgba(PAL.coral, .9), '#ff9ba6', 1, 600); GA = 1; }
    if (cOn) {
      comet(A0, A1, A2, (ph - .36) / .14, '255,214,130', 1, .22, 4);
      comet(B0, B1, B2, (ph - .5) / .12, '255,110,125', 1);
    }
    comet(A0, A1, A2, (lt - (T_END - .45)) / .45, '255,214,130', 1, .3, 4);    // the gold payoff pulse arrives on the hit
    ctx.restore();

    // ================= energy: sparks drifting up through the scene, a flare when the loss settles
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const ns = Math.floor(30 + 80 * en * aN + 40 * sstep(5, T_END, lt)), spc = ['120,220,255', '255,210,122', '255,120,150', '170,150,255'];
    for (let i = 0; i < ns; i++) {
      const s = SPARK[i], y = s.y - ((lt * s.sp * (.7 + .6 * en) + s.p * 600) % 560), yy = y < 150 ? y + 560 : y, a = (.25 + .5 * Math.sin(lt * 3 + s.p * 20) ** 2) * sstep(150, 220, yy) * (1 - sstep(700, 790, yy));
      ctx.fillStyle = `rgba(${spc[s.g]},${a * .8})`; ctx.fillRect(s.x + Math.sin(lt + s.p * 9) * 8, yy, s.s, s.s);
    }
    if (done > 0) {
      const k = clamp((lt - T_END) / 1.0), mx = tx + clamp(.41 / BAR_MAX) * tw, my = y0;
      const sg = ctx.createLinearGradient(bx + 20, 0, bx + BW - 20, 0); sg.addColorStop(0, 'rgba(255,215,140,0)'); sg.addColorStop(.35, `rgba(255,225,160,${.55 * (1 - k)})`); sg.addColorStop(1, 'rgba(255,215,140,0)'); ctx.fillStyle = sg; ctx.fillRect(bx + 20, my - 1.5, BW - 40, 3);
      softDot(mx, my, 60 + 40 * k, '255,205,110', .4 * (1 - k));
      for (let i = 0; i < 26; i++) { const an = i / 26 * TAU + hash1(i) * .5, r = 24 + (40 + 110 * hash1(i * 3.1)) * eout(k); ctx.fillStyle = `rgba(255,215,140,${.9 * (1 - k)})`; ctx.fillRect(mx + Math.cos(an) * r, my + Math.sin(an) * r * .8, 3, 3); }
      softDot(oS[0], oS[1], 50, '255,200,110', .08 * (1 - k));
    }
    ctx.restore();
  } });
