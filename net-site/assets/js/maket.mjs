/* Maket — the Levan scale model, live in the browser.
 *
 * The architect's SketchUp model (levan.glb, the one the Başakşehir presentation shows) is reduced at load to a
 * handful of meshes, one per material class (clay, glass, hardscape, planting, water, ground), so the whole site draws
 * in a few calls. Every vertex keeps the index of the building it belongs to (aId); a small float texture holds each
 * building's live state — lift, spin, highlight, ghost — and its footprint centre, base and height. The shaders read it,
 * so picking a villa up off the model, dimming everything but the manors or letting the blocks rise from their
 * foundations costs nothing per frame. The site is cut round, like a model on its plinth, and lit by a sun that keeps
 * Istanbul's hours; after dark the windows light up.
 *
 *   const m = await Maket.create(host, { onProgress });
 *   m.setTime(19.5); m.flyTo({ az, el, dist, target }, 1.6); m.setCategory("villa"); m.lift("unit_V-12");
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

/* ── The plinth: a disc round the built area (model units are metres; north is −z, east +x) ── */
export const PLINTH = { cx: 212, cz: 192, r: 262, base: -58 };
export const HOME_TARGET = new THREE.Vector3(212, 14, 192);

const C = { BUILD: 0, GLASS: 1, HARD: 2, GREEN: 3, WATER: 4, GROUND: 5 };
const CLASS_NAMES = ["build", "glass", "hard", "green", "water", "ground"];

/** Which kind of home a model node is. Blocks A–C hold the apartments; V, İ and M are plots. */
export function kindOf(name) {
  if (/^block_/.test(name)) return "daire";
  if (/^unit_I-/.test(name)) return "ikiz";
  if (/^unit_V-/.test(name)) return "villa";
  if (/^unit_M-/.test(name)) return "malikane";
  return null;
}

function classify(mat, isSite) {
  const n = (mat.name || "").toLowerCase();
  if (/glass|translucent|cam(?:\b|_)|window|pencere/.test(n) || (mat.transparent && mat.opacity < 0.9)) return isSite ? C.HARD : C.GLASS;
  if (/water|pool|havuz/.test(n)) return C.WATER;
  if (/vegetation|grass|juniper|moss|tree|çim|草|leaf|bush|hedge|plant|groundcover/.test(n)) return C.GREEN;
  if (isSite) return /asphalt|blacktop|paver|tile|concrete|beton|stone|granite|brick|road|metal|fenc|wood|sand|charcoal|black|gray|grey/.test(n) ? C.HARD : C.GROUND;
  return C.BUILD;
}

/* ── Light over a day in Bahçeşehir: keyframes by hour, interpolated ── */
const SKY = [
  // h, background, sun colour, sun intensity, hemi sky, hemi ground, hemi intensity, night (windows/bloom)
  [0.0, "#090c12", "#9db3ff", 0.18, "#26324d", "#07080b", 0.32, 1],
  [5.2, "#0d121b", "#9db3ff", 0.16, "#2a3550", "#08090c", 0.34, 1],
  [6.2, "#c9bcb4", "#ffc9a0", 0.9, "#c7c4cc", "#5b5148", 0.75, 0.35],
  [7.4, "#e8e2da", "#ffe4c8", 2.4, "#ece9e6", "#7e7466", 1.0, 0],
  [12.0, "#ebe8e2", "#fff6ea", 3.1, "#f3f2f0", "#8a8174", 1.15, 0],
  [16.5, "#eae5dd", "#fff0de", 2.7, "#efebe6", "#857b6d", 1.05, 0],
  [18.4, "#eee4d6", "#ffe0b8", 2.8, "#f3ece4", "#9a8c79", 1.12, 0],
  [19.4, "#eadac6", "#ffd2a0", 2.5, "#f0e6da", "#8f806d", 1.08, 0.12],
  [19.9, "#a9a3ae", "#ffc79c", 1.2, "#aeabbc", "#4a4650", 0.7, 0.45],
  [20.35, "#4c5068", "#c9c3e0", 0.45, "#5b6284", "#1d1f2a", 0.55, 0.8],
  [20.9, "#1d2333", "#aebcff", 0.22, "#34405f", "#101219", 0.42, 0.95],
  [21.4, "#0b0f17", "#9db3ff", 0.18, "#26324d", "#07080b", 0.32, 1],
  [24.0, "#090c12", "#9db3ff", 0.18, "#26324d", "#07080b", 0.32, 1],
];
const col = (h) => new THREE.Color(h);
const SKY_C = SKY.map(([h, bg, sc, si, hs, hg, hi, n]) => ({ h, bg: col(bg), sc: col(sc), si, hs: col(hs), hg: col(hg), hi, n }));

export function skyAt(hour) {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < SKY_C.length - 2 && SKY_C[i + 1].h <= h) i++;
  const a = SKY_C[i], b = SKY_C[i + 1], t = (h - a.h) / (b.h - a.h || 1), s = t * t * (3 - 2 * t);
  const lerpC = (x, y) => x.clone().lerp(y, s);
  const out = {
    bg: lerpC(a.bg, b.bg), sunColor: lerpC(a.sc, b.sc), sunI: a.si + (b.si - a.si) * s,
    hemiSky: lerpC(a.hs, b.hs), hemiGround: lerpC(a.hg, b.hg), hemiI: a.hi + (b.hi - a.hi) * s, night: a.n + (b.n - a.n) * s,
  };
  // The sun's path for late summer at 41° N: up at 6.3, down at 20.0, about 63° at noon; the moon stands in at night.
  const rise = 6.3, set = 20.0;
  let dir;
  if (h > rise - 0.4 && h < set + 0.4) {
    const p = (h - rise) / (set - rise), phi = Math.PI * Math.min(1.08, Math.max(-0.08, p));
    const elev = Math.max(0.035, Math.sin(Math.min(Math.max(p, 0), 1) * Math.PI) * 1.1);
    // φ = 0 east (+x), π/2 south (+z), π west (−x)
    dir = new THREE.Vector3(Math.cos(phi) * Math.cos(elev), Math.sin(elev), Math.sin(phi) * Math.cos(elev) * 0.82 + 0.25).normalize();
  } else {
    dir = new THREE.Vector3(-0.45, 0.8, -0.4).normalize(); // moonlight from the north-west, high
  }
  out.sunDir = dir;
  return out;
}

/* ── Shader patch shared by every material that draws the model (colour, depth, normals, picking) ── */
const shared = {
  uState: { value: null },
  uPlinth: { value: new THREE.Vector3(PLINTH.cx, PLINTH.cz, PLINTH.r) },
  uGrow: { value: 1 },
  uNight: { value: 0 },
  uFirstBuilding: { value: 0 },
  uTime: { value: 0 },
};

const VERT_HEAD = /* glsl */ `
attribute float aId;
uniform sampler2D uState;
uniform float uGrow;
uniform float uFirstBuilding;
varying vec3 vWorld;
varying float vId;
varying float vRel;
varying vec2 vLook;
`;
const VERT_BODY = /* glsl */ `
{
  int id = int(aId + 0.5);
  vec4 st = texelFetch(uState, ivec2(id, 0), 0);
  vec4 geo = texelFetch(uState, ivec2(id, 1), 0);
  vWorld = position;
  vId = aId;
  vRel = (position.y - geo.z) / max(geo.w, 0.5);
  vLook = st.zw;
  // rising out of the ground: each building on its own beat
  float gOrder = fract(sin(aId * 12.9898) * 43758.5453) * 0.55;
  float g = clamp((uGrow - gOrder) / 0.45, 0.0, 1.0);
  g = 1.0 - pow(1.0 - g, 3.0);
  transformed.y -= (1.0 - g) * (geo.w + 4.0) * step(uFirstBuilding - 0.5, aId);
  vec2 d = transformed.xz - geo.xy;
  float cs = cos(st.y), sn = sin(st.y);
  transformed.xz = geo.xy + vec2(cs * d.x - sn * d.y, sn * d.x + cs * d.y);
  transformed.y += st.x;
}
`;
const FRAG_HEAD = /* glsl */ `
uniform vec3 uPlinth;
varying vec3 vWorld;
varying float vId;
varying float vRel;
varying vec2 vLook;
float mkHash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
float mkHash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
`;
// The plinth cuts the land round.
const FRAG_CLIP = /* glsl */ `
  if (length(vWorld.xz - uPlinth.xy) > uPlinth.z) discard;
`;

function patch(material, { kind = "color", cls = C.BUILD } = {}) {
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, shared);
    sh.vertexShader = VERT_HEAD + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n" + VERT_BODY);
    sh.fragmentShader = FRAG_HEAD + "uniform float uNight;\nuniform float uTime;\n" + sh.fragmentShader;
    const clip = FRAG_CLIP;
    if (kind === "color") {
      let col = /* glsl */ `
        // ghost: everything but the chosen homes sinks back toward the plinth's colour
        diffuseColor.rgb = mix(diffuseColor.rgb, uGhostTint, vLook.y * 0.62);
        // highlight: the chosen homes turn to balsa, as a model maker marks them
        diffuseColor.rgb = mix(diffuseColor.rgb, uHiTint, vLook.x * 0.85);
      `;
      if (cls === C.GROUND || cls === C.GREEN) {
        // laser-cut contour lines every two metres
        col += /* glsl */ `
          float mkH = vWorld.y / 2.0;
          float mkL = abs(fract(mkH - 0.5) - 0.5) / max(fwidth(mkH), 1e-4);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.84, (1.0 - min(mkL, 1.0)) * 0.55);
        `;
      }
      sh.fragmentShader = sh.fragmentShader
        .replace("void main() {", "uniform vec3 uGhostTint;\nuniform vec3 uHiTint;\nuniform vec3 uEdgeColor;\nvoid main() {\n" + clip)
        .replace("#include <color_fragment>", "#include <color_fragment>\n" + col);
      sh.uniforms.uGhostTint = material.userData.ghostTint;
      sh.uniforms.uHiTint = material.userData.hiTint;
      sh.uniforms.uEdgeColor = material.userData.edgeColor;
      let emit = /* glsl */ `totalEmissiveRadiance += uEdgeColor * vLook.x * 0.06;`;
      if (cls === C.GLASS) {
        // After dark most windows light up, each its own warmth; a few stay dark.
        emit += /* glsl */ `
          vec3 mkCell = floor(vWorld * vec3(0.42, 0.34, 0.42));
          float mkR = mkHash3(mkCell + vId * 3.1);
          float mkOn = step(0.32, mkR) * uNight;
          vec3 mkWarm = mix(vec3(1.0, 0.70, 0.40), vec3(1.0, 0.86, 0.64), mkHash3(mkCell * 1.7));
          totalEmissiveRadiance += mkWarm * mkOn * (1.6 + 1.4 * mkHash3(mkCell * 2.3));
        `;
      }
      if (cls === C.HARD) {
        emit += /* glsl */ `totalEmissiveRadiance += vec3(1.0, 0.78, 0.5) * uNight * 0.035;`;
      }
      if (cls === C.WATER) {
        emit += /* glsl */ `totalEmissiveRadiance += vec3(0.35, 0.75, 0.85) * uNight * 0.45;`;
      }
      sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n" + emit);
      // SketchUp leaves some zero-area triangles: their flat normal is NaN, which would speckle the model and, after
      // dark, smear across the whole frame through the bloom. Give them a harmless normal and never output NaN.
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <normal_fragment_begin>", "#include <normal_fragment_begin>\nif (any(isnan(normal)) || dot(normal, normal) < 0.25) normal = vec3(0.0, 0.0, 1.0);")
        .replace("#include <dithering_fragment>", "#include <dithering_fragment>\nif (any(isnan(gl_FragColor)) || any(isinf(gl_FragColor))) gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);");
    } else {
      sh.fragmentShader = sh.fragmentShader.replace("void main() {", "void main() {\n" + clip);
    }
  };
  material.customProgramCacheKey = () => `maket-${kind}-${cls}`;
  return material;
}

/* ── Palettes: the white model by day; by night the same model, blue, with its windows lit ── */
const PAL = {
  [C.BUILD]: { color: "#fbf9f5", rough: 0.88 },
  [C.GLASS]: { color: "#7f8a90", rough: 0.32, metal: 0.25 },
  [C.HARD]: { color: "#e2dcd2", rough: 0.95 },
  [C.GREEN]: { color: "#dfe2d2", rough: 1.0 },
  [C.WATER]: { color: "#c9dadd", rough: 0.12, metal: 0.05 },
  [C.GROUND]: { color: "#ebe6dc", rough: 1.0 },
};

function makeMaterials() {
  return PAL_KEYS.map((k) => {
    const p = PAL[k];
    const m = new THREE.MeshStandardMaterial({ color: p.color, roughness: p.rough, metalness: p.metal || 0, flatShading: true, side: k === C.BUILD || k === C.GLASS ? THREE.DoubleSide : THREE.FrontSide, emissive: 0x000000 });
    m.userData.ghostTint = { value: new THREE.Color("#e2dcd1") };
    m.userData.hiTint = { value: new THREE.Color(k === C.GLASS ? "#6d5f4c" : "#dcc29a") };
    m.userData.edgeColor = { value: new THREE.Color("#d9b77a") };
    return patch(m, { kind: "color", cls: k });
  });
}
const PAL_KEYS = [C.BUILD, C.GLASS, C.HARD, C.GREEN, C.WATER, C.GROUND];

/* ── Loading: fetch with progress, then parse ── */
async function fetchModel(url, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`model ${res.status}`);
  const total = +res.headers.get("content-length") || 13334176;
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onProgress?.(Math.min(0.96, (got / total) * 0.9));
  }
  const buf = new Uint8Array(got);
  let o = 0;
  for (const c of chunks) { buf.set(c, o); o += c.length; }
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  return new Promise((res2, rej) => loader.parse(buf.buffer, "", res2, rej));
}

/* ── Reduce the model: one mesh per material class, every vertex tagged with its building ── */
function reduce(root) {
  root.updateMatrixWorld(true);
  const nodes = [];
  const order = [...root.children].sort((a, b) => (kindOf(a.name) ? 1 : 0) - (kindOf(b.name) ? 1 : 0));
  const buckets = PAL_KEYS.map(() => ({ pos: [], id: [], idx: [], count: 0 }));
  const v = new THREE.Vector3();
  let firstBuilding = -1;
  order.forEach((top, id) => {
    const kind = kindOf(top.name);
    if (kind && firstBuilding < 0) firstBuilding = id;
    const isSite = !kind;
    const box = new THREE.Box3();
    top.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry, P = g.attributes.position, I = g.index;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const groups = g.groups.length ? g.groups : [{ start: 0, count: I ? I.count : P.count, materialIndex: 0 }];
      const world = new Float32Array(P.count * 3);
      for (let i = 0; i < P.count; i++) {
        v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld);
        world[i * 3] = v.x; world[i * 3 + 1] = v.y; world[i * 3 + 2] = v.z;
        if (kind) box.expandByPoint(v);
      }
      for (const gr of groups) {
        const cls = classify(mats[gr.materialIndex] || mats[0], isSite);
        const b = buckets[PAL_KEYS.indexOf(cls)];
        // copy only the vertices this group uses
        const remap = new Map();
        for (let k = gr.start; k < gr.start + gr.count; k++) {
          const src = I ? I.getX(k) : k;
          let dst = remap.get(src);
          if (dst === undefined) {
            dst = b.count++;
            remap.set(src, dst);
            b.pos.push(world[src * 3], world[src * 3 + 1], world[src * 3 + 2]);
            b.id.push(id);
          }
          b.idx.push(dst);
        }
      }
    });
    if (!kind) top.traverse((o) => o.isMesh && box.expandByObject(o));
    nodes.push({ id, name: top.name, kind, box, center: box.getCenter(new THREE.Vector3()), size: box.getSize(new THREE.Vector3()) });
  });
  const meshes = buckets.map((b, i) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(b.pos, 3));
    g.setAttribute("aId", new THREE.Float32BufferAttribute(b.id, 1));
    g.setIndex(b.count > 65535 ? new THREE.Uint32BufferAttribute(b.idx, 1) : new THREE.Uint16BufferAttribute(b.idx, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return { cls: PAL_KEYS[i], geometry: g };
  });
  return { nodes, meshes, firstBuilding };
}

/* ── Easing / tween helpers ── */
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

export class Maket {
  static async create(host, opts = {}) {
    const m = new Maket(host, opts);
    await m._load(opts.url || new URL("../model/levan.glb", import.meta.url).href, opts.onProgress);
    return m;
  }

  constructor(host, opts) {
    this.host = host;
    this.opts = opts;
    const coarse = matchMedia("(pointer: coarse)").matches;
    this.low = opts.low ?? (coarse || Math.min(screen.width, screen.height) < 700 || /[?&]lite\b/.test(location.search));
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance", alpha: false, stencil: false }));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.06;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    // the sun only moves with the clock: shadows are redrawn when the light or the buildings change, not the camera
    r.shadowMap.autoUpdate = false;
    r.domElement.setAttribute("aria-hidden", "true");
    r.domElement.className = "maket-canvas";
    host.appendChild(r.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(26, 1, 5, 6000);
    this.view = { az: -2.2, el: 0.62, dist: 820, target: HOME_TARGET.clone(), shift: 0, fov: 26 };
    this._from = null; this._to = null; this._t = 0; this._dur = 1;

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x888070, 1);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.5);
    this.sun.castShadow = true;
    const s = this.sun.shadow;
    s.mapSize.set(this.low ? 2048 : 4096, this.low ? 2048 : 4096);
    const ext = PLINTH.r + 60;
    Object.assign(s.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 10, far: 2400 });
    s.bias = -0.00025;
    s.normalBias = 0.5;
    s.radius = 3;
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.sun.target.position.set(PLINTH.cx, 0, PLINTH.cz);

    this.hour = 11;
    this.autoSpin = 0; // radians per second
    this.dirty = true;
    this.listeners = new Set();
    this.anims = new Set();
    this.visible = true;
    this._resize = this._resize.bind(this);
    addEventListener("resize", this._resize);
    new ResizeObserver(this._resize).observe(host);
    document.addEventListener("visibilitychange", () => this.invalidate());
  }

  async _load(url, onProgress) {
    const gltf = await fetchModel(url, onProgress);
    onProgress?.(0.93);
    await new Promise((r) => setTimeout(r, 0));
    const { nodes, meshes, firstBuilding } = reduce(gltf.scene);
    this.nodes = nodes;
    this.byName = new Map(nodes.map((n) => [n.name, n]));
    shared.uFirstBuilding.value = firstBuilding;
    gltf.scene.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); } });

    // state texture: row 0 = lift, spin, highlight, ghost; row 1 = footprint centre x/z, base, height
    const N = nodes.length;
    this.state = new Float32Array(N * 4 * 2);
    nodes.forEach((n, i) => {
      const o = (N + i) * 4;
      this.state[o] = n.center.x; this.state[o + 1] = n.center.z; this.state[o + 2] = n.box.min.y; this.state[o + 3] = n.kind ? n.size.y : 1e4;
    });
    this.stateTex = new THREE.DataTexture(this.state, N, 2, THREE.RGBAFormat, THREE.FloatType);
    this.stateTex.needsUpdate = true;
    shared.uState.value = this.stateTex;
    this.target = nodes.map(() => ({ lift: 0, spin: 0, hi: 0, ghost: 0 }));
    this.cur = nodes.map(() => ({ lift: 0, spin: 0, hi: 0, ghost: 0 }));

    this.materials = makeMaterials();
    this.depthMat = patch(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), { kind: "depth" });
    this.meshes = meshes.map(({ cls, geometry }, i) => {
      const mesh = new THREE.Mesh(geometry, this.materials[i]);
      mesh.castShadow = cls !== C.WATER;
      mesh.receiveShadow = true;
      mesh.customDepthMaterial = this.depthMat;
      mesh.frustumCulled = false;
      mesh.userData.cls = cls;
      this.scene.add(mesh);
      return mesh;
    });
    this._buildPlinth();
    this._buildPost();
    this._buildPick();
    this.setTime(this.hour, true);
    this._resize();
    onProgress?.(1);
    this._loop = this._loop.bind(this);
    this._last = performance.now();
    requestAnimationFrame(this._loop);
  }

  /* The plinth: the ground's own heights read from a top-down render, so its wall meets the land exactly. */
  _buildPlinth() {
    const R = PLINTH.r, S = 512;
    const rt = new THREE.WebGLRenderTarget(S, S, { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
    const cam = new THREE.OrthographicCamera(-R, R, R, -R, 1, 3000);
    cam.position.set(PLINTH.cx, 1500, PLINTH.cz);
    cam.up.set(0, 0, -1);
    cam.lookAt(PLINTH.cx, 0, PLINTH.cz);
    const hm = new THREE.ShaderMaterial({
      vertexShader: "varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "varying float vY; void main(){ gl_FragColor = vec4(vY, 0.0, 0.0, 1.0); }",
      side: THREE.DoubleSide,
    });
    const ground = this.meshes.filter((m) => m.userData.cls >= C.HARD);
    const others = this.meshes.filter((m) => m.userData.cls < C.HARD);
    others.forEach((m) => (m.visible = false));
    this.scene.overrideMaterial = hm;
    const r = this.renderer;
    r.setRenderTarget(rt);
    r.setClearColor(0x000000, 1);
    r.clear();
    r.render(this.scene, cam);
    const px = new Float32Array(S * S * 4);
    r.readRenderTargetPixels(rt, 0, 0, S, S, px);
    r.setRenderTarget(null);
    this.scene.overrideMaterial = null;
    others.forEach((m) => (m.visible = true));
    rt.dispose(); hm.dispose();
    void ground;
    const heightAt = (x, z) => {
      // texture row 0 is the bottom of the view: with up = −z, the top of the image is −z
      const u = (x - (PLINTH.cx - R)) / (2 * R), w = 1 - (z - (PLINTH.cz - R)) / (2 * R);
      const ix = Math.min(S - 1, Math.max(0, Math.round(u * (S - 1)))), iy = Math.min(S - 1, Math.max(0, Math.round(w * (S - 1))));
      return px[(iy * S + ix) * 4];
    };
    this.heightAt = heightAt;

    const SEG = 720, rim = [];
    for (let i = 0; i <= SEG; i++) {
      const a = (i / SEG) * Math.PI * 2;
      let h = -1e9;
      for (let k = 0; k < 3; k++) h = Math.max(h, heightAt(PLINTH.cx + Math.cos(a) * (R - 1.5 - k), PLINTH.cz + Math.sin(a) * (R - 1.5 - k)));
      rim.push(h);
    }
    // a thin base under the lowest point of the rim, as a model maker would cut it
    const base = (PLINTH.base = Math.min(...rim) - 9);
    this.rimStats = { min: Math.min(...rim), max: Math.max(...rim), p10: [...rim].sort((a, b) => a - b)[72], p50: [...rim].sort((a, b) => a - b)[360] };
    const pos = new Float32Array((SEG + 1) * 2 * 3), idx = [];
    for (let i = 0; i <= SEG; i++) {
      const a = (i / SEG) * Math.PI * 2, x = PLINTH.cx + Math.cos(a) * R, z = PLINTH.cz + Math.sin(a) * R;
      pos.set([x, rim[i], z, x, base, z], i * 6);
      if (i < SEG) { const j = i * 2; idx.push(j, j + 1, j + 2, j + 1, j + 3, j + 2); }
    }
    const wg = new THREE.BufferGeometry();
    wg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    wg.setIndex(idx);
    wg.computeVertexNormals();
    // the cut edge: the land's stacked layers, two metres each, on a thin dark base board
    const wall = new THREE.MeshStandardMaterial({ color: "#d9d0c0", roughness: 0.9, side: THREE.DoubleSide, emissive: "#d9d0c0", emissiveIntensity: 0.32 });
    wall.userData.board = { value: new THREE.Color("#2b2a28") };
    wall.userData.base = { value: base };
    wall.onBeforeCompile = (sh) => {
      sh.uniforms.uBoard = wall.userData.board;
      sh.uniforms.uBase = wall.userData.base;
      sh.vertexShader = "varying float vYw;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvYw = position.y;");
      sh.fragmentShader = "varying float vYw;\nuniform vec3 uBoard;\nuniform float uBase;\n" + sh.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
        float L = abs(fract(vYw / 6.0) - 0.5) / max(fwidth(vYw / 6.0), 1e-4);
        diffuseColor.rgb *= mix(0.9, 1.0, min(L, 1.0));
        float board = 1.0 - smoothstep(uBase + 5.6, uBase + 5.9, vYw);
        diffuseColor.rgb = mix(diffuseColor.rgb, uBoard, board);`);
    };
    wall.customProgramCacheKey = () => "maket-wall";
    this.wall = new THREE.Mesh(wg, wall);
    this.wall.castShadow = true;
    this.wall.receiveShadow = true;
    const cap = new THREE.Mesh(new THREE.CircleGeometry(R, 180).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#cfc6b6", roughness: 1 }));
    cap.position.set(PLINTH.cx, base + 0.02, PLINTH.cz);
    // the table the model stands on: only its shadow shows
    this.table = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.16, color: 0x2a2218 }));
    this.table.position.set(PLINTH.cx, base - 0.05, PLINTH.cz);
    this.table.receiveShadow = true;
    // soft contact shadow round the foot of the plinth
    const cv = document.createElement("canvas");
    cv.width = cv.height = 256;
    const g2 = cv.getContext("2d"), grd = g2.createRadialGradient(128, 128, 70, 128, 128, 128);
    grd.addColorStop(0, "rgba(40,32,22,0.5)"); grd.addColorStop(1, "rgba(40,32,22,0)");
    g2.fillStyle = grd; g2.fillRect(0, 0, 256, 256);
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(R * 2.5, R * 2.5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    blob.position.set(PLINTH.cx, base - 0.04, PLINTH.cz);
    this.blob = blob;
    this.scene.add(this.wall, cap, this.table, blob);
  }

  _buildPost() {
    const r = this.renderer;
    const target = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: this.low ? 0 : 4 });
    this.composer = new EffectComposer(r, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    if (!this.low) {
      this.gtao = new GTAOPass(this.scene, this.camera, 2, 2);
      this.gtao.updateGtaoMaterial({ radius: 6, distanceExponent: 1.4, thickness: 2.5, scale: 1.25, samples: 12 });
      this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      this.gtao.blendIntensity = 0.85;
      // the AO's own normal pass must see the same lifted, cut model
      const nm = patch(new THREE.MeshNormalMaterial({ flatShading: true, side: THREE.DoubleSide }), { kind: "normal" });
      nm.blending = THREE.NoBlending;
      this.gtao.normalMaterial = nm;
      this.composer.addPass(this.gtao);
    }
    this.bloom = new UnrealBloomPass(new THREE.Vector2(2, 2), 0.5, 0.32, 0.9);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  /* GPU picking: ids rendered into one pixel under the pointer */
  _buildPick() {
    this.pickRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.FloatType });
    this.pickMat = patch(new THREE.ShaderMaterial({
      vertexShader: "#include <common>\nvoid main() {\n#include <begin_vertex>\n#include <project_vertex>\n}",
      fragmentShader: "void main() { gl_FragColor = vec4(vId + 1.0, 0.0, 0.0, 1.0); }",
      side: THREE.DoubleSide,
    }), { kind: "pick" });
    this._pickPx = new Float32Array(4);
  }

  pick(clientX, clientY) {
    if (!this.nodes) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = clientX - rect.left, y = clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
    const cam = this.camera, w = rect.width, h = rect.height;
    const full = cam.view && cam.view.enabled ? { ...cam.view } : null;
    // narrow the view to the one pixel under the pointer, keeping any framing shift
    cam.setViewOffset(w, h, (full ? full.offsetX : 0) + x, (full ? full.offsetY : 0) + y, 1, 1);
    const vis = this.meshes.map((m) => m.visible);
    this.meshes.forEach((m) => (m.visible = m.userData.cls <= C.GLASS));
    [this.wall, this.table, this.blob].forEach((o) => (o.visible = false));
    this.scene.overrideMaterial = this.pickMat;
    const r = this.renderer;
    r.setRenderTarget(this.pickRT);
    r.setClearColor(0x000000, 1);
    r.clear();
    r.render(this.scene, cam);
    r.readRenderTargetPixels(this.pickRT, 0, 0, 1, 1, this._pickPx);
    r.setRenderTarget(null);
    this.scene.overrideMaterial = null;
    this.meshes.forEach((m, i) => (m.visible = vis[i]));
    [this.wall, this.table, this.blob].forEach((o) => (o.visible = true));
    if (full) cam.setViewOffset(full.fullWidth, full.fullHeight, full.offsetX, full.offsetY, full.width, full.height);
    else cam.clearViewOffset();
    const id = Math.round(this._pickPx[0]) - 1;
    const n = this.nodes[id];
    return n && n.kind ? n : null;
  }

  /* ── Time of day ── */
  setTime(hour, now = false) {
    this.hour = hour;
    const k = skyAt(hour);
    this.sky = k;
    this.scene.background = k.bg;
    this.hemi.color.copy(k.hemiSky);
    this.hemi.groundColor.copy(k.hemiGround);
    this.hemi.intensity = k.hemiI;
    this.sun.color.copy(k.sunColor);
    this.sun.intensity = k.sunI;
    this.sun.position.copy(this.sun.target.position).addScaledVector(k.sunDir, 1200);
    shared.uNight.value = k.night;
    if (this.bloom) {
      this.bloom.enabled = k.night > 0.04;
      this.bloom.strength = 0.2 + k.night * 0.45;
    }
    // the model darkens a touch after dark so the windows carry the light
    const n = k.night;
    this.materials.forEach((m, i) => {
      const base = new THREE.Color(PAL[PAL_KEYS[i]].color);
      m.color.copy(base).lerp(new THREE.Color("#4a5468"), n * 0.55);
      m.userData.ghostTint.value.copy(k.bg).lerp(new THREE.Color("#ffffff"), 0.25 * (1 - n));
    });
    this.wall.material.color.set("#d9d0c0").lerp(new THREE.Color("#3a4152"), n * 0.8);
    this.wall.material.emissive.copy(this.wall.material.color).multiplyScalar(1 - n * 0.85);
    this.wall.material.userData.board.value.set("#2b2a28").lerp(new THREE.Color("#0d0f14"), n);
    this.table.material.opacity = 0.16 * (1 - n * 0.6);
    this.blob.material.opacity = 1 - n * 0.5;
    this.emit("time", k);
    this.shadowsDirty = true;
    this.invalidate();
  }

  /* ── Camera ── */
  _applyView(v) {
    const cam = this.camera, t = v.target;
    const cx = Math.cos(v.el), x = Math.cos(v.az) * cx, z = Math.sin(v.az) * cx, y = Math.sin(v.el);
    cam.position.set(t.x + x * v.dist, t.y + y * v.dist, t.z + z * v.dist);
    cam.lookAt(t);
    if (cam.fov !== v.fov) { cam.fov = v.fov; cam.updateProjectionMatrix(); }
    const w = this._w, h = this._h;
    if (w && h) {
      // shift > 0 moves the model right, lift > 0 moves it up
      if (Math.abs(v.shift) > 0.001 || Math.abs(v.lift || 0) > 0.001) cam.setViewOffset(w, h, -v.shift * w, (v.lift || 0) * h, w, h);
      else cam.clearViewOffset();
    }
    cam.updateMatrixWorld();
  }

  setView(v) {
    this.view = { ...this.view, ...v, target: (v.target || this.view.target).clone() };
    this._to = null;
    this.invalidate();
  }

  flyTo(v, dur = 1.6) {
    if (this.reduced || dur <= 0) return this.setView(v);
    this._from = { ...this.view, target: this.view.target.clone() };
    const to = { ...this.view, ...v, target: (v.target || this.view.target).clone() };
    // take the short way round
    let d = to.az - this._from.az;
    d = ((d + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    to.az = this._from.az + d;
    this._to = to;
    this._t = 0;
    this._dur = dur;
    this.invalidate();
  }

  /** Blend two views (for scroll-scrubbed choreography) */
  static mix(a, b, t) {
    let d = b.az - a.az;
    d = ((d + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    const L = (x, y) => x + (y - x) * t;
    return {
      az: a.az + d * t, el: L(a.el, b.el), dist: L(a.dist, b.dist), fov: L(a.fov ?? 26, b.fov ?? 26), shift: L(a.shift ?? 0, b.shift ?? 0), lift: L(a.lift ?? 0, b.lift ?? 0),
      target: a.target.clone().lerp(b.target, t),
    };
  }

  /* ── Homes: highlight a kind, lift one ── */
  setCategory(kind) {
    this.category = kind;
    this.nodes.forEach((n, i) => {
      const on = !kind || n.kind === kind;
      this.target[i].hi = kind && n.kind && on ? 1 : 0;
      this.target[i].ghost = kind && (!on || !n.kind) ? 1 : 0;
    });
    this.invalidate();
  }

  setHover(node) {
    if (this.hovered === node) return;
    this.hovered = node;
    this._applyLifts();
  }

  lift(node) {
    this.lifted = typeof node === "string" ? this.byName.get(node) : node;
    this._applyLifts();
  }

  _applyLifts() {
    this.nodes.forEach((n, i) => {
      const lifted = this.lifted === n, hov = this.hovered === n && !lifted;
      this.target[i].lift = lifted ? Math.max(14, n.size.y * 1.15) : hov ? 2.2 : 0;
      this.target[i].spin = lifted ? 0.32 : 0;
      if (lifted || hov) this.target[i].hi = Math.max(this.target[i].hi, lifted ? 1 : 0.6);
      else if (!this.category || n.kind !== this.category) this.target[i].hi = 0;
    });
    this.invalidate();
  }

  /** 0 = nothing built yet, 1 = complete: the buildings rise out of the ground, each on its own beat */
  setGrow(t) {
    if (shared.uGrow.value === t) return;
    shared.uGrow.value = t;
    this.shadowsDirty = true;
    this.invalidate();
  }

  setAutoSpin(radPerSec) { this.autoSpin = this.reduced ? 0 : radPerSec; this.invalidate(); }

  /** All buildings of a kind, and the box round them */
  ofKind(kind) { return this.nodes.filter((n) => (kind ? n.kind === kind : !!n.kind)); }
  boxOf(kind) {
    const b = new THREE.Box3();
    this.ofKind(kind).forEach((n) => b.union(n.box));
    return b;
  }

  /** A view that frames a kind of home (or the whole site) from a given direction */
  frame(kind, { az = -2.2, el = 0.55, pad = 1.15, shift = 0, lift = 0, fov = 26 } = {}) {
    const b = this.boxOf(kind), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3());
    const r = Math.max(s.x, s.z) * 0.5 + s.y * 0.3;
    const dist = (r / Math.sin(THREE.MathUtils.degToRad(fov) / 2)) * pad * Math.max(1, 1.25 / (this.camera.aspect || 1.6));
    return { az, el, dist, target: c, shift, lift, fov };
  }

  project(v3) {
    const p = v3.clone().project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * this._w, y: (-p.y * 0.5 + 0.5) * this._h, visible: p.z < 1 && p.z > -1 };
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(type, data) { this.listeners.forEach((f) => f(type, data)); }
  invalidate() { this.dirty = true; }
  setVisible(v) { this.visible = v; if (v) this.invalidate(); }

  _resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this._w = w; this._h = h;
    const dpr = Math.min(this.low ? 1.25 : 1.75, devicePixelRatio || 1) * (this.quality || 1);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setPixelRatio(dpr);
      this.composer.setSize(w, h);
    }
    this.invalidate();
  }

  _loop(now) {
    requestAnimationFrame(this._loop);
    // rAF's timestamp can precede the performance.now() taken at setup: never step backwards
    const dt = Math.min(0.05, Math.max(0, (now - this._last) / 1000));
    this._last = now;
    if (!this.visible || document.hidden) return;
    let moving = false;
    // camera flight
    if (this._to) {
      this._t = Math.min(1, this._t + dt / this._dur);
      const v = Maket.mix(this._from, this._to, ease(this._t));
      this.view = v;
      if (this._t >= 1) { this.view = this._to; this._to = null; }
      moving = true;
    }
    if (this.autoSpin) { this.view.az += this.autoSpin * dt; moving = true; }
    // building states ease toward their targets
    const N = this.nodes.length;
    let changed = false;
    const k = 1 - Math.exp(-dt * 7);
    for (let i = 0; i < N; i++) {
      const c = this.cur[i], t = this.target[i];
      for (const f of ["lift", "spin", "hi", "ghost"]) {
        const d = t[f] - c[f];
        if (Math.abs(d) > 1e-4) { c[f] += d * k; changed = true; } else c[f] = t[f];
      }
      const o = i * 4;
      this.state[o] = c.lift; this.state[o + 1] = c.spin; this.state[o + 2] = c.hi; this.state[o + 3] = c.ghost;
    }
    if (changed) { this.stateTex.needsUpdate = true; moving = true; this.shadowsDirty = true; }
    for (const a of this.anims) if (a(dt) === false) this.anims.delete(a); else moving = true;
    if (!moving && !this.dirty) return;
    this.dirty = false;
    this._applyView(this.view);
    shared.uTime.value = now / 1000;
    if (this.shadowsDirty) { this.renderer.shadowMap.needsUpdate = true; this.shadowsDirty = false; }
    const t0 = performance.now();
    this.composer.render(dt);
    this._adapt(performance.now() - t0, dt);
    this.emit("frame", this);
  }

  /* Drop the AO and the pixel ratio if frames run long, so the model stays smooth on modest machines. */
  _adapt(ms, dt) {
    this._acc = (this._acc || 0) * 0.9 + dt * 1000 * 0.1;
    this._n = (this._n || 0) + 1;
    if (this._n < 40 || this._n % 30) return;
    if (this._acc > 34 && (this.quality || 1) > 0.6) {
      if (this.gtao && this.gtao.enabled) this.gtao.enabled = false;
      else this.quality = (this.quality || 1) * 0.8;
      this._resize();
    }
    void ms;
  }
}

export { C as CLASS, CLASS_NAMES, ease, easeOut };
