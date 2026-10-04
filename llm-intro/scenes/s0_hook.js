// s0_hook: black -> a gold caret -> "The cat sat on the" is typed -> next-word bars -> "mat" -> everything is drawn into the gold title.
// local time 0..5 s (global = local). Letterbox is closed until 3.1 s, so everything before that lives in y 138..942.
const R = mulberry(20260000);
const HK = { cx: W / 2, size: 100, y0: 540, y1: 300, tHit: 3.125, T0: .5, DT: .095, titleCy: 428, titleSize: 200, titleLs: 34, titleStr: '大语言模型' };
const HK_FULL = 'The cat sat on the mat';                        // 22 characters; the last 4 (" mat") are typed in at 2.6 s
const HK_TYPE_T = i => i < 18 ? HK.T0 + i * HK.DT : [2.50, 2.56, 2.63, 2.70][i - 18];
const HK_BARS = STORY.next.slice(0, 5);                         // mat, floor, couch, bed, sofa (then a fan of tiny bars for the rest of the vocabulary)
const HK_B = { x0: 640, k: 1750, y0: 452, dy: 66, h: 26, tUnfurl: 2.2, stag: .045 };
const hkAdv = () => measure('M', HK.size, F_MONO, 400);
const hkLeftFinal = () => HK.cx - HK_FULL.length * hkAdv() / 2;
const hkRowY = i => HK_B.y0 + i * HK_B.dy;
const hkBarRel = i => 2.78 + .025 * i;                            // when row i starts turning into particles (mat first: the gold leads, the blue follows)
const hkSentRel = (u, gold) => gold ? 2.80 + .03 * u : 2.80 + .06 * u;   // sentence glyphs -> particles; the gold 'mat' goes first

// load-time constants -----------------------------------------------------------------------------------------------
const HK_MOTES = Array.from({ length: 170 }, () => ({ x: R() * W, y: 150 + R() * 780, z: .2 + R() * .8, p: R() * TAU, sp: 6 + R() * 14 }));
const HK_FAN = Array.from({ length: 16 }, (_, i) => ({ w: 150 * Math.pow(.86, i) * (.8 + .4 * R()), a: .62 - i * .02 }));
const HK_RING = Array.from({ length: 18 }, () => R());

// particles are built lazily (needs fonts for the glyph shapes) but with their own fresh generator, so they are deterministic
let HK_PTS = null;
function hkBuild() {
  if (HK_PTS) return HK_PTS;
  const r = mulberry(20260100);
  const rast = (draw) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true }); draw(x); return x.getImageData(0, 0, W, H).data; };
  const sample = (d, step) => { const o = []; for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) if (d[(y * W + x) * 4 + 3] > 140) o.push([x + (r() - .5) * 1.2, y + (r() - .5) * 1.2]); return o; };
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  // title shape
  const L = titleLayout(HK.titleStr, HK.cx, HK.titleSize, HK.titleLs);
  const dT = rast(x => { x.font = `900 ${HK.titleSize}px ${F_ZH}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff'; [...HK.titleStr].forEach((c, i) => x.fillText(c, L[i].x, HK.titleCy)); });
  const title = shuffle(sample(dT, 3));
  // sentence shape (final layout, y1)
  const adv = hkAdv(), left = hkLeftFinal();
  const dS = rast(x => { x.font = `400 ${HK.size}px ${F_MONO}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff'; [...HK_FULL].forEach((c, i) => c !== ' ' && x.fillText(c, left + adv * (i + .5), HK.y1)); });
  const sent = shuffle(sample(dS, 3)).slice(0, 1100);
  // bars
  const bars = [];
  HK_BARS.forEach(([, p], i) => { const len = p * HK_B.k, n = Math.round(len * .6); for (let j = 0; j < n; j++) bars.push({ x: HK_B.x0 + r() * len, y: hkRowY(i) + (r() - .5) * HK_B.h, row: i }); });
  // dust: ambient motes that begin to gather toward the title before the sentence is released
  const dust = Array.from({ length: 1400 }, () => ({ x: r() * W, y: 150 + r() * 780 }));

  const sizeS = sent.length, sizeB = bars.length, sizeD = dust.length;
  const tgt = title.slice(0, sizeS + sizeB + sizeD);
  while (tgt.length < sizeS + sizeB + sizeD) tgt.push(title[Math.floor(r() * title.length)]);
  // pair sources with targets in x order inside each class so the flows stream instead of criss-crossing
  const take = n => tgt.splice(0, n).sort((a, b) => a[0] - b[0]);
  const P = [];
  const mk = (src, tg, cls, rel) => src.forEach((s, i) => P.push({ sx: s.x ?? s[0], sy: s.y ?? s[1], tx: tg[i][0], ty: tg[i][1], cls, ...rel(s, i), ph: r(), z: .3 + r() * .7, sg: r() < .5 ? -1 : 1 }));
  const sSrc = sent.map(s => ({ x: s[0], y: s[1] })).sort((a, b) => a.x - b.x), xmin = sSrc[0].x, xmax = sSrc[sSrc.length - 1].x;
  mk(sSrc, take(sizeS), 1, s => { const u = (s.x - xmin) / (xmax - xmin), gold = s.x > left + adv * 19, rel = hkSentRel(u, gold); return { r: rel, ta: HK.tHit - .02 - .02 * r(), gold }; });
  mk(bars.sort((a, b) => a.x - b.x), take(sizeB), 2, b => ({ r: hkBarRel(b.row) + .04 * r(), ta: HK.tHit - .02 - .03 * r(), gold: b.row === 0 }));
  mk(dust.sort((a, b) => a.x - b.x), take(sizeD), 0, () => { const u = r(); return { r: 1.75 + .8 * Math.pow(u, .8), ta: 3.0 + .1 * r(), gold: false }; });
  if (typeof fontsReady !== 'undefined' && fontsReady) HK_PTS = P; else return P;
  return HK_PTS;
}

const hkDrift = (p, t) => [Math.sin(t * .6 + p.ph * 20) * 14 * p.z, Math.cos(t * .5 + p.ph * 17) * 10 * p.z];
function hkPos(p, t) {                                           // particle position at time t (before release: resting/drifting; then flight; then at target)
  if (t < p.r) { if (p.cls) return [p.sx, p.sy]; const d = hkDrift(p, t); return [p.sx + d[0], p.sy + d[1]]; }
  let sx = p.sx, sy = p.sy; if (!p.cls) { const d = hkDrift(p, p.r); sx += d[0]; sy += d[1]; }
  const k = clamp((t - p.r) / (p.ta - p.r)), e = p.cls ? lerp(eio(k), ein(k), .35) : eio(k);
  const dx = p.tx - sx, dy = p.ty - sy, len = Math.hypot(dx, dy) || 1, sw = Math.sin(k * PI) * len * .16 * p.sg;
  return [lerp(sx, p.tx, e) - dy / len * sw, lerp(sy, p.ty, e) + dx / len * sw];
}
const HK_COL = ['#aac8ff', '#f2f6ff', '#78e1ff', '#ffd27a', '#fff3d2', '#ffcf86'];   // 0 dust, 1 sentence, 2 bars, 3 gold source, 4 white-hot, 5 gold-hot

function hkParticles(lt) {
  if (lt < 1.0) return;
  const P = hkBuild(), buckets = Array.from({ length: 24 }, () => []), lines = [];
  const tau = lt - HK.tHit;
  for (const p of P) {
    const dustA = p.cls ? 1 : sstep(.7, 1.7, lt) * .34;
    if (p.cls && lt < p.r) continue;                              // sentence/bar particles are invisible until their source dissolves
    if (tau > 0 && tau > .3 + 1.3 * p.ph) continue;
    let [x, y] = hkPos(p, lt);
    const fly = lt > p.r && lt < p.ta, k = clamp((lt - p.r) / (p.ta - p.r));
    let a = dustA, sz = p.cls ? 2.6 : 1.3 + .9 * p.z;
    if (p.cls) a = sstep(0, .12, k) * .95; else a = dustA * (1 - k) + Math.pow(k, .6) * .95;
    if (lt >= p.ta) {                                             // arrived: twinkle, then burst outward as embers after the hit
      sz = 2.8 + Math.sin(lt * 9 + p.ph * 40) * .6;
      if (tau > 0) {
        const life = .3 + 1.3 * p.ph, f = tau / life, dx = p.tx - HK.cx, dy = p.ty - HK.titleCy, dl = Math.hypot(dx, dy) || 1;
        const dist = (40 + 220 * p.ph) * eout(clamp(f)); x = p.tx + dx / dl * dist + Math.sin(p.ph * 30) * 20 * f; y = p.ty + dy / dl * dist - 26 * f * p.ph;
        a = .95 * (1 - f) * (1 - f * .3);
      }
    }
    if (a <= .01) continue;
    const e = clamp((lt - p.r) / (p.ta - p.r));
    const b = tau > 0 ? (p.ph < .5 ? 5 : 4) : (e < .4 ? (p.gold ? 3 : p.cls) : e < .8 ? (p.gold ? 5 : 4) : 5);
    buckets[b * 4 + Math.min(3, Math.floor(a * 4.2))].push(x, y, sz);
    if (fly && k > .03 && k < .97 && p.cls) { const q = hkPos(p, lt - .022), dx = x - q[0], dy = y - q[1], dl = Math.hypot(dx, dy) || 1, c = Math.min(1, 7 / dl); lines.push(x - dx * c, y - dy * c, x, y, a); }
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  if (lines.length) {
    ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(190,225,255,.5)'; ctx.beginPath();
    for (let i = 0; i < lines.length; i += 5) { ctx.moveTo(lines[i], lines[i + 1]); ctx.lineTo(lines[i + 2], lines[i + 3]); }
    ctx.globalAlpha = .16; ctx.stroke();
  }
  buckets.forEach((b, bi) => {
    if (!b.length) return;
    ctx.fillStyle = HK_COL[bi >> 2]; ctx.globalAlpha = [.18, .42, .68, .92][bi & 3]; ctx.beginPath();
    for (let i = 0; i < b.length; i += 3) ctx.rect(b[i] - b[i + 2] / 2, b[i + 1] - b[i + 2] / 2, b[i + 2], b[i + 2]);
    ctx.fill();
  });
  ctx.restore();
}

function hkSentence(lt) {
  const adv = hkAdv(), n = HK_FULL.length, size = HK.size;
  const rv = i => clamp((lt - HK_TYPE_T(i)) / .09);
  let w18 = 0, caretX = 0; for (let i = 0; i < 18; i++) w18 += adv * eout(rv(i));
  const m = sstep(1.9, 2.35, lt);
  const left = lerp(HK.cx - w18 / 2, hkLeftFinal(), m);
  for (let i = 0; i < n; i++) caretX += adv * sstep(HK_TYPE_T(i) - .005, HK_TYPE_T(i) + .03, lt);   // the caret sits in the NEXT cell and hops there as each character starts, so it never overprints a glyph
  const y = lerp(HK.y0, HK.y1, m);
  const relS = lt < 2.8 ? 0 : 1;
  for (let i = 0; i < n; i++) {
    const r = rv(i); if (r <= 0 || HK_FULL[i] === ' ') continue;
    const gold = i >= 19, e = eout(r), fresh = 1 - clamp((lt - HK_TYPE_T(i)) / .3);
    const u = (left + adv * (i + .5) - HK_PTS_X0) / HK_PTS_XW;
    const r0 = hkSentRel(clamp(u), gold), gone = relS ? sstep(r0, r0 + .07, lt) : 0;
    if (gone >= 1) continue;
    text(HK_FULL[i], left + adv * (i + .5), y + (1 - e) * 12, { font: F_MONO, size, weight: 400, color: gold ? '#ffc850' : '#f4f8ff', alpha: r * (1 - gone) * (.9 + .1 * e),
      glow: gold ? 'rgba(255,165,40,1)' : `rgba(150,200,255,${.55 + .4 * fresh})`, blur: gold ? 40 + 20 * fresh : 22 + 24 * fresh });
  }
  // caret: solid while typing, blinking at rest; starts from black
  const last = Math.max(...Array.from({ length: n }, (_, i) => HK_TYPE_T(i) <= lt ? HK_TYPE_T(i) : -9));
  const solid = lt - last < .22 && last > 0, blinkOn = !(Math.floor(lt * 2.2) % 2);
  const ca = sstep(.04, .22, lt) * (1 - sstep(2.80, 2.9, lt)) * (solid || blinkOn ? 1 : 0);
  if (ca > 0) { ctx.save(); ctx.globalAlpha = ca; ctx.fillStyle = PAL.gold; ctx.shadowColor = PAL.gold; ctx.shadowBlur = 22; ctx.fillRect(left + caretX + 3, y - size * .5, 9, size * 1.0); ctx.restore(); }
  return { left, y, caretX: left + caretX };
}
let HK_PTS_X0 = 0, HK_PTS_XW = 1;
{ const a = 960 - 22 * 60 / 2; HK_PTS_X0 = a; HK_PTS_XW = 22 * 60; }

function hkBars(lt, pass) {                                     // pass 0: shapes (under the particles), pass 1: all text (over them, so speckle never covers a label)
  const gm = sstep(2.30, 2.46, lt);                              // mat turns gold
  ctx.save();
  // caption
  const capA = sstep(2.34, 2.56, lt) * (1 - sstep(2.8, 2.9, lt));
  if (pass && capA > 0) text('NEXT-WORD PROBABILITY', HK_B.x0, 398, { font: F_EN, weight: 700, size: 26, ls: 7, color: '#e6f0ff', alpha: capA, align: 'left', glow: 'rgba(0,8,30,.95)', blur: 14 });
  HK_BARS.forEach(([name, p], i) => {
    const k = eexpo(clamp((lt - HK_B.tUnfurl - i * HK_B.stag) / .35)); if (k <= 0) return;
    const a = (1 - sstep(hkBarRel(i), hkBarRel(i) + .12, lt)); if (a <= 0) return;
    const y = hkRowY(i), len = Math.max(3, p * HK_B.k * k), top = i === 0, g = top ? gm : 0;
    const gr = ctx.createLinearGradient(HK_B.x0, 0, HK_B.x0 + p * HK_B.k, 0);
    if (top) { gr.addColorStop(0, `rgb(${Math.round(lerp(60, 225, g))},${Math.round(lerp(185, 150, g))},${Math.round(lerp(230, 40, g))})`); gr.addColorStop(1, `rgb(${Math.round(lerp(140, 255, g))},${Math.round(lerp(110, 205, g))},${Math.round(lerp(235, 105, g))})`); }
    else { gr.addColorStop(0, 'rgb(60,185,230)'); gr.addColorStop(1, 'rgb(140,110,235)'); }
    if (!pass) { ctx.save(); ctx.globalAlpha = a * (top ? .95 : .72 - i * .03);
    ctx.shadowColor = top ? `rgba(255,${Math.round(lerp(210, 190, g))},${Math.round(lerp(255, 80, g))},.9)` : 'rgba(110,170,255,.7)'; ctx.shadowBlur = top ? 20 + 24 * g : 14;
    rrect(HK_B.x0, y - HK_B.h / 2, len, HK_B.h, HK_B.h / 2); ctx.fillStyle = gr; ctx.fill(); ctx.restore();
    if (top && g > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * g * .55; glowDot(HK_B.x0 + len, y, 110, 'rgba(255,190,90,A)', .6); ctx.restore(); } return; }
    const lc = top ? (g > .5 ? PAL.gold : '#fff') : '#dce8ff';
    text(name, HK_B.x0 - 30, y, { font: F_MONO, size: top ? 40 : 34, weight: top ? 700 : 400, color: lc, alpha: a * sstep(.3, .6, k), align: 'right', glow: top && g > .1 ? 'rgba(255,190,90,.8)' : null, blur: 20 });
    text(`${Math.round(p * 100)} %`, HK_B.x0 + len + 22, y, { font: F_MONO, size: top ? 36 : 30, weight: top ? 700 : 400, color: top && g > .5 ? PAL.gold : '#9fb6dd', alpha: a * sstep(.75, 1, k) * (top ? sstep(2.5, 2.62, lt) : 1), align: 'left' });
  });
  // "…" row: a fan of thin bars for every other token in the vocabulary (they add up to the remaining 14 %)
  const ek = eexpo(clamp((lt - HK_B.tUnfurl - 5 * HK_B.stag) / .35)), ea = 1 - sstep(2.8, 2.9, lt);
  if (ek > 0 && ea > 0) {
    const y = hkRowY(5), n = HK_FAN.length, ph = 3.2;
    if (pass) {
      text('…', HK_B.x0 - 30, y, { font: F_MONO, size: 38, color: '#b9ccee', alpha: ea * sstep(.3, .6, ek), align: 'right' });
      text('14 %', HK_B.x0 + 200, y, { font: F_MONO, size: 28, color: '#9fb6dd', alpha: ea * sstep(.75, 1, ek), align: 'left' });
    } else {
      ctx.save();
      const g = ctx.createLinearGradient(HK_B.x0, 0, HK_B.x0 + 150, 0); g.addColorStop(0, 'rgba(70,170,225,1)'); g.addColorStop(1, 'rgba(140,110,235,.6)'); ctx.fillStyle = g;
      HK_FAN.forEach((m, j) => { const yy = y - (n * ph) / 2 + j * ph; ctx.globalAlpha = ea * m.a; ctx.fillRect(HK_B.x0, yy, m.w * ek, 2); });
      ctx.restore();
    }
  }
  ctx.restore();
}

function hkSpark(lt, caretPos) {
  const t0 = 2.38, t1 = 2.56, k = clamp((lt - t0) / (t1 - t0)); if (k <= 0 || k >= 1) return;
  const x0 = HK_B.x0 + HK_BARS[0][1] * HK_B.k + 20, y0 = hkRowY(0), x1 = hkLeftFinal() + hkAdv() * 19.5, y1 = HK.y1;
  const q = s => { const e = eio(s); return [lerp(x0, x1, e) + Math.sin(e * PI) * 70, lerp(y0, y1, e)]; };
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const fadeOut = 1 - sstep(.8, 1, k);
  for (let i = 0; i < 9; i++) { const [x, y] = q(Math.max(0, k - i * .03)); glowDot(x, y, 24 - i * 2, 'rgba(255,205,110,A)', (1 - i / 9) * .9 * fadeOut); }
  ctx.restore();
}

let HK_GLOW = null;                                              // the soft gold halo of the title, rendered once (shadowBlur on five 200 px glyphs per frame is the expensive part)
function hkGlowLayer() {
  if (HK_GLOW) return HK_GLOW;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const L = titleLayout(HK.titleStr, HK.cx, HK.titleSize, HK.titleLs);
  x.font = `900 ${HK.titleSize}px ${F_ZH}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = 'rgba(255,180,80,.8)'; x.shadowBlur = 50; x.fillStyle = 'rgba(255,200,110,.9)';
  x.translate(0, -2000); x.shadowOffsetY = 2000;                 // draw only the shadow, not the glyph itself
  [...HK.titleStr].forEach((ch, i) => x.fillText(ch, L[i].x, HK.titleCy));
  if (typeof fontsReady !== 'undefined' && fontsReady) HK_GLOW = c; else return c;
  return HK_GLOW;
}
function hkGold(x0, y0, x1, y1, s) {                             // goldGrad with a lifted floor: no dark brown corner, so a glyph never reads as half missing
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, '#c89a46'); g.addColorStop(.35, '#e6c06a');
  if (s > .05 && s < .95) { g.addColorStop(Math.max(.36, s - .05), '#f0d080'); g.addColorStop(Math.max(.37, s), '#fff6dc'); g.addColorStop(Math.min(.69, s + .05), '#f0d080'); }
  g.addColorStop(.7, '#d9ab55'); g.addColorStop(1, '#b4822f');
  return g;
}
function hkGlyphs(lt) {                                          // the gold title: each glyph snaps in around the hit (same gold as titleWord, tighter timing)
  const str = HK.titleStr, size = HK.titleSize, L = titleLayout(str, HK.cx, size, HK.titleLs), total = L[0].total, sheenX = HK.cx - total / 2 + (((lt * .32) % 1.8) - .3) * total;
  const kg = clamp((lt - (HK.tHit - .1)) / .28);
  if (kg <= 0) return;
  const sg = 1;                                                   // no scale pop: the glyphs must sit exactly on the particle shape or the fringe reads as a sheared copy
  ctx.save(); ctx.translate(HK.cx, HK.titleCy); ctx.scale(sg, sg); ctx.translate(-HK.cx, -HK.titleCy);
  ctx.globalAlpha = clamp(kg * 4) * .8; ctx.drawImage(hkGlowLayer(), 0, 0);
  ctx.font = `900 ${size}px ${F_ZH}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  [...str].forEach((ch, i) => {
    const { x, w } = L[i], k = clamp((lt - (HK.tHit - .1 + i * .008)) / .28); if (k <= 0) return;
    ctx.save(); ctx.translate(x, HK.titleCy); ctx.globalAlpha = clamp(k * 6);
    ctx.fillStyle = hkGold(-w / 2, -size / 2, w / 2, size / 2, (sheenX - (x - w / 2)) / w); ctx.fillText(ch, 0, 0);
    ctx.restore();
  });
  ctx.restore();
}
function hkFlare(x, y, a, len = 900, core = 22) {                  // thin anamorphic streak with a small bright core (the shared flare() head is a big soft pill)
  if (a <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(x - len, 0, x + len, 0);
  g.addColorStop(0, 'rgba(120,170,255,0)'); g.addColorStop(.5, `rgba(255,236,200,${.9 * a})`); g.addColorStop(1, 'rgba(120,170,255,0)');
  ctx.fillStyle = g; ctx.fillRect(x - len, y - 1.5, len * 2, 3);
  ctx.globalAlpha = .22 * a; ctx.fillRect(x - len * .6, y - 7, len * 1.2, 14);
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, y); ctx.scale(3, 1); glowDot(0, 0, core, 'rgba(255,225,175,A)', a * .8); ctx.restore();
}
function hkTitle(lt) {
  const t = lt - HK.tHit, cx = HK.cx, cy = HK.titleCy;
  if (t < -.3) return;
  const lbh = 138 * (1 - eio(clamp((lt - 3.1) / .9)));         // the timeline's letterbox height now: nothing from the title may light the black bars
  ctx.save(); ctx.beginPath(); ctx.rect(0, lbh, W, H - 2 * lbh); ctx.clip();
  // warm light behind the title
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  glowDot(cx, cy + 20, 760, 'rgba(255,160,70,A)', .13 * sstep(-.1, .3, t) + .16 * Math.exp(-Math.max(0, t) * 2.2) * (t > 0 ? 1 : 0));
  ctx.restore();
  // the faint gold halo of the title appears before the hit, so the eye sees where the particles are going
  const gh = .4 * sstep(-.5, -.05, t) * (1 - clamp(t / .12));
  if (gh > .01) { ctx.save(); ctx.globalAlpha = gh; ctx.drawImage(hkGlowLayer(), 0, 0); ctx.restore(); }
  // warm impact burst (additive, only on the title; the black bars are untouched)
  if (t > -.02 && t < .7) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowDot(cx, cy, 520, 'rgba(255,175,80,A)', .22 * Math.exp(-Math.max(0, t) * 7)); ctx.restore(); }
  // thin shock ring, only after the glyphs have landed
  const tr = t - .1;
  if (tr > 0 && tr < 1.1) {
    const e = eout(tr / 1.1); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,215,140,1)'; ctx.lineWidth = 1.5 * (1 - e) + 1; ctx.globalAlpha = .3 * (1 - e) * (1 - e);
    ctx.beginPath(); ctx.ellipse(cx, cy + 10, 180 + 1000 * e, 60 + 300 * e, 0, 0, TAU); ctx.stroke(); ctx.restore();
  }
  hkGlyphs(lt);
  // streaks
  const fk = clamp(t / 1.3);
  hkFlare(lerp(cx - 640, cx + 640, eio(fk)), cy, win(t, 0, 1.5, .06, .9) * .85, 520, 20);
  hkFlare(cx, cy, Math.exp(-Math.max(0, t) * 5) * (t > -.03 ? 1 : 0) * .5, 800, 16);
  // subtitle lines
  const ea = sstep(.1, .45, t), ls = lerp(46, 20, eout(clamp((t - .1) / .7)));
  if (ea > 0) text('LARGE LANGUAGE MODELS', cx, cy + 190, { font: F_EN, weight: 700, size: 54, ls, color: '#ecd9ac', alpha: ea, glow: 'rgba(255,190,100,.45)', blur: 22 });
  const ra = sstep(.2, .5, t);
  if (ra > 0) { ctx.save(); ctx.globalAlpha = ra * .8; const g = ctx.createLinearGradient(cx - 300, 0, cx + 300, 0); g.addColorStop(0, 'rgba(230,200,140,0)'); g.addColorStop(.5, 'rgba(240,210,150,1)'); g.addColorStop(1, 'rgba(230,200,140,0)'); ctx.fillStyle = g; ctx.fillRect(cx - 300 * eout(ra), cy + 244, 600 * eout(ra), 2); ctx.restore(); }
  const ta = sstep(.15, .5, t), sl = (1 - eout(clamp((t - .15) / .5))) * 14;
  if (ta > 0) {
    text('它如何工作 · 如何训练', cx, cy + 298 + sl, { size: 40, weight: 700, ls: 10, color: '#f0e3c4', alpha: ta, glow: 'rgba(0,0,0,.6)', blur: 10 });
    text('HOW THEY WORK  ·  HOW THEY LEARN', cx, cy + 354 + sl, { font: F_EN, weight: 600, size: 29, ls: 8, color: '#eadcb4', alpha: ta });
  }
  ctx.restore();
}

scene({
  id: 'hook', start: 0, len: 2, fi: .01, fo: 0, mb: 3, bloom: 1,
  subs: [[0.5, 2.5, '大语言模型，本质上只做一件事——', 'A large language model does just one thing —'], [2.6, 4.9, '预测下一个词。', 'it predicts the next word.']],
  sfx: [
    [0, 'thump'],
    ...Array.from({ length: 18 }, (_, i) => [HK.T0 + i * HK.DT, 'type']),
    [1.525, 'riser', { dur: 1.6 }],
    [2.16, 'swish'], ...HK_BARS.map((_, i) => [HK_B.tUnfurl + i * HK_B.stag, 'tick', { hi: i === 0 }]),
    [2.50, 'chime', { midi: 84 }], [2.62, 'whoosh', { dur: .5, rev: 1 }],
    [2.56, 'type'], [2.63, 'type'], [2.70, 'type'], [2.56, 'up'],
    [3.125, 'hit', { k: .95 }], [3.125, 'swell', { dur: 1.8 }], [3.3, 'shimmer'], [3.45, 'sparkle', { dur: 1.4 }], [3.85, 'ding', { midi: 91 }],
  ],
  hits: [[HK.tHit, .06]],
  cam: (lt, d) => ({ z: 1 + .03 * lt / d, x: 6 * Math.sin(lt * .5), y: 4 * Math.sin(lt * .4 + 1) }),
  draw(lt) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    // backdrop fades up slowly: deep blue nebula
    const amp = .6 * Math.pow(sstep(.2, 2.6, lt), .7);
    if (amp > .005) glDraw(0, { time: lt * .8 + 20, tint: [.06, .13, .46], amp });
    // motes
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#cfe0ff';
    const ma = sstep(.4, 1.6, lt);
    for (const m of HK_MOTES) { const y = ((m.y - lt * m.sp * m.z - 150) % 780 + 780) % 780 + 150; ctx.globalAlpha = ma * (.05 + .2 * m.z) * (.6 + .4 * Math.sin(lt * 2 + m.p)); ctx.fillRect(m.x + Math.sin(lt * .4 + m.p) * 12, y, m.z * 2.4, m.z * 2.4); }
    ctx.restore();
    // heartbeat glow under the first caret
    const hb = sstep(0, .1, lt) * Math.exp(-lt * 3.2) + .12 * sstep(.04, .3, lt) * (1 - sstep(.5, 1.2, lt));
    if (hb > .01) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowDot(HK.cx + 7.5, HK.y0, 180 + 160 * Math.exp(-lt * 5), 'rgba(255,200,110,A)', hb * .6); ctx.restore(); }
    hkBuild();
    const s = hkSentence(lt);
    hkBars(lt, 0);
    hkSpark(lt, s);
    hkParticles(lt);
    hkBars(lt, 1);
    hkTitle(lt);
    const fade = sstep(4.82, 4.99, lt);                         // the lockup dips to black in the last 0.25 s so the cut into s1 (which dips up from black) is clean
    if (fade > 0) { ctx.save(); ctx.globalAlpha = fade; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  },
});
