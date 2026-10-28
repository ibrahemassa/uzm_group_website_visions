/* Zirve · company pages: the milestones, the reading thread on the legal notices, and the light that follows the hand
   (words, contact plates, register rows). */
(function () {
  "use strict";
  var Z = window.Z, $ = Z.$, $$ = Z.$$, clamp = Z.clamp;

  /* Milestones: the line fills, each year lights as it reaches the reading line, and the large year rolls to it. */
  var ms = $("#ms");
  if (ms) {
    var items = $$("li", ms), roll = $(".ms-year .roll");
    if (Z.reduced) { ms.style.setProperty("--tl", 1); items.forEach(function (li) { li.classList.add("lit"); }); }
    else Z.frame.push(function () {
      var line = Z.vh * 0.6, r = ms.getBoundingClientRect(), cur = 0;
      if (r.top > Z.vh || r.bottom < 0) return;
      ms.style.setProperty("--tl", clamp((line - r.top) / r.height, 0, 1).toFixed(3));
      items.forEach(function (li, i) { var lit = li.getBoundingClientRect().top < line; li.classList.toggle("lit", lit); if (lit) cur = i; });
      if (roll) roll.style.setProperty("--i", cur);
    });
  }

  /* Legal notices: the index marks the section being read, and its thread fills with the reading. */
  var toc = $(".ltoc");
  if (toc) {
    var links = $$("a", toc), ol = $("ol", toc), doc = $(".doc");
    var secs = links.map(function (a) { return document.querySelector(a.getAttribute("href")); });
    Z.frame.push(function () {
      var cur = 0, vh = Z.vh;
      secs.forEach(function (s, i) { if (s && s.getBoundingClientRect().top < vh * 0.4) cur = i; });
      links.forEach(function (a, i) { a.classList.toggle("on", i === cur); });
      var r = doc.getBoundingClientRect();
      ol.style.setProperty("--tl", clamp((vh * 0.4 - r.top) / Math.max(1, r.height - vh * 0.4), 0, 1).toFixed(3));
    });
  }

  if (Z.reduced) return;

  /* Words lit by the hand: a band of light sits where the pointer is over the words; without a pointer it sweeps
     across once when they arrive. */
  $$("[data-light]").forEach(function (el) {
    var x = -30, tx = -30, raf = 0;
    var write = function () { el.style.setProperty("--lx", x.toFixed(1) + "%"); };
    var ease = function () { x += (tx - x) * 0.12; write(); if (Math.abs(tx - x) > 0.2) raf = requestAnimationFrame(ease); else raf = 0; };
    var to = function (v) { tx = v; if (!raf) raf = requestAnimationFrame(ease); };
    el.addEventListener("pointermove", function (e) { var r = el.getBoundingClientRect(); to(((e.clientX - r.left) / r.width) * 100); });
    el.addEventListener("pointerleave", function () { to(130); });
    new IntersectionObserver(function (es, o) {
      if (!es[0].isIntersecting) return;
      o.disconnect();
      var t0 = performance.now();
      (function sweep(t) { var k = Math.min(1, (t - t0) / 2200); if (!raf) { x = -30 + 160 * (1 - Math.pow(1 - k, 3)); write(); } if (k < 1) requestAnimationFrame(sweep); })(t0);
    }, { threshold: 0.6 }).observe(el);
  });

  /* Plates and rows: the light sits under the pointer. */
  $$("[data-light-plate], [data-light-row]").forEach(function (el) {
    el.addEventListener("pointermove", function (e) {
      var r = el.getBoundingClientRect();
      el.style.setProperty("--px", (e.clientX - r.left) + "px");
      el.style.setProperty("--py", (e.clientY - r.top) + "px");
    });
  });
})();
