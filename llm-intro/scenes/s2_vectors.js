// s2_vectors: IDs -> vectors (embeddings) in a meaning space.  Global 0:25 - 0:40 (start bar 10, len 6 = 15 s).
// Page A (0-6.6)  an ID becomes a vector.   0 the big 3797 exactly as scene 1 ends | 0.5-1.4 it glides left | 1.1-2.4 fan lines + the 6-number column build (cat)
//                 2.7-3.5 two small columns (dog, car) join | HOLD 3.5-5.8 | 5.8-6.3 furniture fades, 6.1-6.875 the numbers fly into glowing points (beat 11)
// Page B (6.6-15) meaning space.            6.875-8.4 the cloud (dust first, then clusters, labels, neighbour lines) | HOLD 8.5-11 slow rotation only
//                 10.8-12.4 a slow glide to the royalty cluster | 11.4-12.5 king - man + woman arrows + equation, queen lands on beat 20 (12.5) | HOLD 12.6-14.8
const R = mulberry(20260002);
const gauss = () => Math.sqrt(-2 * Math.log(1 - R())) * Math.cos(TAU * R());

const CL = [PAL.cyan, PAL.pink, PAL.violet, PAL.amber];             // animals, places to sit, royalty, (car: on its own)
const CL_NAME = [['动物', 'animals'], ['可坐之处', 'places to sit'], ['王室与人', 'royalty & people']];
// word, cluster, world position [x,y,z], label side (1 right, -1 left, 0 below, 2 above)
const WORDS = [
  ['cat', 0, [-3.2, 0.1, 0.3], 1], ['dog', 0, [-4.2, -0.35, -0.2], -1], ['lion', 0, [-2.95, 1.25, -0.4], 1], ['tiger', 0, [-4.15, 1.2, 0.5], -1],
  ['mat', 1, [-0.9, -1.95, 0.6], -1], ['rug', 1, [0.0, -2.5, 0.1], 1], ['sofa', 1, [1.0, -1.5, 0.9], 1], ['couch', 1, [1.5, -2.45, 0.0], 1], ['bed', 1, [0.25, -1.1, -0.6], 1], ['floor', 1, [-1.7, -1.2, -0.3], -1],
  ['man', 2, [2.75, -0.3, 0.0], -1], ['woman', 2, [3.05, 0.75, 0.2], -1], ['king', 2, [4.45, -0.25, -0.3], 1], ['queen', 2, [4.95, 0.68, 0.0], 1],
  ['car', 3, [0.1, 2.2, -0.1], 1],
].map(([w, c, p, s]) => ({ w, c, p, s }));
const WI = Object.fromEntries(WORDS.map((o, i) => [o.w, i]));
const CAT = WORDS[WI.cat].p, MAN = WORDS[WI.man].p, WOMAN = WORDS[WI.woman].p, KING = WORDS[WI.king].p, QUEEN = WORDS[WI.queen].p;
const CEN = [[-3.6, 0.55, 0.1], [0, -1.8, 0.2], [3.75, 0.25, -0.1]];
const ROYAL_FOC = [3.85, 0.22, -0.1];
const CAT_NEIGH = [['dog', 0.82], ['lion', 0.79], ['tiger', 0.76]];     // lion sits closer to cat than tiger, so it carries the higher value
const MAT_NEIGH = [['rug', 0.84], ['floor', 0.78]];            // values fall with 3D distance across the whole cloud (cat-dog 1.21 -> .82, mat-rug 1.17 -> .84, cat-lion 1.37 -> .79, mat-floor 1.42 -> .78, cat-tiger 1.47 -> .76)

// unlabelled cloud: vocabulary points (dim) + extra members around each cluster
const DUST = [];
for (let c = 0; c < 3; c++) for (let i = 0; i < 30; i++) {
  const o = CEN[c], sp = [.95, 1.0, .95][c];
  DUST.push({ p: [o[0] + gauss() * sp * 1.0, o[1] + gauss() * sp * .6, o[2] + gauss() * sp * .6], c, a: .35 + R() * .4, s: 1.4 + R() * 1.8, ph: R() * TAU });
}
while (DUST.length < 300) {
  const p = [(R() * 2 - 1) * 5.2, (R() * 2 - 1) * 3.0, (R() * 2 - 1) * 2.6];
  if (WORDS.some(o => Math.hypot(o.p[0] - p[0], o.p[1] - p[1], o.p[2] - p[2]) < .7)) continue;
  DUST.push({ p, c: -1, a: .18 + R() * .35, s: 1.2 + R() * 1.6, ph: R() * TAU });
}
// the royalty cluster is drawn 1.4x larger (and nudged left) so the analogy parallelogram is big enough to read without a camera zoom
const RC = CEN[2].slice(), royT = p => { p[0] = RC[0] + (p[0] - RC[0]) * 1.4 - .3; p[1] = RC[1] + (p[1] - RC[1]) * 1.4; };
for (const o of WORDS) if (o.c === 2) royT(o.p);
for (const o of DUST) if (o.c === 2) royT(o.p);
royT(CEN[2]);
for (const a of [...WORDS.map(o => o.p), ...CEN, ROYAL_FOC, ...DUST.map(o => o.p)]) a[0] *= .99;   // (was 1.12 in the 60 s cut; narrower so every label of the royalty cluster fits inside the frame)
// the exact parallelogram corner king - man + woman; "queen" sits NEAR it, not on it (the analogy is approximate)
const QSUM = [KING[0] + WOMAN[0] - MAN[0], KING[1] + WOMAN[1] - MAN[1], KING[2] + WOMAN[2] - MAN[2]];
// when each cloud point appears (cat, dog, car are born from the three vector columns on beat 11; the rest unfolds around them)
const T_ARR = 6.875;
WORDS.forEach((o, i) => {
  const base = ['cat', 'dog', 'car'].includes(o.w) ? T_ARR - .2 : o.c === 0 ? 6.3 : o.c === 1 ? 6.45 : 6.6;
  o.t0 = base + (['cat', 'dog', 'car'].includes(o.w) ? 0 : (i % 5) * .05);
  o.tl = ['cat', 'dog', 'car'].includes(o.w) ? T_ARR + .25 : 7.3 + (i % 7) * .09;       // its label fades in only after the point has settled
});

// ---- page A: three vectors (only cat's is read out in full; every number is an example)
const VEC = [.21, -.64, .88, .05, -.37, .52];
const VDOG = [.18, -.58, .81, .12, -.30, .47];                        // dog is close to cat ...
const VCAR = [-.52, .33, -.14, .76, .41, -.66];                       // ... car is not
const fmtV = v => (v < 0 ? '−' : ' ') + Math.abs(v).toFixed(2);
const COL_Y = 278, COL_DY = 74;
const COLS = [
  { nm: 'cat', v: VEC, big: true, x: 662, size: 50, axis: 950, sc: 100, bl: 640, br: 1062, hue: HUES[1], t0: 1.5, step: .09, roll: .3 },
  { nm: 'dog', v: VDOG, x: 1140, size: 36, bl: 1118, br: 1270, hue: PAL.cyan, t0: 2.75, step: .05, roll: .2 },
  { nm: 'car', v: VCAR, x: 1330, size: 36, bl: 1308, br: 1460, hue: PAL.amber, t0: 3.05, step: .05, roll: .2 },
];
const rowStart = (c, i) => c.t0 + i * c.step, rowRev = (c, i) => Math.round((rowStart(c, i) + c.roll) * 30) / 30 + 1 / 60;   // the reveal sits midway between exported frames, so no frame shows scramble + true value together
const ID_X = 290, ID_Y = 470, ID_S = 104, G0 = .45, G1 = 1.65;          // the big ID glides from (960,470,210px) to (ID_X, ID_Y, ID_S)
const X0 = 5.55, X1 = 6.0;                                             // page A furniture fades
const P0 = 5.85, P1 = T_ARR;                                           // the numbers fly into points

const ambient = Array.from({ length: 46 }, () => ({ x: R() * W, y: 150 + R() * 740, z: .3 + R() * .7, p: R() * TAU, r: 1.6 + 3 * R() }));
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const colA = hex => hexA(hex);
function view(lt) {
  const foc = sstep(10.8, 12.6, lt);                                 // a slow, small drift toward the royalty cluster
  const g = sstep(6.0, 12.4, lt);
  return { yaw: -.5 + .26 * g + .012 * (lt - 6), pitch: .2 + .03 * Math.sin(lt * .5), foc,
    F: 1000 * lerp(.9, 1, eout(sstep(6.1, 8.4, lt))) * (1 + .05 * foc), cx: 960, cy: 452 - foc * 4 };
}
function P(v, vw) {                                                  // world point -> [x, y, depth]
  const q = [v[0] - vw.foc * .07 * ROYAL_FOC[0], v[1] - vw.foc * .07 * ROYAL_FOC[1], v[2] - vw.foc * .07 * ROYAL_FOC[2]];
  return proj(q, vw.yaw, vw.pitch, vw.cx, vw.cy, vw.F, 8.5);
}
const dep = z => clamp(.62 + .12 * z, .3, 1);                        // depth cue from camera-space z

function arrow2(a, b, col, lw, alpha, dash, gap = 0) {
  const L0 = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  if (gap > 0) { const g = Math.min(gap, L0 * .4); b = [b[0] - (b[0] - a[0]) / L0 * g, b[1] - (b[1] - a[1]) / L0 * g]; }   // stop short of the word's dot so the head stays visible
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), hs = 20;
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round';
  ctx.shadowColor = col; ctx.shadowBlur = 16; if (dash) ctx.setLineDash(dash);
  const ex = b[0] - Math.cos(ang) * hs * .6, ey = b[1] - Math.sin(ang) * hs * .6;
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(b[0], b[1]);
  ctx.lineTo(b[0] - Math.cos(ang - .38) * hs, b[1] - Math.sin(ang - .38) * hs); ctx.lineTo(b[0] - Math.cos(ang + .38) * hs, b[1] - Math.sin(ang + .38) * hs);
  ctx.closePath(); ctx.fill(); ctx.restore();
}
// similarity number on a line between two screen points, nudged to the side
function simLabel(a, b, k, val, col, alpha, side) {
  const mx = lerp(a[0], b[0], k), my = lerp(a[1], b[1], k), dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  const x = mx + (-dy / L) * 32 * side, y = my + (dx / L) * 32 * side;
  ctx.save(); ctx.globalAlpha = alpha * .78; ctx.fillStyle = 'rgba(4,6,18,.9)'; ctx.shadowColor = 'rgba(4,6,18,.9)'; ctx.shadowBlur = 8; rrect(x - 34, y - 18, 68, 36, 12); ctx.fill(); ctx.restore();   // small dark pill keeps the number clear of dust and lines
  text(val.toFixed(2), x, y + 1, { font: F_MONO, size: 24, weight: 600, color: col, alpha });
}
// one vector column (page A). a = furniture alpha (brackets, bars), n = number alpha
function vecColumn(c, lt, fa, fadeNum) {
  const ba = sstep(c.t0 - .15, c.t0 + .25, lt) * fa;
  if (ba > 0) {
    ctx.save(); ctx.globalAlpha = ba * .9; ctx.strokeStyle = 'rgba(190,225,255,.75)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    const by0 = COL_Y - 40, by1 = COL_Y + 6 * COL_DY + 40;
    for (const [bx, sg] of [[c.bl, 1], [c.br, -1]]) { ctx.beginPath(); ctx.moveTo(bx + sg * 16, by0); ctx.lineTo(bx, by0); ctx.lineTo(bx, by1); ctx.lineTo(bx + sg * 16, by1); ctx.stroke(); }
    ctx.restore();
  }
  for (let i = 0; i < 7; i++) {
    const k3 = clamp((lt - rowStart(c, i)) / .3); if (k3 <= 0) continue;
    const ty = COL_Y + i * COL_DY, rA = clamp(k3 * 2.5) * (c.big ? 1 : .96);
    if (i === 6) { text('⋮', (c.bl + c.br) / 2, ty, { font: F_MONO, size: c.big ? 58 : 44, color: PAL.dim, alpha: rA * fadeNum(i) }); continue; }
    const v = c.v[i], rev = lt >= rowRev(c, i), qk = Math.floor(lt * 10 + .5);        // scramble ticks sit midway between exported frames, so no frame ever overprints two values
    const sv = rev ? v : (hash1(i * 31 + qk * 3.7 + c.x) * (hash1(i * 13 + qk + c.x) < .5 ? 1 : -1));
    const flash = rev ? 1 - sstep(rowRev(c, i), rowRev(c, i) + .3, lt) : 0;
    const pos = sv >= 0, colr = pos ? PAL.cyan : PAL.violet, na = rA * fadeNum(i);
    text(fmtV(sv), c.x, ty, { font: F_MONO, size: c.size, weight: 500, color: '#fff', alpha: na, align: 'left', glow: colr, blur: 16 + 30 * flash });
    if (c.big) {
      const bw = Math.abs(sv) * c.sc, ax = c.axis;                                     // signed bar always matches the number shown
      ctx.save(); ctx.globalAlpha = rA * fa; ctx.fillStyle = rgba(colr, .85); ctx.shadowColor = colr; ctx.shadowBlur = 14;
      rrect(pos ? ax : ax - bw, ty - 9, bw, 18, 6); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(200,225,255,.5)'; ctx.fillRect(ax - 1, ty - 20, 2, 40); ctx.restore();
    }
  }
  const chA = sstep(c.t0 + .3, c.t0 + .7, lt) * fa;
  if (chA > 0) chip(c.nm, (c.bl + c.br) / 2, 815, { size: 34, color: c.hue, alpha: chA, glow: 14 });
}

scene({
  id: 'vectors', start: 10, len: 6, fi: .01, fo: .2, mb: 2, ch: ['02', '向量', 'VECTORS'], bloom: .8,
  subs: [[.4, 6.4, '编号本身没有意义——模型把每个编号变成一串数字，叫向量', 'An ID means nothing by itself, so each token becomes a vector: a long list of numbers'],
    [6.8, 11.2, '意思相近的词，向量也相近，在空间里靠得近', 'Similar meanings get similar vectors, so they sit close together'],
    [11.4, 14.8, '甚至能做“算术”：国王 − 男人 + 女人 ≈ 女王', 'Even arithmetic works: king − man + woman ≈ queen']],
  sfx: [[.5, 'whoosh', { dur: .8 }],
    ...VEC.map((_, i) => [rowRev(COLS[0], i), 'blip', { midi: 72 + [0, 3, 7, 10, 12, 15][i] }]),
    [2.75, 'pop'], [3.05, 'pop'],
    [5.95, 'swish', { pitch: 1.2 }], [T_ARR, 'shimmer'], [T_ARR + .02, 'sparkle', { dur: 1.4 }],
    [7.85, 'ping', { midi: 76 }], [7.97, 'ping', { midi: 79 }], [8.09, 'ping', { midi: 83 }], [8.2, 'ping', { midi: 81 }], [8.3, 'ping', { midi: 84 }],
    [10.8, 'whoosh', { dur: 1.4 }],
    [11.4, 'blip', { midi: 69 }], [11.875, 'blip', { midi: 72 }], [12.1, 'blip', { midi: 76 }], [12.3, 'blip', { midi: 79 }], [12.5, 'chime', { midi: 88 }], [12.5, 'shimmer']],
  cam: (lt, d) => ({ z: 1 + .03 * lt / d, x: 6 * Math.sin(lt * .5), y: 4 * Math.sin(lt * .4) }),   // x and y start at 0 so frame 0 matches the last frame of scene 1
  draw(lt, d, T) {
    const vw = view(lt);
    const tk = sstep(.5, 4.5, lt);                                   // continue scene 1's nebula (same time base and cobalt tint) and ease it to violet
    glDraw(0, { time: T * .9, tint: [lerp(.04, .2, tk), lerp(.17, .11, tk), lerp(.46, .5, tk)], amp: lerp(.85, .8, tk) });
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const bgg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 800); bgg.addColorStop(0, `rgba(60,40,140,${.16 * tk})`); bgg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bgg; ctx.fillRect(0, 0, W, H);
    // a few faint motes drifting in depth (never leaves a long hold dead)
    ctx.fillStyle = 'rgb(140,190,255)';
    for (const m of ambient) { const x = ((m.x + lt * 7 * m.z) % W + W) % W, y = m.y + 12 * Math.sin(lt * .5 + m.p), r = m.r * m.z; ctx.globalAlpha = .2 * sstep(.4, 1.6, lt) * (.6 + .4 * Math.sin(lt * 1.2 + m.p)); ctx.fillRect(x - r / 2, y - r / 2, r, r); }
    ctx.restore();

    const dimK = sstep(10.9, 11.5, lt), dimD = 1 - .6 * dimK, lblK = 1 - .45 * dimK;

    // ======================================================= page A: 3797 -> vector column(s)
    if (lt < 6.95) {
      const k = eSineA(clamp((lt - G0) / (G1 - G0))), exitK = sstep(X0, X1, lt), fa = 1 - exitK;
      const nx = lerp(960, ID_X, k), ny = lerp(470, ID_Y, k), ns = lerp(210, ID_S, k), sc = ns / 210;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      // the glow of scene 1's last frame (violet halo + cyan core), carried along with the number
      const pulse = .5 + .5 * Math.sin(lt * 7);
      glowDot(nx, ny, (420 * (1 - .45 * k) + 40), 'rgba(120,110,255,A)', .12 * fa);
      glowDot(nx, ny, (340 * (1 - .45 * k) + 20), 'rgba(80,200,255,A)', (.16 + .02 * pulse * sstep(.3, 1, lt)) * fa);
      // sparks orbiting the number (fade in after the cut, so frame 0 is clean)
      for (let i = 0; i < 40; i++) {
        const ph = i * 2.399 + lt * (.25 + (i % 5) * .05), rr = 120 + (i % 7) * 22 + 24 * Math.sin(lt * 1.3 + i);
        const sx = nx + Math.cos(ph) * rr * 1.7 * (.6 + .4 * sc), sy = ny + Math.sin(ph) * rr * .55;
        ctx.fillStyle = `rgba(120,225,255,${(.25 + .3 * ((i * 7) % 5) / 5) * fa * sstep(.4, 1.2, lt)})`; ctx.beginPath(); ctx.arc(sx, sy, 1.4, 0, TAU); ctx.fill();
      }
      ctx.restore();
      // the ID itself: exactly scene 1's last frame at lt 0 (white-cyan #8fe4ff, weight 700, cyan glow), then it shrinks and slides left
      if (fa > 0) {
        const gb = 14 + 20 * sc;
        text('3797', nx, ny, { font: F_MONO, size: ns, weight: 700, color: '#8fe4ff', alpha: fa, glow: PAL.cyan, blur: gb });
        text('cat', nx, ny + lerp(150, 90, k), { font: F_UI, size: 34, weight: 700, color: '#d9ccff', alpha: fa * (lt < 1 ? 1 - sstep(.45, .65, lt) : sstep(1.5, 1.9, lt)), ls: 6, glow: PAL.violet, blur: 12 });
        text('编号 · ID  (e.g.)', ID_X, ID_Y - 92, { font: F_UI, size: 28, weight: 600, color: '#d6e6ff', ls: 3, alpha: sstep(1.7, 2.0, lt) * fa });
      }
      // fan lines from the ID to the rows of cat's column
      const c0 = COLS[0], fanA = sstep(1.2, 1.4, lt) * fa;
      if (fanA > 0) {
        const sx = nx + 2.1 * ns * .5 * .6 + 54 * sc + 14, sy = ny;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 2.8;
        for (let i = 0; i < 7; i++) {
          const k2 = eexpo(clamp((lt - 1.3 - i * .05) / .5)); if (k2 <= 0) continue;
          const ty = COL_Y + i * COL_DY, ex = c0.bl - 12;
          ctx.strokeStyle = `rgba(150,230,255,${.62 * k2 * fa})`;
          ctx.beginPath(); ctx.moveTo(sx, sy);
          for (let s = 1; s <= 24; s++) { const u = s / 24 * k2, e = eio(u); ctx.lineTo(lerp(sx, ex, u), lerp(sy, ty, e)); }
          ctx.stroke();
          const pu = ((lt * .7 + i * .17) % 1) * k2, pe = eio(pu);                    // travelling glints die out before the bracket
          glowDot(lerp(sx, ex, pu), lerp(sy, ty, pe), 11, 'rgba(120,230,255,A)', .5 * k2 * fa * (1 - sstep(.45, .9, pu)));
        }
        ctx.restore();
      }
      // the columns
      const fadeNum = (j, i) => 1 - sstep(P0 + i * .04 + j * .02 + .08, P0 + i * .04 + j * .02 + .3, lt);   // a number lights up and hands over to its particle
      COLS.forEach((c, j) => vecColumn(c, lt, fa, i => fadeNum(j, i)));
      // labels
      const vA = sstep(1.9, 2.3, lt) * fa;
      text('向量 · vector', (COLS[0].bl + COLS[0].br) / 2, 190, { font: F_UI, size: 34, weight: 700, color: '#dff6ff', alpha: vA, ls: 2, glow: PAL.cyan, blur: 18 });
      const lA = sstep(2.3, 2.7, lt) * fa, lx = 1485, yb = COL_Y + 6 * COL_DY;
      if (lA > 0) {
        ctx.save(); ctx.globalAlpha = lA * .85; ctx.strokeStyle = 'rgba(190,225,255,.85)'; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(lx - 8, COL_Y - 40); ctx.quadraticCurveTo(lx + 6, COL_Y - 40, lx + 6, COL_Y - 20); ctx.lineTo(lx + 6, 500 - 14); ctx.quadraticCurveTo(lx + 6, 500, lx + 20, 500);
        ctx.quadraticCurveTo(lx + 6, 500, lx + 6, 514); ctx.lineTo(lx + 6, yb + 20); ctx.quadraticCurveTo(lx + 6, yb + 40, lx - 8, yb + 40); ctx.stroke(); ctx.restore();
        text('数千维', lx + 40, 460, { size: 40, weight: 700, color: '#fff', alpha: lA, align: 'left', glow: PAL.cyan, blur: 14 });
        text('thousands of', lx + 40, 512, { font: F_UI, size: 28, weight: 600, color: '#d6e6ff', alpha: lA, align: 'left' });
        text('dimensions', lx + 40, 548, { font: F_UI, size: 28, weight: 600, color: '#d6e6ff', alpha: lA, align: 'left' });
        const nA = sstep(2.5, 2.9, lt) * fa;
        text('示意数值', lx + 40, 656, { size: 26, weight: 600, color: '#b8d4ff', alpha: nA, align: 'left' });
        text('illustrative numbers', lx + 40, 690, { font: F_UI, size: 24, weight: 500, color: '#b8d4ff', alpha: nA, align: 'left' });
      }
      // the numbers collapse: bright particles fly from each row into the point of that word
      if (lt > P0) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        COLS.forEach((c, j) => {
          const tgt = P(WORDS[WI[c.nm]].p, vw);
          for (let i = 0; i < 6; i++) {
            const sy0 = COL_Y + i * COL_DY, sx0 = c.x + (c.big ? 60 : 40), u = clamp((lt - P0 - i * .04 - j * .02) / (P1 - P0 - .25)), sg = i % 2 ? 1 : -1;
            const at = uu => { const e = eio(uu); return [lerp(sx0, tgt[0], e), lerp(sy0, tgt[1], e) - Math.sin(uu * PI) * 60 * sg]; };
            if (u >= 1 || u <= 0) continue;
            for (let tr = 3; tr >= 0; tr--) { const p = at(Math.max(0, u - tr * .025)); glowDot(p[0], p[1], 9 + (3 - tr) * 2.4, 'rgba(150,235,255,A)', (.06 + .035 * (3 - tr)) * sstep(0, .18, u) * (1 - .8 * sstep(.6, 1, u))); }
            const p = at(u), ra = sstep(0, .18, u); glowDot(p[0], p[1], 11 + 4 * ra, 'rgba(255,238,200,A)', .26 * ra * (1 - .5 * sstep(.6, 1, u)));
          }
          const fl = sstep(P1 - .25, P1, lt) * (1 - sstep(P1, P1 + .45, lt));
          glowDot(tgt[0], tgt[1], 70, 'rgba(255,225,170,A)', .2 * fl);
        });
        ctx.restore();
      }
    }

    // ======================================================= page B: the meaning space
    if (lt > 5.7) {
      const dustK = sstep(5.6, 7.0, lt), early = 1 + .7 * (1 - sstep(6.9, 7.9, lt));         // brighter while the cloud is still unfolding
      const pw = WORDS.map(o => ({ o, s: P(o.p, vw) }));
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      // cluster halos
      for (let c = 0; c < 3; c++) {
        const s = P(CEN[c], vw), hk = sstep(6.2 + c * .25, 7.4 + c * .25, lt), r = (c === 2 ? 270 : 300) * (vw.F / 1000) * (.6 + .4 * hk), a = (c === 2 ? 1 : dimD) * .2 * hk * early;
        if (a > .003) glowDot(s[0], s[1], r, colA(CL[c]), a);
      }
      // dust: the rest of the vocabulary
      for (const dd of DUST) {
        const s = P(dd.p, vw), dp = dep(s[2]), dm = dd.c === 2 ? 1 : dimD * (dd.c < 0 ? .75 : 1) + (dd.c < 0 ? .25 * (1 - dimD) : 0);
        if (dm < .01 || s[0] < -20 || s[0] > W + 20 || s[1] < -20 || s[1] > H + 20) continue;
        const tw = .82 + .18 * Math.sin(lt * 1.7 + dd.ph), ka = dd.c < 0 ? dustK : dustK * sstep(6.7, 7.7, lt) + dustK * .3 * (1 - sstep(6.7, 7.7, lt));
        ctx.fillStyle = `rgba(${dd.c < 0 ? '175,195,255' : dd.c === 0 ? '120,225,255' : dd.c === 1 ? '255,140,225' : '185,160,255'},${Math.min(1, dd.a * 3) * dp * dm * ka * early * tw})`;
        const rr = Math.min(4.6, dd.s * dp * 2.9 * (vw.F / 1000)); ctx.beginPath(); ctx.arc(s[0], s[1], Math.max(.9, rr * .5), 0, TAU); ctx.fill();
      }
      // neighbour lines: cat -> dog / lion / tiger (and far-away car), mat -> rug / floor; each with its similarity value
      const nOut = 1 - sstep(10.7, 11.2, lt);
      const lines = [...CAT_NEIGH.map(([n, sim], i) => ['cat', n, sim, 7.85 + i * .12, 'rgba(150,235,255,', 1, 1]),
        ...MAT_NEIGH.map(([n, sim], i) => ['mat', n, sim, 8.2 + i * .1, 'rgba(255,170,235,', i ? -1 : 1, 1]), ['cat', 'car', .11, 8.4, 'rgba(255,200,130,', 1, .5]];
      for (const [a, n, sim, t0, rgb, side, w] of lines) {
        if (lt < t0 || nOut <= 0) continue;
        const k = eexpo(clamp((lt - t0) / .4)), cs = pw[WI[a]].s, t = pw[WI[n]].s;
        const ex = lerp(cs[0], t[0], k), ey = lerp(cs[1], t[1], k);
        ctx.strokeStyle = rgb + (.85 * nOut * w) + ')'; ctx.lineWidth = 2.6 * (w < 1 ? .7 : 1); ctx.shadowColor = rgb + '1)'; ctx.shadowBlur = 14; if (w < 1) ctx.setLineDash([9, 9]);
        ctx.beginPath(); ctx.moveTo(cs[0], cs[1]); ctx.lineTo(ex, ey); ctx.stroke(); ctx.shadowBlur = 0; ctx.setLineDash([]);
        glowDot(t[0], t[1], 30, rgb + 'A)', .42 * nOut * k * w);
      }
      ctx.restore();
      for (const [a, n, sim, t0, rgb, side, w] of lines) {
        const k = sstep(t0 + .2, t0 + .42, lt) * nOut;
        if (k > 0) simLabel(pw[WI[a]].s, pw[WI[n]].s, a === 'cat' ? (n === 'car' ? .5 : .46) : .5, sim, a === 'cat' ? (n === 'car' ? '#ffe0b0' : '#bff4ff') : '#ffd0f2', k * (w < 1 ? .85 : 1), side);
      }

      // analogy arrows
      const aA = sstep(11.3, 11.45, lt);
      if (aA > 0) {
        const m = P(MAN, vw), w = P(WOMAN, vw), kg = P(KING, vw), qs = P(QSUM, vw);
        const ak = clamp((lt - 11.4) / .5), bk = clamp((lt - 11.75) / .45), ck = clamp((lt - 12.0) / .42), dk = clamp((lt - 12.05) / .42);
        const along = (a, b, k) => P(lerp3(a, b, eio(k)), vw);
        if (ak > 0) arrow2(m, along(MAN, KING, ak), PAL.violet, 3.5, aA, null, 26 * sstep(.6, 1, ak));
        if (bk > 0) arrow2(m, along(MAN, WOMAN, bk), PAL.pink, 3.5, aA, null, 26 * sstep(.6, 1, bk));
        if (ck > 0) arrow2(kg, along(KING, QSUM, ck), PAL.pink, 3, aA * .9, [10, 8]);           // king + (woman - man) lands near queen
        if (dk > 0) arrow2(w, along(WOMAN, QSUM, dk), PAL.violet, 3, aA * .9, [10, 8]);
        if (dk >= 1) {                                                                          // the exact sum point, drawn as a small dotted ring
          const qq = P(QUEEN, vw), ql = Math.hypot(qq[0] - qs[0], qq[1] - qs[1]) || 1, ux = (qq[0] - qs[0]) / ql, uy = (qq[1] - qs[1]) / ql, ra = sstep(12.4, 12.65, lt);
          ctx.save(); ctx.strokeStyle = 'rgba(255,232,175,.95)'; ctx.lineWidth = 2.4; ctx.setLineDash([4, 5]); ctx.globalAlpha = ra; ctx.shadowColor = PAL.gold; ctx.shadowBlur = 12;
          ctx.beginPath(); ctx.arc(qs[0], qs[1], 17, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 2.6;     // the sum lands on the ring; a short gold link joins it to the nearest word
          if (ql > 44) { ctx.beginPath(); ctx.moveTo(qs[0] + ux * 21, qs[1] + uy * 21); ctx.lineTo(qq[0] - ux * 17, qq[1] - uy * 17); ctx.stroke(); }
          ctx.restore();
        }
        const lA2 = sstep(11.75, 12.0, lt), lG = sstep(12.1, 12.35, lt);
        const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const m1 = mid(m, kg), m2 = mid(m, w);
        text('royalty', m1[0] + 8, m1[1] + 36, { font: F_UI, size: 28, weight: 500, color: '#d3c3ff', alpha: lA2 * aA, glow: 'rgba(2,4,14,.95)', blur: 10 });
        text('gender', m2[0] - 62, m2[1] + 6, { font: F_UI, size: 28, weight: 500, color: '#ffc4ee', alpha: lG * aA, glow: 'rgba(2,4,14,.95)', blur: 10 });
      }

      // queen lands (beat 20 = 12.5 s)
      if (lt > 12.5) {
        const q = P(QUEEN, vw), k = lt - 12.5, pulse = .85 + .15 * Math.sin(lt * 7);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        glowDot(q[0], q[1], 95 * pulse * eout(clamp(k / .5)), 'rgba(255,210,122,A)', .36);
        const ring = eout(clamp(k / .6)); ctx.strokeStyle = `rgba(255,220,150,${(1 - ring) * .8})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(q[0], q[1], 24 + ring * 86, 0, TAU); ctx.stroke();
        for (let i = 0; i < 26; i++) {
          const an = i * 2.399 + hash1(i) * 2, sp2 = 60 + hash1(i * 3.3) * 160, e = eout(clamp(k / (.9 + hash1(i * 7) * .8)));
          ctx.fillStyle = `rgba(255,225,160,${(1 - e) * .9})`; ctx.beginPath(); ctx.arc(q[0] + Math.cos(an) * sp2 * e, q[1] + Math.sin(an) * sp2 * e - 12 * e, 2, 0, TAU); ctx.fill();
        }
        // light keeps flowing along the two dashed edges toward queen
        for (const src of [KING, WOMAN]) {
          const u = clamp(((lt - 12.5) * .9 + (src === KING ? 0 : .5)) % 1), p = P(lerp3(src, QSUM, eio(u)), vw);
          glowDot(p[0], p[1], 22, 'rgba(255,225,170,A)', .6 * Math.sin(u * PI));
        }
        ctx.restore();
      }

      // words
      const sorted = pw.slice().sort((a, b) => a.s[2] - b.s[2]);
      for (const { o, s } of sorted) {
        const isRoy = o.c === 2, dmD = isRoy ? 1 : dimD, dmL = isRoy ? 1 : lblK, dp = dep(s[2]);
        const isCat = o.w === 'cat', isQ = o.w === 'queen', big = isCat;
        const trio = o.t0 < T_ARR, ap = trio ? .3 * sstep(P0, P0 + .5, lt) + .7 * sstep(T_ARR - .2, T_ARR + .1, lt) : .6 * sstep(o.t0, o.t0 + .5, lt) + .4 * sstep(T_ARR, T_ARR + .6, lt);                                      // point alpha
        if (ap <= 0 || (!isRoy && dimD <= .004) || s[0] < -150 || s[0] > W + 150 || s[1] < -150 || s[1] > H + 150) continue;
        const la = sstep(o.tl, o.tl + .3, lt) * dmL * (isCat ? 1 : .55 + .45 * dp);   // word labels fade in only once their points have settled, so they never smear
        const col = CL[o.c], gold = isQ && lt > 12.5;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const r0 = (big ? 38 : 28) * dp * (vw.F / 1000);
        glowDot(s[0], s[1], r0, colA(gold ? PAL.gold : col), (big ? 1 : .8) * ap * (dmD * .85 + (isRoy ? .15 : 0)) * (big ? 1 : early * .7 + .3));
        if (isCat && lt > T_ARR) { const pr = (lt * 1.1) % 1; ctx.strokeStyle = `rgba(150,235,255,${.5 * (1 - pr) * dimD * ap})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s[0], s[1], 20 + pr * 46, 0, TAU); ctx.stroke(); }
        ctx.restore();
        ctx.save(); ctx.fillStyle = '#fff'; ctx.globalAlpha = Math.min(1, ap * (dmD * .9 + (isRoy ? .1 : 0))); ctx.beginPath(); ctx.arc(s[0], s[1], (big ? 6.5 : gold ? 3.4 : 4.6) * dp * (vw.F / 1000), 0, TAU); ctx.fill(); ctx.restore();
        // label
        const off = { 1: [isCat ? 52 : isQ ? 40 : 34, 0, 'left'], '-1': [-34, 0, 'right'], 0: [0, 34, 'center'], 2: [0, -34, 'center'] }[o.s];
        const qk = isQ ? sstep(12.5, 12.7, lt) : 0;
        text(o.w, s[0] + off[0], s[1] + off[1], { font: F_UI, size: isCat ? 40 : isRoy ? 32 : 30, weight: isCat ? 700 : 600, color: qk > 0 ? `rgb(255,${Math.round(255 - 45 * qk)},${Math.round(255 - 133 * qk)})` : '#fff', alpha: la, align: off[2], glow: qk > 0 ? PAL.gold : isCat ? PAL.cyan : 'rgba(2,4,14,.95)', blur: qk > 0 ? 26 : isCat ? 20 : 12 });
      }

      // cluster titles: named in the overview, 84 px under the lowest dot of their cluster, gone before the camera moves
      const tOut = 1 - sstep(10.6, 11.0, lt);
      const tAll = [sstep(8.0, 8.3, lt) * tOut, sstep(8.1, 8.4, lt) * tOut, sstep(8.2, 8.5, lt) * tOut];
      if (tAll[0] > 0 || tAll[1] > 0 || tAll[2] > 0) CL_NAME.forEach(([zh, en], c) => {
        if (tAll[c] <= 0) return;
        const mem = pw.filter(q => q.o.c === c), x = mem.reduce((a, q) => a + q.s[0], 0) / mem.length, y = Math.max(...mem.map(q => q.s[1])) + 84;
        text(zh + '  ' + en, x, y, { font: F_UI, size: 30, weight: 600, color: c === 2 ? '#dccdff' : rgba(CL[c], 1), alpha: tAll[c], ls: 1, glow: 'rgba(2,4,14,.95)', blur: 14 });
      });
      // projection tag (the cloud shows 3 of thousands of dimensions)
      const gA = sstep(7.6, 8.0, lt) * tOut;
      if (gA > 0) {
        text('三维投影示意 · a 3D projection of thousands of dimensions', 90, 170, { font: F_UI, size: 24, weight: 500, color: '#dcebff', alpha: gA * .95, align: 'left', glow: 'rgba(2,4,14,.9)', blur: 8 });
        text('线上数字 = 相似度（示意） · numbers on lines = similarity (e.g.)', 90, 206, { font: F_UI, size: 24, weight: 500, color: '#b8d4ff', alpha: gA * .95, align: 'left', glow: 'rgba(2,4,14,.9)', blur: 8 });
      }
    }

    // ======================================================= the analogy line
    const eA = sstep(11.35, 11.6, lt);
    if (eA > 0) {
      const y = 806, size = 46, cxq = 1450;                                      // lower right, clear of the places cluster
      const parts = [['king', 11.45, '#fff', 'w'], [' − ', 11.6, '#c9d8ff', 's'], ['man', 11.6, '#fff', 'w'], [' + ', 11.95, '#b8c4e8', 's'], ['woman', 11.95, '#fff', 'w'], [' ≈ ', 12.3, PAL.gold, 's'], ['queen', 12.5, PAL.gold, 'w']];
      const ws = parts.map(([s, , , t]) => t === 'w' ? measure(s, size, F_UI, 700) : measure(s, size * 1.1, F_MATH, 400));
      let x = cxq - ws.reduce((a, b) => a + b, 0) / 2;
      // soft dark backing: an ellipse whose gradient reaches 0 well inside its box (no hard edges)
      ctx.save(); ctx.translate(cxq, y + 24); ctx.scale(3.4, 1);
      const gg = ctx.createRadialGradient(0, 0, 0, 0, 0, 120); gg.addColorStop(0, `rgba(4,6,16,${.62 * eA})`); gg.addColorStop(.6, `rgba(4,6,16,${.3 * eA})`); gg.addColorStop(1, 'rgba(4,6,16,0)');
      ctx.fillStyle = gg; ctx.fillRect(-120, -120, 240, 240); ctx.restore();
      parts.forEach(([s, t0, col, t], i) => {
        const a = sstep(t0, t0 + (i === 6 ? .12 : .2), lt), slide = (1 - eout(clamp((lt - t0) / .35))) * 14;
        if (t === 'w') text(s, x + ws[i] / 2, y + slide, { font: F_UI, size, weight: 700, color: col, alpha: a, glow: col === PAL.gold ? PAL.gold : 'rgba(0,0,0,.6)', blur: col === PAL.gold ? 30 : 10 });
        else text(s, x + ws[i] / 2, y + 2 + slide, { font: F_MATH, size: size * 1.1, color: col, alpha: a, glow: col === PAL.gold ? PAL.gold : null, blur: 24 });
        x += ws[i];
      });
      text('方向也有含义 · directions carry meaning', cxq, y + 56, { font: F_UI, size: 26, weight: 600, color: '#d6e6ff', alpha: sstep(12.7, 12.95, lt), glow: 'rgba(2,4,14,.95)', blur: 10 });
    }
  }
});
function eSineA(t) { return .5 - .5 * Math.cos(PI * clamp(t)); }
