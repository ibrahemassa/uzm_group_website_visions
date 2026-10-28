/* Maket · projects: the map table. The list beside the map is the index of the table: pointing at a row lifts its
   plinth on the map, choosing it flies there; pointing at a plinth lights its row. The drawn sheet is there first (and
   stays if the real map can't load); the real map takes over once it has drawn. */
import { TR, hasGL, lib, paperStyle, whenNear, drawn, pinSVG } from "./map.mjs";

const U = window.UZM || {};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const box = $(".atlas-map");
const list = $(".places");
if (box && list) init();

function init() {
  const rows = $$("li[data-id]", list).map((li) => ({
    li, id: li.dataset.id, kind: li.dataset.kind, at: [+li.dataset.lng, +li.dataset.lat], approx: li.hasAttribute("data-approx"),
    name: $(".place-nm", li).textContent.trim(),
  }));
  const reset = $(".atlas-reset", box);
  let picked = null;

  /* Rows become buttons: choosing one flies the map there. */
  rows.forEach((r) => {
    const div = $(".place", r.li);
    const b = document.createElement("button");
    b.type = "button";
    b.className = div.className;
    b.setAttribute("aria-pressed", "false");
    b.innerHTML = div.innerHTML;
    b.append(Object.assign(document.createElement("span"), { className: "sr", textContent: ", haritada gösterin" }));
    div.replaceWith(b);
    r.btn = b;
    b.addEventListener("click", () => choose(picked === r ? null : r));
    b.addEventListener("pointerenter", () => hot(r, true));
    b.addEventListener("pointerleave", () => hot(r, false));
    b.addEventListener("focus", () => hot(r, true));
    b.addEventListener("blur", () => hot(r, false));
  });

  /* Pins on the drawn sheet behave like the real ones. */
  const sheetPins = new Map($$(".sheet .mpin", box).map((p) => [p.dataset.id, p]));
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
  function choose(r) {
    picked = r;
    rows.forEach((x) => {
      const on = x === r;
      x.btn.setAttribute("aria-pressed", String(on));
      x.li.classList.toggle("on", on);
      pinsOf(x.id).forEach((p) => p.classList.toggle("on", on));
    });
    box.classList.toggle("picked", !!r);
    reset.hidden = !r;
    if (view) r ? view.focus(r) : view.overview();
    if (r && matchMedia("(max-width: 61.99rem)").matches) {
      const top = box.getBoundingClientRect().top;
      if (top < 0 || top > innerHeight * 0.4) box.scrollIntoView({ behavior: U.reduced ? "auto" : "smooth", block: "start" });
    }
  }
  reset.addEventListener("click", () => { const was = picked; choose(null); was?.btn.focus(); });

  /* ── The real map ── */
  let view = null;
  if (!hasGL()) return;
  whenNear(box, async () => {
    try {
      const [ml, style] = await Promise.all([lib(), paperStyle()]);
      const levan = rows.find((r) => r.id === "levan");
      rings(style, levan.at);
      const holder = $(".atlas-gl", box);
      const map = new ml.Map({
        container: holder, style, center: levan.at, zoom: 10, pitch: 32, bearing: -10, maxPitch: 70,
        cooperativeGestures: true, attributionControl: { compact: true }, locale: TR, fadeDuration: 0,
      });
      map.addControl(new ml.NavigationControl({ visualizePitch: true }), "top-right");
      map.on("error", (e) => console.warn("Harita:", (e.error && e.error.message) || e));

      rows.forEach((r) => {
        const el = document.createElement("div");
        el.className = "mpin k-" + r.kind;
        el.dataset.id = r.id;
        el.setAttribute("aria-hidden", "true");
        el.innerHTML = pinSVG(r.kind) + `<span class="mpin-lb">${r.name}</span>`;
        const big = r.kind === "levan";
        new ml.Marker({ element: el, anchor: "bottom", offset: [0, big ? 16 : 12] }).setLngLat(r.at).addTo(map);
        glPins.set(r.id, el);
        bindPin(el, r);
      });

      const bounds = new ml.LngLatBounds();
      rows.forEach((r) => bounds.extend(r.at));
      const overviewCam = () => {
        const w = holder.clientWidth, pad = Math.max(40, Math.min(90, w * 0.1));
        return { ...map.cameraForBounds(bounds, { padding: { top: pad + 30, bottom: pad, left: pad, right: pad + 20 }, pitch: 32, bearing: -10 }), pitch: 32, bearing: -10 };
      };
      await drawn(map);
      map.jumpTo(overviewCam());
      if (holder.clientWidth < 520) $(".maplibregl-ctrl-attrib", holder)?.classList.remove("maplibregl-compact-show");
      box.classList.add("gl");

      const motion = U.reduced ? { duration: 0 } : { duration: 2400, essential: true };
      view = {
        focus(r) {
          const zoom = r.approx ? 13.7 : r.kind === "levan" ? 14.2 : 16.1;
          map.flyTo({ center: r.at, zoom, pitch: r.kind === "office" ? 60 : 52, bearing: -10 + (r.kind === "levan" ? 22 : -14), ...motion });
        },
        overview() { map.flyTo({ ...overviewCam(), ...motion }); },
      };
      if (picked) view.focus(picked);
      // the hint stays on the drawn sheet's caption; the real map takes over its own
      addEventListener("resize", () => { if (!picked) map.jumpTo(overviewCam()); });
    } catch (e) {
      console.warn("Harita gösterilemiyor; çizim kalıyor.", e);
    }
  });
}

/* Distance rings round Levan, 5, 10 and 15 km, as dashed pencil lines. */
function circle([lng, lat], km, steps = 160) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    pts.push([lng + (km / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.cos(a), lat + (km / 110.57) * Math.sin(a)]);
  }
  return pts;
}
function rings(style, c) {
  const KM = [5, 10, 15];
  style.sources["uzm-rings"] = { type: "geojson", data: { type: "FeatureCollection", features: KM.map((km) => ({ type: "Feature", properties: { km }, geometry: { type: "LineString", coordinates: circle(c, km) } })) } };
  const a = (-38 * Math.PI) / 180;
  style.sources["uzm-ring-labels"] = { type: "geojson", data: { type: "FeatureCollection", features: KM.map((km) => ({ type: "Feature", properties: { t: km + " km" }, geometry: { type: "Point", coordinates: [c[0] + (km / (111.32 * Math.cos((c[1] * Math.PI) / 180))) * Math.cos(a), c[1] + (km / 110.57) * Math.sin(a)] } })) } };
  style.layers.push(
    { id: "uzm-rings", type: "line", source: "uzm-rings", paint: { "line-color": "#18181a", "line-opacity": 0.32, "line-width": 1, "line-dasharray": [2, 3] } },
    { id: "uzm-ring-labels", type: "symbol", source: "uzm-ring-labels", layout: { "text-field": ["get", "t"], "text-font": ["Noto Sans Regular"], "text-size": 11, "text-letter-spacing": 0.08 }, paint: { "text-color": "#4c4943", "text-halo-color": "#ebe8e2", "text-halo-width": 1.6 } },
  );
}
