// s1_tokens (2:50 cut): text -> tokens -> IDs; the vocabulary; sub-word pieces.  Global 10..25 s (start bar 4, len 6 = 15 s).
// Page A 0-8.5   : "The cat sat on the" is sliced into five chips (hold 2.4-4.6), the IDs roll in (4.8-6.6), hold 6.6-8.5.
// Page B 8.5-15  : the chips move to a top row; a wall of tiny token labels rises (the vocabulary); "unbelievable" splits into three pieces with IDs
//                  (hold 12-14.2); from 14.2 the ID 3797 glows and grows to the hand-off pose (hard cut into s2_vectors).
// HAND-OFF (last frame == first frame of s2_vectors, which must open with fi ~ 0 and cam z=1, x=y=0):
//   backdrop glDraw(0,{time:T*.9,tint:[.04,.17,.46],amp:.85}); '3797' at (960,470) F_MONO 210 px weight 700 #8fe4ff, glow cyan blur 34;
//   glowDot(960,470,420,'rgba(120,110,255,A)',.12) + glowDot(960,470,340,'rgba(80,200,255,A)',.16); 'cat' label at (960,620) F_UI 34 px 700 ls 6 #d9ccff, glow violet blur 12.
const R = mulberry(20260001);

// ---------------------------------------------------------------- constant tables
const TK = 64, IDSZ = 76, GAP = 36, SENT = 100;                         // chip text size, ID size, gap between chips, plain-text size
const A_CY = 400, A_IY = 575;                                           // page A: chips row / ID row
const B_CY = 205, B_IY = 330, SB_CY = 520, SB_IY = 665, SB_LAB = 428;   // page B: top row (chips / IDs), sub-word row (chips / IDs / label)
const B_S = (B_IY - B_CY) / (A_IY - A_CY);                              // scale of the top row on page B
const A_TOK = STORY.tokens.slice(), A_IDS = STORY.ids.map(String), A_COL = HUES.slice(0, 5);
const S_TOK = ['un', 'believ', 'able'], S_IDS = ['403', '6481', '540'], S_COL = [PAL.mint, PAL.pink, PAL.blue];
const CAT = 1, HAND0 = 14.2, HAND1 = 14.9;
// chip cue times (local s); a chip frame pops over .25 s from its cue, the word slides apart over the .7 / .55 s before it lands
const A_CUE = [.9375, 1.25, 1.5625, 1.875, 2.1875], A_SL = .6;
const S_CUE = [10.3125, 10.625, 10.9375], S_SL = .55;
const A_ID_T = [4.8, 5.0, 5.2, 5.4, 5.6];                                 // the ID line of chip i drops at A_ID_T[i], digits roll .2 s later (settled .55 s after that)
const S_ID_T = S_CUE.map(c => c + .25);

const MOTES = Array.from({ length: 60 }, () => ({ x: R() * W, y: R() * H, z: .3 + R() * .7, p: R() * TAU, r: 2 + 6 * R() }));
const mkBurst = () => Array.from({ length: 16 }, () => ({ a: R() * TAU, v: 60 + 160 * R(), l: .5 + .5 * R(), r: 1.5 + 2.5 * R() }));
const BURST = Array.from({ length: 5 }, mkBurst), BURSTS = Array.from({ length: 3 }, mkBurst), BURSTID = Array.from({ length: 5 }, mkBurst);

// ---------------------------------------------------------------- layout (needs the fonts, so it is built on the first draw and cached)
let _LY = null;
function mkRow(toks, gap, cy) {
  const adv = measure('M', 100, F_MONO, 500) / 100, plain = toks.join(''), n = plain.length;
  const ws = toks.map(s => s.length * adv * TK + TK), tot = ws.reduce((a, b) => a + b, 0) + gap * (toks.length - 1);
  let x = W / 2 - tot / 2, start = 0; const pl = W / 2 - n * adv * SENT / 2;
  return toks.map((s, i) => { const t = { s, w: ws[i], cx: x + ws[i] / 2, cy, px: pl + adv * SENT * (start + s.length / 2), start, len: s.length, adv, pl, n }; x += ws[i] + gap; start += s.length; return t; });
}
function LY() {
  if (_LY) return _LY;
  const o = { A: mkRow(A_TOK, GAP, A_CY), S: mkRow(S_TOK, 44, SB_CY) };
  if (typeof fontsReady !== 'undefined' && fontsReady) _LY = o;
  return o;
}

// the vocabulary wall: pre-rendered layers (dots, small labels, larger labels) that drift upward and tile vertically
const WORDS = ['the', ' of', 'ing', 'tion', '的', ' and', 'def', '{', ' to', 'ed', ' in', '了', 'er', ' is', 'ation', '</', ' that', '我', 'ly', 'return', ' for', 'un', ' with', ' on',
  'ity', '。', ' as', 'import', ' was', 'able', '(', ' it', 'ment', '是', ' by', 'ness', ' are', 'ous', ' be', '==', 'pre', ' at', 'AI', ' or', 'less', '不', ' from', ' an', 'self', ' this',
  'ize', '在', ' have', ', ', '->', ' not', 'ful', ' but', ' cat', ' dog', ' run', '模型', ' data', ' code', 'tok', 'en', '2024', 'é', ' der', ' la', ' que', ' und', ' sat', ' mat', ' house',
  ' water', ' light', '小', '大', '人', '中', '一', '**', '//', ' if', ' else', ' while', ' int', ' x', '!', '?', '…', 'pro', 're', 'dis', ' over', 'est', 'ies', 'ate', ' new', ' one', ' all', ' can',
  ' will', ' more', ' about', ' which', ' their', ' time', 'ion', 'al', 'ic', 'ist', 'ive', ' 的', ' 是', '. ', ' (', ');', '"', ' [', 'the', ' we', ' you', ' they'];
const SCRS = [{ x: 420, y: 120, w: 1080, h: 620 }, { x: 540, y: 765, w: 840, h: 150 }, { x: 360, y: 925, w: 1200, h: 200 }];   // content zones of page B (rows, vocabulary pill, subtitles) kept free of wall text
let _WALLS = null;
function WALLS() {
  if (_WALLS) return _WALLS;
  const r = mulberry(20260001 + 77), mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const dots = mk(), l1 = mk(), l2 = mk(), lit = [];
  { const x = dots.getContext('2d'); x.fillStyle = '#9fd0ff'; for (let i = 0; i < 3400; i++) { x.globalAlpha = .1 + .34 * r(); const s = r() < .8 ? 1.6 : 2.6; x.fillRect(r() * W, r() * H, s, s); } }
  const labels = (cv, size, rowH, gap, aLo, aHi, litP, sp, layer) => {
    const x = cv.getContext('2d'); x.font = `400 ${size}px ${F_MONO}`; x.textBaseline = 'middle'; x.textAlign = 'left'; x.fillStyle = '#b4dcff';
    const rows = Math.round(H / rowH), rh = H / rows;
    for (let k = 0; k < rows; k++) {
      let px = -r() * 140; const y = rh * (k + .5);
      while (px < W) {
        const s = WORDS[Math.floor(r() * WORDS.length)], sh = s.replace(/^ /, ''), w = x.measureText(sh).width + 22;
        if (px >= 0 && px + w < W && r() < litP) lit.push({ s: sh, x: px, y, w, sp, p: r() * TAU, size });
        else { x.globalAlpha = aLo + (aHi - aLo) * r(); x.fillText(sh, px + 11, y); }
        px += w + gap * (.6 + .9 * r());
      }
    }
  };
  labels(l1, 20, 40, 22, .12, .30, .010, 9);
  labels(l2, 26, 78, 70, .09, .20, .012, 15);
  // feathered dark panel that keeps the wall away from the content (built once; a blurred rounded rectangle)
  const scrim = mk(), sx = scrim.getContext('2d'); sx.filter = 'blur(55px)'; sx.fillStyle = '#02050e'; for (const z of SCRS) { sx.beginPath(); sx.roundRect(z.x, z.y, z.w, z.h, 60); sx.fill(); sx.fill(); }
  _WALLS = { dots, l1, l2, lit, scrim };
  return _WALLS;
}
const WALL_SP = { dots: 4, l1: 9, l2: 15 };

// ---------------------------------------------------------------- helpers
const eSine = t => .5 - .5 * Math.cos(PI * clamp(t));
function leadDot(x, y, r, col, a) {                    // the "leading space" mark: a bright dot
  ctx.save(); ctx.globalAlpha = a; ctx.shadowColor = col; ctx.shadowBlur = 12; ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = rgba(col, .9); ctx.beginPath(); ctx.arc(x, y, r * .62, 0, TAU); ctx.fill(); ctx.restore();
}
// A token that starts as part of the plain text and ends as a chip. e = slide progress (0..1), fk = chip-frame progress, a = overall alpha.
// The text is drawn ONCE (size 100 -> 64, position plain -> chip) and the chip frame grows around it, so words never overlap their own ghosts.
function morphTok(t, col, e, fk, a, hopA = 10) {
  const size = lerp(SENT, TK, e), x = lerp(t.px, t.cx, e), y = t.cy - Math.sin(e * PI) * hopA;
  if (fk > 0) {
    const pe = eback(fk), sc = .8 + .2 * pe, h = TK * 1.7;
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); ctx.globalAlpha = a * clamp(fk * 3);
    ctx.shadowColor = col; ctx.shadowBlur = 18 + 14 * (1 - fk);
    rrect(-t.w / 2, -h / 2, t.w, h, h * .28); ctx.fillStyle = rgba(col, .16); ctx.fill(); ctx.shadowBlur = 0;
    ctx.lineWidth = 2; ctx.strokeStyle = rgba(col, .9); ctx.stroke(); ctx.restore();
  }
  text(t.s, x, y + size * .04, { font: F_MONO, size, weight: 500, color: '#fff', alpha: a, glow: 'rgba(160,200,255,.35)', blur: 8 });
  if (t.s[0] === ' ' && fk > 0) leadDot(x - t.len * t.adv * size / 2 + t.adv * size / 2, y + size * .09, Math.max(4, size * .095), col, a * clamp(fk * 2));
}
// digits scramble at ~12 Hz (held for whole frames, so motion-blur sub-frames agree), then settle left to right (linear p); scrambled digits are dim
function idDraw(str, p, seed, lq, x, y, size, col, a, glowBlur = 22) {
  const cw = measure('0', size, F_MONO, 500), x0 = x - cw * str.length / 2 + cw / 2, step = Math.floor(lq * 12);
  [...str].forEach((c, j) => {
    const settled = p >= (j + 1) / (str.length + .4), px = x0 + j * cw;
    if (settled) text(c, px, y, { font: F_MONO, size, weight: 500, color: '#fff', alpha: a, glow: col, blur: glowBlur });
    else text(String(Math.floor(hash1(step * 3.1 + j * 7.7 + seed * 13.3) * 10)), px, y, { font: F_MONO, size, weight: 400, color: rgba(col, 1), alpha: a * .42, glow: col, blur: 8 });
  });
}
function burst(parts, x, y, t, col) {
  if (t <= 0 || t > 1.2) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = col;
  for (const p of parts) { const k = t / p.l; if (k >= 1) continue; const d = p.v * eout(k) * .9; ctx.globalAlpha = (1 - k) * .9; const r = p.r * (1 - k * .6); ctx.fillRect(x + Math.cos(p.a) * d - r / 2, y + Math.sin(p.a) * d - r / 2, r, r); }
  ctx.restore();
}
// gold slice lines at the cut points of a plain text row
function slices(row, t0, tgrow, tFade0, tFade1, lt, hh = 78, ticks = false) {
  const g = sstep(t0, t0 + tgrow, lt) * (1 - sstep(tFade0, tFade1, lt)); if (g <= 0) return;
  ctx.save(); ctx.strokeStyle = PAL.gold; ctx.lineWidth = 2.5; ctx.shadowColor = PAL.gold; ctx.shadowBlur = 12; ctx.globalAlpha = .95 * g;
  const step = 100 * row[0].adv;
  for (let i = 1; i < row.length; i++) {
    const x = row[i].pl + row[i].start * step - (row[i].s[0] === ' ' ? -step / 2 : 0), y = row[i].cy, h = hh * eout(clamp((lt - t0) / tgrow));
    ctx.beginPath();
    if (ticks) { const k = eout(clamp((lt - t0) / tgrow)); ctx.moveTo(x, y - 64 - 26 * k); ctx.lineTo(x, y - 64); ctx.moveTo(x, y + 64); ctx.lineTo(x, y + 64 + 26 * k); }
    else { ctx.moveTo(x, y - h); ctx.lineTo(x, y + h); }
    ctx.stroke();
  }
  ctx.restore();
}
function drawWall(lt, a, rise, dotsOnly) {
  const w = WALLS(), off = k => ((lt * WALL_SP[k]) % H + H) % H;
  ctx.save(); ctx.translate(0, (1 - eout(rise)) * 70);
  const layer = (c, k, al) => { if (al <= .005) return; ctx.globalAlpha = al; const o = off(k); ctx.drawImage(c, 0, -o); ctx.drawImage(c, 0, H - o); };
  layer(w.dots, 'dots', a * (.16 + .84 * rise));
  if (!dotsOnly && rise > 0) {
    layer(w.l1, 'l1', a * rise); layer(w.l2, 'l2', a * rise);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    for (const c of w.lit) {                                   // a few labels are lit: slow pulse, outlined like tiny chips
      const y = (((c.y - lt * c.sp) % H) + H) % H, pu = .55 + .45 * Math.sin(lt * 1.6 + c.p);
      let zone = 0; for (const z of SCRS) zone = Math.max(zone, sstep(z.x - 60, z.x + 40, c.x + c.w) * (1 - sstep(z.x + z.w - 40, z.x + z.w + 60, c.x)) * sstep(z.y - 50, z.y + 30, y + 20) * (1 - sstep(z.y + z.h - 30, z.y + z.h + 50, y - 20)));
      const al = a * rise * (.5 + .4 * pu) * (1 - zone); if (al < .01) continue;
      ctx.globalAlpha = al; ctx.lineWidth = 1.5; ctx.strokeStyle = PAL.cyan; ctx.fillStyle = rgba(PAL.cyan, .1);
      rrect(c.x, y - c.size * .8, c.w, c.size * 1.6, 8); ctx.fill(); ctx.stroke();
      ctx.font = `400 ${c.size}px ${F_MONO}`; ctx.fillStyle = '#fff'; ctx.fillText(c.s, c.x + c.w / 2, y + 1);
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- the scene
scene({
  id: 'tokens', start: 4, len: 6, fi: .4, fo: 0, mb: 1, bloom: 1,
  ch: ['01', '词元', 'TOKENS'],
  cam: (lt, d) => ({ z: 1 + .035 * (1 - sstep(0, 14.4, lt)), x: 0, y: 0 }),   // a slow settle that reaches exactly 1 before the hand-off frame
  subs: [[0.4, 4.6, '先把文字切成小块——词元（token）', 'Text is first chopped into small pieces called tokens'],
         [4.8, 8.9, '每一块都有自己的编号', 'and every piece gets its own number, its ID'],
         [9.3, 14.8, '词表是一份固定清单；生僻词会被拆成更小的片', 'The vocabulary is a fixed list; rare words are split into smaller pieces']],
  sfx: [[0, 'whoosh', { dur: .6 }], [.5, 'swish', { pitch: 1.3 }],
    ...A_CUE.map((t, i) => [t, 'chip', { midi: [69, 72, 76, 79, 84][i] }]),
    ...A_ID_T.map((t, i) => [t + .2 + .55, 'blip', { midi: [64, 67, 71, 74, 79][i] }]),
    [8.5, 'whoosh', { dur: .8 }], [9.3, 'swell', { dur: 1.4 }], [9.55, 'pop'], [9.85, 'swish', { pitch: 1.1 }],
    ...S_CUE.map((t, i) => [t, 'chip', { midi: [76, 79, 83][i] }]),
    ...S_ID_T.map((t, i) => [t + .15 + .53, 'blip', { midi: [67, 71, 74][i] }]),
    [14.2, 'whoosh', { dur: .7 }], [14.4, 'shimmer'], [14.85, 'ding', { midi: 88 }]],
  draw(lt, d, T) {
    const L = LY(), others = 1 - sstep(HAND0, HAND0 + .25, lt), lq = Math.round(lt * 30) / 30;
    const g = eSine((lt - 8.5) / .9);                                           // page A row -> top row
    const rise = sstep(9.3, 10.7, lt), wallA = 1 - sstep(HAND0, HAND0 + .55, lt);
    // ---- backdrop (the nebula is tinted exactly as the opening frame of s2_vectors)
    ctx.fillStyle = '#02040a'; ctx.fillRect(0, 0, W, H);
    glDraw(0, { time: T * .9, tint: [.04, .17, .46], amp: .55 + .3 * sstep(0, 1.6, lt) });
    // vocabulary wall (page B): dots, small labels, larger labels, drifting upward; a dark scrim keeps the centre calm
    if (wallA > 0) {
      drawWall(lt, wallA * (lt > 8.5 || lt < 1 ? 1 : 1), rise, rise <= 0);
      const sa = .92 * wallA * sstep(9.3, 10.2, lt);
      if (sa > 0) { ctx.save(); ctx.globalAlpha = sa; ctx.drawImage(WALLS().scrim, 0, 0); ctx.restore(); }
    }
    // soft light pool behind the rows
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    glowDot(W / 2, lerp(500, 400, g), 640, 'rgba(60,140,255,A)', (.12 + .03 * Math.sin(lt * 1.1)) * sstep(.2, 1.2, lt) * (1 - .6 * sstep(HAND0, HAND0 + .5, lt)));
    ctx.restore();
    // motes (batched squares; bloom softens them)
    ctx.save(); ctx.fillStyle = 'rgb(130,195,255)';
    for (const m of MOTES) {
      const x = ((m.x + lt * 9 * m.z) % W + W) % W, y = m.y + 14 * Math.sin(lt * .6 + m.p), r = m.r * m.z * 1.1;
      ctx.globalAlpha = .22 * wallA * (.6 + .4 * Math.sin(lt * 1.3 + m.p)); ctx.fillRect(x - r / 2, y - r / 2, r, r);
    }
    ctx.restore();

    // ================= page A + the top row of page B: sentence -> chips -> IDs  (one group; it moves up and shrinks at 8.5..9.4)
    ctx.save();
    { const yc = lerp(A_CY, B_CY, g), s = lerp(1, B_S, g); ctx.translate(W / 2, yc); ctx.scale(s, s); ctx.translate(-W / 2, -A_CY); }
    const sentA = sstep(0, .6, lt);
    slices(L.A, .5, .25, 1.0, 1.55, lt, 80);
    L.A.forEach((t, i) => {
      const E = A_CUE[i] + .25, e = eSine((lt - (E - A_SL)) / A_SL), fk = clamp((lt - A_CUE[i]) / .4);
      const a = sentA * (i === CAT ? 1 : others) * (i === CAT && lt >= HAND0 ? others : 1);
      morphTok(t, A_COL[i], e, fk, a);
      burst(BURST[i], t.cx, t.cy, lt - (A_CUE[i] + .05), A_COL[i]);
    });
    L.A.forEach((t, i) => {
      const tl = A_ID_T[i], kl = eout(clamp((lt - tl) / .3)), tid = tl + .2, ka = clamp((lq - tid) / .6), isCat = i === CAT;
      const a = others;
      if (kl > 0 && a > 0) {
        const y0 = A_CY + 62, y1 = A_IY - 54, y = lerp(y0, y1, kl), gr = ctx.createLinearGradient(0, y0, 0, y1);
        gr.addColorStop(0, rgba(A_COL[i], .85)); gr.addColorStop(1, rgba(A_COL[i], .25));
        ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = gr; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(t.cx, y0); ctx.lineTo(t.cx, y); ctx.stroke();
        if (kl < 1) { ctx.globalCompositeOperation = 'lighter'; glowDot(t.cx, y, 22, 'rgba(170,220,255,A)', .9); }
        ctx.restore();
      }
      if (ka > 0 && !(isCat && lt >= HAND0)) {
        idDraw(A_IDS[i], ka, i, lq, t.cx, A_IY, IDSZ, A_COL[i], clamp(ka * 4) * a, 24);
        burst(BURSTID[i], t.cx, A_IY, lt - tid - .55, A_COL[i]);
      }
    });
    ctx.restore();

    // labels at the left of the rows on page A (they fade while the rows move up)
    {
      const xr = L.A[0].cx - L.A[0].w / 2 - 36, la = sstep(1.0, 1.5, lt) * (1 - sstep(8.45, 8.75, lt)), lb = sstep(4.8, 5.2, lt) * (1 - sstep(8.45, 8.75, lt));
      if (la > 0) {
        text('词元 · token', xr, A_CY - 6, { font: F_UI, size: 32, weight: 600, color: PAL.cyan, alpha: la, align: 'right', ls: 2 });
        const lw = measure('= 空格 · space', 26, F_UI, 500);
        text('= 空格 · space', xr, A_CY + 34, { font: F_UI, size: 26, weight: 500, color: '#c9defa', alpha: la, align: 'right' });
        leadDot(xr - lw - 20, A_CY + 37, 6, PAL.cyan, la);
      }
      if (lb > 0) text('编号 · ID', xr, A_IY, { font: F_UI, size: 32, weight: 600, color: PAL.gold, alpha: lb, align: 'right', ls: 2 });
      if (lb > 0) text('编号仅为示意 · IDs are illustrative', W / 2, A_IY + 92, { font: F_UI, size: 26, weight: 500, color: '#c9defa', alpha: lb * sstep(6.4, 6.9, lt) });
    }

    // ================= page B: vocabulary caption + sub-word row
    {
      const pa = sstep(9.5, 10.0, lt) * (1 - sstep(HAND0, HAND0 + .25, lt));
      if (pa > 0) {
        const cap = '词表 · vocabulary ≈ 100,000 tokens (e.g.)', sub = '编号仅为示意 · IDs are illustrative';
        ctx.save(); ctx.font = `500 32px ${F_UI}`; ctx.letterSpacing = '1px'; const cw = ctx.measureText(cap).width; ctx.restore();
        const pw = cw + 64, py = 792 + 14 * (1 - eout(clamp((lt - 9.5) / .6)));
        glass(W / 2 - pw / 2, py, pw, 92, { r: 26, fill: 'rgba(6,12,30,.9)', stroke: 'rgba(160,200,255,.4)', lw: 1.5, alpha: pa });
        text(cap, W / 2, py + 33, { font: F_UI, size: 32, weight: 500, color: PAL.text, alpha: pa, ls: 1 });
        text(sub, W / 2, py + 69, { font: F_UI, size: 24, weight: 500, color: '#b9cdef', alpha: pa });
      }
      const sa = others;
      const wa = sstep(9.35, 9.8, lt) * sa;                                         // plain "unbelievable" fades up before it is sliced
      if (wa > 0) {
        slices(L.S, 9.8, .25, 10.35, 10.9, lt, 80, true);
        L.S.forEach((t, i) => {
          const E = S_CUE[i] + .25, e = eSine((lt - (E - S_SL)) / S_SL), fk = clamp((lt - S_CUE[i]) / .4);
          morphTok(t, S_COL[i], e, fk, wa);
          burst(BURSTS[i], t.cx, t.cy, lt - (S_CUE[i] + .05), S_COL[i]);
        });
        text('子词 · sub-word pieces', W / 2, SB_LAB, { font: F_UI, size: 32, weight: 600, color: '#ff9fe2', alpha: sstep(10.4, 10.85, lt) * sa, ls: 2, glow: 'rgba(2,4,10,.95)', blur: 10 });
        L.S.forEach((t, i) => {
          const tl = S_ID_T[i], kl = eout(clamp((lt - tl) / .3)), tid = tl + .15, ka = clamp((lq - tid) / .6);
          if (kl > 0) {
            const y0 = SB_CY + 62, y1 = SB_IY - 54, y = lerp(y0, y1, kl), gr = ctx.createLinearGradient(0, y0, 0, y1);
            gr.addColorStop(0, rgba(S_COL[i], .85)); gr.addColorStop(1, rgba(S_COL[i], .25));
            ctx.save(); ctx.globalAlpha = sa; ctx.strokeStyle = gr; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(t.cx, y0); ctx.lineTo(t.cx, y); ctx.stroke();
            if (kl < 1) { ctx.globalCompositeOperation = 'lighter'; glowDot(t.cx, y, 22, 'rgba(170,220,255,A)', .9); }
            ctx.restore();
          }
          if (ka > 0) { idDraw(S_IDS[i], ka, i + 9, lq, t.cx, SB_IY, IDSZ, S_COL[i], clamp(ka * 4) * sa, 24); burst(BURSTID[i], t.cx, SB_IY, lt - tid - .53, S_COL[i]); }
        });
      }
    }

    // ================= hand-off: the "cat" ID glides to the centre, grows and glows (same place / size / colour as the start of s2_vectors)
    if (lt >= HAND0) {
      const f = eSine((lt - HAND0 - .1) / (HAND1 - HAND0 - .1)), cat = L.A[CAT];
      const x0 = W / 2 + (cat.cx - W / 2) * B_S, y0 = B_IY, s0 = IDSZ * B_S;
      const x = lerp(x0, W / 2, f), y = lerp(y0, 470, f), sz = lerp(s0, 210, f);
      const glowK = sstep(HAND0 - .05, HAND1, lt), pulse = .5 + .5 * Math.sin(lt * 7);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      glowDot(x, y, 420 * glowK + 40, 'rgba(120,110,255,A)', .3 * glowK * (1 - f * .6));
      glowDot(x, y, 340 * glowK + 20, 'rgba(80,200,255,A)', .16 * glowK + .06 * glowK * pulse * (1 - f));
      ctx.restore();
      // weight 500 -> 700 is a cross-fade (the mono advance is identical); colour white -> #8fe4ff; glow hue violet -> cyan
      const wf = sstep(.1, .9, f), col = `rgb(${Math.round(lerp(255, 143, f))},${Math.round(lerp(255, 228, f))},255)`, gb = 24 + 10 * f, gcol = `rgb(${Math.round(lerp(169, 95, f))},${Math.round(lerp(139, 227, f))},255)`;
      text('3797', x, y, { font: F_MONO, size: sz, weight: 500, color: col, alpha: 1 - wf, glow: gcol, blur: gb });
      text('3797', x, y, { font: F_MONO, size: sz, weight: 700, color: col, alpha: wf, glow: gcol, blur: gb });
      const la = sstep(HAND0 + .45, HAND1 - .1, lt);
      if (la > 0) text('cat', x, y + 150 * f + 66 * (1 - f), { font: F_UI, size: 34, weight: 700, color: '#d9ccff', alpha: la, ls: 6, glow: PAL.violet, blur: 12 });
    }
  }
});
