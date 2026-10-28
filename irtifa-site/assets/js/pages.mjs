/* İrtifa · the secondary pages: Hakkımızda, Grup şirketleri, İletişim, the legal texts and the lost-signal 404.
   Each part starts only when its section is on the page.
   Hakkımızda: the camera drops onto the sales office roof and the reticle locks on the UZM letters; vision and
     mission light word by word in a pinned scene; the completed villas are drawn in gold lines (x-ray) and the scan
     builds the photograph while the figures count with it; the flight log draws its line down through the years
     while an odometer rolls to the year you have reached.
   Grup: the names decode and swell under the pointer; a HUD frame holds the chosen company's mark.
   İletişim: each office has a small night map that loads when it comes near and descends onto its beacon.
   Legal texts: the section index marks where you are and how much you have read.
   404: static noise, a reticle searching it, coordinates that never settle.
   Reduced motion: nothing pinned, nothing moves by itself, every figure stands at its final value. */
import { Picture } from "./gl.mjs";
import { loadML, nightStyle, OFFICES, TR, hasGL } from "./nightmap.mjs";

const U = window.UZM;
const { $, $$, clamp } = U;
const reduced = U.reduced;
const small = () => innerWidth < 768;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const pad = (n, w) => String(n).padStart(w, "0");
const onView = (el, fn, margin = "0px") => {
  if (!("IntersectionObserver" in window)) return fn(true);
  new IntersectionObserver((es) => fn(es[0].isIntersecting), { rootMargin: margin }).observe(el);
};

/* ── Scenes: a [data-scene] section is pinned while its sticky child is held; --p runs 0..1 over that stretch ── */
const scenes = $$("[data-scene]").map((el) => ({ el, top: 0, len: 1, p: 0, changed: true }));
const sceneOf = (el) => scenes.find((s) => s.el === el);
function measure() {
  for (const s of scenes) {
    const r = s.el.getBoundingClientRect();
    s.top = r.top + scrollY;
    s.len = Math.max(1, s.el.offsetHeight - innerHeight);
  }
}
function progress() {
  const y = scrollY;
  for (const s of scenes) {
    const p = clamp((y - s.top) / s.len);
    s.changed = Math.abs(p - s.p) > 1e-5;
    s.p = p;
    if (s.changed) s.el.style.setProperty("--p", p.toFixed(4));
  }
}

/* ═══ Hakkımızda ═══ */

/* ── 0 · Descent onto the roof. object-position puts the roof's centre (T, as fractions of the photograph) at the
   same fractions of the screen, so the camera can scale about it and slide it to the middle; the lock box is the
   roof's own rectangle (R) at the current scale, wide and wandering while it searches. ── */
const hero = $(".ab-hero");
let drawHero = () => {};
if (hero) {
  const pin = $(".ab-hero-pin", hero), img = $(".ab-hero-media img", hero), tag = $("[data-lock]", hero);
  const NAT = [1350, 1080], T = [0.364, 0.311], R = [0.27, 0.17];
  let lastLock = "";
  drawHero = (p, t) => {
    const W = pin.clientWidth, H = pin.clientHeight;
    const s0 = Math.max(W / NAT[0], H / NAT[1]);
    const k = reduced ? 0 : smooth(0.02, 0.8, p);
    const zoom = 1 + k * (small() ? 0.22 : 0.8);
    // slide the roof toward the middle, but never so far that an edge of the photograph comes into view
    const ox = T[0] * W, oy = T[1] * H, z1 = zoom - 1;
    const dx = clamp((0.5 - T[0]) * W * k, -(W - ox) * z1, ox * z1), dy = clamp((0.5 - T[1]) * H * k, -(H - oy) * z1, oy * z1);
    if (!reduced) img.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${zoom.toFixed(4)})`;
    const lockK = reduced ? 1 : smooth(0.22, 0.66, p), search = 1 - lockK;
    const cx = T[0] * W + dx + Math.sin(t * 0.0011) * 34 * search, cy = T[1] * H + dy + Math.cos(t * 0.0014) * 22 * search;
    const grow = 1 + search * (small() ? 0.18 : 0.55);
    hero.style.setProperty("--lx", cx.toFixed(1) + "px");
    hero.style.setProperty("--ly", cy.toFixed(1) + "px");
    hero.style.setProperty("--lw", (R[0] * NAT[0] * s0 * zoom * grow).toFixed(1) + "px");
    hero.style.setProperty("--lh", (R[1] * NAT[1] * s0 * zoom * grow).toFixed(1) + "px");
    if (!reduced) {
      hero.style.setProperty("--k", k.toFixed(4));
      hero.style.setProperty("--fade", smooth(0.04, 0.3, p).toFixed(4));
    }
    const lock = lockK >= 0.999 ? "HEDEF KİLİTLENDİ · UZM" : p > 0.12 ? "HEDEF YAKLAŞIYOR" : "HEDEF ARANIYOR";
    if (lock !== lastLock) {
      lastLock = lock;
      U.scramble(tag, lock, 420);
      hero.classList.toggle("locked", lockK >= 0.999 && !reduced);
    }
  };
  if (reduced) { drawHero(0, 0); addEventListener("resize", () => drawHero(0, 0)); }
}

/* ── 2 · Vision and mission: words light one by one as the scene scrolls (one count runs through both) ── */
const vm = $(".ab-vm");
let vmWords = [], vmItems = [], litN = -1;
if (vm && !reduced) {
  const wrap = (node) => {
    for (const ch of [...node.childNodes]) {
      if (ch.nodeType === 3) {
        const frag = document.createDocumentFragment();
        ch.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(" "));
          else { const s = document.createElement("span"); s.className = "w"; s.textContent = part; frag.appendChild(s); }
        });
        ch.replaceWith(frag);
      } else if (ch.nodeType === 1) wrap(ch);
    }
  };
  $$("[data-words]", vm).forEach(wrap);
  vmWords = $$(".w", vm);
  vmItems = $$(".ab-vm-item", vm).map((el) => ({ el, first: vmWords.indexOf($(".w", el)) }));
}
function updateVm(p) {
  const k = smooth(0.08, 0.82, p);
  vm.style.setProperty("--lit", k.toFixed(4));
  const n = Math.round(k * vmWords.length);
  if (n === litN) return;
  litN = n;
  vmWords.forEach((w, i) => w.classList.toggle("on", i < n));
  vmItems.forEach((it) => it.el.classList.toggle("on", n > it.first));
}

/* ── 5 · Figures over the villas: x-ray picture, scan with the scroll, numbers counting in staggered windows ── */
const figs = $(".ab-figs");
let fpic = null, fvis = false, lastScan = -1;
const figNums = figs ? $$("[data-fig]", figs).map((el, i) => ({ el, to: +el.dataset.fig, a: i * 0.14 })) : [];
const scanEl = figs && $("[data-scan]", figs);
if (figs && !reduced) {
  const pin = $(".ab-figs-pin", figs), cv = $(".ab-figs-gl", figs), img = $(".ab-figs-media img", figs);
  let tried = false;
  onView(figs, (vis) => {
    fvis = vis;
    if (!vis || tried) return;
    tried = true;
    img.loading = "eager";
    fpic = new Picture(cv, img, "xray");
    if (!fpic.gl) { fpic = null; return; }
    fpic.ready.then(() => { figs.classList.add("gl-on"); fpic.resize(); });
    cv.addEventListener("gl-lost", () => { figs.classList.remove("gl-on"); fpic = null; });
  }, "100% 0px");
  pin.addEventListener("pointermove", (e) => { if (!fpic) return; fpic.pointer(e.clientX, e.clientY); if (e.pointerType === "mouse") fpic.lensTo = 0.15; });
  pin.addEventListener("pointerleave", () => { if (fpic) fpic.lensTo = 0; });
  addEventListener("resize", () => fpic && fpic.resize());
  figNums.forEach((f) => { f.el.textContent = "0"; });
  if (scanEl) scanEl.textContent = "000";
}
function updateFigs(p, t) {
  const scan = smooth(0.1, 0.8, p);
  if (scan !== lastScan) {
    lastScan = scan;
    if (scanEl) scanEl.textContent = pad(Math.round(scan * 100), 3);
    figNums.forEach((f) => {
      const k = clamp((scan - f.a) / 0.72);
      f.el.textContent = U.fmt(Math.round(f.to * (1 - Math.pow(1 - k, 3))));
    });
  }
  if (fpic && fpic.ok && fvis) { fpic.scan = scan; fpic.draw(t); }
}

/* ── 6 · Flight log: the line follows a head at 55% of the screen; entries above it are lit; the side readout
   rolls its digits to the last lit entry's year ── */
const log = $(".ab-log");
let updateLog = () => {};
if (log) {
  const list = $(".ab-log-list", log), line = $(".ab-log-line", log), meter = $(".ab-log-meter", log), items = $$(".ab-e", log);
  const odo = $("[data-year]", log), nEl = $("[data-log-n]", log), placeEl = $("[data-log-place]", log);
  const cols = [];
  if (odo) {
    odo.textContent = "";
    for (let i = 0; i < 4; i++) {
      const c = document.createElement("span"), s = document.createElement("span");
      c.className = "dg"; s.className = "dg-s"; s.style.setProperty("--i", i);
      for (let d = 0; d < 10; d++) { const x = document.createElement("i"); x.textContent = d; s.appendChild(x); }
      c.appendChild(s); odo.appendChild(c); cols.push(s);
    }
  }
  const setYear = (y) => String(y).split("").forEach((d, i) => cols[i] && cols[i].style.setProperty("--d", d));
  setYear(items[0].dataset.year);
  let cur = 0, vis = false;
  if (reduced) items.forEach((li) => li.classList.add("on"));
  updateLog = () => {
    const r = list.getBoundingClientRect(), head = innerHeight * 0.55;
    const f = clamp((head - r.top) / r.height);
    if (!reduced) line.style.setProperty("--f", f.toFixed(4));
    if (meter) meter.style.setProperty("--f", f.toFixed(4));
    let a = 0;
    items.forEach((li, i) => {
      const on = li.getBoundingClientRect().top < head;
      if (!reduced) li.classList.toggle("on", on);
      if (on) a = i;
    });
    if (a !== cur) {
      cur = a;
      setYear(items[a].dataset.year);
      if (nEl) nEl.textContent = pad(a + 1, 2);
      U.scramble(placeEl, items[a].dataset.place, 480);
    }
  };
  onView(log, (v) => { vis = v; if (v) updateLog(); });
  if (reduced) addEventListener("scroll", () => vis && updateLog(), { passive: true });
  else U.onFrame(() => { if (vis) updateLog(); });
}

/* ═══ Grup şirketleri ═══ */

/* ── 0 · The constellation leans away from the pointer ── */
const sky = $(".gr-sky");
if (sky && U.fine && !reduced) {
  const box = sky.closest("section");
  box.addEventListener("pointermove", (e) => {
    const r = box.getBoundingClientRect();
    sky.style.setProperty("--mx", (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
    sky.style.setProperty("--my", (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
  });
  box.addEventListener("pointerleave", () => { sky.style.setProperty("--mx", 0); sky.style.setProperty("--my", 0); });
}

/* ── 2 · The index: the pointed (or focused, or centred) company fills the HUD frame; its name decodes ── */
const cos = $$(".co");
if (cos.length) {
  const hud = $(".gr-hud"), marks = hud ? $$(".gr-hud-marks span", hud) : [];
  const nEl = $("[data-co-n]"), secEl = $("[data-co-sec]"), estEl = $("[data-co-est]");
  const GL = "ABCDEFGHIJKLMNOPRSTUVYZ0123456789#/+<>=";
  let curCo = null, over = false;
  const show = (li) => {
    if (li === curCo) return;
    curCo = li;
    cos.forEach((x) => x.classList.toggle("on", x === li));
    marks.forEach((m) => m.classList.toggle("on", m.dataset.k === li.dataset.k));
    if (nEl) nEl.textContent = li.dataset.n;
    U.scramble(secEl, li.dataset.sector.toLocaleUpperCase("tr-TR"), 520);
    U.scramble(estEl, li.dataset.est.toLocaleUpperCase("tr-TR"), 520);
    if (hud && !reduced) { hud.classList.remove("scan"); void hud.offsetWidth; hud.classList.add("scan"); }
  };
  // decode the split characters of a name in place (the swell keeps working on the same spans)
  const decode = (li) => {
    if (reduced) return;
    const name = $(".co-name", li), chars = name._split || [];
    if (!chars.length) return;
    chars.forEach((c) => { if (!c.dataset.ch) c.dataset.ch = c.textContent; });
    cancelAnimationFrame(name._dec);
    const t0 = performance.now();
    const run = (t) => {
      const e = t - t0;
      let busy = false;
      chars.forEach((c, i) => {
        if (e > 90 + i * 32) c.textContent = c.dataset.ch;
        else { busy = true; c.textContent = GL[(Math.random() * GL.length) | 0]; }
      });
      if (busy) name._dec = requestAnimationFrame(run);
    };
    name._dec = requestAnimationFrame(run);
  };
  cos.forEach((li) => {
    li.addEventListener("pointerenter", (e) => { show(li); if (e.pointerType === "mouse") decode(li); });
    li.addEventListener("focusin", () => show(li));
  });
  const list = $(".gr-list");
  list.addEventListener("pointerenter", () => { over = true; });
  list.addEventListener("pointerleave", () => { over = false; });
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting && !over) show(e.target); }), { rootMargin: "-45% 0px -45% 0px" });
    cos.forEach((li) => io.observe(li));
  }
  show(cos[0]);
}

/* ═══ İletişim ═══ */

/* ── 1 · Office maps: night style, mercator; built when the card comes near, the camera descends onto the beacon
   once the card is on screen, then the pointer can lean the view a little. No WebGL: the drawn plate stays. ── */
async function officeMap(card) {
  const box = $(".ct-map", card), holder = $(".ct-map-gl", card), at = OFFICES[card.dataset.office];
  const cam = { center: at, zoom: small() ? 15 : 15.35, pitch: 58, bearing: +(card.dataset.bearing || 0) };
  try {
    const ml = await loadML();
    const map = new ml.Map({
      container: holder, style: nightStyle({ globe: false }),
      center: at, zoom: reduced ? cam.zoom : 11.4, pitch: reduced ? cam.pitch : 0, bearing: reduced ? cam.bearing : cam.bearing - 50,
      interactive: false, attributionControl: false, fadeDuration: 0, locale: TR, maxPitch: 70,
      pixelRatio: Math.min(devicePixelRatio || 1, 1.5),
    });
    map.on("error", (e) => console.warn("[irtifa] harita", (e && e.error && e.error.message) || e));
    const mk = document.createElement("div");
    mk.className = "ct-beacon"; mk.setAttribute("aria-hidden", "true");
    mk.innerHTML = "<s></s><s></s><i></i>";
    new ml.Marker({ element: mk, anchor: "center" }).setLngLat(at).addTo(map);
    const cv = map.getCanvas();
    cv.setAttribute("role", "img");
    cv.setAttribute("aria-label", card.dataset.label || "Harita");
    cv.removeAttribute("tabindex");
    await new Promise((res, rej) => { map.once("load", res); setTimeout(() => rej(new Error("harita zamanında yüklenmedi")), 15000); });
    box.classList.add("gl");
    if (reduced) return;
    let flown = false, lean = null;
    onView(card, (v) => {
      if (!v || flown) return;
      flown = true;
      map.flyTo({ ...cam, duration: 4200, curve: 1.25, essential: true });
      map.once("moveend", () => { lean = { x: 0, y: 0, tx: 0, ty: 0 }; });
    }, "-15% 0px");
    if (U.fine) {
      box.addEventListener("pointermove", (e) => { if (!lean) return; const r = box.getBoundingClientRect(); lean.tx = ((e.clientX - r.left) / r.width) * 2 - 1; lean.ty = ((e.clientY - r.top) / r.height) * 2 - 1; });
      box.addEventListener("pointerleave", () => { if (lean) { lean.tx = 0; lean.ty = 0; } });
      U.onFrame(() => {
        if (!lean) return;
        const nx = lean.x + (lean.tx - lean.x) * 0.06, ny = lean.y + (lean.ty - lean.y) * 0.06;
        if (Math.abs(nx - lean.x) + Math.abs(ny - lean.y) < 0.0005) return;
        lean.x = nx; lean.y = ny;
        map.jumpTo({ bearing: cam.bearing + nx * 16, pitch: cam.pitch - ny * 8 });
      });
    }
  } catch (e) {
    console.warn("[irtifa] harita gösterilemiyor; çizim kalıyor:", e.message);
    card.classList.add("nomap");
  }
}
const offices = $$(".ct-card[data-office]");
if (offices.length) {
  if (hasGL()) offices.forEach((card) => {
    let done = false;
    onView(card, (v) => { if (v && !done) { done = true; officeMap(card); } }, "300px 0px");
  });
  else offices.forEach((c) => c.classList.add("nomap"));
}

/* ── 3 · The letter: a character count in the panel's header ── */
const msg = $("#c-msg"), msgLen = $("[data-msg-len]");
if (msg && msgLen) {
  const upd = () => { msgLen.textContent = pad(msg.value.length, 3); };
  msg.addEventListener("input", upd);
  msg.form.addEventListener("reset", () => setTimeout(upd, 0));
}

/* ═══ Legal texts: the index marks the section in view; the bar and the readout show how much has been read ═══ */
const toc = $$(".toc a[href^='#']");
if (toc.length) {
  const mark = (id) => toc.forEach((a) => { if (a.hash === "#" + id) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current"); });
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) mark(e.target.id); }), { rootMargin: "-25% 0px -65% 0px" });
    toc.forEach((a) => { const s = document.getElementById(a.hash.slice(1)); if (s) io.observe(s); });
  }
  const docEl = $(".doc"), tocEl = $(".toc"), readEl = $("[data-read]");
  let last = -1;
  const read = () => {
    const r = docEl.getBoundingClientRect();
    const k = clamp((innerHeight * 0.6 - r.top) / r.height);
    const pct = Math.round(k * 100);
    if (pct === last) return;
    last = pct;
    tocEl.style.setProperty("--read", k.toFixed(3));
    if (readEl) readEl.textContent = pad(pct, 3);
  };
  read();
  if (reduced) addEventListener("scroll", read, { passive: true }); else U.onFrame(read);
}

/* ═══ 404 · lost signal ═══ */
const nf = $(".nf");
if (nf) {
  const cv = $(".nf-noise", nf), ctx = cv.getContext("2d"), ret = $(".nf-ret", nf), r2 = $(".r2", ret);
  const tag = $("[data-nf-tag]", nf), lat = $("[data-nf-lat]", nf), lon = $("[data-nf-lon]", nf), sig = $(".nf-sig", nf);
  let w = 0, h = 0, img = null, buf = null, vis = true;
  const size = () => {
    w = Math.max(1, Math.ceil(nf.clientWidth / 3)); h = Math.max(1, Math.ceil(nf.clientHeight / 3));
    cv.width = w; cv.height = h;
    img = ctx.createImageData(w, h); buf = new Uint32Array(img.data.buffer);
  };
  // grey static with a warm cast, a brighter rolling band, the odd torn line
  const noise = (t) => {
    const band = ((t * 0.04) % (h + 40)) - 20, tear = Math.random() < 0.08 ? (Math.random() * h) | 0 : -1;
    for (let y = 0; y < h; y++) {
      const d = Math.abs(y - band), boost = d < 14 ? 1.5 - d / 28 : 1, row = y === tear ? 1.8 : boost;
      for (let x = 0; x < w; x++) {
        const v = Math.min(255, Math.random() * 190 * row) | 0;
        buf[y * w + x] = 0xff000000 | (((v * 0.78) | 0) << 16) | (((v * 0.9) | 0) << 8) | v;
      }
    }
    ctx.putImageData(img, 0, 0);
  };
  const digits = (n) => { let s = ""; for (let i = 0; i < n; i++) s += (Math.random() * 10) | 0; return s; };
  size();
  addEventListener("resize", size);
  nf.classList.add("live");
  if (reduced) {
    noise(0);
    lat.textContent = "— K"; lon.textContent = "— D";
  } else {
    onView(nf, (v) => { vis = v; });
    let lastN = 0, lastC = 0, rx = innerWidth * 0.7, ry = innerHeight * 0.5, hold = 0, phase = 0, nextMiss = 3200, missing = false;
    U.onFrame((t, dt) => {
      if (!vis || document.hidden) return;
      if (t - lastN > 50) { lastN = t; noise(t); }
      // the search path: a slow Lissajous over the right of the screen (the top on phones), pausing to check
      const W = nf.clientWidth, H = nf.clientHeight, ph = small();
      if (hold > 0) hold -= dt; else phase += dt * 0.00042;
      const tx = ph ? W * (0.5 + Math.sin(phase * 1.3) * 0.3) : W * (0.7 + Math.sin(phase * 1.1) * 0.17);
      const ty = ph ? H * (0.3 + Math.sin(phase * 1.9 + 1) * 0.12) : H * (0.48 + Math.sin(phase * 1.7 + 0.6) * 0.26);
      rx += (tx - rx) * 0.06; ry += (ty - ry) * 0.06;
      ret.style.setProperty("--rx", rx.toFixed(1) + "px");
      ret.style.setProperty("--ry", ry.toFixed(1) + "px");
      r2.style.setProperty("--spin", ((t * 0.04) % 360).toFixed(1) + "deg");
      if (t - lastC > 90) {
        lastC = t;
        lat.textContent = "4" + digits(1) + "," + digits(4) + "° K";
        lon.textContent = "2" + digits(1) + "," + digits(4) + "° D";
        sig.textContent = "%" + pad((Math.random() * 7) | 0, 3);
      }
      nextMiss -= dt;
      if (nextMiss <= 0 && !missing) {
        missing = true; hold = 1400;
        ret.classList.add("miss");
        U.scramble(tag, "HEDEF YOK", 380);
        setTimeout(() => { ret.classList.remove("miss"); U.scramble(tag, "SİNYAL ARANIYOR", 420); missing = false; nextMiss = 3800 + Math.random() * 2400; }, 1500);
      }
    });
  }
}

/* ═══ Run the scenes ═══ */
function layout() { measure(); progress(); }
layout();
addEventListener("resize", layout);
addEventListener("load", layout);
if ("ResizeObserver" in window) new ResizeObserver(() => measure()).observe(document.body);
if (!reduced && scenes.length) {
  const hs = hero && sceneOf(hero), vs = vm && sceneOf(vm), fs = figs && sceneOf(figs);
  let heroVis = true;
  if (hero) onView(hero, (v) => { heroVis = v; });
  U.onFrame((t) => {
    progress();
    if (hs && heroVis) drawHero(hs.p, t);
    if (vs && (vs.changed || litN < 0)) updateVm(vs.p);
    if (fs && (fs.changed || (fpic && fvis))) updateFigs(fs.p, t);
  });
}
