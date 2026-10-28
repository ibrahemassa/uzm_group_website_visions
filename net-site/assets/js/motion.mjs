/* Net · motion. The layer that makes a plain, fast company site feel alive, declared in the markup:
     data-reveal="lines"   a heading's lines rise out of a mask when it arrives (words stay whole for screen readers)
     data-reveal="img"     a picture is uncovered by a wipe and settles from a slight zoom
     data-parallax="0.12"  a picture drifts slower than the page (amount = share of its height)
     data-count            a number counts up to the value written in it (Turkish or English grouping kept)
     data-tilt             a card leans toward the pointer
     data-draw             a line (e.g. a timeline) draws itself as its section scrolls by
     data-hero             the hero settles into a framed card and its text lifts away as the page moves on
   Smooth scrolling (Lenis) on mouse-and-trackpad screens only. Everything is skipped under reduced motion, and
   nothing here is needed to read or use the page. */
import Lenis from "../vendor/lenis/lenis.mjs";

const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const root = document.documentElement;
window.NET = window.NET || {};

if (reduced) {
  root.classList.add("still");
} else {
  root.classList.add("moving");

  /* ── Smooth scroll ── */
  let lenis = null;
  if (fine) {
    lenis = new Lenis({ lerp: 0.12, smoothWheel: true, prevent: (n) => !!(n.closest && n.closest("dialog, [data-lenis-prevent]")) });
    window.NET.lenis = lenis;
    // dialogs hold the page still behind them
    new MutationObserver(() => { if (document.querySelector("dialog[open]")) lenis.stop(); else lenis.start(); })
      .observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"] });
    document.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || e.defaultPrevented) return;
      const el = document.getElementById(decodeURIComponent(a.getAttribute("href").slice(1)));
      if (!el) return;
      e.preventDefault();
      // land below the sticky bars: the page's scroll-padding-top says how much they cover
      const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 88;
      lenis.scrollTo(el, { offset: -pad });
      history.replaceState(null, "", a.getAttribute("href"));
    });
  }

  /* ── One frame loop for everything scroll-linked ── */
  const fns = [];
  const frame = (t) => { if (lenis) lenis.raf(t); for (const f of fns) f(t); requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
  window.NET.onFrame = (f) => fns.push(f);

  /* ── Lines: wrap words, group them by line, put each line in a mask ── */
  const splitLines = (el) => {
    if (!el._words) {
      const words = [];
      const walk = (node) => {
        for (const n of [...node.childNodes]) {
          if (n.nodeType === 3) {
            const frag = document.createDocumentFragment();
            n.textContent.split(/(\s+)/).forEach((p) => {
              if (!p) return;
              if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(" ")); return; }
              const w = document.createElement("span");
              w.className = "wd";
              const i = document.createElement("span");
              i.className = "wi";
              i.textContent = p;
              w.appendChild(i);
              words.push(w);
              frag.appendChild(w);
            });
            n.replaceWith(frag);
          } else if (n.nodeType === 1 && n.tagName !== "BR") walk(n);
        }
      };
      walk(el);
      el._words = words;
    }
    // line index by offset; each word gets its line's delay
    let top = null, line = -1;
    el._words.forEach((w) => {
      const t = w.offsetTop;
      if (top === null || t > top + 4) { line++; top = t; }
      w.style.setProperty("--ln", line);
    });
  };
  const lineEls = $$('[data-reveal="lines"]');
  const relayout = () => lineEls.forEach(splitLines);
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(relayout);
  let rt = 0;
  addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(relayout, 150); });

  /* ── Arrivals ── */
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      el.classList.add("on");
      if (el.hasAttribute("data-count")) count(el);
      io.unobserve(el);
    });
  }, { rootMargin: "0px 0px -10% 0px" });
  $$("[data-reveal], [data-count]").forEach((el) => io.observe(el));

  /* ── Counting up, keeping the page's own digit grouping ── */
  function count(el) {
    const txt = el.textContent.trim();
    const tr = /\.\d{3}(\D|$)/.test(txt) || /,\d{1,2}$/.test(txt);
    const dec = (txt.match(/[.,](\d{1,2})$/) && !/[.,]\d{3}$/.test(txt)) ? txt.match(/[.,](\d{1,2})$/)[1].length : 0;
    const val = parseFloat(tr ? txt.replace(/\./g, "").replace(",", ".") : txt.replace(/,/g, ""));
    if (!isFinite(val)) return;
    const fmt = new Intl.NumberFormat(tr ? "tr-TR" : "en", { minimumFractionDigits: dec, maximumFractionDigits: dec });
    el.style.minWidth = el.getBoundingClientRect().width + "px";
    const t0 = performance.now(), dur = 1600;
    const run = (t) => {
      const k = clamp((t - t0) / dur), e = 1 - Math.pow(1 - k, 4);
      el.textContent = fmt.format(val * e);
      if (k < 1) requestAnimationFrame(run); else { el.textContent = txt; el.style.minWidth = ""; }
    };
    requestAnimationFrame(run);
  }

  /* ── Parallax and drawn lines: positions from the viewport, written as CSS variables ── */
  const par = $$("[data-parallax]").map((el) => ({ el, k: +el.dataset.parallax || 0.12, vis: false }));
  const draws = $$("[data-draw]").map((el) => ({ el, box: el.closest("section") || el.parentElement, vis: false }));
  const vis = new IntersectionObserver((es) => es.forEach((e) => { e.target._vis = e.isIntersecting; }), { rootMargin: "20% 0px" });
  par.forEach((p) => vis.observe(p.el));
  draws.forEach((d) => vis.observe(d.box));
  fns.push(() => {
    const vh = innerHeight;
    for (const p of par) {
      if (!p.el._vis) continue;
      const r = p.el.getBoundingClientRect();
      const c = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2); // −1 … 1 across the screen
      p.el.style.setProperty("--py", (c * p.k * -100).toFixed(2) + "%");
    }
    for (const d of draws) {
      if (!d.box._vis) continue;
      const r = d.box.getBoundingClientRect();
      d.el.style.setProperty("--draw", clamp((vh * 0.75 - r.top) / r.height).toFixed(4));
    }
  });

  /* ── Hero: settles into a framed card as the page moves on ── */
  const hero = document.querySelector("[data-hero]");
  if (hero) fns.push(() => {
    const h = hero.offsetHeight;
    const p = clamp(scrollY / h);
    hero.style.setProperty("--hp", p.toFixed(4));
  });

  /* ── Scroll stories: the step at the middle of the screen chooses the picture held beside the text ── */
  $$("[data-story]").forEach((st) => {
    const pics = $$("[data-story-pic]", st), steps = $$("[data-story-step]", st);
    const set = (i) => { pics.forEach((p, j) => p.classList.toggle("on", i === j)); steps.forEach((x, j) => x.classList.toggle("on", i === j)); };
    const so = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) set(steps.indexOf(e.target)); }), { rootMargin: "-48% 0px -48% 0px" });
    steps.forEach((x) => so.observe(x));
  });

  /* ── Tilt ── */
  if (fine) $$("[data-tilt]").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const u = (e.clientX - r.left) / r.width - 0.5, v = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty("--rx", (-v * 5).toFixed(2) + "deg");
      el.style.setProperty("--ry", (u * 6).toFixed(2) + "deg");
      el.classList.add("tilting");
    });
    el.addEventListener("pointerleave", () => { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); el.classList.remove("tilting"); });
  });
}
