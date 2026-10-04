'use strict';
// core.js: shared helpers, WebGL backdrops + film post-processing, and the scene API.
// Everything here is global. Scene files (scenes/*.js) are wrapped in their own function scope by build.py,
// so they may declare any names they like, but they must not redefine the names below.

const W = 1920, H = 1080, BPM = 96, BEAT = 60 / BPM, BAR = BEAT * 4, NBARS = 24, TOTAL = NBARS * BAR;   // BAR = 2.5 s, TOTAL = 60 s
const EXPORT = /[?&]export=1/.test(location.search);
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const PI = Math.PI, TAU = PI * 2;
const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const eio = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;      // ease in-out (cubic)
const eout = t => 1 - Math.pow(1 - t, 3);
const ein = t => t * t * t;
const eexpo = t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
const eback = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };   // overshoot
const win = (t, a, b, fi = .5, fo = .5) => sstep(a, a + fi, t) * (1 - sstep(b - fo, b, t));   // 0 -> 1 at a, 1 -> 0 at b
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hash1 = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const fmtInt = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const typed = (s, k) => [...s].slice(0, Math.max(0, Math.floor(k))).join('');            // first k characters (code points)

// ---- palette: ink-black space, cyan/violet network light, gold for "the answer", coral/mint for wrong/right
const PAL = { ink: '#04060d', cyan: '#5fe3ff', blue: '#4f8cff', violet: '#a98bff', pink: '#ff7ad9', gold: '#ffd27a', amber: '#ffb347',
  mint: '#5ef2b0', coral: '#ff6b7a', text: '#eaf2ff', dim: '#8fa3c7', faint: '#4a5a80' };
const HUES = [PAL.cyan, PAL.violet, PAL.gold, PAL.mint, PAL.pink, PAL.blue, PAL.amber];   // categorical cycle (token chips etc.)
const F_ZH = '"Noto Serif SC", "Source Han Serif SC", "SimSun", serif';
const F_EN = '"Cinzel", "Times New Roman", serif';
const F_IT = '"Cormorant Garamond", "Times New Roman", serif';
const F_MONO = '"JetBrains Mono", "DejaVu Sans Mono", "Consolas", monospace';
const F_UI = '"Inter", "Noto Sans SC", "Helvetica Neue", Arial, sans-serif';           // UI text (chat, labels); Chinese falls back to Noto Sans SC
const F_MATH = '"STIX Two Text", "Cambria Math", "Times New Roman", serif';

// text(s, x, y, {font, size, weight, style, color, alpha, align, base, ls (letter spacing px), glow (shadow colour), blur})
function text(s, x, y, o = {}) {
  ctx.save();
  ctx.font = `${o.style || ''} ${o.weight || 400} ${o.size || 40}px ${o.font || F_ZH}`;
  ctx.textAlign = o.align || 'center'; ctx.textBaseline = o.base || 'middle';
  if (o.ls) { ctx.letterSpacing = o.ls + 'px'; if ((o.align || 'center') === 'center') x += o.ls / 2; }
  ctx.globalAlpha = o.alpha ?? 1;
  if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.blur || 24; }
  ctx.fillStyle = o.color || '#fff';
  ctx.fillText(s, x, y);
  ctx.restore();
}
function measure(s, size, font = F_MONO, weight = 400) { ctx.save(); ctx.font = `${weight} ${size}px ${font}`; const w = ctx.measureText(s).width; ctx.restore(); return w; }
function hexA(hex) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},A)`; }   // 'A' is replaced by an alpha number
function rgba(hex, a) { return hexA(hex).replace('A', a); }
function glowDot(x, y, r, col, a = 1) {                       // col like 'rgba(120,200,255,A)'; draw with globalCompositeOperation 'lighter'
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(.18, col.replace('A', a * .9)); g.addColorStop(1, col.replace('A', 0));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
}
function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
// glass panel: translucent dark fill + thin light border (+ optional coloured glow)
function glass(x, y, w, h, o = {}) {
  ctx.save(); ctx.globalAlpha = o.alpha ?? 1;
  if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.blur || 30; }
  rrect(x, y, w, h, o.r ?? 18); ctx.fillStyle = o.fill || 'rgba(14,22,44,.72)'; ctx.fill(); ctx.shadowBlur = 0;
  ctx.lineWidth = o.lw ?? 1.5; ctx.strokeStyle = o.stroke || 'rgba(160,200,255,.35)'; ctx.stroke(); ctx.restore();
}
// token chip centred on (cx, cy); returns its width. Used for tokens, candidate words, labels.
function chip(label, cx, cy, o = {}) {
  const size = o.size || 40, pad = o.pad ?? size * .5, font = o.font || F_MONO, h = o.h || size * 1.7, col = o.color || PAL.cyan;
  const w = Math.max(o.minW || 0, measure(label, size, font, o.weight || 400) + pad * 2);
  ctx.save(); ctx.globalAlpha = o.alpha ?? 1;
  if (o.glow) { ctx.shadowColor = col; ctx.shadowBlur = o.glow; }
  rrect(cx - w / 2, cy - h / 2, w, h, o.r ?? h * .28); ctx.fillStyle = rgba(col, o.fillA ?? .16); ctx.fill(); ctx.shadowBlur = 0;
  ctx.lineWidth = o.lw ?? 2; ctx.strokeStyle = rgba(col, o.strokeA ?? .9); ctx.stroke(); ctx.restore();
  text(label, cx, cy + size * .04, { font, size, weight: o.weight || 400, color: o.textColor || '#fff', alpha: o.alpha ?? 1 });
  return w;
}
function caret(x, y, h, lt, col = PAL.gold, a = 1) {            // blinking text cursor, 1.1 Hz
  if (Math.floor(lt * 2.2) % 2) return;
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 18; ctx.fillRect(x, y - h / 2, Math.max(3, h * .09), h); ctx.restore();
}

// ======================================================================== WebGL: backdrops + film post-processing
const glc = document.createElement('canvas'); glc.width = W; glc.height = H;
const gl = glc.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, alpha: false, premultipliedAlpha: false });
gl.getExtension('EXT_color_buffer_float'); gl.getExtension('OES_texture_float_linear');
const VS = `#version 300 es
in vec2 p; out vec2 vUv; void main() { vUv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
const HEAD = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform vec2 uRes;
#define PI 3.14159265359
float hash(vec2 p){ uvec2 q=uvec2(ivec2(floor(p))+ivec2(4096))*uvec2(1597334673u,3812015801u); uint n=(q.x^q.y)*1597334673u; n^=n>>16; n*=2246822519u; n^=n>>13; return float(n)*(1./4294967295.); }
`;
// backdrops: mode 0 = nebula clouds + stars, mode 1 = aurora ribbons, mode 2 = perspective grid floor under a horizon glow
const FS_BG = HEAD + `
uniform float uTime; uniform int uMode; uniform vec3 uTint; uniform float uAmp; uniform float uHue; uniform float uHorizon;
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<6;i++){ s+=a*noise(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return s; }
vec3 hsv(float h,float s,float v){ vec3 k=clamp(abs(mod(h*6.+vec3(0,4,2),6.)-3.)-1.,0.,1.); return v*mix(vec3(1),k,s); }
vec3 stars(float t){ float h=hash(floor(gl_FragCoord.xy/2.)); return vec3(.9,.95,1.)*step(.9975,h)*(.55+.45*sin(t*2.+h*500.)); }
vec3 nebula(vec2 uv){
  float t=uTime*.02; vec2 p=uv*1.25;
  vec2 q=vec2(fbm(p+t), fbm(p+vec2(5.2,1.3)-t));
  float n=fbm(p+2.2*q+vec2(t*2.,0.));
  vec3 c=vec3(.008,.01,.025);
  c+=uTint*smoothstep(.35,1.05,n)*1.3;
  c+=uTint.zxy*.45*pow(clamp(q.y-.2,0.,1.),3.);
  return c+stars(uTime);
}
vec3 aurora(vec2 uv){
  float t=uTime*.07; vec3 c=vec3(.006,.008,.02);
  for(int i=0;i<4;i++){ float fi=float(i);
    float y=uv.y+.16*sin(uv.x*(1.5+fi*.6)+t*(1.+fi*.35)+fi*2.1)+.14*(fbm(vec2(uv.x*1.2+fi*7.,t*1.4+fi))-.5);
    float band=exp(-pow((y-(-.32+.22*fi))*3.4,2.));
    vec3 col=mix(uTint, uTint.zxy, fi/3.);
    c+=col*band*(.62-.1*fi);
  }
  return c+stars(uTime)*.8;
}
vec3 gridfloor(vec2 uv){
  float hz=uHorizon; vec3 c=vec3(.004,.006,.016);
  c+=uTint*.55*exp(-pow((uv.y-hz)*5.5,2.));                              // horizon glow
  if(uv.y<hz){
    float d=hz-uv.y, z=1./d; vec2 g=vec2(uv.x*z*.45, z*.45+uTime*.35); vec2 f=abs(fract(g)-.5);
    float ln=max(smoothstep(.465,.5,f.x), smoothstep(.465,.5,f.y));
    c+=uTint*ln*exp(-d*1.9)*.9*smoothstep(.02,.2,d);                      // fade out before the lines alias at the horizon
  } else { c+=stars(uTime)*smoothstep(hz,hz+.4,uv.y); c+=uTint.zxy*.06*smoothstep(.3,-.2,uv.y-hz); }
  return c;
}
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/(.5*uRes.y);
  vec3 c = uMode==0 ? nebula(uv) : uMode==1 ? aurora(uv) : gridfloor(uv);
  o=vec4(c*uAmp,1.);
}`;
const FS_ACC = HEAD + `uniform sampler2D uT; uniform float uW; void main(){ o = vec4(texture(uT, vUv).rgb * uW, 1.); }`;
const FS_DOWN = HEAD + `uniform sampler2D uT; uniform vec2 uTexel; uniform float uThresh;
vec3 pre(vec3 c){ if(uThresh<=0.) return c; float l=max(c.r,max(c.g,c.b)); float k=clamp(l-uThresh+.12,0.,.24); k=k*k/.48; return c*max(k,l-uThresh)/max(l,1e-4); }
void main(){ vec2 h=uTexel*.5;
  vec3 s=pre(texture(uT,vUv).rgb)*4.+pre(texture(uT,vUv-h).rgb)+pre(texture(uT,vUv+h).rgb)+pre(texture(uT,vUv+vec2(h.x,-h.y)).rgb)+pre(texture(uT,vUv-vec2(h.x,-h.y)).rgb);
  o=vec4(s/8.,1.); }`;
const FS_UP = HEAD + `uniform sampler2D uT; uniform vec2 uTexel;
void main(){ vec2 h=uTexel*.5; vec3 s=vec3(0.);
  s+=texture(uT,vUv+vec2(-h.x*2.,0.)).rgb; s+=texture(uT,vUv+vec2(-h.x,h.y)).rgb*2.; s+=texture(uT,vUv+vec2(0.,h.y*2.)).rgb; s+=texture(uT,vUv+vec2(h.x,h.y)).rgb*2.;
  s+=texture(uT,vUv+vec2(h.x*2.,0.)).rgb; s+=texture(uT,vUv+vec2(h.x,-h.y)).rgb*2.; s+=texture(uT,vUv+vec2(0.,-h.y*2.)).rgb; s+=texture(uT,vUv+vec2(-h.x,-h.y)).rgb*2.;
  o=vec4(s/12.,1.); }`;
const FS_FINAL = HEAD + `uniform sampler2D uScene; uniform sampler2D uBloom; uniform float uBloomAmt; uniform float uCA; uniform float uVig; uniform float uGrain;
uniform float uSeed; uniform float uSat; uniform float uSplit; uniform vec3 uTintS; uniform vec3 uTintH;
void main(){
  vec2 d=vUv-.5;
  vec3 c=vec3(texture(uScene,vUv-d*uCA).r, texture(uScene,vUv).g, texture(uScene,vUv+d*uCA).b);
  c+=texture(uBloom,vUv).rgb*uBloomAmt;
  vec3 k=max(c-.8,0.); c=min(c,.8)+k/(1.+k*5.);
  float l=dot(c,vec3(.2126,.7152,.0722));
  c=mix(c, c*mix(uTintS,uTintH,smoothstep(.04,.62,l)), uSplit);
  c=mix(vec3(l),c,uSat);
  c*=1.-uVig*smoothstep(.3,1.05,length(d*vec2(1.,.62))*1.5);
  c+=(hash(gl_FragCoord.xy+vec2(uSeed*37.,uSeed*17.))-.5)*uGrain*(.55+.45*(1.-l));
  o=vec4(c,1.);
}`;
function compile(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; }
function program(fs, names) {
  const pr = gl.createProgram(); gl.attachShader(pr, compile(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, compile(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(pr, 0, 'p'); gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(pr));
  const u = {}; for (const n of ['uRes', ...names]) u[n] = gl.getUniformLocation(pr, n); return { pr, u };
}
const P_BG = program(FS_BG, ['uTime', 'uMode', 'uTint', 'uAmp', 'uHue', 'uHorizon']);
const P_ACC = program(FS_ACC, ['uT', 'uW']);
const P_DOWN = program(FS_DOWN, ['uT', 'uTexel', 'uThresh']);
const P_UP = program(FS_UP, ['uT', 'uTexel']);
const P_FIN = program(FS_FINAL, ['uScene', 'uBloom', 'uBloomAmt', 'uCA', 'uVig', 'uGrain', 'uSeed', 'uSat', 'uSplit', 'uTintS', 'uTintH']);
const VAO = gl.createVertexArray(); gl.bindVertexArray(VAO);
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
function makeTex(w, h, float) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, float ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  return t;
}
function makeFbo(w, h) { const t = makeTex(w, h, true), f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return { t, f, w, h }; }
const SCENE_TEX = makeTex(W, H, false);
const ACC = makeFbo(W, H), MIPS = [1, 2, 3, 4, 5].map(k => makeFbo(Math.ceil(W / 2 ** k), Math.ceil(H / 2 ** k)));
function tri(target, w, h) { gl.bindFramebuffer(gl.FRAMEBUFFER, target); gl.viewport(0, 0, w, h); gl.drawArrays(gl.TRIANGLES, 0, 3); }
function bindTex(unit, t) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); }
// glDraw(mode, {time, tint:[r,g,b] (0..1, try .1-.5), amp (brightness, ~.6-1), horizon (mode 2, -.3..0.2)}, alpha): paints a backdrop onto the 2D canvas
function glDraw(mode, u = {}, alpha = 1) {
  const P = P_BG; gl.useProgram(P.pr); gl.disable(gl.BLEND);
  gl.uniform2f(P.u.uRes, W, H); gl.uniform1f(P.u.uTime, u.time ?? 0); gl.uniform1i(P.u.uMode, mode);
  const t = u.tint || [.1, .25, .6]; gl.uniform3f(P.u.uTint, t[0], t[1], t[2]); gl.uniform1f(P.u.uAmp, u.amp ?? 1);
  gl.uniform1f(P.u.uHue, u.hue ?? .55); gl.uniform1f(P.u.uHorizon, u.horizon ?? -.05);
  bindTex(0, null); tri(null, W, H);
  ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(glc, 0, 0); ctx.restore();
}
function accumulate(k, K) {
  bindTex(0, SCENE_TEX); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, cv);
  gl.useProgram(P_ACC.pr); gl.uniform1i(P_ACC.u.uT, 0); gl.uniform1f(P_ACC.u.uW, 1 / K);
  if (k === 0) gl.disable(gl.BLEND); else { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); }
  tri(ACC.f, W, H); gl.disable(gl.BLEND);
}
// colour grade: bloom strength, chromatic aberration, vignette, film grain, saturation, split-toning (cool shadows / warm highlights)
const GRADE = { bloom: .85, ca: .0022, vig: .55, grain: .045, sat: 1.04, split: .55, tintS: [.9, .97, 1.1], tintH: [1.07, 1.0, .9] };
function post(T, g) {
  let src = ACC;
  gl.useProgram(P_DOWN.pr); gl.uniform1i(P_DOWN.u.uT, 0);
  MIPS.forEach((dst, i) => { bindTex(0, src.t); gl.uniform2f(P_DOWN.u.uTexel, 1 / src.w, 1 / src.h); gl.uniform1f(P_DOWN.u.uThresh, i ? 0 : .5); tri(dst.f, dst.w, dst.h); src = dst; });
  gl.useProgram(P_UP.pr); gl.uniform1i(P_UP.u.uT, 0); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
  for (let i = MIPS.length - 1; i > 0; i--) { const s = MIPS[i], d = MIPS[i - 1]; bindTex(0, s.t); gl.uniform2f(P_UP.u.uTexel, 1 / s.w, 1 / s.h); tri(d.f, d.w, d.h); }
  gl.disable(gl.BLEND);
  const P = P_FIN; gl.useProgram(P.pr); bindTex(0, ACC.t); bindTex(1, MIPS[0].t);
  gl.uniform1i(P.u.uScene, 0); gl.uniform1i(P.u.uBloom, 1); gl.uniform2f(P.u.uRes, W, H);
  gl.uniform1f(P.u.uBloomAmt, g.bloom); gl.uniform1f(P.u.uCA, g.ca); gl.uniform1f(P.u.uVig, g.vig); gl.uniform1f(P.u.uGrain, g.grain);
  gl.uniform1f(P.u.uSeed, Math.floor(T * 30) % 97); gl.uniform1f(P.u.uSat, g.sat); gl.uniform1f(P.u.uSplit, g.split);
  gl.uniform3fv(P.u.uTintS, g.tintS); gl.uniform3fv(P.u.uTintH, g.tintH);
  tri(null, W, H); bindTex(1, null); bindTex(0, null);
}

// ======================================================================== shared assets
const rnd = mulberry(20261004);                               // load-time PRNG; use it ONLY while building constant tables at load time, never inside draw()
const STARS = Array.from({ length: 420 }, () => ({ x: rnd() * W, y: rnd() * H, z: .2 + rnd() * .8, p: rnd() * TAU }));
function starfield(t, a = 1, vx = 8, vy = 0) {
  ctx.save(); ctx.fillStyle = '#fff';
  for (const s of STARS) {
    const x = ((s.x + t * vx * s.z) % W + W) % W, y = ((s.y + t * vy * s.z) % H + H) % H;
    ctx.globalAlpha = a * s.z * (.55 + .45 * Math.sin(t * 2 + s.p));
    const r = s.z * 2.2; ctx.fillRect(x, y, r, r);
  }
  ctx.restore();
}
function bgGrad(c0, c1, cx = W / 2, cy = H / 2) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 1200);
  g.addColorStop(0, c0); g.addColorStop(1, c1); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function goldGrad(x0, y0, x1, y1, s) {                        // gold gradient with a moving sheen at position s (0..1); same look as the abstract-algebra title
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, '#6e4b1b'); g.addColorStop(.35, '#d9b25c');
  if (s > .05 && s < .95) { g.addColorStop(s - .05, '#e7c574'); g.addColorStop(s, '#fff6dc'); g.addColorStop(s + .05, '#e7c574'); }
  g.addColorStop(.7, '#c99a45'); g.addColorStop(1, '#7a5520');
  return g;
}
function proj(v, yaw, pitch, cx, cy, F, D = 7) {             // 3D point [x,y,z] -> [screenX, screenY, depth]
  const c1 = Math.cos(yaw), s1 = Math.sin(yaw), c2 = Math.cos(pitch), s2 = Math.sin(pitch);
  const x = v[0] * c1 + v[2] * s1, z = -v[0] * s1 + v[2] * c1, y = v[1];
  const y2 = y * c2 - z * s2, z2 = y * s2 + z * c2, d = D - z2;
  return [cx + F * x / d, cy - F * y2 / d, z2];
}
function flare(x, y, a, len = 900) {                          // anamorphic lens streak
  if (a <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(x - len, 0, x + len, 0);
  g.addColorStop(0, 'rgba(120,170,255,0)'); g.addColorStop(.5, `rgba(255,236,200,${.9 * a})`); g.addColorStop(1, 'rgba(120,170,255,0)');
  ctx.fillStyle = g; ctx.fillRect(x - len, y - 2, len * 2, 4);
  ctx.globalAlpha = .35 * a; ctx.fillRect(x - len * .6, y - 9, len * 1.2, 18);
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, y); ctx.scale(4, 1); glowDot(0, 0, 60, 'rgba(255,220,170,A)', a); ctx.restore();
}
function titleLayout(str, cx, size, ls) {
  ctx.save(); ctx.font = `900 ${size}px ${F_ZH}`; const ws = [...str].map(c => ctx.measureText(c).width); ctx.restore();
  const total = ws.reduce((a, b) => a + b, 0) + ls * (ws.length - 1); let x = cx - total / 2;
  return ws.map(w => { const r = { x: x + w / 2, w, total }; x += w + ls; return r; });
}
// gold title, one glyph at a time: t0 = start (local time), stagger = delay per glyph, grow = initial extra scale
function titleWord(str, cx, cy, size, lt, t0, stagger, ls, a = 1, grow = .6) {
  const L = titleLayout(str, cx, size, ls), total = L[0].total, sheenX = cx - total / 2 + (((lt * .32) % 1.8) - .3) * total;
  ctx.save(); ctx.font = `900 ${size}px ${F_ZH}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  [...str].forEach((ch, i) => {
    const { x, w } = L[i], k = clamp((lt - t0 - i * stagger) / 1.0);
    if (k <= 0) return;
    const e = eexpo(k), sc = 1 + grow * (1 - e);
    ctx.save(); ctx.translate(x, cy); ctx.scale(sc, sc); ctx.globalAlpha = clamp(k * 2.5) * a;
    ctx.shadowColor = 'rgba(255,180,80,.55)'; ctx.shadowBlur = 50;
    ctx.fillStyle = goldGrad(-w / 2, -size / 2, w / 2, size / 2, (sheenX - (x - w / 2)) / w); ctx.fillText(ch, 0, 0);
    ctx.restore();
  });
  ctx.restore();
}
function glitchText(s, x, y, size, a, font = F_EN, seed = 0) {
  if (a <= 0) return;
  const j = (hash1(seed * 7.1) - .5) * 14;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  text(s, x - 5 + j, y, { font, size, color: 'rgba(255,60,80,1)', alpha: a * .55 });
  text(s, x + 5 - j, y, { font, size, color: 'rgba(60,220,255,1)', alpha: a * .55 });
  ctx.restore();
  text(s, x, y, { font, size, color: '#fff', alpha: a, glow: 'rgba(255,255,255,.6)', blur: 20 });
}

// the one sentence that travels through the whole video, and its illustrative next-word distribution.
// Scenes 0, 4, 6 and 8 must all use these numbers so the story stays consistent. '…' stands for "every other token".
const STORY = {
  text: 'The cat sat on the', tokens: ['The', ' cat', ' sat', ' on', ' the'], ids: [464, 3797, 3332, 319, 262],
  answer: 'mat', next: [['mat', .41], ['floor', .19], ['couch', .11], ['bed', .08], ['sofa', .07], ['roof', .05], ['rug', .04], ['…', .05]],
  afterwards: [' and', ' purred', '.'],                                       // what the loop writes after "mat"
  untrained: [['banana', .04], ['quantum', .04], ['seven', .03], ['purple', .03], ['mat', .01], ['…', .85]],   // an untrained model's guess (scene 5 start, scene 6 start); P(mat)=1% -> loss = -ln(.01) = 4.6
};

// ======================================================================== scene API
// scene({
//   id: 'tokens',                 // unique name
//   start: 2, len: 2,             // in BARS (1 bar = 2.5 s); scenes must tile the 24 bars with no gaps
//   fi: .25, fo: .25,             // black fade-in / fade-out seconds at the scene edges (use fi: .01 / fo: 0 for a hard cut)
//   mb: 3, bloom: 1, grade: {},   // motion-blur sub-samples (1..4), bloom multiplier, overrides for GRADE
//   ch: ['01', '词元', 'TOKENS'], // chapter label shown top-left for the first seconds
//   subs: [[a, b, zh, en], ...],  // bilingual subtitles, local seconds
//   sfx: [[t, 'cue', {opts}], ...], // sound cues, local seconds (vocabulary in SPEC.md)
//   hits: [[t, k], ...],          // impact flash + camera shake at local time t, strength k (0..1)
//   cam: (lt, d) => ({z, x, y}),  // optional camera; default is a slow push-in
//   shot: lt => id,               // optional: returns a different id on each side of a hard cut inside the scene (keeps motion blur from straddling it)
//   draw(lt, d, T) {...}          // PURE function of local time lt (seconds); T is the global time. No state between frames.
// })
const SC = [];
function scene(o) { SC.push(o); return o; }
const camPush = (amt = .045) => (lt, d) => ({ z: 1 + amt * lt / d, x: 10 * Math.sin(lt * .21), y: 6 * Math.sin(lt * .17 + 1) });
const camArc = (amt = .04) => (lt, d) => ({ z: 1 + amt * Math.sin(PI * clamp(lt / d)) });
const camStill = () => ({ z: 1 });
