/* Huzur · the real maps: Projeler's map of the projects and İletişim's plate of the head office's street.
   MapLibre GL (served from concepts/assets/vendor) with OpenFreeMap's Positron tiles (free, no key, no tracking),
   recoloured to the linen: paper ground, sage-grey water, white streets, motorways drawn in sand, and close in the city
   rising as pale massing. A map loads only when it is about to be seen; without WebGL, the library or the tiles, the
   drawn sheet underneath simply stays. */
const U = window.UZM || {};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const BASE = new URL((U.assets || "../assets/") + "vendor/maplibre/", location.href).href;

const TR = {
  "CooperativeGesturesHandler.WindowsHelpText": "Haritayı yakınlaştırmak için Ctrl tuşuna basılı tutarak kaydırın",
  "CooperativeGesturesHandler.MacHelpText": "Haritayı yakınlaştırmak için ⌘ tuşuna basılı tutarak kaydırın",
  "CooperativeGesturesHandler.MobileHelpText": "Haritayı hareket ettirmek için iki parmağınızı kullanın",
  "NavigationControl.ZoomIn": "Yakınlaştırın",
  "NavigationControl.ZoomOut": "Uzaklaştırın",
  "NavigationControl.ResetBearing": "Kuzeye çevirin",
  "AttributionControl.ToggleAttribution": "Harita kaynakları",
  "Map.Title": "Harita",
};

const hasGL = () => { try { return !!document.createElement("canvas").getContext("webgl2"); } catch (_) { return false; } };

let libP = null, styleP = null;
function lib() {
  if (!libP) {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = BASE + "maplibre-gl.css";
    document.head.appendChild(css);
    libP = import(BASE + "maplibre-gl.mjs").then((ml) => { ml.setWorkerUrl(BASE + "maplibre-gl-worker.mjs"); return ml; });
  }
  return libP;
}
function linen() {
  if (!styleP) styleP = fetch("https://tiles.openfreemap.org/styles/positron").then((r) => { if (!r.ok) throw new Error("style " + r.status); return r.json(); });
  return styleP.then((s) => restyle(JSON.parse(JSON.stringify(s))));
}

/* Positron, re-inked in the Huzur palette */
function restyle(style) {
  for (const l of style.layers) {
    const id = l.id;
    l.paint = l.paint || {};
    if (l.type === "background") l.paint["background-color"] = "#eae6df";
    else if (id === "water") l.paint["fill-color"] = "#cfd5d2";
    else if (id === "waterway") l.paint["line-color"] = "#c8cfcc";
    else if (/park|landcover_wood|landcover_glacier|landcover_ice/.test(id)) { l.paint["fill-color"] = "#dfdfd0"; l.paint["fill-opacity"] = 1; }
    else if (id === "landuse_residential") { l.paint["fill-color"] = "#e5e0d8"; l.paint["fill-opacity"] = 1; }
    else if (id === "building") { l.paint["fill-color"] = "#ddd7cd"; l.maxzoom = 14; }
    else if (/aeroway/.test(id)) { if (l.type === "line") l.paint["line-color"] = "#d9d3c9"; else l.paint["fill-color"] = "#e1dcd3"; }
    else if (l.type === "fill" && /road_area/.test(id)) l.paint["fill-color"] = "#f6f4f0";
    else if (l.type === "line" && /casing/.test(id)) l.paint["line-color"] = "#dcd5c9";
    else if (l.type === "line" && /motorway/.test(id)) l.paint["line-color"] = /subtle/.test(id) ? "#e2d5bd" : "#d4bf99";
    else if (l.type === "line" && /highway_major/.test(id)) l.paint["line-color"] = "#f8f6f2";
    else if (l.type === "line" && /highway_minor|road_pier|highway_path/.test(id)) l.paint["line-color"] = "#f4f1ec";
    else if (l.type === "line" && /railway/.test(id)) l.paint["line-color"] = "#d0c9be";
    else if (l.type === "line" && /boundary/.test(id)) l.paint["line-color"] = "#cbc4b8";
    else if (l.type === "symbol") {
      if (/shield|airport|label_country/.test(id)) { l.layout = { ...(l.layout || {}), visibility: "none" }; continue; }
      l.paint["text-color"] = /label_city/.test(id) ? "#2a2622" : /label_town/.test(id) ? "#57514a" : "#6e675e";
      l.paint["text-halo-color"] = "#eae6df";
      l.paint["text-halo-width"] = 1.4;
    }
  }
  const firstSymbol = style.layers.findIndex((l) => l.type === "symbol");
  style.layers.splice(firstSymbol < 0 ? style.layers.length : firstSymbol, 0, {
    id: "huzur-massing",
    source: "openmaptiles",
    "source-layer": "building",
    type: "fill-extrusion",
    minzoom: 13.5,
    paint: {
      "fill-extrusion-color": "#f7f5f0",
      "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 13.5, 0, 14.6, ["coalesce", ["get", "render_height"], 8]],
      "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
      "fill-extrusion-opacity": 0.92,
      "fill-extrusion-vertical-gradient": true,
    },
  });
  style.light = { anchor: "viewport", color: "#fff8ec", intensity: 0.38, position: [1.2, 210, 40] };
  return style;
}

function whenNear(el, fn, margin = "400px") {
  if (!("IntersectionObserver" in window)) return fn();
  const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); fn(); } }, { rootMargin: margin });
  io.observe(el);
}

/* Resolve once the map has drawn its first complete frame (or, on a slow line, a while after the style is in). */
function drawn(map, slow = 6000, give = 25000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("harita zamanında çizilemedi")), give);
    const ok = () => { clearTimeout(t); resolve(); };
    map.once("load", ok);
    map.once("style.load", () => setTimeout(ok, slow));
  });
}

/* Dashed rings round Levan at 5, 10 and 15 km */
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
  const a = (-38 * Math.PI) / 180;
  style.sources["huzur-rings"] = { type: "geojson", data: { type: "FeatureCollection", features: KM.map((km) => ({ type: "Feature", properties: { km }, geometry: { type: "LineString", coordinates: circle(c, km) } })) } };
  style.sources["huzur-ring-labels"] = { type: "geojson", data: { type: "FeatureCollection", features: KM.map((km) => ({ type: "Feature", properties: { t: km + " km" }, geometry: { type: "Point", coordinates: [c[0] + (km / (111.32 * Math.cos((c[1] * Math.PI) / 180))) * Math.cos(a), c[1] + (km / 110.57) * Math.sin(a)] } })) } };
  style.layers.push(
    { id: "huzur-rings", type: "line", source: "huzur-rings", paint: { "line-color": "#2a2622", "line-opacity": 0.3, "line-width": 1, "line-dasharray": [2, 3] } },
    { id: "huzur-ring-labels", type: "symbol", source: "huzur-ring-labels", layout: { "text-field": ["get", "t"], "text-font": ["Noto Sans Italic"], "text-size": 11.5, "text-letter-spacing": 0.08 }, paint: { "text-color": "#57514a", "text-halo-color": "#eae6df", "text-halo-width": 1.6 } },
  );
}

/* ── Projeler: the list is the index of the map. Pointing at a row lifts its pin; choosing it flies there and an arch
   card rises over the map; pointing at a pin lights its row. ── */
const box = $(".atlas-map"), list = $(".places");
if (box && list) atlas();

function atlas() {
  const rows = $$("li[data-id]", list).map((li) => ({
    li, id: li.dataset.id, kind: li.dataset.kind, at: [+li.dataset.lng, +li.dataset.lat], approx: li.hasAttribute("data-approx"),
    name: $(".place-nm", li).textContent.trim(), tag: $(".place-t .eyebrow", li).textContent.trim(), note: $(".place-nt", li).textContent.trim(),
    href: li.dataset.href || "", ext: li.hasAttribute("data-ext"), go: li.dataset.go || "", pic: li.dataset.pic || "", pos: li.dataset.pos || "50% 50%",
  }));
  const card = $(".atlas-card", box), reset = $(".atlas-reset", box);
  let picked = null, view = null;

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

  const sheetPins = new Map($$(".sheet .spin", box).map((p) => [p.dataset.id, p]));
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
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  function showCard(r) {
    if (!r) { card.hidden = true; card.innerHTML = ""; return; }
    card.className = "atlas-card" + (r.pic ? "" : " office");
    card.innerHTML = (r.pic ? `<figure class="arch" data-vt-pic><img src="${esc(r.pic)}" alt="" style="object-position:${esc(r.pos)}"></figure>` : "")
      + `<p class="eyebrow">${esc(r.tag)}</p><p class="serif">${esc(r.name)}</p><p class="small">${esc(r.note)}</p>`
      + (r.href ? `<a class="more" href="${esc(r.href)}" tabindex="-1"${r.ext ? ' target="_blank" rel="noopener"' : " data-vt"}>${esc(r.go)} <span aria-hidden="true">${r.ext ? "↗" : "→"}</span></a>` : "");
    // the card is a pointer convenience (aria-hidden, its link out of the tab order); the same link sits in the list
    card.hidden = false;
    card.style.animation = "none";
    void card.offsetWidth;
    card.style.animation = "";
  }
  function choose(r) {
    picked = r;
    rows.forEach((x) => {
      const on = x === r;
      x.btn.setAttribute("aria-pressed", String(on));
      x.li.classList.toggle("on", on);
      pinsOf(x.id).forEach((p) => p.classList.toggle("on", on));
    });
    reset.hidden = !r;
    showCard(r);
    if (view) r ? view.focus(r) : view.overview();
    if (r && matchMedia("(max-width: 60rem)").matches) {
      const top = box.getBoundingClientRect().top;
      if (top < 0 || top > innerHeight * 0.45) box.scrollIntoView({ behavior: U.reduced ? "auto" : "smooth", block: "center" });
    }
  }
  reset.addEventListener("click", () => { const was = picked; choose(null); was?.btn.focus(); });

  if (!hasGL()) return;
  whenNear(box, async () => {
    const note = Object.assign(document.createElement("p"), { className: "atlas-load", textContent: "Canlı harita yükleniyor…" });
    note.setAttribute("role", "status");
    box.appendChild(note);
    try {
      const [ml, style] = await Promise.all([lib(), linen()]);
      const levan = rows.find((r) => r.id === "levan");
      rings(style, levan.at);
      const holder = $(".atlas-gl", box);
      const map = new ml.Map({
        container: holder, style, center: levan.at, zoom: 10, pitch: 30, bearing: -10, maxPitch: 70,
        cooperativeGestures: true, attributionControl: false, locale: TR, fadeDuration: 0,
      });
      map.addControl(new ml.NavigationControl({ visualizePitch: true, showCompass: true }), "bottom-right");
      map.addControl(new ml.AttributionControl({ compact: true }), "bottom-right");
      map.on("error", (e) => console.warn("Harita:", (e.error && e.error.message) || e));

      rows.forEach((r) => {
        const src = sheetPins.get(r.id);
        const el = document.createElement("div");
        el.className = "spin k-" + r.kind;
        el.dataset.id = r.id;
        el.setAttribute("aria-hidden", "true");
        el.innerHTML = src ? src.innerHTML : `<i></i><b>${esc(r.name)}</b>`;
        new ml.Marker({ element: el, anchor: "center" }).setLngLat(r.at).addTo(map);
        glPins.set(r.id, el);
        bindPin(el, r);
        if (picked === r) el.classList.add("on");
      });

      const bounds = new ml.LngLatBounds();
      rows.forEach((r) => bounds.extend(r.at));
      const overviewCam = () => {
        const w = holder.clientWidth, h = holder.clientHeight;
        const side = Math.max(70, Math.min(130, w * 0.13));
        return { ...map.cameraForBounds(bounds, { padding: { top: Math.max(70, h * 0.16), bottom: Math.max(80, h * 0.14), left: side, right: side }, pitch: 30, bearing: -10 }), pitch: 30, bearing: -10 };
      };
      await drawn(map);
      window.__atlas = map;
      map.jumpTo(overviewCam());
      $(".maplibregl-ctrl-attrib", holder)?.classList.remove("maplibregl-compact-show");
      // the canvas is a picture of the places listed beside it; the list is how you choose
      box.classList.add("gl");

      const motion = U.reduced ? { duration: 0 } : { duration: 2600, essential: true };
      view = {
        focus(r) {
          const wide = holder.clientWidth > 640;
          const zoom = r.approx ? 13.4 : r.kind === "levan" ? 14 : 15.9;
          map.flyTo({
            center: r.at, zoom, pitch: r.kind === "office" ? 58 : 50, bearing: -10 + (r.kind === "levan" ? 20 : -14),
            offset: wide ? [holder.clientWidth * 0.12, -holder.clientHeight * 0.04] : [0, -holder.clientHeight * 0.12], ...motion,
          });
        },
        overview() { map.flyTo({ ...overviewCam(), ...motion }); },
      };
      if (picked) view.focus(picked);
      new ResizeObserver(() => { map.resize(); if (!picked) map.jumpTo(overviewCam()); }).observe(holder);
    } catch (e) {
      console.warn("Harita gösterilemiyor; çizim kalıyor.", e);
    } finally {
      note.remove();
    }
  });
}

/* ── İletişim: a still, pitched view of the street round the head office ── */
async function plate(el) {
  const holder = $(".plate-gl", el);
  const at = [+el.dataset.lng, +el.dataset.lat];
  try {
    const [ml, style] = await Promise.all([lib(), linen()]);
    const map = new ml.Map({
      container: holder, style, center: at, zoom: +(el.dataset.zoom || 15.6), pitch: 52, bearing: +(el.dataset.bearing || -24),
      interactive: false, attributionControl: false, locale: TR, fadeDuration: 0,
    });
    map.addControl(new ml.AttributionControl({ compact: true }), "bottom-right");
    const mk = document.createElement("div");
    mk.className = "plate-mk";
    mk.setAttribute("aria-hidden", "true");
    new ml.Marker({ element: mk, anchor: "center" }).setLngLat(at).addTo(map);
    map.on("error", (e) => console.warn("Harita:", (e.error && e.error.message) || e));
    const cv = map.getCanvas();
    cv.setAttribute("role", "img");
    cv.setAttribute("aria-label", el.dataset.label || "Harita");
    cv.removeAttribute("tabindex");
    await drawn(map);
    $(".maplibregl-ctrl-attrib", holder)?.classList.remove("maplibregl-compact-show");
    el.classList.add("gl");
  } catch (e) {
    console.warn("Harita gösterilemiyor; çizim kalıyor.", e);
  }
}
if (hasGL()) $$(".plate[data-lng]").forEach((el) => whenNear(el, () => plate(el)));
