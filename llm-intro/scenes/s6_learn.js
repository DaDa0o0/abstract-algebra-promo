// s6_learn: pretraining II (2:50 cut). Page A: parameters are knobs. Page B: one training step as a four-beat loop.
// Page C: the same step repeated billions of times: the dashboard (next-word bars sharpen, the loss curve falls).
const R = mulberry(20260006);

// ---------------------------------------------------------------- timeline (local seconds, 1 beat = .625 s)
const A_OUT0 = 6.05, A_OUT1 = 6.45;                          // page A exit
const ST = [7.5, 8.75, 10.0, 11.25];                         // the four beats of one training step: forward, compare, backward, nudge (2 beats each)
const B_OUT0 = 13.5, B_OUT1 = 13.8;                          // page B exit
const CG = 14.375, T_END = 18.125;                           // repeat: training time-lapse starts on beat 23, converges on beat 29
const CP = [1.25, 1.0, .8125, .625];                         // cycle lengths: the loop gets faster and faster
const CS = CP.map((_, i) => CG + CP.slice(0, i).reduce((a, b) => a + b, 0));
const prog = lt => clamp((lt - CG) / (T_END - CG));
const nrm = (a, u) => (Math.exp(-a * u) - Math.exp(-a)) / (1 - Math.exp(-a));
const LF = -Math.log(.41), L0 = -Math.log(.01);              // loss on THIS sentence: -ln P(mat): 4.6 at the start, 0.89 once P(mat) = 41 %
const shape = u => .62 * nrm(4.2, u) + .38 * nrm(1.3, u);
const exLoss = u => LF + (L0 - LF) * shape(u);
const mixHex = (a, b, t) => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const f = s => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, t));
  return `rgb(${f(16)},${f(8)},${f(0)})`;
};

// ---------------------------------------------------------------- backdrop: the aurora is slow, so it is rendered at load into 7 keyframes and cross-faded (the live shader costs ~300 ms/frame)
const BG_T0 = 95, BG_DT = 3.5, BGK = [];
for (let i = 0; i < 7; i++) {
  glDraw(1, { time: (BG_T0 + i * BG_DT) * 1.1, tint: [.2, .34, .8], amp: 1 });
  const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').drawImage(glc, 0, 0); BGK.push(c);
}
function backdrop(T, amp) {
  const bt = clamp((T - BG_T0) / BG_DT, 0, 5.999), bi = Math.floor(bt), bf = bt - bi;
  ctx.save(); ctx.globalAlpha = amp * (1 - bf); ctx.drawImage(BGK[bi], 0, 0);
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = amp * bf; ctx.drawImage(BGK[bi + 1], 0, 0); ctx.restore();
}

// ---------------------------------------------------------------- the network: 7 translucent layers (sheets), nodes on each, links between neighbours
const NL = 7, NY = 5, NZ = 3;
const YAW = -.62, PIT = .12, NCX = 524, NCY = 432, NF = 2000, ND = 14, SYN = .45;
const netProj = v => proj(v, YAW, PIT, NCX, NCY, NF, ND);
const taper = l => .84 + .16 * Math.sin(PI * (l + .5) / NL);
const NODES = [], LINKS = [];
const nid = (l, j, k) => (l * NY + j) * NZ + k;
for (let l = 0; l < NL; l++) for (let j = 0; j < NY; j++) for (let k = 0; k < NZ; k++)
  NODES.push({ l, j, k, v: [(l - (NL - 1) / 2) * 1.08, (2 - j) * SYN * taper(l), (k - 1) * .44] });
for (const n of NODES) {
  if (n.l === NL - 1) continue;
  const k2 = Math.floor(R() * NZ), j2 = clamp(n.j + Math.floor(R() * 3) - 1, 0, NY - 1);
  const k3 = (k2 + 1 + Math.floor(R() * 2)) % NZ, j3 = clamp(n.j + Math.floor(R() * 3) - 1, 0, NY - 1);
  LINKS.push({ a: nid(n.l, n.j, n.k), b: nid(n.l + 1, j2, k2), l: n.l }, { a: nid(n.l, n.j, n.k), b: nid(n.l + 1, j3, k3), l: n.l });
}
// one signal path from the input layer to the output node that "means" mat
const PATH = [nid(0, 2, 1)];
for (let l = 0; l < NL - 1; l++) {
  const outs = LINKS.filter(L => L.a === PATH[l]); const L = outs[Math.floor(R() * outs.length)];
  L.path = true; PATH.push(L.b);
}
const MAT_NODE = PATH[NL - 1];
const PS = NODES.map(n => netProj(n.v)), scl = p => ND / (ND - p[2]);
const SHEET = Array.from({ length: NL }, (_, l) => {
  const ys = 2 * SYN * taper(l) + .2, zs = .44 + .26, x = (l - (NL - 1) / 2) * 1.08;
  return [[x, ys, -zs], [x, ys, zs], [x, -ys, zs], [x, -ys, -zs]].map(netProj);
});
const DUST = Array.from({ length: 230 }, () => ({ v: [(R() * 2 - 1) * 3.7, (R() * 2 - 1) * 1.7, (R() * 2 - 1) * 1.3], g: Math.floor(R() * 3) }));
const FLOW = Array.from({ length: 36 }, () => ({ li: Math.floor(R() * LINKS.length), p: R(), sp: .22 + R() * .3 }));   // data motes drifting along links
// bounding box of the network art -> offscreen caches
const BB = (() => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const add = p => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); };
  PS.forEach(add); SHEET.forEach(s => s.forEach(add)); DUST.forEach(q => add(netProj(q.v)));
  return { x: Math.floor(x0 - 24), y: Math.floor(y0 - 24), w: Math.ceil(x1 - x0 + 48), h: Math.ceil(y1 - y0 + 48) }; })();
const mkCanvas = () => { const c = document.createElement('canvas'); c.width = BB.w; c.height = BB.h; return c; };
const sheetPath = (c, l) => { c.beginPath(); SHEET[l].forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); };
const LAYC = Array.from({ length: NL }, () => mkCanvas()), BASEC = mkCanvas(), ALLC = mkCanvas();
{
  const cols = ['150,200,255', '170,150,255', '120,230,255'], b = BASEC.getContext('2d'); b.translate(-BB.x, -BB.y);
  for (let g = 0; g < 3; g++) { b.fillStyle = `rgba(${cols[g]},.34)`; b.beginPath(); for (const q of DUST) { if (q.g !== g) continue; const p = netProj(q.v), s = scl(p) * 1.5; b.rect(p[0], p[1], s, s); } b.fill(); }
  for (let l = 0; l < NL; l++) {
    const c = LAYC[l].getContext('2d'); c.translate(-BB.x, -BB.y);
    const top = Math.min(...SHEET[l].map(p => p[1])), bot = Math.max(...SHEET[l].map(p => p[1]));
    const g = c.createLinearGradient(0, top, 0, bot); g.addColorStop(0, 'rgba(120,150,255,.17)'); g.addColorStop(1, 'rgba(90,120,230,.05)');
    sheetPath(c, l); c.fillStyle = g; c.fill(); c.strokeStyle = 'rgba(165,195,255,.5)'; c.lineWidth = 1.6; c.stroke();
    c.strokeStyle = 'rgba(140,180,255,.42)'; c.lineWidth = 1.2; c.beginPath();
    for (const L of LINKS) if (L.l === l) { c.moveTo(PS[L.a][0], PS[L.a][1]); c.lineTo(PS[L.b][0], PS[L.b][1]); }
    c.stroke();
    NODES.forEach((n, i) => { if (n.l !== l) return; const p = PS[i], s = scl(p), gr = c.createRadialGradient(p[0], p[1], 0, p[0], p[1], 11 * s);
      gr.addColorStop(0, 'rgba(160,200,255,.28)'); gr.addColorStop(1, 'rgba(160,200,255,0)'); c.fillStyle = gr; c.fillRect(p[0] - 11 * s, p[1] - 11 * s, 22 * s, 22 * s);
      c.fillStyle = 'rgba(225,238,255,.96)'; c.beginPath(); c.arc(p[0], p[1], 3.7 * s * s, 0, TAU); c.fill(); });
  }
  const a = ALLC.getContext('2d'); a.drawImage(BASEC, 0, 0); for (const c of LAYC) a.drawImage(c, 0, 0);
}

// pulses: a forward wave (left to right) and an error wave (right to left); front(x) is when the front reaches x in 0..1
const PULSES = [{ t0: ST[0], d: .75, dir: 1, id: 0 }, { t0: ST[2] + .35, d: .85, dir: -1, id: 1 }];
CS.forEach((s, c) => { const P = CP[c]; PULSES.push({ t0: s, d: .32 * P, dir: 1, id: 2 + 2 * c }, { t0: s + .6 * P, d: .34 * P, dir: -1, id: 3 + 2 * c }); });
const RATE = 3.8;
const glowAt = (lt, p, x) => { const a = lt - (p.t0 + p.d * (p.dir > 0 ? x : 1 - x)); return a < 0 ? 0 : sstep(0, .07, a) * Math.exp(-a * RATE); };

// nudge badges: one link per gap between layers (first the direction arrow, then the value)
const PILL_Y = [400, 500, 395, 505, 410, 495];
const PILLS = PILL_Y.map((ty, g) => {
  let best = -1, bd = 1e9;
  LINKS.forEach((L, i) => { if (L.l !== g || L.path) return; const my = (PS[L.a][1] + PS[L.b][1]) / 2, dd = Math.abs(my - ty); if (dd < bd) { bd = dd; best = i; } });
  const L = LINKS[best], a = PS[L.a], b = PS[L.b];
  return { g, li: best, x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, up: g % 2 === 0, val: ['+0.003', '−0.007', '+0.002', '−0.004', '+0.005', '−0.001'][g] };
});

// ---------------------------------------------------------------- zoom-in inset (page A): three nodes, two nodes, six knobs
const IX = 1110, IY = 150, IW = 710, IH = 722;
const INL = [[1215, 325], [1215, 500], [1215, 675]], INR = [[1715, 415], [1715, 585]];
const IK = [{ a: 0, b: 0, t: .3, val: .42, s: 1 }, { a: 0, b: 1, t: .62, val: -1.30, s: 1 }, { a: 1, b: 0, t: .3, val: .85, s: -1 }, { a: 1, b: 1, t: .75, val: -.27, s: -1 }, { a: 2, b: 0, t: .25, val: 1.61, s: -1 }, { a: 2, b: 1, t: .55, val: -.09, s: 1 }];
const PATCH = (() => { const ids = [nid(4, 0, 1), nid(4, 1, 1), nid(4, 2, 1), nid(5, 0, 1), nid(5, 1, 1)].map(i => PS[i]);
  return { x0: Math.min(...ids.map(p => p[0])) - 24, x1: Math.max(...ids.map(p => p[0])) + 24, y0: Math.min(...ids.map(p => p[1])) - 28, y1: Math.max(...ids.map(p => p[1])) + 28 }; })();

// ---------------------------------------------------------------- panels: next-word bars (top right) and loss (bottom right)
const BX = 1110, BY = 150, BW = 710, BH = 420, LY = 590, LH = 282;
const UN = new Map(STORY.untrained), NX = new Map(STORY.next);
const ROWS = ['mat', 'floor', 'couch', 'bed', 'sofa', 'roof', 'rug', 'banana', 'quantum', 'seven', 'purple', '…'].map(w => ({ w, v0: UN.get(w) ?? 0, v1: NX.get(w) ?? 0, bad: UN.has(w) && w !== 'mat' && w !== '…' }));
const BAR_TX = 165, BAR_TW = 440, BAR_MAX = .45;
function rowVals(lq, u) {
  const L = exLoss(u), pm = Math.exp(-L), bR = clamp((L0 - L) / (L0 - LF));
  const raw = ROWS.map((r, i) => i === 0 ? 0 : lerp(r.v0, r.v1, bR) * (r.w === '…' ? 1 : 1 + .03 * Math.sin(lq * 8 + i * 2.1) * (1 - sstep(.6, .92, u)) * (u > 0 ? 1 : 0)));
  const sum = raw.reduce((a, b) => a + b, 0), k = (1 - pm) / sum;
  return raw.map((v, i) => i === 0 ? pm : v * k);
}
const fmtPct = v => v < .0095 ? (v * 100).toFixed(1) + '%' : Math.round(v * 100) + '%';
const NT = (() => { const o = [], k = [], K = 90; for (let i = 0; i <= K + 2; i++) k.push(R() - .5); const f = x => { const i = Math.floor(x), t = x - i, s = t * t * (3 - 2 * t); return lerp(k[i], k[i + 1], s); };
  for (let i = 0; i <= 600; i++) o.push(f(i / 600 * K) * .8 + f(i / 600 * K * 3 % K) * .35); return o; })();
const noiseAt = u => { const x = clamp(u) * 600, i = Math.min(599, Math.floor(x)); return lerp(NT[i], NT[i + 1], x - i); };
const lossAt = u => { const b = exLoss(u); return Math.max(.5, b + noiseAt(u) * (.07 + .5 * (b - LF) / (L0 - LF)) * (u > 0 ? 1 : 0) * (1 - sstep(.96, 1, u))); };
const PX0 = BX + 80, PX1 = BX + BW - 30, PY0 = LY + 78, PY1 = LY + LH - 56, LMAX = 5;
const lx = u => PX0 + u * (PX1 - PX0), ly = L => PY1 - clamp(L / LMAX) * (PY1 - PY0);

// ---------------------------------------------------------------- cue sheet
const STEPS = Array.from({ length: 58 }, (_, n) => [+(CG + (T_END - CG) * Math.pow((n + 1) / 58, .82)).toFixed(3), 'step']);
const SFX = [
  [0.05, 'swell', { dur: 2.2 }], ...Array.from({ length: NL }, (_, l) => [+(.2 + l * .12).toFixed(3), 'tick', { hi: l % 2 === 1 }]),
  [.95, 'pop'], [1.25, 'swish', { pitch: .9 }], ...IK.map((_, i) => [+(1.8 + i * .11).toFixed(3), 'tick', { hi: true }]),
  [1.9, 'count', { dur: 1.225 }], [3.125, 'chime', { midi: 84 }], [3.14, 'sparkle', { dur: 1 }],
  [6.1, 'swish', { pitch: .8 }],
  [ST[0], 'swish', { pitch: 1 }], [ST[0] + .02, 'whoosh', { dur: .8 }], [8.25, 'ping', { midi: 79 }], [8.5, 'blip', { midi: 60 }], [8.62, 'blip', { midi: 63 }], [8.74, 'blip', { midi: 66 }],
  [9.375, 'chip', { midi: 79 }], [9.375, 'up'], [9.4, 'count', { dur: .55 }], [9.95, 'down'],
  [ST[2] + .02, 'whoosh', { dur: 1.0, rev: 1 }], ...Array.from({ length: NL }, (_, i) => [+(10.35 + i * .14).toFixed(3), 'blip', { midi: 76 - i * 2 }]),
  ...[0, 1, 2, 3, 4, 5].map(g => [+(11.4 + g * .09).toFixed(3), 'tick', { hi: g % 2 === 0 }]), [11.6, 'chime', { midi: 76 }],
  [B_OUT0, 'swish', { pitch: .9 }],
  ...CS.flatMap((s, c) => [[+s.toFixed(3), 'swish', { pitch: 1 + c * .1 }], [+(s + .6 * CP[c]).toFixed(3), 'blip', { midi: 64 + c * 2 }]]),
  ...STEPS, [15.625, 'riser', { dur: 2.5 }],
  [T_END, 'hit', { k: .5 }], [T_END, 'up'], [T_END + .02, 'chime', { midi: 88 }], [T_END + .1, 'sparkle', { dur: 1.2 }],
];

// ---------------------------------------------------------------- drawing helpers
let GA = 1;                                                // entrance alpha for text(), which would otherwise ignore ctx.globalAlpha
const tt = (s, x, y, o = {}) => text(s, x, y, { ...o, alpha: (o.alpha ?? 1) * GA });
const LBL = '#c9d8f2';
function softDot(x, y, r, rgb, a) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); }
function glassPanel(x, y, w, h, a, glowCol, glowA = 0) {   // dark panel; the glow is an additive double stroke at the edge, never tinting the interior
  ctx.save(); ctx.globalAlpha = a;
  rrect(x, y, w, h, 22); ctx.fillStyle = 'rgba(7,12,28,.82)'; ctx.fill();
  if (glowA > .02) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; rrect(x, y, w, h, 22); ctx.strokeStyle = rgba(glowCol, .18 * glowA); ctx.lineWidth = 9; ctx.stroke(); ctx.strokeStyle = rgba(glowCol, .5 * glowA); ctx.lineWidth = 3; ctx.stroke(); ctx.restore(); }
  ctx.lineWidth = 1.5; ctx.strokeStyle = glowA > .02 ? rgba(glowCol, .35 + .4 * glowA) : 'rgba(160,200,255,.32)'; rrect(x, y, w, h, 22); ctx.stroke(); ctx.restore();
}
function plate(x, y, w, h, a = .6, r = 14) { ctx.save(); rrect(x, y, w, h, r); ctx.fillStyle = `rgba(5,9,24,${a})`; ctx.fill(); ctx.restore(); }
function pill(label, cx, cy, size, col, textCol, a, weight = 700) {
  const w = measure(label, size, F_UI, weight) + 30, h = size + 16;
  ctx.save(); ctx.globalAlpha = a * GA; rrect(cx - w / 2, cy - h / 2, w, h, h / 2); ctx.fillStyle = 'rgba(5,9,22,.94)'; ctx.fill(); ctx.lineWidth = 1.8; ctx.strokeStyle = col; ctx.stroke(); ctx.restore();
  tt(label, cx, cy + 1, { font: F_UI, size, weight, color: textCol, alpha: a });
}
function bezier(p0, p1, p2, t) { const u = 1 - t; return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]; }
function comet(p0, p1, p2, t, rgb, a, len = .26) {          // bright head with a fading tail along a quadratic curve
  if (t <= 0 || t >= 1.3 || a <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const fade = 1 - sstep(.75, 1, t);
  for (let i = 0; i < 10; i++) { const q = t - i * len / 10; if (q < 0 || q > 1) continue; const p = bezier(p0, p1, p2, q); softDot(p[0], p[1], 13 - i * .8, rgb, a * fade * (1 - i / 10) * .85); }
  if (t > .85) { const k = clamp((t - .85) / .45); ctx.strokeStyle = `rgba(${rgb},${a * .8 * (1 - k)})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(p2[0], p2[1], 8 + 20 * eout(k), 0, TAU); ctx.stroke(); }
  ctx.restore();
}
function strokeBuckets(B, cols, lws) { B.forEach((seg, k) => { if (!seg.length) return; ctx.strokeStyle = cols[k]; ctx.lineWidth = lws[k]; ctx.beginPath(); for (const s of seg) { ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); } ctx.stroke(); }); }
function tri(x, y, s, up, col, a) { ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath(); if (up) { ctx.moveTo(x, y - s); ctx.lineTo(x + s, y + s * .8); ctx.lineTo(x - s, y + s * .8); } else { ctx.moveTo(x, y + s); ctx.lineTo(x + s, y - s * .8); ctx.lineTo(x - s, y - s * .8); } ctx.closePath(); ctx.fill(); ctx.restore(); }
// knob: a dial with a tick scale, a value arc and a pointer; k = 0..1 sweeps the pointer from centre to its value
function dial(x, y, r, val, a, k, sway = 0) {
  const th = (val / 2) * 2.356 * k + sway, col = val >= 0 ? PAL.cyan : PAL.violet;
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = 'rgb(8,14,34)'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.strokeStyle = rgba(col, .9); ctx.lineWidth = 2.5; ctx.stroke();
  ctx.strokeStyle = 'rgba(200,220,255,.4)'; ctx.lineWidth = 1.5; ctx.beginPath();
  for (let i = 0; i <= 10; i++) { const an = -2.356 + i * .4712; ctx.moveTo(x + Math.sin(an) * r * .8, y - Math.cos(an) * r * .8); ctx.lineTo(x + Math.sin(an) * r * .94, y - Math.cos(an) * r * .94); } ctx.stroke();
  ctx.strokeStyle = rgba(col, .85); ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x, y, r * .62, -PI / 2, -PI / 2 + th, th < 0); ctx.stroke();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(th) * r * .72, y - Math.cos(th) * r * .72); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, TAU); ctx.fill(); ctx.restore();
}
// nudge badge on a link: e = 0 shows just the direction arrow, e = 1 the full value pill
function nudgeBadge(cx, cy, e, up, label, a) {
  const col = up ? PAL.cyan : PAL.violet, tw = measure(label, 24, F_MONO, 700), w = lerp(34, tw + 52, e), h = 36;
  ctx.save(); ctx.globalAlpha = a; rrect(cx - w / 2, cy - h / 2, w, h, 17); ctx.fillStyle = 'rgb(6,10,24)'; ctx.fill(); ctx.strokeStyle = rgba(col, .95); ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  tri(cx - w / 2 + 17, cy, 8, up, col, a);
  if (e > .02) { ctx.save(); rrect(cx - w / 2 + 30, cy - h / 2, w - 30, h, 14); ctx.clip();
    text(label, cx - w / 2 + 34 + (w - 34) / 2, cy + 1, { font: F_MONO, size: 24, weight: 700, color: up ? '#bff4ff' : '#d9cbff', alpha: a * sstep(.55, .95, e) }); ctx.restore(); }
}

// sparks: drifting energy motes (made once)
const SPARKS = Array.from({ length: 150 }, () => ({ x: 100 + R() * 1700, y: 190 + R() * 480, sp: 30 + R() * 90, p: R(), g: Math.floor(R() * 4), s: 1 + R() * 2 }));
scene({ id: 'learn', start: 38, len: 8, mb: 2, fi: .25, fo: .3, ch: ['06', '学习', 'LEARNING'], bloom: .8,
  subs: [[.4, 6.4, '模型里有数十亿个可调的数字，叫参数——像一块块旋钮', 'Inside are billions of adjustable numbers called parameters: think of them as knobs'],
    [6.9, 13.5, '每猜错一次，就算出每个旋钮该往哪边拧，再各拧一点点', 'After each wrong guess it works out which way to turn every knob, then turns each a tiny bit'],
    [14.0, 19.7, '重复亿万次：错误一路下降，正确答案越来越可能', 'Repeat billions of times: the error falls and the right answer grows likelier']],
  sfx: SFX, hits: [[T_END, .15]],
  cam: lt => ({ z: 1 + .012 * lt / 20, x: 6 * Math.sin(lt * .21), y: 4 * Math.sin(lt * .17 + 1) }),
  draw(lt, d, T) {
    const lq = Math.round(lt * 30) / 30;                    // numbers are quantised to the frame so every sub-frame shows the same digits
    const u = prog(lt), uq = prog(lq), en = .5 + .5 * sstep(13.5, T_END, lt);
    const done = sstep(T_END, T_END + .15, lt) * (1 - sstep(T_END + .15, T_END + 1.4, lt));
    backdrop(T, .46 + .16 * en + .06 * done);
    const vals = rowVals(lq, uq), pm = vals[0], Lq = -Math.log(pm), b = clamp((L0 - exLoss(u)) / (L0 - LF));

    // ---- page switches
    const aA = sstep(1.2, 1.9, lt) * (1 - sstep(A_OUT0, A_OUT1, lt));            // zoom-in inset, ring and cone
    const aB = sstep(6.55, 7.1, lt);                                              // bars + loss panels (stay for page C)
    const aStrip = sstep(6.65, 7.15, lt) * (1 - sstep(B_OUT0, B_OUT1, lt));         // the four-beat step strip under the network
    const aC = sstep(B_OUT1 + .05, B_OUT1 + .6, lt);                              // page C labels
    const step = lt < ST[0] ? -1 : lt < ST[1] ? 0 : lt < ST[2] ? 1 : lt < ST[3] ? 2 : 3;

    // ================= THE NETWORK
    const act = PULSES.filter(p => lt > p.t0 - .02 && lt < p.t0 + p.d + 2.2);
    ctx.save();
    if (lt < 1.45) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = sstep(0, .6, lt) * .8; ctx.drawImage(BASEC, BB.x, BB.y); ctx.globalCompositeOperation = 'source-over';
      for (let l = 0; l < NL; l++) { ctx.globalAlpha = sstep(.12 + l * .11, .12 + l * .11 + .55, lt); ctx.drawImage(LAYC[l], BB.x, BB.y); } }
    else { ctx.globalAlpha = .88 + .12 * Math.sin(lt * 1.5); ctx.drawImage(ALLC, BB.x, BB.y); }
    ctx.restore();
    const aNet = sstep(.12, .7, lt);
    ctx.save(); ctx.globalAlpha = aNet;
    // sheets flare as a wave front crosses them
    for (let l = 0; l < NL; l++) {
      let If = 0, Ib = 0; for (const p of act) { const g = glowAt(lt, p, l / (NL - 1)); if (p.dir > 0) If = Math.max(If, g); else Ib = Math.max(Ib, g); }
      const I = Math.max(If, Ib); if (I < .03) continue;
      const col = Ib > If ? '255,104,120' : '140,195,255';
      sheetPath(ctx, l); ctx.fillStyle = `rgba(${col},${.13 * I})`; ctx.fill(); ctx.strokeStyle = `rgba(${col},${.7 * I})`; ctx.lineWidth = 2; ctx.stroke();
    }
    // lit links and nodes
    ctx.globalCompositeOperation = 'lighter';
    const FW = [[], [], []], BW_ = [[], [], []], NF_ = [[], [], []], NB_ = [[], [], []];
    for (const p of act) {
      const arr = p.dir > 0 ? FW : BW_, narr = p.dir > 0 ? NF_ : NB_;
      LINKS.forEach((L, i) => {
        if (!(L.path || hash1(i * 3.7 + p.id * 5.3) < (p.id > 3 ? .33 : .5))) return;
        const gl = glowAt(lt, p, (L.l + .5) / (NL - 1)); if (gl < .06) return;
        const a = PS[L.a], q = PS[L.b]; arr[gl > .6 ? 2 : gl > .3 ? 1 : 0].push([a[0], a[1], q[0], q[1]]);
      });
      NODES.forEach((n, i) => {
        if (!(i === PATH[n.l] || hash1(i * 1.3 + p.id * 7.7) < .65)) return;
        const gl = glowAt(lt, p, n.l / (NL - 1)); if (gl < .1) return;
        narr[gl > .6 ? 2 : gl > .3 ? 1 : 0].push([PS[i][0], PS[i][1], scl(PS[i])]);
      });
    }
    strokeBuckets(FW, ['rgba(150,200,255,.3)', 'rgba(160,208,255,.5)', 'rgba(185,225,255,.8)'], [1.3, 1.8, 2.4]);
    strokeBuckets(BW_, ['rgba(255,100,116,.32)', 'rgba(255,105,120,.55)', 'rgba(255,125,138,.85)'], [1.3, 1.8, 2.4]);
    for (const [arr, rgb] of [[NF_, '150,205,255'], [NB_, '255,110,125']]) arr.forEach((nodes, k) => {
      if (!nodes.length) return;
      ctx.fillStyle = `rgba(${rgb},${[.16, .22, .3][k]})`; ctx.beginPath(); for (const [x, y, s] of nodes) { const r = 11 * s; ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); } ctx.fill();
      ctx.fillStyle = `rgba(${rgb},${[.45, .6, .8][k]})`; ctx.beginPath(); for (const [x, y, s] of nodes) { const r = 4.4 * s * s; ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); } ctx.fill();
    });
    // the signal head running along the path
    for (const p of act) {
      const x = (lt - p.t0) / p.d; if (x < 0 || x > 1) continue;
      for (let m = 0; m < 6; m++) {
        const f = (p.dir > 0 ? x - m * .035 : 1 - x + m * .035) * (NL - 1); if (f < 0 || f > NL - 1) continue;
        const i0 = Math.min(NL - 2, Math.floor(f)), q = f - i0, a = PS[PATH[i0]], c = PS[PATH[i0 + 1]];
        softDot(lerp(a[0], c[0], q), lerp(a[1], c[1], q), 22 - m * 2.6, p.dir > 0 ? '170,215,255' : '255,110,125', .6 * (1 - m / 6));
      }
    }
    // data motes drifting along links (life during the holds)
    ctx.fillStyle = 'rgba(190,225,255,.7)'; ctx.beginPath();
    for (const m of FLOW) { const L = LINKS[m.li], a = PS[L.a], c = PS[L.b], q = (m.p + lt * m.sp) % 1; ctx.rect(lerp(a[0], c[0], q) - 1.2, lerp(a[1], c[1], q) - 1.2, 2.6, 2.6); }
    ctx.fill();
    // the output node that means "mat"
    const mp = PS[MAT_NODE], ms = scl(mp);
    const aMat0 = sstep(.8, 1.3, lt);
    softDot(mp[0], mp[1], (30 + 12 * b) * ms, '255,200,100', aMat0 * Math.min(.3, .16 + .12 * b + .02 * done));
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = `rgba(255,214,130,${aMat0 * (.8 + .2 * b)})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(mp[0], mp[1], (9 + 3 * b) * ms, 0, TAU); ctx.stroke();
    for (let r = 0; r < 3; r++) { const k = clamp((lt - T_END - .04 - r * .24) / .8); if (k <= 0 || k >= 1) continue; ctx.strokeStyle = `rgba(255,214,130,${.85 * (1 - k) ** 1.5})`; ctx.lineWidth = 3.2 - 1.6 * k; ctx.beginPath(); ctx.arc(mp[0], mp[1], (12 + 92 * eout(k)) * ms, 0, TAU); ctx.stroke(); }
    if (lt > T_END) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,200,120,.42)'; ctx.beginPath();
      NODES.forEach((n, i) => { const ag = lt - T_END - n.l * .08; if (ag > 0 && ag < 1.3) { const p = PS[i], r = 5.2 * scl(p) * Math.exp(-ag * 2.4); ctx.moveTo(p[0] + r, p[1]); ctx.arc(p[0], p[1], r, 0, TAU); } }); ctx.fill(); }
    ctx.restore();

    // page A: ring around a few nodes and the zoom cone (under the labels and the mat pill)
    if (lt < A_OUT1) {
      const ra = sstep(.9, 1.4, lt) * (1 - sstep(A_OUT0, A_OUT1, lt));
      ctx.save(); ctx.globalAlpha = ra;
      const g = ctx.createLinearGradient(PATCH.x1, 0, IX, 0); g.addColorStop(0, 'rgba(95,227,255,.12)'); g.addColorStop(1, 'rgba(95,227,255,.02)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(PATCH.x1, PATCH.y0); ctx.lineTo(IX, IY + 90); ctx.lineTo(IX, IY + 400); ctx.lineTo(PATCH.x1, PATCH.y1); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(95,227,255,.3)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PATCH.x1, PATCH.y0); ctx.lineTo(IX, IY + 90); ctx.moveTo(PATCH.x1, PATCH.y1); ctx.lineTo(IX, IY + 400); ctx.stroke();
      ctx.strokeStyle = rgba(PAL.cyan, .95); ctx.lineWidth = 2.5; ctx.setLineDash([9, 7]); rrect(PATCH.x0, PATCH.y0, PATCH.x1 - PATCH.x0, PATCH.y1 - PATCH.y0, 18); ctx.stroke(); ctx.restore();
    }
    // the "mat" pill on the output node
    const aMat = sstep(.8, 1.3, lt); GA = aMat;
    { const pcx = mp[0] - 12, pcy = mp[1] - 52;
      ctx.save(); ctx.globalAlpha = aMat; ctx.strokeStyle = rgba(PAL.gold, .85); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pcx + 4, pcy + 20); ctx.lineTo(mp[0] - 2, mp[1] - 10); ctx.stroke(); ctx.restore();
      pill('mat', pcx, pcy, 26, rgba(PAL.gold, .9), PAL.gold, 1); }

    // nudge badges riding on links: arrows during the backward pass, values after, then flashes in the repeat
    {
      const bw = ST[2] + .35, bd = .85;
      PILLS.forEach((pl, g) => {
        let a = 0, e = 0, lab = pl.val;
        const tb = bw + bd * (1 - (g + .5) / (NL - 1));
        if (lt > tb - .02 && lt < B_OUT1) {
          a = sstep(tb, tb + .15, lt) * (1 - sstep(B_OUT0, B_OUT1, lt));
          e = sstep(ST[3] + .1 + g * .09, ST[3] + .55 + g * .09, lt);
        } else if (lt > CG - .5) {
          CS.forEach((s, c) => {
            const P = CP[c], t1 = s + .6 * P + .34 * P * (1 - (g + .5) / (NL - 1));
            if (hash1(g * 3.1 + c * 11.9) < .5 || c === 0) {
              const al = sstep(t1, t1 + .1, lt) * (1 - sstep(t1 + .45, t1 + .75, lt));
              if (al > a) { a = al; e = sstep(t1 + .05, t1 + .25, lt); const v = (1 + Math.floor(hash1(c * 3.1 + g * 7.7) * 9)) / 1000; lab = (pl.up ? '+' : '−') + v.toFixed(3); }
            }
          });
        }
        if (a > .02) nudgeBadge(pl.x, pl.y, e, pl.up, lab, a * aNet);
      });
    }

    // network labels: input / output ends with a data-flow arrow, a title above
    {
      const l0 = PS.filter((_, i) => NODES[i].l === 0), l6 = PS.filter((_, i) => NODES[i].l === NL - 1);
      const x0 = l0.reduce((a, p) => a + p[0], 0) / l0.length, x6 = l6.reduce((a, p) => a + p[0], 0) / l6.length - 30, yl = 650;
      const aL = sstep(1.0, 1.6, lt);
      GA = aL;
      const lw0 = measure('input · 输入', 24, F_UI, 600) + 24, lw6 = measure('output · 输出', 24, F_UI, 600) + 24;
      plate(x0 - lw0 / 2, yl - 19, lw0, 38, .75 * aL); plate(x6 - lw6 / 2, yl - 19, lw6, 38, .75 * aL);
      tt('input · 输入', x0, yl + 1, { font: F_UI, size: 24, weight: 600, color: '#e8f0ff' }); tt('output · 输出', x6, yl + 1, { font: F_UI, size: 24, weight: 600, color: '#e8f0ff' });
      ctx.save(); ctx.globalAlpha = aL * .7; ctx.strokeStyle = 'rgba(160,200,255,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0 + lw0 / 2 + 14, yl); ctx.lineTo(x6 - lw6 / 2 - 24, yl); ctx.stroke();
      ctx.fillStyle = 'rgba(160,200,255,.8)'; ctx.beginPath(); ctx.moveTo(x6 - lw6 / 2 - 10, yl); ctx.lineTo(x6 - lw6 / 2 - 26, yl - 7); ctx.lineTo(x6 - lw6 / 2 - 26, yl + 7); ctx.fill(); ctx.restore();
      // header slot above the network: A title, B input sentence, C GPU badge
      const aTitle = sstep(.7, 1.3, lt) * (1 - sstep(A_OUT0, A_OUT1, lt));
      GA = aTitle; tt('神经网络 · neural network', 500, 196, { font: F_UI, size: 32, weight: 700, color: '#e8f0ff', glow: 'rgba(0,0,0,.9)', blur: 8 });
      const aIn = sstep(6.85, 7.4, lt) * (1 - sstep(B_OUT0, B_OUT1, lt)), inGlow = lt > ST[0] - .3 && lt < ST[1] ? sstep(ST[0] - .3, ST[0], lt) * (1 - sstep(ST[0] + .3, ST[0] + .8, lt)) : 0;
      if (aIn > .01) { GA = aIn;
        const sw = measure('The cat sat on the', 28, F_MONO) + 40, cx0 = 90, xt = (SHEET[0][0][0] + SHEET[0][1][0]) / 2, yt = Math.min(SHEET[0][0][1], SHEET[0][1][1]);
        ctx.save(); ctx.globalAlpha = aIn; rrect(cx0, 172, sw, 52, 14); ctx.fillStyle = 'rgba(8,14,34,.9)'; ctx.fill(); ctx.strokeStyle = rgba(PAL.cyan, .6 + .4 * inGlow); ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
        tt('The cat sat on the', cx0 + sw / 2, 199, { font: F_MONO, size: 28, color: '#fff' });
        ctx.save(); ctx.globalAlpha = aIn * .85; ctx.strokeStyle = 'rgba(150,205,255,.8)'; ctx.fillStyle = 'rgba(150,205,255,.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(xt, 230); ctx.lineTo(xt, yt - 14); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(xt, yt - 4); ctx.lineTo(xt - 8, yt - 18); ctx.lineTo(xt + 8, yt - 18); ctx.fill(); ctx.restore();
        tt('输入 · input', cx0 + sw + 24, 199, { font: F_UI, size: 24, color: LBL, alpha: .85, align: 'left' });
      }
      if (aC > .01) { GA = aC;
        ctx.save(); ctx.globalAlpha = aC; rrect(90, 160, 780, 70, 20); ctx.fillStyle = 'rgba(7,12,28,.82)'; ctx.fill(); ctx.strokeStyle = 'rgba(160,200,255,.32)'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 12; i++) { const gx = 114 + (i % 4) * 22, gy = 177 + Math.floor(i / 4) * 17, v = Math.pow(.5 + .5 * Math.sin(lt * (4 + en * 6) + i * 1.3 + hash1(i * 7) * 6), 3), hot = hash1(i * 3.3 + Math.floor(lt * 3)) > .9;
          ctx.fillStyle = hot ? `rgba(255,210,122,${.4 + .6 * v})` : `rgba(95,227,255,${.16 + .6 * v})`; ctx.fillRect(gx, gy, 17, 12); }
        ctx.restore();
        tt('数千块 GPU · 数周到数月', 222, 184, { font: F_UI, size: 30, weight: 700, color: '#fff', align: 'left' });
        tt('thousands of GPUs · weeks to months', 222, 215, { font: F_UI, size: 24, color: LBL, align: 'left' });
      }
    }
    GA = 1;

    // ================= PAGE A: ring, cone and the zoomed-in knobs
    if (aA > .01) {
      const ix = IX + (1 - eout(clamp((lt - 1.2) / .8))) * 36;
      GA = aA; glassPanel(ix, IY, IW, IH, aA, PAL.cyan, 0);
      tt('放大看看 · zoom in', ix + 34, IY + 42, { font: F_UI, size: 28, weight: 600, color: LBL, align: 'left' });
      const dx = ix - IX, nl = INL.map(p => [p[0] + dx, p[1]]), nr = INR.map(p => [p[0] + dx, p[1]]);
      tt('第 n 层 · layer n', nl[0][0] + 30, 272, { font: F_UI, size: 24, color: LBL }); tt('第 n+1 层 · layer n+1', nr[0][0] - 20, 357, { font: F_UI, size: 24, color: LBL });
      ctx.save(); ctx.globalAlpha = aA; ctx.lineWidth = 3;
      for (const k of IK) { const a = nl[k.a], c = nr[k.b], gr = ctx.createLinearGradient(a[0], 0, c[0], 0); gr.addColorStop(0, 'rgba(95,227,255,.7)'); gr.addColorStop(1, 'rgba(169,139,255,.7)'); ctx.strokeStyle = gr; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.stroke(); }
      ctx.globalCompositeOperation = 'lighter';
      for (const p of [...nl, ...nr]) { softDot(p[0], p[1], 44, '150,200,255', .35); }
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = 'rgba(225,238,255,.97)';
      for (const p of [...nl, ...nr]) { ctx.beginPath(); ctx.arc(p[0], p[1], 17, 0, TAU); ctx.fill(); }
      ctx.restore();
      IK.forEach((k, i) => {
        const a = nl[k.a], c = nr[k.b], x = lerp(a[0], c[0], k.t), y = lerp(a[1], c[1], k.t), sw = eout(clamp((lt - (1.75 + i * .11)) / .8));
        dial(x, y, 31, k.val, aA * sstep(1.6 + i * .11, 2 + i * .11, lt), sw, .05 * Math.sin(lt * 1.1 + i * 1.7) * sstep(2.7, 3.4, lt));
        const lab = (k.val >= 0 ? '+' : '−') + Math.abs(k.val).toFixed(2), w = measure(lab, 24, F_MONO, 700) + 14, al = aA * sstep(2.2 + i * .11, 2.6 + i * .11, lt);
        const lx_ = x + k.s * (31 + 8 + w / 2);
        ctx.save(); ctx.globalAlpha = al; rrect(lx_ - w / 2, y - 15, w, 30, 8); ctx.fillStyle = 'rgb(6,10,24)'; ctx.fill(); ctx.restore();
        tt(lab, lx_, y + 1, { font: F_MONO, size: 24, weight: 700, color: k.val >= 0 ? '#bff4ff' : '#d9cbff', alpha: al });
      });
      GA = aA * sstep(2.3, 3.0, lt);
      tt('每个旋钮 = 一个参数', ix + IW / 2, IY + IH - 74, { font: F_UI, size: 36, weight: 700, color: '#fff' });
      tt('each knob = one adjustable number (a weight)', ix + IW / 2, IY + IH - 34, { font: F_UI, size: 26, color: LBL });
      GA = 1;
    }

    // ================= bottom-left plate: counter (A) -> step strip (B) -> counter + terms (C)
    const PLY = 676, PLH = 196, aPl = sstep(1.5, 2.1, lt);
    ctx.save(); ctx.globalAlpha = aPl; rrect(90, PLY, 960, PLH, 22); ctx.fillStyle = 'rgba(5,9,24,.62)'; ctx.fill(); ctx.strokeStyle = 'rgba(160,200,255,.22)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
    const aCnt = sstep(1.7, 2.3, lt) * (1 - sstep(A_OUT0, A_OUT1, lt));
    if (aCnt > .01) {
      GA = aCnt; const cn = Math.round(70e9 * eout(clamp((lq - 1.9) / 1.225)));
      tt('参数 · PARAMETERS', 124, PLY + 36, { font: F_UI, size: 28, weight: 700, ls: 3, color: LBL, align: 'left' });
      tt('≈ ' + fmtInt(cn), 124, PLY + 106, { font: F_MONO, size: 66, weight: 700, color: '#fff', align: 'left' });
      tt('(e.g. 举例)', 124 + measure('≈ 70,000,000,000', 66, F_MONO, 700) + 24, PLY + 116, { font: F_UI, size: 26, color: LBL, align: 'left', alpha: .85 });
      tt('真实的大模型：数十亿到数万亿个 · real models: billions to trillions', 124, PLY + 166, { font: F_UI, size: 26, color: LBL, align: 'left', alpha: .9 });
      GA = 1;
    }
    if (aStrip > .01) {
      const labs = [['前向', 'forward'], ['对比', 'compare'], ['反向', 'backward'], ['微调', 'nudge']];
      const cols = [PAL.cyan, PAL.mint, PAL.coral, PAL.violet];
      GA = aStrip;
      labs.forEach((lb, i) => {
        const cx = 124 + i * 232, on = lt >= ST[i] ? 1 : 0, cur = step === i ? 1 : 0, col = cols[i];
        const aa = (.45 + .55 * sstep(ST[i] - .05, ST[i] + .2, lt)) * (cur ? 1 : .8);
        ctx.save(); ctx.globalAlpha = aStrip * aa; ctx.beginPath(); ctx.arc(cx + 20, PLY + 34, 19, 0, TAU); ctx.fillStyle = cur ? rgba(col, .3) : on ? rgba(col, .14) : 'rgba(5,9,22,.9)'; ctx.fill(); ctx.strokeStyle = rgba(col, cur ? 1 : .6); ctx.lineWidth = cur ? 3 : 2; ctx.stroke(); ctx.restore();
        tt(String(i + 1), cx + 20, PLY + 36, { font: F_MONO, size: 24, weight: 700, color: '#fff', alpha: aa });
        tt(lb[0], cx + 50, PLY + 32, { font: F_UI, size: 26, weight: 700, color: cur ? '#fff' : LBL, align: 'left', alpha: aa });
        tt(lb[1], cx + 50 + measure(lb[0], 26, F_UI, 700) + 8, PLY + 34, { font: F_UI, size: 24, color: LBL, align: 'left', alpha: aa * .9 });
      });
      ctx.save(); ctx.globalAlpha = aStrip * .5; ctx.strokeStyle = 'rgba(160,200,255,.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(124, PLY + 66); ctx.lineTo(1016, PLY + 66); ctx.stroke(); ctx.restore();
      const TXT = [
        ['一次训练步骤 · one training step', '四拍循环：猜 → 比 → 倒推 → 拧', 'a loop of four beats: guess, compare, trace back, turn', '#fff'],
        ['前向传播 · forward pass', '输入穿过每一层，得出一个猜测', 'the input flows through the layers and comes out as a guess', PAL.cyan],
        ['对比 · compare', '和正确答案 mat 比较，算出损失', 'the true answer is mat: how big is the loss?', PAL.mint],
        ['反向传播 · backpropagation', '从输出倒着算：每个旋钮该往哪边拧', 'work backwards: which way should each knob turn?', '#ff9ba6'],
        ['梯度下降 · gradient descent', '每个旋钮只拧一点点', 'turn every knob a tiny bit', '#d9cbff']];
      TXT.forEach((tx, i) => {
        const aIn = i === 0 ? sstep(6.85, 7.2, lt) : sstep(ST[i - 1] + .25, ST[i - 1] + .55, lt);
        const aOut = i === 0 ? 1 - sstep(ST[0] - .15, ST[0] + .1, lt) : i < 4 ? 1 - sstep(ST[i] - .05, ST[i] + .2, lt) : 1;
        const a = aIn * aOut * aStrip; if (a < .01) return;
        GA = a; tt(tx[0], 124, PLY + 104, { font: F_UI, size: 34, weight: 700, color: tx[3], align: 'left' });
        tt(tx[1], 124, PLY + 146, { font: F_UI, size: 30, weight: 600, color: '#fff', align: 'left' });
        tt(tx[2], 124, PLY + 179, { font: F_UI, size: 24, color: LBL, align: 'left' });
      });
      GA = 1;
    }
    if (aC > .01) {
      GA = aC;
      tt('参数 · PARAMETERS', 124, PLY + 32, { font: F_UI, size: 26, weight: 600, ls: 3, color: LBL, align: 'left' });
      tt('≈ ' + fmtInt(70e9), 124, PLY + 88, { font: F_MONO, size: 52, weight: 700, color: '#fff', align: 'left' });
      tt('(e.g.)', 124 + measure('≈ 70,000,000,000', 52, F_MONO, 700) + 20, PLY + 94, { font: F_UI, size: 24, color: LBL, align: 'left', alpha: .85 });
      const onB = lt > CG && lt < T_END && CS.some((s, c) => lt >= s + .5 * CP[c] && lt < s + .95 * CP[c]), onD = lt > CG && lt < T_END && CS.some((s, c) => lt >= s + .9 * CP[c] || lt < s + .2 * CP[c] && lt >= CG + .2);
      const w1 = measure('backpropagation', 30, F_UI, 600);
      tt('backpropagation', 124, PLY + 142, { font: F_UI, size: 30, weight: 600, color: PAL.coral, align: 'left', alpha: onB ? 1 : .75 });
      tt('→', 124 + w1 + 24, PLY + 142, { font: F_UI, size: 30, color: LBL, align: 'left' });
      tt('gradient descent', 124 + w1 + 62, PLY + 142, { font: F_UI, size: 30, weight: 600, color: PAL.cyan, align: 'left', alpha: onD ? 1 : .75 });
      tt('反向传播 → 梯度下降 · 一遍又一遍', 124, PLY + 178, { font: F_UI, size: 24, color: LBL, align: 'left', alpha: .85 });
      GA = 1;
    }

    // ================= RIGHT: next-word bars (from page B on)
    const hitP = lt > T_END ? Math.exp(-(lt - T_END) * 6) * sstep(0, .06, lt - T_END) : 0;
    const cycF = (kind) => { let f = 0; CS.forEach((s, c) => { const t1 = s + (kind === 'bars' ? .46 : .62) * CP[c]; f = Math.max(f, sstep(t1 - .05, t1 + .02, lt) * Math.exp(-Math.max(0, lt - t1 - .02) * 6)); }); return f; };
    const flashB = cycF('bars'), flashL = cycF('loss') * sstep(CG - .2, CG, lt);
    const bx = BX, pcol = mixHex(PAL.coral, PAL.gold, clamp(b * 2.2));
    const tLab = sstep(8.4, 8.8, lt), tGrow = eout(clamp((lt - 8.5) / .7)), tAns = sstep(9.0, 9.35, lt);           // guess appears, bars grow, the true answer drops in
    const ansOut = 1 - sstep(B_OUT0, B_OUT1 + .1, lt), tickIn = sstep(CG + .3, CG + 1.2, lt);
    GA = aB; ctx.save(); ctx.globalAlpha = aB;
    glassPanel(bx, BY, BW, BH, aB, tAns > .5 && ansOut > .5 ? PAL.mint : PAL.gold, Math.max(done * .8, flashB * .35, tAns * ansOut * .35));
    tt('The cat sat on the', bx + 30, BY + 42, { font: F_MONO, size: 30, color: '#fff', align: 'left' });
    { const w = measure('The cat sat on the ', 30); ctx.fillStyle = `rgba(255,255,255,${.4 * (1 - tAns * ansOut)})`; ctx.fillRect(bx + 30 + w, BY + 60, 54, 3);
      if (tAns * ansOut > .02) tt('mat', bx + 30 + w + 27 + (1 - eout(tAns)) * -8, BY + 42 + (1 - eout(tAns)) * -10, { font: F_MONO, size: 30, weight: 700, color: PAL.mint, alpha: tAns * ansOut }); }
    tt('P(mat)', bx + BW - 30, BY + 26, { font: F_MONO, size: 24, weight: 600, color: LBL, align: 'right', alpha: tLab });
    ctx.save(); ctx.translate(bx + BW - 30, BY + 60); ctx.scale(1 + .16 * hitP, 1 + .16 * hitP); tt(fmtPct(pm), 0, 0, { font: F_MONO, size: 40, weight: 700, color: pcol, align: 'right', alpha: tLab }); ctx.restore();
    if (lt < 8.4) tt('模型的猜测 · the model’s guess', bx + BW / 2, BY + 230, { font: F_UI, size: 32, weight: 600, color: LBL, alpha: sstep(7.0, 7.5, lt) * (1 - sstep(8.0, 8.35, lt)) });
    const y0 = BY + 96, tx = bx + BAR_TX, tw = BAR_TW;
    const jb = clamp((b - .3) / .4), PJ = .25, FJ = .09, slotO = 11 - [0, 1, 2, 3].reduce((acc, k) => acc + sstep(k * PJ + FJ, (k + 1) * PJ, jb), 0), pitch = 28 + 11 * sstep(0, 1, jb);
    const junkA = i => 1 - sstep((10 - i) * PJ, (10 - i) * PJ + FJ, jb);
    const rowY = i => y0 + pitch * (i <= 10 ? i : slotO);
    const RA = ROWS.map((r, i) => { const grow = sstep(.002, .014, vals[i]); return i === 0 || r.w === '…' ? 1 : r.bad ? Math.min(grow, junkA(i)) : Math.max(.28, grow); });
    const dv = vals.slice(); ROWS.forEach((r, i) => { if (r.bad) dv[11] += vals[i] * (1 - RA[i]); });
    ROWS.forEach((r, i) => {
      const y = rowY(i), v = dv[i], isMat = i === 0, isEll = r.w === '…', ra = RA[i] * tLab, grow = sstep(.002, .014, vals[i]);
      ctx.fillStyle = 'rgba(160,200,255,.08)'; ctx.save(); ctx.globalAlpha = aB * (.3 + .7 * tLab) * (ra > .01 || lt < 8.4 ? 1 : 0); rrect(tx, y - 8, tw, 16, 8); ctx.fill(); ctx.restore();
      if (ra < .01) return;
      const GA0 = GA; GA = GA0 * ra;
      const wd = clamp(v / BAR_MAX) * tw * tGrow, col = isMat ? PAL.gold : r.bad ? PAL.coral : PAL.cyan;
      ctx.save(); ctx.globalAlpha = ra * aB;
      const rs = isMat ? 1 + .14 * hitP : 1;
      ctx.save(); ctx.translate(bx + 28, y); ctx.scale(rs, rs);
      tt(isEll ? '(other)' : r.w, 0, 0, { font: F_MONO, size: 24, weight: isMat ? 700 : 400, color: isMat ? PAL.gold : isEll ? LBL : '#dfeaff', align: 'left' }); ctx.restore();
      if (wd > 1) {
        ctx.save();
        const gr = ctx.createLinearGradient(tx, 0, tx + Math.max(wd, 40), 0);
        if (isEll) { gr.addColorStop(0, 'rgba(120,140,190,.5)'); gr.addColorStop(1, 'rgba(120,140,190,.32)'); }
        else if (isMat) { const k = clamp(b * 2.5); gr.addColorStop(0, mixHex(PAL.coral, PAL.amber, k)); gr.addColorStop(1, mixHex(PAL.coral, PAL.gold, k)); }
        else if (r.bad) { gr.addColorStop(0, rgba(PAL.coral, .4)); gr.addColorStop(1, rgba(PAL.coral, .85)); }
        else { gr.addColorStop(0, rgba(PAL.blue, .55)); gr.addColorStop(1, rgba(PAL.cyan, .9)); }
        ctx.fillStyle = gr; rrect(tx, y - 8, wd, 16, 8); ctx.fill(); ctx.restore();
        if (isMat) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; softDot(tx + wd, y, 30, '255,205,110', Math.min(.6, .3 + .3 * done)); softDot(tx + wd / 2, y, 70, '255,205,110', .1 + .12 * done); ctx.restore(); }
      }
      if (isMat || isEll || r.bad || grow > .3) { ctx.save(); ctx.translate(bx + BW - 28, y); ctx.scale(rs, rs); tt(fmtPct(v), 0, 0, { font: F_MONO, size: 24, weight: isMat ? 700 : 400, color: isMat ? PAL.gold : col === PAL.coral ? '#ffb3bb' : '#cfe2ff', align: 'right', alpha: isMat || isEll || r.bad ? 1 : grow }); ctx.restore(); }
      ctx.restore(); GA = GA0;
    });
    { const tk = tx + clamp(.41 / BAR_MAX) * tw; ctx.save(); ctx.globalAlpha = aB * tickIn * (.45 + .55 * Math.max(done, hitP)); ctx.strokeStyle = PAL.mint; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tk, y0 - 14); ctx.lineTo(tk, y0 + 14); ctx.stroke(); ctx.restore(); }
    if (tAns * ansOut > .02) {                                      // the true answer on its row (compare beat)
      const a = tAns * ansOut; ctx.save(); ctx.globalAlpha = a * aB; ctx.strokeStyle = rgba(PAL.mint, .9); ctx.lineWidth = 2.5; rrect(bx + 14, y0 - 17, BW - 28, 34, 12); ctx.stroke(); ctx.restore();
      GA = aB; pill('✓ 正确答案 · the answer', tx + 270, y0, 24, rgba(PAL.mint, .95), '#b5ffe0', a); GA = aB;
    }
    ctx.restore();

    // ================= RIGHT: loss panel
    const step_ = Math.round(uq * 1000) * 1000, ly0 = 0;
    const tExp = sstep(6.95, 7.4, lt) * (1 - sstep(ST[1] + .1, ST[1] + .35, lt)), tForm = sstep(ST[1] + .4, ST[1] + .75, lt) * (1 - sstep(B_OUT0, B_OUT1 + .05, lt));
    const tGauge = eout(clamp((lt - 9.4) / .55)), tOne = sstep(ST[3] + .5, ST[3] + .9, lt) * (1 - sstep(B_OUT0, B_OUT1 + .05, lt));
    const tCur = sstep(B_OUT1 + .1, B_OUT1 + .65, lt), tLoss = sstep(ST[1] + .4, ST[1] + .75, lt);
    GA = aB; ctx.save(); ctx.globalAlpha = aB; ctx.translate(0, ly0);
    glassPanel(BX, LY, BW, LH, aB, PAL.coral, Math.max(flashL * .5, tGauge * (1 - sstep(ST[2], ST[2] + .4, lt)) * .5));
    const tcol = lt < CG ? mixHex(PAL.coral, PAL.coral, 0) : mixHex(PAL.coral, PAL.mint, clamp(b * 1.1));
    tt('LOSS', BX + 30, LY + 42, { font: F_UI, size: 30, weight: 700, ls: 4, color: tLoss > .5 || lt >= CG ? tcol : LBL, align: 'left' });
    tt(Lq.toFixed(1), BX + 150, LY + 42, { font: F_MONO, size: 42, weight: 700, color: tcol, align: 'left', alpha: tLoss });
    tt('STEP', BX + 255, LY + 44, { font: F_UI, size: 24, weight: 600, ls: 3, color: LBL, align: 'left', alpha: tCur });
    tt(fmtInt(step_), BX + 506, LY + 44, { font: F_MONO, size: 30, weight: 700, color: '#fff', align: 'right', alpha: tCur });
    tt('/ 1,000,000', BX + BW - 22, LY + 46, { font: F_MONO, size: 24, color: LBL, align: 'right', alpha: tCur });
    // B: explainer, then the formula with a gauge
    if (tExp > .01) { tt('损失 · loss', BX + BW / 2, LY + 120, { font: F_UI, size: 36, weight: 700, color: '#fff', alpha: tExp });
      tt('= 猜得有多离谱', BX + BW / 2, LY + 166, { font: F_UI, size: 30, weight: 600, color: LBL, alpha: tExp });
      tt('how far off the guess is', BX + BW / 2, LY + 206, { font: F_UI, size: 26, color: LBL, alpha: tExp * .9 }); }
    if (tForm > .01) {
      tt('−ln P(mat) = −ln 0.01 = 4.6', BX + BW / 2, LY + 108, { font: F_MONO, size: 32, weight: 700, color: '#fff', alpha: tForm });
      const gx0 = BX + 60, gx1 = BX + BW - 60, gy = LY + 156;
      ctx.save(); ctx.globalAlpha = tForm * aB; ctx.fillStyle = 'rgba(160,200,255,.12)'; rrect(gx0, gy - 13, gx1 - gx0, 26, 13); ctx.fill();
      const gw = (gx1 - gx0) * clamp(4.6 / 5) * tGauge; if (gw > 2) { const gr = ctx.createLinearGradient(gx0, 0, gx0 + gw, 0); gr.addColorStop(0, '#b3374f'); gr.addColorStop(1, PAL.coral); ctx.fillStyle = gr; rrect(gx0, gy - 13, gw, 26, 13); ctx.fill(); }
      ctx.fillStyle = 'rgba(200,220,255,.5)'; for (let i = 0; i <= 5; i++) ctx.fillRect(gx0 + (gx1 - gx0) * i / 5 - 1, gy + 17, 2, 8); ctx.restore();
      for (let i = 0; i <= 5; i += 1) tt(String(i), gx0 + (gx1 - gx0) * i / 5, gy + 44, { font: F_MONO, size: 24, color: LBL, alpha: tForm * .85 });
    }
    if (tOne > .01) { tt('一步之后 · after one step:  4.61 → 4.60', BX + BW / 2, LY + LH - 34, { font: F_UI, size: 28, weight: 600, color: '#d9cbff', alpha: tOne }); }
    if (tCur > .01) {
      ctx.save(); ctx.globalAlpha = aB * tCur; ctx.lineWidth = 1;
      for (const L of [2, 4]) { const y = ly(L); ctx.strokeStyle = 'rgba(160,200,255,.14)'; ctx.beginPath(); ctx.moveTo(PX0, y); ctx.lineTo(PX1, y); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(160,200,255,.3)'; ctx.beginPath(); ctx.moveTo(PX0, PY0 - 10); ctx.lineTo(PX0, PY1); ctx.lineTo(PX1, PY1); ctx.stroke(); ctx.restore();
      for (const L of [2, 4]) tt(String(L), PX0 - 16, ly(L), { font: F_MONO, size: 24, color: LBL, align: 'right', alpha: tCur });
      tt('训练步数（快进）· training steps, time-lapse →', (PX0 + PX1) / 2, LY + LH - 26, { font: F_UI, size: 24, color: LBL, alpha: tCur });
      ctx.save(); ctx.globalAlpha = aB * tCur; ctx.setLineDash([8, 8]); ctx.strokeStyle = 'rgba(94,242,176,.4)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PX0, ly(LF)); ctx.lineTo(PX1, ly(LF)); ctx.stroke(); ctx.restore();
      tt('target ≈ 0.9', PX0 + 10, ly(LF) + 18, { font: F_UI, size: 24, color: '#9ff3cf', align: 'left', alpha: tCur });
      ctx.save(); ctx.globalAlpha = aB * tCur; ctx.setLineDash([3, 8]); ctx.strokeStyle = `rgba(190,210,255,${.34 * (1 - sstep(.3, .55, u))})`; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i <= 50; i++) { const uu = i / 50; i ? ctx.lineTo(lx(uu), ly(exLoss(uu))) : ctx.moveTo(lx(uu), ly(exLoss(uu))); } ctx.stroke(); ctx.restore();
      const N = 240, n = Math.max(1, Math.floor(u * N)), pts = [];
      for (let i = 0; i <= n; i++) { const uu = i === n ? u : i / N; pts.push([lx(uu), ly(lossAt(uu))]); }
      ctx.save(); ctx.globalAlpha = aB * tCur; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      if (pts.length > 1) {
        const fg = ctx.createLinearGradient(0, ly(4.6), 0, ly(1.0)); fg.addColorStop(0, 'rgba(255,107,122,.28)'); fg.addColorStop(1, 'rgba(95,227,255,.02)');
        ctx.beginPath(); ctx.moveTo(pts[0][0], PY1); pts.forEach(p => ctx.lineTo(p[0], p[1])); ctx.lineTo(pts[pts.length - 1][0], PY1); ctx.closePath(); ctx.fillStyle = fg; ctx.fill();
        const sg = ctx.createLinearGradient(PX0, 0, PX1, 0); sg.addColorStop(0, PAL.coral); sg.addColorStop(.35, PAL.pink); sg.addColorStop(1, PAL.cyan);
        ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
        ctx.strokeStyle = sg; ctx.globalAlpha = .22 * aB * tCur; ctx.lineWidth = 9; ctx.stroke(); ctx.globalAlpha = aB * tCur; ctx.lineWidth = 3.2; ctx.stroke();
      }
      { const hp = pts[pts.length - 1]; ctx.setLineDash([4, 7]); ctx.strokeStyle = 'rgba(200,215,240,.3)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PX0, hp[1]); ctx.lineTo(hp[0], hp[1]); ctx.stroke(); ctx.setLineDash([]);
        ctx.globalCompositeOperation = 'lighter'; const rgb = tcol.slice(4, -1); softDot(hp[0], hp[1], 26, rgb, .55);
        ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = tcol; ctx.beginPath(); ctx.arc(hp[0], hp[1], 6, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.5; ctx.stroke(); }
      ctx.restore();
      const kc = sstep(T_END + .05, T_END + .5, lt);
      if (kc > .01) {
        const cx_ = PX0 + 380, cy_ = ly(LF) - 60 + (1 - eout(kc)) * 12, lab = 'converged', w = measure(lab, 24, F_UI, 700) + 62;
        ctx.save(); ctx.globalAlpha = aB * kc; rrect(cx_ - w / 2, cy_ - 19, w, 38, 19); ctx.fillStyle = 'rgba(5,22,20,.92)'; ctx.fill(); ctx.strokeStyle = rgba(PAL.mint, .95); ctx.lineWidth = 2; ctx.stroke();
        ctx.lineWidth = 3.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = PAL.mint; ctx.beginPath(); ctx.moveTo(cx_ - w / 2 + 15, cy_ + 1); ctx.lineTo(cx_ - w / 2 + 21, cy_ + 7); ctx.lineTo(cx_ - w / 2 + 32, cy_ - 7); ctx.stroke(); ctx.restore();
        tt(lab, cx_ + 12, cy_ + 1, { font: F_UI, size: 24, weight: 700, color: '#b5ffe0', alpha: kc });
      }
    }
    ctx.restore();
    GA = 1;

    // ================= connectors between the network and the panels (gold: guess to bars, coral: error back to the output)
    {
      const A0 = [mp[0] + 14, mp[1] + 2], A1 = [1075, mp[1] - 40], A2 = [BX + 6, BY + 100];
      const B0 = [BX + 6, LY + 150], B1 = [1060, LY + 90], B2 = [mp[0] + 10, mp[1] + 16];
      const ga = sstep(8.2, 8.8, lt), ca = sstep(ST[2], ST[2] + .5, lt);
      ctx.save(); ctx.lineWidth = 2.5;
      ctx.globalAlpha = ga * aB; ctx.strokeStyle = 'rgba(255,214,130,.6)'; ctx.beginPath(); ctx.moveTo(A0[0], A0[1]); ctx.quadraticCurveTo(A1[0], A1[1], A2[0], A2[1]); ctx.stroke();
      ctx.globalAlpha = ca * aB; ctx.strokeStyle = 'rgba(255,107,122,.6)'; ctx.beginPath(); ctx.moveTo(B0[0], B0[1]); ctx.quadraticCurveTo(B1[0], B1[1], B2[0], B2[1]); ctx.stroke(); ctx.restore();
      GA = ca * aB; pill('error', BX + 6, LY + 150, 24, rgba(PAL.coral, .9), '#ff9ba6', 1, 600); GA = 1;
      comet(A0, A1, A2, (lt - 8.2) / .4, '255,214,130', 1);
      comet(B0, B1, B2, (lt - ST[2]) / .4, '255,110,125', 1);
      CS.forEach((s, c) => { const P = CP[c]; comet(A0, A1, A2, (lt - (s + .27 * P)) / (.19 * P), '255,214,130', 1, .3); comet(B0, B1, B2, (lt - (s + .46 * P)) / (.16 * P), '255,110,125', 1, .3); });
      comet(A0, A1, A2, (lt - (T_END - .45)) / .45, '255,214,130', 1, .3);
    }

    // ================= energy: sparks drifting up, a flare when the loss settles
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const SP = SPARKS, ns = Math.floor(10 + 90 * sstep(13.8, T_END, lt) + 30 * sstep(.5, 3, lt)), spc = ['120,220,255', '255,210,122', '255,120,150', '170,150,255'];
    for (let i = 0; i < ns; i++) {
      const s = SP[i], y = s.y - ((lt * s.sp * (.7 + .6 * en) + s.p * 600) % 560), yy = y < 150 ? y + 560 : y, a = (.25 + .5 * Math.sin(lt * 3 + s.p * 20) ** 2) * sstep(150, 220, yy) * (1 - sstep(700, 790, yy));
      ctx.fillStyle = `rgba(${spc[s.g]},${a * .7})`; ctx.fillRect(s.x + Math.sin(lt + s.p * 9) * 8, yy, s.s, s.s);
    }
    if (done > 0) {
      const k = clamp((lt - T_END) / 1.0), mx = BX + BAR_TX + clamp(.41 / BAR_MAX) * BAR_TW, my = BY + 96;
      const sg = ctx.createLinearGradient(BX + 20, 0, BX + BW - 20, 0); sg.addColorStop(0, 'rgba(255,215,140,0)'); sg.addColorStop(.35, `rgba(255,225,160,${.55 * (1 - k)})`); sg.addColorStop(1, 'rgba(255,215,140,0)'); ctx.fillStyle = sg; ctx.fillRect(BX + 20, my - 1.5, BW - 40, 3);
      softDot(mx, my, 60 + 40 * k, '255,205,110', .4 * (1 - k));
      for (let i = 0; i < 26; i++) { const an = i / 26 * TAU + hash1(i) * .5, r = 24 + (40 + 110 * hash1(i * 3.1)) * eout(k); ctx.fillStyle = `rgba(255,215,140,${.9 * (1 - k)})`; ctx.fillRect(mx + Math.cos(an) * r, my + Math.sin(an) * r * .8, 3, 3); }
      softDot(mp[0], mp[1], 50, '255,200,110', .08 * (1 - k));
    }
    ctx.restore();
  } });
