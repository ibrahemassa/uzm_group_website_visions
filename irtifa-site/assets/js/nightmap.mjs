/* İrtifa · the night map shared by every page that shows one: OpenFreeMap vector tiles (free, no key) drawn as the
   city at night: black land, deep water, motorways as gold light, a warm glow over built-up areas, dark extruded
   buildings close in, and (on the globe) natural-earth relief under an atmosphere. loadML() fetches MapLibre from
   concepts/assets/vendor once; nightStyle() returns a style object, with extra sources/layers on top. */
const U = window.UZM || {};
export const LEVAN = [28.6862, 41.1072];
export const OFFICES = { hq: [28.775260286794463, 41.12131026556604], sales: [28.6808779, 41.0837055] };
export const hasGL = () => { try { return !!document.createElement("canvas").getContext("webgl2"); } catch (_) { return false; } };

// Big cities, for the lights of the planet seen from orbit (OpenMapTiles has no towns at those zooms)
const CITIES = [
  [28.978, 41.008, 2.2], [32.86, 39.933, 1.2], [27.143, 38.424, 1], [29.061, 40.189, 0.8], [30.713, 36.897, 0.7], [35.321, 37, 0.7],
  [32.485, 37.875, 0.6], [37.383, 37.066, 0.6], [35.483, 38.72, 0.5], [39.717, 41.003, 0.4], [40.231, 37.914, 0.5], [36.33, 41.287, 0.4],
  [30.521, 39.777, 0.4], [34.642, 36.812, 0.5], [-0.128, 51.507, 1.6], [2.352, 48.857, 1.6], [-3.704, 40.417, 1.1], [2.173, 41.385, 0.9],
  [12.496, 41.903, 1], [9.19, 45.464, 1], [13.405, 52.52, 1.1], [9.994, 53.551, 0.7], [11.582, 48.135, 0.7], [4.904, 52.368, 0.8],
  [4.352, 50.85, 0.7], [16.374, 48.208, 0.8], [14.438, 50.076, 0.6], [21.012, 52.23, 0.8], [19.04, 47.498, 0.7], [26.103, 44.427, 0.8],
  [23.322, 42.698, 0.6], [23.728, 37.984, 0.9], [20.449, 44.787, 0.6], [30.523, 50.45, 1], [37.617, 55.756, 1.8], [30.335, 59.934, 1],
  [18.069, 59.329, 0.5], [10.752, 59.914, 0.4], [12.568, 55.676, 0.5], [24.938, 60.17, 0.4], [-9.139, 38.722, 0.6], [-6.26, 53.35, 0.5],
  [-2.243, 53.481, 0.6], [8.542, 47.377, 0.5], [4.836, 45.764, 0.5], [5.37, 43.297, 0.5], [14.268, 40.852, 0.6], [31.236, 30.044, 1.8],
  [29.919, 31.2, 0.9], [34.782, 32.085, 0.8], [35.502, 33.894, 0.6], [36.277, 33.514, 0.7], [44.366, 33.315, 1], [51.389, 35.689, 1.4],
  [46.675, 24.714, 1], [39.193, 21.486, 0.8], [55.271, 25.205, 1], [51.531, 25.285, 0.5], [47.978, 29.376, 0.5], [49.867, 40.409, 0.6],
  [44.827, 41.715, 0.4], [44.515, 40.187, 0.4], [35.928, 31.945, 0.6], [10.182, 36.807, 0.5], [3.059, 36.754, 0.7], [-7.59, 33.573, 0.7],
  [13.191, 32.887, 0.4], [3.379, 6.524, 1.2], [32.56, 15.501, 0.6], [38.758, 8.981, 0.6], [36.822, -1.292, 0.6], [15.266, -4.442, 0.8],
  [28.047, -26.204, 0.9], [67.001, 24.861, 1.2], [77.103, 28.704, 1.6], [72.878, 19.076, 1.5], [69.24, 41.3, 0.6], [76.851, 43.222, 0.5],
];

let libP = null;
export function loadML() {
  if (!libP) {
    const base = new URL((U.assets || "../assets/") + "vendor/maplibre/", location.href).href;
    const css = document.createElement("link");
    css.rel = "stylesheet"; css.href = base + "maplibre-gl.css";
    document.head.appendChild(css);
    libP = import(base + "maplibre-gl.mjs").then((ml) => { ml.setWorkerUrl(base + "maplibre-gl-worker.mjs"); return ml; });
  }
  return libP;
}

/* MapLibre's own control strings, in Turkish */
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

export function nightStyle({ globe = true, sources = {}, layers = [] } = {}) {
  const gold = "#f2c97e", goldD = "#b0843f";
  return {
    version: 8,
    projection: { type: globe ? "globe" : "mercator" },
    sky: {
      "sky-color": "#050608", "horizon-color": "#2a3348", "fog-color": "#0a0d13",
      "sky-horizon-blend": 0.7, "horizon-fog-blend": 0.8, "fog-ground-blend": 0.9,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 8, 0],
    },
    sources: {
      omt: { type: "vector", url: "https://tiles.openfreemap.org/planet" },
      relief: { type: "raster", tiles: ["https://tiles.openfreemap.org/natural_earth/ne2sr/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 6 },
      cities: { type: "geojson", data: { type: "FeatureCollection", features: CITIES.map(([x, y, w]) => ({ type: "Feature", properties: { w }, geometry: { type: "Point", coordinates: [x, y] } })) } },
      ...sources,
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#07090c" } },
      { id: "relief", type: "raster", source: "relief", paint: { "raster-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.55, 5, 0.35, 7, 0], "raster-saturation": -1, "raster-brightness-max": 0.22, "raster-contrast": 0.25, "raster-fade-duration": 0 } },
      { id: "water", type: "fill", source: "omt", "source-layer": "water", paint: { "fill-color": ["interpolate", ["linear"], ["zoom"], 2, "#081222", 10, "#0a1424"], "fill-antialias": true } },
      { id: "city", type: "fill", source: "omt", "source-layer": "landuse", filter: ["in", ["get", "class"], ["literal", ["residential", "commercial", "retail", "industrial", "suburb", "neighbourhood"]]], paint: { "fill-color": "#3a2b12", "fill-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0, 8, 0.55, 12, 0.4, 15, 0.22] } },
      { id: "green", type: "fill", source: "omt", "source-layer": "landcover", minzoom: 9, filter: ["in", ["get", "class"], ["literal", ["wood", "grass", "farmland"]]], paint: { "fill-color": "#0b130e", "fill-opacity": 0.7 } },
      { id: "border", type: "line", source: "omt", "source-layer": "boundary", filter: ["all", ["==", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1]], paint: { "line-color": "#4a4f58", "line-width": 0.7, "line-dasharray": [3, 2], "line-opacity": ["interpolate", ["linear"], ["zoom"], 1, 0.7, 8, 0.2] } },
      { id: "road-minor", type: "line", source: "omt", "source-layer": "transportation", minzoom: 11, filter: ["in", ["get", "class"], ["literal", ["tertiary", "minor", "service"]]], paint: { "line-color": "#6b5530", "line-width": ["interpolate", ["exponential", 1.6], ["zoom"], 11, 0.3, 16, 2.4], "line-opacity": 0.75 } },
      { id: "road-major-glow", type: "line", source: "omt", "source-layer": "transportation", minzoom: 7, filter: ["in", ["get", "class"], ["literal", ["primary", "secondary"]]], paint: { "line-color": goldD, "line-width": ["interpolate", ["exponential", 1.6], ["zoom"], 7, 1, 12, 5, 16, 16], "line-blur": ["interpolate", ["linear"], ["zoom"], 7, 1, 16, 10], "line-opacity": 0.28 } },
      { id: "road-major", type: "line", source: "omt", "source-layer": "transportation", minzoom: 7, filter: ["in", ["get", "class"], ["literal", ["primary", "secondary"]]], paint: { "line-color": "#c99a50", "line-width": ["interpolate", ["exponential", 1.6], ["zoom"], 7, 0.3, 12, 1.1, 16, 4], "line-opacity": 0.85 } },
      { id: "road-motor-glow", type: "line", source: "omt", "source-layer": "transportation", minzoom: 4, filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk"]]], paint: { "line-color": "#e3a64a", "line-width": ["interpolate", ["exponential", 1.6], ["zoom"], 4, 2, 8, 5, 12, 12, 16, 34], "line-blur": ["interpolate", ["linear"], ["zoom"], 4, 2, 16, 18], "line-opacity": 0.35 } },
      { id: "road-motor", type: "line", source: "omt", "source-layer": "transportation", minzoom: 4, filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk"]]], paint: { "line-color": gold, "line-width": ["interpolate", ["exponential", 1.6], ["zoom"], 4, 0.4, 8, 1.1, 12, 2.6, 16, 7], "line-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0.5, 6, 1] } },
      { id: "lights", type: "heatmap", source: "omt", "source-layer": "place", maxzoom: 12, filter: ["in", ["get", "class"], ["literal", ["city", "town", "village", "suburb"]]], paint: {
        "heatmap-weight": ["match", ["get", "class"], "city", 1, "town", 0.55, "suburb", 0.35, 0.18],
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 2, 0.8, 9, 1.4],
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 2, 5, 5, 12, 9, 28, 12, 40],
        "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 2, 0.95, 9, 0.55, 11.5, 0],
        "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(0,0,0,0)", 0.15, "rgba(110,70,20,0.35)", 0.45, "rgba(205,145,60,0.75)", 0.75, "#f2c97e", 1, "#fff4d6"],
      } },
      { id: "buildings", type: "fill-extrusion", source: "omt", "source-layer": "building", minzoom: 13, paint: { "fill-extrusion-color": "#171a20", "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 13, 0, 14.5, ["coalesce", ["get", "render_height"], 8]], "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0], "fill-extrusion-opacity": 0.92, "fill-extrusion-vertical-gradient": true } },
      ...(globe ? [{ id: "planet-lights", type: "heatmap", source: "cities", maxzoom: 6, paint: {
        "heatmap-weight": ["get", "w"],
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 0.9, 5, 0.6],
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 5, 2, 9, 5, 22],
        "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.95, 4, 0.8, 5.8, 0],
        "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(0,0,0,0)", 0.12, "rgba(120,78,22,0.35)", 0.4, "rgba(214,154,66,0.8)", 0.75, "#f4cd85", 1, "#fff6dc"],
      } }] : []),
      ...layers,
    ],
  };
}

