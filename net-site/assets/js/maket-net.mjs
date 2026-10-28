/* Net · the live 3D model of Levan ([data-maket] sections, from templates/maket.html). The engine is the Maket
   concept's (maket.mjs: one draw per material class, homes that rise from their foundations, lift off the model and
   light up at night); this file is the visitor's side of it: when to load, how the camera follows the pointer and the
   keys, the kind-of-home chips, day and night, and the card for a home picked up, whose buttons open Net's own plan
   and visit dialogs. On a phone or with data saver it waits for the button; without WebGL the poster stays. */
import * as THREE from "three";
import { Maket, HOME_TARGET } from "./maket.mjs";
import { attachPointer } from "./maket-ui.mjs";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const phoneQ = matchMedia("(max-width: 47.99rem)");
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const wrapAngle = (a) => ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

$$("[data-maket]").forEach(setup);

function setup(section) {
  const stage = $(".maket-stage", section), ui = $(".maket-ui", section), card = $(".maket-card", section);
  const loader = $(".maket-loader", section), btn = $(".maket-load", section), tagsEl = $(".maket-tags", section), cursor = $(".maket-cursor", section);
  const data = JSON.parse($(".maket-data", section).textContent);
  const K = data.kinds, L = data.labels;
  const nameOf = (n) => (n.kind === "daire" ? L.block.replace("{x}", n.name.replace("block_", "")) : K[n.kind].one);

  let m = null, picked = null, cat = "", interacted = false, started = false, night = false;
  const base = () => ({ az: -2.25, el: 0.62, dist: phoneQ.matches ? 1500 : 940, fov: 26, target: HOME_TARGET.clone(), shift: 0, lift: phoneQ.matches ? 0.12 : 0 });
  let goal = base(), cur = null, zoom = 1;

  /* ── When to load: near the screen on a capable desktop, otherwise on the button ── */
  const conn = navigator.connection || {};
  const eager = !phoneQ.matches && !conn.saveData && (navigator.deviceMemory || 8) >= 4 && !/2g/.test(conn.effectiveType || "");
  btn.addEventListener("click", start);
  if (eager) {
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { io.disconnect(); start(); } }, { rootMargin: "60% 0px" });
    io.observe(section);
  }

  async function start() {
    if (started) return;
    started = true;
    const test = document.createElement("canvas");
    if (!test.getContext("webgl2")) return fail();
    btn.hidden = true;
    loader.hidden = false;
    const ring = $(".maket-ring", loader), pct = $(".maket-pct b", loader);
    try {
      m = await Maket.create(stage, { url: new URL(section.dataset.model, location.href).href, onProgress: (p) => { ring.style.setProperty("--p", p.toFixed(3)); pct.textContent = Math.round(p * 100); } });
    } catch (e) {
      console.warn("Net maket:", e);
      return fail();
    }
    m.setTime(11);
    goal = base();
    step(1);
    section.classList.add("live");
    loader.classList.add("done");
    setTimeout(() => (loader.hidden = true), 700);
    ui.hidden = false;
    bind();
    m.on((t) => { if (t === "frame") placeTags(); });
    new IntersectionObserver((es) => { m.setVisible(es[0].isIntersecting); if (!es[0].isIntersecting && picked) drop(); }, { rootMargin: "120px" }).observe(section);
    const t0 = performance.now();
    let last = t0;
    const loop = (now) => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      if (!m.visible || document.hidden) return;
      if (!reduced) m.setGrow(Math.min(1, (now - t0) / 2600)); // the homes rise from their foundations once
      if (!interacted && !reduced) goal.az += dt * 0.05;      // and the model turns slowly until touched
      step(dt);
    };
    if (reduced) m.setGrow(1);
    requestAnimationFrame(loop);
  }
  function fail() {
    btn.hidden = true;
    loader.hidden = true;
    const p = document.createElement("p");
    p.className = "maket-fail small";
    p.textContent = L.unavailable;
    stage.appendChild(p);
  }

  /* ── Camera: the view eases toward the goal the visitor moves ── */
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

  /* ── Labels over the model ── */
  let tags = [];
  function setTags() {
    tagsEl.innerHTML = "";
    const list = [];
    const top = (n, e) => () => V3(n.center.x, n.box.max.y + e + (picked === n ? Math.max(14, n.size.y * 1.15) : 0), n.center.z);
    if (picked) list.push({ text: nameOf(picked), pos: top(picked, 3) });
    else if (cat === "daire") m.ofKind("daire").forEach((n) => list.push({ text: n.name.replace("block_", ""), pos: top(n, 2) }));
    else if (cat) { const b = m.boxOf(cat), c = b.getCenter(V3()); list.push({ text: K[cat].many, pos: () => V3(c.x, b.max.y + 6, c.z) }); }
    tags = list.map((t) => { const el = document.createElement("span"); el.textContent = t.text; tagsEl.appendChild(el); requestAnimationFrame(() => el.classList.add("on")); return { ...t, el }; });
  }
  function placeTags() {
    const r = stage.getBoundingClientRect();
    for (const t of tags) {
      const q = m.project(t.pos());
      t.el.style.transform = `translate(${q.x.toFixed(1)}px, ${(q.y - 12).toFixed(1)}px) translate(-50%, -100%)`;
      t.el.style.visibility = q.visible && q.x > 0 && q.x < r.width ? "" : "hidden";
    }
  }

  /* ── Kinds of home ── */
  function setCat(k) {
    cat = k || "";
    m.setCategory(cat || null);
    $$("[data-cat]", ui).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cat === cat)));
    goal = cat ? m.frame(cat, { az: cur ? cur.az : -2.2, el: 0.6, pad: phoneQ.matches ? 1.5 : 1.1, shift: 0, lift: phoneQ.matches ? 0.12 : 0 }) : { ...base(), az: cur ? cur.az : base().az };
    zoom = 1;
    setTags();
    interacted = true;
  }

  /* ── A home picked up off the model ── */
  function inspect(n) {
    picked = n;
    m.lift(n);
    const size = Math.max(n.size.x, n.size.z, n.size.y), lifted = Math.max(14, n.size.y * 1.15);
    goal = { az: cur.az, el: n.kind === "daire" ? 0.42 : 0.5, fov: 26, dist: Math.max(150, size * (n.kind === "daire" ? 4.6 : 7.5)) * (phoneQ.matches ? 1.5 : 1), target: V3(n.center.x, n.box.min.y + n.size.y * 0.5 + lifted * 0.6, n.center.z), shift: 0, lift: phoneQ.matches ? 0.26 : 0 };
    zoom = 1;
    const k = K[n.kind];
    $(".maket-card-k", card).textContent = L.from;
    $(".maket-card-t", card).textContent = nameOf(n);
    $(".maket-card-b", card).textContent = k.blurb;
    $(".maket-card-a", card).textContent = k.area;
    const btns = $(".maket-card-btns", card);
    btns.innerHTML = "";
    k.plans.forEach((p) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "btn btn-sm btn-light"; b.dataset.plan = p.id;
      b.textContent = k.plans.length > 1 ? p.title : L.plan;
      btns.appendChild(b);
    });
    const v = document.createElement("button");
    v.type = "button"; v.className = "btn btn-sm btn-ghost"; v.dataset.open = "visit"; v.textContent = L.visit;
    btns.appendChild(v);
    card.hidden = false;
    requestAnimationFrame(() => card.classList.add("on"));
    setTags();
    interacted = true;
  }
  function drop() {
    picked = null;
    m.lift(null);
    card.classList.remove("on");
    setTimeout(() => { if (!picked) card.hidden = true; }, reduced ? 0 : 400);
    if (cat) setCat(cat); else goal = { ...base(), az: cur.az };
    setTags();
  }

  /* ── Controls: drag, Ctrl/⌘ + wheel, keys, chips, night, zoom, reset ── */
  function bind() {
    attachPointer(m, m.renderer.domElement, {
      onDown: () => { interacted = true; },
      onDragStart: () => stage.classList.add("dragging"),
      onDrag: (dx, dy) => { goal.az += dx * 0.0055; goal.el = clamp(goal.el + dy * 0.004, 0.16, 1.5); },
      onDragEnd: () => stage.classList.remove("dragging"),
      onPick: (n) => { if (n) { if (picked === n) drop(); else inspect(n); } else if (picked) drop(); },
      onHover: (n, x, y) => {
        stage.classList.toggle("over", !!n);
        if (!n) { cursor.classList.remove("on"); return; }
        const r = stage.getBoundingClientRect();
        cursor.textContent = nameOf(n) + (picked === n ? "" : " · " + L.pick);
        cursor.style.transform = `translate(${x - r.left + 14}px, ${y - r.top + 14}px)`;
        cursor.classList.add("on");
      },
    });
    stage.addEventListener("wheel", (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      zoom = clamp(zoom * Math.exp(e.deltaY * 0.0015), 0.3, 1.8);
      interacted = true;
    }, { passive: false });
    stage.addEventListener("keydown", (e) => {
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
    $$("[data-cat]", ui).forEach((b) => b.addEventListener("click", () => { if (picked) drop(); setCat(b.dataset.cat); }));
    $$("[data-zoom]", ui).forEach((b) => b.addEventListener("click", () => { zoom = clamp(zoom * (+b.dataset.zoom > 0 ? 0.78 : 1.28), 0.3, 1.8); interacted = true; }));
    $("[data-reset]", ui).addEventListener("click", () => { if (picked) drop(); setCat(""); goal = base(); zoom = 1; });
    $("[data-night]", ui).addEventListener("click", (e) => {
      night = !night;
      e.currentTarget.setAttribute("aria-pressed", String(night));
      m.setTime(night ? 21.5 : 11);
      section.classList.toggle("night", night);
      interacted = true;
    });
    $("[data-drop]", card).addEventListener("click", drop);
  }
}
