/* Huzur · home. Scenes take --p from the scroll; the descent draws the Levan fly-over frame by frame under a WebGL
   cloud layer that parts as you scroll; the homes explorer, the four moments, the amenities list and the sideways
   chapter are wired here. Everything degrades: no WebGL → CSS haze; reduced motion → still scenes, no autoplay. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const U = window.UZM || {};
const doc = document.documentElement;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

/* ── Scenes: --p from 0 (top of the scene at the top of the screen) to 1 (its end) ── */
const scenes = $$("[data-scene]").map((el) => ({ el, top: 0, len: 1, p: -1, on: [] }));
const byId = (id) => scenes.find((s) => s.el.id === id);
function measure() {
  for (const s of scenes) {
    const r = s.el.getBoundingClientRect();
    s.top = r.top + scrollY;
    s.len = Math.max(1, s.el.offsetHeight - innerHeight);
  }
}
function tick() {
  const y = scrollY;
  for (const s of scenes) {
    const p = clamp((y - s.top) / s.len);
    if (Math.abs(p - s.p) < 1e-4) continue;
    s.p = p;
    if (!reduced) s.el.style.setProperty("--p", p.toFixed(4));
    s.on.forEach((f) => f(p));
  }
}
let queued = false;
const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; tick(); }); } };
addEventListener("scroll", schedule, { passive: true });
addEventListener("resize", () => { measure(); fitSlow(); measure(); schedule(); });

/* ── 0 · The descent ── */
const fly = $(".fly"), flyScene = byId("ust");
const frameCanvas = $(".fly-frames"), fctx = frameCanvas.getContext("2d");
const tall = () => innerWidth / innerHeight < 0.8;
const N = 114;
let set = tall() ? "fly-p" : "fly";
let frames = [], current = -1, want = 0;
function loadFrames() {
  frames = new Array(N).fill(null);
  const order = [];
  for (const stepN of [16, 8, 4, 2, 1]) for (let i = 0; i < N; i += stepN) if (!order.includes(i)) order.push(i);
  let next = 0;
  const base = `${U.root}assets/seq/${set}/`;
  const thisSet = set;
  const pump = () => {
    if (next >= order.length || thisSet !== set) return;
    const i = order[next++];
    const im = new Image();
    im.decoding = "async";
    im.onload = () => { if (thisSet !== set) return; frames[i] = im; if (Math.abs(i - want) < 3 || current < 0) draw(true); pump(); };
    im.onerror = pump;
    im.src = base + String(i + 1).padStart(3, "0") + ".webp";
  };
  for (let k = 0; k < 5; k++) pump();
}
function sizeCanvas() {
  const dpr = Math.min(1.5, devicePixelRatio || 1);
  frameCanvas.width = Math.round(innerWidth * dpr);
  frameCanvas.height = Math.round(innerHeight * dpr);
  current = -1;
  draw(true);
}
function draw(force) {
  // nearest loaded frame to the one the scroll wants
  let i = want, best = -1;
  for (let d = 0; d < N; d++) { if (frames[i - d]) { best = i - d; break; } if (frames[i + d]) { best = i + d; break; } }
  if (best < 0 || (best === current && !force)) return;
  current = best;
  const im = frames[best], W = frameCanvas.width, H = frameCanvas.height;
  const s = Math.max(W / im.naturalWidth, H / im.naturalHeight);
  const w = im.naturalWidth * s, h = im.naturalHeight * s;
  fctx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
  fly.classList.add("live");
}
const notes = $$(".fly-notes li").map((li) => ({ li, a: +li.dataset.at.split(" ")[0], b: +li.dataset.at.split(" ")[1] }));
flyScene.on.push((p) => {
  want = Math.round(clamp((p - 0.1) / 0.8) * (N - 1));
  draw(false);
  notes.forEach((n) => n.li.classList.toggle("on", p >= n.a && p < n.b));
  // the header reads dark over the clouds, light over the land
  const dark = p > 0.13;
  if ((fly.dataset.hdr === "light") !== dark) { fly.dataset.hdr = dark ? "light" : "clouds"; U.refreshHeader && U.refreshHeader(); }
  clouds && clouds.set(clamp(p / 0.2));
});
fly.dataset.hdr = "clouds";
U.refreshHeader && U.refreshHeader();

/* Clouds: two octaves of drifting fbm noise; the camera flies forward into them and a hole opens in the middle */
const clouds = (() => {
  const cv = $(".clouds");
  const gl = cv.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl) { doc.classList.add("no-clouds"); return null; }
  const vs = "attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }";
  const fs = `precision mediump float;
uniform vec2 uR; uniform float uT; uniform float uP;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1.0, 0.0)), u.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), u.x), u.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 6; i++) { v += a * n(p); p = m * p; a *= 0.5; } return v; }
void main(){
  vec2 uv = gl_FragCoord.xy / uR; vec2 c = uv - 0.5; c.x *= uR.x / uR.y;
  float z = 1.0 + uP * 2.6;
  vec2 q = c / z;
  float t = uT * 0.02;
  float d1 = fbm(q * 2.0 + vec2(t, t * 0.35) + 4.0);
  float d2 = fbm(q * 4.2 - vec2(t * 1.5, -t * 0.25) + d1 * 1.4);
  float dens = smoothstep(0.26, 0.76, d1 * 0.62 + d2 * 0.52);
  float clear = smoothstep(0.0, 1.0, uP);
  float r0 = mix(-1.0, 1.5, clear);
  float hole = smoothstep(r0, r0 + 0.55, length(c) + (d1 - 0.5) * 0.5);
  float fog = 0.6 * (1.0 - smoothstep(0.0, 0.7, clear));
  float a = clamp(fog + dens * 0.96, 0.0, 1.0) * hole * (1.0 - smoothstep(0.88, 1.0, clear));
  vec3 lit = vec3(0.985, 0.975, 0.955), shade = vec3(0.74, 0.735, 0.73);
  vec3 col = mix(shade, lit, smoothstep(0.25, 0.85, d2 + uv.y * 0.25));
  gl_FragColor = vec4(col * a, a);
}`;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { doc.classList.add("no-clouds"); return null; }
  gl.useProgram(pr);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, "a"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uR = gl.getUniformLocation(pr, "uR"), uT = gl.getUniformLocation(pr, "uT"), uP = gl.getUniformLocation(pr, "uP");
  let p = 0, running = false, t0 = performance.now(), visible = true;
  const size = () => { const k = 0.5; cv.width = Math.round(innerWidth * k); cv.height = Math.round(innerHeight * k); gl.viewport(0, 0, cv.width, cv.height); render(); };
  const render = () => {
    gl.uniform2f(uR, cv.width, cv.height);
    gl.uniform1f(uT, reduced ? 12 : (performance.now() - t0) / 1000);
    gl.uniform1f(uP, p);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const loop = () => { if (!running) return; render(); requestAnimationFrame(loop); };
  const update = () => {
    const should = !reduced && visible && p < 1 && !document.hidden;
    if (should && !running) { running = true; requestAnimationFrame(loop); }
    if (!should) { running = false; render(); }
  };
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; update(); }).observe(fly);
  document.addEventListener("visibilitychange", update);
  addEventListener("resize", size);
  size(); update();
  return { set(v) { p = v; cv.style.visibility = p >= 1 ? "hidden" : ""; if (!running) render(); update(); } };
})();

/* ── 2 · Explore the homes ── */
(() => {
  const sec = $(".explore"); if (!sec) return;
  const map = $(".ex-map", sec), polys = $$(".ex-zones polygon", sec), chip = $(".ex-chip", sec), btns = $$(".ex-types button", sec);
  const sheet = $(".ex-sheet", sec), paper = $(".ex-paper img", sec), tabs = $(".ex-tabs", sec);
  const centres = [[0.27, 0.32], [0.55, 0.78], [0.35, 0.83]];
  let open = null;
  const zone = (z, label) => {
    polys.forEach((pg) => pg.classList.toggle("on", z !== null && pg.dataset.z === String(z)));
    map.classList.toggle("focus", z !== null);
    if (z === null) { chip.classList.remove("on"); return; }
    chip.textContent = label;
    chip.style.left = centres[z][0] * 100 + "%";
    chip.style.top = centres[z][1] * 100 * (1120 / 1120) + "%";
    chip.classList.add("on");
  };
  const typeOf = (k) => (U.TYPES || []).find((t) => t.key === k);
  const showSheet = (t, i) => {
    const s = t.sheets[i];
    paper.src = s.src; paper.width = s.w; paper.height = s.h; paper.alt = t.title + " kat planı, " + s.label;
    $$("button", tabs).forEach((b, j) => { b.setAttribute("aria-selected", String(i === j)); b.tabIndex = i === j ? 0 : -1; });
  };
  const openType = (b) => {
    const t = typeOf(b.dataset.type); if (!t) return;
    open = b;
    btns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    $(".ex-kind", sec).textContent = t.kind === "daire" ? "Daire · A, B ve C blokları" : t.kind === "malikane" ? "Malikane" : "Villa";
    $(".ex-name", sec).textContent = t.title;
    $(".ex-blurb", sec).textContent = t.blurb;
    $(".ex-areas", sec).innerHTML = `<div><dt>Net</dt><dd class="num">${t.net} m²</dd></div><div><dt>Brüt</dt><dd class="num">${t.gross} m²</dd></div>` + (t.garden ? `<div><dt>Bahçe</dt><dd class="num">${t.garden} m²</dd></div>` : "");
    tabs.innerHTML = "";
    tabs.hidden = t.sheets.length < 2;
    t.sheets.forEach((s, i) => {
      const x = document.createElement("button");
      x.type = "button"; x.setAttribute("role", "tab"); x.textContent = s.label;
      x.addEventListener("click", () => showSheet(t, i));
      x.addEventListener("keydown", (e) => { const k = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0; if (!k) return; const n = (i + k + t.sheets.length) % t.sheets.length; showSheet(t, n); $$("button", tabs)[n].focus(); });
      tabs.appendChild(x);
    });
    showSheet(t, 0);
    $(".ex-full", sec).onclick = (e) => U.openPlan({ title: t.title, sheets: t.sheets, start: $$("button", tabs).findIndex((x) => x.getAttribute("aria-selected") === "true") || 0 }, e.currentTarget);
    sheet.hidden = false;
    sec.classList.add("sheet-on");
    $(".ex-name", sec).focus({ preventScroll: true });
  };
  const close = () => {
    sheet.hidden = true; sec.classList.remove("sheet-on");
    btns.forEach((x) => x.setAttribute("aria-pressed", "false"));
    zone(null);
    if (open) open.focus({ preventScroll: true });
    open = null;
  };
  btns.forEach((b) => {
    const label = $("span", b).textContent;
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("pointerenter", () => { if (!open) zone(+b.dataset.z, label); });
    b.addEventListener("focus", () => { if (!open) zone(+b.dataset.z, label); });
    b.addEventListener("pointerleave", () => { if (!open) zone(null); });
    b.addEventListener("blur", () => { if (!open) zone(null); });
    b.addEventListener("click", () => { if (open === b) close(); else openType(b); });
  });
  $(".ex-back", sec).addEventListener("click", close);
  sec.addEventListener("keydown", (e) => { if (e.key === "Escape" && open && !document.querySelector("dialog[open]")) close(); });
  // the paper sheet leans back a touch as it scrolls into place
  const pp = $(".ex-paper", sec);
  if (!reduced) addEventListener("scroll", () => { if (!open) return; const r = pp.getBoundingClientRect(); pp.style.setProperty("--tilt", clamp((r.top - innerHeight * 0.2) / innerHeight, -0.5, 1) * 10); }, { passive: true });
})();

/* ── 4 · Four moments: films play only while seen, never under reduced motion; one switch stops them ── */
(() => {
  const vids = $$(".moments video"), toggle = $(".motion-toggle");
  let stopped = reduced;
  const seen = new Set();
  const apply = () => vids.forEach((v) => { if (!stopped && seen.has(v)) { if (!v.src) v.src = v.dataset.src; v.play().catch(() => {}); } else v.pause(); });
  const io = new IntersectionObserver((es) => { es.forEach((e) => (e.isIntersecting ? seen.add(e.target) : seen.delete(e.target))); apply(); }, { rootMargin: "80px" });
  vids.forEach((v) => io.observe(v));
  if (toggle) {
    toggle.setAttribute("aria-pressed", String(stopped));
    toggle.textContent = stopped ? "Hareketi başlatın" : "Hareketi durdurun";
    toggle.addEventListener("click", () => { stopped = !stopped; toggle.setAttribute("aria-pressed", String(stopped)); toggle.textContent = stopped ? "Hareketi başlatın" : "Hareketi durdurun"; apply(); });
  }
})();

/* ── 5 · Amenities: the picture follows the list ── */
(() => {
  const items = $$(".amen-list li"), pics = $$(".amen-pic img");
  const show = (li) => {
    items.forEach((x) => x.classList.toggle("on", x === li));
    const k = li.dataset.k; if (!k) return;
    pics.forEach((im) => im.classList.toggle("on", im.dataset.k === k));
  };
  items.forEach((li) => li.addEventListener("pointerenter", () => show(li)));
  // on touch, the item crossing the middle of the screen leads
  if (matchMedia("(hover: none)").matches) {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && show(e.target)), { rootMargin: "-45% 0px -45% 0px" });
    items.forEach((li) => io.observe(li));
  }
  if (items[0]) show(items[0]);
})();

/* ── 6 · Sideways ── */
const slow = $(".slow"), track = $(".slow-track");
// the strip only scrolls by itself (and needs to take focus) when the page doesn't drive it
if (!reduced) $(".slow-pin")?.removeAttribute("tabindex");
let slowMax = 0;
function fitSlow() {
  if (!slow || reduced) return;
  slowMax = Math.max(0, track.scrollWidth - innerWidth);
  slow.style.setProperty("--slow-h", `${slowMax + innerHeight * 1.2}px`);
}
byId("huzur")?.on.push((p) => {
  slow.style.setProperty("--x", (p * slowMax).toFixed(1));
  $$(".slow-p", slow).forEach((el, i) => el.style.setProperty("--px", ((p * 5 - i) * -18).toFixed(1)));
});

/* ── 8 · Diary strip: drag to scroll with a mouse ── */
(() => {
  const strip = $(".diary-strip"); if (!strip) return;
  let down = null;
  strip.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") return; down = { x: e.clientX, s: strip.scrollLeft, moved: false }; });
  addEventListener("pointermove", (e) => { if (!down) return; const dx = e.clientX - down.x; if (Math.abs(dx) > 4) down.moved = true; strip.scrollLeft = down.s - dx; });
  addEventListener("pointerup", () => { if (down && down.moved) strip.addEventListener("click", (e) => e.stopPropagation(), { capture: true, once: true }); down = null; });
})();

/* ── Start ── */
loadFrames();
sizeCanvas();
addEventListener("resize", () => {
  const s = tall() ? "fly-p" : "fly";
  if (s !== set) { set = s; loadFrames(); }
  sizeCanvas();
});
fitSlow();
measure();
tick();
document.fonts?.ready.then(() => { fitSlow(); measure(); tick(); });
addEventListener("load", () => { fitSlow(); measure(); tick(); });
window.__huzur = { scenes, frames: () => frames.filter(Boolean).length };
