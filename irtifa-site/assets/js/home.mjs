/* İrtifa · home. One descent from orbit to the door.
   0 Boot: the instruments wake up while the map style loads (first visit of a session).
   1 Dive: a live MapLibre globe in a night style of our own (OpenFreeMap tiles: gold motorways, city glow, black
     land), flown down a camera path by the scroll: Türkiye → İstanbul → drive-time lines → Bahçeşehir; the reticle
     locks on Levan and an iris opens onto the night render. No WebGL or no tiles: the render grows out of the dark.
   2 X-ray: the render drawn as lines by a shader; the scan line builds it into the picture; a lens shows the other.
   3 Words light up one by one; 4 the six home types turn on a drum; 5 amenities shed pictures from the pointer;
   6 the building-site log runs sideways; 7 touchdown: the night villa stirred like water.
   The altimeter on the HUD follows the descent all the way down to 0 m. */
import { Picture } from "./gl.mjs";
import { nightStyle, loadML, hasGL, LEVAN } from "./nightmap.mjs";

const U = window.UZM;
const { $, $$, clamp } = U;
const doc = document.documentElement;
const reduced = U.reduced;
const small = () => innerWidth < 768;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/* ── Scenes: progress 0..1 while each pinned section scrolls past ── */
const scenes = $$(".dive, .xray, .words, .types, .log").map((el) => ({ el, top: 0, len: 1, p: -1 }));
const S = (sel) => scenes.find((s) => s.el.matches(sel));
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
    if (s.changed && !reduced) s.el.style.setProperty("--p", p.toFixed(4));
  }
}

/* ── 0 · Boot ── */
const heroIn = () => {
  const h = $("#hero-title"), l = $(".dive-hero .label");
  if (h) h.classList.add("in");
  if (l) { l.classList.add("in"); U.scramble(l, l.dataset.text); }
};
const bootDone = (() => {
  if (!doc.classList.contains("boot")) { requestAnimationFrame(heroIn); return () => {}; }
  const n = $("[data-boot-n]"), k = $("[data-boot-k]"), scr = $(".boot-scr");
  const t0 = performance.now();
  let target = 0.6, shown = 0, done = false, finished = false;
  U.scramble(k, "SİNYAL ARANIYOR", 500);
  const run = (t) => {
    if (finished) return;
    const minT = (t - t0) / 1300;
    const goal = done ? 1 : Math.min(target, 0.92);
    shown += (Math.min(goal, Math.max(shown, minT * goal)) - shown) * 0.12;
    if (done && minT >= 1) shown += (1 - shown) * 0.25;
    n.textContent = String(Math.round(shown * 100)).padStart(3, "0");
    scr.style.setProperty("--bp", shown.toFixed(3));
    if (shown > 0.995 && done && minT >= 1) {
      n.textContent = "100";
      U.scramble(k, "BAĞLANTI KURULDU", 380);
      finished = true;
      setTimeout(() => { doc.classList.add("boot-done"); setTimeout(heroIn, 350); setTimeout(() => doc.classList.remove("boot", "boot-done"), 1300); }, 420);
      return;
    }
    requestAnimationFrame(run);
  };
  requestAnimationFrame(run);
  setTimeout(() => { done = true; }, 3000);
  return () => { done = true; };
})();

/* ── 1 · Dive ── */
const dive = $(".dive"), diveS = S(".dive");
const DEST = [
  { name: "5. LEVENT", min: "15 DK*", at: [29.0105, 41.0815] },
  { name: "İSTANBUL HAVALİMANI", min: "20 DK", at: [28.7519, 41.2753] },
  { name: "İSTOÇ", min: "15 DK", at: [28.8195, 41.0662] },
];
const LABELS = [
  { t: "TÜRKİYE", at: [33.2, 39.3], z: [1.6, 2.4, 3.8, 4.8] },
  { t: "KARADENİZ", at: [33.5, 42.9], z: [2.6, 3.4, 5, 6] },
  { t: "MARMARA", at: [28.2, 40.72], z: [4.5, 5.4, 7.2, 8.2] },
  { t: "İSTANBUL", at: [29.0, 41.04], z: [5.2, 6.2, 8.8, 9.8] },
  { t: "BAHÇEŞEHİR", at: [28.66, 41.085], z: [10.4, 11.2, 13, 13.8] },
];
// Camera path: where the camera is at each point of the scroll (padL pushes the centre right of the text)
const KF_WIDE = [
  { p: 0.0, lon: 33.0, lat: 37.5, z: 1.7, pitch: 0, bear: 0, pad: 0.36 },
  { p: 0.12, lon: 31.0, lat: 39.6, z: 3.6, pitch: 0, bear: 0, pad: 0.3 },
  { p: 0.28, lon: 29.05, lat: 41.0, z: 7.6, pitch: 15, bear: 0, pad: 0.3 },
  { p: 0.48, lon: 28.83, lat: 41.13, z: 9.9, pitch: 38, bear: 8, pad: 0.32 },
  { p: 0.68, lon: 28.7, lat: 41.11, z: 12.7, pitch: 55, bear: 28, pad: 0.24 },
  { p: 0.84, lon: LEVAN[0], lat: LEVAN[1], z: 14.9, pitch: 63, bear: 42, pad: 0 },
  { p: 1.0, lon: LEVAN[0], lat: LEVAN[1], z: 15.5, pitch: 65, bear: 48, pad: 0 },
];
const KF_TALL = KF_WIDE.map((k) => ({ ...k, z: k.z - 0.7, pad: 0 }));
const cr = (p0, p1, p2, p3, t) => {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
};
let spin = 0; // degrees of longitude the globe has turned while the page rests at the top
// the pointer leans the globe a little (and drifts the stars the other way) while in orbit
let lean = [0, 0], leanTo = [0, 0];
if (U.fine && !reduced) addEventListener("pointermove", (e) => { leanTo = [e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5]; }, { passive: true });
function camAt(p) {
  const K = small() ? KF_TALL : KF_WIDE;
  let i = 0;
  while (i < K.length - 2 && p > K[i + 1].p) i++;
  const a = K[i], b = K[i + 1], t = clamp((p - a.p) / (b.p - a.p));
  const A = K[i - 1] || a, B = K[i + 2] || b;
  const o = {};
  for (const key of ["lon", "lat", "z", "pitch", "bear", "pad"]) o[key] = cr(A[key], a[key], b[key], B[key], t);
  const orbit = 1 - smooth(0, 0.1, p);
  o.lon += spin * orbit;
  o.bear += lean[0] * 16 * orbit;
  o.pitch += (0.5 + lean[1]) * 14 * orbit;
  return o;
}
function altitude(z, lat, pitch) {
  const mpp = (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * Math.pow(2, z));
  return 1.5 * innerHeight * mpp * Math.cos((pitch * Math.PI) / 180);
}
const fmtDeg = (v, pos, neg) => U.fmt(Math.abs(v), 4) + "° " + (v >= 0 ? pos : neg);
const read = { alt: $("[data-d-alt]"), lat: $("[data-d-lat]"), lon: $("[data-d-lon]"), stage: $("[data-d-stage]"), lock: $("[data-lock]") };
const notes = $$(".dive-notes > li").map((li) => ({ li, at: li.dataset.at.split(" ").map(Number) }));
let map = null, mapOK = false, markers = [], lastStage = "", lastLock = "", landAlt = 900;

function routeArc(a, b, bend = 0.18) {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const c = [mx - dy * bend, my + dx * bend];
  const pts = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48, u = 1 - t;
    pts.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
  }
  return pts;
}

function homeStyle() {
  const lines = DEST.map((d, i) => ({ type: "Feature", properties: { i }, geometry: { type: "LineString", coordinates: routeArc(LEVAN, d.at, i === 1 ? -0.22 : 0.2) } }));
  return nightStyle({
    sources: { routes: { type: "geojson", data: { type: "FeatureCollection", features: lines }, lineMetrics: true } },
    layers: [
      { id: "routes-glow", type: "line", source: "routes", layout: { "line-cap": "round" }, paint: { "line-color": "#f2c97e", "line-width": 9, "line-blur": 8, "line-opacity": 0 } },
      { id: "routes", type: "line", source: "routes", layout: { "line-cap": "round" }, paint: { "line-width": 2, "line-gradient": ["interpolate", ["linear"], ["line-progress"], 0, "#fff1cc", 1, "rgba(0,0,0,0)"] } },
    ],
  });
}

// MapLibre writes its own inline opacity on the marker element, so ours fades an inner box
function marker(ml, html, cls, at, anchor = "left") {
  const box = document.createElement("div");
  box.className = "mk-box";
  const el = document.createElement("div");
  el.className = "mk " + cls;
  el.innerHTML = html;
  box.appendChild(el);
  const m = new ml.Marker({ element: box, anchor }).setLngLat(at).addTo(map);
  return { el, m };
}

async function startMap() {
  if (!hasGL() || reduced) throw new Error("no webgl2");
  const ml = await loadML();
  const c = camAt(0);
  map = new ml.Map({
    container: $(".dive-map"),
    style: homeStyle(),
    center: [c.lon, c.lat], zoom: c.z, pitch: c.pitch, bearing: c.bear,
    interactive: false, attributionControl: false, fadeDuration: 0, maxPitch: 75,
    pixelRatio: Math.min(devicePixelRatio || 1, small() ? 1.5 : 1.75),
    renderWorldCopies: false,
  });
  map.on("error", (e) => { if (!mapOK) console.warn("[irtifa] map", e && e.error); });
  await new Promise((res, rej) => { map.once("load", res); setTimeout(() => rej(new Error("map timeout")), 9000); });
  // labels, destinations, the beacon
  LABELS.forEach((l) => markers.push({ ...marker(ml, l.t, "mk-city", l.at, "center"), kind: "label", z: l.z }));
  DEST.forEach((d) => markers.push({ ...marker(ml, `<b>${d.name}</b><i>${d.min}</i>`, "mk-dest", d.at), kind: "dest" }));
  markers.push({ ...marker(ml, "<s></s><s></s><i></i><b>LEVAN BAHÇEŞEHİR</b>", "mk-levan", LEVAN, "center"), kind: "levan" });
  mapOK = true;
  dive.classList.add("map-on");
  landAlt = (() => { const c1 = camAt(1); return altitude(c1.z, c1.lat, c1.pitch); })();
  lastRoute = -1;
  updateDive(diveS.p);
}

let lastRoute = -1;
function updateDive(p) {
  const land = mapOK ? smooth(0.86, 0.985, p) : smooth(0.02, 0.95, p);
  dive.style.setProperty("--land", land.toFixed(4));
  dive.style.setProperty("--lock", smooth(0.74, 0.84, p).toFixed(4));
  const locked = p > 0.8;
  dive.classList.toggle("locked", locked);
  notes.forEach((n) => n.li.classList.toggle("on", p >= n.at[0] && p < n.at[1]));
  const c = camAt(p);
  const alt = mapOK ? altitude(c.z, c.lat, c.pitch) : U.lerp(36000000, 900, Math.pow(p, 0.25));
  const altTxt = U.fmtAlt(alt);
  U.altText = altTxt;
  if (read.alt) read.alt.textContent = altTxt;
  if (read.lat) read.lat.textContent = fmtDeg(c.lat, "K", "G");
  if (read.lon) read.lon.textContent = fmtDeg(c.lon, "D", "B");
  const stage = c.z < 3 ? "YÖRÜNGE" : c.z < 6.5 ? "TÜRKİYE" : c.z < 10.2 ? "İSTANBUL" : c.z < 13.5 ? "BAHÇEŞEHİR" : "LEVAN";
  if (stage !== lastStage) { lastStage = stage; U.scramble(read.stage, stage, 380); }
  const lock = locked ? "HEDEF KİLİTLENDİ · LEVAN" : p > 0.6 ? "HEDEF YAKLAŞIYOR" : "HEDEF ARANIYOR";
  if (lock !== lastLock) { lastLock = lock; U.scramble(read.lock, lock, 420); }
  if (!mapOK || land >= 0.999) return;
  const w = innerWidth, h = innerHeight;
  dive.style.setProperty("--pad", small() ? "0" : c.pad.toFixed(4));
  const pad = small() ? { top: 0, bottom: Math.round(h * 0.25) || 0, left: 0, right: 0 } : { left: Math.round(w * c.pad) || 0, top: 0, right: 0, bottom: 0 };
  if (![c.lon, c.lat, c.z, c.pitch, c.bear].every(Number.isFinite)) return;
  try { map.jumpTo({ center: [c.lon, c.lat], zoom: c.z, pitch: c.pitch, bearing: c.bear, padding: pad }); } catch (e) { console.warn("[irtifa] camera", e.message); }
  // the drive-time lines draw themselves in
  const r = smooth(0.33, 0.47, p) * (1 - smooth(0.58, 0.68, p));
  if (Math.abs(r - lastRoute) > 0.004) {
    lastRoute = r;
    const k = Math.max(0.0001, Math.min(0.9998, r));
    map.setPaintProperty("routes", "line-gradient", ["interpolate", ["linear"], ["line-progress"], 0, "#fff1cc", k, "#f2c97e", Math.min(0.9999, k + 0.0001), "rgba(0,0,0,0)"]);
    map.setPaintProperty("routes-glow", "line-opacity", 0.45 * r);
  }
  for (const m of markers) {
    let o = 0;
    if (m.kind === "label") { const [a, b, cc, d] = m.z; o = smooth(a, b, c.z) * (1 - smooth(cc, d, c.z)); }
    else if (m.kind === "dest") o = smooth(0.4, 0.47, p) * (1 - smooth(0.62, 0.7, p));
    else o = smooth(9, 10.5, c.z) * (1 - smooth(0.9, 0.97, p));
    m.el.style.setProperty("--o", o.toFixed(3));
  }
}

/* ── 2 · X-ray ── */
const xray = $(".xray"), xrayS = S(".xray");
let xpic = null, xvis = false;
const scanEl = $("[data-scan]");
if (xray && !reduced) {
  const fig = $(".xray-fig", xray), cv = $(".xray-gl", xray), img = $("img", fig);
  new IntersectionObserver((es) => {
    xvis = es[0].isIntersecting;
    if (xvis && !xpic) {
      img.loading = "eager";
      xpic = new Picture(cv, img, "xray");
      if (!xpic.gl) { xpic = null; return; }
      xpic.ready.then(() => { xray.classList.add("gl-on"); xpic.resize(); });
      cv.addEventListener("gl-lost", () => { xray.classList.remove("gl-on"); xpic = null; });
    }
  }, { rootMargin: "100% 0px" }).observe(xray);
  fig.addEventListener("pointermove", (e) => { if (!xpic) return; xpic.pointer(e.clientX, e.clientY); if (e.pointerType === "mouse") xpic.lensTo = 0.17; });
  fig.addEventListener("pointerleave", () => { if (xpic) xpic.lensTo = 0; });
  addEventListener("resize", () => xpic && xpic.resize());
}
function updateXray(p, t) {
  const grow = smooth(0, 0.22, p);
  const scan = smooth(0.22, 0.86, p);
  xray.style.setProperty("--grow", grow.toFixed(4));
  if (scanEl) scanEl.textContent = String(Math.round(scan * 100)).padStart(3, "0");
  if (xpic && xpic.ok && xvis) { xpic.scan = scan; xpic.draw(t); }
}

/* ── 3 · Words ── */
const wordsEl = $("[data-words]");
let words = [];
if (wordsEl && !reduced) {
  const walk = (node) => {
    for (const ch of [...node.childNodes]) {
      if (ch.nodeType === 3) {
        const frag = document.createDocumentFragment();
        ch.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(" "));
          else { const s = document.createElement("span"); s.className = "w"; s.textContent = part; frag.appendChild(s); }
        });
        ch.replaceWith(frag);
      } else if (ch.nodeType === 1) walk(ch);
    }
  };
  walk(wordsEl);
  words = $$(".w", wordsEl);
}
let litN = -1;
function updateWords(p) {
  const n = Math.round(smooth(0.08, 0.82, p) * words.length);
  if (n === litN) return;
  litN = n;
  words.forEach((w, i) => w.classList.toggle("on", i < n));
}

/* ── 4 · Types drum ── */
const types = $(".types"), typesS = S(".types");
const ring = $(".types-ring"), cards = $$(".types-ring > li");
const tnow = $("[data-tnow]");
let lastIdx = -1;
function updateTypes(p) {
  if (small()) return;
  const steps = cards.length - 1;
  const x = smooth(0.06, 0.94, p) * steps;
  const i = Math.floor(x), f = x - i;
  const eased = i + smooth(0.2, 0.8, f);
  const rot = -eased * 60;
  ring.style.setProperty("--rot", rot.toFixed(2) + "deg");
  cards.forEach((li, k) => {
    let a = ((k * 60 + rot) % 360 + 540) % 360 - 180;
    li.firstElementChild.style.setProperty("--f", Math.max(0, Math.cos((a * Math.PI) / 180)).toFixed(3));
  });
  const idx = Math.round(eased);
  if (idx !== lastIdx && tnow) { lastIdx = idx; tnow.textContent = String(idx + 1).padStart(2, "0"); }
}
if (types && !reduced) {
  // a focused card turns to the front
  cards.forEach((li, k) => li.firstElementChild.addEventListener("focus", () => {
    if (small()) return;
    const p = 0.06 + (k / (cards.length - 1)) * 0.88;
    U.scrollTo(typesS.top + typesS.len * p + 80, { immediate: true });
  }));
  // drag the drum: the drag moves the page, so drum and scroll never disagree
  const stage = $(".types-stage");
  let dragX = null, moved = 0;
  stage.addEventListener("pointerdown", (e) => { if (small() || e.pointerType !== "mouse") return; dragX = e.clientX; moved = 0; });
  addEventListener("pointermove", (e) => {
    if (dragX == null) return;
    const dx = e.clientX - dragX;
    dragX = e.clientX; moved += Math.abs(dx);
    if (moved > 4) U.scrollTo(scrollY - dx * (typesS.len / (cards.length * 260)) + 80, { immediate: true });
  });
  addEventListener("pointerup", () => { dragX = null; });
  stage.addEventListener("click", (e) => { if (moved > 6) { e.stopPropagation(); e.preventDefault(); moved = 0; } }, true);
}

/* ── 5 · Amenities trail ── */
const amen = $(".amen");
if (amen) {
  const A = U.assets + "img/";
  U.trail(amen, ["levan--tesis--golf", "levan--tesis--havuz", "levan--tesis--tenis", "levan--tesis--hamam", "levan--gun--cocuklar", "levan--tesis--spor-salonu", "levan--peyzaj", "levan--tesis--sauna", "levan--gun--golf", "levan--villa"].map((k) => A + k + ".webp"));
}

/* ── 6 · Log, sideways ── */
const log = $(".log"), logS = S(".log"), track = $(".log-track"), tday = $("[data-tday]");
let over = 0;
function fitLog() {
  if (!log || reduced) return;
  if (small()) { log.style.height = ""; return; }
  over = Math.max(0, track.scrollWidth - innerWidth);
  log.style.height = innerHeight + over * 1.15 + "px";
}
function updateLog(p) {
  if (small()) return;
  track.style.setProperty("--x", (-p * over).toFixed(1) + "px");
  if (tday) tday.textContent = String(Math.round(smooth(0.02, 0.9, p) * 84));
}
if (track && !reduced) {
  track.addEventListener("focusin", (e) => {
    if (small()) return;
    const card = e.target.closest(".lcard");
    if (!card) return;
    const p = clamp((card.offsetLeft - innerWidth * 0.3) / Math.max(1, over));
    U.scrollTo(logS.top + logS.len * p + 80, { immediate: true });
  });
}

/* ── Altimeter after the dive: from the landing height down to 0 m at the invitation ── */
function updateAlt() {
  if (!diveS || scrollY <= diveS.top + diveS.len) return;
  const start = diveS.top + diveS.len, end = Math.max(start + 1, document.documentElement.scrollHeight - innerHeight);
  const k = clamp((scrollY - start) / (end - start));
  U.altText = U.fmtAlt(landAlt * (1 - k));
}

/* ── Run ── */
function layout() { fitLog(); measure(); progress(); }
layout();
addEventListener("resize", layout);
if ("ResizeObserver" in window) new ResizeObserver(() => measure()).observe(document.body);
addEventListener("load", layout);

if (!reduced) {
  startMap().then(bootDone, (e) => { console.info("[irtifa] map unavailable, render only:", e.message); dive.classList.add("nomap"); bootDone(); });
  U.onFrame((t) => {
    progress();
    // at rest near the top the globe keeps turning slowly, and eases back as the descent begins
    lean[0] += (leanTo[0] - lean[0]) * 0.05; lean[1] += (leanTo[1] - lean[1]) * 0.05;
    if (diveS.p < 0.15) dive.style.setProperty("--lean", `${(-lean[0] * 30).toFixed(1)}px, ${(-lean[1] * 30).toFixed(1)}px`);
    const resting = mapOK && diveS.p < 0.1;
    if (resting) spin += 0.014 * (1 - spin / 40); else if (spin) spin = spin < 0.01 ? 0 : spin * 0.9;
    if (diveS.changed || !diveS.init || resting || Math.abs(spin) > 0.01) { diveS.init = true; updateDive(diveS.p); }
    updateAlt();
    if (xrayS.changed || (xpic && xvis)) updateXray(xrayS.p, t);
    if (S(".words").changed) updateWords(S(".words").p);
    if (typesS.changed || !typesS.init) { typesS.init = true; updateTypes(typesS.p); }
    if (logS.changed) updateLog(logS.p);
  });
} else {
  bootDone();
}
