/* İrtifa · shared behaviour for every page.
   Smooth scroll (Lenis) drives one frame loop; pages hook into it with UZM.onFrame(fn). On top of that: the HUD
   (altimeter, section name, Istanbul clock, progress), the reticle cursor, magnetic buttons, split/swell/scramble
   text, counters, the velocity marquee, tilt cards, the lens layer (WebGL hover on pictures), the image trail, the
   shutter between pages, and the dialogs (visit, plan sheets, lightbox) with demo forms that never send.
   Reduced motion: native scroll, no cursor, no shutter, nothing moves on its own. */
import Lenis from "../vendor/lenis/lenis.mjs";
import { LensLayer, Picture } from "./gl.mjs";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const doc = document.documentElement, body = document.body;
const U = (window.UZM = window.UZM || {});
U.root = body.dataset.root || "";
U.assets = body.dataset.assets || "../assets/";
U.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
U.fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
U.$ = $; U.$$ = $$;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
U.clamp = clamp;
U.lerp = (a, b, t) => a + (b - a) * t;
const trNum = new Intl.NumberFormat("tr-TR");
U.fmt = (n, d = 0) => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);

/* ── Scroll + the frame loop ── */
const frameFns = new Set();
U.onFrame = (fn) => { frameFns.add(fn); return () => frameFns.delete(fn); };
U.vel = 0;
let lenis = null;
if (!U.reduced) {
  lenis = new Lenis({
    lerp: 0.085,
    smoothWheel: true,
    prevent: (node) => !!(node.closest && node.closest("dialog, .menu, [data-lenis-prevent]")),
  });
  U.lenis = lenis;
  lenis.on("scroll", (l) => { U.vel = clamp(l.velocity / 40, -1, 1); });
}
U.scrollTo = (target, o = {}) => {
  if (lenis) lenis.scrollTo(target, { offset: -80, ...o });
  else {
    const el = typeof target === "number" ? null : typeof target === "string" ? $(target) : target;
    scrollTo({ top: el ? el.getBoundingClientRect().top + scrollY - 80 : target, behavior: "auto" });
  }
};
let lastT = 0;
function frame(t) {
  if (lenis) lenis.raf(t);
  else U.vel *= 0.9;
  const dt = Math.min(64, t - lastT || 16);
  lastT = t;
  doc.style.setProperty("--vel", U.vel.toFixed(3));
  for (const f of frameFns) f(t, dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* Same-page anchors glide (and respect a page handler that already cancelled the click) */
document.addEventListener("click", (e) => {
  const a = e.target.closest && e.target.closest('a[href^="#"]');
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
  const id = decodeURIComponent(a.getAttribute("href").slice(1));
  const el = id ? document.getElementById(id) : null;
  if (!el) return;
  e.preventDefault();
  U.scrollTo(el);
  history.replaceState(null, "", "#" + id);
  if (!el.hasAttribute("tabindex") && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) el.setAttribute("tabindex", "-1");
  el.focus({ preventScroll: true });
});

/* ── Header + presenter pill: away while reading down, back on the way up ── */
const hdr = $("#hdr"), pres = $(".pres");
let lastY = scrollY;
U.onFrame(() => {
  const y = scrollY;
  if (Math.abs(y - lastY) < 3) return;
  const down = y > lastY;
  if (hdr && !doc.classList.contains("hdr-lock")) hdr.classList.toggle("hide", down && y > 320);
  if (pres) pres.classList.toggle("hide", down && y > 320);
  lastY = y;
});

/* ── HUD ── */
const altEl = $("[data-alt]"), secEl = $("[data-sec]"), pctEl = $("[data-pct]"), clockEl = $("[data-clock]"), rail = $(".hud-rail");
const pageAlt = +(body.dataset.altTop || 1200);
U.altText = null; // pages may take over the altimeter (the home's descent)
U.fmtAlt = (m) => (m >= 10000 ? trNum.format(Math.round(m / 1000)) + " km" : m >= 1000 ? U.fmt(m / 1000, 1) + " km" : trNum.format(Math.max(0, Math.round(m))) + " m");
let lastPct = -1, lastAlt = "";
U.onFrame(() => {
  const max = Math.max(1, doc.scrollHeight - innerHeight);
  const p = clamp(scrollY / max);
  const pct = Math.round(p * 100);
  if (pct !== lastPct && pctEl) { pctEl.textContent = String(pct).padStart(3, "0"); lastPct = pct; }
  if (rail) rail.style.setProperty("--hp", p.toFixed(4));
  const a = U.altText != null ? U.altText : U.fmtAlt((1 - p) * pageAlt);
  if (a !== lastAlt && altEl) { altEl.textContent = a; lastAlt = a; }
});
if (clockEl) {
  const f = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const tick = () => { clockEl.textContent = "İST " + f.format(new Date()); };
  tick(); setInterval(tick, 1000);
}
const secs = $$("[data-hud]");
if (secEl && secs.length && "IntersectionObserver" in window) {
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => { if (e.isIntersecting) U.scramble(secEl, e.target.dataset.hud); });
  }, { rootMargin: "-50% 0px -50% 0px" });
  secs.forEach((s) => io.observe(s));
}

/* ── Text: scramble ── */
const GLYPHS = "ABCDEFGHIJKLMNOPRSTUVYZ0123456789#/+<>=";
U.scramble = (el, text, dur = 650) => {
  if (!el) return;
  text = String(text ?? el.dataset.text ?? el.textContent);
  if (U.reduced) { el.textContent = text; return; }
  const from = el.textContent, n = Math.max(from.length, text.length), t0 = performance.now();
  cancelAnimationFrame(el._scr);
  const run = (t) => {
    const k = clamp((t - t0) / dur);
    let s = "";
    for (let i = 0; i < n; i++) {
      const settle = i / n * 0.6 + 0.4 * Math.random();
      if (k >= settle || text[i] === " ") s += text[i] || "";
      else s += GLYPHS[(Math.random() * GLYPHS.length) | 0];
    }
    el.textContent = s;
    if (k < 1) el._scr = requestAnimationFrame(run); else el.textContent = text;
  };
  el._scr = requestAnimationFrame(run);
};

/* ── Text: split into masked characters (a hidden plain copy keeps it readable for assistive tech) ── */
U.split = (el) => {
  if (el._split) return el._split;
  const plain = el.textContent.replace(/\s+/g, " ").trim();
  const vis = document.createElement("span");
  vis.setAttribute("aria-hidden", "true");
  let ci = 0;
  const chars = [];
  const walk = (src, dst) => {
    for (const node of [...src.childNodes]) {
      if (node.nodeType === 3) {
        const parts = node.textContent.split(/(\s+)/);
        for (const part of parts) {
          if (!part) continue;
          if (/^\s+$/.test(part)) { dst.appendChild(document.createTextNode(" ")); continue; }
          const w = document.createElement("span");
          w.className = "sp-w sp-m";
          for (const ch of part) {
            const c = document.createElement("span");
            c.className = "sp-c";
            c.textContent = ch;
            c.style.setProperty("--ci", ci++);
            w.appendChild(c);
            chars.push(c);
          }
          dst.appendChild(w);
        }
      } else if (node.nodeType === 1) {
        if (node.tagName === "BR") { dst.appendChild(document.createElement("br")); continue; }
        const clone = node.cloneNode(false);
        clone.removeAttribute("id");
        dst.appendChild(clone);
        walk(node, clone);
      }
    }
  };
  walk(el, vis);
  const sr = document.createElement("span");
  sr.className = "sr";
  sr.textContent = plain;
  el.replaceChildren(sr, vis);
  el._split = chars;
  return chars;
};

/* ── Reveals ── */
const revealIO = "IntersectionObserver" in window && !U.reduced
  ? new IntersectionObserver((es) => {
    es.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      el.classList.add("in");
      if (el.hasAttribute("data-scramble")) U.scramble(el, el.dataset.text);
      if (el.hasAttribute("data-count")) count(el);
      revealIO.unobserve(el);
    });
  }, { rootMargin: "0px 0px -8% 0px" })
  : null;
U.reveal = (root = document) => {
  $$("[data-split]", root).forEach((el) => U.split(el));
  $$("[data-scramble]", root).forEach((el) => { if (!el.dataset.text) el.dataset.text = el.textContent; });
  const els = $$("[data-r], [data-split], [data-scramble], [data-count]", root);
  if (revealIO) els.forEach((el) => { if (!el.hasAttribute("data-manual")) revealIO.observe(el); });
  else els.forEach((el) => { el.classList.add("in"); });
};

/* ── Counters: 0 → data-to, Turkish digit grouping, decimals from data-dec ── */
function count(el) {
  const to = parseFloat(el.dataset.to), dec = +(el.dataset.dec || 0), dur = 1700, t0 = performance.now();
  const suffix = el.dataset.suffix || "";
  const run = (t) => {
    const k = clamp((t - t0) / dur), e = 1 - Math.pow(1 - k, 4);
    el.textContent = U.fmt(to * e, dec) + suffix;
    if (k < 1) requestAnimationFrame(run);
  };
  requestAnimationFrame(run);
}

/* ── Variable-width swell: letters near the pointer widen and thicken ── */
const swells = [];
let px = -1e4, py = -1e4;
addEventListener("pointermove", (e) => { px = e.clientX; py = e.clientY; }, { passive: true });
function setupSwell(el) {
  const chars = U.split(el);
  const st = { el, chars, offs: [], on: false, base: [+(el.dataset.w || 118), +(el.dataset.g || 520)], vis: false };
  const measure = () => {
    for (const c of chars) { c.style.removeProperty("--w"); c.style.removeProperty("--g"); }
    const r = el.getBoundingClientRect();
    st.offs = chars.map((c) => { const b = c.getBoundingClientRect(); return [b.left + b.width / 2 - r.left, b.top + b.height / 2 - r.top]; });
  };
  st.measure = measure;
  if ("IntersectionObserver" in window) new IntersectionObserver((es) => { st.vis = es[0].isIntersecting; }).observe(el);
  swells.push(st);
  requestAnimationFrame(measure);
}
if (U.fine && !U.reduced) {
  U.onFrame(() => {
    for (const s of swells) {
      if (!s.vis || !s.offs.length) continue;
      const r = s.el.getBoundingClientRect();
      const near = px > r.left - 160 && px < r.right + 160 && py > r.top - 140 && py < r.bottom + 140;
      if (!near && !s.on) continue;
      s.on = near;
      const lx = px - r.left, ly = py - r.top;
      s.chars.forEach((c, i) => {
        const [ox, oy] = s.offs[i];
        const d = Math.hypot(lx - ox, (ly - oy) * 1.4);
        const f = near ? Math.exp(-(d * d) / (2 * 110 * 110)) : 0;
        const cur = c._f || 0, nf = cur + (f - cur) * 0.2;
        c._f = nf < 0.002 ? 0 : nf;
        c.style.setProperty("--w", (s.base[0] + 7 * c._f).toFixed(1));
        c.style.setProperty("--g", (s.base[1] + 230 * c._f).toFixed(0));
        if (c._f) s.on = true;
      });
    }
  });
  addEventListener("resize", () => swells.forEach((s) => s.measure()));
}

/* ── Cursor reticle ── */
const cur = $(".reticle");
if (cur && U.fine && !U.reduced) {
  doc.classList.add("reticle-on");
  const x = $(".reticle-x", cur), ring = $(".reticle-ring", cur), label = $(".reticle-t", cur);
  let rx = innerWidth / 2, ry = innerHeight / 2, tx = rx, ty = ry;
  addEventListener("pointermove", (e) => { tx = e.clientX; ty = e.clientY; cur.classList.remove("is-hidden"); }, { passive: true });
  document.addEventListener("pointerleave", () => cur.classList.add("is-hidden"));
  addEventListener("pointerdown", () => cur.classList.add("is-down"));
  addEventListener("pointerup", () => cur.classList.remove("is-down"));
  let lastTarget = null;
  const state = (t) => {
    if (t === lastTarget) return;
    lastTarget = t;
    const lab = t && t.closest && t.closest("[data-cursor]");
    const link = t && t.closest && t.closest("a, button, summary, [role=button], label, [data-lb]");
    cur.classList.toggle("is-label", !!lab);
    cur.classList.toggle("is-link", !lab && !!link);
    label.textContent = lab ? lab.dataset.cursor : "";
  };
  addEventListener("pointerover", (e) => state(e.target), { passive: true });
  U.onFrame(() => {
    rx += (tx - rx) * 0.18; ry += (ty - ry) * 0.18;
    x.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
  });
  // keep the label honest after a scroll moves a new target under a still pointer
  addEventListener("scroll", () => { const el = document.elementFromPoint(tx, ty); if (el) state(el); }, { passive: true });
}

/* ── Magnetic buttons ── */
if (U.fine && !U.reduced) {
  $$("[data-magnet]").forEach((el) => {
    let mx = 0, my = 0, ax = 0, ay = 0, on = false;
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      mx = (e.clientX - (r.left + r.width / 2)) * 0.32;
      my = (e.clientY - (r.top + r.height / 2)) * 0.42;
      if (!on) { on = true; loop(); }
    });
    el.addEventListener("pointerleave", () => { mx = 0; my = 0; });
    const loop = () => {
      ax += (mx - ax) * 0.16; ay += (my - ay) * 0.16;
      el.style.transform = `translate3d(${ax.toFixed(2)}px, ${ay.toFixed(2)}px, 0)`;
      if (Math.abs(ax) + Math.abs(ay) + Math.abs(mx) + Math.abs(my) > 0.05) requestAnimationFrame(loop);
      else { on = false; el.style.transform = ""; }
    };
  });
}

/* ── Tilt cards ── */
if (U.fine && !U.reduced) {
  $$("[data-tilt]").forEach((el) => {
    if (!$(".glare", el)) { const g = document.createElement("i"); g.className = "glare"; g.setAttribute("aria-hidden", "true"); el.appendChild(g); }
    const k = +(el.dataset.tilt || 7);
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
      el.style.transition = "transform 0.15s linear";
      el.style.transform = `perspective(900px) rotateX(${((0.5 - v) * k).toFixed(2)}deg) rotateY(${((u - 0.5) * k).toFixed(2)}deg)`;
      el.style.setProperty("--gx", u * 100 + "%");
      el.style.setProperty("--gy", v * 100 + "%");
    });
    el.addEventListener("pointerleave", () => { el.style.transition = ""; el.style.transform = ""; });
  });
}

/* ── Velocity marquee ── */
$$("[data-marquee]").forEach((m) => {
  if (U.reduced) return;
  const parent = m.parentElement;
  const unit = [...m.children].map((c) => c.cloneNode(true));
  while (m.scrollWidth < parent.clientWidth * 2.2 && unit.length) unit.forEach((c) => m.appendChild(c.cloneNode(true)));
  const half = () => m.scrollWidth / 2;
  let x = 0, vis = false;
  new IntersectionObserver((es) => { vis = es[0].isIntersecting; }).observe(parent);
  const dir = m.dataset.marquee === "right" ? 1 : -1;
  U.onFrame((t, dt) => {
    if (!vis) return;
    x += dir * (0.045 + Math.abs(U.vel) * 0.9) * dt;
    const h = half();
    if (x <= -h) x += h;
    if (x > 0) x -= h;
    m.style.transform = `translate3d(${x.toFixed(1)}px,0,0) skewX(${(-U.vel * 8).toFixed(2)}deg)`;
  });
});

/* ── Lens layer: WebGL hover on [data-lens] pictures ── */
if (U.fine && !U.reduced) {
  const layer = new LensLayer();
  if (layer.ok) { U.lens = layer; $$("[data-lens]").forEach((el) => layer.bind(el)); }
}

/* ── Image trail: pictures fall out of the pointer as it crosses a [data-trail] area ── */
U.trail = (area, srcs) => {
  if (!U.fine || U.reduced || !srcs.length) return;
  const box = document.createElement("div");
  box.className = "trail"; box.setAttribute("aria-hidden", "true");
  area.prepend(box);
  const pool = Array.from({ length: 9 }, () => {
    const im = document.createElement("img");
    im.className = "trail-img"; im.alt = ""; im.decoding = "async";
    box.appendChild(im);
    return im;
  });
  srcs.forEach((s) => { const i = new Image(); i.src = s; });
  let lx = null, ly = null, k = 0, n = 0;
  area.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const r = area.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (lx == null) { lx = x; ly = y; return; }
    if (Math.hypot(x - lx, y - ly) < 110) return;
    const ang = Math.atan2(y - ly, x - lx);
    lx = x; ly = y;
    const im = pool[k++ % pool.length];
    im.src = srcs[n++ % srcs.length];
    im.style.zIndex = String(n);
    im.style.left = x + "px"; im.style.top = y + "px";
    im.style.setProperty("--rot", (Math.cos(ang) * 6).toFixed(1) + "deg");
    im.classList.remove("go"); void im.offsetWidth; im.classList.add("go");
  });
  area.addEventListener("pointerleave", () => { lx = ly = null; });
};

/* ── Liquid pictures: [data-liquid] holds an <img> and a <canvas>; the pointer stirs the picture like water,
   and left alone it keeps a slow eddy of its own ── */
$$("[data-liquid]").forEach((sec) => {
  if (U.reduced) return;
  const cv = $("canvas", sec), img = $("img", sec);
  if (!cv || !img) return;
  let pic = null, vis = false, lastMove = 0, auto = 0;
  new IntersectionObserver((es) => {
    vis = es[0].isIntersecting;
    if (vis && !pic) {
      img.loading = "eager";
      pic = new Picture(cv, img, "liquid");
      if (!pic.gl) { pic = null; return; }
      pic.str = +(sec.dataset.liquid || 1.6);
      pic.ready.then(() => { sec.classList.add("gl-on"); pic.resize(); });
      cv.addEventListener("gl-lost", () => { sec.classList.remove("gl-on"); pic = null; });
    }
  }, { rootMargin: "50% 0px" }).observe(sec);
  sec.addEventListener("pointermove", (e) => { if (pic) { pic.pointer(e.clientX, e.clientY); lastMove = performance.now(); } });
  addEventListener("resize", () => pic && pic.resize());
  U.onFrame((t) => {
    if (!pic || !pic.ok || !vis) return;
    if (t - lastMove > 1800) {
      auto += 0.012;
      const r = sec.getBoundingClientRect();
      pic.pointer(r.left + r.width * (0.5 + Math.cos(auto) * 0.28), r.top + r.height * (0.5 + Math.sin(auto * 1.3) * 0.22));
      pic.flow.alpha *= 0.35;
    }
    pic.draw(t);
  });
});

/* ── Shutter between pages ── */
const tx = $(".tx");
const txOpen = () => {
  if (!doc.classList.contains("tx-in")) return;
  doc.classList.add("tx-go");
  setTimeout(() => doc.classList.remove("tx-in", "tx-go"), 1200);
};
if (document.readyState === "complete" || document.fonts?.status === "loaded") txOpen();
else (document.fonts ? document.fonts.ready : Promise.resolve()).then(txOpen);
setTimeout(txOpen, 700);
addEventListener("pageshow", (e) => { if (e.persisted && tx) { tx.classList.remove("out"); doc.classList.remove("tx-in", "tx-go"); } });
if (tx && !U.reduced) {
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target || a.hasAttribute("download")) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !/\.html$|\/$/.test(url.pathname)) return;
    if (url.pathname === location.pathname && url.hash) return;
    e.preventDefault();
    const to = (a.dataset.tx || a.textContent || "").replace(/\s+/g, " ").trim().toLocaleUpperCase("tr-TR").slice(0, 28) || "UZM";
    $(".tx-to", tx).textContent = "";
    tx.classList.remove("in"); tx.classList.add("out");
    U.scramble($(".tx-to", tx), "→ " + to, 420);
    try { sessionStorage.setItem("irt-tx", "1"); } catch (_) {}
    setTimeout(() => { location.href = url.href; }, 640);
  });
}

/* ── Menu: a dialog over the page; the page behind goes inert ── */
const menu = $("#menu"), menuBtn = $(".hdr-menu");
let lastFocus = null;
const setMenu = (open) => {
  if (!menu) return;
  if (open) {
    lastFocus = document.activeElement;
    menu.hidden = false;
    $$("body > :not(#menu):not(script):not(svg):not(.reticle)").forEach((el) => { el.inert = true; });
    menuBtn.setAttribute("aria-expanded", "true");
    if (lenis) lenis.stop();
    $$(".menu-list a", menu).forEach((a, i) => { a.style.setProperty("--d", i); });
    ($(".menu-list a", menu) || menu).focus();
  } else {
    $$("body > *").forEach((el) => { el.inert = false; });
    menuBtn.setAttribute("aria-expanded", "false");
    menu.hidden = true;
    if (lenis) lenis.start();
    if (lastFocus) lastFocus.focus();
  }
};
if (menuBtn) menuBtn.addEventListener("click", () => setMenu(menu.hidden));
if (menu) {
  $(".menu-close", menu).addEventListener("click", () => setMenu(false));
  menu.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setMenu(false);
    if (e.key === "Tab") {
      const f = $$("a, button", menu), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  $$("[data-open]", menu).forEach((b) => b.addEventListener("click", () => setMenu(false)));
}

/* ── Dialogs ── */
const openDlg = (d, from) => {
  if (!d) return;
  d._from = from || document.activeElement;
  d.showModal();
  if (lenis) lenis.stop();
};
$$("dialog.dlg").forEach((d) => {
  d.addEventListener("click", (e) => { if (e.target === d || e.target.closest("[data-close]")) d.close(); });
  d.addEventListener("close", () => { if (lenis) lenis.start(); if (d._from && d._from.focus) d._from.focus(); });
});
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("[data-open]");
  if (b) openDlg($("#" + b.dataset.open), b);
});
U.openDialog = openDlg;

/* Plan sheets: several sheets get tabs (floors, or a flat type's variants) */
const plan = $("#plan");
U.openPlan = (o, from) => {
  if (!plan) return;
  const tabs = $(".plan-tabs", plan), img = $(".plan-sheet img", plan);
  $(".plan-title", plan).textContent = o.title;
  tabs.innerHTML = "";
  const show = (i) => {
    const s = o.sheets[i];
    img.src = s.src; img.width = s.w; img.height = s.h;
    img.alt = o.title + " kat planı, " + s.label;
    $$("button", tabs).forEach((b, j) => { b.setAttribute("aria-selected", String(i === j)); b.tabIndex = i === j ? 0 : -1; });
  };
  tabs.hidden = o.sheets.length < 2;
  o.sheets.forEach((s, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.setAttribute("role", "tab"); b.textContent = s.label;
    b.addEventListener("click", () => show(i));
    b.addEventListener("keydown", (e) => {
      const k = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!k) return;
      const n = (i + k + o.sheets.length) % o.sheets.length;
      show(n); $$("button", tabs)[n].focus();
    });
    tabs.appendChild(b);
  });
  show(o.start || 0);
  openDlg(plan, from);
};
const sheet = (key, w, h, label) => ({ src: U.assets + "img/levan--plan--" + key + ".webp", w, h, label });
const floors = (base) => [sheet(base + "-zemin", 1600, 960, "Zemin kat"), sheet(base + "-1-kat", 1600, 960, "1. kat"), sheet(base + "-bodrum", 1600, 960, "Bodrum")];
U.TYPES = [
  { key: "2-1", kind: "Daire", title: "2+1 Daire", net: "64,83 – 70,17", gross: "73,83 – 81,13", garden: null, blurb: "Yeni başlangıçlar için: ferah, kullanışlı ve bahçe yaşamına açık.", pic: "levan--ic--2-1-salon", plan: "2-1-a", sheets: [sheet("2-1-a", 1600, 918, "2+1 A"), sheet("2-1-b", 1600, 918, "2+1 B"), sheet("2-1-c", 1600, 918, "2+1 C")] },
  { key: "3-1", kind: "Daire", title: "3+1 Daire", net: "113,07 – 123,43", gross: "127,93 – 141,21", garden: null, blurb: "Aile yaşamına göre kurgulanmış geniş salonlar ve ebeveyn banyosu.", pic: "levan--ic--3-1-salon", plan: "3-1-a", sheets: [sheet("3-1-a", 1600, 918, "3+1 A"), sheet("3-1-b", 1600, 918, "3+1 B"), sheet("3-1-c", 1600, 918, "3+1 C")] },
  { key: "4-1", kind: "Daire", title: "4+1 Daire", net: "155,71", gross: "178,13", garden: null, blurb: "Kalabalık aileler için cömert metrekare, gün ışığı ve geniş balkonlar.", pic: "levan--avlu-aksam", plan: "4-1", sheets: [sheet("4-1", 1600, 918, "4+1")] },
  { key: "ikiz", kind: "İkiz villa", title: "4+1 İkiz Villa", net: "271,02", gross: "310,12", garden: "85,74", blurb: "Bodrum, zemin ve birinci kattan oluşan yaşam; özel bahçe.", pic: "levan--ikiz-villa", plan: "ikiz-zemin", sheets: floors("ikiz") },
  { key: "villa", kind: "Müstakil villa", title: "5+1 Müstakil Villa", net: "329,89", gross: "378,10", garden: null, blurb: "Kendi bahçesi ve kendi kapısıyla; gökyüzüyle arada engel yok.", pic: "levan--villa", plan: "mustakil-zemin", sheets: floors("mustakil") },
  { key: "malikane", kind: "Malikane", title: "6+1 Malikane", net: "268,35", gross: "301,80", garden: "1.159,09", blurb: "Levan'ın zirvesi: geniş tahsisli bahçesiyle.", pic: "levan--villa-aksam", plan: "malikane", sheets: [sheet("malikane", 1600, 1194, "6+1")] },
];
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("[data-plan-type]");
  if (!b) return;
  const t = U.TYPES.find((x) => x.key === b.dataset.planType);
  if (t) U.openPlan({ title: t.title, sheets: t.sheets, start: +(b.dataset.sheet || 0) }, b);
});

/* Lightbox: any [data-lb] picture opens; pictures sharing data-lb="group" page through together */
const lb = $("#lb");
if (lb) {
  let items = [], at = 0;
  const lbImg = $(".lb-fig img", lb), lbCap = $(".lb-cap", lb), lbCount = $(".lb-count", lb);
  const show = (i) => {
    at = (i + items.length) % items.length;
    const el = items[at], im = el.tagName === "IMG" ? el : $("img", el);
    lbImg.src = el.dataset.full || im.currentSrc || im.src;
    lbImg.alt = im.alt;
    lbCap.textContent = el.dataset.cap || im.alt;
    lbCount.textContent = at + 1 + " / " + items.length;
    $(".lb-prev", lb).hidden = $(".lb-next", lb).hidden = items.length < 2;
  };
  $$("[data-lb]").forEach((el) => {
    if (el.tagName !== "BUTTON" && el.tagName !== "A") { el.tabIndex = 0; el.setAttribute("role", "button"); if (!el.hasAttribute("aria-label")) { const im = $("img", el); if (im) el.setAttribute("aria-label", "Büyütün: " + (el.dataset.cap || im.alt)); } }
    const go = () => { items = $$('[data-lb="' + el.dataset.lb + '"]'); show(items.indexOf(el)); openDlg(lb, el); };
    el.addEventListener("click", (e) => { e.preventDefault(); go(); });
    el.addEventListener("keydown", (e) => { if (el.tagName !== "A" && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); go(); } });
  });
  $(".lb-prev", lb).addEventListener("click", () => show(at - 1));
  $(".lb-next", lb).addEventListener("click", () => show(at + 1));
  lb.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") show(at - 1); if (e.key === "ArrowRight") show(at + 1); });
}

/* ── Demo forms: check, say what's missing next to the field, never send ── */
$$("form[data-demo]").forEach((f) => {
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    let bad = null;
    $$(".err", f).forEach((x) => x.remove());
    $$("[required]", f).forEach((inp) => {
      const ok = inp.type === "checkbox" ? inp.checked : inp.value.trim().length > (inp.type === "tel" ? 6 : 1);
      inp.setAttribute("aria-invalid", String(!ok));
      if (!ok) {
        const m = document.createElement("p");
        m.className = "err";
        m.id = inp.id ? inp.id + "-err" : "";
        m.textContent = inp.type === "checkbox" ? "Devam etmek için onaylayın." : inp.type === "tel" ? "Telefon numaranızı yazın." : inp.type === "email" ? "E-posta adresinizi yazın." : "Bu alanı doldurun.";
        (inp.closest(".field") || inp.closest(".check")).after(m);
        if (m.id) inp.setAttribute("aria-describedby", m.id);
        bad = bad || inp;
      } else inp.removeAttribute("aria-describedby");
    });
    if (bad) { bad.focus(); return; }
    const sent = $(".form-sent", f);
    if (sent) { sent.hidden = false; sent.setAttribute("tabindex", "-1"); sent.focus(); }
    f.reset();
  });
});

/* ── Go ── */
U.reveal();
$$("[data-swell]").forEach(setupSwell);
document.dispatchEvent(new CustomEvent("uzm:ready"));
U.ready = true;
