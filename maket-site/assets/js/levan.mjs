/* Maket · Levan page. The model, free to explore: the camera eases toward a goal view that the visitor moves —
   drag to turn and tilt, buttons or Ctrl + scroll to zoom, arrow keys when the model has focus, chips that frame each
   kind of home, a top view, the sun's hour on a slider. Any home can be picked up off the model. Below it: the
   site plan's zones and the dated 360° tours (Kuula loads only when a tour is started). */
import * as THREE from "three";
import { Maket, HOME_TARGET } from "./maket.mjs";
import { KIND, nameOf, representative, closeView, fillInspector, attachPointer } from "./maket-ui.mjs";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const doc = document.documentElement, body = document.body;
const U = window.UZM || {};
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const phoneQ = matchMedia("(max-width: 47.99rem)");
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const wrapAngle = (a) => ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

body.classList.add("has-clock");
const host = $("#explore-stage"), section = $("#maket"), loader = $("#loader"), inspector = $("#inspector");
const tagsEl = $("#tags"), cursorTag = $("#cursor-tag"), clockEl = $(".hdr-time");
const sun = $("#sun"), sunOut = $("#sun-out");

let m = null, picked = null, cat = "", interacted = false;
const base = () => ({ az: -2.25, el: 0.62, dist: phoneQ.matches ? 1650 : 1180, fov: 26, target: HOME_TARGET.clone(), shift: phoneQ.matches ? 0 : 0.17, lift: phoneQ.matches ? 0.16 : 0 });
let goal = base(), cur = null, zoom = 1;

/* ── Camera: cur eases toward goal ── */
function step(dt) {
  if (!cur) cur = { ...goal, target: goal.target.clone() };
  const k = reduced ? 1 : 1 - Math.exp(-dt * 5.5);
  cur.az += wrapAngle(goal.az - cur.az) * k;
  cur.el += (goal.el - cur.el) * k;
  cur.dist += (goal.dist * zoom - cur.dist) * k;
  cur.shift += (goal.shift - cur.shift) * k;
  cur.lift += (goal.lift - cur.lift) * k;
  cur.target.lerp(goal.target, k);
  m.setView(cur);
}

/* ── Light: the slider sets the hour; the page follows the model's clock ── */
const fmt = (h) => { const hh = Math.floor(h), mm = Math.round((h - hh) * 60 / 5) * 5; return String(hh + (mm === 60 ? 1 : 0)).padStart(2, "0") + "." + String(mm % 60).padStart(2, "0"); };
function setHour(h) {
  m.setTime(h);
  const t = fmt(h);
  sunOut.textContent = t;
  sun.setAttribute("aria-valuetext", t);
  if (clockEl) clockEl.textContent = t;
  doc.style.setProperty("--sky", "#" + m.sky.bg.getHexString());
  doc.dataset.light = m.sky.night > 0.5 ? "night" : "day";
}

/* ── Labels on the model ── */
let tagList = [];
function setTags() {
  tagsEl.innerHTML = "";
  const list = [];
  const top = (n, e) => () => V3(n.center.x, n.box.max.y + e + (picked === n ? Math.max(14, n.size.y * 1.15) : 0), n.center.z);
  if (picked) list.push({ text: nameOf(picked), pos: top(picked, 3) });
  else if (cat === "daire") m.ofKind("daire").forEach((n) => list.push({ text: n.name.replace("block_", ""), pos: top(n, 2) }));
  else if (cat) { const b = m.boxOf(cat), c = b.getCenter(V3()); list.push({ text: KIND[cat].many, pos: () => V3(c.x, b.max.y + 6, c.z) }); }
  tagList = list.map((t) => { const el = document.createElement("span"); el.textContent = t.text; tagsEl.appendChild(el); requestAnimationFrame(() => el.classList.add("on")); return { ...t, el }; });
}
function placeTags() {
  const r = host.getBoundingClientRect();
  for (const t of tagList) {
    const q = m.project(t.pos());
    t.el.style.transform = `translate(${(q.x + r.left).toFixed(1)}px, ${(q.y + r.top - 14).toFixed(1)}px) translate(-50%, -100%)`;
    t.el.style.visibility = q.visible ? "" : "hidden";
  }
}

/* ── Kinds of home ── */
function setCat(k, fly = true) {
  cat = k || "";
  m.setCategory(cat || null);
  $$(".chips button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cat === cat)));
  if (fly) {
    if (cat) goal = m.frame(cat, { az: cur ? cur.az : -2.2, el: 0.6, pad: phoneQ.matches ? 1.5 : 1.1, shift: phoneQ.matches ? 0 : 0.17, lift: phoneQ.matches ? 0.16 : 0 });
    else goal = { ...base(), az: cur ? cur.az : base().az };
    zoom = 1;
  }
  setTags();
  interacted = true;
}

/* ── Picking up ── */
function inspect(n, from) {
  picked = n;
  m.lift(n);
  goal = closeView(n, { az: cur.az, phone: phoneQ.matches, shift: phoneQ.matches ? 0 : -0.12 });
  zoom = 1;
  fillInspector(inspector, n, U);
  inspector.hidden = false;
  requestAnimationFrame(() => inspector.classList.add("on"));
  setTags();
  interacted = true;
  if (from && from.focus) from.focus();
}
function drop() {
  picked = null;
  m.lift(null);
  inspector.classList.remove("on");
  setTimeout(() => { if (!picked) inspector.hidden = true; }, reduced ? 0 : 450);
  if (cat) setCat(cat); else goal = { ...base(), az: cur.az };
  setTags();
}

/* ── Controls ── */
function bind() {
  attachPointer(m, m.renderer.domElement, {
    onDown: () => { interacted = true; },
    onDragStart: () => host.classList.add("dragging"),
    onDrag: (dx, dy) => { goal.az += dx * 0.0055; goal.el = clamp(goal.el + dy * 0.004, 0.16, 1.5); },
    onDragEnd: () => host.classList.remove("dragging"),
    onPick: (n) => { if (n) { if (picked === n) drop(); else inspect(n); } else if (picked) drop(); },
    onHover: (n, x, y) => {
      host.classList.toggle("over", !!n);
      if (!n) { cursorTag.classList.remove("on"); return; }
      cursorTag.textContent = nameOf(n) + (picked === n ? "" : " · seçin");
      cursorTag.style.left = x + "px"; cursorTag.style.top = y + "px";
      cursorTag.classList.add("on");
    },
  });
  // Ctrl/⌘ + wheel zooms; a plain wheel still scrolls the page
  host.addEventListener("wheel", (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    zoom = clamp(zoom * Math.exp(e.deltaY * 0.0015), 0.3, 1.8);
    interacted = true;
  }, { passive: false });
  host.addEventListener("keydown", (e) => {
    const k = e.key;
    if (k === "ArrowLeft" || k === "ArrowRight") goal.az += (k === "ArrowLeft" ? -1 : 1) * 0.18;
    else if (k === "ArrowUp" || k === "ArrowDown") goal.el = clamp(goal.el + (k === "ArrowUp" ? 0.1 : -0.1), 0.16, 1.5);
    else if (k === "+" || k === "=") zoom = clamp(zoom * 0.82, 0.3, 1.8);
    else if (k === "-") zoom = clamp(zoom * 1.22, 0.3, 1.8);
    else if (k === "Escape" && picked) drop();
    else return;
    e.preventDefault();
    interacted = true;
  });
  $$(".chips button").forEach((b) => b.addEventListener("click", () => { if (picked) drop(); setCat(b.dataset.cat); }));
  $$("[data-zoom]").forEach((b) => b.addEventListener("click", () => { zoom = clamp(zoom * (+b.dataset.zoom > 0 ? 0.78 : 1.28), 0.3, 1.8); interacted = true; }));
  $('[data-view="top"]').addEventListener("click", (e) => {
    const on = e.currentTarget.getAttribute("aria-pressed") !== "true";
    e.currentTarget.setAttribute("aria-pressed", String(on));
    goal = on ? { ...goal, az: Math.PI / 2, el: 1.5, dist: phoneQ.matches ? 1900 : 1450 } : { ...base(), az: -2.25 };
    zoom = 1; interacted = true;
  });
  $('[data-view="reset"]').addEventListener("click", () => {
    if (picked) drop();
    $('[data-view="top"]').setAttribute("aria-pressed", "false");
    setCat("", false);
    goal = base(); zoom = 1;
    sun.value = 10.5; setHour(10.5);
  });
  sun.addEventListener("input", () => { setHour(+sun.value); interacted = true; });
  $("[data-drop]", inspector)?.addEventListener("click", drop);
  addEventListener("keydown", (e) => { if (e.key === "Escape" && picked && !document.querySelector("dialog[open]")) drop(); });
  // "show on the model" links further down the page
  $$("[data-show-type], [data-show]").forEach((b) => b.addEventListener("click", (e) => {
    e.preventDefault();
    section.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
    if (picked) drop();
    setCat(b.dataset.showType || b.dataset.show);
    setTimeout(() => host.focus({ preventScroll: true }), reduced ? 0 : 700);
  }));
}

/* ── Start ── */
async function start() {
  const test = document.createElement("canvas");
  if (!test.getContext("webgl2")) { doc.classList.add("no-gl"); loader?.remove(); return; }
  const ring = $(".loader-ring"), num = $(".loader-n");
  try {
    m = await Maket.create(host, { url: new URL("../model/levan.glb", import.meta.url).href, onProgress: (p) => { ring?.style.setProperty("--p", p.toFixed(3)); if (num) num.textContent = Math.round(p * 100); } });
  } catch (e) {
    console.warn("Maket: model unavailable, showing a still image", e);
    doc.classList.add("no-gl"); loader?.remove(); return;
  }
  window.__maket = m;
  setHour(+sun.value);
  goal = base();
  step(1);
  host.classList.add("ready");
  doc.classList.add("ready-gl");
  loader.classList.add("done");
  setTimeout(() => loader.remove(), 1200);
  bind();
  m.on((t) => { if (t === "frame") placeTags(); });
  // off screen the model rests, and a home left in the air goes back on the model
  new IntersectionObserver((es) => { m.setVisible(es[0].isIntersecting); if (!es[0].isIntersecting && picked) drop(); }, { rootMargin: "100px" }).observe(section);
  // intro: the blocks rise once
  const t0 = performance.now();
  let last = t0;
  const loop = (now) => {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (!m.visible || document.hidden) return;
    if (!reduced) m.setGrow(Math.min(1, (now - t0) / 2600));
    if (!interacted && !reduced) goal.az += dt * 0.04;
    step(dt);
  };
  if (reduced) m.setGrow(1);
  requestAnimationFrame(loop);
  addEventListener("resize", () => { if (!picked && !cat) goal = { ...base(), az: goal.az }; });
}
start();

/* ── Site plan zones ── */
const polys = $$(".vz-svg polygon"), zoneBtns = $$(".zone");
const showZone = (z) => {
  polys.forEach((p) => p.classList.toggle("on", z !== null && p.dataset.z === String(z)));
  $(".vz-map")?.classList.toggle("focus", z !== null);
  zoneBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.z === String(z))));
};
zoneBtns.forEach((b) => {
  b.addEventListener("click", () => showZone(b.getAttribute("aria-pressed") === "true" ? null : +b.dataset.z));
  b.addEventListener("mouseenter", () => { if (!zoneBtns.some((x) => x.getAttribute("aria-pressed") === "true")) { polys.forEach((p) => p.classList.toggle("on", p.dataset.z === b.dataset.z)); $(".vz-map")?.classList.add("focus"); } });
  b.addEventListener("mouseleave", () => { if (!zoneBtns.some((x) => x.getAttribute("aria-pressed") === "true")) showZone(null); });
});

/* ── 360° tours: Kuula only after "start"; the dates switch the tour ── */
const tourStage = $(".tour-stage"), dateBtns = $$(".tour-axis button"), tab = $(".tour-tab");
const tourUrl = (id) => "https://kuula.co/share/collection/" + id + "?logo=1&info=0&fs=1&vr=0&initload=1&autorotate=0.1&thumbs=1";
let tourId = (dateBtns.find((b) => b.getAttribute("aria-pressed") === "true") || dateBtns[0])?.dataset.id;
const tourDate = () => $("time", dateBtns.find((b) => b.dataset.id === tourId)).textContent;
function loadTour() {
  let f = $("iframe", tourStage);
  if (!f) {
    f = document.createElement("iframe");
    f.allow = "fullscreen; xr-spatial-tracking; gyroscope; accelerometer";
    f.setAttribute("allowfullscreen", "");
    f.loading = "lazy";
    tourStage.appendChild(f);
    tourStage.classList.add("live");
  }
  f.title = "Levan Bahçeşehir şantiyesi, 360° tur, " + tourDate();
  f.src = tourUrl(tourId);
}
$(".tour-start")?.addEventListener("click", loadTour);
dateBtns.forEach((b) => b.addEventListener("click", () => {
  tourId = b.dataset.id;
  dateBtns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  if (tab) tab.href = tourUrl(tourId);
  const when = $(".tour-when time");
  if (when) { when.textContent = tourDate(); when.dateTime = $("time", b).dateTime; }
  if ($("iframe", tourStage)) loadTour();
}));
