/* Huzur · Levan Bahçeşehir. Scenes take --p from the scroll (the film, the doorway onto the aerial, the six
   standards); the homes explorer, the amenities list, the 360° tours and the chapter index are wired here.
   Everything degrades: no script → every chapter reads in order and every plan is a link; reduced motion → still
   scenes, no autoplay. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const U = window.UZM || {};
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const refreshHeader = () => U.refreshHeader && U.refreshHeader();

/* ── Scenes: --p runs from 0 (the scene's top at the top of the screen) to 1 (its end) ── */
const scenes = $$("[data-scene]").map((el) => ({ el, top: 0, len: 1, p: -1, on: [] }));
const scene = (sel) => scenes.find((s) => s.el.matches(sel));
const everyFrame = [];
function measure() {
  for (const s of scenes) {
    const r = s.el.getBoundingClientRect();
    s.top = r.top + scrollY;
    s.len = Math.max(1, s.el.offsetHeight - innerHeight);
  }
}
function tick() {
  const y = scrollY;
  for (const s of scenes) {
    const p = clamp((y - s.top) / s.len);
    if (Math.abs(p - s.p) < 1e-4) continue;
    s.p = p;
    if (!reduced) s.el.style.setProperty("--p", p.toFixed(4));
    s.on.forEach((f) => f(p));
  }
  everyFrame.forEach((f) => f());
}
let queued = false;
const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; tick(); }); } };
addEventListener("scroll", schedule, { passive: true });
addEventListener("resize", () => { measure(); schedule(); });

/* ── 0 · The film: plays only while seen, never by itself under reduced motion; one switch stops it ── */
(() => {
  const sec = $(".lh"), v = $(".lh-vid"), btn = $(".lh-pause");
  if (!sec || !v) return;
  const tallQ = matchMedia("(max-aspect-ratio: 4/5)");
  let want = !reduced, seen = true;
  const src = () => (tallQ.matches ? v.dataset.tall : v.dataset.wide);
  const label = () => {
    btn.setAttribute("aria-pressed", String(!want));
    btn.classList.toggle("paused", !want);
    $("span", btn).textContent = want ? "Filmi durdurun" : "Filmi oynatın";
  };
  const apply = () => {
    if (want && seen && !document.hidden) {
      const s = src();
      if (v.dataset.cur !== s) { v.dataset.cur = s; sec.classList.remove("live"); v.src = s; }
      v.play().catch(() => {});
    } else v.pause();
  };
  v.addEventListener("playing", () => sec.classList.add("live"));
  btn.hidden = false;
  label();
  btn.addEventListener("click", () => { want = !want; label(); apply(); });
  new IntersectionObserver((es) => { seen = es[0].isIntersecting; apply(); }).observe($(".lh-film"));
  document.addEventListener("visibilitychange", apply);
  tallQ.addEventListener("change", () => { if (v.dataset.cur) apply(); });
})();

/* ── 2 · The doorway: the arch opens onto the aerial (--g), the figures arrive (--f), night falls (--n) ── */
(() => {
  const s = scene(".door"); if (!s || reduced) return;
  s.on.push((p) => {
    const el = s.el;
    const g = ease(clamp(p / 0.34)), f = clamp((p - 0.32) / 0.12), n = ease(clamp((p - 0.5) / 0.32));
    el.style.setProperty("--g", g.toFixed(4));
    el.style.setProperty("--f", f.toFixed(4));
    el.style.setProperty("--n", n.toFixed(4));
    // the header reads dark on the linen, light once the aerial fills the screen
    const mode = g > 0.9 ? "light" : "paper";
    if (el.dataset.hdr !== mode) { el.dataset.hdr = mode; refreshHeader(); }
  });
})();

/* ── 3 · Six standards: one at a time, each picture rising into the arch over the last ── */
(() => {
  const s = scene(".std"); if (!s) return;
  const items = $$(".std-item", s.el), num = $(".std-n", s.el);
  let cur = 0;
  const set = (i) => {
    cur = i;
    items.forEach((li, k) => { li.classList.toggle("on", k === i); li.classList.toggle("past", k < i); });
    num.textContent = String(i + 1).padStart(2, "0");
  };
  s.on.push((p) => { const i = Math.min(items.length - 1, Math.floor(p * items.length)); if (i !== cur) set(i); });
})();

/* ── 4 · The explorer: site plan → area → home type → its plan as a white sheet ── */
(() => {
  const sec = $(".lx"); if (!sec) return;
  sec.classList.add("lx-js");
  sec.dataset.view = "map";
  const bar = $(".lx-bar", sec), crumb = $(".lx-crumb", sec), plate = $(".lx-plate", sec);
  const zones = $$(".lx-zone", sec), zbtns = zones.map((z) => $(".lx-zb", z));
  const holes = $$(".lx-hole", sec), edges = $$(".lx-edge", sec), pins = $$(".lx-pin", sec);
  const types = $$(".lx-type", sec);
  const zoneName = zbtns.map((b) => b.lastChild.textContent.trim());
  const nameOf = (t) => $(".lx-name", t).textContent.trim();

  /* the three areas light up in turn while the plan is on screen, until the visitor picks one */
  let zActive = null, auto = !reduced, seen = false, timer = 0, view = "map";
  // the automatic tour only lights the plan; a zone counts as pressed once the visitor picks it
  const zSet = (i, picked) => {
    zActive = i;
    plate.classList.toggle("lit", i !== null);
    holes.forEach((h, k) => h.classList.toggle("on", k === i));
    edges.forEach((h, k) => h.classList.toggle("on", k === i));
    pins.forEach((h, k) => h.classList.toggle("on", k === i));
    zones.forEach((z, k) => z.classList.toggle("on", k === i));
    zbtns.forEach((b, k) => b.setAttribute("aria-pressed", String(!!picked && k === i)));
  };
  const cycle = () => {
    clearInterval(timer);
    if (!auto || !seen || view !== "map") return;
    zSet(zActive === null ? 0 : zActive);
    timer = setInterval(() => zSet(((zActive === null ? -1 : zActive) + 1) % 3), 3600);
  };
  const pick = (i) => { auto = false; clearInterval(timer); zSet(i, true); };
  zbtns.forEach((b, i) => b.addEventListener("click", () => pick(zActive === i && !auto ? null : i)));
  zones.forEach((z, i) => {
    z.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") pick(i); });
    z.addEventListener("focusin", () => { if (zActive !== i) pick(i); });
  });
  new IntersectionObserver((es) => { seen = es[0].isIntersecting; if (seen) cycle(); else clearInterval(timer); }, { threshold: 0.35 }).observe(plate);

  /* each type: its plans become tabs; the areas row of the chosen plan is lit */
  types.forEach((t) => {
    const tabs = $(".lx-tabs", t), links = $$("a", tabs), img = $(".lx-paper img", t), paper = $(".lx-paper", t);
    const rows = $$(".lx-areas tbody tr", t), name = nameOf(t);
    let at = 0;
    const many = links.length > 1;
    paper.id = t.id + "-plan";
    tabs.hidden = !many;
    if (many) {
      paper.setAttribute("role", "tabpanel");
      tabs.setAttribute("role", "tablist");
      tabs.setAttribute("aria-label", tabs.dataset.label);
    }
    const sel = (i, focus) => {
      at = i;
      const a = links[i];
      img.src = a.href; img.width = +a.dataset.w; img.height = +a.dataset.h;
      img.alt = `${name} kat planı, ${a.textContent.trim()}`;
      if (many) links.forEach((x, k) => { x.setAttribute("aria-selected", String(k === i)); x.tabIndex = k === i ? 0 : -1; });
      if (many) paper.setAttribute("aria-labelledby", a.id);
      if (many && rows.length === links.length) rows.forEach((r, k) => r.classList.toggle("cur", k === i));
      if (focus) a.focus();
    };
    links.forEach((a, i) => {
      a.id = `${t.id}-tab-${i + 1}`;
      if (many) { a.setAttribute("role", "tab"); a.setAttribute("aria-controls", paper.id); }
      a.addEventListener("click", (e) => { e.preventDefault(); sel(i); });
      a.addEventListener("keydown", (e) => {
        const k = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!k) return;
        e.preventDefault();
        sel((i + k + links.length) % links.length, true);
      });
    });
    sel(0);
    $(".lx-full", t).addEventListener("click", (e) => U.openPlan && U.openPlan({
      title: name,
      sheets: links.map((a) => ({ src: a.href, w: +a.dataset.w, h: +a.dataset.h, label: a.textContent.trim() })),
      start: at,
    }, e.currentTarget));
  });

  /* moving between the plan and the types */
  let open = -1, opener = null;
  const stepL = $$(".lx-step-l", sec);
  const intoView = () => {
    const r = sec.getBoundingClientRect();
    if (r.top < -4 || r.top > innerHeight * 0.25) scrollTo({ top: r.top + scrollY, behavior: reduced ? "auto" : "smooth" });
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
    if (how.scroll !== false) intoView();
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
    e.preventDefault();
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
    if (i > -1) { showType(i, { focus: false, scroll: false }); requestAnimationFrame(() => scrollTo({ top: sec.getBoundingClientRect().top + scrollY })); }
  };
  fromHash();
  addEventListener("hashchange", fromHash);
})();

/* Lightbox anchors stay links without script; with it, they open in the page's lightbox instead */
$$("a[data-lb]").forEach((a) => a.addEventListener("click", (e) => e.preventDefault()));

/* ── 6 · Fifteen ways: the picture follows the list ── */
(() => {
  const items = $$(".day-list li"), pics = $$(".day-frame img"), cap = $(".day-cap span");
  if (!items.length) return;
  const show = (li) => {
    items.forEach((x) => x.classList.toggle("on", x === li));
    // an item without its own picture keeps the one of the nearest item above it
    let src = li;
    while (src && !src.dataset.k) src = src.previousElementSibling;
    const k = src && src.dataset.k; if (!k) return;
    pics.forEach((im) => { const on = im.dataset.k === k; im.classList.toggle("on", on); if (on) cap.textContent = im.dataset.cap; });
  };
  if (fine) items.forEach((li) => li.addEventListener("pointerenter", () => show(li)));
  // the item crossing a line in the screen leads (lower on phones, where the picture holds the top)
  const narrow = matchMedia("(max-width: 52rem)");
  let io = null;
  const watch = () => {
    if (io) io.disconnect();
    io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && show(e.target)), { rootMargin: narrow.matches ? "-66% 0px -33% 0px" : "-48% 0px -51% 0px" });
    items.forEach((li) => io.observe(li));
  };
  watch();
  narrow.addEventListener("change", watch);
  show(items[0]);
})();

/* ── 7 · 360° tours: Kuula loads only after "start"; the dates switch the tour, live or not ── */
(() => {
  const stage = $(".tour-stage"); if (!stage) return;
  const when = $(".tour-when time"), tab = $(".tour-tab"), dots = $$(".tour-axis i");
  // without script each date is a link to its tour; with it, each becomes a switch for the stage
  const btns = $$(".tour-dates a").map((a) => {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.href = a.href;
    b.innerHTML = a.innerHTML;
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
    if (stage.classList.contains("live")) load();
  };
  btns.forEach((b, i) => b.addEventListener("click", () => sel(i)));
  $(".tour-start", stage).addEventListener("click", load);
  sel(at);
})();

/* ── Slow drift: the tour stage and the closing picture settle as they cross the screen ── */
(() => {
  if (reduced) return;
  const els = $$(".tour-stage, .close");
  everyFrame.push(() => {
    const vh = innerHeight;
    els.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      el.style.setProperty("--q", clamp((vh - r.top) / (vh + r.height)).toFixed(3));
    });
  });
})();

/* ── The chapter index: shown between the film and the footer; lit at the chapter in view ── */
(() => {
  const toc = $(".toc"); if (!toc) return;
  const links = $$("a", toc), secs = links.map((a) => document.getElementById(a.hash.slice(1)));
  const hero = $(".lh"), ftr = $(".ftr"), lights = $$("[data-hdr]");
  let last = -2;
  everyFrame.push(() => {
    const vh = innerHeight;
    toc.classList.toggle("on", hero.getBoundingClientRect().bottom < vh * 0.5 && (!ftr || ftr.getBoundingClientRect().top > vh * 0.6));
    let cur = -1;
    secs.forEach((s, i) => { if (s && s.getBoundingClientRect().top < vh * 0.45) cur = i; });
    if (cur !== last) {
      links.forEach((a, i) => { if (i === cur) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); });
      last = cur;
    }
    const y = vh / 2;
    let dark = false;
    for (const el of lights) {
      if (el.dataset.hdr !== "light") continue;
      const r = el.getBoundingClientRect();
      if (r.top <= y && r.bottom > y) { dark = true; break; }
    }
    toc.classList.toggle("dark", dark);
  });
})();

/* ── Start ── */
measure();
tick();
document.fonts?.ready.then(() => { measure(); tick(); });
addEventListener("load", () => { measure(); tick(); });
window.__levan = { scenes };
