// s3_attention: Transformer. Every token looks back at earlier tokens (causal attention), then the same row is
// revealed as one layer of a tall stack; data flows up through it and a single vector emerges at the top centre.
const R = mulberry(20260003);

const A_LAB = ['The', 'cat', 'sat', 'on', 'the'];
const A_N = 5, A_COLW = 270, A_NB = 9, A_L = 6, A_G = 125;               // tokens, column spacing, bars per vector, layers drawn, layer gap
const CW = 700, CT = -350, CB = 155;                                      // half width / top / bottom of a layer card in card-local units
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
const FAINT = [[1, 0, .45, .15], [2, 1, .4, .3], [2, 0, .22, .4], [3, 2, .5, .55], [3, 1, .2, .65], [3, 0, .1, .7]];   // [from, to, weight, appear time]
const FOCUS = [[4, 2, .38, 1.25, 72], [4, 3, .31, 1.875, 76], [4, 1, .19, 2.5, 79], [4, 0, .07, 2.8, 81]];              // [from, to, weight, appear time, ping midi]
const ARC_H = [0, 95, 175, 235, 285];                                    // apex height above the chip row by token distance

// ---- other layers: two "heads" each, different pattern and hue
function headArcs(type) {
  const a = [];
  for (let i = 1; i < A_N; i++) {
    if (type === 0) a.push([i, i - 1, .55 + R() * .35]);
    else if (type === 1) a.push([i, 0, .4 + R() * .5]);
    else if (type === 2) { if (i >= 2) a.push([i, i - 2, .4 + R() * .4]); }
    else if (type === 3) {
      const js = [...Array(i).keys()].map(j => [R(), j]).sort((p, q) => p[0] - q[0]).slice(0, 1).map(p => p[1]);
      js.forEach(j => a.push([i, j, .25 + R() * .5]));
    } else if (type === 4) { if (i === 4 || i === 2) for (let j = 0; j < i; j++) a.push([i, j, .2 + R() * .4]); }
  }
  return a;
}
const HEAD_HUES = [PAL.cyan, PAL.violet, PAL.pink];                        // three hues only, so the colour code stays legible
const HEAD_TYPES = [[3, 0], [2, 4], [0, 3], [1, 2], [4, 0], [3, 1], [2, 3]];
const HEADS = [null];
for (let k = 1; k < A_L; k++) {
  const [ta, tb] = HEAD_TYPES[(k - 1) % HEAD_TYPES.length], ha = k % 3, hb = (k + 1 + (k > 3 ? 1 : 0)) % 3;
  HEADS.push([{ arcs: headArcs(ta), hue: HEAD_HUES[ha], off: -10 }, { arcs: headArcs(tb), hue: HEAD_HUES[hb], off: 12 }]);
}

const DUST = Array.from({ length: 120 }, () => ({ x: R() * W, y: R() * H, z: .2 + R() * .8, p: R() * TAU }));

// ---- timing constants
const T_WAVE = 4.375, T_STEP = 1.875 / (A_L - 1), T_VEC = 6.25;          // wave leaves layer 0 at beat 7, reaches the top at beat 10
const layerT = k => T_WAVE + k * T_STEP;
const CAM_T0 = 3.95, CAM_T1 = 5.3;                                       // the flat view holds until 3.95; the tilt then takes 1.35 s and the stack holds from 5.4 on

// ---- cached glow sprites (built on first use, pure functions of their key): drawImage instead of a new radial gradient per call
const SPR = {};
function spr(key, build) { let c = SPR[key]; if (!c) { c = document.createElement('canvas'); c.width = c.height = 128; build(c.getContext('2d')); SPR[key] = c; } return c; }
function sdot(x, y, r, col, a) {                                           // same look as glowDot (white core, hue body); col like 'rgba(r,g,b,A)'
  if (a <= .003 || r < 1) return;
  const c = spr('d' + col, g => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.18, col.replace('A', .9)); gr.addColorStop(1, col.replace('A', 0)); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
  ctx.save(); ctx.globalAlpha = Math.min(1, a); ctx.drawImage(c, x - r, y - r, 2 * r, 2 * r); ctx.restore();
}
function tglow(x, y, r, hex, a, w) {                                       // soft glow with a hue-tinted core (w = how white the very centre is)
  if (a <= .003 || r < 1) return;
  const c = spr('t' + hex + w, g => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, rgba(mixH(hex, '#ffffff', w), 1)); gr.addColorStop(.22, rgba(hex, .75)); gr.addColorStop(1, rgba(hex, 0)); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
  ctx.save(); ctx.globalAlpha = Math.min(1, a); ctx.drawImage(c, x - r, y - r, 2 * r, 2 * r); ctx.restore();
}

// ---- 3D camera, rebuilt every frame (pure function of lt).
let CM = null, SF = 1, Y0 = -42, HS = 1, CTE = CT;                       // HS: arc height factor (arcs get lower as the camera pulls back); CTE: card top                                          // SF: global fade of the stack at the hand-off; Y0: arc start height (chips grow)
const CAM_CY = 590, PITCH = .5, D_END = 3500, F_END = 2400, TY = -60;
function camera(lt) {
  const e = eio(clamp((lt - CAM_T0) / (CAM_T1 - CAM_T0))), dr = clamp((lt - CAM_T0) / 3.6);
  CM = {
    yaw: -.17 * e + .07 * dr, pitch: lerp(0, PITCH, e), D: lerp(1500, D_END, e) - 140 * dr, F: lerp(1500, F_END, e),
    tx: 0, ty: lerp(0, TY, e), tz: lerp(0, (A_L - 1) / 2 * A_G, e), cx: 960, cy: lerp(A_ROW, CAM_CY, e),
  };
}
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
const zLayer = (k, lt) => k * A_G * eio(clamp((lt - 4.25 - k * .03) / .95));
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
const HV = [-0.7489, 0.6742, -0.7828, -0.374, 0.7344, -0.7477, -0.8836, -0.387, 0.7901, 0.7456, -0.9769, -0.4014];   // = s4_predict's VEC (VX=960, VY=220, label at VY+112), so the hand-off is the same object; do not change
const mixH = (a, b, k) => { const f = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }, A = f(a), B = f(b); return '#' + [0, 1, 2].map(i => Math.round(lerp(A[i], B[i], k)).toString(16).padStart(2, '0')).join(''); };
function column(k, i, z, o) {
  atCard(colX(i), 0, z, s => {
    const dy = (1 - o.rise) * 34, a = o.alpha * o.rise;
    if (a < .01) return;
    const sz = o.sz || 44;
    if (k === 0) { const cw = measure(A_LAB[i], sz) + sz, ch = sz * 1.7; ctx.save(); ctx.globalAlpha = a * .6; rrect(-cw / 2, dy - ch / 2, cw, ch, ch * .28); ctx.fillStyle = 'rgb(5,9,24)'; ctx.fill(); ctx.restore(); }
    if (k === 0) chip(A_LAB[i], 0, dy, { size: sz, color: HUES[i], alpha: a, glow: o.glow, fillA: o.fillA, strokeA: o.strokeA });
    else {                                                                 // upper layers: no ghost chip, just the token's pillar, a node where the arcs start, and its vector bars
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a * (.16 + .3 * o.lit); ctx.strokeStyle = rgba(HUES[i], 1); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, Y0 + 6 + dy); ctx.lineTo(0, A_BAR_Y - A_BAR_H + dy); ctx.stroke();
      ctx.globalAlpha = a * (.55 + .4 * o.lit); ctx.fillStyle = rgba(HUES[i], 1); ctx.beginPath(); ctx.arc(0, Y0 + 2 + dy, 7, 0, TAU); ctx.fill(); ctx.restore();
    }
    if (k === 0) { ctx.save(); ctx.globalAlpha = a * .4; ctx.strokeStyle = rgba(HUES[i], 1); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, dy + sz * .9); ctx.lineTo(0, A_BAR_Y - A_BAR_H - 6 + dy); ctx.stroke(); ctx.restore(); }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (o.pulse > .01) sdot(0, dy + A_BAR_Y, 56, 'rgba(255,214,140,A)', o.pulse * .16);
    ctx.fillStyle = rgba(HUES[i], .88);
    ctx.globalAlpha = a * ((k ? .55 : .75) + .25 * o.lit);
    const vals = o.vals;
    for (let b = 0; b < A_NB; b++) {
      const v = vals[b] * o.grow, h = v * A_BAR_H * (k ? .85 : 1), x = (b - (A_NB - 1) / 2) * 15;
      ctx.fillRect(x - 4, dy + A_BAR_Y - Math.max(h, 0), 8, Math.max(Math.abs(h), 1.5));
    }
    ctx.globalAlpha = a * .35; ctx.fillRect(-(A_NB * 15) / 2, dy + A_BAR_Y - .75, A_NB * 15, 1.5);
    if (o.mixOut > .01) {                                                  // the mixed vector: a crisp outline so the bars stay readable through the glow
      ctx.globalAlpha = a * o.mixOut * .9; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
      for (let b = 0; b < A_NB; b++) { const v = vals[b] * o.grow, h = v * A_BAR_H, x = (b - (A_NB - 1) / 2) * 15; ctx.strokeRect(x - 4, dy + A_BAR_Y - Math.max(h, 0), 8, Math.max(Math.abs(h), 1.5)); }
    }
    ctx.restore();
  });
}

// the single bright vector handed to scene 4: same look as s4_predict's drawVector (12 signed bars, cyan up / violet down, brackets, 240 px glow)
function vecGlyph(cx, cy, sc, a, grow, wob, gl = .5) {
  if (a <= 0) return;
  const n = HV.length, step = 30 * sc, x0 = cx - (n - 1) * step / 2;
  ctx.save(); ctx.globalAlpha = a;
  ctx.globalCompositeOperation = 'lighter'; sdot(cx, cy, 240 * sc, 'rgba(140,170,255,A)', gl * a);
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
    const c = eio(clamp((lt - CAM_T0) / (CAM_T1 - CAM_T0)));
    SF = 1 - .76 * sstep(6.25, 6.95, lt);                                     // the stack lets go (but stays as a ghost under the vector) while the vector stays at full brightness
    Y0 = -42 - 12 * c; HS = lerp(1, .62, c); CTE = lerp(CT, -240, c);

    // ---- dust motes drifting upward (depth parallax)
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#bcd8ff';
    for (const m of DUST) {
      const y = ((m.y - (lt + 3) * 16 * m.z) % H + H) % H, r = 1.4 + m.z * 1.8;
      ctx.globalAlpha = (.1 + .3 * m.z * (.6 + .4 * Math.sin(lt * 1.5 + m.p))) * sstep(0, .8, lt);
      ctx.fillRect(m.x + Math.sin(lt * .4 + m.p) * 10 * m.z, y, r, r);
    }
    ctx.restore();

    const Z = Array.from({ length: A_L + 2 }, (_, k) => zLayer(k, lt));
    const lit = k => sstep(layerT(k) - .12, layerT(k), lt) * Math.exp(-Math.max(0, lt - layerT(k)) * 1.7);

    // ---- vertical streams between layers (the "residual stream")
    if (c > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 2;
      for (let i = 0; i < A_N; i++) for (let k = 0; k < A_L - 1; k++) {
        const a = P(colX(i), Y0, Z[k]), b = P(colX(i), Y0, Z[k + 1]), u = sstep(.3, .9, (Z[k + 1] - Z[k]) / A_G);
        const al = u * (.1 + .35 * Math.max(lit(k), lit(k + 1))) * (1 - k * .06) * SF; if (al < .02) continue;
        ctx.globalAlpha = al; ctx.strokeStyle = rgba(HUES[i], 1);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      ctx.restore();
    }

    // ---- cards, far to near
    for (let k = A_L + 1; k >= 0; k--) {
      const z = Z[k], fr = k === 0 ? 1 : z / (k * A_G), u = k === 0 ? 1 : sstep(0, .45, fr), uu = k === 0 ? 1 : sstep(.55, .97, fr);   // u: card, uu: its content (later)
      if (k >= A_L) {                                                       // two faint empty frames beyond the last layer: "and more"
        const ga = u * (k === A_L ? .2 : .1) * SF; if (ga > .01) {
          const q = [[-CW, CTE], [CW, CTE], [CW, CB], [-CW, CB]].map(([x, y]) => P(x, y, z));
          ctx.save(); ctx.beginPath(); q.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = ga; ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgb(150,195,255)'; ctx.stroke(); ctx.restore();
        }
        continue;
      }
      const fog = 1 - .4 * k / (A_L - 1), L = lit(k) * (k === 0 ? sstep(3.9, 4.375, lt) : 1);
      const cardA = (k === 0 ? eio(clamp((lt - 4.05) / 1.1)) : u) * fog * SF;
      if (cardA > .01) {
        const q = [[-CW, CTE], [CW, CTE], [CW, CB], [-CW, CB]].map(([x, y]) => P(x, y, z));
        ctx.save(); ctx.beginPath(); q.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
        ctx.globalAlpha = cardA; ctx.fillStyle = `rgba(30,50,110,${.1 + .12 * L})`; ctx.fill();
        ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 2; ctx.strokeStyle = `rgba(150,195,255,${.2 + .6 * L})`; ctx.stroke(); ctx.restore();
      }
      if (k === 0) {
        // faint "everyone looks back" arcs and the focus arcs
        const dim = 1 - .3 * sstep(1.2, 1.5, lt) * (1 - sstep(3.9, 4.4, lt)), keep = 1 - .45 * sstep(4.4, 5.4, lt);
        for (const [i, j, w, t0] of FAINT) {
          const f = eout(clamp((lt - t0) / .5)); if (f <= 0) continue;
          const dist = i - j, so = (dist - 1) * 10 - 8, dd = -(dist - 1) * 12 + 10;
          arcLine(z, colX(i) + so, colX(j) + dd, ARC_H[dist] * HS, f, HUES[i], HUES[j], 2 + w * 2.5, .36 * dim * keep, false, 28);
        }
        for (const [i, j, w, t0] of FOCUS) {
          const f = eout(clamp((lt - t0) / .5)); if (f <= 0) continue;
          const dist = i - j, so = (dist - 1) * 34 - 50, dd = -(dist - 1) * 6 + 8, al = Math.min(.74, .42 + w * .8) * keep;
          arcLine(z, colX(i) + so, colX(j) + dd, ARC_H[dist] * HS, f, HUES[i], HUES[j], 1.8 + w * 12, al, lt < 4.6);
          if (f > .95) { arrowTip(z, colX(i) + so, w, HUES[i], Math.min(.8, al + .1)); endDot(z, colX(j) + dd, w, HUES[j], Math.min(.8, al + .1)); }
          // data packets travelling from the attended token back into " the"
          if (w > .1) for (let m = 0; m < 3; m++) {
            const pk = clamp((lt - (2.5 + m * .2 + (.38 - w) * .3)) / .7); if (pk <= 0 || pk >= 1) continue;
            const [px, py] = arcPt(colX(i) + so, colX(j) + dd, ARC_H[dist] * HS, 1 - eio(pk)), pp = P(px, py, z);
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; sdot(pp[0], pp[1], 14 + w * 26, 'rgba(255,190,240,A)', Math.sin(pk * PI) * .5 * (1 - .6 * sstep(.75, 1, pk))); ctx.restore();
          }
          // weight label: an opaque pill on the arc's left shoulder (near the token being attended to), joined to it by a short leader. The 0.07 arc stays thin and unlabelled.
          const la = w > .1 ? sstep(t0 + .3, t0 + .5, lt) * (1 - sstep(3.95, 4.4, lt)) : 0; if (la > .01) {
            const xs = colX(i) + so, xd = colX(j) + dd, tt = dist === 1 ? .6 : dist === 2 ? .74 : .8;
            const [px0, py0] = arcPt(xs, xd, ARC_H[dist] * HS, tt), [qx, qy] = arcPt(xs, xd, ARC_H[dist] * HS, tt + .03);
            let nx = qy - py0, ny = -(qx - px0); const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl; if (ny > 0) { nx = -nx; ny = -ny; }
            const ax = px0 + nx * 52, ay = py0 + ny * 52, pop = .88 + .12 * eback(clamp((lt - t0 - .3) / .35));
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
            arcLine(z, colX(i) + hd.off, colX(j) + hd.off * .6, ARC_H[dist] * HS * .9, 1, hd.hue, hd.hue, 1.5 + w * 5, hu * (.2 + .5 * L), false, k >= 4 ? 8 : k >= 2 ? 10 : 14);
          }
        }
      }
      // chips + vectors
      for (let i = 0; i < A_N; i++) {
        let rise, grow, glow = 0, fillA = .16, strokeA = .9, vals = VEC[k][i], a = 1, pulse = 0, sz = 44, mixOut = 0;
        if (k === 0) {
          rise = eout(clamp((lt + .12 - i * .05) / .55)); grow = eout(clamp((lt - .15 - i * .05) / .5));
          sz = 44 * (1 + .45 * c);
          if (i === 4) {
            const q = sstep(1.1, 1.5, lt); glow = 18 + 4 * q; fillA = .18 + .06 * q;
            const mix = eio(clamp((lt - 2.9) / .65)); vals = vals.map((v, b) => lerp(v, MIXED[b], mix)); mixOut = sstep(.1, .6, mix);
            pulse = Math.sin(PI * clamp((lt - 2.8) / .9));
          } else {
            const hit = FOCUS.find(f => f[1] === i); if (hit) { const g = sstep(hit[3] + .4, hit[3] + .8, lt); glow = 14 * g * (hit[2] > .1 ? 1 : .3); fillA = .16 + .1 * g * (hit[2] > .1 ? 1 : .3); }
          }
          glow *= 1 - .6 * c;
        } else { rise = uu; grow = 1; a = uu * fog; glow = 0; fillA = .12 + .12 * L; strokeA = .55 + .35 * L; }
        if (a * rise > .01) column(k, i, z, { rise, grow, glow, fillA, strokeA, vals, alpha: a * SF, lit: L, pulse, sz, mixOut });
      }
    }

    // ---- attention annotations on the flat view
    const aIn = sstep(.9, 1.4, lt) * (1 - sstep(3.9, 4.4, lt));
    if (aIn > .01) {
      atCard(colX(0) - 98, 0, 0, () => {                                       // "vector" label joined to the bars by a leader; it rides with the camera
        ctx.save(); ctx.globalAlpha = aIn * .7; ctx.strokeStyle = '#c9d6f5'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(8, A_BAR_Y); ctx.lineTo(28, A_BAR_Y); ctx.stroke(); ctx.restore();
        text('向量 vector', 0, A_BAR_Y, { font: F_UI, size: 28, weight: 500, color: '#dbe6ff', alpha: aIn * .9, align: 'right' });
      });
      const la = sstep(1.5, 2.0, lt) * (1 - sstep(3.7, 4.1, lt));
      text('线越粗，权重越大', 1790, 292, { font: F_ZH, size: 32, weight: 700, color: '#f4f7ff', alpha: la, align: 'right' });
      text('for “the”: thicker arc = more attention', 1790, 336, { font: F_UI, size: 25, weight: 500, color: '#e6eeff', alpha: la, align: 'right' });
    }
    const sa = sstep(2.95, 3.3, lt) * (1 - sstep(3.7, 4.0, lt));
    if (sa > .01) atCard(colX(4), 0, 0, () => {
      text('Σ 权重 × 向量', 0, A_BAR_Y + 50, { font: F_UI, size: 27, weight: 700, color: '#ffc2ee', alpha: sa });
      text('weighted mix', 0, A_BAR_Y + 84, { font: F_UI, size: 23, color: '#e1e9ff', alpha: sa * .9 });
    });

    // ---- data wave rising through the stack
    const hold = SF;
    if (lt > T_WAVE - .1 && lt < 6.6 && hold > .02) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const pf = (lt - T_WAVE) / T_STEP;
      for (let i = 0; i < A_N; i++) {
        for (let n = 0; n < 8; n += 2) {                                    // 4 dots per column; only the head of each pulse is near white
          const q = pf - n * .1; if (q < 0 || q > A_L - 1) continue;
          const pp = P(colX(i), Y0 + 4, zAt(q, lt)), fade = (i === 4 ? 1 : 1 - sstep(A_L - 2, A_L - 1, q)) * sstep(.25, 1, q);
          tglow(pp[0], pp[1], (34 - n * 3.4) * pp[2] * 1.15, HUES[i], (1 - n / 8) * .25 * fade * hold * sstep(T_WAVE - .1, T_WAVE + .3, lt), n === 0 ? .7 : .2);
        }
        for (let m = 0; m < 3; m++) {                                       // quieter steady stream behind the wave
          const q = ((lt - 4.9) * 1.1 + m * 2.4 + i * .7) % 7.4; if (q < 0 || q > A_L - 1 || lt < 4.9 || lt > 6.4) continue;
          const pp = P(colX(i), Y0 + 4, zAt(q, lt));
          tglow(pp[0], pp[1], 18 * pp[2] * 1.9, HUES[i], .3 * sstep(4.9, 5.4, lt) * (1 - sstep(6, 6.4, lt)) * (1 - q / 8) * hold * (i === 4 ? 1 : .6), .2);
        }
      }
      ctx.restore();
    }

    // ---- "dozens of layers" bracket + the "each hue = one head" key
    const ba = sstep(5.1, 5.6, lt) * (1 - sstep(6.1, 6.5, lt));
    if (ba > .01) {
      const top = P(CW, CTE, Z[A_L - 1]), bot = P(CW, CB, Z[0]), bx = Math.min(1580, Math.max(top[0], bot[0]) + 40);
      ctx.save(); ctx.globalAlpha = ba * .85; ctx.strokeStyle = 'rgba(205,225,255,.85)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(bx - 14, top[1]); ctx.lineTo(bx, top[1] + 6); ctx.lineTo(bx, bot[1] - 6); ctx.lineTo(bx - 14, bot[1]); ctx.stroke(); ctx.restore();
      const my = (top[1] + bot[1]) / 2;
      text('× 几十层', bx + 26, my - 24, { size: 50, weight: 700, color: '#fff', alpha: ba, align: 'left', glow: 'rgba(120,170,255,.6)', blur: 18 });
      text('dozens of layers', bx + 28, my + 26, { font: F_UI, size: 27, weight: 500, color: '#e6eeff', alpha: ba, align: 'left' });
    }
    const ha = sstep(5.25, 5.65, lt) * (1 - sstep(6.1, 6.45, lt));
    if (ha > .01) {
      const hx = 110, hy = 226;
      ctx.save(); ctx.globalAlpha = ha * .95;
      HEAD_HUES.forEach((hc, n) => { ctx.fillStyle = hc; rrect(hx + n * 22, hy - 20, 12, 40, 6); ctx.fill(); });
      ctx.restore();
      text('每种颜色 = 一个注意力头', hx + 84, hy - 8, { font: F_UI, size: 28, weight: 600, color: '#f4f7ff', alpha: ha, align: 'left' });
      text('each hue = one attention head', hx + 84, hy + 26, { font: F_UI, size: 23, weight: 500, color: '#d6e4ff', alpha: ha, align: 'left' });
    }

    // ---- the single vector that leaves the top, hand-off to scene 4 at (960, 220)
    const gather = sstep(5.6, T_VEC, lt);
    if (gather > 0) {
      const Zt = Z[A_L - 1], G = [960, P(0, CTE, Zt)[1] - 24], E = [960, 220];      // G: gathering point just above the top layer
      const q = eout(clamp((lt - T_VEC) / .65));
      const bz = t => { const u = 1 - t, p1 = [G[0], G[1] - 40], p2 = [E[0], E[1] + 60];
        return [u * u * u * G[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * E[0], u * u * u * G[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * E[1]]; };
      const sc0 = .55, vp = lt >= T_VEC ? bz(q) : G;
      // converging streams: every column of the top layer funnels into the vector as it forms (only ' the', the last token, carries the weight: it feeds the output)
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < A_N; i++) {
        const st = P(colX(i), Y0, Zt), cx = (st[0] + G[0]) / 2, cy = Math.min(st[1], G[1]) - 20, strong = i === 4;
        const pt = e => { const u = 1 - e; return [u * u * st[0] + 2 * u * e * cx + e * e * G[0], u * u * st[1] + 2 * u * e * cy + e * e * G[1]]; };
        const lw = sstep(5.55, 6.0, lt) * (1 - sstep(6.1, 6.4, lt)) * (strong ? .3 : .12);
        if (lw > .01) { ctx.globalAlpha = lw; ctx.strokeStyle = rgba(HUES[i], 1); ctx.lineWidth = strong ? 3 : 2; ctx.beginPath(); for (let n = 0; n <= 14; n++) { const [x, y] = pt(n / 14); n ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
        for (let m = 0; m < 4; m++) {
          const p = clamp((lt - (5.45 + m * .11 + i * .02)) / .62); if (p <= 0 || p >= 1) continue;
          const [x, y] = pt(eio(p));
          tglow(x, y, (strong ? 26 : 16) + 8 * Math.sin(p * PI), HUES[i], Math.sin(p * PI) * (strong ? .45 : .12), .12);
        }
      }
      if (lt < T_VEC) sdot(G[0], G[1], 40 + 40 * gather, 'rgba(170,215,255,A)', .12 * gather);
      ctx.restore();
      const va = sstep(5.95, 6.3, lt);
      if (lt >= T_VEC) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let n = 6; n >= 1; n--) { const qq = q - n * .06; if (qq <= 0) continue; const [x, y] = bz(qq); sdot(x, y, 26 - n * 2.5, 'rgba(140,190,255,A)', .3 * (1 - n / 7) * (1 - q)); }
        ctx.strokeStyle = 'rgba(190,225,255,1)';
        for (const [t0, r0] of [[6.875, 60]]) {
          const k2 = clamp((lt - t0) / .5); if (k2 > 0 && k2 < 1) { ctx.globalAlpha = (1 - k2) * .3; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(960, 220, r0 + 90 * eout(k2), 0, TAU); ctx.stroke(); }
        }
        ctx.restore();
      }
      const grow = lt >= T_VEC ? eout(clamp((lt - T_VEC) / .5)) * .6 + .4 : .4 + .6 * sstep(5.95, T_VEC, lt) * .5;
      const flying = lt >= T_VEC ? (1 - q) : 0;
      vecGlyph(vp[0], vp[1], lerp(sc0, 1, lt >= T_VEC ? q : 0), va, Math.min(1, grow + (lt >= T_VEC ? .4 * q : 0)), flying, lerp(.2, .5, lt >= T_VEC ? q : 0));
      const la2 = sstep(6.45, 6.8, lt);
      text('上下文向量 · CONTEXT VECTOR', 960, 332, { font: F_UI, weight: 600, size: 24, ls: 4, color: '#c8d6f5', alpha: la2 });
      flare(960, 220, sstep(6.8, 7.0, lt) * (1 - sstep(6.95, 7.25, lt)) * .14, 560);
    }
  },
});
