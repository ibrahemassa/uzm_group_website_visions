/* Maket · home choreography.
 * Every [data-kf] element is a keyframe: when its top reaches the middle of the screen the model is in that state —
 * a named camera view (v), an hour of the day (h, running on past 24 into the next day), the highlighted kind of home
 * (cat), how far the blocks have risen (grow), how present the stage is (s) and whether the city map has taken over
 * (map, zoom). Between two keyframes everything blends with the scroll; a keyframe marked "cut" is reached with a quick
 * fade through the paper instead (the clock goes back to the morning for "Bir gün"). The visitor can turn the model
 * by dragging, and pick a home up off it. */
import * as THREE from "three";
import { Maket, HOME_TARGET } from "./maket.mjs";
import { KIND, nameOf, representative, closeView, fillInspector, attachPointer } from "./maket-ui.mjs";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const doc = document.documentElement, body = document.body;
const U = window.UZM || {};
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const phoneQ = matchMedia("(max-width: 47.99rem)");
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

body.classList.add("has-stage");
const stage = $("#stage"), loader = $("#loader"), tagsEl = $("#tags"), cursorTag = $("#cursor-tag"), inspector = $("#inspector");
const clockEl = $(".hdr-time");


/* ── Keyframes ── */
const anchors = $$("[data-kf]").map((el) => ({ el, kf: JSON.parse(el.dataset.kf), y: 0, pin: el.closest(".pin") }));
const pins = $$(".pin").map((sec) => ({ sec, steps: anchors.filter((a) => a.pin === sec), plates: $$(".pin-plate", sec), moments: $$(".moments li", sec), diary: $$(".diary li", sec), at: -1 }));
// the reading line is the middle of the screen; the opening's keyframe sits on it at the very top of the page
const measure = () => anchors.forEach((a, i) => { a.y = a.el.getBoundingClientRect().top + scrollY; if (i === 0) a.y = Math.max(a.y, innerHeight * 0.5); });

/* ── Views (computed once the model is in, phones frame it in the top half) ── */
let views = {};
function buildViews(m) {
  const ph = phoneQ.matches;
  const sx = ph ? 0 : 0.17, ly = ph ? 0.2 : 0, far = ph ? 1.5 : 1;
  const V = (o) => ({ fov: 26, shift: 0, lift: 0, target: HOME_TARGET.clone(), ...o });
  const day = (az, el, d) => V({ az, el, dist: d * far, shift: -sx, lift: ly });
  views = {
    hero: V({ az: -2.5, el: 0.54, dist: 920 * far, target: V3(208, 8, 222), shift: ph ? 0 : 0.1, lift: ph ? 0.18 : 0.02 }),
    levan: V({ az: -2.78, el: 0.36, dist: 560 * (ph ? 1.35 : 1), target: V3(205, 12, 255), shift: -sx, lift: ly }),
    types: V({ az: -2.05, el: 0.8, dist: 960 * far, shift: sx, lift: ly }),
    daire: m.frame("daire", { az: -2.15, el: 0.5, pad: ph ? 0.95 : 1.08, shift: sx, lift: ly }),
    ikiz: m.frame("ikiz", { az: -2.55, el: 0.62, pad: ph ? 0.9 : 1.05, shift: sx, lift: ly }),
    villa: m.frame("villa", { az: -2.95, el: 0.66, pad: ph ? 0.9 : 1.02, shift: sx, lift: ly }),
    malikane: m.frame("malikane", { az: -1.9, el: 0.55, pad: ph ? 1.2 : 1.5, shift: sx, lift: ly }),
    pick: V({ az: -2.35, el: 0.92, dist: 830 * far, shift: sx, lift: ly }),
    day0: day(-2.95, 0.56, 900), day1: day(-2.55, 0.55, 880), day2: day(-2.1, 0.52, 860),
    day3: day(-1.6, 0.46, 840), day4: day(-1.25, 0.44, 820), day5: day(-1.1, 0.44, 800),
    rise: V({ az: -0.4, el: 1.18, dist: 1500 * far }),
    top: V({ az: Math.PI / 2, el: 1.52, dist: 2300 * far }),
    build0: V({ az: -1.85, el: 0.5, dist: 640 * far, target: V3(150, 14, 165), shift: sx, lift: ly }),
    build1: V({ az: -2.0, el: 0.5, dist: 660 * far, target: V3(160, 14, 175), shift: sx, lift: ly }),
    build2: V({ az: -2.15, el: 0.52, dist: 700 * far, target: V3(175, 12, 190), shift: sx, lift: ly }),
    build3: V({ az: -2.3, el: 0.56, dist: 760 * far, target: V3(190, 10, 195), shift: sx, lift: ly }),
    build4: V({ az: -2.4, el: 0.6, dist: 820 * far, target: V3(200, 8, 195), shift: sx, lift: ly }),
    far: V({ az: -2.3, el: 0.42, dist: 1500 * far }),
    dusk: V({ az: -2.98, el: 0.3, dist: 640 * (ph ? 1.4 : 1), target: V3(200, 10, 252), shift: -sx, lift: ly }),
  };
}

/* ── State the scroll writes and the frame reads ── */
let m = null;
let userAz = 0, userVel = 0, dragging = false, lastInteract = 0, introT = reduced ? 1 : 0;
let current = { cat: undefined, seg: -1, hour: -1, light: "" };
// picking a home up brings the camera to it: focusT blends the scroll's view toward a close view of the home
let focusT = 0, focusView = null;

function update() {
  if (!m) return;
  const p = scrollY + innerHeight * 0.5;
  let i = 0;
  while (i < anchors.length - 1 && p >= anchors[i + 1].y) i++;
  const a = anchors[i], b = anchors[Math.min(i + 1, anchors.length - 1)];
  let t = b === a || p < a.y ? 0 : clamp((p - a.y) / (b.y - a.y));
  const cut = b !== a && b.kf.cut;
  let s = reduced ? (t < 0.5 ? 0 : 1) : smooth(t);
  let view, hour, dip = 0;
  if (cut) {
    // a cut: hold, fade through the paper, arrive
    dip = 1 - Math.abs(2 * t - 1);
    dip = smooth(clamp(dip * 1.6));
    const near = t < 0.5 ? a : b;
    view = views[near.kf.v];
    hour = near.kf.h;
  } else {
    view = Maket.mix(views[a.kf.v], views[b.kf.v], s);
    hour = lerp(a.kf.h, b.kf.h, s);
  }
  const k = (key, dflt) => lerp(a.kf[key] ?? dflt, b.kf[key] ?? dflt, s);
  const mapV = cut ? 0 : k("map", 0);
  const grow = k("grow", 1);
  const so = k("s", 1) * (1 - dip) * (1 - mapV);
  const cat = (t < 0.5 ? a : b).kf.cat ?? null;

  if (focusView && focusT > 0) view = Maket.mix(view, focusView, smooth(focusT));
  // the intro: the camera settles in as the blocks rise
  const it = easeOut(introT);
  const v = { ...view, target: view.target, az: view.az + userAz - (1 - it) * 0.5, dist: view.dist * (1 + (1 - it) * 0.28), el: view.el + (1 - it) * 0.12 };
  m.setView(v);
  m.setGrow(Math.min(grow, reduced ? 1 : clamp(introT * 1.15)));
  if (Math.abs(hour - current.hour) > 1e-3) { m.setTime(hour); current.hour = hour; writeLight(); }
  if (cat !== current.cat) { current.cat = cat; m.setCategory(cat); }
  if (i !== current.seg) { if (current.seg !== -1 && picked) drop(); current.seg = i; }
  stage.style.setProperty("--stage-o", so.toFixed(3));
  m.setVisible(so > 0.01);
  map.set(mapV, k("zoom", 0));

  // pinned plates and their moments
  for (const pn of pins) {
    let at = -1;
    pn.steps.forEach((st, j) => { if (p >= st.y - innerHeight * 0.18) at = j; });
    at = Math.max(0, at);
    const step = pn.steps[at]?.kf.step ?? at;
    if (step !== pn.at) {
      pn.at = step;
      pn.plates.forEach((pl) => pl.classList.toggle("on", +pl.dataset.step === step));
      pn.moments.forEach((li) => li.classList.toggle("on", +li.dataset.step === step));
    }
    if (pn.diary.length) {
      const g = clamp((p - pn.steps[0].y) / (pn.steps[pn.steps.length - 1].y - pn.steps[0].y || 1));
      const n = Math.round(g * (pn.diary.length - 1));
      pn.diary.forEach((li, j) => { li.classList.toggle("on", j === n); li.classList.toggle("done", j < n); });
    }
  }
  if (pins[0]) $$(".pickers button").forEach((bt) => bt.setAttribute("aria-pressed", String(!!picked && picked.kind === bt.dataset.pick)));
  updateTags(cat);
}

function writeLight() {
  const sky = m.sky;
  const hex = "#" + sky.bg.getHexString();
  doc.style.setProperty("--sky", hex);
  const light = sky.night > 0.5 ? "night" : "day";
  if (light !== current.light) {
    current.light = light;
    doc.dataset.light = light;
    $('meta[name="theme-color"]')?.setAttribute("content", hex);
  }
  if (clockEl) {
    const h = ((current.hour % 24) + 24) % 24, hh = Math.floor(h), mm = Math.floor((h - hh) * 60 / 5) * 5;
    const txt = String(hh).padStart(2, "0") + "." + String(mm).padStart(2, "0");
    if (clockEl.textContent !== txt) clockEl.textContent = txt;
    const dc = $(".day-clock");
    if (dc) { $(".day-hh", dc).textContent = String(hh).padStart(2, "0"); $(".day-mm", dc).textContent = String(mm).padStart(2, "0"); }
  }
}

/* ── Labels on the model ── */
let tagList = [];
function setTags(list) {
  tagsEl.innerHTML = "";
  tagList = list.map((t) => {
    const el = document.createElement("span");
    el.textContent = t.text;
    tagsEl.appendChild(el);
    requestAnimationFrame(() => el.classList.add("on"));
    return { ...t, el };
  });
}
let tagKey = "";
function updateTags(cat) {
  const key = (cat || "") + "|" + (picked ? picked.name : "");
  if (key === tagKey) return;
  tagKey = key;
  const list = [];
  if (picked) list.push({ text: nameOf(picked), pos: () => topOf(picked, 3) });
  else if (cat === "daire" && !phoneQ.matches) m.ofKind("daire").forEach((n) => list.push({ text: n.name.replace("block_", ""), pos: () => topOf(n, 2) }));
  else if (cat === "daire") { const b = m.boxOf("daire"), c = b.getCenter(V3()); list.push({ text: KIND.daire.many, pos: () => V3(c.x, b.max.y + 4, c.z) }); }
  else if (cat) {
    const b = m.boxOf(cat), c = b.getCenter(V3());
    list.push({ text: KIND[cat].many, pos: () => V3(c.x, b.max.y + 6, c.z) });
  }
  setTags(list);
}
const topOf = (n, extra) => {
  const lifted = picked === n ? Math.max(14, n.size.y * 1.15) : 0;
  return V3(n.center.x, n.box.max.y + extra + lifted, n.center.z);
};
function placeTags() {
  for (const t of tagList) {
    const q = m.project(t.pos());
    t.el.style.transform = `translate(${q.x.toFixed(1)}px, ${(q.y - 14).toFixed(1)}px) translate(-50%, -100%)`;
    t.el.style.visibility = q.visible ? "" : "hidden";
  }
}

/* ── Picking a home up off the model ── */
let picked = null;
function inspect(node, from) {
  if (!node) return;
  picked = node;
  m.lift(node);
  tagKey = "";
  focusView = closeView(node, { az: (m.view.az ?? -2.2) - userAz, phone: phoneQ.matches });
  fillInspector(inspector, node, U);
  inspector.hidden = false;
  requestAnimationFrame(() => inspector.classList.add("on"));
  if (from && from.focus) from.focus();
  update();
}
function drop() {
  picked = null;
  m.lift(null);
  tagKey = "";
  inspector.classList.remove("on");
  setTimeout(() => { if (!picked) inspector.hidden = true; }, reduced ? 0 : 450);
  update();
}
$("[data-drop]", inspector)?.addEventListener("click", drop);
addEventListener("keydown", (e) => { if (e.key === "Escape" && picked && !document.querySelector("dialog[open]")) drop(); });
$$("[data-pick]").forEach((bt) => bt.addEventListener("click", () => {
  if (!m) return;
  const n = representative(m, bt.dataset.pick);
  if (picked === n) drop(); else inspect(n, bt);
}));

/* ── Pointer: drag to turn, hover to lift a little, click to pick up ── */
let pointer = null;
function bindPointer(canvas) {
  pointer = attachPointer(m, canvas, {
    onDown: () => { userVel = 0; lastInteract = performance.now(); },
    onDragStart: () => { dragging = true; stage.classList.add("dragging"); },
    onDrag: (dx) => { userAz += dx * 0.0055; userVel = dx * 0.0055; lastInteract = performance.now(); update(); },
    onDragEnd: () => { dragging = false; stage.classList.remove("dragging"); },
    onPick: (n) => { if (n) { if (picked === n) drop(); else inspect(n); } else if (picked) drop(); },
    onHover: (n, x, y) => {
      stage.classList.toggle("over", !!n);
      if (!n) { cursorTag.classList.remove("on"); return; }
      cursorTag.textContent = nameOf(n) + (picked === n ? "" : " · seçin");
      cursorTag.style.left = x + "px"; cursorTag.style.top = y + "px";
      cursorTag.classList.add("on");
    },
  });
}

/* ── The city map takes over from the model ── */
const LEVAN = [28.686205, 41.107178];
const DESTS = [
  { id: "levent", name: "5. Levent", min: 15, at: [29.0105, 41.0815] },
  { id: "ist", name: "İstanbul Havalimanı", min: 20, at: [28.7519, 41.2753] },
  { id: "istoc", name: "İSTOÇ", min: 15, at: [28.8195, 41.0662] },
];
const map = {
  ml: null, inst: null, loading: false, v: 0, z: 0, el: $("#mapstage"),
  async init() {
    if (this.loading) return;
    this.loading = true;
    try {
      const base = new URL(U.assets + "vendor/maplibre/", location.href).href;
      const css = document.createElement("link");
      css.rel = "stylesheet"; css.href = base + "maplibre-gl.css";
      document.head.appendChild(css);
      const [ml, style] = await Promise.all([import(base + "maplibre-gl.mjs"), fetch("https://tiles.openfreemap.org/styles/positron").then((r) => { if (!r.ok) throw new Error("style"); return r.json(); })]);
      ml.setWorkerUrl(base + "maplibre-gl-worker.mjs");
      restyle(style);
      style.sources.uzm = { type: "geojson", data: { type: "FeatureCollection", features: DESTS.map((d) => ({ type: "Feature", properties: { id: d.id }, geometry: { type: "LineString", coordinates: [LEVAN, d.at] } })) } };
      style.layers.push({ id: "uzm-lines", type: "line", source: "uzm", paint: { "line-color": "#18181a", "line-width": 1.4, "line-dasharray": [2, 2], "line-opacity": 0 } });
      this.ml = ml;
      this.inst = new ml.Map({ container: this.el, style, center: LEVAN, zoom: 15, pitch: 0, bearing: 0, interactive: false, attributionControl: { compact: true }, fadeDuration: 0 });
      const pin = (cls, html, at) => { const d = document.createElement("div"); d.className = "map-pin " + cls; d.innerHTML = html; new ml.Marker({ element: d, anchor: "bottom" }).setLngLat(at).addTo(this.inst); return d; };
      this.levanPin = pin("levan", "<i></i><span>Levan Bahçeşehir</span>", LEVAN);
      this.pins = DESTS.map((d) => pin("dest", `<span><b>${d.min} dk</b> · ${d.name}</span><i></i>`, d.at));
      this.inst.on("load", () => this.apply());
    } catch (e) {
      console.warn("Maket: map unavailable", e);
      this.failed = true;
    }
  },
  set(v, z) {
    this.v = v; this.z = z;
    if (v > 0.001 && !this.inst && !this.failed) this.init();
    this.el.style.setProperty("--map-o", (this.failed ? 0 : v).toFixed(3));
    this.apply();
  },
  apply() {
    const M = this.inst;
    if (!M || this.v < 0.001) return;
    const z = smooth(this.z), ph = phoneQ.matches;
    const centre = [lerp(LEVAN[0], 28.85, z), lerp(LEVAN[1], 41.165, z)];
    M.jumpTo({ center: centre, zoom: lerp(15.2, ph ? 9.35 : 10.35, z), pitch: lerp(0, 28, z), bearing: lerp(0, -8, z), padding: ph ? { bottom: innerHeight * 0.5 } : { left: Math.min(560, innerWidth * 0.42) } });
    if (M.getLayer("uzm-lines")) M.setPaintProperty("uzm-lines", "line-opacity", clamp(z * 2 - 0.4));
    (this.pins || []).forEach((p) => (p.style.opacity = clamp(z * 2.2 - 0.6).toFixed(2)));
  },
};
function restyle(style) {
  for (const l of style.layers) {
    const id = l.id;
    l.paint = l.paint || {};
    if (l.type === "background") l.paint["background-color"] = "#ebe8e2";
    else if (id === "water") l.paint["fill-color"] = "#cdd8d9";
    else if (id === "waterway") l.paint["line-color"] = "#c3cfd1";
    else if (/park|landcover_wood|landcover_glacier|landcover_ice/.test(id)) { l.paint["fill-color"] = "#dde0cf"; l.paint["fill-opacity"] = 1; }
    else if (id === "landuse_residential") { l.paint["fill-color"] = "#e4e0d8"; l.paint["fill-opacity"] = 1; }
    else if (id === "building") l.paint["fill-color"] = "#dcd7ce";
    else if (/aeroway/.test(id)) { if (l.type === "line") l.paint["line-color"] = "#d6d0c5"; else l.paint["fill-color"] = "#dfdad1"; }
    else if (l.type === "line" && /casing/.test(id)) l.paint["line-color"] = "#d9d3c8";
    else if (l.type === "line" && /motorway/.test(id)) l.paint["line-color"] = /subtle/.test(id) ? "#d8d0c0" : "#bfb39c";
    else if (l.type === "line" && /highway_major/.test(id)) l.paint["line-color"] = "#f6f4ef";
    else if (l.type === "line" && /highway_minor|road_pier/.test(id)) l.paint["line-color"] = "#f3f0ea";
    else if (l.type === "line" && /railway/.test(id)) l.paint["line-color"] = "#cfc9be";
    else if (l.type === "line" && /boundary/.test(id)) l.paint["line-color"] = "#c9c3b8";
    else if (l.type === "symbol") {
      if (/shield|poi/.test(id)) { l.layout = { ...(l.layout || {}), visibility: "none" }; continue; }
      l.paint["text-color"] = /label_city/.test(id) ? "#3f3c37" : "#6b675f";
      l.paint["text-halo-color"] = "#ebe8e2";
      l.paint["text-halo-width"] = 1.4;
    }
  }
}

/* ── Start ── */
function noGL() {
  doc.classList.add("no-gl");
  body.classList.remove("has-stage");
  loader?.remove();
}
async function start() {
  const test = document.createElement("canvas");
  if (!test.getContext("webgl2")) return noGL();
  const ring = $(".loader-ring"), num = $(".loader-n");
  try {
    m = await Maket.create(stage, {
      url: new URL("../model/levan.glb", import.meta.url).href,
      onProgress: (p) => { ring?.style.setProperty("--p", p.toFixed(3)); if (num) num.textContent = Math.round(p * 100); },
    });
  } catch (e) {
    console.warn("Maket: model unavailable, showing still images", e);
    return noGL();
  }
  window.__maket = m;
  window.__map = map;
  bindPointer(m.renderer.domElement);
  buildViews(m);
  measure();
  current.hour = -1;
  update();
  stage.classList.add("ready");
  doc.classList.add("ready-gl");
  loader.classList.add("done");
  $(".loader-t").textContent = "Maket hazır";
  setTimeout(() => loader.remove(), 1200);
  m.on((type) => { if (type === "frame") placeTags(); });

  // the intro and the idle turntable run in one small loop
  let last = performance.now();
  const introStart = performance.now();
  const tick = (now) => {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    let changed = false;
    // wall-clock, so a slow machine doesn't stretch the opening
    if (introT < 1) { introT = Math.min(1, (now - introStart) / 2800); changed = true; }
    if (!dragging && Math.abs(userVel) > 1e-4) { userAz += userVel; userVel *= 0.92; changed = true; }
    const ft = picked ? 1 : 0;
    if (focusT !== ft) { focusT = reduced ? ft : clamp(focusT + (ft ? dt / 1.3 : -dt / 1.0)); if (!focusT) focusView = null; changed = true; }
    // turntable: in the opening only, after a quiet moment
    const inHero = scrollY < innerHeight * 0.35;
    if (!reduced && inHero && !dragging && !picked && now - lastInteract > 2500 && !document.hidden) { userAz += dt * 0.035; changed = true; }
    if (changed) update();
  };
  requestAnimationFrame(tick);
}

let ticking = false;
addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; update(); }); } }, { passive: true });
const remeasure = () => { if (!m) return; buildViews(m); measure(); update(); };
addEventListener("resize", remeasure);
phoneQ.addEventListener?.("change", remeasure);
document.fonts?.ready.then(remeasure);
new ResizeObserver(() => { measure(); update(); }).observe($("main"));
start();
