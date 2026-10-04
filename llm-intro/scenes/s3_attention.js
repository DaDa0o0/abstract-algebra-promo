// s3_attention: Transformer. Every token looks back at earlier tokens (causal attention), then the same row is
// revealed as one layer of a tall stack; data flows up through it and a single vector emerges at the top centre.
const R = mulberry(20260003);

const A_LAB = ['The', 'cat', 'sat', 'on', 'the'];
const A_N = 5, A_COLW = 270, A_NB = 9, A_L = 8, A_G = 180;               // tokens, column spacing, bars per vector, layers drawn, layer gap
const A_ROW = 660;                                                       // screen y of the token row in the flat view
const colX = i => (i - 2) * A_COLW;
const A_BAR_Y = 112, A_BAR_H = 36;

// ---- vectors (signed numbers) per layer and token
const randVec = () => Array.from({ length: A_NB }, () => (R() * 2 - 1) * .95);
const VEC = [];
for (let k = 0; k < A_L; k++) VEC.push(Array.from({ length: A_N }, (_, i) => k === 0 ? randVec() : randVec().map((v, b) => .45 * VEC[k - 1][i][b] + .55 * v)));
// layer-0 attention of the last token: weights over [The, cat, sat, on, the(self)]
const FW = [.07, .19, .38, .31, .05];
const MIXED = VEC[0][0].map((_, b) => FW.reduce((s, w, j) => s + w * VEC[0][j][b], 0) * 1.7);

// ---- layer 0 arcs: faint "everyone looks back" set + the focus arcs of " the"
const FAINT = [[1, 0, .45, .35], [2, 1, .4, .55], [2, 0, .22, .6], [3, 2, .5, .8], [3, 1, .2, .85], [3, 0, .1, .9]];   // [from, to, weight, appear time]
const FOCUS = [[4, 2, .38, 1.25, 72], [4, 3, .31, 1.875, 76], [4, 1, .19, 2.5, 79], [4, 0, .07, 2.8, 81]];              // [from, to, weight, appear time, ping midi]
const ARC_H = [0, 100, 185, 255, 315];                                    // apex height above the chip row by token distance

// ---- other layers: two "heads" each, different pattern and hue
function headArcs(type) {
  const a = [];
  for (let i = 1; i < A_N; i++) {
    if (type === 0) a.push([i, i - 1, .55 + R() * .35]);
    else if (type === 1) a.push([i, 0, .4 + R() * .5]);
    else if (type === 2) { if (i >= 2) a.push([i, i - 2, .4 + R() * .4]); }
    else if (type === 3) {
      const js = [...Array(i).keys()].map(j => [R(), j]).sort((p, q) => p[0] - q[0]).slice(0, Math.min(i, 2)).map(p => p[1]);
      js.forEach(j => a.push([i, j, .25 + R() * .5]));
    } else if (type === 4) { if (i === 4 || i === 2) for (let j = 0; j < i; j++) a.push([i, j, .2 + R() * .4]); }
  }
  return a;
}
const HEAD_HUES = [PAL.cyan, PAL.blue, PAL.violet, PAL.pink, PAL.mint];
const HEAD_TYPES = [[3, 0], [2, 4], [0, 3], [1, 2], [4, 0], [3, 1], [2, 3]];
const HEADS = [null];
for (let k = 1; k < A_L; k++) {
  const [ta, tb] = HEAD_TYPES[(k - 1) % HEAD_TYPES.length], ha = (k * 2) % 5, hb = (k * 2 + 2 + (k % 2)) % 5;
  HEADS.push([{ arcs: headArcs(ta), hue: HEAD_HUES[ha], off: -10 }, { arcs: headArcs(tb), hue: HEAD_HUES[hb === ha ? (hb + 1) % 5 : hb], off: 12 }]);
}

const DUST = Array.from({ length: 120 }, () => ({ x: R() * W, y: R() * H, z: .2 + R() * .8, p: R() * TAU }));

// ---- timing constants
const T_WAVE = 4.375, T_STEP = 1.875 / (A_L - 1), T_VEC = 6.25;          // wave leaves layer 0 at beat 7, reaches the top at beat 10
const layerT = k => T_WAVE + k * T_STEP;

// ---- 3D camera, rebuilt every frame (pure function of lt). The tilt is slow (3.7 -> 6.1 s); the layers peel apart while it runs.
let CM = null, SF = 1, Y0 = -42;                                          // SF: global fade of the stack at the hand-off; Y0: arc start height (chips grow)
function camera(lt) {
  const e = eio(clamp((lt - 3.7) / 2.4)), dr = clamp((lt - 3.7) / 3.8);
  CM = {
    yaw: -.3 * e + .1 * dr, pitch: lerp(0, .5, e), D: lerp(1500, 3900, e) - 120 * dr, F: lerp(1500, 1700, e),
    tx: 0, ty: lerp(0, -120, e), tz: lerp(0, 3.5 * A_G, e), cx: lerp(960, CAM_CX, e), cy: lerp(A_ROW, CAM_CY, e),
  };
}
const CAM_CX = 860, CAM_CY = 548;
function P(x, y, z) {
  const c = CM; x -= c.tx; y -= c.ty; z -= c.tz;
  const c1 = Math.cos(c.yaw), s1 = Math.sin(c.yaw), c2 = Math.cos(c.pitch), s2 = Math.sin(c.pitch);
  const x1 = x * c1 + z * s1, z1 = -x * s1 + z * c1;
  const y2 = y * c2 - z1 * s2, z2 = y * s2 + z1 * c2, s = c.F / (c.D + z2);
  return [c.cx + s * x1, c.cy + s * y2, s, z2];
}
function atCard(x, y, z, fn) {                                            // draw in a card's local units, affinely mapped onto the screen
  const a = P(x, y, z), b = P(x + 1, y, z), c = P(x, y + 1, z);
  ctx.save(); ctx.transform(b[0] - a[0], b[1] - a[1], c[0] - a[0], c[1] - a[1], a[0], a[1]); fn(a[2]); ctx.restore();
}
const zLayer = (k, lt) => k * A_G * eio(clamp((lt - 4.2 - k * .04) / 1.0));
function zAt(q, lt) { const k = clamp(Math.floor(q), 0, A_L - 2), f = clamp(q - k, 0, 1); return lerp(zLayer(k, lt), zLayer(k + 1, lt), f); }

// bezier arc between chip tops in card-local coordinates (y up is negative)
function arcPt(xs, xd, h, t) {
  const y0 = Y0, H = h / .75, u = 1 - t, b0 = u * u * u, b1 = 3 * u * u * t, b2 = 3 * u * t * t, b3 = t * t * t;
  return [b0 * xs + b1 * xs + b2 * xd + b3 * xd, b0 * y0 + b1 * (y0 - H) + b2 * (y0 - H) + b3 * (y0 - 6)];
}
function arcLine(z, xs, xd, h, f, c0, c1, lw, alpha, halo, ns) {
  alpha *= SF; if (alpha < .02) return;
  const pts = [], NS = ns || (halo ? 28 : 16);
  for (let n = 0; n <= NS; n++) { const [x, y] = arcPt(xs, xd, h, f * n / NS); pts.push(P(x, y, z)); }
  const sc = pts[Math.floor(pts.length / 2)][2], a = pts[0], b = pts[pts.length - 1];
  let st; if (c0 === c1) st = rgba(c0, 1); else { st = ctx.createLinearGradient(a[0], a[1], b[0], b[1]); st.addColorStop(0, rgba(c0, 1)); st.addColorStop(1, rgba(c1, 1)); }
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = st; ctx.globalCompositeOperation = 'lighter';
  const path = () => { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); };
  if (halo) { ctx.globalAlpha = alpha * .1; ctx.lineWidth = lw * sc * 2.6; path(); ctx.stroke(); }
  ctx.globalAlpha = alpha; ctx.lineWidth = Math.max(1.2, lw * sc); path(); ctx.stroke();
  ctx.restore();
}
function tglow(x, y, r, hex, a, w) {                                       // soft glow with a hue-tinted core (w = how white the very centre is)
  if (a <= .003 || r < 1) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(mixH(hex, '#ffffff', w), a)); g.addColorStop(.22, rgba(hex, a * .75)); g.addColorStop(1, rgba(hex, 0));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
}
function arrowTip(z, xq, w, col, alpha) {                                  // arrowhead on the querying token: information flows INTO it from the attended token
  alpha *= SF; if (alpha < .02) return;
  const s = 8 + w * 11, tip = P(xq, Y0 + 2, z), l = P(xq - s * .75, Y0 - s * 1.25, z), r = P(xq + s * .75, Y0 - s * 1.25, z);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha; ctx.fillStyle = rgba(col, 1);
  ctx.beginPath(); ctx.moveTo(tip[0], tip[1]); ctx.lineTo(l[0], l[1]); ctx.lineTo(r[0], r[1]); ctx.closePath(); ctx.fill(); ctx.restore();
}
function endDot(z, xd, h, col, alpha) {                                    // small node where an arc lands on the token it reads from
  alpha *= SF; if (alpha < .02) return;
  const p = P(xd, Y0 - 6, z);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha; ctx.fillStyle = rgba(col, 1);
  ctx.beginPath(); ctx.arc(p[0], p[1], 4 + h * 3, 0, TAU); ctx.fill(); ctx.restore();
}

// one token column: chip + vector bars (card-local, centred on the chip)
const HV = [-0.7489, 0.6742, -0.7828, -0.374, 0.7344, -0.7477, -0.8836, -0.387, 0.7901, 0.7456, -0.9769, -0.4014];   // = s4_predict's VEC, so the hand-off is the same object
const mixH = (a, b, k) => { const f = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }, A = f(a), B = f(b); return '#' + [0, 1, 2].map(i => Math.round(lerp(A[i], B[i], k)).toString(16).padStart(2, '0')).join(''); };
function column(k, i, z, o) {
  atCard(colX(i), 0, z, s => {
    const dy = (1 - o.rise) * 34, a = o.alpha * o.rise;
    if (a < .01) return;
    const sz = o.sz || 44;
    if (k === 0) { const cw = measure(A_LAB[i], sz) + sz, ch = sz * 1.7; ctx.save(); ctx.globalAlpha = a * .6; rrect(-cw / 2, dy - ch / 2, cw, ch, ch * .28); ctx.fillStyle = 'rgb(5,9,24)'; ctx.fill(); ctx.restore(); }
    if (k === 0) chip(A_LAB[i], 0, dy, { size: sz, color: HUES[i], alpha: a, glow: o.glow, fillA: o.fillA, strokeA: o.strokeA });
    else chip('', 0, dy, { size: 44, minW: 96, h: 56, color: HUES[i], alpha: a, glow: 0, fillA: o.fillA + .1 * o.lit, strokeA: o.strokeA });
    ctx.save(); ctx.globalAlpha = a * .4; ctx.strokeStyle = rgba(HUES[i], 1); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, dy + sz * .9); ctx.lineTo(0, A_BAR_Y - A_BAR_H - 6 + dy); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (o.pulse > .01) glowDot(0, dy + A_BAR_Y, 70, 'rgba(255,214,140,A)', o.pulse * .3);
    ctx.fillStyle = rgba(HUES[i], .88);
    ctx.globalAlpha = a * (.75 + .25 * o.lit);
    const vals = o.vals;
    for (let b = 0; b < A_NB; b++) {
      const v = vals[b] * o.grow, h = v * A_BAR_H * (k ? .7 : 1), x = (b - (A_NB - 1) / 2) * 15;
      ctx.fillRect(x - 4, dy + A_BAR_Y - Math.max(h, 0), 8, Math.max(Math.abs(h), 1.5));
    }
    ctx.globalAlpha = a * .35; ctx.fillRect(-(A_NB * 15) / 2, dy + A_BAR_Y - .75, A_NB * 15, 1.5);
    ctx.restore();
  });
}

// the single bright vector handed to scene 4: same look as s4_predict's drawVector (12 signed bars, cyan up / violet down, brackets, 240 px glow)
function vecGlyph(cx, cy, sc, a, grow, wob, gl = .5) {
  if (a <= 0) return;
  const n = HV.length, step = 30 * sc, x0 = cx - (n - 1) * step / 2;
  ctx.save(); ctx.globalAlpha = a;
  ctx.globalCompositeOperation = 'lighter'; glowDot(cx, cy, 240 * sc, 'rgba(140,170,255,A)', gl * a);
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < n; i++) {
    const v = HV[i] * (1 + wob * .14 * Math.sin(wob * 14 + i * 1.7)), x = x0 + i * step, h = (Math.abs(v) * 54 * grow + 5) * sc, col = v > 0 ? PAL.cyan : PAL.violet;
    ctx.shadowColor = col; ctx.shadowBlur = 16; ctx.fillStyle = mixH(col, '#ffffff', .55);
    rrect(x - 5 * sc, v > 0 ? cy - h : cy, 10 * sc, h, 5 * sc); ctx.fill();
  }
  ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(210,225,255,.55)'; ctx.lineWidth = 2.5;
  const bw = 206 * sc, bh = 74 * sc * (.4 + .6 * grow), bk = 14 * sc;
  ctx.beginPath(); ctx.moveTo(cx - bw + bk, cy - bh); ctx.lineTo(cx - bw, cy - bh); ctx.lineTo(cx - bw, cy + bh); ctx.lineTo(cx - bw + bk, cy + bh);
  ctx.moveTo(cx + bw - bk, cy - bh); ctx.lineTo(cx + bw, cy - bh); ctx.lineTo(cx + bw, cy + bh); ctx.lineTo(cx + bw - bk, cy + bh); ctx.stroke();
  ctx.restore();
}

scene({
  id: 'attention', start: 6, len: 3, fi: .25, fo: .2, mb: 2, bloom: 1,
  ch: ['03', '注意力', 'ATTENTION'],
  subs: [[0.3, 3.1, '核心是 Transformer：每个词都会回看前面的词', 'At its core, a Transformer: every word looks back at the words before it'],
    [3.3, 7.2, '注意力决定谁更重要；几十层叠起来，语境越来越丰富', 'Attention decides what matters — stack dozens of layers and the context gets richer']],
  sfx: [[0, 'swell', { dur: 2.4 }], [.35, 'tick', { hi: true }], [.55, 'tick', { hi: true }], [.8, 'tick', { hi: true }],
    ...FOCUS.filter(f => f[4]).map(f => [f[3], 'ping', { midi: f[4] }]),
    [3.125, 'chime', { midi: 84 }], [3.75, 'whoosh', { dur: 1.5 }],
    ...Array.from({ length: A_L }, (_, k) => [layerT(k), 'blip', { midi: 60 + k * 2 }]),
    [T_WAVE, 'riser', { dur: 1.875 }], [T_VEC, 'hit', { k: .5 }], [T_VEC, 'shimmer'], [T_VEC, 'whoosh', { dur: .9 }], [6.875, 'sparkle', { dur: .6 }]],
  hits: [[T_VEC, .15]],
  cam: camStill,
  draw(lt, d, T) {
    camera(lt);
    glDraw(1, { time: T * .8, tint: [.22, .34, .80], amp: .7 });
    const c = eio(clamp((lt - 3.7) / 2.4));
    SF = 1 - sstep(6.25, 6.95, lt);                                           // the stack lets go while the vector stays at full brightness
    Y0 = -42 - 12 * c;

    // ---- dust motes drifting upward (depth parallax)
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#bcd8ff';
    for (const m of DUST) {
      const y = ((m.y - (lt + 3) * 16 * m.z) % H + H) % H, r = 1.4 + m.z * 1.8;
      ctx.globalAlpha = (.1 + .3 * m.z * (.6 + .4 * Math.sin(lt * 1.5 + m.p))) * sstep(0, .8, lt);
      ctx.fillRect(m.x + Math.sin(lt * .4 + m.p) * 10 * m.z, y, r, r);
    }
    ctx.restore();

    const Z = Array.from({ length: A_L }, (_, k) => zLayer(k, lt));
    const lit = k => sstep(layerT(k) - .12, layerT(k), lt) * Math.exp(-Math.max(0, lt - layerT(k)) * 1.7);

    // ---- vertical streams between layers (the "residual stream")
    if (c > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 2;
      for (let i = 0; i < A_N; i++) for (let k = 0; k < A_L - 1; k++) {
        const a = P(colX(i), 0, Z[k]), b = P(colX(i), 0, Z[k + 1]), u = sstep(.3, .9, (Z[k + 1] - Z[k]) / A_G);
        const al = u * (.1 + .35 * Math.max(lit(k), lit(k + 1))) * (1 - k * .06) * SF; if (al < .02) continue;
        ctx.globalAlpha = al; ctx.strokeStyle = rgba(HUES[i], 1);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      ctx.restore();
    }

    // ---- cards, far to near
    for (let k = A_L - 1; k >= 0; k--) {
      const z = Z[k], fr = k === 0 ? 1 : z / (k * A_G), u = k === 0 ? 1 : sstep(0, .45, fr), uu = k === 0 ? 1 : sstep(.55, .97, fr);   // u: card, uu: its content (later)
      const fog = 1 - .4 * k / (A_L - 1), L = lit(k) * (k === 0 ? sstep(3.9, 4.375, lt) : 1);
      const cardA = (k === 0 ? eio(clamp((lt - 3.5) / 2.2)) : u) * fog * SF;
      if (cardA > .01) {
        const q = [[-820, -385], [820, -385], [820, 165], [-820, 165]].map(([x, y]) => P(x, y, z));
        ctx.save(); ctx.beginPath(); q.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
        ctx.globalAlpha = cardA; ctx.fillStyle = `rgba(30,50,110,${.1 + .12 * L})`; ctx.fill();
        ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 2; ctx.strokeStyle = `rgba(150,195,255,${.2 + .6 * L})`; ctx.stroke(); ctx.restore();
      }
      if (k === 0) {
        // faint "everyone looks back" arcs and the focus arcs
        const dim = 1 - .3 * sstep(1.2, 1.5, lt) * (1 - sstep(3.75, 4.3, lt)), keep = 1 - .4 * sstep(4.3, 5.4, lt);
        for (const [i, j, w, t0] of FAINT) {
          const f = eout(clamp((lt - t0) / .6)); if (f <= 0) continue;
          const dist = i - j, so = (dist - 1) * 10 - 8, dd = -(dist - 1) * 12 + 10;
          arcLine(z, colX(i) + so, colX(j) + dd, ARC_H[dist], f, HUES[i], HUES[j], 2 + w * 2.5, .36 * dim * keep, false, 28);
        }
        for (const [i, j, w, t0] of FOCUS) {
          const f = eout(clamp((lt - t0) / .62)); if (f <= 0) continue;
          const dist = i - j, so = (dist - 1) * 28 - 40, dd = -(dist - 1) * 6 + 8, al = Math.min(.74, .42 + w * .8) * keep;
          arcLine(z, colX(i) + so, colX(j) + dd, ARC_H[dist], f, HUES[i], HUES[j], 1.8 + w * 12, al, lt < 4.6);
          if (f > .95) { arrowTip(z, colX(i) + so, w, HUES[i], Math.min(.8, al + .1)); endDot(z, colX(j) + dd, w, HUES[j], Math.min(.8, al + .1)); }
          // data packets travelling from the attended token back into " the"
          if (w > .1) for (let m = 0; m < 3; m++) {
            const pk = clamp((lt - (2.6 + m * .2 + (.38 - w) * .3)) / .7); if (pk <= 0 || pk >= 1) continue;
            const [px, py] = arcPt(colX(i) + so, colX(j) + dd, ARC_H[dist], 1 - eio(pk)), pp = P(px, py, z);
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowDot(pp[0], pp[1], 18 + w * 34, 'rgba(255,190,240,A)', Math.sin(pk * PI) * .7); ctx.restore();
          }
          // weight label: an opaque pill on the arc's left shoulder (near the token being attended to), joined to it by a short leader
          const la = sstep(t0 + .5, t0 + .72, lt) * (1 - sstep(3.8, 4.4, lt)); if (la > .01) {
            const xs = colX(i) + so, xd = colX(j) + dd, tt = dist === 1 ? .6 : dist === 2 ? .74 : .8;
            const [px0, py0] = arcPt(xs, xd, ARC_H[dist], tt), [qx, qy] = arcPt(xs, xd, ARC_H[dist], tt + .03);
            let nx = qy - py0, ny = -(qx - px0); const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl; if (ny > 0) { nx = -nx; ny = -ny; }
            const ax = px0 + nx * 52, ay = py0 + ny * 52, pop = .88 + .12 * eback(clamp((lt - t0 - .5) / .35));
            atCard(0, 0, z, () => {
              ctx.save(); ctx.globalAlpha = la * .8; ctx.strokeStyle = rgba(HUES[j], 1); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px0, py0); ctx.lineTo(ax, ay); ctx.stroke(); ctx.restore();
              ctx.save(); ctx.translate(ax, ay); ctx.scale(pop, pop); ctx.globalAlpha = la; rrect(-54, -25, 108, 50, 14); ctx.fillStyle = 'rgb(8,14,34)'; ctx.fill();
              ctx.lineWidth = 2; ctx.strokeStyle = rgba(HUES[j], .9); ctx.stroke(); ctx.restore();
              text(w.toFixed(2), ax, ay + 2, { font: F_MONO, size: 32, weight: 700, color: '#fff', alpha: la * pop });
            });
          }
        }
      } else {
        const hu = uu * fog;
        if (hu > .03) for (const hd of HEADS[k]) {
          for (const [i, j, w] of hd.arcs) {
            const dist = i - j;
            arcLine(z, colX(i) + hd.off, colX(j) + hd.off * .6, ARC_H[dist] * .85, 1, hd.hue, hd.hue, 1.5 + w * 7, hu * (.26 + .5 * L), false, k >= 4 ? 8 : k >= 2 ? 10 : 14);
          }
        }
      }
      // chips + vectors
      for (let i = 0; i < A_N; i++) {
        let rise, grow, glow = 0, fillA = .16, strokeA = .9, vals = VEC[k][i], a = 1, pulse = 0, sz = 44;
        if (k === 0) {
          rise = eout(clamp((lt + .12 - i * .05) / .55)); grow = eout(clamp((lt - .15 - i * .05) / .5));
          sz = 44 * (1 + .45 * c);
          if (i === 4) {
            const q = sstep(1.1, 1.5, lt); glow = 18 + 8 * q; fillA = .18 + .06 * q;
            const mix = eio(clamp((lt - 3.0) / .7)); vals = vals.map((v, b) => lerp(v, MIXED[b], mix));
            pulse = Math.sin(PI * clamp((lt - 2.85) / .95));
          } else {
            const hit = FOCUS.find(f => f[1] === i); if (hit) { const g = sstep(hit[3] + .4, hit[3] + .8, lt); glow = 14 * g * (hit[2] > .1 ? 1 : .3); fillA = .16 + .1 * g * (hit[2] > .1 ? 1 : .3); }
          }
          glow *= 1 - .6 * c;
        } else { rise = uu; grow = 1; a = uu * fog; glow = 0; fillA = .12 + .12 * L; strokeA = .55 + .35 * L; }
        if (a * rise > .01) column(k, i, z, { rise, grow, glow, fillA, strokeA, vals, alpha: a * SF, lit: L, pulse, sz });
      }
    }

    // ---- attention annotations on the flat view
    const aIn = sstep(.9, 1.4, lt) * (1 - sstep(3.8, 4.3, lt));
    if (aIn > .01) {
      atCard(colX(0) - 98, 0, 0, () => {                                       // "vector" label joined to the bars by a leader; it rides with the camera
        ctx.save(); ctx.globalAlpha = aIn * .6; ctx.strokeStyle = '#b9c8ee'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(8, A_BAR_Y); ctx.lineTo(28, A_BAR_Y); ctx.stroke(); ctx.restore();
        text('向量 vector', 0, A_BAR_Y, { font: F_UI, size: 26, weight: 500, color: '#c9d6f5', alpha: aIn, align: 'right' });
      });
      const la = sstep(1.5, 2.0, lt) * (1 - sstep(3.6, 4.0, lt));
      text('线越粗，权重越大', 1780, 214, { font: F_UI, size: 30, weight: 600, color: '#eef3ff', alpha: la, align: 'right' });
      text('for “the”: thicker arc = more attention', 1780, 254, { font: F_UI, size: 25, color: '#dbe6ff', alpha: la, align: 'right' });
    }
    const sa = sstep(3.0, 3.35, lt) * (1 - sstep(4.2, 4.6, lt));
    if (sa > .01) atCard(colX(4), 0, 0, () => {
      text('Σ 权重 × 向量', 0, A_BAR_Y + 50, { font: F_UI, size: 27, weight: 700, color: '#ffc2ee', alpha: sa });
      text('weighted mix', 0, A_BAR_Y + 84, { font: F_UI, size: 23, color: '#e1e9ff', alpha: sa * .9 });
    });

    // ---- data wave rising through the stack
    const hold = SF;
    if (lt > T_WAVE - .1 && hold > .02) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const pf = (lt - T_WAVE) / T_STEP;
      for (let i = 0; i < A_N; i++) {
        for (let n = 0; n < 8; n += 2) {                                    // 4 dots per column; only the head of each pulse is near white
          const q = pf - n * .1; if (q < 0 || q > A_L - 1) continue;
          const pp = P(colX(i), -95, zAt(q, lt)), fade = (i === 4 ? 1 : 1 - sstep(A_L - 2, A_L - 1, q)) * sstep(.25, 1, q);
          tglow(pp[0], pp[1], (34 - n * 3.4) * pp[2] * .9, HUES[i], (1 - n / 8) * .25 * fade * hold * sstep(T_WAVE - .1, T_WAVE + .3, lt), n === 0 ? .7 : .2);
        }
        for (let m = 0; m < 3; m++) {                                       // quieter steady stream behind the wave
          const q = ((lt - 4.9) * 1.1 + m * 2.4 + i * .7) % 7.4; if (q < 0 || q > A_L - 1 || lt < 4.9 || lt > 6.4) continue;
          const pp = P(colX(i), -95, zAt(q, lt));
          tglow(pp[0], pp[1], 18 * pp[2] * 1.5, HUES[i], .3 * sstep(4.9, 5.4, lt) * (1 - sstep(6, 6.4, lt)) * (1 - q / 8) * hold * (i === 4 ? 1 : .6), .2);
        }
      }
      ctx.restore();
    }

    // ---- "dozens of layers" bracket
    const ba = sstep(5.2, 5.9, lt) * (1 - sstep(6.0, 6.5, lt));
    if (ba > .01) {
      const top = P(840, -300, Z[A_L - 1]), bot = P(840, 100, Z[0]), bx = Math.min(1560, Math.max(top[0], bot[0]) + 46);
      ctx.save(); ctx.globalAlpha = ba * .8; ctx.strokeStyle = 'rgba(190,215,255,.8)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(bx - 14, top[1]); ctx.lineTo(bx, top[1] + 6); ctx.lineTo(bx, bot[1] - 6); ctx.lineTo(bx - 14, bot[1]); ctx.stroke(); ctx.restore();
      const my = (top[1] + bot[1]) / 2;
      text('× 几十层', bx + 30, my - 22, { size: 46, weight: 700, color: '#fff', alpha: ba, align: 'left', glow: 'rgba(120,170,255,.6)', blur: 18 });
      text('× dozens of layers', bx + 30, my + 28, { font: F_UI, size: 28, color: '#cfe0ff', alpha: ba, align: 'left' });
    }

    // ---- the single vector that leaves the top, hand-off to scene 4 at (960, 220)
    const gather = sstep(5.7, T_VEC, lt);
    if (gather > 0) {
      const S0 = P(colX(4), -95, Z[A_L - 1]), E = [960, 220];
      const q = eout(clamp((lt - T_VEC) / .65));
      const bz = t => { const u = 1 - t, p1 = [S0[0], S0[1] - 150], p2 = [E[0], E[1] + 150];
        return [u * u * u * S0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * E[0], u * u * u * S0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * E[1]]; };
      const sc0 = Math.max(.3, S0[2] * 1.0), vp = lt >= T_VEC ? bz(q) : S0;
      // converging streams: every column of the top layer funnels into the vector as it forms and flies
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < A_N; i++) {
        const st = P(colX(i), -95, Z[A_L - 1]);
        for (let m = 0; m < 3; m++) {
          const p = clamp((lt - (5.55 + m * .24 + i * .03)) / .8); if (p <= 0 || p >= 1) continue;
          const e = eio(p), cx = (st[0] + vp[0]) / 2, cy = Math.min(st[1], vp[1]) - 70, u = 1 - e;
          const x = u * u * st[0] + 2 * u * e * cx + e * e * vp[0], y = u * u * st[1] + 2 * u * e * cy + e * e * vp[1];
          tglow(x, y, 22 + 10 * Math.sin(p * PI), HUES[i], Math.sin(p * PI) * (i === 4 ? .38 : .09), .3);   // only ' the' (the last token) feeds the output
        }
      }
      if (lt < T_VEC) glowDot(S0[0], S0[1], 30 + 38 * gather, 'rgba(170,215,255,A)', .14 * gather);
      ctx.restore();
      const va = sstep(5.95, 6.3, lt);
      if (lt >= T_VEC) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let n = 6; n >= 1; n--) { const qq = q - n * .06; if (qq <= 0) continue; const [x, y] = bz(qq); glowDot(x, y, 26 - n * 2.5, 'rgba(140,190,255,A)', .3 * (1 - n / 7) * (1 - q)); }
        ctx.strokeStyle = 'rgba(190,225,255,1)';
        for (const [t0, r0] of [[6.875, 60]]) {
          const k2 = clamp((lt - t0) / .5); if (k2 > 0 && k2 < 1) { ctx.globalAlpha = (1 - k2) * .3; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(960, 220, r0 + 90 * eout(k2), 0, TAU); ctx.stroke(); }
        }
        ctx.restore();
      }
      const grow = lt >= T_VEC ? eout(clamp((lt - T_VEC) / .5)) * .6 + .4 : .4 + .6 * sstep(5.95, T_VEC, lt) * .5;
      const flying = lt >= T_VEC ? (1 - q) : 0;
      vecGlyph(vp[0], vp[1], lerp(sc0, 1, lt >= T_VEC ? q : 0), va, Math.min(1, grow + (lt >= T_VEC ? .4 * q : 0)), flying, lerp(.2, .5, lt >= T_VEC ? q : 0));
      const la2 = sstep(6.55, 6.9, lt);
      if (la2 > .01 && SF > .02) { ctx.save(); ctx.globalAlpha = la2 * SF * .6; rrect(960 - 262, 332 - 22, 524, 44, 22); ctx.fillStyle = 'rgb(5,9,24)'; ctx.fill(); ctx.restore(); }
      text('上下文向量 · CONTEXT VECTOR', 960, 332, { font: F_UI, weight: 600, size: 24, ls: 4, color: '#c8d6f5', alpha: la2 });
      flare(960, 220, sstep(6.8, 7.0, lt) * (1 - sstep(6.95, 7.25, lt)) * .14, 560);
    }
  },
});
