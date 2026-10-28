/* İrtifa · a small WebGL2 kit shared by the pages.
   Flow: a velocity field painted by the pointer and fading every frame (ping-pong targets); pictures read it to bend.
   Picture: one image in its own canvas, object-fit: cover, in "liquid" mode (the pointer stirs it, colours split at
   the edges of the stir) or "xray" mode (the render drawn as gold lines by an edge filter, a scan line turning the
   drawing into the photograph, and a lens around the pointer that shows the other one).
   LensLayer: one fixed canvas over the page that takes over whichever [data-lens] picture the pointer is on, so any
   number of cards share a single context. Every class fails quietly: no WebGL2 → the plain <img> stays. */

const VS = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main(){ vUv = aPos * .5 + .5; gl_Position = vec4(aPos, 0., 1.); }`;

const FLOW_FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uPrev; uniform vec2 uMouse, uVel; uniform float uAspect, uFalloff, uAlpha, uDiss;
#ifdef ENC
vec3 dec(vec4 c){ return vec3(c.rg * 2. - 1., c.b); }
vec4 enc(vec3 f){ return vec4(f.rg * .5 + .5, clamp(f.b, 0., 1.), 1.); }
#else
vec3 dec(vec4 c){ return c.rgb; }
vec4 enc(vec3 f){ return vec4(f, 1.); }
#endif
void main(){
  vec3 f = dec(texture(uPrev, vUv)) * uDiss;
  vec2 d = vUv - uMouse; d.x *= uAspect;
  float fo = smoothstep(uFalloff, 0., length(d)) * uAlpha;
  f = mix(f, vec3(uVel, 1.), fo);
  o = enc(f);
}`;

const COMMON = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uImg, uFlow;
uniform vec2 uRes, uImgSize, uPos;
uniform float uTime, uStr, uZoom, uRadius, uAlpha;
vec3 flow(vec2 uv){
  vec4 c = texture(uFlow, uv);
#ifdef ENC
  return vec3(c.rg * 2. - 1., c.b);
#else
  return c.rgb;
#endif
}
vec2 cover(vec2 uv){
  float rs = uRes.x / uRes.y, ri = uImgSize.x / uImgSize.y;
  vec2 s = rs > ri ? vec2(1., ri / rs) : vec2(rs / ri, 1.);
  s /= uZoom;
  vec2 p = vec2(uPos.x, 1. - uPos.y);
  return (uv - .5) * s + .5 + (p - .5) * (1. - s);
}
float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
float corner(vec2 uv){
  if (uRadius <= 0.) return 1.;
  vec2 px = uv * uRes, h = uRes * .5;
  vec2 q = abs(px - h) - (h - uRadius);
  float d = length(max(q, 0.)) - uRadius;
  return 1. - smoothstep(-1., .5, d);
}
`;

const LIQUID_FS = COMMON + `
void main(){
  vec3 f = flow(vUv);
  vec2 uv = cover(vUv);
  vec2 off = f.xy * .045 * uStr;
  uv -= off;
  float split = length(f.xy) * .012 * uStr;
  vec2 dir = normalize(f.xy + 1e-5);
  vec3 col;
  col.r = texture(uImg, uv + dir * split).r;
  col.g = texture(uImg, uv).g;
  col.b = texture(uImg, uv - dir * split).b;
  col += f.z * .05 * uStr * vec3(1., .85, .6);
  col += (hash(vUv * uRes + uTime) - .5) * .035;
  o = vec4(col, 1.) * corner(vUv) * uAlpha;
}`;

const XRAY_FS = COMMON + `
uniform float uScan, uLens;
uniform vec2 uMouse;
float lum(vec2 uv){ return dot(texture(uImg, uv).rgb, vec3(.299, .587, .114)); }
vec3 drawing(vec2 uv, vec2 px){
  float tl = lum(uv + px * vec2(-1., 1.)), t = lum(uv + px * vec2(0., 1.)), tr = lum(uv + px * vec2(1., 1.));
  float l = lum(uv + px * vec2(-1., 0.)), r = lum(uv + px * vec2(1., 0.));
  float bl = lum(uv + px * vec2(-1., -1.)), b = lum(uv + px * vec2(0., -1.)), br = lum(uv + px * vec2(1., -1.));
  float gx = -tl - 2. * l - bl + tr + 2. * r + br;
  float gy = -tl - 2. * t - tr + bl + 2. * b + br;
  float e = smoothstep(.1, .5, length(vec2(gx, gy)));
  float base = lum(uv);
  vec3 ink = vec3(.02, .025, .035) + base * vec3(.03, .045, .07);
  // blueprint grid in screen space
  vec2 g = abs(fract(vUv * uRes / 48.) - .5);
  float grid = (1. - smoothstep(.0, .02, min(g.x, g.y))) * .05;
  return ink + grid * vec3(.86, .7, .42) + e * vec3(.86, .7, .42) * .85;
}
void main(){
  vec3 f = flow(vUv);
  vec2 uv = cover(vUv) - f.xy * .03 * uStr;
  vec2 px = 1.15 / uImgSize;
  vec3 photo = texture(uImg, uv).rgb;
  vec3 draw = drawing(uv, px);
  float sy = 1. - vUv.y;
  float jitter = (hash(vec2(floor(vUv.x * 90.), floor(uTime * 12.))) - .5) * .006;
  float edge = uScan <= 0. ? -1. : uScan >= 1. ? 2. : uScan + jitter;
  float m = step(sy, edge);
  // the lens around the pointer shows the other state
  vec2 d = (vUv - uMouse) * vec2(uRes.x / uRes.y, 1.);
  float lr = length(d);
  float lens = (1. - smoothstep(uLens - .004, uLens, lr)) * step(.001, uLens);
  m = mix(m, 1. - m, lens);
  vec3 col = mix(draw, photo, m);
  // scan line glow
  float band = exp(-pow((sy - edge) * uRes.y / 3.5, 2.)) * step(.002, uScan) * step(uScan, .998);
  float halo = exp(-abs(sy - edge) * uRes.y / 60.) * .25 * step(.002, uScan) * step(uScan, .998);
  col += (band + halo) * vec3(1., .82, .5);
  // lens ring
  float ring = exp(-pow((lr - uLens) * uRes.y / 1.2, 2.)) * step(.001, uLens);
  col += ring * vec3(1., .85, .55) * .9;
  col += (hash(vUv * uRes + uTime) - .5) * .03;
  o = vec4(col, 1.) * uAlpha;
}`;

export function gl2(canvas, opts = {}) {
  let gl = null;
  try { gl = canvas.getContext("webgl2", { antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: "high-performance", ...opts }); } catch (_) { gl = null; }
  return gl;
}

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
export function program(gl, fs, defs = "") {
  const p = gl.createProgram();
  const src = defs ? fs.replace("#version 300 es\n", "#version 300 es\n" + defs) : fs;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VS));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, src));
  gl.bindAttribLocation(p, 0, "aPos");
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}
function quad(gl) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const b = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  return vao;
}
export function texture(gl, img) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
  return t;
}
const ready = (img) => (img.complete && img.naturalWidth ? Promise.resolve() : img.decode ? img.decode() : new Promise((r, j) => { img.onload = r; img.onerror = j; }));

/* The pointer's wake: a 128² field of (velocity.xy, strength) */
class Flow {
  constructor(gl, vao) {
    this.gl = gl; this.vao = vao;
    const half = !!gl.getExtension("EXT_color_buffer_float");
    this.defs = half ? "" : "#define ENC 1\n";
    this.prog = program(gl, FLOW_FS, this.defs);
    this.size = 128;
    const mk = () => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      if (half) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, this.size, this.size, 0, gl.RGBA, gl.HALF_FLOAT, null);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.size, this.size, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(this.size * this.size * 4).fill(128));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      if (half) { gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
      return { t, fb };
    };
    this.a = mk(); this.b = mk();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.mouse = [0.5, 0.5]; this.vel = [0, 0]; this.alpha = 0;
  }
  get tex() { return this.a.t; }
  /* uv of the pointer (0..1, y up) and the canvas aspect; call once per frame */
  step(aspect, falloff = 0.22, diss = 0.955) {
    const gl = this.gl, { p, u } = this.prog;
    gl.useProgram(p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.b.fb);
    gl.viewport(0, 0, this.size, this.size);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.a.t);
    gl.uniform1i(u.uPrev, 0);
    gl.uniform2f(u.uMouse, this.mouse[0], this.mouse[1]);
    gl.uniform2f(u.uVel, this.vel[0], this.vel[1]);
    gl.uniform1f(u.uAspect, aspect);
    gl.uniform1f(u.uFalloff, falloff);
    gl.uniform1f(u.uAlpha, this.alpha);
    gl.uniform1f(u.uDiss, diss);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    [this.a, this.b] = [this.b, this.a];
    this.vel[0] *= 0.8; this.vel[1] *= 0.8; this.alpha *= 0.8;
  }
  /* feed a pointer move in uv units */
  push(u, v) {
    const dx = (u - this.mouse[0]) * 8, dy = (v - this.mouse[1]) * 8;
    this.mouse = [u, v];
    const len = Math.hypot(dx, dy);
    const k = len > 1 ? 1 / len : 1;
    this.vel = [dx * k, dy * k];
    this.alpha = Math.min(1, len * 4);
  }
  place(u, v) { this.mouse = [u, v]; }
}

function objPos(img) {
  const s = getComputedStyle(img).objectPosition.split(" ");
  const f = (v) => (v && v.endsWith("%") ? parseFloat(v) / 100 : 0.5);
  return [f(s[0]), f(s[1] || "50%")];
}

/* One picture in its own canvas (the canvas is sized to its parent box) */
export class Picture {
  constructor(canvas, img, mode = "liquid") {
    this.canvas = canvas; this.img = img; this.mode = mode;
    this.gl = gl2(canvas);
    this.ok = false;
    this.scan = 0; this.lens = 0; this.lensTo = 0; this.str = 1; this.alpha = 1; this.zoom = 1;
    this.mouse = [0.5, 0.5];
    if (!this.gl) return;
    const gl = this.gl;
    try {
      this.vao = quad(gl);
      this.flow = new Flow(gl, this.vao);
      this.prog = program(gl, mode === "xray" ? XRAY_FS : LIQUID_FS, this.flow.defs);
    } catch (e) { console.warn("[irtifa] shader", e); this.gl = null; return; }
    canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); this.ok = false; canvas.dispatchEvent(new CustomEvent("gl-lost", { bubbles: true })); });
    this.ready = ready(img).then(() => { this.tex = texture(gl, img); this.size = [img.naturalWidth, img.naturalHeight]; this.pos = objPos(img); this.ok = true; this.resize(); });
    this.ready.catch(() => {});
  }
  resize() {
    if (!this.gl) return;
    if (this.ok) this.pos = objPos(this.img);
    const dpr = Math.min(devicePixelRatio || 1, 1.75);
    const r = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, Math.round(r.width * dpr)); this.h = Math.max(1, Math.round(r.height * dpr));
    if (this.canvas.width !== this.w || this.canvas.height !== this.h) { this.canvas.width = this.w; this.canvas.height = this.h; }
  }
  /* pointer in client px */
  pointer(x, y) {
    const r = this.canvas.getBoundingClientRect();
    const u = (x - r.left) / r.width, v = 1 - (y - r.top) / r.height;
    this.mouse = [u, v];
    if (this.flow) this.flow.push(u, v);
  }
  draw(t) {
    if (!this.ok) return;
    const gl = this.gl, { p, u } = this.prog;
    this.lens += (this.lensTo - this.lens) * 0.12;
    this.flow.step(this.w / this.h);
    gl.viewport(0, 0, this.w, this.h);
    gl.useProgram(p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex); gl.uniform1i(u.uImg, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.flow.tex); gl.uniform1i(u.uFlow, 1);
    gl.uniform2f(u.uRes, this.w, this.h);
    gl.uniform2f(u.uImgSize, this.size[0], this.size[1]);
    gl.uniform2f(u.uPos, this.pos[0], this.pos[1]);
    gl.uniform1f(u.uTime, t * 0.001);
    gl.uniform1f(u.uStr, this.str);
    gl.uniform1f(u.uZoom, this.zoom);
    gl.uniform1f(u.uRadius, 0);
    gl.uniform1f(u.uAlpha, this.alpha);
    if (u.uScan) {
      gl.uniform1f(u.uScan, this.scan);
      gl.uniform1f(u.uLens, this.lens);
      gl.uniform2f(u.uMouse, this.mouse[0], this.mouse[1]);
    }
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  dispose() {
    const ext = this.gl && this.gl.getExtension("WEBGL_lose_context");
    if (ext) ext.loseContext();
    this.ok = false; this.gl = null;
  }
}

/* One fixed canvas for every hover picture on the page */
export class LensLayer {
  constructor() {
    const c = document.createElement("canvas");
    c.className = "lens";
    c.setAttribute("aria-hidden", "true");
    this.canvas = c;
    this.gl = gl2(c);
    if (!this.gl) return;
    document.body.appendChild(c);
    const gl = this.gl;
    try {
      this.vao = quad(gl);
      this.flow = new Flow(gl, this.vao);
      this.prog = program(gl, LIQUID_FS, this.flow.defs);
    } catch (e) { console.warn("[irtifa] lens", e); c.remove(); this.gl = null; return; }
    this.texs = new WeakMap();
    this.cur = null; this.str = 0; this.strTo = 0; this.zoom = 1; this.running = false; this.drawn = false;
    c.addEventListener("webglcontextlost", (e) => { e.preventDefault(); this.gl = null; this.release(); c.remove(); });
    this.resize();
    addEventListener("resize", () => this.resize());
  }
  get ok() { return !!this.gl; }
  resize() {
    if (!this.gl) return;
    this.dpr = Math.min(devicePixelRatio || 1, 1.75);
    this.canvas.width = Math.round(innerWidth * this.dpr);
    this.canvas.height = Math.round(innerHeight * this.dpr);
  }
  bind(el) {
    if (!this.gl || el._lens) return;
    el._lens = true;
    const img = el.querySelector("img");
    if (!img) return;
    el.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") this.enter(el, img, e); });
    el.addEventListener("pointermove", (e) => { if (this.cur === el) this.move(e); });
    el.addEventListener("pointerleave", () => { if (this.cur === el) this.strTo = 0; });
  }
  enter(el, img, e) {
    if (this.cur && this.cur !== el) this.release();
    this.cur = el; this.img = img; this.strTo = 1;
    const go = () => {
      if (this.cur !== el || !this.gl) return;
      let t = this.texs.get(img);
      if (!t) { t = { t: texture(this.gl, img), size: [img.naturalWidth, img.naturalHeight] }; this.texs.set(img, t); }
      this.tex = t;
      this.pos = objPos(img);
      this.radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      this.drawn = false;
      this.move(e, true);
      if (!this.running) { this.running = true; requestAnimationFrame((t) => this.frame(t)); }
    };
    ready(img).then(go, () => {});
  }
  move(e, place) {
    const r = this.cur.getBoundingClientRect();
    const u = (e.clientX - r.left) / r.width, v = 1 - (e.clientY - r.top) / r.height;
    if (place) this.flow.place(u, v); else this.flow.push(u, v);
  }
  release() {
    if (this.cur) this.cur.classList.remove("lensed");
    this.cur = null; this.tex = null; this.str = 0; this.strTo = 0; this.zoom = 1;
    if (this.gl) { const gl = this.gl; gl.viewport(0, 0, this.canvas.width, this.canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
  }
  frame(t) {
    if (!this.gl || !this.cur || !this.tex) { this.running = false; return; }
    this.str += (this.strTo - this.str) * 0.1;
    this.zoom += ((this.strTo ? 1.06 : 1) - this.zoom) * 0.08;
    if (this.strTo === 0 && this.str < 0.02 && Math.abs(this.zoom - 1) < 0.003) { this.release(); this.running = false; return; }
    const gl = this.gl, el = this.cur, r = el.getBoundingClientRect(), d = this.dpr;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    if (r.bottom < 0 || r.top > innerHeight) { this.strTo = 0; }
    const w = Math.round(r.width * d), h = Math.round(r.height * d);
    this.flow.step(w / h, 0.28, 0.95);
    gl.viewport(Math.round(r.left * d), Math.round((innerHeight - r.bottom) * d), w, h);
    const { p, u } = this.prog;
    gl.useProgram(p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex.t); gl.uniform1i(u.uImg, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.flow.tex); gl.uniform1i(u.uFlow, 1);
    gl.uniform2f(u.uRes, w, h);
    gl.uniform2f(u.uImgSize, this.tex.size[0], this.tex.size[1]);
    gl.uniform2f(u.uPos, this.pos[0], this.pos[1]);
    gl.uniform1f(u.uTime, t * 0.001);
    gl.uniform1f(u.uStr, 1.4 * this.str);
    gl.uniform1f(u.uZoom, this.zoom);
    gl.uniform1f(u.uRadius, this.radius * d);
    gl.uniform1f(u.uAlpha, 1);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (!this.drawn) { this.drawn = true; el.classList.add("lensed"); }
    requestAnimationFrame((tt) => this.frame(tt));
  }
}
