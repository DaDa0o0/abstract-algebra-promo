// s3_attention (2:50 cut, 20 s). Three pages on one row of tokens:
//   A (0-9.2)   look back: a word alone is not enough; every word looks back at EARLIER words (causal arcs)
//   B (9.2-14.4) weights: arcs get weights that add up to 1; a weighted mix of the attended vectors forms
//   C (14.4-20)  layers and heads: the row is revealed as one layer of a stack; a single context vector leaves the top centre on beat 31 (19.375 s)
// Performance: layers above the first are pre-rendered once into offscreen canvases (card + heads + token pillars + vector bars) and drawn with one
// affine drawImage each; glow sprites are cached; the number of live arcs is capped at ~10.
const R = mulberry(20260003);

const A_LAB = ['The', 'cat', 'sat', 'on', 'the'];
const A_N = 5, COLW = 270, A_NB = 9, A_L = 7, A_G = 112;                  // tokens, column spacing, bars per vector, layers drawn, layer gap (units)
const A_ROW = 500;                                                        // screen y of the token row in the flat view
const colX = i => (i - 2) * COLW;
const A_BAR_Y = 112, A_BAR_H = 36;
const CW = 640, CT_S = -176, CB_S = 150, Y0S = -54, HS_S = .36, CS = .85;  // stack-mode card: half width, top, bottom (card-local units), arc origin, arc height factor, cache scale

// ---- vectors (signed numbers) per layer and token
const randVec = () => Array.from({ length: A_NB }, () => (R() * 2 - 1) * .95);
const VEC = [];
for (let k = 0; k < A_L; k++) VEC.push(Array.from({ length: A_N }, (_, i) => k === 0 ? randVec() : randVec().map((v, b) => .45 * VEC[k - 1][i][b] + .55 * v)));
// layer-0 attention of the last token: weights over [The, cat, sat, on, the(itself)]; they add up to exactly 1
const FW = [.07, .19, .38, .31, .05];
const MIXED = VEC[0][0].map((_, b) => FW.reduce((s, w, j) => s + w * VEC[0][j][b], 0) * 1.7);

// ---- layer-0 arcs. Attention is causal: every arc runs from a LATER token back to an EARLIER one.
const FAINT = [[1, 0, .4, 4.75], [2, 1, .4, 4.9], [2, 0, .25, 5.0], [3, 2, .45, 5.15], [3, 1, .3, 5.3]];     // [from, to, weight, appear time]: "everyone looks back"
const FOCUS = [[4, 3, .31, 5.625, 72], [4, 2, .38, 6.25, 76], [4, 1, .19, 6.875, 79], [4, 0, .07, 9.375, 81]];  // [from, to, weight, appear time, ping midi]: the arcs of " the"
const ARC_H = [0, 90, 160, 215, 265];                                    // apex height above the chip row by token distance

// ---- the other layers: three "heads" each, with different patterns and hues
function headArcs(type) {
  const a = [];
  for (let i = 1; i < A_N; i++) {
    if (type === 0) a.push([i, i - 1, .55 + R() * .3]);                    // previous word
    else if (type === 1) { if (i >= 2) a.push([i, 0, .4 + R() * .4]); }    // the first word
    else if (type === 2) { if (i >= 2) a.push([i, i - 2, .4 + R() * .4]); }
    else if (type === 3) { if (i >= 2) a.push([i, Math.floor(R() * (i - 1)), .3 + R() * .4]); }
    else if (type === 4) { if (i === 4) for (let j = 0; j < i; j++) a.push([i, j, .2 + R() * .3]); }
  }
  return a;
}
const HEAD_HUES = [PAL.cyan, PAL.violet, PAL.pink];
const HEAD_TYPES = [[0, 1, 3], [3, 4, 0], [2, 0, 4], [1, 3, 2], [4, 2, 0], [0, 3, 1], [3, 1, 4]];
const HEADS = [null];
for (let k = 1; k < A_L; k++) HEADS.push(HEAD_TYPES[(k - 1) % HEAD_TYPES.length].map((t, h) => ({ arcs: headArcs(t), hue: HEAD_HUES[(h + k) % 3], off: (h - 1) * 16 })));
const HEAD0 = [{ arcs: headArcs(1), hue: PAL.violet, off: -4 }, { arcs: headArcs(0), hue: PAL.pink, off: 14 }];   // extra heads that appear on layer 0 when the camera pulls back

const DUST = Array.from({ length: 120 }, () => ({ x: R() * W, y: R() * H, z: .2 + R() * .8, p: R() * TAU }));

// ---- timing constants (local seconds; beats at k * .625)
const T_BEAT = 19.375;                                                    // the context vector leaves on beat 31
const CAM_T0 = 14.4, CAM_T1 = 16.4;                                       // tilt / pull-back
const T_W1 = 15.0, T_W2 = 17.5, T_STEP = .3125;                           // wave 1 (reveal) and wave 2 (ends at the top on the beat): half a beat per layer
const layerT = (k, w) => w + k * T_STEP;
const PILL = { 3: 10.5, 2: 10.25, 1: 10.0, 0: 9.75 };                     // pill pop time per arc, by target token index j

// ---- cached glow sprites: drawImage instead of a new radial gradient per call
const SPR = {};
function spr(key, build) { let c = SPR[key]; if (!c) { c = document.createElement('canvas'); c.width = c.height = 128; build(c.getContext('2d')); SPR[key] = c; } return c; }
function sdot(x, y, r, col, a) {                                           // same look as glowDot (white core, hue body); col like 'rgba(r,g,b,A)'
  if (a <= .003 || r < 1) return;
  const c = spr('d' + col, g => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.18, col.replace('A', .9)); gr.addColorStop(1, col.replace('A', 0)); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
  ctx.save(); ctx.globalAlpha = Math.min(1, a); ctx.drawImage(c, x - r, y - r, 2 * r, 2 * r); ctx.restore();
}
const mixH = (a, b, k) => { const f = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }, A = f(a), B = f(b); return '#' + [0, 1, 2].map(i => Math.round(lerp(A[i], B[i], k)).toString(16).padStart(2, '0')).join(''); };
function tglow(x, y, r, hex, a, w) {                                       // soft glow with a hue-tinted core (w = how white the very centre is)
  if (a <= .003 || r < 1) return;
  const c = spr('t' + hex + w, g => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, rgba(mixH(hex, '#ffffff', w), 1)); gr.addColorStop(.22, rgba(hex, .75)); gr.addColorStop(1, rgba(hex, 0)); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
  ctx.save(); ctx.globalAlpha = Math.min(1, a); ctx.drawImage(c, x - r, y - r, 2 * r, 2 * r); ctx.restore();
}

// ---- 3D camera (pure function of lt, rebuilt every frame). The cards are flat in card-local units and mapped affinely onto the screen.
let CM = null, SF = 1;                                                    // SF: global fade of the stack at the hand-off
const CAM_END = { D: 3400, F: 2150, pitch: .82, cy: 560, ty: -30 };
function camera(lt) {
  const e = eio(clamp((lt - CAM_T0) / (CAM_T1 - CAM_T0))), dr = clamp((lt - CAM_T0) / 4);
  CM = {
    yaw: -.1 * e + .04 * dr, pitch: lerp(0, CAM_END.pitch, e), D: lerp(1500, CAM_END.D, e) - 120 * dr, F: lerp(1500, CAM_END.F, e),
    tx: 0, ty: lerp(0, CAM_END.ty, e), tz: lerp(0, (A_L - 1) / 2 * A_G, e), cx: 960, cy: lerp(A_ROW, CAM_END.cy, e),
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
const zLayer = (k, lt) => k * A_G * eio(clamp((lt - 14.9 - k * .05) / 1.3));
function zAt(q, lt) { const k = clamp(Math.floor(q), 0, A_L - 2), f = clamp(q - k, 0, 1); return lerp(zLayer(k, lt), zLayer(k + 1, lt), f); }

// ---- one layer of the stack, pre-rendered (card-local units, origin = row centre, scale CS)
function buildLayer(k) {
  const c = document.createElement('canvas'); c.width = Math.ceil(2 * CW * CS) + 2; c.height = Math.ceil((CB_S - CT_S) * CS) + 2;
  const g = c.getContext('2d'); g.scale(CS, CS); g.translate(CW, -CT_S);
  g.beginPath(); g.roundRect(-CW + 2, CT_S + 2, 2 * CW - 4, CB_S - CT_S - 4, 16);
  g.fillStyle = 'rgba(14,22,56,.62)'; g.fill();                           // a dark glass plate: nearer layers dim the ones behind them
  g.globalCompositeOperation = 'lighter'; g.lineWidth = 2.5; g.strokeStyle = 'rgba(150,195,255,.5)'; g.stroke();
  const heads = k === 0 ? HEAD0 : HEADS[k];
  g.lineCap = 'round';
  for (const hd of heads) for (const [i, j, w] of hd.arcs) {
    const xs = colX(i) + hd.off, xd = colX(j) + hd.off * .6, h = ARC_H[i - j] * HS_S, H = h / .75;
    g.beginPath(); g.moveTo(xs, Y0S); g.bezierCurveTo(xs, Y0S - H, xd, Y0S - H, xd, Y0S - 6);
    g.strokeStyle = rgba(hd.hue, 1); g.globalAlpha = .08; g.lineWidth = (1.5 + w * 3.5) * 2.6; g.stroke();
    g.globalAlpha = .75; g.lineWidth = 1.6 + w * 3.5; g.stroke();
  }
  g.globalAlpha = 1;
  if (k > 0) for (let i = 0; i < A_N; i++) {                              // token pillar, node and a small vector
    const x = colX(i); g.strokeStyle = rgba(HUES[i], .3); g.lineWidth = 2; g.beginPath(); g.moveTo(x, Y0S + 6); g.lineTo(x, A_BAR_Y - A_BAR_H * .85); g.stroke();
    g.fillStyle = rgba(HUES[i], .8); g.beginPath(); g.arc(x, Y0S + 2, 7, 0, TAU); g.fill();
    g.fillStyle = rgba(HUES[i], .62);
    for (let b = 0; b < A_NB; b++) { const v = VEC[k][i][b], h = v * A_BAR_H * .85, bx = x + (b - (A_NB - 1) / 2) * 15; g.fillRect(bx - 4, A_BAR_Y - Math.max(h, 0), 8, Math.max(Math.abs(h), 1.5)); }
    g.fillStyle = rgba(HUES[i], .3); g.fillRect(x - (A_NB * 15) / 2, A_BAR_Y - .75, A_NB * 15, 1.5);
  }
  return c;
}
const LAYER_CV = Array.from({ length: A_L }, (_, k) => buildLayer(k));
function drawLayerCache(k, z, alpha, lit) {                               // one affine drawImage (+ one more for the "lit" glow)
  if (alpha < .01) return;
  atCard(0, 0, z, () => {
    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha); ctx.drawImage(LAYER_CV[k], -CW, CT_S, 2 * CW, CB_S - CT_S);
    ctx.globalCompositeOperation = 'lighter';
    if (lit > .02) { ctx.globalAlpha = Math.min(1, alpha * lit * .25); ctx.drawImage(LAYER_CV[k], -CW, CT_S, 2 * CW, CB_S - CT_S); }
    ctx.restore();
  });
}

// ---- layer-0 arcs, drawn live in card-local coordinates (the card transform is affine)
function arcPt(xs, xd, h, t, y0) {
  const H = h / .75, u = 1 - t, b0 = u * u * u, b1 = 3 * u * u * t, b2 = 3 * u * t * t, b3 = t * t * t;
  return [b0 * xs + b1 * xs + b2 * xd + b3 * xd, b0 * y0 + b1 * (y0 - H) + b2 * (y0 - H) + b3 * (y0 - 6)];
}
function arcStroke(xs, xd, h, f, y0, c0, c1, lw, alpha, ns = 22) {
  if (alpha < .015 || f <= 0) return;
  const pts = []; for (let n = 0; n <= ns; n++) pts.push(arcPt(xs, xd, h, f * n / ns, y0));
  let st; if (c0 === c1) st = rgba(c0, 1); else { st = ctx.createLinearGradient(xs, 0, xd, 0); st.addColorStop(0, rgba(c0, 1)); st.addColorStop(1, rgba(c1, 1)); }
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = st; ctx.globalCompositeOperation = 'lighter';
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
  ctx.globalAlpha = alpha * .12; ctx.lineWidth = lw * 2.5; ctx.stroke();
  ctx.globalAlpha = alpha; ctx.lineWidth = lw; ctx.stroke();
  ctx.restore();
}
function arrowTip(xq, y0, w, col, alpha) {                                 // arrowhead on the querying token: information flows INTO it
  if (alpha < .02) return;
  const s = 9 + w * 12;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha; ctx.fillStyle = rgba(col, 1);
  ctx.beginPath(); ctx.moveTo(xq, y0 + 3); ctx.lineTo(xq - s * .7, y0 - s * 1.2); ctx.lineTo(xq + s * .7, y0 - s * 1.2); ctx.closePath(); ctx.fill(); ctx.restore();
}

// the single bright vector handed to scene 4: same look as s4_predict's drawVector (12 signed bars, cyan up / violet down, brackets, 240 px glow)
const HV = [-0.7489, 0.6742, -0.7828, -0.374, 0.7344, -0.7477, -0.8836, -0.387, 0.7901, 0.7456, -0.9769, -0.4014];   // = s4_predict's VEC (VX=960, VY=220, label at VY+112), so the hand-off is the same object; do not change
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

const SUBS = [[0.4, 4.4, '光知道词义还不够，还得结合上下文', 'Knowing each word is not enough: it must be read in context'],
  [4.7, 9.0, 'Transformer 里，每个词都会回看前面的词', 'In a Transformer, each word looks back at the words before it'],
  [9.4, 14.2, '注意力决定谁更重要：权重越大，影响越大', 'Attention decides who matters: a bigger weight means more influence'],
  [14.6, 19.6, '几十层叠加，每层有许多个“头”，语境越来越丰富', 'Dozens of layers, each with many heads: the context grows richer']];

// arc geometry for the four arcs of " the" (start offsets spread along the top of the chip so the arrowheads do not pile up)
const arcGeo = (i, j) => { const dist = i - j; return { xs: colX(i) + (dist - 1) * 34 - 50, xd: colX(j) + (-(dist - 1) * 6 + 8), h: ARC_H[dist], dist }; };

scene({
  id: 'attention', start: 16, len: 8, fi: .25, fo: 0, mb: 2, bloom: 1,
  ch: ['03', '注意力', 'ATTENTION'],
  subs: SUBS,
  sfx: [[0, 'swell', { dur: 2.5 }],
    ...[0, 1, 2, 3, 4].map(i => [.2 + i * .13, 'chip', { midi: [67, 69, 71, 72, 74][i] }]),
    [1.9, 'pop'], [3.125, 'chime', { midi: 84 }],
    ...FAINT.map(f => [f[3], 'tick', { hi: true }]),
    ...FOCUS.map(f => [f[3], 'ping', { midi: f[4] }]),
    [9.375, 'swish'], [9.75, 'blip', { midi: 72 }], [10.0, 'blip', { midi: 74 }], [10.25, 'blip', { midi: 77 }], [10.5, 'blip', { midi: 79 }],
    [10.7, 'tick', { hi: true }], [10.85, 'tick', { hi: true }], [11.0, 'tick', { hi: true }], [11.15, 'tick', { hi: true }], [11.25, 'chime', { midi: 88 }],
    [14.375, 'whoosh', { dur: 1.7 }],
    ...Array.from({ length: A_L }, (_, k) => [layerT(k, T_W1), 'blip', { midi: 60 + k * 2 }]),
    [15.9, 'swell', { dur: 2.0 }],
    [18.125, 'riser', { dur: 1.25 }],
    ...Array.from({ length: 4 }, (_, k) => [layerT(k + 2, T_W2), 'tick', { hi: true }]),
    [T_BEAT, 'hit', { k: .5 }], [T_BEAT, 'shimmer'], [T_BEAT, 'whoosh', { dur: .9 }], [19.75, 'sparkle', { dur: .5 }]],
  hits: [[T_BEAT, .15]],
  cam: (lt) => { const k = 1 - sstep(17.5, 19.0, lt); return { z: 1 + .02 * Math.sin(PI * clamp(lt / 19)) * k, x: 8 * Math.sin(lt * .3) * k, y: 5 * Math.sin(lt * .23 + 1) * k }; },
  draw(lt, d, T) {
    camera(lt);
    glDraw(1, { time: T * .8, tint: [.22, .34, .80], amp: .7 });
    const c = eio(clamp((lt - CAM_T0) / (CAM_T1 - CAM_T0)));
    SF = 1 - .92 * sstep(T_BEAT + .1, T_BEAT + .55, lt);                      // the stack lets go as the vector leaves, but stays as a faint ghost
    const Y0 = lerp(-42, Y0S, c), HS = lerp(1, HS_S, c);
    const Z = Array.from({ length: A_L + 2 }, (_, k) => zLayer(k, lt));
    const lit = (k, w) => sstep(layerT(k, w) - .15, layerT(k, w), lt) * Math.exp(-Math.max(0, lt - layerT(k, w)) * 2.2);
    const litAll = k => Math.max(lit(k, T_W1) * (1 - sstep(16.8, 17.1, lt)), lit(k, T_W2));

    // ---- dust motes drifting upward (depth parallax)
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#bcd8ff';
    for (const m of DUST) {
      const y = ((m.y - (lt + 3) * 16 * m.z) % H + H) % H, r = 1.4 + m.z * 1.8;
      ctx.globalAlpha = (.1 + .3 * m.z * (.6 + .4 * Math.sin(lt * 1.5 + m.p))) * sstep(0, .8, lt);
      ctx.fillRect(m.x + Math.sin(lt * .4 + m.p) * 10 * m.z, y, r, r);
    }
    ctx.restore();

    // ---- vertical streams between layers (the "residual stream")
    if (c > .3) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 2;
      for (let i = 0; i < A_N; i++) for (let k = 0; k < A_L - 1; k++) {
        const a = P(colX(i), Y0, Z[k]), b = P(colX(i), Y0, Z[k + 1]), u = sstep(.3, .9, (Z[k + 1] - Z[k]) / A_G);
        const al = u * (.1 + .3 * Math.max(litAll(k), litAll(k + 1))) * (1 - k * .06) * SF; if (al < .02) continue;
        ctx.globalAlpha = al; ctx.strokeStyle = rgba(HUES[i], 1);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      ctx.restore();
    }

    // ---- upper layers, far to near (pre-rendered)
    for (let k = A_L + 1; k >= 1; k--) {
      const z = Z[k], fr = z / (k * A_G), fog = 1 - .6 * k / (A_L - 1);
      if (k >= A_L) {                                                       // two faint empty frames beyond the last layer: "and more"
        const ga = sstep(.3, .9, fr) * (k === A_L ? .22 : .11) * SF * (1 - sstep(18.75, 19.1, lt));
        if (ga > .01) {
          const q = [[-CW, CT_S], [CW, CT_S], [CW, CB_S], [-CW, CB_S]].map(([x, y]) => P(x, y, z));
          ctx.save(); ctx.beginPath(); q.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = ga; ctx.lineWidth = 1.5; ctx.setLineDash([10, 10]); ctx.strokeStyle = 'rgb(150,195,255)'; ctx.stroke(); ctx.restore();
        }
        continue;
      }
      drawLayerCache(k, z, sstep(.15, .85, fr) * fog * SF, litAll(k));
    }

    // ---- layer 0: the live row (chips, vectors, arcs); its card and two extra heads fade in as the camera pulls back
    const keep = (1 - .55 * sstep(14.4, 16.2, lt)) * (1 - sstep(T_BEAT + .1, T_BEAT + .55, lt));
    drawLayerCache(0, Z[0], sstep(14.9, 16.1, lt) * SF, litAll(0));
    const pageB = 1 - sstep(14.0, 14.4, lt);                                // page B annotations exit
    atCard(0, 0, Z[0], () => {
      const m = eio(clamp((lt - 9.4) / .8));                                // arcs take their weights
      // faint arcs ("everyone looks back")
      const faintA = lerp(.4, .2, sstep(5.6, 6.4, lt)) * keep;
      for (const [i, j, w, t0] of FAINT) {
        const f = eout(clamp((lt - t0) / .5)); if (f <= 0) continue;
        const dist = i - j, so = (dist - 1) * 10 - 8, dd = -(dist - 1) * 12 + 10;
        arcStroke(colX(i) + so, colX(j) + dd, ARC_H[dist] * .8 * HS, f, Y0, HUES[i], HUES[j], 2.4 * (1 - .4 * c), faintA);
      }
      // the focus arcs of " the"
      for (const [i, j, w, t0] of FOCUS) {
        const f = eout(clamp((lt - t0) / .6)); if (f <= 0) continue;
        const g = arcGeo(i, j), lw = lerp(4.2, 2 + w * 14, m), al = lerp(.62, Math.min(.86, .4 + w * 1.0), m) * keep;
        arcStroke(g.xs, g.xd, g.h * HS, f, Y0, HUES[i], HUES[j], lw * (1 - .5 * c), al, 26);
        if (f > .95) arrowTip(g.xs, Y0, lerp(.3, w, m), HUES[i], Math.min(.85, al + .15) * (1 - sstep(T_BEAT + .1, T_BEAT + .55, lt)));
        // a packet of information travels from the attended token back into " the": once in page A, as a slow stream in page B
        const once = clamp((lt - (t0 + .45)) / .9), strm = sstep(10.5, 11.2, lt) * (1 - sstep(14.0, 14.5, lt));
        const nP = lt > 9.2 ? 2 : 1;
        for (let n = 0; n < nP; n++) {
          let pk, a;
          if (lt < 9.2 || strm < .01) { pk = once; a = Math.sin(clamp(pk) * PI) * .5; if (pk <= 0 || pk >= 1) continue; }
          else { pk = ((lt - 10.5) * .3 + n * .5 + j * .17) % 1; a = Math.sin(pk * PI) * (.2 + .6 * w) * strm; }
          const [px, py] = arcPt(g.xs, g.xd, g.h * HS, 1 - eio(pk), Y0);
          sdot(px, py, 14 + w * 40, 'rgba(255,190,240,A)', a);
        }
      }
      // weight pills on the arcs (page B): opaque so the number stays readable; one at the apex of each arc
      for (const [i, j, w, t0] of FOCUS) {
        const pa = sstep(PILL[j], PILL[j] + .3, lt) * pageB; if (pa < .01) continue;
        const g = arcGeo(i, j), [px, py] = arcPt(g.xs, g.xd, g.h * HS, .5, Y0), pop = .86 + .14 * eback(clamp((lt - PILL[j]) / .4));
        ctx.save(); ctx.translate(px, py); ctx.scale(pop, pop); ctx.globalAlpha = pa; rrect(-54, -25, 108, 50, 15); ctx.fillStyle = 'rgb(7,13,32)'; ctx.fill();
        ctx.lineWidth = 2.5; ctx.strokeStyle = rgba(HUES[j], .95); ctx.stroke(); ctx.restore();
        text(w.toFixed(2), px, py + 2, { font: F_MONO, size: 32, weight: 700, color: '#fff', alpha: pa * pop });
      }
    });

    // ---- chips and vectors of layer 0: upright "billboards" anchored on the card (so the text is never squashed by the tilt)
    {
      const wMix = eio(clamp((lt - 10.7) / .8)), m = eio(clamp((lt - 9.4) / .8));   // the vector of " the" turns into the weighted mix
      for (let i = 0; i < A_N; i++) {
        const pc = P(colX(i), 0, Z[0]), x = 0, rise = eout(clamp((lt - .1 - i * .09) / .6)), grow = eout(clamp((lt - .3 - i * .09) / .6));
        let glow = 0, fillA = .16, vals = VEC[0][i], mixOut = 0, pulse = 0;
        const sz = 44 * (1 + .45 * c);
        if (i === 4) {
          const q = sstep(1.25, 1.9, lt); glow = 10 + 14 * q + 6 * q * Math.sin(lt * 2.4); fillA = .16 + .1 * q;
          vals = vals.map((v, b) => lerp(v, MIXED[b], wMix)); mixOut = sstep(.1, .7, wMix); pulse = Math.sin(PI * clamp((lt - 10.9) / 1.1));
        } else {
          const f = FOCUS.find(ff => ff[1] === i), g = f ? sstep(f[3] + .3, f[3] + .8, lt) : 0, w = f ? f[2] : 0;
          if (f) { glow = lerp(12 * g, 4 + 34 * w, m * g); fillA = lerp(.16 + .08 * g, .12 + .4 * w, m * g); }
        }
        glow *= 1 - .6 * c;
        const dy = (1 - rise) * 34, a = rise * (1 - sstep(T_BEAT + .1, T_BEAT + .6, lt)), yk = 1 - .3 * c; if (a < .01) continue;
        const cw = measure(A_LAB[i], sz) + sz, ch = sz * 1.7;
        ctx.save(); ctx.translate(pc[0], pc[1]); ctx.scale(pc[2], pc[2]);
        ctx.save(); ctx.globalAlpha = a * .6; rrect(x - cw / 2, dy - ch / 2, cw, ch, ch * .28); ctx.fillStyle = 'rgb(5,9,24)'; ctx.fill(); ctx.restore();
        chip(A_LAB[i], x, dy, { size: sz, color: HUES[i], alpha: a, glow, fillA });
        ctx.save(); ctx.translate(0, dy + sz * .9); ctx.scale(1, yk); ctx.translate(0, -(dy + sz * .9));            // the vector below the chip lies on the card: compress it with the tilt
        ctx.save(); ctx.globalAlpha = a * .4; ctx.strokeStyle = rgba(HUES[i], 1); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, dy + sz * .9); ctx.lineTo(x, A_BAR_Y - A_BAR_H - 6 + dy); ctx.stroke(); ctx.restore();
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        if (pulse > .01) sdot(x, dy + A_BAR_Y, 70, 'rgba(255,214,140,A)', pulse * .2);
        ctx.fillStyle = rgba(HUES[i], .88); ctx.globalAlpha = a * .8;
        for (let b = 0; b < A_NB; b++) {
          const v = vals[b] * grow, h = v * A_BAR_H, bx = x + (b - (A_NB - 1) / 2) * 15;
          ctx.fillRect(bx - 4, dy + A_BAR_Y - Math.max(h, 0), 8, Math.max(Math.abs(h), 1.5));
        }
        ctx.globalAlpha = a * .35; ctx.fillRect(x - (A_NB * 15) / 2, dy + A_BAR_Y - .75, A_NB * 15, 1.5);
        if (mixOut > .01) { ctx.globalAlpha = a * mixOut * .9; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; for (let b = 0; b < A_NB; b++) { const v = vals[b] * grow, h = v * A_BAR_H, bx = x + (b - (A_NB - 1) / 2) * 15; ctx.strokeRect(bx - 4, dy + A_BAR_Y - Math.max(h, 0), 8, Math.max(Math.abs(h), 1.5)); } }
        ctx.restore();
        ctx.restore();
        ctx.restore();
      }
    }

    atCard(0, 0, Z[0], () => {

      // ---- annotations (all in card-local units; flat view only)
      // page A: "vector" label
      const vl = sstep(1.0, 1.5, lt) * (1 - sstep(8.6, 9.2, lt)) * (1 - c);
      if (vl > .01) {
        ctx.save(); ctx.globalAlpha = vl * .7; ctx.strokeStyle = '#c9d6f5'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(colX(0) - 90, A_BAR_Y); ctx.lineTo(colX(0) - 62, A_BAR_Y); ctx.stroke(); ctx.restore();
        text('向量 · vector', colX(0) - 100, A_BAR_Y, { font: F_UI, size: 30, weight: 700, color: '#f2f6ff', alpha: vl, align: 'right' });
      }
      // page A1: the question above " the", and the context bracket over the words before it
      const qa = sstep(1.9, 2.4, lt) * (1 - sstep(4.0, 4.5, lt));
      if (qa > .01) {
        const bob = Math.sin(lt * 2.2) * 5, pop = .85 + .15 * eback(clamp((lt - 1.9) / .5));
        ctx.save(); ctx.translate(colX(4), -112 + bob); ctx.scale(pop, pop);
        sdot(0, 0, 110, 'rgba(255,150,230,A)', qa * .22);
        text('?', 0, 6, { font: F_UI, size: 120, weight: 700, color: '#ffc8f0', alpha: qa, glow: 'rgba(255,120,220,.8)', blur: 30 });
        ctx.restore();
        text('只有这一个词，还猜不出下一个', colX(4) + 245, -250, { font: F_ZH, size: 32, weight: 700, color: '#f4f7ff', alpha: qa, align: 'right' });
        text('“the” alone cannot tell what comes next', colX(4) + 245, -208, { font: F_UI, size: 26, weight: 500, color: '#e0e9ff', alpha: qa * .95, align: 'right' });
      }
      const ba = sstep(2.9, 3.4, lt) * (1 - sstep(4.0, 4.5, lt));
      if (ba > .01) {
        const x0 = colX(0) - 80, x1 = colX(3) + 80, by = -76, lift = (1 - eout(clamp((lt - 2.9) / .6))) * 14;
        ctx.save(); ctx.globalAlpha = ba * .85; ctx.strokeStyle = 'rgba(200,220,255,.9)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.shadowColor = 'rgba(140,180,255,.8)'; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.moveTo(x0, by + 20 - lift); ctx.lineTo(x0, by - lift); ctx.lineTo(x1, by - lift); ctx.lineTo(x1, by + 20 - lift); ctx.stroke(); ctx.restore();
        text('上下文 · context', (x0 + x1) / 2, by - 62 - lift, { font: F_ZH, size: 40, weight: 700, color: '#fff', alpha: ba, glow: 'rgba(120,170,255,.6)', blur: 18 });
        text('the words before it', (x0 + x1) / 2, by - 20 - lift, { font: F_UI, size: 26, weight: 500, color: '#dbe6ff', alpha: ba * .9 });
      }
      // page A2: causal note (only earlier words)
      const ca = sstep(7.2, 7.7, lt) * (1 - sstep(8.7, 9.2, lt));
      if (ca > .01) {
        text('只看前面的词', colX(4) + 330, -245, { font: F_ZH, size: 34, weight: 700, color: '#f4f7ff', alpha: ca, align: 'right' });
        text('only words that came earlier', colX(4) + 330, -202, { font: F_UI, size: 26, weight: 500, color: '#e0e9ff', alpha: ca * .95, align: 'right' });
      }
      // page B: weights strip (a distribution that adds up to 1) and the "weighted mix" label
      const sa = sstep(10.4, 10.8, lt) * pageB;
      if (sa > .01) {
        const sx0 = -650, sw = 1300, sy = 300, sh = 32, wipe = eio(clamp((lt - 10.5) / .8));
        text('“the” 的注意力权重', sx0, sy - 44, { font: F_ZH, size: 30, weight: 700, color: '#f4f7ff', alpha: sa, align: 'left' });
        text('attention weights of “the”', sx0 + measure('“the” 的注意力权重', 30, F_ZH, 700) + 30, sy - 44, { font: F_UI, size: 24, weight: 500, color: '#dbe6ff', alpha: sa * .9, align: 'left' });
        text('总和 = 1.00', sx0 + sw, sy - 44, { font: F_MONO, size: 30, weight: 700, color: '#fff', alpha: sa * sstep(11.2, 11.6, lt), align: 'right' });
        let cx = sx0;
        for (let j = 0; j < 5; j++) {
          const w = FW[j], wd = w * sw, vis = clamp((wipe * sw - (cx - sx0)) / wd);
          if (vis > 0) {
            ctx.save(); ctx.globalAlpha = sa; rrect(cx + 2, sy - sh / 2, Math.max(2, wd * vis - 4), sh, 7); ctx.fillStyle = rgba(HUES[j], .26); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = rgba(HUES[j], .95); ctx.stroke(); ctx.restore();
            if (vis > .95) text(w.toFixed(2), cx + wd / 2, sy + 1, { font: F_MONO, size: 24, weight: 700, color: '#fff', alpha: sa, glow: 'rgba(0,0,0,.8)', blur: 6 });
            if (vis > .95) text(j === 4 ? 'the（自己 self）' : A_LAB[j], j === 4 ? cx + wd - 4 : cx + wd / 2, sy + 42, { font: F_MONO, size: 24, weight: 500, color: HUES[j], alpha: sa * .95, align: j === 4 ? 'right' : 'center' });
          }
          cx += wd;
        }
        const la = sstep(11.0, 11.4, lt) * pageB;
        ctx.save(); ctx.globalAlpha = la * .7; ctx.strokeStyle = '#ffd3f2'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(colX(4) + 82, A_BAR_Y); ctx.lineTo(colX(4) + 110, A_BAR_Y); ctx.stroke(); ctx.restore();
        ctx.save(); ctx.globalAlpha = la * .7; rrect(colX(4) + 112, A_BAR_Y - 52, 196, 96, 14); ctx.fillStyle = 'rgb(5,9,24)'; ctx.fill(); ctx.restore();
        text('加权混合', colX(4) + 120, A_BAR_Y - 20, { font: F_ZH, size: 34, weight: 700, color: '#ffd3f2', alpha: la, align: 'left' });
        text('weighted mix', colX(4) + 120, A_BAR_Y + 20, { font: F_UI, size: 26, weight: 600, color: '#ffe3f7', alpha: la * .95, align: 'left' });
      }
    });

    // ---- data waves rising through the stack
    const wave = (w, t1, amp) => {
      const pf = (lt - w) / T_STEP;
      if (lt < w - .1 || lt > t1 || SF < .05) return;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < A_N; i++) for (let n = 0; n < 8; n += 2) {         // 4 dots per column; only the head of each pulse is near white
        const q = pf - n * .1; if (q < 0 || q > A_L - 1) continue;
        const pp = P(colX(i), Y0 + 4, zAt(q, lt)), fade = (i === 4 ? 1 : 1 - sstep(A_L - 2, A_L - 1, q)) * sstep(.25, 1, q);
        tglow(pp[0], pp[1], (34 - n * 3.4) * pp[2] * 1.15, HUES[i], (1 - n / 8) * .26 * fade * SF * amp * sstep(w - .1, w + .3, lt), n === 0 ? .7 : .2);
      }
      ctx.restore();
    };
    wave(T_W1, 17.2, 1);
    wave(T_W2, T_BEAT + .1, .8);

    // ---- "dozens of layers" bracket + "many heads" key
    const lab = sstep(16.2, 16.65, lt) * (1 - sstep(18.75, 19.1, lt));
    if (lab > .01) {
      const top = P(CW, CT_S, Z[A_L - 1]), bot = P(CW, CB_S, Z[0]), bx = Math.min(1700, Math.max(top[0], bot[0]) + 36);
      ctx.save(); ctx.globalAlpha = lab * .85; ctx.strokeStyle = 'rgba(205,225,255,.85)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(bx - 14, top[1]); ctx.lineTo(bx, top[1] + 6); ctx.lineTo(bx, bot[1] - 6); ctx.lineTo(bx - 14, bot[1]); ctx.stroke(); ctx.restore();
      const my = (top[1] + bot[1]) / 2;
      text('× 几十层', bx + 26, my - 26, { size: 52, weight: 700, color: '#fff', alpha: lab, align: 'left', glow: 'rgba(120,170,255,.6)', blur: 18 });
      text('dozens of layers', bx + 28, my + 28, { font: F_UI, size: 28, weight: 500, color: '#e6eeff', alpha: lab, align: 'left' });
    }
    const ha = sstep(16.45, 16.9, lt) * (1 - sstep(18.75, 19.1, lt));
    if (ha > .01) {
      const hx = 96, hy = 530, tp = P(colX(0) - 70, Y0S - 20, Z[3]);
      ctx.save(); ctx.globalAlpha = ha * .95;
      HEAD_HUES.forEach((hc, n) => { ctx.fillStyle = hc; rrect(hx + n * 20, hy - 26, 11, 52, 5); ctx.fill(); });
      ctx.globalAlpha = ha * .55; ctx.strokeStyle = 'rgba(205,225,255,.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(hx + 400, hy + 22); ctx.lineTo(tp[0] - 14, tp[1]); ctx.stroke();
      ctx.globalAlpha = ha * .9; ctx.fillStyle = '#e6eeff'; ctx.beginPath(); ctx.arc(tp[0] - 14, tp[1], 4, 0, TAU); ctx.fill(); ctx.restore();
      text('许多个“头”', hx + 84, hy - 16, { size: 42, weight: 700, color: '#fff', alpha: ha, align: 'left', glow: 'rgba(120,170,255,.5)', blur: 16 });
      text('many heads', hx + 86, hy + 22, { font: F_UI, size: 28, weight: 600, color: '#eef3ff', alpha: ha, align: 'left' });
      text('each learns its own pattern', hx + 86, hy + 54, { font: F_UI, size: 24, weight: 500, color: '#d6e4ff', alpha: ha * .95, align: 'left' });
    }

    // ---- the single vector that leaves the top, hand-off to scene 4 at (960, 220) on beat 31
    const gather = sstep(18.65, T_BEAT, lt);
    if (gather > 0) {
      const Zt = Z[A_L - 1], G = [960, P(0, CT_S, Zt)[1] - 64], E = [960, 220];   // G: gathering point just above the top layer
      const q = eout(clamp((lt - T_BEAT) / .65));
      const bz = t => { const u = 1 - t, p1 = [G[0], G[1] - 40], p2 = [E[0], E[1] + 60];
        return [u * u * u * G[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * E[0], u * u * u * G[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * E[1]]; };
      const sc0 = .55, vp = lt >= T_BEAT ? bz(q) : G;
      // converging streams: every column of the top layer funnels into the vector as it forms (only ' the', the last token, carries the weight: it feeds the output)
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < A_N; i++) {
        const st = P(colX(i), Y0, Zt), cx = (st[0] + G[0]) / 2, cy = Math.min(st[1], G[1]) - 20, strong = i === 4;
        const pt = e => { const u = 1 - e; return [u * u * st[0] + 2 * u * e * cx + e * e * G[0], u * u * st[1] + 2 * u * e * cy + e * e * G[1]]; };
        const lw = sstep(18.6, 19.0, lt) * (1 - sstep(19.3, 19.6, lt)) * (strong ? .3 : .12);
        if (lw > .01) { ctx.globalAlpha = lw; ctx.strokeStyle = rgba(HUES[i], 1); ctx.lineWidth = strong ? 3 : 2; ctx.beginPath(); for (let n = 0; n <= 14; n++) { const [x, y] = pt(n / 14); n ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
        for (let m = 0; m < 4; m++) {
          const p = clamp((lt - (18.65 + m * .15 + i * .03)) / .62); if (p <= 0 || p >= 1) continue;
          const [x, y] = pt(eio(p));
          tglow(x, y, (strong ? 26 : 16) + 8 * Math.sin(p * PI), HUES[i], Math.sin(p * PI) * (strong ? .45 : .12), .12);
        }
      }
      if (lt < T_BEAT) sdot(G[0], G[1], 40 + 40 * gather, 'rgba(170,215,255,A)', .12 * gather);
      ctx.restore();
      const va = sstep(18.95, 19.3, lt);
      if (lt >= T_BEAT) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let n = 6; n >= 1; n--) { const qq = q - n * .06; if (qq <= 0) continue; const [x, y] = bz(qq); sdot(x, y, 26 - n * 2.5, 'rgba(140,190,255,A)', .3 * (1 - n / 7) * (1 - q)); }
        ctx.strokeStyle = 'rgba(190,225,255,1)';
        const k2 = clamp((lt - (T_BEAT + .625)) / .5); if (k2 > 0 && k2 < 1) { ctx.globalAlpha = (1 - k2) * .3; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(960, 220, 60 + 90 * eout(k2), 0, TAU); ctx.stroke(); }
        ctx.restore();
      }
      const grow = lt >= T_BEAT ? eout(clamp((lt - T_BEAT) / .5)) * .6 + .4 : .4 + .6 * sstep(18.95, T_BEAT, lt) * .5;
      const flying = lt >= T_BEAT ? (1 - q) : 0;
      vecGlyph(vp[0], vp[1], lerp(sc0, 1, lt >= T_BEAT ? q : 0), va, Math.min(1, grow + (lt >= T_BEAT ? .4 * q : 0)), flying, lerp(.2, .5, lt >= T_BEAT ? q : 0));
      text('上下文向量 · CONTEXT VECTOR', 960, 332, { font: F_UI, weight: 600, size: 24, ls: 4, color: '#c8d6f5', alpha: sstep(T_BEAT + .2, T_BEAT + .55, lt) });
    }
  },
});
