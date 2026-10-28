/* Maket · real maps for the secondary pages (the projects map and the two office plates on İletişim).
   MapLibre GL, served from concepts/assets/vendor, with OpenFreeMap's Positron tiles (free, no key, no tracking),
   recoloured to the paper of the model table. Close in, the city's buildings rise as white massing blocks, the way a
   site model shows a neighbourhood. A map loads only when it is about to be seen; if WebGL, the library or the tiles
   are unavailable, the drawn sheet underneath simply stays. */

const U = window.UZM || {};
const BASE = new URL((U.assets || "../assets/") + "vendor/maplibre/", location.href).href;

export const TR = {
  "CooperativeGesturesHandler.WindowsHelpText": "Haritayı yakınlaştırmak için Ctrl tuşuna basılı tutarak kaydırın",
  "CooperativeGesturesHandler.MacHelpText": "Haritayı yakınlaştırmak için ⌘ tuşuna basılı tutarak kaydırın",
  "CooperativeGesturesHandler.MobileHelpText": "Haritayı hareket ettirmek için iki parmağınızı kullanın",
  "NavigationControl.ZoomIn": "Yakınlaştırın",
  "NavigationControl.ZoomOut": "Uzaklaştırın",
  "NavigationControl.ResetBearing": "Kuzeye çevirin",
  "AttributionControl.ToggleAttribution": "Harita kaynakları",
  "Map.Title": "Harita",
};

export const hasGL = () => {
  try { return !!document.createElement("canvas").getContext("webgl2"); } catch (_) { return false; }
};

let libP = null, styleP = null;
export function lib() {
  if (!libP) {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = BASE + "maplibre-gl.css";
    document.head.appendChild(css);
    libP = import(BASE + "maplibre-gl.mjs").then((ml) => { ml.setWorkerUrl(BASE + "maplibre-gl-worker.mjs"); return ml; });
  }
  return libP;
}
export function paperStyle() {
  if (!styleP) styleP = fetch("https://tiles.openfreemap.org/styles/positron").then((r) => { if (!r.ok) throw new Error("style " + r.status); return r.json(); });
  return styleP.then((s) => restyle(JSON.parse(JSON.stringify(s))));
}

/* The home page's paper palette, plus the massing model: flat footprints give way to white extruded blocks. */
export function restyle(style) {
  for (const l of style.layers) {
    const id = l.id;
    l.paint = l.paint || {};
    if (l.type === "background") l.paint["background-color"] = "#ebe8e2";
    else if (id === "water") l.paint["fill-color"] = "#cdd8d9";
    else if (id === "waterway") l.paint["line-color"] = "#c3cfd1";
    else if (/park|landcover_wood|landcover_glacier|landcover_ice/.test(id)) { l.paint["fill-color"] = "#dde0cf"; l.paint["fill-opacity"] = 1; }
    else if (id === "landuse_residential") { l.paint["fill-color"] = "#e4e0d8"; l.paint["fill-opacity"] = 1; }
    else if (id === "building") { l.paint["fill-color"] = "#dcd7ce"; l.maxzoom = 13.5; }
    else if (/aeroway/.test(id)) { if (l.type === "line") l.paint["line-color"] = "#d6d0c5"; else l.paint["fill-color"] = "#dfdad1"; }
    else if (l.type === "fill" && /road_area/.test(id)) l.paint["fill-color"] = "#f3f0ea";
    else if (l.type === "line" && /casing/.test(id)) l.paint["line-color"] = "#d9d3c8";
    else if (l.type === "line" && /motorway/.test(id)) l.paint["line-color"] = /subtle/.test(id) ? "#d8d0c0" : "#bfb39c";
    else if (l.type === "line" && /highway_major/.test(id)) l.paint["line-color"] = "#f6f4ef";
    else if (l.type === "line" && /highway_minor|road_pier|highway_path/.test(id)) l.paint["line-color"] = "#f3f0ea";
    else if (l.type === "line" && /railway/.test(id)) l.paint["line-color"] = "#cfc9be";
    else if (l.type === "line" && /boundary/.test(id)) l.paint["line-color"] = "#c9c3b8";
    else if (l.type === "symbol") {
      if (/shield|poi|airport/.test(id)) { l.layout = { ...(l.layout || {}), visibility: "none" }; continue; }
      l.paint["text-color"] = /label_city/.test(id) ? "#3f3c37" : "#6b675f";
      l.paint["text-halo-color"] = "#ebe8e2";
      l.paint["text-halo-width"] = 1.4;
    }
  }
  const firstSymbol = style.layers.findIndex((l) => l.type === "symbol");
  style.layers.splice(firstSymbol < 0 ? style.layers.length : firstSymbol, 0, {
    id: "uzm-massing",
    source: "openmaptiles",
    "source-layer": "building",
    type: "fill-extrusion",
    minzoom: 13,
    paint: {
      "fill-extrusion-color": "#f8f6f1",
      "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 13, 0, 14.2, ["coalesce", ["get", "render_height"], 8]],
      "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
      "fill-extrusion-opacity": 0.94,
      "fill-extrusion-vertical-gradient": true,
    },
  });
  style.light = { anchor: "viewport", color: "#ffffff", intensity: 0.42, position: [1.2, 205, 35] };
  return style;
}

/* Run fn once the element is near the viewport. */
export function whenNear(el, fn, margin = "400px") {
  if (!("IntersectionObserver" in window)) return fn();
  const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); fn(); } }, { rootMargin: margin });
  io.observe(el);
}

/* Resolve once the map has drawn its first complete frame (or, on a slow line, a while after the style is in). */
export function drawn(map, slow = 6000, give = 25000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("harita zamanında çizilemedi")), give);
    const ok = () => { clearTimeout(t); resolve(); };
    map.once("load", ok);
    map.once("style.load", () => setTimeout(ok, slow));
  });
}

/* Pins are tiny round plinths: a block or two for a project, an ink dot for an office. The plinth's top centre is the
   place, 12 px above the bottom of the 40 px drawing. */
const SIDE = '<ellipse class="pm-sh" cx="25" cy="35" rx="21" ry="8"/><g class="pm-body"><path class="pm-side" d="M5 28V33A19 6.5 0 0 0 43 33V28Z"/><ellipse class="pm-top" cx="24" cy="28" rx="19" ry="6.5"/>';
const BLOCK = (l, r, t) => `<polygon class="b-l" points="${l}"/><polygon class="b-r" points="${r}"/><polygon class="b-t" points="${t}"/>`;
const PINS = {
  levan: SIDE
    + BLOCK("21.1,25 26.5,26.8 26.5,15.6 21.1,13.7", "26.5,26.8 31.9,25 31.9,13.7 26.5,15.6", "21.1,13.7 26.5,15.6 31.9,13.7 26.5,11.9")
    + BLOCK("12.6,26.3 17.7,28 17.7,22.4 12.6,20.6", "17.7,28 21.4,26.7 21.4,21.1 17.7,22.4", "12.6,20.6 17.7,22.4 21.4,21.1 16.3,19.4")
    + BLOCK("27.4,29.9 31.9,31.4 31.9,26.7 27.4,25.2", "31.9,31.4 35.6,30.1 35.6,25.4 31.9,26.7", "27.4,25.2 31.9,26.7 35.6,25.4 31.1,23.9")
    + BLOCK("17.2,30.9 21.4,32.3 21.4,28.5 17.2,27.1", "21.4,32.3 24.8,31.1 24.8,27.4 21.4,28.5", "17.2,27.1 21.4,28.5 24.8,27.4 20.6,25.9") + "</g>",
  project: SIDE
    + BLOCK("16.2,26.8 22.7,29 22.7,22.4 16.2,20.2", "22.7,29 27.8,27.2 27.8,20.7 22.7,22.4", "16.2,20.2 22.7,22.4 27.8,20.7 21.3,18.4")
    + BLOCK("24.4,29.4 28.9,30.9 28.9,26.7 24.4,25.1", "28.9,30.9 32.6,29.6 32.6,25.4 28.9,26.7", "24.4,25.1 28.9,26.7 32.6,25.4 28.1,23.9") + "</g>",
  office: SIDE + '<circle class="pm-dot" cx="24" cy="28" r="3.2"/></g>',
};
export const pinSVG = (kind) => `<svg class="pm" viewBox="0 0 48 40" aria-hidden="true" focusable="false">${PINS[kind] || PINS.office}</svg>`;

/* ── Office plates (İletişim): a still, pitched view of the street round each address ── */
async function plate(box) {
  const holder = box.querySelector(".minimap-gl");
  const at = [+box.dataset.lng, +box.dataset.lat];
  try {
    const [ml, style] = await Promise.all([lib(), paperStyle()]);
    const map = new ml.Map({
      container: holder, style, center: at, zoom: +(box.dataset.zoom || 15.9), pitch: 52, bearing: +(box.dataset.bearing || -24),
      interactive: false, attributionControl: { compact: true }, locale: TR, fadeDuration: 0,
    });
    const el = document.createElement("div");
    el.className = "mpin k-office on";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = pinSVG("office");
    new ml.Marker({ element: el, anchor: "bottom", offset: [0, 12] }).setLngLat(at).addTo(map);
    map.on("error", (e) => console.warn("Harita:", (e.error && e.error.message) || e));
    // a still picture of the street, not a control: name it after the place
    const cv = map.getCanvas();
    cv.setAttribute("role", "img");
    cv.setAttribute("aria-label", box.dataset.label || "Harita");
    cv.removeAttribute("tabindex");
    await drawn(map);
    const attrib = holder.querySelector(".maplibregl-ctrl-attrib");
    if (attrib) attrib.classList.remove("maplibregl-compact-show");
    box.classList.add("gl");
  } catch (e) {
    console.warn("Harita gösterilemiyor; çizim kalıyor.", e);
  }
}
if (hasGL()) document.querySelectorAll(".minimap[data-lng]").forEach((box) => whenNear(box, () => plate(box)));
