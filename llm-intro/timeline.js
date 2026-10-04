'use strict';
// timeline.js: loaded after every scene. Lays the scenes on the bar grid, draws subtitles / chapter labels / letterbox,
// runs the frame pipeline (motion blur + bloom + grade) and the player. Do not edit from scene work.

SC.sort((a, b) => a.start - b.start);
SC.forEach(s => { s.t0 = s.start * BAR; s.d = s.len * BAR; });
const SUBS = SC.flatMap(s => (s.subs || []).map(([a, b, zh, en]) => ({ a: s.t0 + a, b: s.t0 + b, zh, en })));
const HITS = SC.flatMap(s => (s.hits || []).map(([t, k]) => [s.t0 + t, k]));
const sceneAt = t => { let sc = SC[0]; for (const s of SC) if (t >= s.t0) sc = s; return sc; };

const LB_H = 138, LB_OPEN = [3.1, 4.0], LB_CLOSE = [TOTAL - 6.2, TOTAL - 4.4];   // cinematic bars: closed at the very start and during the finale
const letterbox = T => LB_H * Math.max(1 - eio(clamp((T - LB_OPEN[0]) / (LB_OPEN[1] - LB_OPEN[0]))), eio(clamp((T - LB_CLOSE[0]) / (LB_CLOSE[1] - LB_CLOSE[0]))));

function drawLayer(t, jx, jy) {
  t = clamp(t, 0, TOTAL - 1e-3);
  const sc = sceneAt(t), lt = t - sc.t0;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  let shake = 0;
  for (const [th, k] of HITS) if (t >= th && t < th + 1.5) shake += 14 * k * Math.exp(-(t - th) * 6);
  const cam = sc.cam ? sc.cam(lt, sc.d) : camPush()(lt, sc.d);
  ctx.save();
  ctx.translate(W / 2 + jx + (cam.x || 0) + (shake > .3 ? Math.sin(t * 91) * shake : 0), H / 2 + jy + (cam.y || 0) + (shake > .3 ? Math.cos(t * 73) * shake : 0));
  ctx.scale(cam.z, cam.z); ctx.translate(-W / 2, -H / 2);
  sc.draw(lt, sc.d, t);
  ctx.restore();
  const fade = 1 - win(lt, 0, sc.d, sc.fi ?? .25, sc.fo ?? .25);
  if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, W, H); }
}
function chapter(sc, lt) {
  if (!sc.ch) return; const a = win(lt, .35, 4.2, .5, .6); if (a <= 0) return;
  const [n, zh, en] = sc.ch, x = 90, y = 92, slide = (1 - eout(clamp((lt - .35) / .7))) * -30;
  ctx.font = `700 46px ${F_EN}`; const nw = ctx.measureText(n).width;
  text(n, x + slide, y, { font: F_EN, weight: 700, size: 46, color: PAL.gold, alpha: a, align: 'left' });
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = PAL.gold; ctx.fillRect(x + nw + 20 + slide, y - 26, 2, 52); ctx.restore();
  text(zh, x + nw + 42 + slide, y - 8, { size: 36, weight: 700, color: '#fff', alpha: a, align: 'left' });
  text(en, x + nw + 44 + slide, y + 30, { font: F_EN, size: 16, ls: 5, color: '#9fc4ff', alpha: a, align: 'left' });
}
function subtitles(T) {
  for (const s of SUBS) {
    if (T < s.a - .3 || T > s.b + .3) continue;
    const a = win(T, s.a, s.b, .25, .3); if (a <= 0) continue;
    ctx.save(); const g = ctx.createLinearGradient(0, 880, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${.6 * a})`); ctx.fillStyle = g; ctx.fillRect(0, 880, W, 200); ctx.restore();
    text(s.zh, W / 2, 970, { size: 42, weight: 700, color: '#fff', alpha: a, glow: 'rgba(0,0,0,.9)', blur: 12, ls: 2 });
    text(s.en, W / 2, 1026, { font: F_IT, style: 'italic', size: 30, color: '#d6e4ff', alpha: a * .92, glow: 'rgba(0,0,0,.9)', blur: 8 });
  }
}
function overlays(T) {
  // impact flash: a short additive radial burst (corners and the black cinema bars stay dark, so it never greys the frame out)
  let flash = 0; for (const [th, k] of HITS) if (T >= th && T < th + 1.0) flash += k * Math.exp(-(T - th) * 8);
  if (flash > .01) {
    const a = Math.min(.55, flash * 1.1), g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 1050);
    g.addColorStop(0, `rgba(215,232,255,${a})`); g.addColorStop(.55, `rgba(160,190,255,${a * .35})`); g.addColorStop(1, 'rgba(120,150,255,0)');
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
  }
  const lb = letterbox(T);
  if (lb > .5) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, lb); ctx.fillRect(0, H - lb, W, lb); }
  const sc = sceneAt(T); chapter(sc, T - sc.t0);
  subtitles(T);
}
const SHUTTER = .5, JIT = [[.5, .5], [.25, .75], [.75, .25], [.125, .625], [.625, .125], [.375, .375], [.875, .875], [.0625, .5625]];
function frame(T, fps = 30, samples = 1) {
  T = clamp(T, 0, TOTAL - 1e-3);
  const sc = sceneAt(T), K = samples > 1 ? Math.min(8, Math.max(1, sc.mb ?? 3)) : 1;
  for (let k = 0; k < K; k++) {
    let tk = K > 1 ? Math.max(0, T + ((k + .5) / K - .5) * SHUTTER / fps) : T;
    if (sceneAt(tk) !== sc || (sc.shot && sc.shot(tk - sc.t0) !== sc.shot(T - sc.t0))) tk = T;
    drawLayer(tk, K > 1 ? JIT[k][0] - .5 : 0, K > 1 ? JIT[k][1] - .5 : 0);
    accumulate(k, K);
  }
  post(T, { ...GRADE, ...(sc.bloom ? { bloom: GRADE.bloom * sc.bloom } : {}), ...(sc.grade || {}) });
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'copy'; ctx.drawImage(glc, 0, 0); ctx.globalCompositeOperation = 'source-over';
  overlays(T);
}

// ======================================================================== fonts, playback, export hooks
let fontsReady = false;
const CHARS = (window.__CHARS || '') + 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
Promise.all([
  ...['400', '700', '900'].map(w => document.fonts.load(`${w} 40px "Noto Serif SC"`, CHARS)),
  ...['400', '700'].map(w => document.fonts.load(`${w} 40px "Noto Sans SC"`, CHARS)),
  document.fonts.load('400 40px "Cinzel"'), document.fonts.load('700 40px "Cinzel"'),
  document.fonts.load('italic 500 40px "Cormorant Garamond"'), document.fonts.load('500 40px "Cormorant Garamond"'),
  document.fonts.load('400 40px "JetBrains Mono"', CHARS), document.fonts.load('700 40px "JetBrains Mono"', CHARS),
  document.fonts.load('400 40px "Inter"', CHARS), document.fonts.load('600 40px "Inter"', CHARS), document.fonts.load('700 40px "Inter"', CHARS),
  document.fonts.load('400 40px "STIX Two Text"', CHARS), document.fonts.load('italic 400 40px "STIX Two Text"', CHARS),
]).catch(() => {}).then(() => document.fonts.ready).then(() => { fontsReady = true; const l = document.getElementById('load'); if (l) l.textContent = '字体已就绪 · 建议全屏观看（F）'; frame(0); });
setTimeout(() => { fontsReady = true; }, 15000);

window.__ready = () => fontsReady;
window.__frame = (t, fps = 30) => { frame(t, fps, 3); return cv.toDataURL('image/jpeg', .93); };
window.__duration = TOTAL;
window.__cues = () => SC.flatMap(s => (s.sfx || []).map(([t, name, o]) => ({ t: +(s.t0 + t).toFixed(4), name, ...(o || {}) }))).sort((a, b) => a.t - b.t);

const au = document.getElementById('au');
au.src = (window.EMBED && window.EMBED.audio) ? 'data:audio/mpeg;base64,' + window.EMBED.audio : 'music.mp3';
if (EXPORT) { document.getElementById('start').remove(); document.getElementById('ui').remove(); }
else {
  let playing = false, clock0 = 0, useAudio = true, hideT = 0;
  const ui = document.getElementById('ui'), pp = document.getElementById('pp'), fill = document.getElementById('fill'), tm = document.getElementById('tm');
  document.getElementById('dur').textContent = `${Math.floor(TOTAL / 60)}:${String(Math.round(TOTAL % 60)).padStart(2, '0')}`;
  const now = () => useAudio ? au.currentTime : (performance.now() - clock0) / 1000;
  function loop() {
    const T = now(); frame(T);
    fill.style.width = (T / TOTAL * 100) + '%'; tm.textContent = `${Math.floor(T / 60)}:${String(Math.floor(T % 60)).padStart(2, '0')}`;
    if (T >= TOTAL - .05) { playing = false; pp.textContent = '▶'; }
    if (playing) requestAnimationFrame(loop);
  }
  function play() { playing = true; pp.textContent = '❚❚'; au.play().catch(() => { useAudio = false; clock0 = performance.now() - au.currentTime * 1000; }); requestAnimationFrame(loop); }
  function pause() { playing = false; pp.textContent = '▶'; au.pause(); }
  document.getElementById('go').onclick = () => { document.getElementById('start').remove(); if (au.currentTime >= TOTAL - .1) au.currentTime = 0; play(); poke(); };
  pp.onclick = () => playing ? pause() : play();
  document.getElementById('bar').onclick = e => { const r = e.currentTarget.getBoundingClientRect(); au.currentTime = clamp((e.clientX - r.left) / r.width) * TOTAL; if (!useAudio) clock0 = performance.now() - au.currentTime * 1000; if (!playing) frame(au.currentTime); };
  document.getElementById('fs').onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
  function poke() { ui.classList.remove('hide'); clearTimeout(hideT); hideT = setTimeout(() => ui.classList.add('hide'), 2200); }
  addEventListener('mousemove', poke);
  addEventListener('keydown', e => {
    if (document.getElementById('start')) return;
    if (e.code === 'Space') { e.preventDefault(); playing ? pause() : play(); }
    if (e.code === 'KeyF') document.getElementById('fs').click();
    if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') { au.currentTime = clamp(au.currentTime + (e.code === 'ArrowRight' ? 5 : -5), 0, TOTAL); if (!playing) frame(au.currentTime); }
    poke();
  });
}
