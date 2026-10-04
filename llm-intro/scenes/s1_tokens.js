// s1_tokens: text -> tokens -> ID numbers.  Global 5.0..10.0 s (start bar 2, len 2).
const R = mulberry(20260001);

// ---------------------------------------------------------------- constant tables
// Both rows live on screen at the same time (row A on top, row B below) so nothing has to slide or scale.
const TK_SIZE = 64, TK_GAP = 36, SENT_SIZE = 100, SENT_Y = 270, ID_Y = 440, ROW_B_Y = 625, ID_B_Y = 785, LAB_B_Y = 525;
const A_DROP = 105;                       // row A starts lower (frame is balanced) and rises to make room for row B at 1.7..2.3 s
const WALL_WORDS = ['the', ' of', 'ing', 'tion', '的', ' and', 'def', '{', ' to', 'ed', ' in', '了', 'er', ' is', 'ation', '</', 'is', ' that', '我', 'ly',
  'return', ' for', 'un', ' with', ' on', 'ity', '。', ' as', 'import', ' was', 'able', '(', ' it', 'ment', '是', ' by', 'ness', '\n', ' are', 'ous',
  ' be', '==', 'pre', ' at', 'AI', ' or', 'less', '不', ' from', ' an', 'self', ' this', 'ize', '在', ' have', ', ', '->', ' not', 'ful', ' but'];
const WALL = Array.from({ length: 1500 }, () => { const z = R(); return { x: R() * W, y: R() * H, z, s: z < .5 ? 1.4 : z < .85 ? 2 : 2.8, a: .12 + .3 * R(), p: R() * TAU }; });
// background words: ONE per horizontal lane (45 px apart), so two words can never overlap each other
const LANES = Array.from({ length: 16 }, (_, i) => 165 + i * 45).sort(() => R() - .5);
const WORDS = LANES.map((y, i) => ({ s: WALL_WORDS[(i * 7 + 3) % WALL_WORDS.length].replace('\n', '\\n'), x: R() * W, y, z: .25 + R() * .75, big: i < 10, a: i < 10 ? .26 + .12 * R() : .12 + .12 * R() }));
// the vocabulary band: three slowly drifting rows of tiny token chips, lower half, visible only until row B arrives
const VB_Y = [706, 768, 830], VB_SP = [-16, 22, -28];
const VB_ROWS = [0, 1, 2].map(r => {
  const items = []; let x = 0, k = r * 5;
  while (x < 2500) { const raw = WALL_WORDS[k % WALL_WORDS.length].replace('\n', '\\n'); k += 3 + (r % 2); const s = raw.length > 1 ? raw.replace(/^ /, '') : raw, w = s.length * 12.2 + 30; items.push({ s, w, x, lit: items.length % 7 === 3 + r % 2 }); x += w + 16; }
  return { items, tot: x };
});
const MOTES = Array.from({ length: 60 }, () => ({ x: R() * W, y: R() * H, z: .3 + R() * .7, p: R() * TAU, r: 2 + 6 * R() }));
const mkBurst = () => Array.from({ length: 16 }, () => ({ a: R() * TAU, v: 60 + 160 * R(), l: .5 + .5 * R(), r: 1.5 + 2.5 * R() }));
const BURST = Array.from({ length: 5 }, mkBurst);
const BURSTB = Array.from({ length: 3 }, mkBurst);

const A_TOK = STORY.tokens.slice(), A_IDS = STORY.ids.map(String);
const B_TOK = ['un', 'believ', 'able'], B_IDS = ['403', '6481', '540'], B_COL = [PAL.mint, PAL.pink, PAL.blue];
const A_COL = HUES.slice(0, 5);

function rowLayout(toks, cy) {
  const ws = toks.map(s => measure(s, TK_SIZE, F_MONO, 500) + TK_SIZE), tot = ws.reduce((a, b) => a + b, 0) + TK_GAP * (toks.length - 1);
  let x = W / 2 - tot / 2; return ws.map(w => { const r = { cx: x + w / 2, w, cy }; x += w + TK_GAP; return r; });
}
const A_LAY = rowLayout(A_TOK, SENT_Y), B_LAY = rowLayout(B_TOK, ROW_B_Y);
// sentence word centres (plain text)
const SENT_L = W / 2 - measure(STORY.text, SENT_SIZE, F_UI, 500) / 2;
const SENT_WORDS = STORY.tokens.map((t, i) => {
  const pre = STORY.tokens.slice(0, i).join('') + (t[0] === ' ' ? ' ' : ''), w = measure(t.trim(), SENT_SIZE, F_UI, 500);
  return { s: t.trim(), x: SENT_L + measure(pre, SENT_SIZE, F_UI, 500) + w / 2 };
});
// "unbelievable" is drawn as ONE kerned word and revealed piece by piece through clip rects, so glyphs never collide
const B_FULL = 'unbelievable', B_L = W / 2 - measure(B_FULL, SENT_SIZE, F_UI, 500) / 2;
const B_CUT = [0, 2, 8, 12].map(n => B_L + measure(B_FULL.slice(0, n), SENT_SIZE, F_UI, 500));
const B_WORDS = B_TOK.map((s, i) => ({ s, x0: B_CUT[i], x1: B_CUT[i + 1], x: (B_CUT[i] + B_CUT[i + 1]) / 2 }));

// hand-off to s2_vectors: its first frame has 3797 at (960,470), 210 px, weight 700, #8fe4ff with a cyan glow
const CAT = 1, CENTER = { x: W / 2, y: 470 }, CAT_END = 210;

// ---------------------------------------------------------------- helpers
function leadDot(x, y, r, col, a) {                    // the "leading space" mark: a bright dot
  ctx.save(); ctx.globalAlpha = a; ctx.shadowColor = col; ctx.shadowBlur = 12; ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = rgba(col, .9); ctx.beginPath(); ctx.arc(x, y, r * .62, 0, TAU); ctx.fill(); ctx.restore();
}function tokChip(label, cx, cy, col, o = {}) {
  const w = chip(label, cx, cy, { size: TK_SIZE, color: col, glow: o.glow ?? 18, alpha: o.alpha ?? 1, fillA: o.fillA ?? .16, weight: 500 });
  if (label[0] === ' ') {                               // visible "leading space" mark
    const cw = measure('x', TK_SIZE, F_MONO, 500), dx = cx - w / 2 + TK_SIZE * .5 + cw / 2;
    leadDot(dx, cy + 6, 6, col, o.alpha ?? 1);
  }
  return w;
}
// digits scramble at ~12 Hz (held for whole frames, so motion-blur sub-frames agree), then settle left to right.
// Scrambled digits are dim and thin; settled digits are bright white.
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
const popK = (lt, t0) => clamp((lt - t0) / .55);
const eSine = t => .5 - .5 * Math.cos(PI * clamp(t));

// ---------------------------------------------------------------- the scene
const OUT0 = 4.0, OUT1 = 4.35, HAND0 = 4.15, HAND1 = 4.8;   // everything but 3797 fades 4.0..4.35; 3797 glides 4.15..4.8 and then HOLDS until the hard cut at 5.0
scene({
  id: 'tokens', start: 2, len: 2, fi: .12, fo: 0, mb: 2, bloom: 1,
  ch: ['01', '词元', 'TOKENS'],
  cam: (lt, d) => ({ z: 1 + .028 * (1 - sstep(0, 4.15, lt)), x: 0, y: 0 }),   // eases to exactly 1 so the hand-off frame is pixel-matched
  subs: [[0.3, 2.4, '先把文字切成小块——词元（token）', 'Text is chopped into small pieces called tokens'],
         [2.5, 4.9, '每一块都对应一个数字编号', 'each piece is mapped to a number']],
  sfx: [[0, 'whoosh', { dur: .5 }],
    ...A_TOK.map((_, i) => [.625 + i * .07, 'chip', { midi: [69, 72, 76, 79, 84][i] }]),
    ...A_IDS.map((_, i) => [1.25 + i * .1, 'blip', { midi: [64, 67, 71, 74, 79][i] }]),
    [2.0, 'pop'], [2.5, 'swish', { pitch: 1 }],
    ...B_TOK.map((_, i) => [2.76 + i * .08, 'chip', { midi: [76, 79, 83][i] }]),
    ...B_IDS.map((_, i) => [3.0 + i * .1, 'blip', { midi: [67, 71, 74][i] }]),
    [4.15, 'whoosh', { dur: .6 }], [4.4, 'ding', { midi: 88 }], [4.4, 'shimmer']],
  draw(lt, d, T) {
    const others = 1 - sstep(OUT0, OUT1, lt), bOut = others, lq = Math.round(lt * 30) / 30;
    const dyA = A_DROP * (1 - eio(clamp((lt - 1.7) / .6)));
    // ---- backdrop
    ctx.fillStyle = '#02040a'; ctx.fillRect(0, 0, W, H);
    glDraw(0, { time: T * .9, tint: [.04, .17, .46], amp: .55 + .3 * sstep(0, 1.6, lt) });
    // vocabulary wall: thousands of tiny dots, slowly drifting (parallax)
    const wallA = .6 + .4 * sstep(.2, 1.6, lt);
    ctx.save(); ctx.fillStyle = '#9fd0ff';
    for (const b of [0, 1, 2]) {
      ctx.globalAlpha = wallA * [.5, .7, .95][b] * .34;
      ctx.beginPath();
      for (const p of WALL) {
        if ((p.z < .5 ? 0 : p.z < .85 ? 1 : 2) !== b) continue;
        const sp = 7 + p.z * 26, x = ((p.x - lt * sp) % W + W) % W, y = ((p.y - lt * sp * .18) % H + H) % H;
        const tw = .6 + .4 * Math.sin(lt * 1.6 + p.p); if (tw < .35) continue;
        ctx.rect(x, y, p.s, p.s);
      }
      ctx.fill();
    }
    ctx.restore();
    // vocabulary band: rows of tiny token chips in the lower half (a few lit), gone before row B arrives
    const vb = sstep(.15, .9, lt) * (1 - sstep(1.7, 2.3, lt));
    if (vb > 0) {
      ctx.save(); ctx.font = `400 20px ${F_MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 1.5;
      VB_ROWS.forEach((row, r) => {
        for (const it of row.items) {
          const px = ((it.x + lt * VB_SP[r]) % row.tot + row.tot) % row.tot - 120, cx = px + it.w / 2;
          if (cx < 40 || cx > W - 40) continue;
          const ea = sstep(120, 380, cx) * (1 - sstep(W - 380, W - 120, cx)), pul = it.lit ? .6 + .4 * Math.sin(lt * 2 + it.x) : 0;
          const al = vb * ea; if (al < .02) continue;
          const col = it.lit ? PAL.cyan : '#9fd0ff';
          ctx.globalAlpha = al * (it.lit ? .55 + .35 * pul : .3); ctx.strokeStyle = col; ctx.fillStyle = rgba(col, it.lit ? .12 : .05);
          ctx.beginPath(); ctx.roundRect(px, VB_Y[r] - 20, it.w, 40, 10); ctx.fill(); ctx.stroke();
          ctx.globalAlpha = al * (it.lit ? .95 : .5); ctx.fillStyle = it.lit ? '#fff' : '#b4dcff'; ctx.fillText(it.s, cx, VB_Y[r] + 1);
        }
      });
      ctx.restore();
    }
    // drifting background words: one per lane, and faded to almost nothing wherever they would sit behind the content
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#b4dcff';
    for (const w of WORDS) {
      const sp = 10 + w.z * 22, x = ((w.x - lt * sp) % (W + 200) + W + 200) % (W + 200) - 100, y = w.y + 6 * Math.sin(lt * .5 + w.x);
      ctx.font = `${w.big ? 500 : 400} ${w.big ? 26 : 20}px ${F_MONO}`;
      const inside = Math.max(sstep(40, 150, x) * (1 - sstep(1560, 1650, x)) * sstep(175, 210, y) * (1 - sstep(885, 915, y)),
        (y < 215 && (x < 780 || x > 1400)) ? 1 : 0);                  // caption pill + footnote strip
      const inBand = (y > 640 && y < 870) ? vb : 0;
      const keep = (1 - .96 * Math.max(inside, inBand)) * (x > 40 && x < W - 40 ? 1 : 0);
      if (keep <= .005) continue;
      ctx.globalAlpha = w.a * wallA * keep * (.7 + .3 * Math.sin(lt * .9 + w.y)); ctx.fillText(w.s, x, y);
    }
    ctx.restore();
    // soft light pool behind the token rows
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    glowDot(W / 2, 480 + dyA * .6, 640, 'rgba(60,140,255,A)', .15 * sstep(.2, 1.2, lt) * (1 - .6 * sstep(OUT0, OUT1 + .3, lt)));
    ctx.restore();
    // motes (batched squares; bloom softens them)
    ctx.save(); ctx.fillStyle = 'rgb(130,195,255)';
    for (const m of MOTES) {
      const x = ((m.x + lt * 9 * m.z) % W + W) % W, y = m.y + 14 * Math.sin(lt * .6 + m.p), r = m.r * m.z * 1.1;
      ctx.globalAlpha = .22 * wallA * (.6 + .4 * Math.sin(lt * 1.3 + m.p)); ctx.fillRect(x - r / 2, y - r / 2, r, r);
    }
    ctx.restore();

    // ================= row A: the sentence -> chips -> IDs  (whole group drops by dyA until row B arrives)
    ctx.save(); ctx.translate(0, dyA);
    const es = .93 + .07 * eout(clamp(lt / .6));                                   // sentence eases up to full size
    A_LAY.forEach((c, i) => {
      const t0 = .365 + i * .07, k = clamp((lt - t0) / .62), e = eio(k), pk = popK(lt, t0 + .22), pe = pk > 0 ? eback(pk) : 0;
      const wd = SENT_WORDS[i], x = lerp(W / 2 + (wd.x - W / 2) * es, c.cx, e), y = SENT_Y - Math.sin(k * PI) * 14;
      const plainA = (1 - sstep(.05, .42, k)) * others * sstep(0, .3, lt);
      if (plainA > 0) text(wd.s, x, y, { font: F_UI, size: SENT_SIZE * lerp(es, 1, e), weight: 500, color: '#fff', alpha: plainA, glow: 'rgba(160,200,255,.3)', blur: 8 });
      if (pk > 0) {
        ctx.save(); ctx.translate(c.cx, SENT_Y); const s = .7 + .3 * pe; ctx.scale(s, s);
        tokChip(A_TOK[i], 0, 0, A_COL[i], { alpha: clamp(pk * 2.2) * others, glow: 18 + 14 * (1 - pk) });
        ctx.restore();
      }
      burst(BURST[i], c.cx, SENT_Y, lt - (.625 + i * .07 - .08), A_COL[i]);
    });
    A_LAY.forEach((c, i) => {
      const tl = 1.0 + i * .1, kl = eout(clamp((lt - tl) / .4)), tid = 1.25 + i * .1, ka = clamp((lq - tid) / .6);
      const isCat = i === CAT, a = (isCat ? 1 : others);
      if (kl > 0 && a > 0) {
        const y0 = SENT_Y + 62, y1 = ID_Y - 54, y = lerp(y0, y1, kl);
        const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, rgba(A_COL[i], .85)); g.addColorStop(1, rgba(A_COL[i], .25));
        ctx.save(); ctx.globalAlpha = a * (isCat ? 1 - sstep(OUT0, OUT1, lt) : 1); ctx.strokeStyle = g; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(c.cx, y0); ctx.lineTo(c.cx, y); ctx.stroke();
        if (kl < 1) { ctx.globalCompositeOperation = 'lighter'; glowDot(c.cx, y, 22, 'rgba(170,220,255,A)', .9); }
        ctx.restore();
      }
      if (ka > 0 && !(isCat && lt >= HAND0)) {
        idDraw(A_IDS[i], eout(ka), i, lq, c.cx, ID_Y, 76, A_COL[i], clamp(ka * 4) * a, 24);
        burst(BURSTB[0], c.cx, ID_Y, lt - tid - .45, A_COL[i]);
      }
    });

    // labels at the left of each row (row B uses the same x)
    const xr = A_LAY[0].cx - A_LAY[0].w / 2 - 34;
    {
      const la = sstep(.7, 1.2, lt) * others, lb = sstep(1.3, 1.8, lt) * others;
      text('token', xr, SENT_Y - 8, { font: F_UI, size: 30, weight: 600, color: PAL.cyan, alpha: la, align: 'right', ls: 3 });
      if (la > 0) {
        const lw = measure('= 空格 / space', 24, F_UI, 400);
        text('= 空格 / space', xr, SENT_Y + 32, { font: F_UI, size: 24, color: PAL.text, alpha: la * .9, align: 'right' });
        leadDot(xr - lw - 18, SENT_Y + 35, 5.5, PAL.cyan, la);
      }
      text('ID', xr, ID_Y, { font: F_UI, size: 30, weight: 600, color: PAL.gold, alpha: lb, align: 'right', ls: 3 });
    }
    ctx.restore();

    // ================= row B: a rarer word splits into sub-word pieces
    const bIn = sstep(2.0, 2.45, lt), bA = bIn * bOut;
    if (bA > 0) {
      const lab = sstep(2.2, 2.6, lt) * bOut;
      text('子词 · sub-word pieces', W / 2, LAB_B_Y, { font: F_UI, size: 30, weight: 600, color: '#ff9fe2', alpha: lab, ls: 3, glow: 'rgba(2,4,10,.95)', blur: 10 });
      text('token', xr, ROW_B_Y, { font: F_UI, size: 30, weight: 600, color: PAL.cyan, alpha: sstep(2.8, 3.1, lt) * bOut, align: 'right', ls: 3 });
      text('ID', xr, ID_B_Y, { font: F_UI, size: 30, weight: 600, color: PAL.gold, alpha: sstep(3.0, 3.3, lt) * bOut, align: 'right', ls: 3 });
      // thin gold tick marks show where the word will be cut, just before it splits
      const tk = sstep(2.25, 2.45, lt) * (1 - sstep(2.55, 2.75, lt)) * bOut;
      if (tk > 0) {
        ctx.save(); ctx.strokeStyle = PAL.gold; ctx.lineWidth = 2.5; ctx.shadowColor = PAL.gold; ctx.shadowBlur = 10; ctx.globalAlpha = tk;
        for (const n of [1, 2]) { ctx.beginPath(); ctx.moveTo(B_CUT[n], ROW_B_Y - 66); ctx.lineTo(B_CUT[n], ROW_B_Y + 66); ctx.stroke(); }
        ctx.restore();
      }
      B_LAY.forEach((c, i) => {
        const t0 = 2.5 + i * .08, k = clamp((lt - t0) / .55), e = eio(k), pk = popK(lt, t0 + .22), pe = pk > 0 ? eback(pk) : 0;
        const wd = B_WORDS[i], dx = (c.cx - wd.x) * e, dy = -Math.sin(k * PI) * 12;
        const plainA = (1 - sstep(.05, .42, k)) * bA;
        if (plainA > 0) {
          const padL = i === 0 ? 70 : 0, padR = i === 2 ? 70 : 0;
          ctx.save(); ctx.translate(dx, dy); ctx.beginPath(); ctx.rect(wd.x0 - padL, ROW_B_Y - 90, wd.x1 - wd.x0 + padL + padR, 180); ctx.clip();
          text(B_FULL, W / 2, ROW_B_Y, { font: F_UI, size: SENT_SIZE, weight: 500, color: '#fff', alpha: plainA, glow: 'rgba(160,200,255,.3)', blur: 8 });
          ctx.restore();
        }
        if (pk > 0) {
          ctx.save(); ctx.translate(c.cx, ROW_B_Y); const s = .7 + .3 * pe; ctx.scale(s, s);
          tokChip(B_TOK[i], 0, 0, B_COL[i], { alpha: clamp(pk * 2.2) * bOut, glow: 18 + 14 * (1 - pk) }); ctx.restore();
        }
        burst(BURST[i], c.cx, ROW_B_Y, lt - (2.76 + i * .08 - .08), B_COL[i]);
        const kl = eout(clamp((lt - (2.8 + i * .08)) / .3)), ta = 3.0 + i * .1, ka = clamp((lq - ta) / .55);
        if (kl > 0) {
          const y0 = ROW_B_Y + 62, y1 = ID_B_Y - 54, yy = lerp(y0, y1, kl), g = ctx.createLinearGradient(0, y0, 0, y1);
          g.addColorStop(0, rgba(B_COL[i], .85)); g.addColorStop(1, rgba(B_COL[i], .25));
          ctx.save(); ctx.globalAlpha = bOut; ctx.strokeStyle = g; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(c.cx, y0); ctx.lineTo(c.cx, yy); ctx.stroke(); ctx.restore();
        }
        if (ka > 0) idDraw(B_IDS[i], eout(ka), i + 9, lq, c.cx, ID_B_Y, 76, B_COL[i], clamp(ka * 4) * bOut, 24);
      });
    }

    // ================= vocabulary caption (top left, in its own pill) + footnote
    {
      const a = sstep(.6, 1.1, lt) * (1 - sstep(OUT0, OUT1, lt));
      if (a > 0) {
        const cap = '词表 · vocabulary ≈ 100,000 tokens';
        ctx.save(); ctx.font = `500 30px ${F_UI}`; ctx.letterSpacing = '1.5px'; const cw = ctx.measureText(cap).width; ctx.restore();
        glass(90, 148, cw + 44, 50, { r: 25, fill: 'rgba(6,12,30,.72)', stroke: 'rgba(160,200,255,.4)', lw: 1.5, alpha: a });
        text(cap, 112, 174, { font: F_UI, size: 30, weight: 500, color: PAL.text, alpha: a, ls: 1.5, align: 'left' });
        text('IDs illustrative · 编号仅为示意', W - 90, 174, { font: F_UI, size: 24, color: PAL.text, alpha: a * .85, align: 'right' });
      }
    }

    // ================= hand-off: the "cat" ID glides to the centre and glows (same place / size / colour as the start of s2_vectors)
    {
      const f = eSine((lt - HAND0) / (HAND1 - HAND0)), cat = A_LAY[CAT];
      if (lt >= HAND0) {
        const x = lerp(cat.cx, CENTER.x, f), y = lerp(ID_Y, CENTER.y, f), sz = lerp(76, CAT_END, f);
        const glowK = sstep(HAND0 - .05, HAND1, lt), pulse = .5 + .5 * Math.sin(lt * 7);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        glowDot(x, y, 420 * glowK + 40, 'rgba(120,110,255,A)', .3 * glowK * (1 - f * .6));
        glowDot(x, y, 340 * glowK + 20, 'rgba(80,200,255,A)', .16 * glowK + .06 * glowK * pulse * (1 - f));
        ctx.restore();
        // weight 500 -> 700 is a cross-fade (mono advance is identical), colour white -> #8fe4ff is interpolated
        const wf = sstep(.1, .9, f), col = `rgb(${Math.round(lerp(255, 143, f))},${Math.round(lerp(255, 228, f))},255)`, gb = 20 + 14 * glowK;
        text('3797', x, y, { font: F_MONO, size: sz, weight: 500, color: col, alpha: 1 - wf, glow: PAL.cyan, blur: gb });
        text('3797', x, y, { font: F_MONO, size: sz, weight: 700, color: col, alpha: wf, glow: PAL.cyan, blur: gb });
        const la = sstep(HAND0 + .2, HAND1 - .05, lt);
        if (la > 0) text('cat', x, y + 150 * f + 66 * (1 - f), { font: F_UI, size: 34, weight: 700, color: '#d9ccff', alpha: la, ls: 6, glow: PAL.violet, blur: 12 });
      }
    }
  }
});
