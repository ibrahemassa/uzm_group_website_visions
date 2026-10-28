/* İrtifa · Levan Bahçeşehir.
   0 The film: plays only while seen, never by itself under reduced motion, one switch stops it; the readouts follow
     its clock. Scrolling pulls it into a framed monitor (--k) and brings the fact sheet up beside it (--s).
   1 Location: the daytime aerial as an x-ray Picture (gold line drawing → photograph as the scan runs), three targets
     lock on, then night falls over the same view from the sky down (--n); a lens around the pointer shows the other.
   2 Standards: stacked records; each dims and settles as the next one slides over it (--c).
   3 Homes: the site plan as a target screen (zone → home type → plan sheet scanned in from a gold negative).
   4 Amenities: the viewfinder follows the list. 5 Tours: nothing loads from Kuula until a tour is started.
   6 Gallery: a strip to drag, with a little glide. 7 Chapter index: waypoints on the HUD altimeter scale.
   Without script every chapter reads in order and every plan is a link; with reduced motion nothing is pinned. */
import { Picture } from "./gl.mjs";

const U = window.UZM;
const { $, $$, clamp } = U;
const reduced = U.reduced;
const wideQ = matchMedia("(min-width: 48.01rem)");
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const pad = (n, w = 2) => String(n).padStart(w, "0");

/* ── Scenes: progress 0..1 while each pinned block scrolls past ── */
const scenes = $$(".lh, .geo-scene").map((el) => ({ el, top: 0, len: 1, p: -1, changed: true }));
const S = (sel) => scenes.find((s) => s.el.matches(sel));
function measure() {
  for (const s of scenes) {
    const r = s.el.getBoundingClientRect();
    s.top = r.top + scrollY;
    s.len = Math.max(1, s.el.offsetHeight - innerHeight);
  }
}
function progress() {
  const y = scrollY;
  for (const s of scenes) {
    const p = clamp((y - s.top) / s.len);
    s.changed = Math.abs(p - s.p) > 1e-5;
    s.p = p;
    if (s.changed && !reduced) s.el.style.setProperty("--p", p.toFixed(4));
  }
}

/* ── 0 · The film ── */
const lh = $(".lh"), lhS = S(".lh");
const slogan = $(".lh-slogan"), kdt = $$(".kunye dt");
const heroPinned = () => !reduced && wideQ.matches;
let sideOn = null, away = null;
function updateHero(p) {
  const pinned = heroPinned();
  const k = pinned ? smooth(0.02, 0.4, p) : 0, s = pinned ? smooth(0.3, 0.52, p) : 0;
  lh.style.setProperty("--k", k.toFixed(4));
  lh.style.setProperty("--s", s.toFixed(4));
  if (!pinned) return;
  const on = s > 0.04;
  if (on !== sideOn) {
    sideOn = on;
    lh.classList.toggle("side-on", on);
    slogan.classList.toggle("in", on);
    if (on) kdt.forEach((d, i) => setTimeout(() => U.scramble(d, d.dataset.text || (d.dataset.text = d.textContent), 520), i * 70));
  }
  const a = k > 0.45;
  if (a !== away) { away = a; lh.classList.toggle("away", a); }
}
// not pinned (phones, reduced motion): the slogan rises when it comes into view
if (slogan && "IntersectionObserver" in window) {
  new IntersectionObserver((es) => { if (es[0].isIntersecting && !heroPinned()) slogan.classList.add("in"); }, { rootMargin: "0px 0px -10% 0px" }).observe(slogan);
}

const film = (() => {
  const v = $(".lh-vid"), btn = $(".lh-pause");
  if (!v || !btn) return null;
  const tallQ = matchMedia("(max-aspect-ratio: 4/5)");
  const label = $("span", btn), state = $("[data-f-state]"), tc = $("[data-f-tc]"), fr = $("[data-f-fr]");
  let want = !reduced, seen = true;
  const src = () => (tallQ.matches ? v.dataset.tall : v.dataset.wide);
  const show = () => {
    btn.classList.toggle("paused", !want);
    lh.classList.toggle("paused", !want);
    label.textContent = want ? "Filmi durdurun" : "Filmi oynatın";
    U.scramble(state, want ? "OYNATILIYOR" : "DURAKLATILDI", 420);
  };
  const apply = () => {
    if (want && seen && !document.hidden) {
      const s = src();
      if (v.dataset.cur !== s) { v.dataset.cur = s; lh.classList.remove("live"); v.src = s; }
      v.play().catch(() => {});
    } else v.pause();
  };
  v.addEventListener("playing", () => lh.classList.add("live"));
  btn.hidden = false;
  show();
  btn.addEventListener("click", () => { want = !want; show(); apply(); });
  new IntersectionObserver((es) => { seen = es[0].isIntersecting; apply(); }, { threshold: 0.05 }).observe($(".lh-film"));
  document.addEventListener("visibilitychange", apply);
  tallQ.addEventListener("change", () => { if (v.dataset.cur) apply(); });
  // readouts: the film's own clock, as mm:ss.cc and frames at 25 fps
  let last = -1;
  return () => {
    if (!seen || v.readyState < 2) return;
    const t = v.currentTime, cs = Math.floor(t * 100);
    if (cs === last) return;
    last = cs;
    tc.textContent = `${pad(Math.floor(t / 60))}:${pad(Math.floor(t % 60))}.${pad(cs % 100)}`;
    fr.textContent = pad(Math.floor(t * 25), 4);
    lh.style.setProperty("--ft", (t / (v.duration || 12.8)).toFixed(4));
  };
})();

/* ── 1 · Location ── */
const geo = $(".geo"), geoS = S(".geo-scene");
const geoFig = $(".geo-fig"), geoCv = $(".geo-gl"), geoDay = $(".geo-day"), geoNight = $(".geo-night");
const scanEl = $("[data-geo-scan]"), lightEl = $("[data-geo-light]"), capEl = $("[data-geo-cap]");
const tgts = $$(".tgt").map((el) => ({ el, at: +el.dataset.at, lv: el.classList.contains("tgt-lv"), st: "" }));
let gpic = null, gvis = false, lastLight = "", lastCap = "";
if (geo && !reduced) {
  new IntersectionObserver((es) => {
    gvis = es[0].isIntersecting;
    if (gvis && !gpic) {
      geoDay.loading = "eager"; geoNight.loading = "eager";
      gpic = new Picture(geoCv, geoDay, "xray");
      if (!gpic.gl) { gpic = null; return; }
      gpic.ready.then(() => { geo.classList.add("gl-on"); gpic.resize(); });
      geoCv.addEventListener("gl-lost", () => { geo.classList.remove("gl-on"); gpic = null; });
    }
  }, { rootMargin: "100% 0px" }).observe(geoS.el);
  geoFig.addEventListener("pointermove", (e) => { if (!gpic) return; gpic.pointer(e.clientX, e.clientY); if (e.pointerType === "mouse") gpic.lensTo = 0.15; });
  geoFig.addEventListener("pointerleave", () => { if (gpic) gpic.lensTo = 0; });
  // the focal point changes with the window's shape (levan.css); the shader keeps its own copy of it
  addEventListener("resize", () => {
    if (!gpic) return;
    const op = getComputedStyle(geoDay).objectPosition.split(" ").map((v) => parseFloat(v) / 100);
    if (gpic.pos && op.every(Number.isFinite)) gpic.pos = op;
    gpic.resize();
  });
} else if (capEl) capEl.textContent = "Görselleştirme · Solda gündüz, sağda gece";
function updateGeo(p, t) {
  const scan = smooth(0.02, 0.36, p), n = smooth(0.6, 0.88, p);
  geo.style.setProperty("--n", n.toFixed(4));
  scanEl.textContent = pad(Math.round(scan * 100), 3);
  const light = n < 0.08 ? "GÜNDÜZ" : n < 0.92 ? "AKŞAM" : "GECE";
  if (light !== lastLight) { lastLight = light; U.scramble(lightEl, light, 380); }
  const cap = n > 0.5 ? "Görselleştirme · Gece" : "Görselleştirme · Gündüz";
  if (cap !== lastCap) { lastCap = cap; capEl.textContent = cap; }
  // targets lock on one by one, and give way to the night picture's own labels
  for (const g of tgts) {
    const st = p < g.at ? "" : n > (g.lv ? 0.55 : 0.2) ? "off" : "on";
    if (st !== g.st) { g.st = st; g.el.classList.toggle("on", st === "on"); g.el.classList.toggle("off", st === "off"); }
  }
  // a hair past both ends, so the shader's jittered scan edge never leaves stray rows at the top or bottom
  if (gpic && gpic.ok && gvis) { gpic.scan = scan * 1.02 - 0.01; gpic.draw(t); }
}

/* ── 2 · Standards: how far the next record has slid over each one ── */
const cards = $$(".std-card");
let stdVis = false;
if (cards.length && !reduced) new IntersectionObserver((es) => { stdVis = es[0].isIntersecting; }).observe($(".std-list"));
function updateStd() {
  for (let i = 0; i < cards.length - 1; i++) {
    const a = cards[i], ra = a.getBoundingClientRect(), rb = cards[i + 1].getBoundingClientRect();
    const c = clamp(1 - (rb.top - ra.top) / Math.max(1, ra.height));
    if (Math.abs(c - (a._c || 0)) > 0.002) { a._c = c; a.style.setProperty("--c", c.toFixed(3)); }
  }
}

/* ── 3 · Homes explorer ── */
(() => {
  const sec = $(".lx"); if (!sec) return;
  sec.classList.add("lx-js");
  sec.dataset.view = "map";
  const bar = $(".lx-bar", sec), crumb = $(".lx-crumb", sec), plate = $(".lx-plate", sec);
  const zones = $$(".lx-zone", sec), zbtns = zones.map((z) => $(".lx-zb", z));
  const lits = $$(".lx-lit", sec), edges = $$(".lx-edge", sec), pins = $$(".lx-pin", sec);
  const lock = $(".lx-lock", sec), tag = $(".lx-tag", sec), stateEl = $("[data-lx-state]", sec);
  const types = $$(".lx-type", sec);
  const zoneName = zbtns.map((b) => b.lastChild.textContent.trim());
  const nameOf = (t) => $(".lx-name", t).textContent.trim();
  // each zone's bounding box, in % of the plan, read from its outline
  const boxes = edges.map((pg) => {
    const pts = pg.getAttribute("points").trim().split(/\s+/).map((s) => s.split(",").map(Number));
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
    const x0 = Math.min(...xs) / 12, x1 = Math.max(...xs) / 12, y0 = Math.min(...ys) / 8.4, y1 = Math.max(...ys) / 8.4;
    return { x: x0 - 1.2, y: y0 - 1.6, w: x1 - x0 + 2.4, h: y1 - y0 + 3.2 };
  });

  /* the three zones light up in turn while the plan is on screen, until the visitor picks one */
  let zActive = null, auto = !reduced, seen = false, timer = 0, view = "map", lastState = "";
  const setState = (s) => { if (s !== lastState) { lastState = s; U.scramble(stateEl, s, 380); } };
  const zSet = (i, picked) => {
    zActive = i;
    plate.classList.toggle("lit", i !== null);
    lits.forEach((h, k) => h.classList.toggle("on", k === i));
    edges.forEach((h, k) => h.classList.toggle("on", k === i));
    pins.forEach((h, k) => h.classList.toggle("on", k === i));
    zones.forEach((z, k) => z.classList.toggle("on", k === i));
    zbtns.forEach((b, k) => b.setAttribute("aria-pressed", String(!!picked && k === i)));
    if (i === null) { setState(auto ? "TARAMA" : "HAZIR"); return; }
    const b = boxes[i];
    plate.style.setProperty("--lx", b.x + "%"); plate.style.setProperty("--ly", b.y + "%");
    plate.style.setProperty("--lw", b.w + "%"); plate.style.setProperty("--lh", b.h + "%");
    plate.style.setProperty("--cx", b.x + b.w / 2 + "%"); plate.style.setProperty("--cy", b.y + b.h / 2 + "%");
    lock.classList.toggle("below", b.y < 12);
    U.scramble(tag, `HEDEF ${pad(i + 1)} · ${zoneName[i].toLocaleUpperCase("tr-TR")}`, 480);
    lock.classList.remove("blink"); void lock.offsetWidth; lock.classList.add("blink");
    setState(picked ? "KİLİTLENDİ" : "TARAMA");
  };
  const cycle = () => {
    clearInterval(timer);
    if (!auto || !seen || view !== "map") return;
    zSet(zActive === null ? 0 : zActive);
    timer = setInterval(() => zSet(((zActive === null ? -1 : zActive) + 1) % 3), 3600);
  };
  const pick = (i) => { auto = false; clearInterval(timer); zSet(i, i !== null); };
  zbtns.forEach((b, i) => b.addEventListener("click", () => pick(zActive === i && b.getAttribute("aria-pressed") === "true" ? null : i)));
  zones.forEach((z, i) => {
    z.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") pick(i); });
    z.addEventListener("focusin", () => { if (zActive !== i) pick(i); });
  });
  new IntersectionObserver((es) => { seen = es[0].isIntersecting; if (seen) cycle(); else clearInterval(timer); }, { threshold: 0.35 }).observe(plate);
  zSet(null);

  /* each type: its plans become tabs; the chosen plan's row is lit; a new sheet is scanned in */
  types.forEach((t) => {
    const tabs = $(".lx-tabs", t), links = $$("a", tabs), sheet = $(".lx-sheet", t), img = $("img", sheet);
    const rows = $$(".lx-areas tbody tr", t), name = nameOf(t);
    const neg = document.createElement("span");
    neg.className = "lx-neg"; neg.setAttribute("aria-hidden", "true");
    const nimg = img.cloneNode(); nimg.alt = ""; nimg.loading = "lazy";
    neg.appendChild(nimg); sheet.appendChild(neg);
    t._scan = () => { if (reduced) return; sheet.classList.remove("scan"); void sheet.offsetWidth; sheet.classList.add("scan"); };
    let at = 0;
    const many = links.length > 1;
    const paper = $(".lx-paper", t);
    paper.id = t.id + "-plan";
    tabs.hidden = !many;
    if (many) {
      paper.setAttribute("role", "tabpanel");
      tabs.setAttribute("role", "tablist");
      tabs.setAttribute("aria-label", tabs.dataset.label);
    }
    const sel = (i, focus, scan) => {
      at = i;
      const a = links[i];
      img.src = nimg.src = a.href; img.width = nimg.width = +a.dataset.w; img.height = nimg.height = +a.dataset.h;
      img.alt = `${name} kat planı, ${a.textContent.trim()}`;
      if (many) {
        links.forEach((x, k) => { x.setAttribute("aria-selected", String(k === i)); x.tabIndex = k === i ? 0 : -1; });
        paper.setAttribute("aria-labelledby", a.id);
        if (rows.length === links.length) rows.forEach((r, k) => r.classList.toggle("is-cur", k === i));
      }
      if (focus) a.focus();
      if (scan) t._scan();
    };
    links.forEach((a, i) => {
      a.id = `${t.id}-tab-${i + 1}`;
      if (many) { a.setAttribute("role", "tab"); a.setAttribute("aria-controls", paper.id); }
      a.addEventListener("click", (e) => { e.preventDefault(); if (i !== at) sel(i, false, true); });
      a.addEventListener("keydown", (e) => {
        const k = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!k) return;
        e.preventDefault();
        sel((i + k + links.length) % links.length, true, true);
      });
    });
    sel(0);
    $(".lx-full", t).addEventListener("click", (e) => U.openPlan({
      title: name,
      sheets: links.map((a) => ({ src: a.href, w: +a.dataset.w, h: +a.dataset.h, label: a.textContent.trim() })),
      start: at,
    }, e.currentTarget));
  });

  /* moving between the plan and the types */
  let open = -1, opener = null;
  const stepL = $$(".lx-step-l", sec);
  const intoView = (immediate) => {
    const r = sec.getBoundingClientRect();
    if (r.top < -4 || r.top > innerHeight * 0.25) U.scrollTo(sec, { offset: 0, immediate: immediate || reduced });
  };
  const showType = (i, how = {}) => {
    open = i; view = "type";
    clearInterval(timer);
    sec.dataset.view = "type";
    bar.hidden = false;
    types.forEach((t, k) => t.classList.toggle("on", k === i));
    const t = types[i], n = types.length;
    crumb.textContent = `${zoneName[+t.dataset.z]} · ${nameOf(t)}`;
    stepL[0].textContent = nameOf(types[(i - 1 + n) % n]);
    stepL[1].textContent = nameOf(types[(i + 1) % n]);
    $(".lx-prev", sec).setAttribute("aria-label", `Önceki konut tipi: ${stepL[0].textContent}`);
    $(".lx-next", sec).setAttribute("aria-label", `Sonraki konut tipi: ${stepL[1].textContent}`);
    history.replaceState(null, "", "#" + t.id);
    t._scan();
    if (how.scroll !== false) intoView(how.immediate);
    if (how.focus !== false) $(".lx-name", t).focus({ preventScroll: true });
  };
  const showMap = () => {
    view = "map"; open = -1;
    sec.dataset.view = "map";
    bar.hidden = true;
    types.forEach((t) => t.classList.remove("on"));
    history.replaceState(null, "", "#konutlar");
    const back = opener && sec.contains(opener) ? opener : zbtns[0];
    back.focus({ preventScroll: true });
    cycle();
  };
  $$("a[data-type]").forEach((a) => a.addEventListener("click", (e) => {
    const i = types.findIndex((t) => t.id === a.dataset.type);
    if (i < 0) return;
    // keep Lenis' anchor handler (on window) from scrolling to the hidden article
    e.preventDefault(); e.stopPropagation();
    opener = a;
    showType(i);
  }));
  $(".lx-back", sec).addEventListener("click", showMap);
  $(".lx-prev", sec).addEventListener("click", () => showType((open - 1 + types.length) % types.length, { focus: false }));
  $(".lx-next", sec).addEventListener("click", () => showType((open + 1) % types.length, { focus: false }));
  sec.addEventListener("keydown", (e) => { if (e.key === "Escape" && view === "type" && !$("dialog[open]")) showMap(); });

  /* a link straight to a type (…/levan-bahcesehir/index.html#tip-ikiz-villa) opens it */
  const fromHash = () => {
    const i = types.findIndex((t) => "#" + t.id === location.hash);
    if (i > -1) { showType(i, { focus: false, scroll: false }); requestAnimationFrame(() => U.scrollTo(sec, { offset: 0, immediate: true })); }
  };
  fromHash();
  addEventListener("hashchange", fromHash);
})();

/* Lightbox anchors stay links without script; with it, the page's lightbox opens instead */
$$("a[data-lb]").forEach((a) => a.addEventListener("click", (e) => e.preventDefault()));

/* ── 4 · Amenities: the item crossing a line on the screen (or under the pointer) leads; its picture scans in ── */
(() => {
  const items = $$(".am-list li"), frame = $(".am-frame"), pics = $$(".am-frame > img"), cap = $("[data-am-cap]"), num = $("[data-am-n]");
  if (!items.length || !frame) return;
  let curK = "golf", curLi = null;
  const show = (li) => {
    if (li === curLi) return;
    curLi = li;
    items.forEach((x) => x.classList.toggle("on", x === li));
    num.textContent = li.querySelector(".mono").textContent;
    // an item without its own picture keeps the one of the nearest item above it
    let src = li;
    while (src && !src.dataset.k) src = src.previousElementSibling;
    const k = src && src.dataset.k;
    if (!k || k === curK) return;
    curK = k;
    pics.forEach((im) => {
      const on = im.dataset.k === k;
      im.classList.toggle("was", im.classList.contains("on") && !on);
      if (!on) im.classList.remove("on");
    });
    const im = pics.find((x) => x.dataset.k === k);
    im.loading = "eager";
    im.classList.remove("on"); void im.offsetWidth; im.classList.add("on");
    frame.classList.remove("go"); void frame.offsetWidth; frame.classList.add("go");
    U.scramble(cap, im.dataset.cap, 420);
  };
  if (U.fine) items.forEach((li) => li.addEventListener("pointerenter", () => show(li)));
  const narrow = matchMedia("(max-width: 48rem)");
  let io = null;
  const watch = () => {
    if (io) io.disconnect();
    io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && show(e.target)), { rootMargin: narrow.matches ? "-70% 0px -29% 0px" : "-48% 0px -51% 0px" });
    items.forEach((li) => io.observe(li));
  };
  watch();
  narrow.addEventListener("change", watch);
  show(items[0]);
})();

/* ── 5 · 360° tours: Kuula loads only after "start"; the dates switch the tour, live or not ── */
(() => {
  const stage = $(".tour-stage"); if (!stage) return;
  const when = $(".tour-when time"), tab = $(".tour-tab"), dots = $$(".tour-axis i"), num = $("[data-tour-n]");
  // without script each date is a link to its tour; with it, each becomes a switch for the stage
  const btns = $$(".tour-dates a").map((a) => {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.href = a.href;
    b.innerHTML = a.innerHTML;
    $$(".sr", b).forEach((s) => s.remove());
    b.setAttribute("aria-pressed", String(a.hasAttribute("aria-current")));
    a.replaceWith(b);
    return b;
  });
  let at = Math.max(0, btns.findIndex((b) => b.getAttribute("aria-pressed") === "true"));
  const dateOf = (b) => $("time", b);
  const load = () => {
    const b = btns[at];
    let f = $("iframe", stage);
    if (!f) {
      f = document.createElement("iframe");
      f.setAttribute("allow", "fullscreen; xr-spatial-tracking; gyroscope; accelerometer");
      f.allowFullscreen = true;
      stage.appendChild(f);
    }
    f.title = `Levan Bahçeşehir şantiyesinin ${dateOf(b).textContent} tarihli 360° turu`;
    f.src = b.dataset.href;
    stage.classList.add("live");
  };
  const sel = (i) => {
    at = i;
    btns.forEach((b, k) => b.setAttribute("aria-pressed", String(k === i)));
    dots.forEach((d, k) => d.classList.toggle("on", k === i));
    when.textContent = dateOf(btns[i]).textContent;
    when.dateTime = dateOf(btns[i]).dateTime;
    tab.href = btns[i].dataset.href;
    num.textContent = `${pad(i + 1)} / ${pad(btns.length)}`;
    if (stage.classList.contains("live")) load();
  };
  btns.forEach((b, i) => b.addEventListener("click", () => sel(i)));
  $(".tour-start", stage).addEventListener("click", () => { load(); $("iframe", stage).focus(); });
  sel(at);
})();

/* ── 6 · Gallery: drag with the mouse (touch and trackpads scroll natively), a short glide on release ── */
const gal = (() => {
  const strip = $(".gal-strip"), track = $(".gal-track"); if (!strip) return null;
  const items = $$(".gi", track), nEl = $("[data-gal-n]"), rail = $(".gal-rail");
  let down = false, sx = 0, sl = 0, moved = 0, vx = 0, lx = 0, lt = 0, glide = 0, vis = false;
  strip.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    down = true; moved = 0; sx = lx = e.clientX; sl = strip.scrollLeft; lt = performance.now(); vx = 0;
    cancelAnimationFrame(glide);
  });
  addEventListener("pointermove", (e) => {
    if (!down) return;
    const dx = e.clientX - sx;
    moved = Math.max(moved, Math.abs(dx));
    if (moved > 5) strip.classList.add("drag");
    strip.scrollLeft = sl - dx;
    const now = performance.now();
    vx = (e.clientX - lx) / Math.max(1, now - lt); lx = e.clientX; lt = now;
  });
  addEventListener("pointerup", () => {
    if (!down) return;
    down = false;
    strip.classList.remove("drag");
    if (reduced) return;
    let v = vx * 16;
    const go = () => { if (Math.abs(v) < 0.4) return; strip.scrollLeft -= v; v *= 0.93; glide = requestAnimationFrame(go); };
    go();
  });
  // a drag is not a click: keep the lightbox shut
  strip.addEventListener("click", (e) => { if (moved > 6) { e.preventDefault(); e.stopPropagation(); moved = 0; } }, true);
  strip.addEventListener("dragstart", (e) => e.preventDefault());
  new IntersectionObserver((es) => { vis = es[0].isIntersecting; }).observe(strip);
  let lastSL = -1, gv = 0, lastN = -1;
  return () => {
    if (!vis) return;
    const s = strip.scrollLeft, max = Math.max(1, strip.scrollWidth - strip.clientWidth);
    if (!reduced) {
      gv += ((lastSL < 0 ? 0 : clamp((s - lastSL) / 40, -1, 1)) - gv) * 0.15;
      if (Math.abs(gv) < 0.002) gv = 0;
      track.style.setProperty("--gv", gv.toFixed(3));
    }
    if (s === lastSL) return;
    lastSL = s;
    rail.style.setProperty("--gp", (s / max).toFixed(4));
    rail.style.setProperty("--gw", Math.min(100, (strip.clientWidth / strip.scrollWidth) * 100).toFixed(2) + "%");
    const x0 = strip.getBoundingClientRect().left + 40;
    let n = 0;
    items.forEach((it, i) => { if (it.getBoundingClientRect().left < x0) n = i; });
    if (s >= max - 2) n = items.length - 1;
    if (n !== lastN) { lastN = n; nEl.textContent = pad(n + 1); }
  };
})();

/* ── 7 · Chapter index on the altimeter: each tick at its chapter's share of the page, the current one lit ── */
const toc = (() => {
  const nav = $(".toc"), scale = $(".hud-scale"); if (!nav || !scale) return null;
  const links = $$("a", nav), secs = links.map((a) => document.getElementById(a.hash.slice(1)));
  const ftr = $(".ftr");
  let tops = [], fr = [], heroEnd = 0, ftrTop = 1e9, tt = -1, th = -1, cur = -2, flash = 0;
  // ticks keep at least a finger's width apart (24px targets), pushed down then back up to fit the scale
  const lay = () => {
    const gap = 26, n = fr.length, y = fr.map((f) => f * th);
    for (let i = 1; i < n; i++) y[i] = Math.max(y[i], y[i - 1] + gap);
    if (y[n - 1] > th) { y[n - 1] = th; for (let i = n - 2; i >= 0; i--) y[i] = Math.min(y[i], y[i + 1] - gap); }
    y.forEach((v, i) => links[i].parentElement.style.setProperty("--y", v.toFixed(1) + "px"));
  };
  const place = () => {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    tops = secs.map((s) => s.getBoundingClientRect().top + scrollY);
    fr = tops.map((t) => clamp(t / max));
    heroEnd = lh.getBoundingClientRect().bottom + scrollY;
    ftrTop = ftr ? ftr.getBoundingClientRect().top + scrollY : 1e9;
    if (th > 0) lay();
  };
  return {
    place,
    tick() {
      const r = scale.getBoundingClientRect();
      if (!r.height) return;
      if (Math.abs(r.top - tt) > 0.5 || Math.abs(r.height - th) > 0.5) {
        tt = r.top; th = r.height;
        nav.style.setProperty("--tt", tt.toFixed(1) + "px");
        nav.style.setProperty("--th", th.toFixed(1) + "px");
        lay();
      }
      const y = scrollY, vh = innerHeight;
      nav.classList.toggle("on", heroEnd - y < vh * 0.5 && ftrTop - y > vh * 0.6);
      let c = -1;
      tops.forEach((t, i) => { if (t - y < vh * 0.45) c = i; });
      if (c !== cur) {
        cur = c;
        links.forEach((a, i) => { if (i === c) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); });
        // the new chapter's name shows for a moment, then the HUD keeps only the tick
        nav.classList.add("flash");
        clearTimeout(flash);
        flash = setTimeout(() => nav.classList.remove("flash"), 1800);
      }
    },
  };
})();

/* ── Run ── */
function layout() { measure(); progress(); if (toc) toc.place(); }
layout();
addEventListener("resize", layout);
addEventListener("load", layout);
if (document.fonts) document.fonts.ready.then(layout);
if ("ResizeObserver" in window) new ResizeObserver(() => layout()).observe(document.body);
wideQ.addEventListener("change", () => { sideOn = away = null; lh.classList.remove("side-on", "away"); layout(); updateHero(lhS.p); });

U.onFrame((t) => {
  progress();
  if (lhS.changed || !lhS.init) { lhS.init = true; updateHero(lhS.p); }
  if (film) film();
  if (!reduced && geo && (geoS.changed || !geoS.init || (gpic && gvis))) { geoS.init = true; updateGeo(geoS.p, t); }
  if (stdVis) updateStd();
  if (gal) gal();
  if (toc) toc.tick();
});
