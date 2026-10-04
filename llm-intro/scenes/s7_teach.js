// s7_teach: post-training. Human examples (fine-tuning) turn a text-continuer into an assistant; human preferences (RLHF) refine it.
const R = mulberry(20260007);
const kk = (t, a, b) => clamp((t - a) / (b - a));
const WARM = [.44, .3, .1], COLD = [.09, .15, .28];
const PN = { x: 560, y: 180, w: 1180, h: 670 };                      // the chat panel (phase A)
const CA = { x: 430, y: 300, w: 480, h: 400 }, CB = { x: 990, y: 300, w: 480, h: 400 };   // candidate answers (phase B)
const PROMPT = 'How do I boil an egg?';
const RAW = ['How do I peel a boiled egg?', 'How long do I boil an egg for?', 'How do I make egg salad?', 'How many calories are in an egg?', 'How do I tell if an egg is bad?'];
const RAW_T = [.4, .5, .6, .7, .8], RAW_D = .2;                          // the ramble is complete at 1.0 s and rests until the wipe passes (~2.0 s)
const STEPS = ['Put eggs in a pot, cover with water.', 'Boil 9–12 minutes.', 'Cool in cold water.'];
const STEPS_C = [['Put eggs in a pot,', 'cover with water.'], ['Boil 9–12 minutes.'], ['Cool in cold water.']];
const BAD = ['Eggs are tasty. You can', 'boil them, or fry them.', 'It depends, really…'];
const MID = [960, 340], MB = [245, 490], MR = 120, MIDR = 190;                             // where the model ends up (finale) / where it sits in phase B
const T_WIPE = 1.875, T_WE = 2.2, T_A_OUT = 3.15, T_B_IN = 3.38, T_PICK = 4.0625;   // events (local seconds): wipe on beat 3, phase A out, phase B in, pick on the eighth after beat 6
const AMB = '#ffdeb0';                                                // warm amber for the human-made things (PAL.gold stays reserved for the final emphasis)
const DUST = Array.from({ length: 70 }, () => ({ x: R() * W, y: R() * H, z: .3 + R() * .7, p: R() * TAU, s: .4 + R() * .8 }));
const PAIRS = Array.from({ length: 26 }, () => ({ y: 165 + R() * 700, sp: 90 + R() * 150, off: R() * 5000, s: .9 + R() * .8, ok: R() < .5 ? 1 : 0, z: R() }));
const ML = [3, 4, 4, 3];
const MN = [], MLINK = [];
ML.forEach((n, li) => { for (let i = 0; i < n; i++) MN.push({ li, x: (li - 1.5) * .62, y: (i - (n - 1) / 2) * (1.7 / (n - 1)) + (R() - .5) * .05, p: R() * TAU }); });
MN.forEach((a, i) => { const nx = MN.map((b, j) => [b, j]).filter(([b]) => b.li === a.li + 1).sort((p, q) => Math.abs(p[0].y - a.y) - Math.abs(q[0].y - a.y)); nx.forEach(([b, j], k) => { MLINK.push([i, j, R()]); }); });
const DOCS = Array.from({ length: 6 }, (_, i) => ({ t0: .25 + i * .1, dur: .55, ex: 520 + 20 * R(), ey: 440 + i * 24, rot: (R() - .5) * .35, cx: 330 + 40 * R(), cy: 330 + 70 * R() }));

// ---------------------------------------------------------------- small drawing helpers (paths only, no emoji)
function checkMark(x, y, r, col, a = 1, lw = 6) {
  ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x - r * .5, y + r * .02); ctx.lineTo(x - r * .12, y + r * .4); ctx.lineTo(x + r * .52, y - r * .38); ctx.stroke(); ctx.restore();
}
function crossMark(x, y, r, col, a = 1, lw = 6) {
  ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - r * .4, y - r * .4); ctx.lineTo(x + r * .4, y + r * .4); ctx.moveTo(x + r * .4, y - r * .4); ctx.lineTo(x - r * .4, y + r * .4); ctx.stroke(); ctx.restore();
}
function badge(x, y, r, col, a, glyph) {                              // round badge with a check / cross
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowDot(x, y, r * 2.4, rgba(col, 1).replace(/[\d.]+\)$/, 'A)'), a * .22); ctx.restore();
  ctx.save(); ctx.globalAlpha = a;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = rgba(col, .22); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = col; ctx.stroke(); ctx.restore();
  (glyph === 'ok' ? checkMark : crossMark)(x, y, r * 1.05, col, a, 6);
}
function letterDot(x, y, r, s, col, a) {
  ctx.save(); ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = rgba(col, .18); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = rgba(col, .95); ctx.stroke(); ctx.restore();
  text(s, x, y + 2, { font: F_UI, weight: 700, size: r * 1.15, color: '#fff', alpha: a });
}
function pill(label, x, y, col, a = 1) {                                // left-aligned tag
  const w = measure(label, 24, F_UI, 600) + 40;
  ctx.save(); ctx.globalAlpha = a; rrect(x, y - 21, w, 42, 21); ctx.fillStyle = rgba(col, .14); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = rgba(col, .85); ctx.stroke(); ctx.restore();
  text(label, x + 20, y + 1, { font: F_UI, weight: 600, size: 24, color: col, alpha: a, align: 'left' });
  return w;
}
function person(x, y, s, a, col = '255,222,176') {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowDot(x, y + 20 * s, 130 * s, `rgba(${col},A)`, a * .16); ctx.restore();
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha = a;
  ctx.beginPath(); ctx.moveTo(-72, 82); ctx.bezierCurveTo(-72, 22, -42, 12, 0, 12); ctx.bezierCurveTo(42, 12, 72, 22, 72, 82); ctx.closePath();
  ctx.moveTo(32, -32); ctx.arc(0, -32, 32, 0, TAU);
  ctx.fillStyle = `rgba(${col},.15)`; ctx.fill(); ctx.lineWidth = 3 / Math.max(.5, s * .9); ctx.strokeStyle = `rgba(${col},.92)`; ctx.stroke(); ctx.restore();
}
function docCard(cx, cy, w, h, a, rot = 0, wr = 1, glowA = .4) {          // a handwritten example: card, header, lines (wr = how much is written)
  if (glowA > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowDot(cx, cy, Math.max(w, h) * .75, 'rgba(255,200,120,A)', a * glowA * .3); ctx.restore(); }
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.globalAlpha = a;
  ctx.beginPath(); ctx.moveTo(-w / 2 + 10, -h / 2); ctx.lineTo(w / 2 - 26, -h / 2); ctx.lineTo(w / 2, -h / 2 + 26); ctx.lineTo(w / 2, h / 2 - 10);
  ctx.quadraticCurveTo(w / 2, h / 2, w / 2 - 10, h / 2); ctx.lineTo(-w / 2 + 10, h / 2); ctx.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - 10); ctx.lineTo(-w / 2, -h / 2 + 10);
  ctx.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + 10, -h / 2); ctx.closePath();
  ctx.fillStyle = 'rgba(255,238,210,.13)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,214,150,.8)'; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w / 2 - 26, -h / 2); ctx.lineTo(w / 2 - 26, -h / 2 + 26); ctx.lineTo(w / 2, -h / 2 + 26); ctx.strokeStyle = 'rgba(255,214,150,.55)'; ctx.stroke();
  const n = Math.max(3, Math.round(h / 34)), lw0 = w * .66;
  for (let i = 0; i < n; i++) {
    const f = clamp(wr * (n + 1) - i), y = -h / 2 + h * .2 + i * (h * .64 / (n - 1)), ww = lw0 * (i === 0 ? .55 : i % 3 === 2 ? .7 : 1);
    ctx.strokeStyle = i === 0 ? 'rgba(255,214,150,.95)' : 'rgba(255,236,205,.55)'; ctx.lineWidth = i === 0 ? 4 : 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-w * .33, y); ctx.lineTo(-w * .33 + ww * f, y); ctx.stroke();
  }
  ctx.restore();
}
function pencil(x, y, a, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(.75); ctx.scale(s, s); ctx.globalAlpha = a;
  ctx.fillStyle = '#ffe3b0'; rrect(-7, -64, 14, 54, 3); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-7, -10); ctx.lineTo(7, -10); ctx.lineTo(0, 8); ctx.closePath(); ctx.fillStyle = '#ffcb7a'; ctx.fill(); ctx.restore();
}
function cursor(x, y, s, a, press = 0) {                             // the rater's pointer: an arrow cursor with its tip at (x, y)
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowDot(x + 8 * s, y + 14 * s, 60, 'rgba(255,205,130,A)', a * .2); ctx.restore();
  ctx.save(); ctx.translate(x, y); const sc = s * (1 - .12 * press); ctx.scale(sc, sc); ctx.globalAlpha = a; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 40); ctx.lineTo(10, 31); ctx.lineTo(18, 50); ctx.lineTo(27, 46); ctx.lineTo(19, 28); ctx.lineTo(32, 28); ctx.closePath();
  ctx.fillStyle = '#fff3de'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(70,46,24,.9)'; ctx.stroke(); ctx.restore();
}
function iconPot(x, y, s, a) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha = a; ctx.strokeStyle = 'rgba(255,236,205,.92)'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  rrect(-34, -6, 68, 44, 9); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-34, 6); ctx.lineTo(-46, 6); ctx.moveTo(34, 6); ctx.lineTo(46, 6); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-8, -22, 11, 14, .25, 0, TAU); ctx.ellipse(14, -19, 11, 14, -.25, 0, TAU); ctx.stroke();
  ctx.restore();
}
function iconClock(x, y, s, a) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha = a; ctx.strokeStyle = 'rgba(255,236,205,.92)'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 4, 30, 0, TAU); ctx.moveTo(0, 4); ctx.lineTo(0, -16); ctx.moveTo(0, 4); ctx.lineTo(14, 12); ctx.moveTo(-6, -32); ctx.lineTo(6, -32); ctx.stroke(); ctx.restore();
}
function iconDrop(x, y, s, a) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha = a; ctx.strokeStyle = 'rgba(255,236,205,.92)'; ctx.lineWidth = 3.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(0, -36); ctx.bezierCurveTo(8, -18, 26, -2, 26, 14); ctx.arc(0, 14, 26, 0, PI); ctx.bezierCurveTo(-26, -2, -8, -18, 0, -36); ctx.stroke(); ctx.restore();
}
// the model, drawn as a small layered network. warm = 0..1 lights it gold-white
function model(cx, cy, r, lt, a, warm, pulse = 0) {
  if (a <= 0) return;
  const px = n => cx + n.x * r * 1.05, py = n => cy + n.y * r * 1.05;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
  glowDot(cx, cy, r * 2.0, warm > .01 ? `rgba(255,${190 + 40 * warm | 0},${140 + 60 * warm | 0},A)` : 'rgba(95,180,255,A)', .16 + .1 * pulse + .06 * warm);
  ctx.lineWidth = Math.max(1.4, r * .014); ctx.strokeStyle = warm > .01 ? `rgba(255,${215 + 20 * warm | 0},${180},.3)` : 'rgba(110,200,255,.3)';
  ctx.beginPath(); for (const [i, j] of MLINK) { ctx.moveTo(px(MN[i]), py(MN[i])); ctx.lineTo(px(MN[j]), py(MN[j])); } ctx.stroke();
  const sg = Math.max(1.5, r * .016);
  for (const [i, j, ph] of MLINK) {                                       // signals travelling forward through the layers
    const f = ((lt * .55 + ph * 3) % 1); const x = lerp(px(MN[i]), px(MN[j]), f), y = lerp(py(MN[i]), py(MN[j]), f);
    ctx.fillStyle = `rgba(255,255,255,${.7 * Math.sin(PI * f)})`; ctx.fillRect(x - sg, y - sg, sg * 2, sg * 2);
  }
  for (const n of MN) {
    const b = .6 + .4 * Math.sin(lt * 2.2 + n.p) + pulse * .5; glowDot(px(n), py(n), r * .16, warm > .01 ? 'rgba(255,215,160,A)' : 'rgba(150,215,255,A)', clamp(.5 * b * (1 - .2 * warm)));
    ctx.fillStyle = `rgba(255,255,255,${clamp(.55 + .3 * b)})`; ctx.beginPath(); ctx.arc(px(n), py(n), Math.max(2, r * .03), 0, TAU); ctx.fill();
  }
  ctx.restore();
}
function roundedPoly(pts, rad, n = 8) {                                  // dense polyline through waypoints with rounded corners
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1], d1 = Math.hypot(b[0] - a[0], b[1] - a[1]), d2 = Math.hypot(c[0] - b[0], c[1] - b[1]), r = Math.min(rad, d1 / 2, d2 / 2);
    const p0 = [b[0] + (a[0] - b[0]) / d1 * r, b[1] + (a[1] - b[1]) / d1 * r], p1 = [b[0] + (c[0] - b[0]) / d2 * r, b[1] + (c[1] - b[1]) / d2 * r];
    out.push(p0); for (let k = 1; k < n; k++) { const t = k / n, u = 1 - t; out.push([u * u * p0[0] + 2 * u * t * b[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * b[1] + t * t * p1[1]]); } out.push(p1);
  }
  out.push(pts[pts.length - 1]); return out;
}
const LINE_Y = 862, BAR = { x: 1600, y: 300, h: 380 };                    // reward bar geometry
const LOOP = roundedPoly([[BAR.x, BAR.y + BAR.h + 20], [BAR.x, LINE_Y], [MB[0], LINE_Y], [MB[0], MB[1] + MR * 1.05 * .89 + 16]], 46);
const LOOP_LEN = []; { let s = 0; LOOP_LEN.push(0); for (let i = 1; i < LOOP.length; i++) { s += Math.hypot(LOOP[i][0] - LOOP[i - 1][0], LOOP[i][1] - LOOP[i - 1][1]); LOOP_LEN.push(s); } }
function loopAt(f) {                                                     // point + direction at fraction f along the loop
  const L = LOOP_LEN[LOOP_LEN.length - 1] * f; let i = 1; while (i < LOOP.length - 1 && LOOP_LEN[i] < L) i++;
  const a = LOOP[i - 1], b = LOOP[i], t = (L - LOOP_LEN[i - 1]) / Math.max(1e-6, LOOP_LEN[i] - LOOP_LEN[i - 1]);
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), Math.atan2(b[1] - a[1], b[0] - a[0]), i];
}
function glassCard(r, o, a) {                                            // glass panel; the glow is a cheap double stroke (no shadowBlur on big rects)
  glass(r.x, r.y, r.w, r.h, { ...o, glow: null, alpha: a });
  if (o.glow) { ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = o.glow; for (const lw of [14, 6]) { ctx.lineWidth = lw; rrect(r.x, r.y, r.w, r.h, 18); ctx.stroke(); } ctx.restore(); }
}

// ---------------------------------------------------------------- panel contents (phase A)
function rawContent(lt, a) {
  for (let i = 0; i < RAW.length; i++) {
    const n = RAW[i].length, s = typed(RAW[i], kk(lt, RAW_T[i], RAW_T[i] + RAW_D) * n);
    if (!s) continue;
    text(s, PN.x + 40, 428 + i * 66, { font: F_MONO, size: 32, color: '#c4cfe8', alpha: a * (.98 - i * .03), align: 'left' });
  }
  const last = RAW.length - 1;                                           // the caret appears (and blinks) only once the last line is complete, so it never smears while typing
  if (lt >= RAW_T[last] + RAW_D) caret(PN.x + 40 + measure(RAW[last], 32, F_MONO) + 8, 428 + last * 66, 36, lt, '#c4cfe8', a);
}
function fineContent(lt, a) {
  const ys = [455, 595, 735], icons = [iconPot, iconClock, iconDrop];
  ctx.save(); ctx.globalAlpha = a * .5; ctx.strokeStyle = 'rgba(255,220,170,.22)'; ctx.lineWidth = 1.5; ctx.beginPath();
  for (const y of [525, 665]) { ctx.moveTo(PN.x + 40, y); ctx.lineTo(PN.x + PN.w - 40, y); } ctx.stroke(); ctx.restore();
  STEPS.forEach((s, i) => {
    const k = kk(lt, T_WIPE + .08 + i * .07, T_WIPE + .28 + i * .07), e = eout(k), x = PN.x + 100 - 12 * (1 - e);
    ctx.save(); ctx.globalAlpha = a * k; ctx.beginPath(); ctx.arc(PN.x + 90, ys[i], 36, 0, TAU); ctx.fillStyle = 'rgba(255,222,176,.2)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = AMB; ctx.stroke(); ctx.restore();
    text(String(i + 1), PN.x + 90, ys[i] + 2, { font: F_UI, weight: 700, size: 40, color: AMB, alpha: a * k });
    text(s, x + 70, ys[i] + 1, { font: F_UI, weight: 500, size: 42, color: '#fff6e6', alpha: a * k, align: 'left' });
    icons[i](PN.x + PN.w - 110, ys[i], 1.15, a * k * .95);
  });
}
// ---------------------------------------------------------------- compact candidates (phase B)
function candB(r, a) {
  letterDot(r.x + 46, r.y + 46, 28, 'B', PAL.mint, a);
  text('answer B · 回答 B', r.x + 90, r.y + 47, { font: F_UI, weight: 600, size: 24, color: '#bfeedb', alpha: a, align: 'left' });
  let y = r.y + 120;
  STEPS_C.forEach((ls, i) => {
    ctx.save(); ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(r.x + 46, y, 20, 0, TAU); ctx.strokeStyle = AMB; ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore();
    text(String(i + 1), r.x + 46, y + 1, { font: F_UI, weight: 700, size: 26, color: AMB, alpha: a });
    ls.forEach((l, j) => text(l, r.x + 84, y + j * 38, { font: F_UI, weight: 500, size: 30, color: '#fff6e6', alpha: a, align: 'left' }));
    y += ls.length > 1 ? 104 : 80;
  });
}
function candA(r, a) {
  letterDot(r.x + 46, r.y + 46, 28, 'A', '#aab6d4', a);
  text('answer A · 回答 A', r.x + 90, r.y + 47, { font: F_UI, weight: 600, size: 24, color: '#b9c4de', alpha: a, align: 'left' });
  BAD.forEach((l, i) => text(l, r.x + 36, r.y + 130 + i * 52, { font: F_UI, weight: 400, size: 30, color: '#b0bbd6', alpha: a, align: 'left' }));
}
function scoreBar(r, a, v, col) {                                       // small reward score under a candidate (filled when the human has chosen)
  const x0 = r.x + 150, w = r.w - 150 - 36, y = r.y + r.h - 40;
  text('得分 score', r.x + 36, y, { font: F_UI, weight: 600, size: 22, color: '#cdd8ee', alpha: a, align: 'left' });
  ctx.save(); ctx.globalAlpha = a; rrect(x0, y - 8, w, 16, 8); ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(180,215,255,.4)'; ctx.stroke();
  if (v > .01) { rrect(x0, y - 8, Math.max(16, w * v), 16, 8); ctx.fillStyle = col; ctx.fill(); }
  ctx.restore();
}

// ---------------------------------------------------------------- background streams ("many comparisons")
function streams(lt, vis) {
  if (vis <= 0) return;
  const span = W + 400;
  ctx.save(); ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const p of PAIRS) {
    const x = W + 150 - ((lt * p.sp + p.off) % span), y = p.y + 6 * Math.sin(lt * .8 + p.off), w = 54 * p.s, h = 36 * p.s, g = 10 * p.s;
    const inModel = lt > 3.4 && x + 2 * w + g > 80 && x < 400 && y > 300 && y < 650, inBar = x + 2 * w + g > 1470 && x < 1760 && y > 215 && y < 710;
    const inCards = x + 2 * w + g > 380 && x < 1500 && y > 150 && y < 700, inRaters = x + 2 * w + g > 280 && x < 1480 && y > 700 && y < 840 || (lt > 3.4 && lt < 4.4 && x + 2 * w + g > 620 && x < 1480 && y > 480 && y < 840);   // keep clear of the cards and the rater caption
    const inLoop = lt > 4.1 && x + 2 * w + g > 190 && x < 1650 && y > 820 && y < 900;                                                      // ... and of the update loop
    const a = vis * (.26 + .2 * p.z) * (inCards ? .14 : inRaters ? .3 : inLoop ? .1 : inModel || inBar ? .15 : 1);
    for (let k = 0; k < 2; k++) {
      const bx = x + k * (w + g), win = k === p.ok;
      ctx.globalAlpha = a * (win ? 1.3 : .85); ctx.strokeStyle = win ? PAL.mint : PAL.coral; ctx.fillStyle = win ? 'rgba(94,242,176,.1)' : 'rgba(255,107,122,.07)';
      rrect(bx, y - h / 2, w, h, 7 * p.s); ctx.fill(); ctx.stroke();
      ctx.globalAlpha = a * .9; ctx.beginPath(); ctx.moveTo(bx + w * .2, y - h * .12); ctx.lineTo(bx + w * .8, y - h * .12); ctx.moveTo(bx + w * .2, y + h * .16); ctx.lineTo(bx + w * .6, y + h * .16); ctx.stroke();
    }
  }
  ctx.restore();
}

scene({
  id: 'teach', start: 17, len: 3, fi: .25, fo: .12, mb: 2, bloom: .75,
  ch: ['07', '微调', 'FINE-TUNING'],
  subs: [
    [.3, 3.7, '预训练只会“续写”。再用人类的示范和反馈来调教', 'Pretraining only continues text. Human examples and feedback then teach it to help'],
    [3.9, 7.3, '人们更喜欢的回答得高分，它就学会了更有用、更诚实', 'Answers people prefer score higher — so it learns to be more helpful and honest'],
  ],
  sfx: [
    [.05, 'pop'], [.08, 'type'], [.15, 'type'], [.22, 'type'], [.29, 'type'], [.36, 'type'],
    [.4, 'type'], [.5, 'type'], [.6, 'type'], [.7, 'type'], [.8, 'type'],
    [.8, 'tick', { hi: true }], [.9, 'tick', { hi: true }], [1.0, 'tick', { hi: true }], [1.1, 'tick', { hi: true }], [1.2, 'tick', { hi: true }], [1.3, 'tick', { hi: true }],
    [1.5, 'swell', { dur: .35 }], [1.875, 'swish'], [2.2, 'chime', { midi: 84 }],
    [1.98, 'chip', { midi: 72 }], [2.06, 'chip', { midi: 76 }], [2.14, 'chip', { midi: 79 }],
    [3.3, 'whoosh', { dur: .4 }], [3.45, 'pop'], [3.75, 'pop'],
    [3.9, 'tick'], [4.0625, 'up'], [4.1875, 'down'], [4.0625, 'count', { dur: .55 }],
    [5.0, 'whoosh', { dur: .42 }], [4.9, 'swell', { dur: .45 }],
    [5.3125, 'ding', { midi: 79 }], [5.625, 'ding', { midi: 84 }], [5.9375, 'ding', { midi: 88 }], [5.9375, 'sparkle', { dur: .6 }],
  ],
  cam: camPush(.03),
  draw(lt) {
    // ---- backdrop: cold and flat at first, warms at the moment the human examples take effect (amber with a teal counter-glow)
    const kW = sstep(1.8, 2.4, lt), tint = COLD.map((c, i) => lerp(c, WARM[i], kW));
    glDraw(0, { time: lt * .5 + 55, tint, amp: .9 + .3 * kW });
    if (kW > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      glowDot(1750, 980, 1000, 'rgba(30,190,210,A)', .2 * kW); glowDot(40, 60, 800, 'rgba(255,170,70,A)', .09 * kW);
      ctx.restore();
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';                    // drifting warm motes
    for (const m of DUST) {
      const x = (m.x + lt * 9 * m.z + 30 * Math.sin(lt * .3 + m.p)) % W, y = ((m.y - lt * 14 * m.z) % H + H) % H, a = (.25 + .25 * Math.sin(lt * 1.3 + m.p)) * m.z * (.3 + .7 * kW);
      ctx.fillStyle = `rgba(255,${210 + 30 * m.z | 0},${160 + 40 * m.z | 0},${a})`; ctx.fillRect(x, y, 2.4 * m.s, 2.4 * m.s);
    }
    ctx.restore();

    const bGone = 1 - sstep(4.85, 5.15, lt), bIn = sstep(T_B_IN, T_B_IN + .35, lt);   // phase B visibility (it only starts once phase A has gone)
    streams(lt, sstep(3.7, 4.4, lt) * (1 - .4 * sstep(5.2, 5.7, lt)));

    // ---- left column in phase A: the human writing examples; it glides to the bottom and becomes "human raters"
    const pA = sstep(0, .4, lt) * (1 - sstep(T_A_OUT, T_A_OUT + .22, lt)), rP = sstep(3.5, 3.85, lt) * bGone;   // the writer fades out at the top left; the same person returns as a rater at the bottom
    if (rP > 0) person(520, 770, .62, rP);
    if (pA > 0) {
      person(250, 360, 1.05, pA);
      const dA = sstep(.1, .45, lt) * (1 - sstep(T_A_OUT, T_A_OUT + .22, lt)), wr = kk(lt, .1, .85);
      if (dA > 0) {
        docCard(250, 600, 200, 250, dA, -.04, wr);
        const li = Math.floor(wr * 7); pencil(250 - 66 + 132 * ((wr * 7) % 1) * .9 + 18, 600 - 125 + 50 + clamp(li, 0, 4) * 34, dA * (1 - sstep(.85, 1.15, lt)), 1);
        text('人类撰写的示范', 250, 756, { font: F_UI, weight: 600, size: 26, color: '#ffe3b8', alpha: dA });
        text('human-written examples', 250, 792, { font: F_UI, size: 22, color: '#d8c6a4', alpha: dA });
      }
    }
    const rA = sstep(3.55, 3.9, lt) * bGone;
    if (rA > 0) { text('人类评审', 450, 757, { font: F_UI, weight: 600, size: 24, color: '#ffe3b8', alpha: rA, align: 'right' }); text('human raters', 450, 788, { font: F_UI, size: 22, color: '#d8c6a4', alpha: rA, align: 'right' }); }
    // documents fly from the person into the panel; on landing a spark runs on to the model icon and lights it
    const ICON = [PN.x + PN.w - 96, 345], SPK = .3;
    let landed = 0;
    for (const c of DOCS) {
      const k = kk(lt, c.t0, c.t0 + c.dur), tl = lt - c.t0 - c.dur;
      if (tl > SPK + .05) landed += Math.exp(-(tl - SPK - .05) * 5) * .6;
      if (k <= 0 || k >= 1) {
        if (k >= 1 && tl < .5) { const g = Math.exp(-tl * 7); ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowDot(PN.x, c.ey, 120 * (1 + (1 - g)), 'rgba(255,205,140,A)', .32 * g); ctx.restore(); }
        if (k >= 1 && tl < SPK) {                                                // the spark runs on to the model icon
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          for (let q = 0; q < 4; q++) { const f2 = eio(Math.max(0, tl - q * .025) / SPK); glowDot(lerp(PN.x, ICON[0], f2), lerp(c.ey, ICON[1], f2) - 90 * Math.sin(PI * f2), 20 - q * 3.5, 'rgba(255,215,150,A)', .8 - q * .18); }
          ctx.restore();
        }
        continue;
      }
      const e = eio(k), u = 1 - e, sc = lerp(.62, .34, e);
      for (let g = 1; g >= 0; g--) { const e2 = eio(clamp(k - g * .06)), u2 = 1 - e2; docCard(u2 * u2 * 330 + 2 * u2 * e2 * c.cx + e2 * e2 * c.ex, u2 * u2 * 600 + 2 * u2 * e2 * c.cy + e2 * e2 * c.ey, 200 * sc, 250 * sc, (g ? .14 : 1) * (1 - sstep(.8, 1, k)), c.rot * e, 1, g ? 0 : .5); }
    }

    // ---- the chat panel (phase A): raw (cold) | fine-tuned (warm), swapped by a wipe at the beat, held, then dissolves into phase B
    const wk = eio(kk(lt, T_WIPE, T_WE)), wipe = lerp(PN.x - 30, PN.x + PN.w + 30, wk);
    const pIn = eout(kk(lt, 0, .4)), gA = pIn * (1 - sstep(T_A_OUT, T_A_OUT + .22, lt));
    if (gA > 0) {
      ctx.save(); ctx.translate(0, (1 - pIn) * 14);
      if (wipe < PN.x + PN.w) {
        ctx.save(); ctx.beginPath(); ctx.rect(wipe, 0, W, H); ctx.clip();                    // cold, raw side
        glassCard(PN, { fill: 'rgba(16,22,38,.78)', stroke: 'rgba(140,160,200,.28)', glow: 'rgba(90,110,160,.12)' }, gA);
        rawContent(lt, gA); ctx.restore();
      }
      if (wipe > PN.x - 29) {
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, wipe, H); ctx.clip();                    // warm, fine-tuned side
        glassCard(PN, { fill: 'rgba(30,24,22,.76)', stroke: 'rgba(255,215,150,.55)', glow: 'rgba(255,190,110,.12)' }, gA);
        fineContent(lt, gA); ctx.restore();
      }
      pill('pretrained · 预训练模型', PN.x + 40, 345, '#aab6d4', gA * sstep(.1, .4, lt) * (1 - sstep(T_WIPE - .06, T_WIPE + .04, lt)));
      pill('fine-tuned · 微调后', PN.x + 40, 345, PAL.mint, gA * sstep(T_WIPE + .1, T_WIPE + .3, lt));
      // the model, small, at the panel's corner: it lights as each human example reaches it and warms after the wipe
      const mw = sstep(T_WIPE, T_WE, lt);
      text('model · 模型', PN.x + PN.w - 158, 345, { font: F_UI, weight: 600, size: 30, color: '#cfe7ff', alpha: gA * .9, align: 'right' });
      model(ICON[0], ICON[1], 46, lt, gA, mw, clamp(landed, 0, 1.4));
      if (lt > T_WIPE - .05 && lt < T_WE + .05) { const wa = Math.sin(PI * kk(lt, T_WIPE, T_WE)); ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(wipe - 60, 0, wipe, 0);
        g.addColorStop(0, 'rgba(255,200,130,0)'); g.addColorStop(1, `rgba(255,230,190,${.55 * wa * gA})`); ctx.beginPath(); ctx.rect(PN.x, PN.y - 4, PN.w, PN.h + 8); ctx.clip(); ctx.fillStyle = g; ctx.fillRect(wipe - 60, PN.y - 4, 60, PN.h + 8);
        ctx.fillStyle = `rgba(255,248,230,${.85 * wa * gA})`; ctx.fillRect(wipe - 1.5, PN.y - 4, 3, PN.h + 8); ctx.restore(); }
      // prompt bubble (typed, grows with the text)
      const full = measure(PROMPT, 36, F_UI, 600) + 56, ts = typed(PROMPT, kk(lt, .06, .4) * PROMPT.length), bw = Math.max(70, measure(ts, 36, F_UI, 600) + 56);
      const ba = gA * sstep(0, .1, lt), bx0 = PN.x + PN.w - 40 - full, by = PN.y + 70;
      ctx.save(); ctx.globalAlpha = ba; rrect(bx0, by - 34, bw, 68, 30); ctx.fillStyle = 'rgba(95,227,255,.13)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(95,227,255,.75)'; ctx.stroke(); ctx.restore();
      text(ts, bx0 + 28, by + 2, { font: F_UI, weight: 600, size: 36, color: '#eaf6ff', alpha: ba, align: 'left' });
      ctx.restore();
    }

    // ---- phase B: two candidate answers arrive as the panel dissolves, the hand comes from the rater, picks B, reward rises, loop back into the model
    const vis = bIn * bGone;
    const pick = sstep(T_PICK - .05, T_PICK + .2, lt), ek = eout(kk(lt, T_B_IN, T_B_IN + .45)), slide = (1 - ek) * 34;
    if (vis > 0) {
      // the model feeds both answers: faint threads that run behind the cards
      const tA = vis * (1 - sstep(4.55, 4.8, lt)) * .5;
      if (tA > 0) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
        for (const [ty, tx1, ph] of [[470, CA.x + 2, 0], [512, CB.x + 2, .5]]) {
          const x0 = MB[0] + MR * .98, y0 = MB[1] + (ty - 490) * .4;
          ctx.globalAlpha = tA * .5; ctx.strokeStyle = 'rgba(255,214,160,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(tx1, ty + slide); ctx.stroke();
          const f = (lt * .7 + ph) % 1; ctx.globalAlpha = 1; glowDot(lerp(x0, tx1, f), lerp(y0, ty + slide, f), 12, 'rgba(255,214,160,A)', tA * Math.sin(PI * f));
        }
        ctx.restore();
      }
      // the question, and the prompt that both answers respond to
      const bw = measure(PROMPT, 36, F_UI, 600) + 56, bx = (CA.x + CB.x + CB.w) / 2;
      ctx.save(); ctx.translate(0, slide); ctx.globalAlpha = vis; rrect(bx - bw / 2, 190 - 34, bw, 68, 30); ctx.fillStyle = 'rgba(95,227,255,.13)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(95,227,255,.75)'; ctx.stroke(); ctx.restore();
      text(PROMPT, bx - bw / 2 + 28, 192 + slide, { font: F_UI, weight: 600, size: 36, color: '#eaf6ff', alpha: vis, align: 'left' });
      text('Which answer is better? · 哪个回答更好？', bx, 262 + slide, { font: F_UI, weight: 600, size: 30, color: '#ffe3b8', alpha: vis * sstep(3.6, 3.9, lt) });
      // card A (the weaker one) and card B
      ctx.save(); ctx.translate(0, slide);
      const aV = vis * (1 - .35 * pick), pOn = lt > T_PICK - .05;
      glassCard(CA, { fill: 'rgba(18,22,36,.92)', stroke: pOn ? rgba(PAL.coral, .5) : 'rgba(150,170,210,.4)' }, aV); candA(CA, aV);
      glassCard(CB, { fill: 'rgba(30,24,22,.92)', stroke: pOn ? rgba(PAL.mint, .5 + .4 * pick) : 'rgba(255,215,150,.55)', glow: pOn ? 'rgba(94,242,176,.16)' : 'rgba(255,190,110,.1)' }, vis); candB(CB, vis);
      const sk = eio(kk(lt, T_PICK - .05, T_PICK + .4));                      // each answer gets a score: A low, B high
      scoreBar(CA, aV, .2 * sk, PAL.coral); scoreBar(CB, vis, .9 * sk, PAL.mint);
      if (pOn) { badge(CA.x + CA.w - 46, CA.y + 46, 28, PAL.coral, aV * kk(lt, T_PICK, T_PICK + .25) * .95, 'x'); badge(CB.x + CB.w - 46, CB.y + 46, 30, PAL.mint, vis * kk(lt, T_PICK - .05, T_PICK + .15), 'ok'); }
      ctx.restore();
      // reward meter
      const rwA = vis * sstep(3.65, 3.95, lt), v = lerp(.1, .88, eio(kk(lt, T_PICK - .05, 4.8)));
      if (rwA > 0) {
        const by0 = BAR.y + slide, bh2 = BAR.h;
        ctx.save(); ctx.globalAlpha = rwA; rrect(BAR.x - 24, by0, 48, bh2, 24); ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(180,215,255,.5)'; ctx.stroke();
        ctx.save(); rrect(BAR.x - 24, by0, 48, bh2, 24); ctx.clip();
        const g = ctx.createLinearGradient(0, by0 + bh2, 0, by0); g.addColorStop(0, '#2fb88a'); g.addColorStop(.6, PAL.mint); g.addColorStop(1, AMB);
        ctx.fillStyle = g; ctx.fillRect(BAR.x - 24, by0 + bh2 * (1 - v), 48, bh2 * v); ctx.restore(); ctx.restore();
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowDot(BAR.x, by0 + bh2 * (1 - v), 40, 'rgba(255,205,130,A)', rwA * (.1 + .12 * kk(lt, T_PICK - .05, T_PICK + .35))); ctx.restore();
        text('reward · 奖励', BAR.x, 262 + slide, { font: F_UI, weight: 600, size: 30, color: '#f0fbf0', alpha: rwA });
      }
    }
    // the rater's cursor: leaves the person, glides under the cards to B and clicks on its body
    const hA = sstep(3.55, 3.8, lt) * (1 - sstep(4.3, 4.55, lt));
    if (hA > 0) {
      const tb = eio(kk(lt, 3.6, 4.0)), u = 1 - tb, hx = u * u * 650 + 2 * u * tb * 1000 + tb * tb * 1405, hy = u * u * 770 + 2 * u * tb * 800 + tb * tb * 545;
      const press = Math.sin(PI * kk(lt, 3.98, T_PICK + .12));
      cursor(hx, hy, 1.15, hA, press);
      if (lt > T_PICK - .05 && lt < 4.7) { const k = kk(lt, T_PICK - .05, 4.7); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1 - k) * hA; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,225,170,.9)'; ctx.beginPath(); ctx.arc(1405, 545, 12 + 46 * eout(k), 0, TAU); ctx.stroke(); ctx.restore(); }
    }
    // the model (left, phase B) + update loop, then the model travels to the top centre (position and size interpolate; nothing cross-fades)
    const warm = sstep(4.7, 5.2, lt), dings = [5.3125, 5.625, 5.9375];
    let dp = 0; for (const t0 of dings) if (lt > t0) dp += Math.exp(-(lt - t0) * 4.5);
    const upd = sstep(4.55, 4.7, lt) * (1 - sstep(4.85, 5.2, lt)), pulse = Math.max(upd, .25 * sstep(5.2, 5.5, lt) + .9 * Math.min(1, dp));
    const mA = sstep(T_B_IN + .05, T_B_IN + .4, lt), tm = eio(kk(lt, 5.0, 5.42));
    if (mA > 0) {
      model(lerp(MB[0], MID[0], tm), lerp(MB[1], MID[1], tm), lerp(MR, MIDR, tm), lt, mA, warm, pulse);
      const lab = mA * (1 - sstep(4.85, 5.0, lt)); if (lab > 0) text('model · 模型', MB[0], 345, { font: F_UI, weight: 600, size: 30, color: '#e2f0ff', alpha: lab });
    }
    const lp = sstep(T_PICK + .05, 4.7, lt), la = 1 - sstep(4.85, 5.1, lt);
    if (lp > 0 && la > 0) {
      const [hx, hy, ang, hi] = loopAt(lp);
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(LOOP[0][0], LOOP[0][1]); for (let i = 1; i < hi; i++) ctx.lineTo(LOOP[i][0], LOOP[i][1]); ctx.lineTo(hx, hy);
      ctx.globalAlpha = la * .16; ctx.lineWidth = 14; ctx.strokeStyle = 'rgba(255,190,110,1)'; ctx.stroke();
      ctx.globalAlpha = la; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,224,170,.9)'; ctx.stroke(); ctx.restore();
      ctx.save(); ctx.globalAlpha = la; ctx.translate(hx, hy); ctx.rotate(ang); ctx.fillStyle = '#ffe9c4';
      ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-11, -12); ctx.lineTo(-11, 12); ctx.closePath(); ctx.fill(); ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let q = 0; q < 3; q++) { const f = (lp * .94 - q * .06); if (f > 0) { const [x, y] = loopAt(f); glowDot(x, y, 10, 'rgba(255,215,150,A)', la * (.8 - q * .22)); } } ctx.restore();
      const ua = sstep(.3, .6, lp) * la; if (ua > 0) text('update · 更新', (BAR.x + MB[0]) / 2, LINE_Y - 34, { font: F_UI, weight: 700, size: 30, color: '#fff0d4', alpha: ua });
    }
    // ---- finale: three values as glowing chips under the model (empty slots are outlined first, so the set of three reads at once)
    const items = [['helpful', '有用', PAL.cyan, 5.3125], ['honest', '诚实', PAL.mint, 5.625], ['harmless', '无害', PAL.violet, 5.9375]];
    const cw = 410, chH = 136, gap = 66, x0 = W / 2 - (cw * 3 + gap * 2) / 2, cy = 690, slotA = sstep(5.15, 5.4, lt);
    const thr = (cx, tTop) => { ctx.beginPath(); ctx.moveTo(MID[0], MID[1] + MIDR * .95); ctx.bezierCurveTo(MID[0], 570, cx, 570, cx, tTop); };
    items.forEach(([en, zh, col, t0], i) => {
      const cx = x0 + cw / 2 + i * (cw + gap), k = kk(lt, t0, t0 + .32);
      if (k < 1 && slotA > 0) {
        ctx.save(); ctx.globalAlpha = slotA * (1 - k) * .8; ctx.setLineDash([10, 10]); ctx.lineWidth = 2.5; ctx.strokeStyle = rgba(col, .75); rrect(cx - cw / 2, cy - chH / 2, cw, chH, 34); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = slotA * (1 - k) * .16; ctx.strokeStyle = rgba(col, .8); ctx.lineWidth = 2; thr(cx, cy - chH / 2); ctx.stroke(); ctx.restore();
      }
      if (k <= 0) return;
      const sc = .6 + .4 * eback(k), a = clamp(k * 3), f = clamp((lt - t0) / .4);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';                    // thread of light from the model, drawn out as the chip pops
      ctx.globalAlpha = a * (.5 + .4 * f); ctx.strokeStyle = rgba(col, .95); ctx.lineWidth = 3; ctx.setLineDash([700 * eout(f), 2000]); thr(cx, cy - chH / 2 * sc); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowDot(cx, cy, 230, rgba(col, 1).replace(/[\d.]+\)$/, 'A)'), a * .15 * (1 + .3 * Math.sin(lt * 3 + i))); ctx.restore();
      ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.globalAlpha = a;
      rrect(-cw / 2, -chH / 2, cw, chH, 34); ctx.fillStyle = 'rgba(8,12,22,.55)'; ctx.fill(); ctx.fillStyle = rgba(col, .15); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = rgba(col, .95); ctx.stroke(); ctx.restore();
      text(en, cx, cy - 18 * sc, { font: F_UI, weight: 700, size: Math.max(30, 48 * sc), color: '#eef3ff', alpha: a });
      text(zh, cx, cy + 34 * sc, { font: F_UI, weight: 600, size: Math.max(24, 34 * sc), color: rgba(col, 1), alpha: a });
    });
  },
});
