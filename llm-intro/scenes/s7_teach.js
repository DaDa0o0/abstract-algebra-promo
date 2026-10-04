// s7_teach (2:50 cut, 10 bars, 25 s): post-training.
//   A 0-6.7   the raw pretrained model only continues text (a ramble of more questions)
//   B 6.7-13.9  people write examples; the model learns to answer cleanly (fine-tuned)
//   C 13.9-21.1 people compare two answers, a reward rises, the model is updated; many comparisons
//   D 21.1-25   the model alone, three chips: helpful / honest / harmless
// The model (a small layered network) is ONE persistent object that glides between the pages.
const R = mulberry(20260007);
const kk = (t, a, b) => clamp((t - a) / (b - a));
const WARM = [.44, .3, .1], COLD = [.09, .15, .28];
const AMB = '#ffdeb0';                                                // warm amber for the human-made things (PAL.gold stays reserved)
const PROMPT = 'How do I boil an egg?';
const RAW = ['How do I peel a boiled egg?', 'How long do I boil an egg for?', 'How do I make egg salad?', 'How many calories are in an egg?', 'How do I tell if an egg is bad?'];
const RAW_T = [1.3, 1.75, 2.2, 2.65, 3.1], RAW_D = .4;                  // the ramble is complete at 3.5 s and rests until 6.4 s
const STEPS = ['Put eggs in a pot,\ncover with water.', 'Boil 9–12 minutes.', 'Cool in cold water.'];
const STEP_T = [9.375, 9.6875, 10.0];
const STEPS_C = [['Put eggs in a pot,', 'cover with water.'], ['Boil 9–12 minutes.'], ['Cool in cold water.']];
const BAD = ['Eggs are tasty. You can', 'boil them, or fry them.', 'It depends, really…'];

// page layouts
const PN = { x: 560, y: 190, w: 1200, h: 650 };                        // A: raw chat panel
const PB = { x: 890, y: 215, w: 920, h: 600 };                         // B: fine-tuned answer panel
const CA = { x: 480, y: 310, w: 500, h: 400 }, CB = { x: 1010, y: 310, w: 500, h: 400 };   // C: candidate answers
const RB = { x: 1670, y: 310, h: 400 };                                // C: reward bar
const POSE = { A: [290, 520, 115], B: [610, 520, 115], C: [290, 520, 105], D: [960, 370, 190] };   // model x, y, radius per page
const WRITER = { px: 240, py: 300, cx: 240, cy: 560 };                 // B: the person and the card being written
const T_PICK = 15.625;                                                 // beat 25: the rater clicks B
const T_DOC = 7.7;                                                     // first example card leaves the pile

const DUST = Array.from({ length: 70 }, () => ({ x: R() * W, y: R() * H, z: .3 + R() * .7, p: R() * TAU, s: .4 + R() * .8 }));
const ML = [3, 4, 4, 3];
const MN = [], MLINK = [];
ML.forEach((n, li) => { for (let i = 0; i < n; i++) MN.push({ li, x: (li - 1.5) * .62, y: (i - (n - 1) / 2) * (1.7 / (n - 1)) + (R() - .5) * .05, p: R() * TAU }); });
MN.forEach((a, i) => { const nx = MN.map((b, j) => [b, j]).filter(([b]) => b.li === a.li + 1).sort((p, q) => Math.abs(p[0].y - a.y) - Math.abs(q[0].y - a.y)); nx.forEach(([b, j]) => { MLINK.push([i, j, R()]); }); });
const DOCS = Array.from({ length: 6 }, (_, i) => ({ t0: T_DOC + i * .2, dur: .7, cx: 400 + 50 * R(), cy: 380 + 60 * R(), rot: (R() - .5) * .3 }));
const LANES = [{ y: 400, sp: 62, off: 0 }, { y: 530, sp: 78, off: 190 }, { y: 660, sp: 54, off: 90 }];   // C: many comparisons
const LSPAN = 960, LGAP = 320, LX0 = 1340;

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
function pillC(label, cx, y, col, a = 1) {                              // centred tag
  const w = measure(label, 24, F_UI, 600) + 48;
  ctx.save(); ctx.globalAlpha = a; rrect(cx - w / 2, y - 22, w, 44, 22); ctx.fillStyle = rgba(col, .14); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = rgba(col, .85); ctx.stroke(); ctx.restore();
  text(label, cx, y + 1, { font: F_UI, weight: 600, size: 24, color: col, alpha: a });
}
function person(x, y, s, a, col = '255,222,176') {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowDot(x, y + 20 * s, 130 * s, `rgba(${col},A)`, a * .16); ctx.restore();
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha = a;
  ctx.beginPath(); ctx.moveTo(-72, 82); ctx.bezierCurveTo(-72, 22, -42, 12, 0, 12); ctx.bezierCurveTo(42, 12, 72, 22, 72, 82); ctx.closePath();
  ctx.moveTo(32, -32); ctx.arc(0, -32, 32, 0, TAU);
  ctx.fillStyle = `rgba(${col},.15)`; ctx.fill(); ctx.lineWidth = 3 / Math.max(.5, s * .9); ctx.strokeStyle = `rgba(${col},.92)`; ctx.stroke(); ctx.restore();
}
// a handwritten example card: header line + text lines; wr = how much is written (0..1); nl = number of lines
function docCard(cx, cy, w, h, a, rot = 0, wr = 1, glowA = .4, nl = 0, solid = 0) {
  if (glowA > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowDot(cx, cy, Math.max(w, h) * .75, 'rgba(255,200,120,A)', a * glowA * .3); ctx.restore(); }
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.globalAlpha = a;
  ctx.beginPath(); ctx.moveTo(-w / 2 + 10, -h / 2); ctx.lineTo(w / 2 - 26, -h / 2); ctx.lineTo(w / 2, -h / 2 + 26); ctx.lineTo(w / 2, h / 2 - 10);
  ctx.quadraticCurveTo(w / 2, h / 2, w / 2 - 10, h / 2); ctx.lineTo(-w / 2 + 10, h / 2); ctx.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - 10); ctx.lineTo(-w / 2, -h / 2 + 10);
  ctx.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + 10, -h / 2); ctx.closePath();
  if (solid) { ctx.fillStyle = 'rgba(24,19,16,.96)'; ctx.fill(); }
  ctx.fillStyle = 'rgba(255,238,210,.13)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,214,150,.8)'; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w / 2 - 26, -h / 2); ctx.lineTo(w / 2 - 26, -h / 2 + 26); ctx.lineTo(w / 2, -h / 2 + 26); ctx.strokeStyle = 'rgba(255,214,150,.55)'; ctx.stroke();
  const n = nl || Math.max(3, Math.round(h / 34)), lw0 = w * .66;
  for (let i = 0; i < n; i++) {
    const f = clamp(wr * (n + 1) - i), y = -h / 2 + h * .2 + i * (h * .64 / (n - 1)), ww = lw0 * (i === 0 ? .55 : i % 3 === 2 ? .7 : 1);
    ctx.strokeStyle = i === 0 ? 'rgba(255,214,150,.95)' : 'rgba(255,236,205,.55)'; ctx.lineWidth = i === 0 ? 4 : 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-w * .33, y); ctx.lineTo(-w * .33 + ww * f, y); ctx.stroke();
  }
  ctx.restore();
}
function pencil(x, y, a, s = 1) {                                       // tip at (x, y), leaning up and to the right
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
const LINE_Y = 866;
const LOOP = roundedPoly([[RB.x, RB.y + RB.h + 24], [RB.x, LINE_Y], [POSE.C[0], LINE_Y], [POSE.C[0], POSE.C[1] + POSE.C[2] * 1.05 * .89 + 20]], 46);
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
function bubble(label, rightX, y, a, full = label) {                                   // the user's prompt, right-aligned at rightX
  if (!label) return;
  const w = measure(full, 36, F_UI, 600) + 56;
  ctx.save(); ctx.globalAlpha = a; rrect(rightX - w, y - 36, w, 72, 32); ctx.fillStyle = 'rgba(95,227,255,.13)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(95,227,255,.75)'; ctx.stroke(); ctx.restore();
  text(label, rightX - w + 28, y + 2, { font: F_UI, weight: 600, size: 36, color: '#eaf6ff', alpha: a, align: 'left' });
}
function thread(x0, y0, x1, y1, a, lt, ph = 0) {                         // faint light thread with a few travelling dots
  if (a <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  ctx.globalAlpha = a * .5; ctx.strokeStyle = 'rgba(255,214,160,.8)'; ctx.lineWidth = 2; ctx.setLineDash([3, 9]); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.setLineDash([]);
  for (let q = 0; q < 2; q++) { const f = (lt * .5 + ph + q * .5) % 1; glowDot(lerp(x0, x1, f), lerp(y0, y1, f), 14, 'rgba(255,214,160,A)', a * Math.sin(PI * f) * .9); }
  ctx.restore();
}

// ---------------------------------------------------------------- page A: the raw model rambles
function rawContent(lt, a) {
  for (let i = 0; i < RAW.length; i++) {
    const n = RAW[i].length, s = typed(RAW[i], kk(lt, RAW_T[i], RAW_T[i] + RAW_D) * n);
    if (!s) continue;
    text(s, PN.x + 50, 400 + i * 76, { font: F_MONO, size: 40, color: '#c9d4ec', alpha: a, align: 'left' });
  }
  const last = RAW.length - 1;                                           // caret only once the last line is complete (a moving caret would smear)
  if (lt >= RAW_T[last] + RAW_D) caret(PN.x + 50 + measure(RAW[last], 40, F_MONO) + 10, 400 + last * 76, 44, lt, '#c9d4ec', a);
}
// ---------------------------------------------------------------- page B: the person and the card being written
function writerPage(lt, a) {
  const { px, py, cx, cy } = WRITER, cw = 210, ch = 260, nl = 5;
  person(px, py, 1.0, a);
  docCard(cx + 22, cy - 14, cw, ch, a * .6, .06, 1, 0, nl, 1); docCard(cx + 10, cy - 7, cw, ch, a * .8, -.04, 1, 0, nl, 1);          // the pile of finished examples
  const wr = kk(lt, 7.1, 8.5);
  docCard(cx, cy, cw, ch, a, 0, wr, .35, nl, 1);
  if (wr < 1 || true) {                                                  // pencil and arm follow the writing; they settle once the card is done
    const u = wr * (nl + 1), li = clamp(Math.floor(u), 0, nl - 1), fr = clamp(u - li), lw0 = cw * .66, ww = lw0 * (li === 0 ? .55 : li % 3 === 2 ? .7 : 1);
    const tx = cx - cw * .33 + ww * fr, ty = cy - ch / 2 + ch * .2 + li * (ch * .64 / (nl - 1));
    const rest = sstep(8.5, 8.9, lt), tipx = lerp(tx, cx + 40, rest), tipy = lerp(ty, cy + ch / 2 - 40, rest), ha = a * (1 - sstep(8.9, 9.3, lt));
    if (ha > 0) {
      const hx = tipx + 30, hy = tipy - 32, sx = px + 50, sy = py + 44;
      ctx.save(); ctx.globalAlpha = ha; ctx.strokeStyle = 'rgba(255,222,176,.55)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + 90, (sy + hy) / 2 + 20, hx, hy); ctx.stroke(); ctx.restore();
      pencil(tipx, tipy, ha, 1);
      ctx.save(); ctx.globalAlpha = ha * .8; ctx.beginPath(); ctx.ellipse(hx, hy, 14, 18, .6, 0, TAU); ctx.fillStyle = 'rgba(255,222,176,.14)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,222,176,.65)'; ctx.stroke(); ctx.restore();
    }
  }
}
function answerPage(lt, a) {                                             // the fine-tuned answer in its panel
  glassCard(PB, { fill: 'rgba(30,24,22,.78)', stroke: 'rgba(255,215,150,.55)', glow: 'rgba(255,190,110,.1)' }, a);
  bubble(PROMPT, PB.x + PB.w - 36, PB.y + 72, a);
  const ys = [480, 618, 738], icons = [iconPot, iconClock, iconDrop];
  ctx.save(); ctx.globalAlpha = a * .5; ctx.strokeStyle = 'rgba(255,220,170,.22)'; ctx.lineWidth = 1.5; ctx.beginPath();
  for (const y of [552, 678]) { ctx.moveTo(PB.x + 40, y); ctx.lineTo(PB.x + PB.w - 40, y); } ctx.stroke(); ctx.restore();
  STEPS.forEach((s, i) => {
    const k = kk(lt, STEP_T[i], STEP_T[i] + .3), e = eout(k), x = PB.x + 140 - 14 * (1 - e), lines = s.split('\n');
    ctx.save(); ctx.globalAlpha = a * k; ctx.beginPath(); ctx.arc(PB.x + 76, ys[i], 36, 0, TAU); ctx.fillStyle = 'rgba(255,222,176,.2)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = AMB; ctx.stroke(); ctx.restore();
    text(String(i + 1), PB.x + 76, ys[i] + 2, { font: F_UI, weight: 700, size: 40, color: AMB, alpha: a * k });
    lines.forEach((l, j) => text(l, x, ys[i] + (j - (lines.length - 1) / 2) * 48, { font: F_UI, weight: 500, size: 40, color: '#fff6e6', alpha: a * k, align: 'left' }));
    icons[i](PB.x + PB.w - 90, ys[i], 1.1, a * k * .95);
  });
}
// ---------------------------------------------------------------- page C: candidate answers, picks, many comparisons
function candB(r, a) {
  letterDot(r.x + 46, r.y + 46, 28, 'B', PAL.mint, a);
  text('回答 B · answer B', r.x + 90, r.y + 47, { font: F_UI, weight: 600, size: 24, color: '#bfeedb', alpha: a, align: 'left' });
  let y = r.y + 120;
  STEPS_C.forEach((ls, i) => {
    ctx.save(); ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(r.x + 46, y, 20, 0, TAU); ctx.strokeStyle = AMB; ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore();
    text(String(i + 1), r.x + 46, y + 1, { font: F_UI, weight: 700, size: 26, color: AMB, alpha: a });
    ls.forEach((l, j) => text(l, r.x + 84, y + j * 40, { font: F_UI, weight: 500, size: 32, color: '#fff6e6', alpha: a, align: 'left' }));
    y += ls.length > 1 ? 104 : 80;
  });
}
function candA(r, a) {
  letterDot(r.x + 46, r.y + 46, 28, 'A', '#aab6d4', a);
  text('回答 A · answer A', r.x + 90, r.y + 47, { font: F_UI, weight: 600, size: 24, color: '#b9c4de', alpha: a, align: 'left' });
  BAD.forEach((l, i) => text(l, r.x + 36, r.y + 130 + i * 56, { font: F_UI, weight: 400, size: 32, color: '#b4bfd9', alpha: a, align: 'left' }));
}
function scoreBar(r, a, v, col) {                                       // small reward score under a candidate (filled once the human has chosen)
  const x0 = r.x + 150, w = r.w - 150 - 36, y = r.y + r.h - 40;
  text('得分 score', r.x + 36, y, { font: F_UI, weight: 600, size: 24, color: '#cdd8ee', alpha: a, align: 'left' });
  ctx.save(); ctx.globalAlpha = a; rrect(x0 + 20, y - 8, w - 20, 16, 8); ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(180,215,255,.4)'; ctx.stroke();
  if (v > .01) { rrect(x0 + 20, y - 8, Math.max(16, (w - 20) * v), 16, 8); ctx.fillStyle = col; ctx.fill(); }
  ctx.restore();
}
function miniPair(x, y, ok, a) {                                        // a tiny A/B comparison: the preferred one outlined mint with a check
  if (a <= 0) return;
  const w = 108, h = 76, g = 20;
  for (let k = 0; k < 2; k++) {
    const bx = x + k * (w + g), win = k === ok, col = win ? PAL.mint : PAL.coral;
    ctx.save(); ctx.globalAlpha = a * (win ? 1 : .6); rrect(bx, y - h / 2, w, h, 12); ctx.fillStyle = rgba(col, win ? .12 : .07); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = rgba(col, win ? .95 : .8); ctx.stroke();
    ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(235,242,255,.5)'; ctx.beginPath(); ctx.moveTo(bx + 16, y - 10); ctx.lineTo(bx + w - 34, y - 10); ctx.moveTo(bx + 16, y + 12); ctx.lineTo(bx + w * .62, y + 12); ctx.stroke(); ctx.restore();
    (win ? checkMark : crossMark)(bx + w - 20, y - h / 2 + 22, 24, col, a * (win ? 1 : .7), 4);
  }
}

scene({
  id: 'teach', start: 46, len: 10, fi: .3, fo: .3, mb: 2, bloom: .75,
  ch: ['07', '微调', 'FINE-TUNING'],
  subs: [
    [0.4, 6.6, '但刚练完的模型只会“续写”，还不懂怎样回答问题', 'But a freshly pretrained model only continues text; it has not learned how to answer'],
    [6.9, 13.7, '于是人类写下大量范例：一个好回答该是什么样', 'So people write many examples of what a good answer looks like, and the model learns from them'],
    [14.0, 21.0, '再让人比较它的几个回答：更受欢迎的得高分，模型朝高分调整', 'Then people compare its answers: preferred ones score higher, and the model is tuned toward them'],
    [21.3, 24.8, '于是它更有用、更诚实、更无害', 'and it becomes more helpful, honest and harmless'],
  ],
  sfx: [
    // A: the prompt is typed, the raw model rambles on
    [.15, 'pop'], [.5, 'type'], [.6, 'type'], [.7, 'type'], [.8, 'type'], [.9, 'type'], [1.0, 'type'], [1.1, 'type'],
    [1.3, 'tick', { hi: true }], [1.75, 'tick', { hi: true }], [2.2, 'tick', { hi: true }], [2.65, 'tick', { hi: true }], [3.1, 'tick', { hi: true }],
    [1.4, 'type'], [1.55, 'type'], [1.85, 'type'], [2.0, 'type'], [2.3, 'type'], [2.45, 'type'], [2.75, 'type'], [2.9, 'type'], [3.2, 'type'], [3.35, 'type'],
    [1.9, 'pop'], [3.7, 'blip', { midi: 62 }],
    [6.4, 'whoosh', { dur: .6 }],
    // B: people write examples, they flow into the model, the answer becomes clean
    [7.05, 'pop'], [7.3, 'type'], [7.5, 'type'], [7.7, 'type'], [7.9, 'type'], [8.1, 'type'], [8.3, 'type'],
    [8.4, 'chip', { midi: 72 }], [8.6, 'chip', { midi: 74 }], [8.8, 'chip', { midi: 76 }], [9.0, 'chip', { midi: 77 }], [9.2, 'chip', { midi: 79 }], [9.4, 'chip', { midi: 81 }],
    [8.6, 'swell', { dur: .55 }], [8.75, 'pop'],
    [9.375, 'chip', { midi: 72 }], [9.6875, 'chip', { midi: 76 }], [10.0, 'swish'], [10.0, 'chime', { midi: 84 }], [10.0, 'pop'],
    [13.5, 'whoosh', { dur: .6 }],
    // C: two answers, a person picks, the reward rises, the model is updated; then many comparisons
    [14.15, 'pop'], [14.375, 'pop'], [14.7, 'pop'], [14.95, 'swish', { pitch: .8 }],
    [15.5, 'tick'], [T_PICK, 'up'], [T_PICK, 'count', { dur: .6 }], [15.8, 'down'],
    [15.9, 'whoosh', { dur: .9 }], [17.2, 'chime', { midi: 79 }],
    [17.9, 'swish'], [18.125, 'swell', { dur: 1.2 }],
    [18.5, 'tick', { hi: true }], [18.875, 'tick'], [19.25, 'tick', { hi: true }], [19.625, 'tick'], [20.0, 'tick', { hi: true }],
    [20.3, 'whoosh', { dur: .9 }],
    // D: the result
    [20.7, 'swell', { dur: .55 }], [21.25, 'ding', { midi: 79 }], [21.875, 'ding', { midi: 84 }], [22.5, 'ding', { midi: 88 }], [22.5, 'sparkle', { dur: .8 }],
  ],
  cam: camPush(.03),
  draw(lt) {
    // ---- backdrop: cold and flat at first, warms while the human examples take effect (amber with a teal counter-glow)
    const kW = sstep(8.0, 9.6, lt), tint = COLD.map((c, i) => lerp(c, WARM[i], kW));
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

    // ---- the persistent model: glides A -> B -> C -> D
    const g1 = sstep(6.5, 7.5, lt), g2 = sstep(13.7, 14.7, lt), g3 = sstep(20.45, 21.25, lt);
    let mp = POSE.A.slice();
    for (const [g, P] of [[g1, POSE.B], [g2, POSE.C], [g3, POSE.D]]) mp = mp.map((v, i) => lerp(v, P[i], g));
    const [mx, my, mr] = mp;

    // ================================================================ page A: the raw model only continues text
    const gA = win(lt, .1, 6.85, .5, .4);
    if (gA > 0) {
      const pIn = eout(kk(lt, .1, .6));
      thread(POSE.A[0] + POSE.A[2] * 1.05 * .95, POSE.A[1], PN.x - 6, POSE.A[1], gA * .55 * sstep(1.2, 1.8, lt), lt);
      ctx.save(); ctx.translate(0, (1 - pIn) * 14);
      glassCard(PN, { fill: 'rgba(16,22,38,.78)', stroke: 'rgba(140,160,200,.28)', glow: 'rgba(90,110,160,.12)' }, gA);
      bubble(typed(PROMPT, kk(lt, .5, 1.2) * PROMPT.length), PN.x + PN.w - 40, PN.y + 72, gA * sstep(.45, .55, lt), PROMPT);
      rawContent(lt, gA);
      text('它只是在接着往下“续写” · it just keeps continuing the text', PN.x + PN.w / 2, PN.y + PN.h - 62, { font: F_UI, weight: 500, size: 28, color: '#9fb3d6', alpha: gA * sstep(3.7, 4.2, lt) });
      ctx.restore();
      const la = gA * sstep(.5, .9, lt);
      text('模型 · model', mx, my + mr * 1.05 * .95 + 52, { font: F_UI, weight: 600, size: 30, color: '#cfe7ff', alpha: la });
      pillC('预训练模型 · pretrained', mx, my + mr * 1.05 * .95 + 112, '#aab6d4', la * sstep(1.7, 2.1, lt));
    }

    // ================================================================ page B: human-written examples
    const gB = win(lt, 6.95, 13.95, .45, .4);
    let landed = 0;
    if (gB > 0) {
      const wa = gB;
      writerPage(lt, wa);
      text('人类写的范例', WRITER.cx, 735, { font: F_UI, weight: 600, size: 30, color: '#ffe3b8', alpha: wa * sstep(7.2, 7.6, lt) });
      text('human-written examples', WRITER.cx + 10, 774, { font: F_UI, weight: 400, size: 24, color: '#e0cfae', alpha: wa * sstep(7.2, 7.6, lt) });
      // finished cards leave the pile, travel to the model and light it
      const [bx, by] = POSE.B;
      for (const c of DOCS) {
        const k = kk(lt, c.t0, c.t0 + c.dur), tl = lt - c.t0 - c.dur;
        if (tl > 0) landed += Math.exp(-tl * 4) * .5;
        if (k <= 0 || k >= 1) continue;
        for (let g = 1; g >= 0; g--) {
          const e2 = eio(clamp(k - g * .07)), u2 = 1 - e2, sc = lerp(.8, .3, e2);
          const x = u2 * u2 * (WRITER.cx + 20) + 2 * u2 * e2 * c.cx + e2 * e2 * (bx - 40), y = u2 * u2 * WRITER.cy + 2 * u2 * e2 * c.cy + e2 * e2 * by;
          docCard(x, y, 210 * sc, 260 * sc, wa * (g ? .14 : 1) * (1 - sstep(.82, 1, k)), c.rot * e2, 1, g ? 0 : .3, 5);
        }
      }
      // the answer panel
      const pa = win(lt, 8.7, 13.95, .45, .4);
      if (pa > 0) {
        const [mx2, my2, mr2] = POSE.B;
        thread(mx2 + mr2 * 1.05 * .95, my2, PB.x - 6, my2, pa * .6, lt, .2);
        ctx.save(); ctx.translate(0, (1 - eout(kk(lt, 8.7, 9.2))) * 18);
        answerPage(lt, pa); ctx.restore();
        const ta = pa * sstep(10.0, 10.3, lt);
        pillC('微调后 · fine-tuned', mx2, my2 + mr2 * 1.05 * .95 + 112, PAL.mint, ta);
      }
      const lb = gB * sstep(7.8, 8.2, lt);
      text('模型 · model', POSE.B[0], POSE.B[1] + POSE.B[2] * 1.05 * .95 + 52, { font: F_UI, weight: 600, size: 30, color: '#e2f0ff', alpha: lb });
    }

    // ================================================================ page C: human preference
    const pick = sstep(T_PICK - .05, T_PICK + .2, lt), ek = eout(kk(lt, 14.375, 14.85)), slide = (1 - ek) * 34;
    const qa = win(lt, 14.15, 18.0, .35, .35);                             // prompt + question
    const cardsOut = 1 - sstep(17.95, 18.3, lt), cardsText = 1 - sstep(17.65, 18.0, lt);
    const cV = sstep(14.375, 14.7, lt) * cardsOut;
    if (qa > 0) {
      const bxc = (CA.x + CB.x + CB.w) / 2;
      ctx.save(); ctx.translate(0, slide); bubble(PROMPT, bxc + (measure(PROMPT, 36, F_UI, 600) + 56) / 2, 200, qa); ctx.restore();
      text('哪个回答更好？ · which answer is better?', bxc, 262 + slide, { font: F_UI, weight: 600, size: 32, color: '#ffe3b8', alpha: qa * sstep(14.4, 14.7, lt) });
    }
    if (cV > 0) {
      ctx.save(); ctx.translate(0, slide);
      const aV = cV * (1 - .35 * pick), pOn = lt > T_PICK - .05, txt = cardsText;
      const shrink = 1 - .16 * sstep(17.95, 18.3, lt);
      for (const [r, isB] of [[CA, false], [CB, true]]) {
        ctx.save(); const cx0 = r.x + r.w / 2, cy0 = r.y + r.h / 2; ctx.translate(cx0, cy0); ctx.scale(shrink, shrink); ctx.translate(-cx0, -cy0);
        if (isB) glassCard(r, { fill: 'rgba(30,24,22,.92)', stroke: pOn ? rgba(PAL.mint, .5 + .4 * pick) : 'rgba(255,215,150,.55)', glow: pOn ? 'rgba(94,242,176,.16)' : 'rgba(255,190,110,.1)' }, cV);
        else glassCard(r, { fill: 'rgba(18,22,36,.92)', stroke: pOn ? rgba(PAL.coral, .5) : 'rgba(150,170,210,.4)' }, aV);
        ctx.restore();
        if (isB) candB(r, cV * txt); else candA(r, aV * txt);
      }
      const sk = eio(kk(lt, T_PICK, T_PICK + .6));                          // each answer gets a score: A low, B high
      scoreBar(CA, aV * txt, .2 * sk, PAL.coral); scoreBar(CB, cV * txt, .9 * sk, PAL.mint);
      if (pOn) { badge(CA.x + CA.w - 46, CA.y + 46, 28, PAL.coral, aV * txt * kk(lt, T_PICK, T_PICK + .25) * .95, 'x'); badge(CB.x + CB.w - 46, CB.y + 46, 30, PAL.mint, cV * txt * kk(lt, T_PICK - .05, T_PICK + .15), 'ok'); }
      ctx.restore();
      // the model feeds both answers: faint threads that run behind the cards
      const tA = cV * (1 - sstep(T_PICK - .1, T_PICK + .1, lt));
      if (tA > 0) { thread(mx + mr * 1.05 * .95, my - 40, CA.x + 2, 470 + slide, tA * .8, lt, 0); thread(mx + mr * 1.05 * .95, my - 10, CB.x + 2, 520 + slide, 0, lt, .5); }
    }
    // reward meter (stays through the repetition)
    const rwA = win(lt, 14.75, 20.9, .4, .5) * (1 - sstep(20.3, 20.8, lt) * 0);
    if (rwA > 0) {
      const v = lerp(.1, .88, eio(kk(lt, T_PICK, T_PICK + 1.1))) + .02 * Math.sin(lt * 1.6) * sstep(18, 19, lt), by0 = RB.y, bh2 = RB.h;
      ctx.save(); ctx.globalAlpha = rwA; rrect(RB.x - 24, by0, 48, bh2, 24); ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(180,215,255,.5)'; ctx.stroke();
      ctx.save(); rrect(RB.x - 24, by0, 48, bh2, 24); ctx.clip();
      const g = ctx.createLinearGradient(0, by0 + bh2, 0, by0); g.addColorStop(0, '#2fb88a'); g.addColorStop(.6, PAL.mint); g.addColorStop(1, AMB);
      ctx.fillStyle = g; ctx.fillRect(RB.x - 24, by0 + bh2 * (1 - v), 48, bh2 * v); ctx.restore(); ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowDot(RB.x, by0 + bh2 * (1 - v), 40, 'rgba(255,205,130,A)', rwA * (.08 + .1 * kk(lt, T_PICK, T_PICK + .4))); ctx.restore();
      text('奖励 · reward', RB.x, 262, { font: F_UI, weight: 600, size: 30, color: '#f0fbf0', alpha: rwA });
    }
    // the human rater (a small person) and the pointer that clicks answer B
    const hP = win(lt, 14.6, 18.0, .4, .35);
    if (hP > 0) {
      person(990, 790, .55, hP);
      text('人类评审', 1050, 774, { font: F_UI, weight: 600, size: 28, color: '#ffe3b8', alpha: hP, align: 'left' });
      text('human rater', 1050, 808, { font: F_UI, weight: 400, size: 24, color: '#e0cfae', alpha: hP, align: 'left' });
    }
    const hA = sstep(14.8, 15.1, lt) * (1 - sstep(16.5, 16.85, lt));
    if (hA > 0) {
      const tb = eio(kk(lt, 14.95, 15.55)), u = 1 - tb, hx = u * u * 1010 + 2 * u * tb * 1150 + tb * tb * 1440, hy = u * u * 770 + 2 * u * tb * 690 + tb * tb * 565;
      const press = Math.sin(PI * kk(lt, 15.45, T_PICK + .12));
      cursor(hx, hy, 1.15, hA, press);
      if (lt > T_PICK - .05 && lt < 16.4) { const k = kk(lt, T_PICK - .05, 16.4); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1 - k) * hA; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,225,170,.9)'; ctx.beginPath(); ctx.arc(1440, 565, 12 + 46 * eout(k), 0, TAU); ctx.stroke(); ctx.restore(); }
    }
    // many comparisons: tiny A/B pairs drift towards the model
    const c2 = sstep(18.2, 18.6, lt) * (1 - sstep(20.15, 20.55, lt));
    if (c2 > 0) {
      text('成千上万次比较 · thousands upon thousands of comparisons', 990, 262, { font: F_UI, weight: 600, size: 32, color: '#ffe3b8', alpha: c2 });
      LANES.forEach((ln, li) => {
        for (let q = 0; q < 3; q++) {
          const s0 = (lt - 18.2) * ln.sp + ln.off + q * LGAP, n = Math.floor(s0 / LSPAN), x = LX0 - (((s0 % LSPAN) + LSPAN) % LSPAN);
          const ok = hash1(li * 17 + q * 5 + n * 3.1 + 1) < .5 ? 1 : 0, edge = sstep(LX0, LX0 - 100, x) * sstep(440, 540, x);
          miniPair(x, ln.y, ok, c2 * edge);
        }
      });
    }
    // the update loop: from the reward back into the model; later it keeps pulsing
    const lp = eio(kk(lt, 15.9, 17.2)), la = 1 - sstep(20.3, 20.8, lt);
    if (lp > 0 && la > 0) {
      const [hx, hy, ang, hi] = loopAt(lp);
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(LOOP[0][0], LOOP[0][1]); for (let i = 1; i < hi; i++) ctx.lineTo(LOOP[i][0], LOOP[i][1]); ctx.lineTo(hx, hy);
      ctx.globalAlpha = la * .16; ctx.lineWidth = 14; ctx.strokeStyle = 'rgba(255,190,110,1)'; ctx.stroke();
      ctx.globalAlpha = la; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,224,170,.9)'; ctx.stroke(); ctx.restore();
      ctx.save(); ctx.globalAlpha = la * (1 - sstep(17.2, 17.3, lt)); ctx.translate(hx, hy); ctx.rotate(ang); ctx.fillStyle = '#ffe9c4';
      ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-11, -12); ctx.lineTo(-11, 12); ctx.closePath(); ctx.fill(); ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      if (lp < 1) for (let q = 0; q < 3; q++) { const f = (lp * .94 - q * .06); if (f > 0) { const [x, y] = loopAt(f); glowDot(x, y, 10, 'rgba(255,215,150,A)', la * (.8 - q * .22)); } }
      else for (let q = 0; q < 3; q++) { const f = ((lt - 17.2) * .22 + q / 3) % 1, [x, y] = loopAt(f); glowDot(x, y, 12, 'rgba(255,215,150,A)', la * .7 * Math.sin(PI * f)); }
      ctx.restore();
      const ua = sstep(16.6, 16.9, lt) * la; if (ua > 0) text('更新 · update', 680, LINE_Y - 36, { font: F_UI, weight: 700, size: 30, color: '#fff0d4', alpha: ua });
    }

    // ================================================================ the model (always) + page D
    const D = sstep(20.45, 21.25, lt);
    const lbB = 0;                                                         // labels travel with page A / B only (see above)
    let dp = 0; for (const t0 of [21.25, 21.875, 22.5]) if (lt > t0) dp += Math.exp(-(lt - t0) * 4.5);
    const warm = sstep(8.3, 9.7, lt), pulse = Math.max(clamp(landed, 0, 1.4), .9 * Math.min(1, dp), .35 * sstep(16.9, 17.2, lt) * (1 - sstep(17.4, 18.0, lt)), .2 * c2 * (.5 + .5 * Math.sin(lt * 3.1)));
    if (D > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowDot(mx, my, mr * 3.2, 'rgba(255,200,130,A)', .16 * D * (1 + .1 * Math.sin(lt * 2))); ctx.restore(); }
    model(mx, my, mr, lt, sstep(0, .5, lt), warm, pulse);

    // ---- page D: three values as glowing chips under the model (empty slots are outlined first, so the set of three reads at once)
    const items = [['helpful', '有用', PAL.cyan, 21.25], ['honest', '诚实', PAL.mint, 21.875], ['harmless', '无害', PAL.violet, 22.5]];
    const cw = 410, chH = 136, gap = 66, x0 = W / 2 - (cw * 3 + gap * 2) / 2, cy = 735, slotA = sstep(20.95, 21.2, lt);
    const thr = (cx, tTop) => { ctx.beginPath(); ctx.moveTo(960, 370 + 190 * .95); ctx.bezierCurveTo(960, 610, cx, 600, cx, tTop); };
    if (D > 0) items.forEach(([en, zh, col, t0], i) => {
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
      text(zh, cx, cy - 18 * sc, { font: F_UI, weight: 700, size: Math.max(32, 48 * sc), color: '#eef3ff', alpha: a });
      text(en, cx, cy + 34 * sc, { font: F_UI, weight: 600, size: Math.max(28, 34 * sc), color: rgba(col, 1), alpha: a });
    });
  },
});
