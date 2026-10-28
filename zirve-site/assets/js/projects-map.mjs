/* Zirve · projects index: the real map. MapLibre GL (the same version the live site ships, served from concepts/assets/vendor)
   with OpenFreeMap tiles (free, no key, no tracking), recoloured to obsidian and platinum with lilac rings, with 3D buildings, the 5/10/15 km
   rings around Levan and the house pins. It loads only when the map is about to be seen; if the library, WebGL or the
   tiles are unavailable (offline at a presentation, say), the drawn sheet underneath stays. */

const OVERVIEW_PITCH = 38;
const OVERVIEW_BEARING = -14;
const RINGS_KM = [5, 10, 15];

const TR = {
  "CooperativeGesturesHandler.WindowsHelpText": "Haritayı yakınlaştırmak için Ctrl tuşuna basılı tutarak kaydırın",
  "CooperativeGesturesHandler.MacHelpText": "Haritayı yakınlaştırmak için ⌘ tuşuna basılı tutarak kaydırın",
  "CooperativeGesturesHandler.MobileHelpText": "Haritayı hareket ettirmek için iki parmağınızı kullanın",
  "NavigationControl.ZoomIn": "Yakınlaştır",
  "NavigationControl.ZoomOut": "Uzaklaştır",
  "NavigationControl.ResetBearing": "Döndürmek için sürükleyin, kuzeye dönmek için tıklayın",
  "AttributionControl.ToggleAttribution": "Harita kaynakları",
};

/* Recolour OpenFreeMap's Positron to Zirve: an obsidian ground, quiet graphite roads, motorways in platinum, labels in
   the page's greys, buildings raised in 3D once close. */
function restyle(style) {
  for (const l of style.layers) {
    const id = l.id;
    l.paint = l.paint || {};
    if (l.type === "background") l.paint["background-color"] = "#0b0b0e";
    else if (id === "water") l.paint["fill-color"] = "#050507";
    else if (id === "waterway") l.paint["line-color"] = "#121218";
    else if (/park|landcover_wood|landcover_glacier|landcover_ice/.test(id)) { l.paint["fill-color"] = "#0f1013"; l.paint["fill-opacity"] = 1; }
    else if (id === "landuse_residential") { l.paint["fill-color"] = "#0d0d11"; l.paint["fill-opacity"] = 1; }
    else if (id === "building") l.layout = { ...(l.layout || {}), visibility: "none" };
    else if (/aeroway/.test(id)) { if (l.type === "line") l.paint["line-color"] = "#1d1d24"; else l.paint["fill-color"] = "#15151a"; }
    else if (l.type === "line" && /casing/.test(id)) l.paint["line-color"] = "#0b0b0e";
    else if (l.type === "line" && /motorway/.test(id)) l.paint["line-color"] = /subtle/.test(id) ? "#4c4e58" : "#9a9eab";
    else if (l.type === "line" && /highway_major/.test(id)) l.paint["line-color"] = /subtle/.test(id) ? "#2b2c33" : "#4a4b55";
    else if (l.type === "line" && /highway_minor|road_pier/.test(id)) l.paint["line-color"] = "#24252c";
    else if (l.type === "line" && /highway_path/.test(id)) l.paint["line-color"] = "#1b1c22";
    else if (l.type === "line" && /railway/.test(id)) l.paint["line-color"] = "#2c2d35";
    else if (l.type === "line" && /boundary/.test(id)) l.paint["line-color"] = "#3b3c45";
    else if (l.type === "fill" && /road_area/.test(id)) l.paint["fill-color"] = "#1b1c22";
    else if (l.type === "symbol") {
      if (/shield/.test(id)) { l.layout = { ...(l.layout || {}), visibility: "none" }; continue; }
      l.paint["text-color"] = /label_city/.test(id) ? "#a3a1ae" : /label_town/.test(id) ? "#8a8894" : /label_other|label_village|highway-name/.test(id) ? "#6e6c78" : "#7c7a86";
      l.paint["text-halo-color"] = "#0b0b0e";
      l.paint["text-halo-width"] = 1.2;
    }
  }
  style.layers.push({
    id: "uzm-3d-buildings",
    source: "openmaptiles",
    "source-layer": "building",
    type: "fill-extrusion",
    minzoom: 13,
    paint: {
      "fill-extrusion-color": "#1d1d24",
      "fill-extrusion-height": ["coalesce", ["get", "render_height"], 8],
      "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
      "fill-extrusion-opacity": 0.88,
    },
  });
  return style;
}

/* A circle of r km around a point, as a closed line (good enough at this scale). */
function circle([lng, lat], km, steps = 160) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    pts.push([lng + (km / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.cos(a), lat + (km / 110.57) * Math.sin(a)]);
  }
  return pts;
}

function ringLayers(style, center) {
  const lines = RINGS_KM.map((km) => ({ type: "Feature", properties: { km }, geometry: { type: "LineString", coordinates: circle(center, km) } }));
  /* Each ring's label sits on its south-east side. */
  const labels = RINGS_KM.map((km) => {
    const a = (-40 * Math.PI) / 180;
    const [lng, lat] = center;
    return { type: "Feature", properties: { t: km + " km" }, geometry: { type: "Point", coordinates: [lng + (km / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.cos(a), lat + (km / 110.57) * Math.sin(a)] } };
  });
  style.sources["uzm-rings"] = { type: "geojson", data: { type: "FeatureCollection", features: lines } };
  style.sources["uzm-ring-labels"] = { type: "geojson", data: { type: "FeatureCollection", features: labels } };
  style.layers.push(
    { id: "uzm-rings", type: "line", source: "uzm-rings", paint: { "line-color": "#cfcde0", "line-opacity": 0.5, "line-width": 1, "line-dasharray": [1.5, 4] } },
    { id: "uzm-ring-labels", type: "symbol", source: "uzm-ring-labels", layout: { "text-field": ["get", "t"], "text-font": ["Noto Sans Italic"], "text-size": 12, "text-letter-spacing": 0.08 }, paint: { "text-color": "#cfcde0", "text-halo-color": "#0b0b0e", "text-halo-width": 1.4 } },
  );
}

async function start(U, box, holder) {
  /* One WebGL context per page: the stage hands its context back before the map takes one. */
  document.dispatchEvent(new CustomEvent("z:release"));
  const base = new URL(U.assets + "vendor/maplibre/", location.href).href;
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = base + "maplibre-gl.css";
  document.head.appendChild(css);
  const [ml, style] = await Promise.all([
    import(base + "maplibre-gl.mjs"),
    fetch("https://tiles.openfreemap.org/styles/positron").then((r) => {
      if (!r.ok) throw new Error("style " + r.status);
      return r.json();
    }),
  ]);
  ml.setWorkerUrl(base + "maplibre-gl-worker.mjs");

  const places = [...document.querySelectorAll(".places li[data-lng]")].map((li) => ({ id: li.dataset.id, lng: +li.dataset.lng, lat: +li.dataset.lat }));
  const levan = places.find((p) => p.id === "levan");
  restyle(style);
  ringLayers(style, [levan.lng, levan.lat]);

  const bounds = new ml.LngLatBounds();
  places.forEach((p) => bounds.extend([p.lng, p.lat]));

  const map = new ml.Map({
    container: holder,
    style,
    center: [levan.lng, levan.lat],
    zoom: 10,
    pitch: OVERVIEW_PITCH,
    bearing: OVERVIEW_BEARING,
    maxPitch: 70,
    cooperativeGestures: true,
    attributionControl: { compact: true },
    locale: TR,
  });
  map.addControl(new ml.NavigationControl({ visualizePitch: true }), "top-right");

  let overview = null;
  const fitOverview = () => {
    const pad = Math.min(80, holder.clientWidth * 0.12);
    const cam = map.cameraForBounds(bounds, { padding: { top: pad + 20, bottom: pad, left: pad, right: pad }, pitch: OVERVIEW_PITCH, bearing: OVERVIEW_BEARING });
    overview = { ...cam, pitch: OVERVIEW_PITCH, bearing: OVERVIEW_BEARING };
    return overview;
  };

  /* House pins: the drawn sheet's pin, re-made as a map marker. The head office and the municipality are a few
     hundred metres apart, so at a distance their markers stand a little off their points. */
  const STANDOFF = { hq: [0, -20], belediye: [0, 20] };
  const markers = [];
  places.forEach((p) => {
    const src = box.querySelector(`.pin[data-id="${p.id}"]`);
    const el = document.createElement("button");
    el.type = "button";
    el.className = "gpin " + [...src.classList].filter((c) => c !== "pin").join(" ");
    el.dataset.id = p.id;
    el.setAttribute("aria-label", src.getAttribute("aria-label"));
    el.innerHTML = src.querySelector(".pin-mk").outerHTML + " " + src.querySelector(".pin-lb").outerHTML;
    U.mapBindPin(el);
    const m = new ml.Marker({ element: el, anchor: "center" }).setLngLat([p.lng, p.lat]).addTo(map);
    markers.push({ id: p.id, m });
  });
  const standoff = () => {
    const far = map.getZoom() < 12.5;
    markers.forEach(({ id, m }) => m.setOffset(far && STANDOFF[id] ? STANDOFF[id] : [0, 0]));
  };
  map.on("zoom", standoff);

  /* Show the map once it has drawn its first complete frame; on a slow connection, 6 s after the style is in place,
     with tiles still streaming. A failed tile is not fatal (MapLibre logs it); only a map that never draws falls back
     to the sheet. */
  map.on("error", (e) => console.warn("Harita:", (e.error && e.error.message) || e));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("harita zamanında çizilemedi")), 25000);
    const ready = () => { clearTimeout(timer); resolve(); };
    map.once("load", ready);
    map.once("style.load", () => setTimeout(ready, 6000));
  });
  map.jumpTo(fitOverview());
  standoff();
  /* On a narrow map the credits fold behind their (i) button, as MapLibre does by default; wide maps show them. */
  if (holder.clientWidth < 520) {
    const attrib = holder.querySelector(".maplibregl-ctrl-attrib");
    if (attrib) attrib.classList.remove("maplibregl-compact-show");
  }
  box.classList.add("gl");

  /* Take over the map view: fly to a place (closer for exact addresses, farther for approximate ones), and keep it
     clear of the card in the lower-left corner. */
  const motion = U.reduced ? { duration: 0 } : {};
  U.mapView = {
    focus(id) {
      const p = places.find((x) => x.id === id);
      const approx = box.querySelector(`.pin[data-id="${id}"]`).classList.contains("approx");
      const card = document.querySelector(".map-card");
      card.classList.remove("top");
      card.classList.add("right");
      const w = holder.clientWidth, h = holder.clientHeight;
      map.flyTo({
        center: [p.lng, p.lat],
        /* Levan is a whole neighbourhood still being built: shown with its surroundings. Offices come in close. */
        zoom: approx ? 12.6 : id === "levan" ? 12.9 : 15.2,
        pitch: approx ? 45 : id === "levan" ? 50 : 60,
        bearing: OVERVIEW_BEARING + (id === "levan" ? 18 : -8),
        offset: innerWidth < 640 ? [0, 0] : [-w * 0.16, -h * 0.08],
        duration: 2600,
        essential: true,
        ...motion,
      });
    },
    reset() {
      map.flyTo({ ...(overview || fitOverview()), duration: 2200, essential: true, ...motion });
    },
  };
  new ResizeObserver(() => { map.resize(); fitOverview(); }).observe(holder);
}

function init() {
  const U = window.Z;
  const box = document.querySelector(".map");
  const holder = box && box.querySelector(".map-gl");
  if (!U || !holder) return;
  const io = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      /* While the live map loads, the drawn sheet stands in and says so. */
      const note = document.createElement("p");
      note.className = "map-loading";
      note.setAttribute("role", "status");
      note.textContent = "Canlı harita yükleniyor…";
      box.appendChild(note);
      const done = () => note.remove();
      start(U, box, holder).then(done, (err) => {
        done();
        if (box.classList.contains("gl")) return;
        /* Offline, no WebGL, or the tile service is down: keep the drawn sheet. */
        box.classList.remove("gl");
        holder.remove();
        console.warn("Harita yüklenemedi; çizim gösteriliyor.", err);
      });
    },
    { rootMargin: "60% 0px" },
  );
  io.observe(box);
}

if (window.Z) init();
else addEventListener("DOMContentLoaded", init, { once: true });
