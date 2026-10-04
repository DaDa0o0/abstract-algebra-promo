// s2_vectors: IDs -> vectors (embeddings) in a meaning space.  0:10 - 0:15
// Local timeline (s):  0.25-1.0 ID slides left | 0.35-0.9 vector column builds | 1.25-1.875 column collapses into ONE point (cat, beat 3)
// 1.8-2.6 the cloud unfolds | 2.0-2.8 neighbour lines + similarity numbers, three cluster titles | 2.8-3.55 camera glides to royalty (labels fade with it)
// 3.2-3.75 analogy arrows | 3.75 (beat 6) queen lands, then a ~1 s hold on the gold glow
const R = mulberry(20260002);
const gauss = () => Math.sqrt(-2 * Math.log(1 - R())) * Math.cos(TAU * R());

const CL = [PAL.cyan, PAL.pink, PAL.violet];                        // animals, places to sit, royalty
const CL_NAME = [['动物', 'animals'], ['可坐之处', 'places to sit'], ['王室与人', 'royalty & people']];
// word, cluster, world position [x,y,z], label side (1 right, -1 left, 0 below, 2 above)
const WORDS = [
  ['cat', 0, [-3.2, 0.1, 0.3], 1], ['dog', 0, [-4.2, -0.35, -0.2], -1], ['lion', 0, [-2.95, 1.25, -0.4], 1], ['tiger', 0, [-4.15, 1.2, 0.5], -1],
  ['mat', 1, [-0.9, -1.95, 0.6], -1], ['rug', 1, [0.0, -2.5, 0.1], 1], ['sofa', 1, [1.0, -1.5, 0.9], 1], ['couch', 1, [1.5, -2.45, 0.0], 1], ['bed', 1, [0.25, -1.1, -0.6], 1], ['floor', 1, [-1.7, -1.2, -0.3], -1],
  ['man', 2, [2.75, -0.3, 0.0], -1], ['woman', 2, [3.05, 0.75, 0.2], -1], ['king', 2, [4.45, -0.25, -0.3], 1], ['queen', 2, [4.95, 0.68, 0.0], 1],
].map(([w, c, p, s]) => ({ w, c, p, s }));
const WI = Object.fromEntries(WORDS.map((o, i) => [o.w, i]));
const CAT = WORDS[WI.cat].p, MAN = WORDS[WI.man].p, WOMAN = WORDS[WI.woman].p, KING = WORDS[WI.king].p, QUEEN = WORDS[WI.queen].p;
const CEN = [[-3.6, 0.55, 0.1], [0, -1.8, 0.2], [3.75, 0.25, -0.1]];
const ROYAL_FOC = [3.85, 0.22, -0.1];
const CAT_NEIGH = [['dog', 0.82], ['lion', 0.79], ['tiger', 0.76]];     // lion sits closer to cat than tiger, so it carries the higher value
const MAT_NEIGH = [['rug', 0.74], ['floor', 0.70]];

// unlabelled cloud: vocabulary points (dim) + extra members around each cluster
const DUST = [];
for (let c = 0; c < 3; c++) for (let i = 0; i < 30; i++) {
  const o = CEN[c], sp = [.95, 1.0, .95][c];
  DUST.push({ p: [o[0] + gauss() * sp * 1.0, o[1] + gauss() * sp * .6, o[2] + gauss() * sp * .6], c, a: .35 + R() * .4, s: 1.4 + R() * 1.8 });
}
while (DUST.length < 300) {
  const p = [(R() * 2 - 1) * 5.2, (R() * 2 - 1) * 3.0, (R() * 2 - 1) * 2.6];
  if (WORDS.some(o => Math.hypot(o.p[0] - p[0], o.p[1] - p[1], o.p[2] - p[2]) < .7)) continue;
  DUST.push({ p, c: -1, a: .18 + R() * .35, s: 1.2 + R() * 1.6 });
}
for (const a of [...WORDS.map(o => o.p), ...CEN, ROYAL_FOC, ...DUST.map(o => o.p)]) a[0] *= 1.12;
// the exact parallelogram corner king - man + woman; "queen" sits NEAR it, not on it (the analogy is approximate)
const QSUM = [KING[0] + WOMAN[0] - MAN[0], KING[1] + WOMAN[1] - MAN[1], KING[2] + WOMAN[2] - MAN[2]];
// the vector shown in the first beat
const VEC = [.21, -.64, .88, .05, -.37, .52];
const fmtV = v => (v < 0 ? '−' : ' ') + Math.abs(v).toFixed(2);
// column / timing constants
const COL_X = 1050, COL_Y = 278, COL_DY = 74;
const rowStart = i => .35 + i * .045;                                // a row starts rolling
const rowRev = i => rowStart(i) + .22;                               // ... and shows its true value
const T_COLL = 1.25, T_COLL_END = 1.875, T_SPREAD = 1.8;

const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const colA = hex => hexA(hex);
function view(lt) {
  const foc = sstep(0, 1, clamp((lt - 2.7) / 1.0));
  return { yaw: (-.55 + .3 * (lt - .8 * foc)) * (1 - .6 * foc), pitch: (.2 + .06 * Math.sin(lt * .9)) * (1 - .3 * foc), foc,
    F: 1000 * (1 + 1.1 * foc) * (1 + .07 * clamp((lt - 3.5) / 1.4)), cx: 960 + foc * 10, cy: 452 - foc * 12, spread: eout(clamp((lt - T_SPREAD) / .8)) };
}
function P(v, vw) {                                                  // world point -> [x, y, depth]
  let q = lerp3(CAT, v, vw.spread);
  q = [q[0] - vw.foc * ROYAL_FOC[0], q[1] - vw.foc * ROYAL_FOC[1], q[2] - vw.foc * ROYAL_FOC[2]];
  return proj(q, vw.yaw, vw.pitch, vw.cx, vw.cy, vw.F, 8.5);
}
const dep = z => clamp(.62 + .12 * z, .3, 1);                        // depth cue from camera-space z

function arrow2(a, b, col, lw, alpha, dash) {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), hs = 17;
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

scene({
  id: 'vectors', start: 4, len: 2, fi: .01, fo: .2, mb: 3, ch: ['02', '向量', 'VECTORS'], bloom: .8,
  subs: [[.3, 2.4, '再把编号变成一串数字——向量', 'Each number becomes a vector — a list of numbers'],
    [2.5, 4.9, '意思相近的词，在空间里也靠得近', 'words with similar meanings sit close together']],
  sfx: [[.3, 'whoosh', { dur: .6 }],
    ...VEC.map((_, i) => [rowRev(i), 'blip', { midi: 72 + [0, 3, 7, 10, 12, 15][i] }]),
    [T_COLL, 'swish', { pitch: 1.2 }], [1.875, 'shimmer'], [1.9, 'sparkle', { dur: 1.2 }],
    [2.1, 'ping', { midi: 76 }], [2.23, 'ping', { midi: 79 }], [2.36, 'ping', { midi: 83 }],
    [2.7, 'whoosh', { dur: 1.0 }],
    [3.2, 'blip', { midi: 69 }], [3.35, 'blip', { midi: 72 }], [3.5, 'blip', { midi: 76 }], [3.55, 'blip', { midi: 79 }], [3.75, 'chime', { midi: 88 }], [3.75, 'shimmer']],
  cam: (lt, d) => ({ z: 1 + .03 * lt / d, x: 6 * Math.sin(lt * .5), y: 4 * Math.sin(lt * .4 + 1) }),
  draw(lt, d, T) {
    const vw = view(lt);
    glDraw(0, { time: 40 + lt * .8, tint: [.2, .11, .5], amp: .8 });
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const bgg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 800); bgg.addColorStop(0, 'rgba(60,40,140,.16)'); bgg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bgg; ctx.fillRect(0, 0, W, H); ctx.restore();

    const catS = P(CAT, { ...vw, spread: 0 });                      // cat's on-screen position (same in the folded and unfolded cloud)
    const conv = eio(clamp((lt - T_COLL) / (T_COLL_END - T_COLL)));
    // the labels, lines and titles of the animals / places clusters fade WITH the camera glide (not before it)
    const lblK = 1 - sstep(.02, .26, vw.foc);

    // ======================================================= phase A: 3797 -> vector column -> one point
    if (lt < 2.2) {
      const k = eio(clamp((lt - .25) / .8));
      const nx = lerp(960, 520, k), ny = lerp(470, 500, k), ns = lerp(210, 124, k);
      const fade = 1 - conv, dec = 1 - sstep(T_COLL - .05, T_COLL + .2, lt);        // decor (brace, bars, fan lines) leaves first
      // ambient sparks orbiting the number
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 46; i++) {
        const ph = i * 2.399 + lt * (.25 + (i % 5) * .05), rr = 150 + (i % 7) * 26 + 30 * Math.sin(lt * 1.3 + i);
        const sx = nx + Math.cos(ph) * rr * 1.7 * (1 - .4 * k), sy = ny + Math.sin(ph) * rr * .55;
        ctx.fillStyle = `rgba(120,225,255,${(.25 + .35 * ((i * 7) % 5) / 5) * fade * (1 - k * .8)})`; ctx.beginPath(); ctx.arc(sx, sy, 1.4, 0, TAU); ctx.fill();
      }
      glowDot(nx, ny, 340 * (1 - .35 * k), 'rgba(80,200,255,A)', .16 * fade); ctx.restore();

      // the ID glides into cat's point while shrinking; the chip follows to the label spot
      const ex = lerp(nx, catS[0], conv), ey = lerp(ny, catS[1], conv), es = lerp(ns, 44, conv);
      text('3797', ex, ey, { font: F_MONO, size: es, weight: 700, color: '#8fe4ff', alpha: 1 - sstep(.55, .95, conv), glow: PAL.cyan, blur: 8 + 26 * (es / 124) });
      // "cat" tag: plain text exactly as in the last frame of scene 1, crossing into a chip, then flying to cat's label
      const tagA = (1 - sstep(.1, .2, lt)) * fade, chA = sstep(.2, .32, lt) * (1 - sstep(.55, 1, conv));   // quick swap, never both half-visible (they differ in letter spacing)
      const chx = lerp(lerp(960, 520, k), catS[0] + 84, conv), chy = lerp(lerp(620, 598, k), catS[1], conv);
      if (tagA > 0) text('cat', lerp(960, 520, k), lerp(620, 598, k), { font: F_UI, size: 34, weight: 700, color: '#d9ccff', alpha: tagA, ls: 6, glow: PAL.violet, blur: 12 });
      if (lt > .18 && lt < .5) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowDot(lerp(960, 520, k), lerp(620, 598, k), 70, 'rgba(190,150,255,A)', .5 * (1 - sstep(.2, .5, lt)) * sstep(.18, .22, lt)); ctx.restore(); }
      if (chA > 0) chip('cat', chx, chy, { size: 32, color: HUES[1], alpha: chA, glow: 14 });
      text('ID  (e.g.)', 520, 396, { font: F_UI, size: 26, weight: 600, color: '#b8d4ff', ls: 5, alpha: sstep(.7, 1.0, lt) * fade });

      // the column
      const bA = sstep(.4, .65, lt) * (1 - sstep(T_COLL + .1, T_COLL + .5, lt));
      if (bA > 0) {
        const sx = nx + 1.2 * ns + 14, sy = ny;                                      // fan lines leave the right edge of the number
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 1.8;
        for (let i = 0; i < 7; i++) {
          const k2 = eexpo(clamp((lt - .35 - i * .045) / .5)); if (k2 <= 0) continue;
          const ty = COL_Y + i * COL_DY;
          ctx.strokeStyle = `rgba(110,215,255,${.5 * k2 * dec})`;
          ctx.beginPath(); ctx.moveTo(sx, sy);
          for (let s = 1; s <= 24; s++) { const u = s / 24 * k2, e = eio(u); ctx.lineTo(lerp(sx, 1000, u), lerp(sy, ty, e)); }
          ctx.stroke();
          const pu = ((lt * .9 + i * .17) % 1) * k2, pe = eio(pu);                    // travelling glints die out before the bracket
          glowDot(lerp(sx, 1000, pu), lerp(sy, ty, pe), 11, 'rgba(120,230,255,A)', .5 * k2 * dec * (1 - sstep(.45, .9, pu)));
        }
        ctx.restore();
        // bracket
        ctx.save(); ctx.globalAlpha = bA * .9; ctx.strokeStyle = 'rgba(190,225,255,.75)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        const by0 = COL_Y - 40, by1 = COL_Y + 6 * COL_DY + 40;
        for (const [bx, sg] of [[1022, 1], [1488, -1]]) { ctx.beginPath(); ctx.moveTo(bx + sg * 16, by0); ctx.lineTo(bx, by0); ctx.lineTo(bx, by1); ctx.lineTo(bx + sg * 16, by1); ctx.stroke(); }
        ctx.restore();
        // rows
        for (let i = 0; i < 7; i++) {
          const k3 = clamp((lt - rowStart(i)) / .3); if (k3 <= 0) continue;
          const ty = COL_Y + i * COL_DY;
          const rA = clamp(k3 * 2.5) * (1 - sstep(T_COLL + i * .03, T_COLL + .25 + i * .03, lt));
          if (i === 6) { text('⋮', COL_X + 70, ty, { font: F_MONO, size: 58, color: PAL.dim, alpha: rA }); continue; }
          const v = VEC[i], rev = lt >= rowRev(i);
          const qk = Math.floor(lt * 10 + .5);                                                // scramble ticks sit midway between exported frames, so no frame ever overprints two values
          const sv = rev ? v : (hash1(i * 31 + qk * 3.7) * (hash1(i * 13 + qk) < .5 ? 1 : -1));   // scrambled value while rolling
          const flash = rev ? 1 - sstep(rowRev(i), rowRev(i) + .3, lt) : 0;                    // short flash when the true value locks in
          const s = fmtV(sv);
          const pos = sv >= 0, colr = pos ? PAL.cyan : PAL.violet;
          text(s, COL_X, ty, { font: F_MONO, size: 52, weight: 500, color: '#fff', alpha: rA, align: 'left', glow: colr, blur: 18 + 30 * flash });
          const bw = Math.abs(sv) * 118, ax = 1355;                                   // signed bar always matches the number shown
          ctx.save(); ctx.globalAlpha = rA * dec; ctx.fillStyle = rgba(colr, .85); ctx.shadowColor = colr; ctx.shadowBlur = 14;
          rrect(pos ? ax : ax - bw, ty - 9, bw, 18, 6); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(200,225,255,.5)'; ctx.fillRect(ax - 1, ty - 20, 2, 40); ctx.restore();
        }
        // what it is: a vector (an embedding), and that these numbers are only an example
        const vA = sstep(.4, .7, lt) * (1 - sstep(T_COLL + .1, T_COLL + .45, lt));
        text('vector  向量', (1022 + 1488) / 2, 190, { font: F_UI, size: 32, weight: 700, color: '#dff6ff', alpha: vA, ls: 2, glow: PAL.cyan, blur: 18 });
        text('embedding · e.g. 示意', (1022 + 1488) / 2, COL_Y + 6 * COL_DY + 78, { font: F_UI, size: 24, weight: 500, color: '#b8d4ff', alpha: vA * .9, ls: 1, glow: 'rgba(2,4,14,.9)', blur: 8 });
        // dimension label (brace + two-line English so it stays inside the right margin)
        const lA = sstep(.6, .9, lt) * (1 - sstep(T_COLL + .15, T_COLL + .5, lt)), lx = 1506;
        ctx.save(); ctx.globalAlpha = lA * .85; ctx.strokeStyle = 'rgba(190,225,255,.85)'; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
        const yb = COL_Y + 6 * COL_DY;
        ctx.beginPath(); ctx.moveTo(lx - 8, COL_Y - 40); ctx.quadraticCurveTo(lx + 6, COL_Y - 40, lx + 6, COL_Y - 20); ctx.lineTo(lx + 6, 500 - 14); ctx.quadraticCurveTo(lx + 6, 500, lx + 20, 500);
        ctx.quadraticCurveTo(lx + 6, 500, lx + 6, 514); ctx.lineTo(lx + 6, yb + 20); ctx.quadraticCurveTo(lx + 6, yb + 40, lx - 8, yb + 40); ctx.stroke(); ctx.restore();
        text('数千维', lx + 40, 460, { size: 40, weight: 700, color: '#fff', alpha: lA, align: 'left', glow: PAL.cyan, blur: 14 });
        text('thousands of', lx + 40, 508, { font: F_UI, size: 26, weight: 500, color: '#b8d4ff', alpha: lA, align: 'left' });
        text('dimensions', lx + 40, 540, { font: F_UI, size: 26, weight: 500, color: '#b8d4ff', alpha: lA, align: 'left' });
      }
      // the vector collapses: 7 bright particles fly from the rows into cat's point
      if (conv > 0 && lt < 2.2) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 7; i++) {
          const sy0 = COL_Y + i * COL_DY, u = clamp((lt - T_COLL - i * .02) / (T_COLL_END - T_COLL - .14)), sg = i % 2 ? 1 : -1;
          const at = uu => { const e = eio(uu); return [lerp(COL_X + 40, catS[0], e), lerp(sy0, catS[1], e) - Math.sin(uu * PI) * 70 * sg]; };
          if (u >= 1) continue;
          for (let tr = 5; tr >= 0; tr--) { const p = at(Math.max(0, u - tr * .035)); glowDot(p[0], p[1], 14 + (5 - tr) * 2.5, 'rgba(150,235,255,A)', (.1 + .05 * (5 - tr)) * sstep(0, .18, u)); }
          const p = at(u), ra = sstep(0, .18, u); glowDot(p[0], p[1], 12 + 8 * ra, 'rgba(255,238,200,A)', .42 * ra);
        }
        const fl = sstep(.55, 1, conv) * (1 - sstep(1.95, 2.3, lt));                  // arrival flash: the point is born
        glowDot(catS[0], catS[1], 95, 'rgba(255,225,170,A)', .4 * fl);
        ctx.restore();
      }
    }

    // ======================================================= phase B: the meaning space
    const sp = vw.spread, cb = sstep(1.65, 1.9, lt);                                 // cat's point appears as the particles arrive
    if (lt > 1.5) {
      const dimD = 1 - sstep(.1, .8, vw.foc), dimL = lblK, mv = 1;                     // off-focus dots/halos dim to 0 as the camera arrives; royal labels never dip
      const pw = WORDS.map(o => ({ o, s: P(o.p, vw) }));
      const early = 1 + .9 * (1 - sstep(0, .5, sp));                                 // brighter while the cloud is still unfolding
      // cluster halos
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let c = 0; c < 3; c++) {
        const s = P(CEN[c], vw), r = (c === 2 ? 270 : 300) * (vw.F / 1000) * sstep(0, .5, sp) * 1.1, a = (c === 2 ? 1 : dimD) * .2 * sstep(0, .5, sp) * early;
        if (a > .003) glowDot(s[0], s[1], r, colA(CL[c]), a);
      }
      // dust: the rest of the vocabulary
      for (const dd of DUST) {
        const s = P(dd.p, vw), dp = dep(s[2]), dm = dd.c === 2 ? 1 : dimD * (dd.c < 0 ? .75 : 1) + (dd.c < 0 ? .25 * (1 - dimD) : 0);
        if (dm < .01 || s[0] < -20 || s[0] > W + 20 || s[1] < -20 || s[1] > H + 20) continue;
        ctx.fillStyle = dd.c < 0 ? `rgba(175,195,255,${Math.min(1, dd.a * 2.3) * dp * dm * sstep(0, .35, sp) * early})` : `rgba(${dd.c === 0 ? '120,225,255' : dd.c === 1 ? '255,140,225' : '185,160,255'},${Math.min(1, dd.a * 2.3) * dp * dm * sstep(0, .35, sp) * early})`;
        const rr = Math.min(4.6, dd.s * dp * 2.9 * (vw.F / 1000)); ctx.beginPath(); ctx.arc(s[0], s[1], Math.max(.9, rr * .5), 0, TAU); ctx.fill();
      }
      // neighbour lines: cat -> dog / tiger / lion (with the similarity values), mat -> rug / couch
      const nA = sstep(1.95, 2.1, lt) * dimL;
      const lines = [...CAT_NEIGH.map(([n, sim], i) => ['cat', n, sim, 1.98 + i * .13, 'rgba(150,235,255,', 1]), ...MAT_NEIGH.map(([n, sim], i) => ['mat', n, sim, 2.22 + i * .12, 'rgba(255,170,235,', i ? -1 : 1])];
      if (nA > 0) for (const [a, n, sim, t0, rgb, side] of lines) {
        const k = eexpo(clamp((lt - t0) / .4)), cs = pw[WI[a]].s, t = pw[WI[n]].s;
        const ex = lerp(cs[0], t[0], k), ey = lerp(cs[1], t[1], k);
        ctx.strokeStyle = rgb + (.85 * nA) + ')'; ctx.lineWidth = 2.6; ctx.shadowColor = rgb + '1)'; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.moveTo(cs[0], cs[1]); ctx.lineTo(ex, ey); ctx.stroke(); ctx.shadowBlur = 0;
        glowDot(t[0], t[1], 30, rgb + 'A)', .42 * nA * k);
      }
      ctx.restore();
      if (nA > 0) for (const [a, n, sim, t0, rgb, side] of lines) {
        const k = sstep(t0 + .2, t0 + .42, lt);
        if (k > 0) simLabel(pw[WI[a]].s, pw[WI[n]].s, a === 'cat' ? .46 : .5, sim, a === 'cat' ? '#bff4ff' : '#ffd0f2', nA * k, side);
      }

      // analogy arrows
      const aA = sstep(3.15, 3.3, lt);
      if (aA > 0) {
        const m = P(MAN, vw), w = P(WOMAN, vw), kg = P(KING, vw), qs = P(QSUM, vw);
        const ak = clamp((lt - 3.2) / .35), bk = clamp((lt - 3.35) / .35), ck = clamp((lt - 3.45) / .3), dk = clamp((lt - 3.5) / .3);
        const along = (a, b, k) => P(lerp3(a, b, eio(k)), vw);
        if (ak > 0) arrow2(m, along(MAN, KING, ak), PAL.violet, 3.5, aA);
        if (bk > 0) arrow2(m, along(MAN, WOMAN, bk), PAL.pink, 3.5, aA);
        if (ck > 0) arrow2(kg, along(KING, QSUM, ck), PAL.pink, 3, aA * .9, [10, 8]);           // king + (woman - man) lands near queen
        if (dk > 0) arrow2(w, along(WOMAN, QSUM, dk), PAL.violet, 3, aA * .9, [10, 8]);
        if (dk >= 1) {                                                                          // the exact sum point, drawn as a small dotted ring
          ctx.save(); ctx.strokeStyle = 'rgba(255,225,160,.8)'; ctx.lineWidth = 2; ctx.setLineDash([4, 5]); ctx.globalAlpha = sstep(3.82, 4.05, lt);
          ctx.beginPath(); ctx.arc(qs[0], qs[1], 15, 0, TAU); ctx.stroke(); ctx.restore();
        }
        const lA2 = sstep(3.35, 3.6, lt);
        const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const m1 = mid(m, kg), m2 = mid(m, w);
        text('royalty', m1[0] + 8, m1[1] + 36, { font: F_UI, size: 28, weight: 500, color: '#d3c3ff', alpha: lA2 * aA, glow: 'rgba(2,4,14,.95)', blur: 10 });
        text('gender', m2[0] - 62, m2[1] + 6, { font: F_UI, size: 28, weight: 500, color: '#ffc4ee', alpha: lA2 * aA, glow: 'rgba(2,4,14,.95)', blur: 10 });
      }

      // queen lands (beat 7)
      if (lt > 3.75) {
        const q = P(QUEEN, vw), k = lt - 3.75, pulse = .85 + .15 * Math.sin(lt * 7);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        glowDot(q[0], q[1], 95 * pulse * eout(clamp(k / .5)), 'rgba(255,210,122,A)', .36);
        const ring = eout(clamp(k / .6)); ctx.strokeStyle = `rgba(255,220,150,${(1 - ring) * .8})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(q[0], q[1], 24 + ring * 86, 0, TAU); ctx.stroke();
        for (let i = 0; i < 26; i++) {
          const an = i * 2.399 + hash1(i) * 2, sp2 = 60 + hash1(i * 3.3) * 160, e = eout(clamp(k / (.9 + hash1(i * 7) * .8)));
          ctx.fillStyle = `rgba(255,225,160,${(1 - e) * .9})`; ctx.beginPath(); ctx.arc(q[0] + Math.cos(an) * sp2 * e, q[1] + Math.sin(an) * sp2 * e - 12 * e, 2, 0, TAU); ctx.fill();
        }
        // light keeps flowing along the two dashed edges toward queen
        for (const src of [KING, WOMAN]) {
          const u = clamp(((lt - 3.75) * 1.3 + (src === KING ? 0 : .5)) % 1), p = P(lerp3(src, QSUM, eio(u)), vw);
          glowDot(p[0], p[1], 22, 'rgba(255,225,170,A)', .6 * Math.sin(u * PI));
        }
        ctx.restore();
      }

      // words
      const sorted = pw.slice().sort((a, b) => a.s[2] - b.s[2]);
      for (const { o, s } of sorted) {
        const isRoy = o.c === 2, dmD = isRoy ? 1 : dimD, dmL = isRoy ? mv : dimL, dp = dep(s[2]);
        const isCat = o.w === 'cat', isQ = o.w === 'queen';
        const ap = isCat ? cb : sstep(.3, .8, sp);                                   // point alpha
        if (ap <= 0 || (!isRoy && dimD <= .004) || s[0] < -150 || s[0] > W + 150 || s[1] < -150 || s[1] > H + 150) continue;
        const la = isCat ? Math.max(sstep(1.8, 2.1, lt), sstep(.72, .95, sp)) * dmL : sstep(.72, .95, sp) * dmL * (.55 + .45 * dp);
        const col = CL[o.c], gold = isQ && lt > 3.75;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const r0 = (isCat ? 38 : 28) * dp * (vw.F / 1000);
        glowDot(s[0], s[1], r0, colA(gold ? PAL.gold : col), (isCat ? 1 : .8) * ap * (dmD * .85 + (isRoy ? .15 : 0)) * (isCat ? 1 : early * .7 + .3));
        if (isCat && lt > 2.0) { const pr = (lt * 1.1) % 1; ctx.strokeStyle = `rgba(150,235,255,${.5 * (1 - pr) * dimD * cb})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s[0], s[1], 20 + pr * 46, 0, TAU); ctx.stroke(); }
        ctx.restore();
        ctx.save(); ctx.fillStyle = '#fff'; ctx.globalAlpha = Math.min(1, ap * (dmD * .9 + (isRoy ? .1 : 0))); ctx.beginPath(); ctx.arc(s[0], s[1], (isCat ? 6.5 : gold ? 3.4 : 4.6) * dp * (vw.F / 1000), 0, TAU); ctx.fill(); ctx.restore();
        // label
        const off = { 1: [isCat ? 52 : isQ ? 40 : 34, 0, 'left'], '-1': [-34, 0, 'right'], 0: [0, 34, 'center'], 2: [0, -34, 'center'] }[o.s];
        const qk = isQ ? sstep(3.74, 3.95, lt) : 0;
        text(o.w, s[0] + off[0], s[1] + off[1], { font: F_UI, size: isCat ? 40 : isRoy ? 32 : 30, weight: isCat ? 700 : 600, color: qk > 0 ? `rgb(255,${Math.round(255 - 45 * qk)},${Math.round(255 - 133 * qk)})` : '#fff', alpha: la, align: off[2], glow: qk > 0 ? PAL.gold : isCat ? PAL.cyan : 'rgba(2,4,14,.95)', blur: qk > 0 ? 26 : isCat ? 20 : 12 });
      }

      // cluster titles: all three named in the overview, 56 px under the lowest dot of their cluster, gone before the camera moves
      const tA = sstep(2.1, 2.4, lt) * lblK, tR = (sstep(2.2, 2.5, lt)) * (1 - sstep(.03, .3, vw.foc));
      if (tA > 0 || tR > 0) CL_NAME.forEach(([zh, en], c) => {
        const mem = pw.filter(q => q.o.c === c), x = mem.reduce((a, q) => a + q.s[0], 0) / mem.length, y = Math.max(...mem.map(q => q.s[1])) + 84;
        text(zh + '  ' + en, x, y, { font: F_UI, size: 30, weight: 600, color: rgba(CL[c], 1), alpha: c === 2 ? tR : tA, ls: 1, glow: 'rgba(2,4,14,.95)', blur: 14 });
      });
      // projection tag (the cloud shows 3 of thousands of dimensions)
      const gA = sstep(2.1, 2.4, lt) * lblK;
      if (gA > 0) {
        text('三维投影示意 · a 3D projection of thousands of dimensions', 1790, 190, { font: F_UI, size: 24, weight: 500, color: '#dcebff', alpha: gA * .95, align: 'right', glow: 'rgba(2,4,14,.9)', blur: 8 });
        text('线上数字 = 相似度（示意） · numbers on lines = similarity (e.g.)', 1790, 226, { font: F_UI, size: 24, weight: 500, color: '#b8d4ff', alpha: gA * .95, align: 'right', glow: 'rgba(2,4,14,.9)', blur: 8 });
      }
    }

    // ======================================================= the analogy line
    const eA = sstep(3.2, 3.45, lt);
    if (eA > 0) {
      const y = 812, size = 50;
      const parts = [['king', 3.3, '#fff', 'w'], [' − ', 3.4, '#c9d8ff', 's'], ['man', 3.4, '#fff', 'w'], [' + ', 3.5, '#b8c4e8', 's'], ['woman', 3.5, '#fff', 'w'], [' ≈ ', 3.62, PAL.gold, 's'], ['queen', 3.75, PAL.gold, 'w']];
      const ws = parts.map(([s, , , t]) => t === 'w' ? measure(s, size, F_UI, 700) : measure(s, size * 1.1, F_MATH, 400));
      let x = 960 - ws.reduce((a, b) => a + b, 0) / 2;
      // soft dark backing: an ellipse whose gradient reaches 0 well inside its box (no hard edges)
      ctx.save(); ctx.translate(960, y); ctx.scale(3.4, 1);
      const gg = ctx.createRadialGradient(0, 0, 0, 0, 0, 120); gg.addColorStop(0, `rgba(4,6,16,${.62 * eA})`); gg.addColorStop(.6, `rgba(4,6,16,${.3 * eA})`); gg.addColorStop(1, 'rgba(4,6,16,0)');
      ctx.fillStyle = gg; ctx.fillRect(-120, -120, 240, 240); ctx.restore();
      parts.forEach(([s, t0, col, t], i) => {
        const a = sstep(t0, t0 + .25, lt), slide = (1 - eout(clamp((lt - t0) / .35))) * 14;
        if (t === 'w') text(s, x + ws[i] / 2, y + slide, { font: F_UI, size, weight: 700, color: col, alpha: a, glow: col === PAL.gold ? PAL.gold : 'rgba(0,0,0,.6)', blur: col === PAL.gold ? 30 : 10 });
        else text(s, x + ws[i] / 2, y + 2 + slide, { font: F_MATH, size: size * 1.1, color: col, alpha: a, glow: col === PAL.gold ? PAL.gold : null, blur: 24 });
        x += ws[i];
      });
    }
  }
});
