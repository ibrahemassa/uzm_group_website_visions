/* İrtifa · projects.
   Projeler: the night map. MapLibre in the shared night style (flat, mercator), gold beacons on the projects, the 5,
   10 and 15 km rings round Levan as faint gold circles under a slow radar sweep, and the route list beside it:
   choosing a place flies the camera there, a route arc draws itself out from Levan, the readouts follow the flight
   (latitude, longitude, altitude) and the lock closes on the pin when it lands. The map loads only near the viewport;
   without WebGL, the library or the tiles, the drawn chart under it stays and the list still picks pins on it.
   Project pages: the cover photograph as an x-ray (gold lines turned into the photo by a scan line the scroll drives,
   a lens at the pointer showing the other state), the pool through an opening porthole (Viktorya), arches that
   develop out of a gold negative (Ağaçelebi), and a sideways gallery on the scroll that can also be dragged. */
import { Picture } from "./gl.mjs";
import { loadML, nightStyle, hasGL, TR } from "./nightmap.mjs";

const U = window.UZM;
const { $, $$, clamp } = U;
const reduced = U.reduced;
const small = () => innerWidth < 768;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const pad = (n, l = 2) => String(n).padStart(l, "0");
const up = (s) => s.toLocaleUpperCase("tr-TR");

/* ── Pinned scenes: progress 0..1 while each [data-scene] scrolls past ── */
const scenes = $$("[data-scene]").map((el) => ({ el, top: 0, len: 1, p: -1, changed: true }));
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
const sceneOf = (el) => scenes.find((s) => s.el === el);

/* ════════════════ Projeler: the night map ════════════════ */
const fmtLat = (v) => U.fmt(Math.abs(v), 4) + "° " + (v >= 0 ? "K" : "G");
const fmtLon = (v) => U.fmt(Math.abs(v), 4) + "° " + (v >= 0 ? "D" : "B");
const kmLon = (km, lat) => km / (111.32 * Math.cos((lat * Math.PI) / 180));
const kmLat = (km) => km / 110.57;
function circle([lng, lat], km, steps = 160) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    pts.push([lng + kmLon(km, lat) * Math.cos(a), lat + kmLat(km) * Math.sin(a)]);
  }
  return pts;
}
// a gentle arc between two places (the route drawn out from Levan)
function arc(a, b, bend = 0.16) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const c = [(a[0] + b[0]) / 2 - dy * bend, (a[1] + b[1]) / 2 + dx * bend];
  const pts = [];
  for (let i = 0; i <= 64; i++) {
    const t = i / 64, u = 1 - t;
    pts.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
  }
  return pts;
}
const grad = (k) => {
  k = Math.max(0.0001, Math.min(0.9998, k));
  return ["interpolate", ["linear"], ["line-progress"], 0, "rgba(242,201,126,0.3)", k, "#fff1cc", Math.min(0.9999, k + 0.0001), "rgba(0,0,0,0)"];
};
const EMPTY = { type: "FeatureCollection", features: [] };

const atlasEl = $(".atlas");
if (atlasEl) atlas(atlasEl);

function atlas(sec) {
  const box = $(".atlas-map", sec), holder = $(".atlas-gl", box), panel = $(".atlas-panel", sec), head = $(".atlas-head", sec);
  const dock = $(".atlas-dock", box), reset = $(".atlas-reset", box);
  const R = { stat: $("[data-a-stat]", box), name: $("[data-a-name]", box), dist: $("[data-a-dist]", box), lat: $("[data-a-lat]", box), lon: $("[data-a-lon]", box), alt: $("[data-a-alt]", box) };
  const wide = () => matchMedia("(min-width: 60.01rem)").matches;
  const HOME = "ROTA PLANI · 06 HEDEF";
  const rows = $$(".places > li", panel).map((li) => ({
    li, id: li.dataset.id, kind: li.dataset.kind, at: [+li.dataset.lng, +li.dataset.lat], approx: li.hasAttribute("data-approx"),
    name: $(".place-nm", li).textContent.trim(), dist: $(".place-d", li).textContent.trim(), more: $(".place-more", li),
  }));
  const levan = rows.find((r) => r.kind === "levan");
  let picked = null, view = null;

  // each row's head becomes the button that picks it; its note and link open beneath it
  rows.forEach((r) => {
    const div = $(".place", r.li), b = document.createElement("button");
    b.type = "button";
    b.className = "place";
    b.innerHTML = div.innerHTML;
    b.append(Object.assign(document.createElement("span"), { className: "sr", textContent: ", haritada gösterin" }));
    r.more.id = "yer-" + r.id;
    r.more.hidden = true;
    b.setAttribute("aria-expanded", "false");
    b.setAttribute("aria-controls", r.more.id);
    div.replaceWith(b);
    r.btn = b;
    b.addEventListener("click", () => choose(picked === r ? null : r));
    b.addEventListener("pointerenter", () => hot(r, true));
    b.addEventListener("pointerleave", () => hot(r, false));
    b.addEventListener("focus", () => hot(r, true));
    b.addEventListener("blur", () => hot(r, false));
  });
  // the list scrolls inside itself only when it is taller than the screen
  const fitPanel = () => panel.toggleAttribute("data-lenis-prevent", wide() && panel.scrollHeight > panel.clientHeight + 2);

  const sheetPins = new Map($$(".sheet .pin", box).map((p) => [p.dataset.id, p]));
  const glPins = new Map();
  const pinsOf = (id) => [sheetPins.get(id), glPins.get(id)].filter(Boolean);
  const bindPin = (el, r) => {
    el.addEventListener("pointerenter", () => hot(r, true));
    el.addEventListener("pointerleave", () => hot(r, false));
    el.addEventListener("click", (e) => { e.stopPropagation(); choose(picked === r ? null : r); });
  };
  rows.forEach((r) => { const p = sheetPins.get(r.id); if (p) bindPin(p, r); });
  function hot(r, on) {
    r.li.classList.toggle("hot", on);
    pinsOf(r.id).forEach((p) => p.classList.toggle("hot", on));
  }
  const stat = (t) => U.scramble(R.stat, t, 420);

  function choose(r) {
    picked = r;
    rows.forEach((x) => {
      const on = x === r;
      x.btn.setAttribute("aria-expanded", String(on));
      x.more.hidden = !on;
      x.li.classList.toggle("on", on);
      pinsOf(x.id).forEach((p) => { p.classList.toggle("on", on); p.classList.remove("locked"); });
    });
    reset.hidden = !r;
    U.scramble(R.name, r ? up(r.name) : "GENEL BAKIŞ", 520);
    U.scramble(R.dist, r ? up(r.dist) : "—", 520);
    fitPanel();
    if (view) view.go(r);
    else {
      // the drawn chart: the readouts jump straight to the target
      const at = r ? r.at : levan.at;
      U.scramble(R.lat, fmtLat(at[1]), 520);
      U.scramble(R.lon, fmtLon(at[0]), 520);
      stat(r ? (r.approx ? "HEDEF · YAKLAŞIK KONUM" : "HEDEF SEÇİLDİ") : HOME);
      if (r) pinsOf(r.id).forEach((p) => p.classList.add("locked"));
    }
    // on phones the list sits under the map: bring the map back up
    if (r && !wide()) {
      const t = box.getBoundingClientRect().top;
      if (t < 0 || t > innerHeight * 0.45) U.scrollTo(box);
    }
  }
  reset.addEventListener("click", () => { const was = picked; choose(null); if (was) was.btn.focus(); });
  fitPanel();
  addEventListener("resize", fitPanel);

  if (!hasGL()) return;
  const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); start(); } }, { rootMargin: "400px 0px" });
  io.observe(box);

  async function start() {
    const note = Object.assign(document.createElement("p"), { className: "atlas-load", textContent: "Canlı harita yükleniyor…" });
    note.setAttribute("role", "status");
    box.appendChild(note);
    try { view = await live(); }
    catch (e) { console.warn("[irtifa] harita gösterilemiyor; çizim kalıyor:", e && e.message); }
    finally { note.remove(); }
  }

  async function live() {
    const ml = await loadML();
    const style = nightStyle({
      globe: false,
      sources: {
        rings: { type: "geojson", data: { type: "FeatureCollection", features: [5, 10, 15].map((km) => ({ type: "Feature", properties: { km }, geometry: { type: "LineString", coordinates: circle(levan.at, km) } })) } },
        route: { type: "geojson", data: EMPTY, lineMetrics: true },
      },
      layers: [
        { id: "rings-glow", type: "line", source: "rings", paint: { "line-color": "#dcb46a", "line-width": 6, "line-blur": 6, "line-opacity": 0.08 } },
        { id: "rings", type: "line", source: "rings", paint: { "line-color": "#dcb46a", "line-width": 1, "line-opacity": 0.55, "line-dasharray": [2, 3] } },
        { id: "route-glow", type: "line", source: "route", layout: { "line-cap": "round" }, paint: { "line-color": "#f2c97e", "line-width": 9, "line-blur": 8, "line-opacity": 0 } },
        { id: "route", type: "line", source: "route", layout: { "line-cap": "round" }, paint: { "line-width": 2, "line-gradient": grad(0) } },
      ],
    });
    const map = new ml.Map({
      container: holder, style, center: levan.at, zoom: 10, pitch: 30, bearing: -10, maxPitch: 70,
      cooperativeGestures: true, attributionControl: false, locale: TR, fadeDuration: 0,
      pixelRatio: Math.min(devicePixelRatio || 1, small() ? 1.5 : 1.75),
    });
    map.addControl(new ml.NavigationControl({ visualizePitch: true }), "bottom-right");
    map.on("error", (e) => console.warn("[irtifa] harita:", (e.error && e.error.message) || e));

    // keep every target in the free band between the overlays
    const padding = () => {
      const W = holder.clientWidth, H = holder.clientHeight;
      if (!wide()) return { top: 56, bottom: Math.min(H * 0.4, dock.offsetHeight + 36), left: 36, right: 36 };
      const m = holder.getBoundingClientRect(), h = head.getBoundingClientRect(), d = dock.getBoundingClientRect(), p = panel.getBoundingClientRect();
      let left = Math.max(h.right, d.right) - m.left + 40, right = m.right - p.left + 40;
      const spare = W - 280 - left - right;
      if (spare < 0) { left += spare / 2; right += spare / 2; }
      return { top: Math.min(H * 0.3, 110), bottom: 70, left: Math.max(20, left), right: Math.max(20, right) };
    };
    const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
    const overviewCam = () => {
      const P = padding(), W = Math.max(200, holder.clientWidth - P.left - P.right), H = Math.max(200, holder.clientHeight - P.top - P.bottom);
      const lons = rows.map((r) => r.at[0]), lats = rows.map((r) => r.at[1]);
      const x0 = Math.min(...lons), x1 = Math.max(...lons), y0 = Math.min(...lats), y1 = Math.max(...lats);
      const fx = (x1 - x0) / 360, fy = (merc(y1) - merc(y0)) / (2 * Math.PI);
      const zoom = Math.log2(Math.min(W / (fx * 512), H / (fy * 512))) - 0.3;
      const cy = (Math.atan(Math.sinh((merc(y0) + merc(y1)) / 2)) * 180) / Math.PI;
      return { center: [(x0 + x1) / 2, cy], zoom: clamp(zoom, 8, 12.5), pitch: 30, bearing: -10, padding: P };
    };
    const focusCam = (r) => ({
      center: r.at, zoom: r.approx ? 13.3 : r.kind === "levan" ? 14.2 : 15.6,
      pitch: r.kind === "office" ? 58 : 52, bearing: r.kind === "levan" ? 14 : -22, padding: padding(),
    });
    map.jumpTo(overviewCam());

    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error("zaman aşımı")), 30000);
      map.once("load", () => { clearTimeout(t); res(); });
    }).catch((e) => { map.remove(); throw e; });

    // beacons and office points (the chart's own pins, rebuilt as markers)
    rows.forEach((r) => {
      const src = sheetPins.get(r.id);
      const el = document.createElement("div");
      el.className = src.className;
      el.dataset.id = r.id;
      el.innerHTML = src.innerHTML;
      const mbox = document.createElement("div");
      mbox.className = "mk-box";
      mbox.setAttribute("aria-hidden", "true");
      mbox.appendChild(el);
      new ml.Marker({ element: mbox, anchor: "center" }).setLngLat(r.at).addTo(map);
      glPins.set(r.id, el);
      bindPin(el, r);
      if (picked === r) el.classList.add("on");
    });
    // ring labels and the sweep, laid flat on the ground
    const a = (-38 * Math.PI) / 180;
    [5, 10, 15].forEach((km) => {
      const el = document.createElement("div");
      el.className = "mk-ring";
      el.setAttribute("aria-hidden", "true");
      el.textContent = km + " KM";
      new ml.Marker({ element: el, anchor: "center", pitchAlignment: "map", rotationAlignment: "map" })
        .setLngLat([levan.at[0] + kmLon(km, levan.at[1]) * Math.cos(a), levan.at[1] + kmLat(km) * Math.sin(a)]).addTo(map);
    });
    const sw = document.createElement("div");
    sw.className = "mk-sweep";
    sw.setAttribute("aria-hidden", "true");
    sw.innerHTML = "<span></span>";
    new ml.Marker({ element: sw, anchor: "center", pitchAlignment: "map", rotationAlignment: "map" }).setLngLat(levan.at).addTo(map);
    const mpp = (z, lat) => (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * Math.pow(2, z));
    let lastD = -1;
    const sizeSweep = () => {
      const z = map.getZoom(), show = z < 12.4;
      const d = show ? Math.min(4000, Math.round((2 * 15000) / mpp(z, levan.at[1]))) : 0;
      if (d !== lastD) { lastD = d; sw.style.width = sw.style.height = d + "px"; }
    };
    const altitude = () => 1.5 * holder.clientHeight * mpp(map.getZoom(), map.getCenter().lat) * Math.cos((map.getPitch() * Math.PI) / 180);

    // the readouts follow the camera, once a frame at most
    let dirty = true;
    map.on("move", () => { dirty = true; });
    U.onFrame(() => {
      if (!dirty) return;
      dirty = false;
      const c = map.getCenter();
      R.lat.textContent = fmtLat(c.lat);
      R.lon.textContent = fmtLon(c.lng);
      R.alt.textContent = U.fmtAlt(altitude());
      sizeSweep();
    });

    // the route arc draws itself out from Levan
    const route = map.getSource("route");
    let routeAnim = 0;
    const drawRoute = (r) => {
      cancelAnimationFrame(routeAnim);
      if (!r || r === levan) { route.setData(EMPTY); return; }
      route.setData({ type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: arc(levan.at, r.at) } }] });
      if (reduced) { map.setPaintProperty("route", "line-gradient", grad(1)); map.setPaintProperty("route-glow", "line-opacity", 0.35); return; }
      const t0 = performance.now();
      const step = (t) => {
        const k = clamp((t - t0) / 1700), e = 1 - Math.pow(1 - k, 3);
        map.setPaintProperty("route", "line-gradient", grad(e));
        map.setPaintProperty("route-glow", "line-opacity", 0.35 * e);
        if (k < 1) routeAnim = requestAnimationFrame(step);
      };
      routeAnim = requestAnimationFrame(step);
    };

    let tok = 0;
    const arrive = (r) => {
      if (!r) { stat(HOME); return; }
      stat(r.approx ? "HEDEF KİLİTLENDİ · YAKLAŞIK" : "HEDEF KİLİTLENDİ");
      pinsOf(r.id).forEach((p) => p.classList.add("locked"));
    };
    const go = (r) => {
      const my = ++tok;
      drawRoute(r);
      stat(r ? "ROTA · " + up(r.name) : "GENEL BAKIŞ");
      map.flyTo({ ...(r ? focusCam(r) : overviewCam()), duration: reduced ? 0 : r ? 2800 : 2200, curve: 1.6, essential: true });
      if (reduced) { arrive(r); return; }
      // registered after flyTo: an interrupted flight's own moveend has already gone by
      map.once("moveend", () => { if (my === tok) arrive(r); });
    };

    box.classList.add("gl");
    // a real resize re-frames the view (the observer's first call is only the initial size: leave any flight be)
    let seen = false;
    new ResizeObserver(() => { map.resize(); if (seen) map.jumpTo(picked ? focusCam(picked) : overviewCam()); seen = true; }).observe(holder);
    if (picked) go(picked);
    else stat(HOME);
    return { go };
  }
}

/* ════════════════ Project pages ════════════════ */

/* ── X-ray hero: the drawing becomes the photograph as the scroll runs the scan line down ── */
const hero = $(".pjh");
let heroPic = null, heroVis = true;
const heroEls = hero && { pin: $(".pjh-pin", hero), photo: $(".pjh-photo", hero), cv: $(".pjh-gl", hero), scan: $("[data-scan]", hero), state: $("[data-state]", hero), copy: $(".pjh-copy", hero) };
let heroState = "";
if (hero && !reduced) {
  const { pin, photo, cv } = heroEls;
  heroPic = new Picture(cv, photo, "xray");
  if (!heroPic.gl) heroPic = null;
  else {
    heroPic.str = 0.9;
    heroPic.ready.then(() => { hero.classList.add("gl-on"); heroPic.resize(); });
    cv.addEventListener("gl-lost", () => { hero.classList.remove("gl-on"); heroPic = null; });
  }
  new IntersectionObserver((es) => { heroVis = es[0].isIntersecting; }).observe(hero);
  pin.addEventListener("pointermove", (e) => {
    if (!heroPic) return;
    heroPic.pointer(e.clientX, e.clientY);
    if (e.pointerType === "mouse") heroPic.lensTo = 0.15;
  });
  pin.addEventListener("pointerleave", () => { if (heroPic) heroPic.lensTo = 0; });
  addEventListener("resize", () => heroPic && heroPic.resize());
}
function updateHero(p, t) {
  const out = smooth(0.02, 0.26, p), scan = smooth(0.08, 0.8, p), done = smooth(0.82, 0.96, p);
  hero.style.setProperty("--out", out.toFixed(4));
  hero.style.setProperty("--scan", scan.toFixed(4));
  hero.style.setProperty("--done", done.toFixed(4));
  // once it has faded, the title's links leave the tab order
  hero.style.setProperty("--copy-vis", out > 0.98 ? "hidden" : "visible");
  if (heroEls.scan) heroEls.scan.textContent = pad(Math.round(scan * 100), 3);
  const st = scan < 0.01 ? "ÇİZİM" : scan < 0.99 ? "TARANIYOR" : "FOTOĞRAF";
  if (st !== heroState && heroEls.state) { heroState = st; U.scramble(heroEls.state, st, 380); }
  if (heroPic && heroPic.ok && heroVis) {
    heroPic.scan = scan;
    heroPic.zoom = 1 + p * 0.08;
    heroPic.draw(t);
  }
}

/* ── Viktorya: the porthole opens onto the pool (the water itself is stirred by site.mjs's [data-liquid]) ── */
const pool = $(".pool");
// its title is data-manual: it rises once the porthole has opened, not while it is still dark
const poolTitle = pool && $("h2[data-split]", pool);
function updatePool(p) {
  const txt = smooth(0.42, 0.7, p);
  pool.style.setProperty("--iris", smooth(0.04, 0.55, p).toFixed(4));
  pool.style.setProperty("--txt", txt.toFixed(4));
  if (poolTitle && txt > 0.25) poolTitle.classList.add("in");
}

/* ── Ağaçelebi: the arches develop out of a gold negative; the pointer peeks back through ── */
const arcs = $$(".arc");
if (arcs.length && !reduced && "IntersectionObserver" in window) {
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    const el = e.target;
    setTimeout(() => { el.classList.add("dev"); setTimeout(() => el.classList.add("done"), 2000); }, 250 + arcs.indexOf(el) * 260);
  }), { threshold: 0.45 });
  arcs.forEach((a) => io.observe(a));
  if (U.fine) arcs.forEach((a) => {
    const pic = $(".arc-pic", a);
    pic.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const r = pic.getBoundingClientRect();
      pic.style.setProperty("--mx", (e.clientX - r.left).toFixed(0) + "px");
      pic.style.setProperty("--my", (e.clientY - r.top).toFixed(0) + "px");
      if (a.classList.contains("done")) pic.classList.add("peek");
    });
    pic.addEventListener("pointerleave", () => pic.classList.remove("peek"));
  });
}

/* ── Gallery: sideways on the scroll; a drag moves the page, so track and scroll never disagree ── */
const gal = $(".gal");
const G = gal && { track: $(".gal-track", gal), now: $("[data-gnow]", gal), over: 0, last: -1 };
if (G) G.cards = $$(".gcard", G.track);
const galNow = (i) => { if (i !== G.last && G.now) { G.last = i; G.now.textContent = pad(i + 1); } };
function fitGal() {
  if (!gal || reduced) return;
  if (small()) { gal.style.height = ""; return; }
  G.over = Math.max(0, G.track.scrollWidth - innerWidth);
  gal.style.height = innerHeight + G.over * 1.1 + "px";
}
function updateGal(p) {
  if (small()) return;
  G.track.style.setProperty("--x", (-p * G.over).toFixed(1) + "px");
  galNow(Math.round(p * (G.cards.length - 1)));
}
if (G) {
  // phones: a snap strip, the counter follows it
  G.track.addEventListener("scroll", () => {
    const m = G.track.scrollWidth - G.track.clientWidth;
    galNow(Math.round((m > 0 ? G.track.scrollLeft / m : 0) * (G.cards.length - 1)));
  }, { passive: true });
}
if (G && !reduced) {
  const S = sceneOf(gal);
  let dragX = null, moved = 0;
  G.track.addEventListener("pointerdown", (e) => { if (small() || e.pointerType !== "mouse" || e.button !== 0) return; dragX = e.clientX; moved = 0; });
  addEventListener("pointermove", (e) => {
    if (dragX == null) return;
    const dx = e.clientX - dragX;
    dragX = e.clientX;
    moved += Math.abs(dx);
    if (moved > 4) { gal.classList.add("drag"); U.scrollTo(scrollY - dx * (S.len / Math.max(1, G.over)) + 80, { immediate: true }); }
  });
  addEventListener("pointerup", () => { dragX = null; gal.classList.remove("drag"); });
  // a drag is not a click: keep the lightbox shut
  G.track.addEventListener("click", (e) => { if (moved > 6) { e.stopPropagation(); e.preventDefault(); moved = 0; } }, true);
  G.track.addEventListener("dragstart", (e) => e.preventDefault());
  // keyboard: a focused picture is brought into view
  G.track.addEventListener("focusin", (e) => {
    if (small()) return;
    const card = e.target.closest(".gcard");
    if (!card) return;
    const r = card.getBoundingClientRect();
    if (r.left >= 0 && r.right <= innerWidth) return; // already in view (e.g. focus back from the lightbox)
    const p = clamp((card.offsetLeft - innerWidth * 0.3) / Math.max(1, G.over));
    U.scrollTo(S.top + S.len * p + 80, { immediate: true });
  });
}

/* ── Run ── */
// a re-layout redraws every scene once, even where the progress itself did not move
function layout() { fitGal(); measure(); progress(); scenes.forEach((s) => { s.force = true; }); }
layout();
addEventListener("resize", layout);
addEventListener("load", layout);
if ("ResizeObserver" in window) new ResizeObserver(() => measure()).observe(document.body);

if (!reduced && scenes.length) {
  U.onFrame((t) => {
    progress();
    for (const s of scenes) {
      const go = s.changed || s.force;
      s.force = false;
      if (s.el === hero) { if (go || (heroPic && heroVis)) updateHero(s.p, t); }
      else if (s.el === pool) { if (go) updatePool(s.p); }
      else if (s.el === gal) { if (go) updateGal(s.p); }
    }
  });
}
