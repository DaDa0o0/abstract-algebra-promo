// s0_hook (2:50 cut): black -> a gold caret -> "The cat sat on the" is typed -> next-word bars -> "mat" -> everything is drawn into the gold title.
// local time 0..10 s (global = local). The letterbox is closed until 6.2 s, so everything before that lives in y 138..942.
// pages: A 0-2.7 typing | B 2.8-4.3 bars + "mat" | hold 4.2-5.2 | C 5.2-6.2 dissolve into particles | hit 6.25 | D title, English 6.7, tagline 7.3, hold to 9.6
const R = mulberry(20260000);
const HK = { cx: W / 2, size: 100, y0: 450, y1: 330, tHit: 6.25, T0: .5, DT: .12, rel: 5.2, titleCy: 428, titleSize: 200, titleLs: 34, titleStr: '大语言模型', tEn: 6.7, tTag: 7.3, tLift: 2.62 };
const HK_FULL = 'The cat sat on the mat';                        // 22 characters; the last 4 (" mat") are typed in at 2.0 s
const HK_TYPE_T = i => i < 18 ? HK.T0 + i * HK.DT : [3.80, 3.86, 3.98, 4.10][i - 18];   // 18 characters at 0.12 s, then ' mat' (the gold word lands at 3.8-4.2)
const HK_BARS = STORY.next.slice(0, 5);                         // mat, floor, couch, bed, sofa (then a fan of tiny bars for the rest of the vocabulary)
const HK_B = { x0: 640, k: 1750, y0: 470, dy: 64, h: 26, tUnfurl: 2.85, stag: .09, dur: .55, tGold: 3.5, tSpark: 3.58 };
const hkAdv = () => measure('M', HK.size, F_MONO, 400);
const hkLeftFinal = () => HK.cx - HK_FULL.length * hkAdv() / 2;
const hkRowY = i => HK_B.y0 + i * HK_B.dy;
const hkBarRel = i => HK.rel + .03 * i;                            // when row i starts turning into particles (mat first: the gold leads, the blue follows)
const hkSentRel = (u, gold) => gold ? HK.rel : HK.rel + .06 + .22 * u;   // sentence glyphs -> particles; the gold 'mat' goes first, the rest follows left to right

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
  mk(sSrc, take(sizeS), 1, s => { const u = (s.x - xmin) / (xmax - xmin), gold = s.x > left + adv * 19, rel = hkSentRel(u, gold); return { r: rel, ta: HK.tHit - .05 - .06 * r(), gold }; });
  mk(bars.sort((a, b) => a.x - b.x), take(sizeB), 2, b => ({ r: hkBarRel(b.row) + .08 * r(), ta: HK.tHit - .05 - .06 * r(), gold: b.row === 0 }));
  mk(dust.sort((a, b) => a.x - b.x), take(sizeD), 0, () => { const u = r(); return { r: 4.9 + .9 * Math.pow(u, .8), ta: HK.tHit - .2 + .12 * r(), gold: false }; });
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
    const dustA = p.cls ? 1 : sstep(.9, 2.4, lt) * .3;
    if (p.cls && lt < p.r) continue;                              // sentence/bar particles are invisible until their source dissolves
    if (tau > 0 && tau > .3 + 1.3 * p.ph) continue;
    let [x, y] = hkPos(p, lt);
    const fly = lt > p.r && lt < p.ta, k = clamp((lt - p.r) / (p.ta - p.r));
    let a = dustA, sz = p.cls ? 2.6 : 1.3 + .9 * p.z;
    if (p.cls) a = sstep(0, .07, k) * .95; else a = dustA * (1 - k) + Math.pow(k, 1.1) * .95;
    if (lt >= p.ta) {                                             // arrived: twinkle, then burst outward as embers after the hit
      sz = 2.3 + Math.sin(lt * 9 + p.ph * 40) * .4;
      if (tau > 0) {
        const life = .3 + 1.3 * p.ph, f = tau / life, dx = p.tx - HK.cx, dy = p.ty - HK.titleCy, dl = Math.hypot(dx, dy) || 1;
        const dist = (40 + 220 * p.ph) * eout(clamp(f)); x = p.tx + dx / dl * dist + Math.sin(p.ph * 30) * 20 * f; y = p.ty + dy / dl * dist - 26 * f * p.ph;
        a = .95 * (1 - f) * (1 - f * .3) * (.55 + .45 * sstep(.04, .2, tau));
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
    ctx.globalAlpha = .08; ctx.stroke();
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
  const adv = hkAdv(), n = HK_FULL.length, size = HK.size, left = hkLeftFinal();   // laid out at its final x from the first character: only the vertical lift moves the line
  const rd = i => i >= 18 ? .07 : .09, rv = i => clamp((lt - HK_TYPE_T(i)) / rd(i));
  const m = sstep(HK.tLift, HK.tLift + .5, lt), y = lerp(HK.y0, HK.y1, m);          // 120 px in 0.5 s: peak speed about 360 px/s
  let caretX = 0; for (let i = 0; i < n; i++) caretX += adv * sstep(HK_TYPE_T(i) - .005, HK_TYPE_T(i) + .05, lt);   // the caret sits in the NEXT cell and hops there as each character starts, so it never overprints a glyph
  const relS = lt < HK.rel ? 0 : 1;
  for (let i = 0; i < n; i++) {
    const r = rv(i); if (r <= 0 || HK_FULL[i] === ' ') continue;
    const gold = i >= 19, e = eout(r), fresh = 1 - clamp((lt - HK_TYPE_T(i)) / .3);
    const u = (left + adv * (i + .5) - HK_PTS_X0) / HK_PTS_XW;
    const r0 = hkSentRel(clamp(u), gold), gone = relS ? sstep(r0 - .01, r0 + .03, lt) : 0;
    if (gone >= 1) continue;
    text(HK_FULL[i], left + adv * (i + .5), y + (1 - e) * 12, { font: F_MONO, size, weight: 400, color: gold ? '#ffc850' : '#f4f8ff', alpha: r * (1 - gone) * (.9 + .1 * e),
      glow: gold ? 'rgba(255,165,40,1)' : `rgba(150,200,255,${.55 + .4 * fresh})`, blur: gold ? 40 + 20 * fresh : 22 + 24 * fresh });
  }
  // caret: solid while typing, blinking at rest; starts from black; hidden while " mat" is typed (it would overprint the letters that are still revealing) and back once the t is mostly there
  const last = Math.max(...Array.from({ length: n }, (_, i) => HK_TYPE_T(i) <= lt ? HK_TYPE_T(i) : -9));
  const solid = lt - last < .22 && last > 0, blinkOn = !(Math.floor(lt * 2.2) % 2);
  const hide = sstep(HK_TYPE_T(18) - .03, HK_TYPE_T(18), lt) * (1 - sstep(HK_TYPE_T(n - 1) + .03, HK_TYPE_T(n - 1) + .07, lt));
  const ca = sstep(.04, .22, lt) * (1 - sstep(HK.rel - .03, HK.rel + .05, lt)) * (solid || blinkOn ? 1 : 0) * (1 - hide);
  const cxp = lt < HK.T0 - .02 ? HK.cx - 5 : left + caretX + 3;      // the first beats: the caret blinks alone at screen centre, then it is the cursor of the line
  if (ca > 0) { ctx.save(); ctx.globalAlpha = ca; ctx.fillStyle = PAL.gold; ctx.shadowColor = PAL.gold; ctx.shadowBlur = 22; ctx.fillRect(cxp, y - size * .5, 9, size * 1.0); ctx.restore(); }
  return { left, y, caretX: left + caretX };
}
let HK_PTS_X0 = 0, HK_PTS_XW = 1;
{ const a = 960 - 22 * 60 / 2; HK_PTS_X0 = a; HK_PTS_XW = 22 * 60; }

function hkBars(lt, pass) {                                     // pass 0: shapes (under the particles), pass 1: all text (over them, so speckle never covers a label)
  const gm = sstep(HK_B.tGold, HK_B.tGold + .18, lt);                              // mat turns gold
  ctx.save();
  // caption
  const capA = sstep(2.85, 3.15, lt) * (1 - sstep(HK.rel - .05, HK.rel + .01, lt));
  if (pass && capA > 0) text('NEXT-WORD PROBABILITY', HK_B.x0, 412, { font: F_EN, weight: 700, size: 28, ls: 7, color: '#e6f0ff', alpha: capA, align: 'left', glow: 'rgba(0,8,30,.95)', blur: 14 });
  HK_BARS.forEach(([name, p], i) => {
    const kl = clamp((lt - HK_B.tUnfurl - i * HK_B.stag) / HK_B.dur), k = eout(kl); if (k <= 0) return;
    const a = (1 - sstep(hkBarRel(i) - .01, hkBarRel(i) + .03, lt)); if (a <= 0) return;           // bodies are gone before the particles are born
    const ta = 1 - sstep(hkBarRel(i) - .04, hkBarRel(i) + .01, lt);                                    // labels are gone a little earlier still
    if (pass && ta <= 0) return;
    const y = hkRowY(i), len = Math.max(3, p * HK_B.k * k), top = i === 0, g = top ? gm : 0;
    const gr = ctx.createLinearGradient(HK_B.x0, 0, HK_B.x0 + p * HK_B.k, 0);
    if (top) { gr.addColorStop(0, `rgb(${Math.round(lerp(60, 225, g))},${Math.round(lerp(185, 150, g))},${Math.round(lerp(230, 40, g))})`); gr.addColorStop(1, `rgb(${Math.round(lerp(140, 255, g))},${Math.round(lerp(110, 205, g))},${Math.round(lerp(235, 105, g))})`); }
    else { gr.addColorStop(0, 'rgb(60,185,230)'); gr.addColorStop(1, 'rgb(140,110,235)'); }
    if (!pass) { ctx.save(); ctx.globalAlpha = a * (top ? .95 : .72 - i * .03);
    ctx.shadowColor = top ? `rgba(255,${Math.round(lerp(210, 190, g))},${Math.round(lerp(255, 80, g))},.9)` : 'rgba(110,170,255,.7)'; ctx.shadowBlur = top ? 20 + 24 * g : 14;
    rrect(HK_B.x0, y - HK_B.h / 2, len, HK_B.h, HK_B.h / 2); ctx.fillStyle = gr; ctx.fill(); ctx.restore();
    if (top && g > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * g * .55; glowDot(HK_B.x0 + len, y, 110, 'rgba(255,190,90,A)', .6); ctx.restore(); } return; }
    const lc = top ? (g > .5 ? PAL.gold : '#fff') : '#dce8ff';
    text(name, HK_B.x0 - 30, y, { font: F_MONO, size: top ? 40 : 34, weight: top ? 700 : 400, color: lc, alpha: ta * sstep(.1, .5, kl), align: 'right', glow: top && g > .1 ? 'rgba(255,190,90,.8)' : null, blur: 20 });
    text(`${Math.round(p * 100)} %`, HK_B.x0 + p * HK_B.k + 22, y, { font: F_MONO, size: top ? 36 : 30, weight: top ? 700 : 400, color: top && g > .5 ? PAL.gold : '#9fb6dd', alpha: ta * sstep(.7, 1, kl), align: 'left' });     // at the bar's FINAL end: it fades in once the bar has landed, it never travels
  });
  // "…" row: a fan of thin bars for every other token in the vocabulary (they add up to the remaining 14 %)
  const ekl = clamp((lt - HK_B.tUnfurl - 5 * HK_B.stag) / HK_B.dur), ek = eout(ekl), ea = 1 - sstep(HK.rel - (pass ? .04 : .01), HK.rel + (pass ? .01 : .03), lt);
  if (ek > 0 && ea > 0) {
    const y = hkRowY(5), n = HK_FAN.length, ph = 3.8;
    if (pass) {
      text('…', HK_B.x0 - 30, y, { font: F_MONO, size: 38, color: '#b9ccee', alpha: ea * sstep(.1, .5, ekl), align: 'right' });
      text('14 %', HK_B.x0 + 190, y, { font: F_MONO, size: 30, color: '#9fb6dd', alpha: ea * sstep(.7, 1, ekl), align: 'left' });
      text('all other words', HK_B.x0 + 300, y + 1, { font: F_UI, size: 24, color: '#7f97c4', alpha: ea * sstep(.7, 1, ekl), align: 'left' });
    } else {
      ctx.save();
      const g = ctx.createLinearGradient(HK_B.x0, 0, HK_B.x0 + 150, 0); g.addColorStop(0, 'rgba(70,185,235,1)'); g.addColorStop(1, 'rgba(140,110,235,.8)'); ctx.fillStyle = g; ctx.shadowColor = 'rgba(110,170,255,.6)'; ctx.shadowBlur = 8;
      HK_FAN.forEach((m, j) => { const yy = y - (n * ph) / 2 + j * ph; ctx.globalAlpha = ea * Math.min(.95, m.a + .35); ctx.fillRect(HK_B.x0, yy, m.w * ek, 3.4); });
      ctx.restore();
    }
  }
  ctx.restore();
}

function hkSpark(lt) {                                           // the chosen word: a small gold light that leaves the end of the gold bar (above its label) and lands in the slot of "mat"
  const t0 = HK_B.tSpark, t1 = HK_TYPE_T(19) - .02, k = clamp((lt - t0) / (t1 - t0)); if (k <= 0 || k >= 1) return;
  const x0 = HK_B.x0 + HK_BARS[0][1] * HK_B.k + 6, y0 = hkRowY(0) - 30, x1 = hkLeftFinal() + hkAdv() * 19.5, y1 = HK.y1;
  const q = s => { const e = eio(s); return [lerp(x0, x1, e) + Math.sin(e * PI) * 34, lerp(y0, y1, e)]; };
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const fadeOut = 1 - sstep(.82, 1, k), fadeIn = sstep(0, .12, k);
  for (let i = 0; i < 7; i++) { const [x, y] = q(Math.max(0, k - i * .035)); glowDot(x, y, 10 - i * 1.1, 'rgba(255,205,110,A)', (1 - i / 7) * .95 * fadeOut * fadeIn); }
  ctx.restore();
}

// the static soft light of the title is baked once into small offscreen canvases (a full-frame drawImage plus shadowBlur text every frame was the cost of the title hold)
const HK_GBOX = { x: 200, y: 200, w: 1520, h: 460 };            // the gold halo of the five glyphs (title y 428 +- 100, blur 50 +- margin)
let HK_GLOW = null;
function hkGlowLayer() {
  if (HK_GLOW) return HK_GLOW;
  const c = document.createElement('canvas'); c.width = HK_GBOX.w; c.height = HK_GBOX.h; const x = c.getContext('2d');
  const L = titleLayout(HK.titleStr, HK.cx, HK.titleSize, HK.titleLs);
  x.font = `900 ${HK.titleSize}px ${F_ZH}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = 'rgba(255,180,80,.8)'; x.shadowBlur = 50; x.fillStyle = 'rgba(255,200,110,.9)';
  x.translate(-HK_GBOX.x, -HK_GBOX.y - 2000); x.shadowOffsetY = 2000;   // draw only the shadow, not the glyph itself
  [...HK.titleStr].forEach((ch, i) => x.fillText(ch, L[i].x, HK.titleCy));
  if (typeof fontsReady !== 'undefined' && fontsReady) HK_GLOW = c; else return c;
  return HK_GLOW;
}
const HK_TBOX = { x: HK.cx - 850, y: 560, w: 1700, h: 300 };    // the glow (shadow only) of the two subtitle lines, final letter spacing; one baked layer per line
const HK_TG = [null, null];
function hkTextGlow(k) {
  if (HK_TG[k]) return HK_TG[k];
  const c = document.createElement('canvas'); c.width = HK_TBOX.w; c.height = HK_TBOX.h; const x = c.getContext('2d');
  const cx = HK.cx, cy = HK.titleCy;
  x.translate(-HK_TBOX.x, -HK_TBOX.y - 2000); x.shadowOffsetY = 2000; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#000';
  if (k === 0) { x.font = `700 54px ${F_EN}`; x.letterSpacing = '20px'; x.shadowColor = 'rgba(255,190,100,.45)'; x.shadowBlur = 22; x.fillText('LARGE LANGUAGE MODELS', cx + 10, cy + 190); }
  else { x.font = `700 40px ${F_ZH}`; x.letterSpacing = '10px'; x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 10; x.fillText('它如何工作 · 如何训练', cx + 5, cy + 298); }
  if (typeof fontsReady !== 'undefined' && fontsReady) HK_TG[k] = c; else return c;
  return HK_TG[k];
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
  const kg = clamp((lt - (HK.tHit - .07)) / .28);
  if (kg <= 0) return;
  const sg = 1;                                                   // no scale pop: the glyphs must sit exactly on the particle shape or the fringe reads as a sheared copy
  ctx.save(); ctx.translate(HK.cx, HK.titleCy); ctx.scale(sg, sg); ctx.translate(-HK.cx, -HK.titleCy);
  const t = lt - HK.tHit, gh = .4 * sstep(-.5, -.05, t) * (1 - clamp(t / .12)), gl = clamp(kg * 4) * .8;   // the pre-hit halo and the glyph halo, merged into one draw
  ctx.globalAlpha = 1 - (1 - gh) * (1 - gl); ctx.drawImage(hkGlowLayer(), HK_GBOX.x, HK_GBOX.y);
  ctx.font = `900 ${size}px ${F_ZH}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  [...str].forEach((ch, i) => {
    const { x, w } = L[i], k = clamp((lt - (HK.tHit - .07 + i * .008)) / .28); if (k <= 0) return;
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
  const lbh = 138 * (1 - eio(clamp((lt - 6.2) / .9)));         // the timeline's letterbox height now: nothing from the title may light the black bars
  ctx.save(); ctx.beginPath(); ctx.rect(0, lbh, W, H - 2 * lbh); ctx.clip();
  // warm light behind the title
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  glowDot(cx, cy + 20, 760, 'rgba(255,160,70,A)', (.13 + .02 * Math.sin(lt * 1.3)) * sstep(-.1, .3, t) + .16 * Math.exp(-Math.max(0, t) * 2.2) * (t > 0 ? 1 : 0));
  ctx.restore();
  // the faint gold halo of the title appears before the hit, so the eye sees where the particles are going
  const gh = .4 * sstep(-.5, -.05, t) * (1 - clamp(t / .12));
  if (gh > .01 && t < -.07) { ctx.save(); ctx.globalAlpha = gh; ctx.drawImage(hkGlowLayer(), HK_GBOX.x, HK_GBOX.y); ctx.restore(); }   // (from -0.07 s hkGlyphs draws the same halo merged with its own)
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
  // English line (6.7) and tagline (7.3): each tweens in (letter spacing / small slide) and then is drawn crisp over its pre-rendered glow
  const te = lt - HK.tEn, ea = sstep(0, .4, te), ls = lerp(46, 20, eout(clamp(te / .6))), setE = te >= .62 && hkTextGlow(0) === HK_TG[0];
  if (setE) { ctx.drawImage(HK_TG[0], HK_TBOX.x, HK_TBOX.y); text('LARGE LANGUAGE MODELS', cx, cy + 190, { font: F_EN, weight: 700, size: 54, ls: 20, color: '#ecd9ac' }); }
  else if (ea > 0) text('LARGE LANGUAGE MODELS', cx, cy + 190, { font: F_EN, weight: 700, size: 54, ls, color: '#ecd9ac', alpha: ea, glow: 'rgba(255,190,100,.45)', blur: 22 });
  const tt = lt - HK.tTag, ra = sstep(-.2, .3, tt);
  if (ra > 0) { ctx.save(); ctx.globalAlpha = ra * .8; const g = ctx.createLinearGradient(cx - 300, 0, cx + 300, 0); g.addColorStop(0, 'rgba(230,200,140,0)'); g.addColorStop(.5, 'rgba(240,210,150,1)'); g.addColorStop(1, 'rgba(230,200,140,0)'); ctx.fillStyle = g; ctx.fillRect(cx - 300 * eout(ra), cy + 244, 600 * eout(ra), 2); ctx.restore(); }
  const ta = sstep(0, .3, tt), sl = (1 - eout(clamp(tt / .35))) * 14, setT = tt >= .35 && hkTextGlow(1) === HK_TG[1];
  if (ta > 0) {
    if (setT) ctx.drawImage(HK_TG[1], HK_TBOX.x, HK_TBOX.y);
    text('它如何工作 · 如何训练', cx, cy + 298 + sl, setT ? { size: 40, weight: 700, ls: 10, color: '#f0e3c4' } : { size: 40, weight: 700, ls: 10, color: '#f0e3c4', alpha: ta, glow: 'rgba(0,0,0,.6)', blur: 10 });
    text('HOW THEY WORK  ·  HOW THEY LEARN', cx, cy + 354 + sl, { font: F_EN, weight: 600, size: 29, ls: 8, color: '#eadcb4', alpha: ta });
  }
  ctx.restore();
}

scene({
  id: 'hook', start: 0, len: 4, fi: .01, fo: .4, mb: 2, bloom: 1,
  subs: [[0.5, 4.5, '大语言模型，本质上只做一件事——', 'A large language model does just one thing —'], [4.8, 9.7, '预测下一个词。', 'it predicts the next word.']],
  sfx: [
    [0, 'thump'],
    ...Array.from({ length: 18 }, (_, i) => [HK.T0 + i * HK.DT, 'type']),
    [HK_B.tUnfurl - .03, 'swish'], ...HK_BARS.map((_, i) => [HK_B.tUnfurl + i * HK_B.stag, 'tick', { hi: i === 0 }]),
    [HK_B.tGold + .05, 'shimmer'], [HK_B.tSpark - .02, 'whoosh', { dur: .3 }],
    ...[18, 19, 20, 21].map(i => [HK_TYPE_T(i), 'type']), [HK_TYPE_T(19), 'chime', { midi: 84 }], [HK_TYPE_T(19), 'up'],
    [HK.tHit - 1.6, 'riser', { dur: 1.6 }],
    [HK.tHit, 'hit', { k: .9 }], [HK.tHit, 'swell', { dur: 2.4 }], [HK.tHit + .15, 'shimmer'], [HK.tHit + .3, 'sparkle', { dur: 1.6 }],
    [HK.tEn, 'ding', { midi: 91 }], [HK.tTag, 'ding', { midi: 96 }],
  ],
  hits: [[HK.tHit, .25]],
  cam: (lt, d) => ({ z: 1 + .01 * lt / d + .03 * sstep(5.2, 10, lt), x: 9 * Math.sin(lt * .5), y: 6 * Math.sin(lt * .4 + 1) }),
  draw(lt) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    // backdrop fades up slowly: deep blue nebula (a little warmer once the title lands)
    const amp = .72 * Math.pow(sstep(.3, 3.4, lt), .8), wm = sstep(6.2, 8, lt);
    if (amp > .005) glDraw(0, { time: lt * .8 + 20, tint: [lerp(.06, .13, wm), lerp(.13, .15, wm), lerp(.46, .42, wm)], amp });
    // motes
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#cfe0ff';
    const ma = sstep(.3, 2.0, lt);
    for (const m of HK_MOTES) { const y = ((m.y - lt * m.sp * m.z - 150) % 780 + 780) % 780 + 150; ctx.globalAlpha = ma * (.05 + .2 * m.z) * (.6 + .4 * Math.sin(lt * 2 + m.p)); ctx.fillRect(m.x + Math.sin(lt * .4 + m.p) * 12, y, m.z * 2.4, m.z * 2.4); }
    ctx.restore();
    // heartbeat glow under the first caret (screen centre), then a faint one at the start of the line
    const hb = sstep(0, .1, lt) * Math.exp(-lt * 3.2) + .12 * sstep(.04, .3, lt), hb2 = .1 * sstep(.5, .9, lt) * (1 - sstep(1.4, 2.4, lt));
    if (hb > .01 && lt < .5) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowDot(HK.cx, HK.y0, 180 + 160 * Math.exp(-lt * 5), 'rgba(255,200,110,A)', hb * .6 * (1 - sstep(.38, .48, lt))); ctx.restore(); }
    if (hb2 > .005) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowDot(hkLeftFinal() + 7.5, HK.y0, 200, 'rgba(255,200,110,A)', hb2 * .6); ctx.restore(); }
    hkBuild();
    hkSentence(lt);
    hkBars(lt, 0);
    hkSpark(lt);
    hkParticles(lt);
    hkBars(lt, 1);
    hkTitle(lt);
  },
});
