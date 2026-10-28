/* Huzur · secondary pages. Scenes take --p from the scroll; the arch you choose on one page becomes the doorway of the
   next (cross-document view transitions); the milestones pass sideways under a drawn line; the group index holds the
   chosen company's mark; the legal texts keep their place in a section index. All of it is an enhancement: without
   script, or with reduced motion, the pages stand still and read in order. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var U = window.UZM || {};
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var clamp = function (x, a, b) { return Math.min(b, Math.max(a, x)); };

  /* ── Scenes. "pin" (default): 0 when the scene's top reaches the top of the screen, 1 when its end does.
     "pass": 0 as it enters from below, 1 once it has left above. ── */
  var scenes = $$("[data-scene]").map(function (el) { return { el: el, pass: el.dataset.scene === "pass", top: 0, len: 1, p: -1, on: [] }; });
  var byId = function (id) { return scenes.filter(function (s) { return s.el.id === id; })[0]; };
  function measure() {
    scenes.forEach(function (s) {
      var r = s.el.getBoundingClientRect(), h = s.el.offsetHeight;
      s.top = r.top + scrollY;
      s.len = s.pass ? h + innerHeight : Math.max(1, h - innerHeight);
      s.p = -1;
    });
  }
  function tick() {
    var y = scrollY;
    scenes.forEach(function (s) {
      var p = clamp((s.pass ? y + innerHeight - s.top : y - s.top) / s.len, 0, 1);
      if (Math.abs(p - s.p) < 1e-4) return;
      s.p = p;
      if (!reduced) s.el.style.setProperty("--p", p.toFixed(4));
      s.on.forEach(function (f) { f(p); });
    });
  }
  var queued = false;
  var schedule = function () { if (!queued) { queued = true; requestAnimationFrame(function () { queued = false; tick(); }); } };
  addEventListener("scroll", schedule, { passive: true });

  /* ── A project's doorway: the header turns light once the picture fills the screen ── */
  var pj = $(".pj");
  if (pj && !reduced) {
    var pjScene = scenes.filter(function (s) { return s.el === pj; })[0];
    pjScene.on.push(function (p) {
      var dark = p > 0.42;
      if ((pj.dataset.hdr === "light") !== dark) { pj.dataset.hdr = dark ? "light" : "paper"; if (U.refreshHeader) U.refreshHeader(); }
    });
  }

  /* ── Between pages: the arch you chose becomes the next page's doorway (and, coming back, the doorway goes back
     into its arch). Only one element may carry the name, and only if it can be seen. ── */
  var hero = $(".pj-door");
  var pathOf = function (u) { try { return new URL(u, location.href).pathname.replace(/index\.html$/, ""); } catch (e) { return ""; } };
  var seen = function (el) { var r = el.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight; };
  // the picture that travels: one inside the link, or the one a link names (data-vt="#id")
  var picOf = function (a) { return (a.dataset.vt && $(a.dataset.vt)) || $("[data-vt-pic]", a) || a; };
  var lastLink = null;
  document.addEventListener("click", function (e) { var a = e.target.closest && e.target.closest("a[data-vt]"); if (a) lastLink = a; }, true);
  var cardFor = function (url) {
    var p = pathOf(url);
    if (lastLink && pathOf(lastLink.href) === p && seen(picOf(lastLink))) return picOf(lastLink);
    return $$("a[data-vt]").filter(function (a) { return pathOf(a.href) === p; }).map(picOf).filter(seen)[0] || null;
  };
  var nameOnly = function (el) {
    $$(".vt-hero").forEach(function (x) { if (x !== el) x.classList.remove("vt-hero"); });
    if (el) el.classList.add("vt-hero");
  };
  addEventListener("pageswap", function (e) {
    if (!e.viewTransition || !e.activation || !e.activation.entry) return;
    var card = cardFor(e.activation.entry.url);
    nameOnly(card || (hero && seen(hero) ? hero : null));
  });
  addEventListener("pagereveal", function (e) {
    if (!e.viewTransition) return;
    var act = window.navigation && window.navigation.activation;
    // a page with its own doorway receives the morph there, unless we are stepping back to it
    var card = act && act.from && (!hero || act.navigationType === "traverse") ? cardFor(act.from.url) : null;
    nameOnly(card || (hero && seen(hero) ? hero : null));
  });

  /* ── Hakkımızda: the milestones pass sideways; a line is drawn under them and lights each year it reaches ── */
  var ms = $(".ms"), track = ms && $(".ms-track", ms), stage = ms && $(".ms-stage", ms), msMax = 0;
  var items = ms ? $$(".ms-i", ms) : [];
  function fitMs() {
    if (!ms || reduced) return;
    msMax = Math.max(0, track.offsetWidth - stage.clientWidth);
    ms.style.setProperty("--ms-h", Math.round(msMax + innerHeight * 1.35) + "px");
  }
  if (ms && !reduced) {
    var msScene = scenes.filter(function (s) { return s.el === ms; })[0];
    msScene.on.push(function (p) {
      track.style.setProperty("--x", (p * msMax).toFixed(1));
      var head = p * track.offsetWidth + 24;
      items.forEach(function (li) { li.classList.toggle("on", li.offsetLeft <= head); });
    });
  } else items.forEach(function (li) { li.classList.add("on"); });

  /* ── Grup şirketleri: the arch holds the mark of the company you point at, or the one passing the middle ── */
  var reg = $$(".reg li[data-k]");
  if (reg.length) {
    var marks = $$(".plaque span"), plN = $(".plaque b"), plS = $(".plaque small");
    var showCo = function (li) {
      reg.forEach(function (x) { x.classList.toggle("on", x === li); });
      marks.forEach(function (m) { m.classList.toggle("on", m.dataset.k === li.dataset.k); });
      if (plN) plN.textContent = $(".rn", li).textContent;
      if (plS) plS.textContent = li.dataset.sector || "";
    };
    reg.forEach(function (li) { li.addEventListener("pointerenter", function () { showCo(li); }); li.addEventListener("focusin", function () { showCo(li); }); });
    if ("IntersectionObserver" in window) {
      var cio = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) showCo(e.target); }); }, { rootMargin: "-46% 0px -46% 0px" });
      reg.forEach(function (li) { cio.observe(li); });
    }
    showCo(reg[0]);
  }

  /* ── Legal texts: the section index marks where you are ── */
  var toc = $$(".toc a[href^='#']");
  if (toc.length && "IntersectionObserver" in window) {
    var mark = function (id) { toc.forEach(function (a) { if (a.hash === "#" + id) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current"); }); };
    var tio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) mark(e.target.id); });
    }, { rootMargin: "-25% 0px -65% 0px" });
    toc.forEach(function (a) { var s = document.getElementById(a.hash.slice(1)); if (s) tio.observe(s); });
  }

  /* ── Start ── */
  var start = function () { fitMs(); measure(); tick(); };
  addEventListener("resize", start);
  start();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(start);
  addEventListener("load", start);
  window.__huzurPages = { scenes: scenes, byId: byId };
})();
