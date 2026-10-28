/* Maket · secondary pages: the scale-ruler timeline (Hakkımızda), the companies on their plinth (Grup şirketleri) and
   the section index of the legal texts. Everything here is an enhancement; the pages read fully without it. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var clamp = function (x, a, b) { return Math.min(b, Math.max(a, x)); };

  /* ── Milestones on the scale ruler: the cursor walks the years as the section passes; pointing at a milestone
        sends it to that year. ── */
  var ms = $(".ms");
  if (ms) {
    var ruler = $(".ruler", ms), items = $$(".ms-list > li", ms), leads = $$(".ms-leaders path", ms), held = null, raf = 0;
    var yearX = function (y) { return 4 + (y - 2016) / 11 * 92; };   // % across the ruler (same scale as the ticks)
    var marks = items.map(function (li) { return yearX(+li.dataset.year); });
    var place = function (x) {
      ruler.style.setProperty("--cur", x.toFixed(2) + "%");
      var near = 0, best = 1e9;
      marks.forEach(function (m, i) { var d = Math.abs(m - x); if (d < best) { best = d; near = i; } });
      items.forEach(function (li, i) { li.classList.toggle("on", i === near && best < 5); });
      leads.forEach(function (p, i) { p.classList.toggle("on", i === near && best < 5); });
      var yr = Math.floor(2016 + (x - 4) / 92 * 11 + 0.001);
      var out = $(".ruler-yr", ruler);
      if (out) out.textContent = clamp(yr, 2016, 2026);
    };
    var onScroll = function () {
      raf = 0;
      if (held !== null) return;
      var r = ms.getBoundingClientRect(), vh = innerHeight;
      var p = clamp((vh * 0.85 - r.top) / (r.height + vh * 0.2), 0, 1);
      place(yearX(2016) + p * (marks[marks.length - 1] - yearX(2016)));
    };
    ms.classList.add("live");
    items.forEach(function (li, i) {
      var hold = function () { held = i; place(marks[i]); };
      var free = function () { held = null; onScroll(); };
      li.addEventListener("pointerenter", hold);
      li.addEventListener("pointerleave", free);
      li.addEventListener("focusin", hold);
      li.addEventListener("focusout", free);
    });
    addEventListener("scroll", function () { if (!raf) raf = requestAnimationFrame(onScroll); }, { passive: true });
    addEventListener("resize", onScroll);
    onScroll();
  }

  /* ── The companies on their plinth: a label, a register entry and its block light up together ── */
  var base = $(".base");
  if (base) {
    var all = $$("[data-tok]");
    var light = function (id, on) { all.forEach(function (el) { if (el.dataset.tok === id) el.classList.toggle("on", on); }); };
    $$("[data-tok]:not(g)").forEach(function (el) {
      var id = el.dataset.tok;
      el.addEventListener("pointerenter", function () { light(id, true); });
      el.addEventListener("pointerleave", function () { light(id, false); });
      el.addEventListener("focusin", function () { light(id, true); });
      el.addEventListener("focusout", function () { light(id, false); });
    });
    // the blocks are set down on the plinth one by one as it comes into view
    if (!reduced && "IntersectionObserver" in window) {
      base.classList.add("drop");
      var io = new IntersectionObserver(function (es) {
        if (es[0].isIntersecting) { base.classList.add("in"); io.disconnect(); }
      }, { threshold: 0.35 });
      io.observe(base);
    }
  }

  /* ── Legal texts: the index marks the section being read ── */
  var toc = $(".toc");
  if (toc && "IntersectionObserver" in window) {
    var links = $$("a[href^='#']", toc);
    var secs = links.map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); }).filter(Boolean);
    var mark = function (id) {
      links.forEach(function (a) { if (a.getAttribute("href") === "#" + id) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); });
    };
    var seen = {};
    var spy = new IntersectionObserver(function (es) {
      es.forEach(function (e) { seen[e.target.id] = e.isIntersecting; });
      var cur = secs.filter(function (s) { return seen[s.id]; })[0];
      if (cur) mark(cur.id);
    }, { rootMargin: "-20% 0px -55% 0px" });
    secs.forEach(function (s) { spy.observe(s); });
  }
})();
