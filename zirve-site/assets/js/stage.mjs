/* Zirve · the WebGL stage. One canvas, one context per page, fixed behind the page. Every element marked data-gl gets
   its scene, drawn in sync with its DOM box inside the shared loop (site.js runs it):

     hero     a hero picture or film, refracted by the cursor's liquid trail
     img      a picture: chrome wipe on arrival, ripple on hover, light splitting with scroll speed (data-ripple: water)
     strip    a picture in the curved gallery (bends with the drag)
     develop  a site photograph that develops from silver to colour as it rises
     seq      a pinned sequence of pictures dissolving into one another
     cloud    the aerial render as ~50k points that turn into the site plan, then scatter or give way to the crisp plan
     aerial   day and night over the same aerial, divided by a liquid border
     mark     the UZM mark gathering from dust; points shy from the cursor
     scatter  the 404's digits, which come apart under the cursor and on a click
     amen     the picture that follows the cursor over the amenity list

   It renders only while something of its own is on screen, stops when the tab is hidden, caps the pixel ratio, and
   does nothing at all with reduced motion, Save-Data, or without WebGL: the page underneath is complete. */
import { QUAD_VS, FLAT_VS, TRAIL_FS, PLANE_VS, IMG_FS, HERO_FS, SEQ_FS, AERIAL_FS, AMEN_VS, AMEN_FS, PTS_VS, PTS_FS } from "./shaders.mjs";

const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js";
const root = document.documentElement;
const ready = () => (window.Z ? Promise.resolve(window.Z) : new Promise((r) => addEventListener("DOMContentLoaded", () => r(window.Z), { once: true })));

async function main() {
  const Z = await ready();
  if (!Z || Z.reduced || (navigator.connection && navigator.connection.saveData)) return void root.classList.add("no-gl");
  const targets = [...document.querySelectorAll("[data-gl]")];
  if (!targets.length) return;
  let T;
  try { T = await import(THREE_URL); } catch (e) { return void root.classList.add("no-gl"); }
  T.ColorManagement.enabled = false;

  const { clamp, lerp, smooth, cubicOut } = Z;
  const canvas = document.createElement("canvas");
  canvas.id = "gl";
  canvas.setAttribute("aria-hidden", "true");
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" }); }
  catch (e) { return void root.classList.add("no-gl"); }
  document.body.prepend(canvas);

  let vw = innerWidth, vh = innerHeight, dead = false;
  const small = Z.small();
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(dpr);
  renderer.setSize(vw, vh, false);
  renderer.setClearColor(0x08080a, 1);
  const scene = new T.Scene();
  const FOV = 35;
  const camera = new T.PerspectiveCamera(FOV, vw / vh, 10, 20000);
  const camDist = () => vh / 2 / Math.tan((FOV * Math.PI) / 360);
  camera.position.z = camDist();
  const uScreen = { value: new T.Vector2(vw * dpr, vh * dpr) };
  const uTime = { value: 0 };
  const uTrail = { value: null };
  const t0 = performance.now();
  const loader = new T.TextureLoader();
  const loadTex = (src) => new Promise((res) => loader.load(src, (t) => { t.anisotropy = 4; res(t); }, undefined, () => res(null)));
  const texSize = (t) => new T.Vector2(t.image.videoWidth || t.image.naturalWidth || t.image.width || 1, t.image.videoHeight || t.image.naturalHeight || t.image.height || 1);
  const imgEl = (src) => new Promise((res, rej) => { const i = new Image(); i.decoding = "async"; i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const focusOf = (img) => {
    const op = (img && (img.style.objectPosition || getComputedStyle(img).objectPosition)) || "50% 50%";
    const m = op.match(/([\d.]+)%\s+([\d.]+)%/);
    return m ? new T.Vector2(+m[1] / 100, 1 - +m[2] / 100) : new T.Vector2(0.5, 0.5);
  };
  /* A <picture>'s chosen file, without waiting for a lazy image to load. */
  const pick = (img) => {
    const pic = img.parentElement && img.parentElement.tagName === "PICTURE" ? img.parentElement : null;
    if (pic) for (const s of pic.querySelectorAll("source")) if (!s.media || matchMedia(s.media).matches) return new URL(s.getAttribute("srcset"), location.href).href;
    return img.currentSrc || img.src;
  };

  /* Cursor trail: a small ping-pong texture the pictures read as a liquid displacement (fine pointers only). */
  const TR = 160;
  const rtOpt = { minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: false, type: T.UnsignedByteType };
  let rtA = new T.WebGLRenderTarget(TR, TR, rtOpt), rtB = new T.WebGLRenderTarget(TR, TR, rtOpt);
  [rtA, rtB].forEach((rt) => { renderer.setRenderTarget(rt); renderer.setClearColor(0x808080, 1); renderer.clear(); });
  renderer.setRenderTarget(null); renderer.setClearColor(0x08080a, 1);
  const trailMat = new T.ShaderMaterial({ uniforms: { uPrev: { value: rtA.texture }, uMouse: { value: new T.Vector2(0.5, 0.5) }, uMV: { value: new T.Vector2() }, uAspect: { value: vw / vh }, uOn: { value: 0 } }, vertexShader: QUAD_VS, fragmentShader: TRAIL_FS, depthTest: false, depthWrite: false });
  const trailScene = new T.Scene(), trailCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  trailScene.add(new T.Mesh(new T.PlaneGeometry(2, 2), trailMat));
  uTrail.value = rtA.texture;

  const geo = new T.PlaneGeometry(1, 1, 24, 12);
  const quad = new T.PlaneGeometry(1, 1, 1, 1);
  const mat = (vs, fs, uniforms) => new T.ShaderMaterial({ uniforms, vertexShader: vs, fragmentShader: fs, transparent: true, depthTest: false, depthWrite: false });
  const place = (mesh, r) => { mesh.position.set(r.left + r.width / 2 - vw / 2, vh / 2 - r.top - r.height / 2, 0); mesh.scale.set(r.width, r.height, 1); };
  const onScreen = (r, m = 60) => r.width > 0 && r.bottom > -m && r.top < vh + m && r.right > -m && r.left < vw + m;
  const items = [];
  let order = 2;

  const near = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { near.unobserve(e.target); e.target._load && e.target._load(); } }), { rootMargin: "150% 0px 150% 0px" });
  const seen = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { seen.unobserve(e.target); e.target._seenAt = performance.now(); } }), { threshold: 0.12 });
  const hoverable = (el, it) => { if (Z.fine) { el.addEventListener("pointerenter", () => (it.hoverT = 1)); el.addEventListener("pointerleave", () => (it.hoverT = 0)); } };

  /* ── Hero */
  function hero(el) {
    const img = el.querySelector("img"), video = el.querySelector("video");
    const u = { uVideo: { value: null }, uPoster: { value: null }, uTrail, uVidRes: { value: new T.Vector2(1920, 810) }, uPosRes: { value: new T.Vector2(1, 1) }, uRes: { value: new T.Vector2(1, 1) }, uScreen, uMix: { value: 0 }, uTime, uVel: { value: 0 }, uIntro: { value: 0 }, uProg: { value: 0 }, uFocus: { value: focusOf(img) } };
    const mesh = new T.Mesh(quad, mat(FLAT_VS, HERO_FS, u));
    mesh.renderOrder = 0; mesh.visible = false; scene.add(mesh);
    const it = { el, ready: false, readyAt: 0, skipIntro: false };
    loadTex(pick(img)).then((t) => {
      if (!t || dead) return;
      u.uPoster.value = t; u.uPosRes.value = texSize(t);
      it.ready = true; it.readyAt = performance.now();
      it.skipIntro = Z.introAt && it.readyAt - Z.introAt > 350;
      el.classList.add("gl-ready");
    });
    let vidOn = false;
    if (video) {
      const on = () => { vidOn = true; if (!u.uVideo.value) u.uVideo.value = new T.VideoTexture(video); u.uVidRes.value.set(video.videoWidth || 1920, video.videoHeight || 810); };
      video.addEventListener("playing", on);
      if (video.readyState >= 3 && !video.paused) on();
    }
    it.tick = (now, dt) => {
      if (!it.ready) return false;
      const r = el.getBoundingClientRect();
      const vis = onScreen(r, 0);
      mesh.visible = vis;
      if (!vis) return false;
      place(mesh, r);
      u.uRes.value.set(r.width, r.height);
      u.uMix.value = clamp(u.uMix.value + (vidOn && video.readyState >= 2 ? 1 : -1) * (dt / 900), 0, 1);
      u.uIntro.value = it.skipIntro ? 1 : Z.introAt ? cubicOut((now - Z.introAt) / 2400) : 0;
      u.uProg.value = clamp(-r.top / r.height, 0, 1);
      u.uVel.value = Z.vel;
      return true;
    };
    items.push(it);
  }

  /* ── Picture planes: img, strip, develop */
  function plane(el, kind) {
    const img = el.querySelector("img");
    if (!img) return;
    const strip = kind === "strip", dev = kind === "develop";
    const u = { uTex: { value: null }, uTrail, uTexRes: { value: new T.Vector2(1, 1) }, uRes: { value: new T.Vector2(1, 1) }, uScreen, uTime, uVel: { value: 0 }, uDrag: { value: 0 }, uCurve: { value: strip ? (small ? 0.00022 : 0.00012) : 0 }, uReveal: { value: 0 }, uHover: { value: 0 }, uPar: { value: 0 }, uDev: { value: dev ? 0 : 1 }, uRipple: { value: +(el.dataset.ripple || 0) }, uArch: { value: el.hasAttribute("data-arch") ? 1 : 0 }, uFocus: { value: focusOf(img) } };
    const mesh = new T.Mesh(geo, mat(PLANE_VS, IMG_FS, u));
    mesh.visible = false; mesh.renderOrder = order++; scene.add(mesh);
    const it = { el, ready: false, readyAt: 0, hover: 0, hoverT: 0, stripEl: strip ? el.closest("[data-strip]") : null, instant: false };
    el._load = () => loadTex(img.currentSrc || img.src).then((t) => {
      if (!t || dead) return;
      u.uTex.value = t; u.uTexRes.value = texSize(t);
      it.ready = true; it.readyAt = performance.now();
      const r = el.getBoundingClientRect();
      /* A picture someone is already looking at doesn't vanish to play its entrance again. */
      if (onScreen(r, 0) && it.readyAt - t0 > 1200) { it.instant = true; u.uReveal.value = 1; u.uDev.value = 1; }
      el.classList.add("gl-ready");
    });
    near.observe(el); seen.observe(el);
    hoverable(el, it);
    it.tick = (now) => {
      if (!it.ready) return false;
      const r = el.getBoundingClientRect();
      const vis = onScreen(r);
      mesh.visible = vis;
      if (!vis) return false;
      place(mesh, r);
      u.uRes.value.set(r.width, r.height);
      if (!it.instant && el._seenAt && u.uReveal.value < 1) u.uReveal.value = cubicOut((now - Math.max(el._seenAt, it.readyAt)) / 1900);
      it.hover = lerp(it.hover, it.hoverT, 0.07); u.uHover.value = it.hover;
      u.uPar.value = clamp((r.top + r.height / 2 - vh / 2) / vh, -1, 1);
      u.uVel.value = Z.vel;
      if (it.stripEl) u.uDrag.value = clamp(it.stripEl._v || 0, -60, 60);
      if (dev && !it.instant) u.uDev.value = Math.max(u.uDev.value, smooth(vh * 0.95, vh * 0.35, r.top + r.height * 0.3));
      return true;
    };
    items.push(it);
  }

  /* ── Pinned sequence */
  function seq(el) {
    const sec = el.closest("[data-seq]");
    const imgs = [...el.querySelectorAll("img")];
    const tex = [];
    const u = { uA: { value: null }, uB: { value: null }, uTrail, uARes: { value: new T.Vector2(1, 1) }, uBRes: { value: new T.Vector2(1, 1) }, uRes: { value: new T.Vector2(1, 1) }, uScreen, uT: { value: 0 }, uTime };
    const mesh = new T.Mesh(quad, mat(FLAT_VS, SEQ_FS, u));
    mesh.visible = false; mesh.renderOrder = 1; scene.add(mesh);
    const it = { el, ready: false };
    el._load = () => imgs.forEach((im, i) => loadTex(im.currentSrc || im.src).then((t) => {
      tex[i] = t;
      if (!it.ready && tex[0] && tex[1]) { it.ready = true; el.classList.add("gl-ready"); }
    }));
    near.observe(el);
    it.tick = () => {
      const s = sec && sec._seq;
      if (!it.ready || !s) return false;
      const r = el.getBoundingClientRect();
      const a = tex[s.i], b = tex[Math.min(imgs.length - 1, s.i + 1)];
      const vis = onScreen(r, 0) && a && b;
      mesh.visible = !!vis;
      if (!vis) return false;
      place(mesh, r);
      u.uA.value = a; u.uARes.value = texSize(a);
      u.uB.value = b; u.uBRes.value = texSize(b);
      u.uT.value = s.t; u.uRes.value.set(r.width, r.height);
      return true;
    };
    items.push(it);
  }

  /* ── The projector: a liquid dissolve from the last picture to the one just chosen */
  function slides(el) {
    const imgs = [...el.querySelectorAll("img")];
    const tex = [];
    const u = { uA: { value: null }, uB: { value: null }, uTrail, uARes: { value: new T.Vector2(1, 1) }, uBRes: { value: new T.Vector2(1, 1) }, uRes: { value: new T.Vector2(1, 1) }, uScreen, uT: { value: 1 }, uTime };
    const mesh = new T.Mesh(quad, mat(FLAT_VS, SEQ_FS, u));
    mesh.visible = false; mesh.renderOrder = order++; scene.add(mesh);
    const it = { el, ready: false };
    el._load = () => imgs.forEach((im, i) => loadTex(im.currentSrc || im.src).then((t) => {
      tex[i] = t;
      if (!it.ready && t && i === 0) { it.ready = true; el.classList.add("gl-ready"); }
    }));
    near.observe(el);
    it.tick = (now) => {
      if (!it.ready) return false;
      const r = el.getBoundingClientRect();
      const vis = onScreen(r);
      mesh.visible = vis;
      if (!vis) return false;
      const s = el._s || { a: 0, b: 0, t0: 0 };
      const B = tex[s.b] || tex[s.a] || tex[0], A = tex[s.a] || B;
      const k = s.t0 && tex[s.b] ? clamp((now - s.t0) / 1300, 0, 1) : 1;
      place(mesh, r);
      u.uA.value = A; u.uARes.value = texSize(A); u.uB.value = B; u.uBRes.value = texSize(B);
      u.uT.value = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      u.uRes.value.set(r.width, r.height);
      return true;
    };
    items.push(it);
  }

  /* ── Day and night over the aerial */
  function aerial(el) {
    const day = el.querySelector(".aerial-day"), night = el.querySelector(".aerial-night img");
    const u = { uA: { value: null }, uB: { value: null }, uTrail, uARes: { value: new T.Vector2(1, 1) }, uBRes: { value: new T.Vector2(1, 1) }, uRes: { value: new T.Vector2(1, 1) }, uScreen, uX: { value: 0.5 }, uTime };
    const mesh = new T.Mesh(quad, mat(FLAT_VS, AERIAL_FS, u));
    mesh.visible = false; mesh.renderOrder = order++; scene.add(mesh);
    const it = { el, ready: false };
    el._load = () => Promise.all([loadTex(day.currentSrc || day.src), loadTex(night.currentSrc || night.src)]).then(([a, b]) => {
      if (!a || !b || dead) return;
      u.uA.value = a; u.uARes.value = texSize(a); u.uB.value = b; u.uBRes.value = texSize(b);
      it.ready = true; el.classList.add("gl-ready");
    });
    near.observe(el);
    it.tick = () => {
      if (!it.ready) return false;
      const r = el.getBoundingClientRect();
      const vis = onScreen(r);
      mesh.visible = vis;
      if (!vis) return false;
      place(mesh, r);
      u.uRes.value.set(r.width, r.height);
      u.uX.value = (el._x == null ? 50 : el._x) / 100;
      return true;
    };
    items.push(it);
  }

  /* ── Particles */
  function makePoints(n, fill) {
    const pos = new Float32Array(n * 3), plan = new Float32Array(n * 3), start = new Float32Array(n * 3), col = new Float32Array(n * 3), colB = new Float32Array(n * 3), rnd = new Float32Array(n * 4);
    fill(pos, plan, start, col, colB, rnd);
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(pos, 3));
    g.setAttribute("aPlan", new T.BufferAttribute(plan, 3));
    g.setAttribute("aStart", new T.BufferAttribute(start, 3));
    g.setAttribute("aColor", new T.BufferAttribute(col, 3));
    g.setAttribute("aColorB", new T.BufferAttribute(colB, 3));
    g.setAttribute("aRand", new T.BufferAttribute(rnd, 4));
    const u = { uA: { value: 0 }, uM: { value: 0 }, uG: { value: 0 }, uR: { value: 0 }, uD: { value: 0 }, uBurst: { value: 0 }, uTime, uSize: { value: 3 }, uDpr: { value: dpr }, uCam: { value: camDist() }, uRepel: { value: 0 }, uRad: { value: 0.006 }, uMouse: { value: new T.Vector2(9, 9) } };
    const m = new T.ShaderMaterial({ uniforms: u, vertexShader: PTS_VS, fragmentShader: PTS_FS, transparent: true, depthTest: false, depthWrite: false });
    const pts = new T.Points(g, m);
    pts.frustumCulled = false; pts.visible = false; pts.renderOrder = 50;
    scene.add(pts);
    return { pts, u };
  }
  const dust = (start, rnd, k) => {
    const a = Math.random() * Math.PI * 2, rr = 0.5 + Math.random() * 0.95;
    start[k * 3] = Math.cos(a) * rr; start[k * 3 + 1] = (Math.random() - 0.5) * 0.85; start[k * 3 + 2] = Math.sin(a) * rr * 0.8;
    rnd[k * 4] = Math.random(); rnd[k * 4 + 1] = Math.random(); rnd[k * 4 + 2] = Math.random(); rnd[k * 4 + 3] = Math.random();
  };
  const sample = (img, W, H, sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight) => {
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const g = cv.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
    return g.getImageData(0, 0, W, H).data;
  };
  const pointer = (pts, cx, cy, s) => pts.u.uMouse.value.set((Z.mx - cx) / s, (cy - Z.my) / s);

  /* The aerial turns into the plan. */
  function cloud(el) {
    const sec = el.closest("[data-cloud]");
    const end = (sec && sec.dataset.end) || "disperse";
    const it = { el, ready: false };
    let P = null, W = 0, lastR = -1;
    el._load = async () => {
      try {
        const [ia, ib] = await Promise.all([imgEl(el.dataset.a), imgEl(el.dataset.b)]);
        W = small ? 170 : 290;
        const cropY = ia.naturalHeight * 0.06, aw = ia.naturalWidth, ah = ia.naturalHeight - cropY;
        const H = Math.round((W * ah) / aw), BA = ib.naturalHeight / ib.naturalWidth;
        const da = sample(ia, W, H, 0, cropY, aw, ah), db = sample(ib, W, H);
        P = makePoints(W * H, (pos, plan, start, col, colB, rnd) => {
          for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
            const k = j * W + i, o = k * 4;
            const r = da[o] / 255, g = da[o + 1] / 255, b = da[o + 2] / 255, lum = 0.299 * r + 0.587 * g + 0.114 * b;
            const u = i / (W - 1) - 0.5, v = j / (H - 1) - 0.5;
            pos[k * 3] = u; pos[k * 3 + 1] = -v * (H / W); pos[k * 3 + 2] = (lum - 0.45) * 0.075 + (Math.random() - 0.5) * 0.004;
            const R = db[o] / 255, G = db[o + 1] / 255, B = db[o + 2] / 255;
            plan[k * 3] = u + (Math.random() - 0.5) * 0.0015; plan[k * 3 + 1] = -v * BA + (Math.random() - 0.5) * 0.002; plan[k * 3 + 2] = Math.max(0, G - Math.max(R, B)) * 0.05;
            col[k * 3] = Math.min(1, r * 1.08); col[k * 3 + 1] = Math.min(1, g * 1.08); col[k * 3 + 2] = Math.min(1, b * 1.08);
            colB[k * 3] = Math.min(1, R * 1.1); colB[k * 3 + 1] = Math.min(1, G * 1.1); colB[k * 3 + 2] = Math.min(1, B * 1.1);
            dust(start, rnd, k);
          }
        });
        it.ready = true;
        el.classList.add("gl-ready");
      } catch (e) { /* the pictures stay */ }
    };
    near.observe(el);
    it.tick = () => {
      if (!it.ready || !sec) return false;
      const p = sec._p == null ? -1 : sec._p;
      const A = smooth(-0.42, 0.1, p), M = smooth(0.27, 0.56, p);
      const G = end === "disperse" ? smooth(0.62, 0.72, p) * (1 - smooth(0.88, 0.96, p)) : 0;
      const D = end === "disperse" ? smooth(0.86, 1.06, p) : 0;
      const R = end === "resolve" ? smooth(0.64, 0.78, p) : 0;
      if (end === "resolve" && Math.abs(R - lastR) > 0.002) { lastR = R; el.style.setProperty("--resolve", R.toFixed(3)); el.classList.toggle("resolved", R > 0.6); }
      const r = el.getBoundingClientRect();
      const vis = onScreen(r, 80) && A > 0.001 && D < 0.999 && R < 0.999;
      P.pts.visible = vis;
      if (!vis) return false;
      const s = r.width, cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      P.pts.position.set(cx - vw / 2, vh / 2 - cy, 0);
      P.pts.scale.setScalar(s * (1 + (1 - M) * 0.04));
      const nx = Z.mx / vw - 0.5, ny = Z.my / vh - 0.5;
      P.pts.rotation.set(lerp(lerp(-1.05, -0.58, A) + ny * 0.08, ny * 0.02, M), lerp(nx * 0.16 - 0.08, nx * 0.03, M), lerp(lerp(0.28, 0.06, A), 0, M));
      P.u.uA.value = A; P.u.uM.value = M; P.u.uG.value = G; P.u.uD.value = D; P.u.uR.value = R;
      P.u.uSize.value = (s / W) * 1.32;
      P.u.uRepel.value = Z.fine && Z.pointed ? M * (1 - R) : 0; P.u.uRad.value = 0.003;
      pointer(P, cx, cy, s);
      return true;
    };
    items.push(it);
  }

  /* The UZM mark from dust (the invitation, the group page). */
  function mark(el) {
    const it = { el, ready: false };
    let P = null, grid = 1;
    el._load = async () => {
      try {
        const sym = document.getElementById("uzm-group");
        const vb = sym.getAttribute("viewBox").split(/\s+/).map(Number);
        const W = small ? 360 : 620, H = Math.round((W * vb[3]) / vb[2]);
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(" ")}" width="${W}" height="${H}"><g color="#fff" fill="#fff">${sym.innerHTML}</g></svg>`;
        const img = await imgEl("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
        const d = sample(img, W, H), pts = [], step = 2;
        for (let j = 0; j < H; j += step) for (let i = 0; i < W; i += step) if (d[(j * W + i) * 4 + 3] > 140) pts.push(i, j);
        const n = pts.length / 2;
        P = makePoints(n, (pos, plan, start, col, colB, rnd) => {
          for (let k = 0; k < n; k++) {
            pos[k * 3] = plan[k * 3] = pts[k * 2] / W - 0.5 + (Math.random() - 0.5) * 0.002;
            pos[k * 3 + 1] = plan[k * 3 + 1] = -(pts[k * 2 + 1] / H - 0.5) * (H / W);
            pos[k * 3 + 2] = plan[k * 3 + 2] = (Math.random() - 0.5) * 0.01;
            col[k * 3] = colB[k * 3] = 0.93; col[k * 3 + 1] = colB[k * 3 + 1] = 0.93; col[k * 3 + 2] = colB[k * 3 + 2] = 0.95;
            dust(start, rnd, k);
          }
        });
        grid = W / step;
        it.ready = true;
        el.classList.add("gl-ready");
      } catch (e) { /* the drawn mark stays */ }
    };
    near.observe(el);
    it.tick = () => {
      if (!it.ready) return false;
      const r = el.getBoundingClientRect();
      const vis = onScreen(r, 0);
      P.pts.visible = vis;
      if (!vis) return false;
      const s = Math.min(vw * (small ? 0.74 : 0.42), 600), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      P.pts.position.set(cx - vw / 2, vh / 2 - cy, 0);
      P.pts.scale.setScalar(s);
      P.u.uA.value = smooth(0.05, 0.8, (vh - r.top) / (vh * 0.6 + r.height * 0.6));
      P.u.uSize.value = (s / grid) * 1.35;
      P.u.uRepel.value = Z.fine && Z.pointed ? 1 : 0; P.u.uRad.value = 0.006;
      pointer(P, cx, cy, s);
      P.pts.rotation.set((Z.my / vh - 0.5) * 0.12, (Z.mx / vw - 0.5) * 0.2, 0);
      return true;
    };
    items.push(it);
  }

  /* The 404: digits made of dust, which come apart under the cursor and blow out on a click. */
  function scatter(el) {
    const it = { el, ready: false };
    let P = null, grid = 1, born = 0, burst = 0;
    el._load = async () => {
      try { await document.fonts.load('300 200px "Cormorant"'); } catch (e) {}
      const text = el.dataset.text || "404", W = small ? 420 : 760, H = Math.round(W * 0.42);
      const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
      const g = cv.getContext("2d", { willReadFrequently: true });
      g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
      g.font = `300 ${Math.round(H * 1.05)}px Cormorant, Georgia, serif`;
      g.fillText(text, W / 2, H * 0.54);
      const d = g.getImageData(0, 0, W, H).data, pts = [], step = 2;
      for (let j = 0; j < H; j += step) for (let i = 0; i < W; i += step) if (d[(j * W + i) * 4 + 3] > 120) pts.push(i, j);
      const n = pts.length / 2;
      P = makePoints(n, (pos, plan, start, col, colB, rnd) => {
        for (let k = 0; k < n; k++) {
          const x = pts[k * 2] / W - 0.5, y = -(pts[k * 2 + 1] / H - 0.5) * (H / W);
          pos[k * 3] = plan[k * 3] = x; pos[k * 3 + 1] = plan[k * 3 + 1] = y; pos[k * 3 + 2] = plan[k * 3 + 2] = (Math.random() - 0.5) * 0.02;
          const t = (x + 0.5) * 0.8;
          col[k * 3] = colB[k * 3] = 0.86 + t * 0.08; col[k * 3 + 1] = colB[k * 3 + 1] = 0.86 + t * 0.04; col[k * 3 + 2] = colB[k * 3 + 2] = 0.95;
          dust(start, rnd, k);
        }
      });
      grid = W / step; born = performance.now();
      it.ready = true;
      el.classList.add("gl-ready");
      (el.closest("section") || el).addEventListener("click", (e) => { if (!e.target.closest("a, button")) burst = 1; });
    };
    _load(el);
    it.tick = (now) => {
      if (!it.ready) return false;
      const r = el.getBoundingClientRect();
      const vis = onScreen(r, 0);
      P.pts.visible = vis;
      if (!vis) return false;
      const s = Math.min(r.width, small ? vw * 0.9 : 760), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      P.pts.position.set(cx - vw / 2, vh / 2 - cy, 0);
      P.pts.scale.setScalar(s);
      burst *= 0.95;
      const k = cubicOut((now - born) / 1800);
      P.u.uA.value = k;
      P.u.uBurst.value = burst * 0.9 + Math.max(0, Math.sin(now / 1400)) * 0.012;
      P.u.uSize.value = (s / grid) * 1.4;
      P.u.uRepel.value = Z.fine && Z.pointed ? 2.2 : 0; P.u.uRad.value = 0.012;
      pointer(P, cx, cy, s);
      P.pts.rotation.set((Z.my / vh - 0.5) * 0.25, (Z.mx / vw - 0.5) * 0.35, 0);
      return true;
    };
    items.push(it);
  }
  function _load(el) { requestAnimationFrame(() => el._load()); }

  /* The amenity picture that follows the cursor over the list (fine pointers). */
  function amen(el) {
    if (!Z.fine) return;
    const rows = [...el.querySelectorAll("[data-img]")], cache = {};
    const u = { uA: { value: null }, uB: { value: null }, uARes: { value: new T.Vector2(1, 1) }, uBRes: { value: new T.Vector2(1, 1) }, uRes: { value: new T.Vector2(1, 1) }, uMix: { value: 1 }, uAlpha: { value: 0 }, uShow: { value: 0 }, uTime, uVx: { value: 0 }, uVy: { value: 0 } };
    const mesh = new T.Mesh(geo, mat(AMEN_VS, AMEN_FS, u));
    mesh.visible = false; mesh.renderOrder = 60; scene.add(mesh);
    const get = (src) => (cache[src] ||= loadTex(src));
    let on = false, cur = null, ax = Z.mx, ay = Z.my, show = 0;
    el._load = () => rows.forEach((r) => get(r.dataset.img));
    near.observe(el);
    rows.forEach((r) => r.addEventListener("pointerenter", async () => {
      const src = r.dataset.img;
      if (src === cur) return;
      cur = src;
      const t = await get(src);
      if (!t || cur !== src) return;
      const shown = u.uMix.value > 0.5 ? u.uB.value : u.uA.value;
      u.uA.value = shown || t; u.uARes.value = texSize(shown || t);
      u.uB.value = t; u.uBRes.value = texSize(t);
      u.uMix.value = 0;
    }));
    el.addEventListener("pointerenter", () => { on = true; ax = Z.mx; ay = Z.my; });
    el.addEventListener("pointerleave", () => { on = false; cur = null; });
    const it = { el };
    it.tick = (now, dt) => {
      show = lerp(show, on && u.uB.value ? 1 : 0, 0.09);
      mesh.visible = show > 0.01;
      if (!mesh.visible) return false;
      const w = Math.min(320, vw * 0.24), h = w * 1.25, pax = ax, pay = ay;
      ax = lerp(ax, Z.mx, 0.12); ay = lerp(ay, Z.my, 0.12);
      const x = clamp(ax + w * 0.75, w / 2 + 16, vw - w / 2 - 16), y = clamp(ay, h / 2 + 16, vh - h / 2 - 16);
      mesh.position.set(x - vw / 2, vh / 2 - y, 0);
      mesh.scale.set(w, h, 1);
      mesh.rotation.z = clamp(-(ax - pax) * 0.004, -0.12, 0.12);
      u.uVx.value = clamp(ax - pax, -60, 60); u.uVy.value = clamp(ay - pay, -60, 60);
      u.uRes.value.set(w, h);
      u.uAlpha.value = show; u.uShow.value = show;
      if (u.uMix.value < 1) u.uMix.value = Math.min(1, u.uMix.value + dt / 650);
      return true;
    };
    items.push(it);
  }

  const KINDS = { hero, img: plane, strip: plane, develop: plane, seq, slides, aerial, cloud, mark, scatter, amen };
  targets.forEach((el) => { const k = el.dataset.gl, f = KINDS[k]; if (f) f(el, k); });

  /* Resize */
  addEventListener("resize", () => {
    if (dead) return;
    vw = innerWidth; vh = innerHeight;
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh; camera.position.z = camDist(); camera.updateProjectionMatrix();
    uScreen.value.set(vw * dpr, vh * dpr);
    trailMat.uniforms.uAspect.value = vw / vh;
    scene.traverse((o) => { if (o.isPoints) o.material.uniforms.uCam.value = camDist(); });
  });

  /* The frame: trail pass, then each scene; render only if something of ours is on screen. */
  let lastAny = true, mvx = 0, mvy = 0, pmx = Z.mx, pmy = Z.my;
  const frame = (now, dt) => {
    if (dead || document.hidden) return;
    uTime.value = now / 1000;
    if (Z.fine && lastAny) {
      const dmx = Z.mx - pmx, dmy = Z.my - pmy;
      mvx = lerp(mvx, clamp((dmx / vw) * 6, -0.7, 0.7), 0.5); mvy = lerp(mvy, clamp((-dmy / vh) * 6, -0.7, 0.7), 0.5);
      trailMat.uniforms.uMouse.value.set(Z.mx / vw, 1 - Z.my / vh);
      trailMat.uniforms.uMV.value.set(mvx, mvy);
      trailMat.uniforms.uOn.value = Z.pointed ? Math.min(1, Math.hypot(dmx, dmy) / 8) : 0;
      trailMat.uniforms.uPrev.value = rtA.texture;
      renderer.setRenderTarget(rtB); renderer.render(trailScene, trailCam); renderer.setRenderTarget(null);
      [rtA, rtB] = [rtB, rtA];
      uTrail.value = rtA.texture;
    }
    pmx = Z.mx; pmy = Z.my;
    let any = false;
    for (const it of items) if (it.tick(now, dt)) any = true;
    if (any || lastAny) renderer.render(scene, camera);
    lastAny = any;
  };
  Z.late.push(frame);
  root.classList.add("gl");

  /* Giving the context back: when another WebGL user arrives (the projects map), or if the browser takes it. */
  const kill = () => {
    if (dead) return;
    dead = true;
    Z.late = Z.late.filter((f) => f !== frame);
    document.querySelectorAll(".gl-ready").forEach((el) => el.classList.remove("gl-ready"));
    root.classList.remove("gl");
    try { renderer.dispose(); renderer.forceContextLoss(); } catch (e) {}
    canvas.remove();
  };
  document.addEventListener("z:release", kill);
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); kill(); });
  /* Back from the page cache: the pictures were shown for the page-change snapshot; hand them back to WebGL. */
  document.addEventListener("z:restore", () => { if (!dead) items.forEach((it) => it.ready && it.el.classList.add("gl-ready")); });
}

main().catch(() => root.classList.add("no-gl"));
