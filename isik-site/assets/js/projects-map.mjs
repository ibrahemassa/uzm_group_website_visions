/* Işık · projects: the live map. MapLibre GL (served from concepts/assets/vendor) with OpenFreeMap tiles (free, no key),
   recoloured to the Işık palette in two lights, day (silver-blue) and night (moonlit), with 3D buildings, 5/10/15 km
   rings around Levan and glass pins. It loads only when the map is about to be seen; if the library, WebGL or the
   tiles are unavailable, the drawn sheet underneath stays. */

const PITCH = 40;
const BEARING = -14;
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

/* Two lights. Each entry: [test(layer), paint property, day colour, night colour]. */
const PAL = {
  bg: ["#eceff4", "#14161c"],
  water: ["#c4d3ea", "#0c1426"],
  waterway: ["#b3c5e2", "#132038"],
  park: ["#dde6e0", "#161b20"],
  resi: ["#e5e8ee", "#181a21"],
  aero: ["#e2e5ec", "#1c1f28"],
  casing: ["#d3d9e4", "#101218"],
  motor: ["#9fb0d0", "#7c8fc0"],
  motorSub: ["#c3cde0", "#3f4a6a"],
  major: ["#ffffff", "#353b4c"],
  majorSub: ["#f4f6fa", "#262a36"],
  minor: ["#fbfcfd", "#22252f"],
  path: ["#e4e8ef", "#1e212a"],
  rail: ["#cfd5df", "#2b2f3a"],
  bound: ["#b8c0cf", "#3a3f4d"],
  roadArea: ["#f4f6f9", "#1e212a"],
  label: ["#4f5561", "#a9b0bf"],
  labelCity: ["#2a2d34", "#d2d8e6"],
  halo: ["#f5f6f8", "#14161c"],
  bldg: ["#d9dfea", "#242a3a"],
  ring: ["#3d4b6e", "#c4d2ff"],
};

function plan(style) {
  const sets = [];
  const put = (layer, prop, key, where = "paint") => sets.push({ id: layer.id, prop, key, where });
  for (const l of style.layers) {
    const id = l.id;
    l.paint = l.paint || {};
    if (l.type === "background") put(l, "background-color", "bg");
    else if (id === "water") put(l, "fill-color", "water");
    else if (id === "waterway") put(l, "line-color", "waterway");
    else if (/park|landcover_wood|landcover_glacier|landcover_ice/.test(id)) { l.paint["fill-opacity"] = 1; put(l, "fill-color", "park"); }
    else if (id === "landuse_residential") { l.paint["fill-opacity"] = 1; put(l, "fill-color", "resi"); }
    else if (id === "building") l.layout = { ...(l.layout || {}), visibility: "none" };
    else if (/aeroway/.test(id)) put(l, l.type === "line" ? "line-color" : "fill-color", "aero");
    else if (l.type === "line" && /casing/.test(id)) put(l, "line-color", "casing");
    else if (l.type === "line" && /motorway/.test(id)) put(l, "line-color", /subtle/.test(id) ? "motorSub" : "motor");
    else if (l.type === "line" && /highway_major/.test(id)) put(l, "line-color", /subtle/.test(id) ? "majorSub" : "major");
    else if (l.type === "line" && /highway_minor|road_pier/.test(id)) put(l, "line-color", "minor");
    else if (l.type === "line" && /highway_path/.test(id)) put(l, "line-color", "path");
    else if (l.type === "line" && /railway/.test(id)) put(l, "line-color", "rail");
    else if (l.type === "line" && /boundary/.test(id)) put(l, "line-color", "bound");
    else if (l.type === "fill" && /road_area/.test(id)) put(l, "fill-color", "roadArea");
    else if (l.type === "symbol") {
      if (/shield/.test(id)) { l.layout = { ...(l.layout || {}), visibility: "none" }; continue; }
      put(l, "text-color", /label_city|label_town/.test(id) ? "labelCity" : "label");
      put(l, "text-halo-color", "halo");
      l.paint["text-halo-width"] = 1.3;
    }
  }
  style.layers.push({
    id: "isik-3d", source: "openmaptiles", "source-layer": "building", type: "fill-extrusion", minzoom: 13,
    paint: { "fill-extrusion-height": ["coalesce", ["get", "render_height"], 8], "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0], "fill-extrusion-opacity": 0.85 },
  });
  sets.push({ id: "isik-3d", prop: "fill-extrusion-color", key: "bldg" });
  return sets;
}

function circle([lng, lat], km, steps = 160) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    pts.push([lng + (km / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.cos(a), lat + (km / 110.57) * Math.sin(a)]);
  }
  return pts;
}

function rings(style, center, sets) {
  const [lng, lat] = center;
  const lines = RINGS_KM.map((km) => ({ type: "Feature", properties: { km }, geometry: { type: "LineString", coordinates: circle(center, km) } }));
  const a = (-40 * Math.PI) / 180;
  const labels = RINGS_KM.map((km) => ({ type: "Feature", properties: { t: km + " km" }, geometry: { type: "Point", coordinates: [lng + (km / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.cos(a), lat + (km / 110.57) * Math.sin(a)] } }));
  style.sources["isik-rings"] = { type: "geojson", data: { type: "FeatureCollection", features: lines } };
  style.sources["isik-ring-labels"] = { type: "geojson", data: { type: "FeatureCollection", features: labels } };
  style.layers.push(
    { id: "isik-rings", type: "line", source: "isik-rings", paint: { "line-opacity": 0.55, "line-width": 1.2, "line-dasharray": [1.5, 3] } },
    { id: "isik-ring-labels", type: "symbol", source: "isik-ring-labels", layout: { "text-field": ["get", "t"], "text-font": ["Noto Sans Regular"], "text-size": 12, "text-letter-spacing": 0.06 }, paint: { "text-halo-width": 1.4 } },
  );
  sets.push({ id: "isik-rings", prop: "line-color", key: "ring" }, { id: "isik-ring-labels", prop: "text-color", key: "ring" }, { id: "isik-ring-labels", prop: "text-halo-color", key: "halo" });
}

const apply = (style, sets, mode) => {
  const k = mode === "night" ? 1 : 0;
  const byId = new Map(style.layers.map((l) => [l.id, l]));
  for (const s of sets) { const l = byId.get(s.id); if (l) { l.paint = l.paint || {}; l.paint[s.prop] = PAL[s.key][k]; } }
};

async function start(U, box, holder) {
  const base = new URL(U.assets + "vendor/maplibre/", location.href).href;
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = base + "maplibre-gl.css";
  document.head.appendChild(css);
  const [ml, style] = await Promise.all([
    import(base + "maplibre-gl.mjs"),
    fetch("https://tiles.openfreemap.org/styles/positron").then((r) => { if (!r.ok) throw new Error("style " + r.status); return r.json(); }),
  ]);
  ml.setWorkerUrl(base + "maplibre-gl-worker.mjs");

  const places = [...document.querySelectorAll(".places li[data-lng]")].map((li) => ({ id: li.dataset.id, lng: +li.dataset.lng, lat: +li.dataset.lat }));
  const levan = places.find((p) => p.id === "levan");
  const sets = plan(style);
  rings(style, [levan.lng, levan.lat], sets);
  apply(style, sets, U.mapLightMode);

  const bounds = new ml.LngLatBounds();
  places.forEach((p) => bounds.extend([p.lng, p.lat]));
  const map = new ml.Map({
    container: holder, style, center: [levan.lng, levan.lat], zoom: 10, pitch: PITCH, bearing: BEARING, maxPitch: 70,
    cooperativeGestures: true, attributionControl: { compact: true }, locale: TR,
  });
  map.addControl(new ml.NavigationControl({ visualizePitch: true }), "top-right");

  let overview = null;
  const fitOverview = () => {
    const wide = holder.clientWidth > 900;
    const pad = Math.min(70, holder.clientWidth * 0.1);
    const cam = map.cameraForBounds(bounds, { padding: { top: pad + 30, bottom: pad, left: wide ? holder.clientWidth * 0.36 : pad, right: pad }, pitch: PITCH, bearing: BEARING });
    overview = { ...cam, pitch: PITCH, bearing: BEARING };
    return overview;
  };

  /* Glass pins, one per place; the head office and the municipality stand a little apart when far away. */
  const STANDOFF = { hq: [0, -22], belediye: [0, 22] };
  const markers = [];
  places.forEach((p) => {
    const src = box.querySelector(`.spin[data-id="${p.id}"]`);
    const li = document.querySelector(`.places li[data-id="${p.id}"]`);
    const el = document.createElement("button");
    el.type = "button";
    el.className = "gpin " + [...src.classList].filter((c) => c !== "spin").join(" ");
    el.dataset.id = p.id;
    el.setAttribute("aria-label", li.querySelector(".place-nm").textContent + (src.classList.contains("approx") ? ", yaklaşık konum" : ""));
    el.innerHTML = '<i aria-hidden="true"></i><span aria-hidden="true">' + src.textContent + "</span>";
    U.mapBindPin(el);
    const m = new ml.Marker({ element: el, anchor: "center" }).setLngLat([p.lng, p.lat]).addTo(map);
    markers.push({ id: p.id, m });
  });
  const standoff = () => { const far = map.getZoom() < 12.5; markers.forEach(({ id, m }) => m.setOffset(far && STANDOFF[id] ? STANDOFF[id] : [0, 0])); };
  map.on("zoom", standoff);

  map.on("error", (e) => console.warn("Harita:", (e.error && e.error.message) || e));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("harita zamanında çizilemedi")), 25000);
    const ready = () => { clearTimeout(timer); resolve(); };
    map.once("load", ready);
    map.once("style.load", () => setTimeout(ready, 6000));
  });
  map.jumpTo(fitOverview());
  standoff();
  if (holder.clientWidth < 520) { const at = holder.querySelector(".maplibregl-ctrl-attrib"); if (at) at.classList.remove("maplibregl-compact-show"); }
  box.classList.add("gl");

  /* The light toggle repaints the live map. */
  U.mapLightSet = (mode) => {
    const k = mode === "night" ? 1 : 0;
    for (const s of sets) { if (map.getLayer(s.id)) map.setPaintProperty(s.id, s.prop, PAL[s.key][k]); }
  };

  const motion = U.reduced ? { duration: 0 } : {};
  U.mapView = {
    focus(id) {
      const p = places.find((x) => x.id === id);
      const approx = box.querySelector(`.spin[data-id="${id}"]`).classList.contains("approx");
      const w = holder.clientWidth, h = holder.clientHeight, wide = w > 900;
      map.flyTo({
        center: [p.lng, p.lat],
        zoom: approx ? 12.6 : id === "levan" ? 13 : 15.2,
        pitch: approx ? 45 : id === "levan" ? 52 : 60,
        bearing: BEARING + (id === "levan" ? 18 : -8),
        offset: wide ? [w * 0.17, -h * 0.06] : [0, -h * 0.12],
        duration: 2600, essential: true, ...motion,
      });
    },
    reset() { map.flyTo({ ...(overview || fitOverview()), duration: 2200, essential: true, ...motion }); },
  };
  let rt;
  new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { map.resize(); fitOverview(); }, 120); }).observe(holder);
}

function init() {
  const U = window.UZM;
  const box = document.querySelector("#map");
  const holder = box && box.querySelector(".map-gl");
  if (!U || !holder) return;
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    const note = document.createElement("p");
    note.className = "map-loading";
    note.setAttribute("role", "status");
    note.textContent = "Canlı harita yükleniyor…";
    box.appendChild(note);
    const done = () => note.remove();
    start(U, box, holder).then(done, (err) => {
      done();
      if (box.classList.contains("gl")) return;
      holder.remove();
      console.warn("Harita yüklenemedi; çizim gösteriliyor.", err);
    });
  }, { rootMargin: "60% 0px" });
  io.observe(box);
}

if (window.UZM) init();
else addEventListener("DOMContentLoaded", init, { once: true });
