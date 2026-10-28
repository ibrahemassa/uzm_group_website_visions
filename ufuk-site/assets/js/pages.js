/* Ufuk · about, group, contact, legal, 404: the edit timeline, the reading timecode, the film leader. */
(function () {
  "use strict";
  var U = window.UZM, $ = U.$, $$ = U.$$, clamp = U.clamp, reduced = U.reduced, d = document;

  /* Hakkımızda · milestones: on wide screens the section pins and the playhead runs 2016 → 2026 with the scroll. */
  var ms = $(".ms");
  if (ms) {
    var tl = $(".tl", ms), head = $(".tl-head b", ms), clips = $$(".tl-clip", ms), items = $$(".ms-list li", ms);
    var YEARS = [0, 4, 5, 9, 10], SPAN = 10.6, curI = -1;
    var wide = matchMedia("(min-width: 901px)");
    var pinned = function () { return wide.matches && !reduced; };
    var setI = function (i) {
      if (i === curI) return;
      curI = i;
      clips.forEach(function (c, j) { c.classList.toggle("on", j === i); });
      items.forEach(function (li, j) { li.classList.toggle("on", j === i); });
    };
    var layout = function () { ms.classList.toggle("pinned", pinned()); };
    layout();
    wide.addEventListener("change", layout);
    U.frame.push(function () {
      if (!U.near(ms, 0)) return;
      var p = pinned() ? clamp((U.prog($(".ms-run", ms)) - 0.04) / 0.86) : clamp((U.view(tl) - 0.2) / 0.5);
      var u = p * 10.3;
      tl.style.setProperty("--pos", (u / SPAN).toFixed(4));
      var i = 0;
      YEARS.forEach(function (y, j) { if (u >= y - 0.001) i = j; });
      head.textContent = String(2016 + Math.min(10, Math.floor(u + 0.0001)));
      setI(i);
    });
    if (reduced) { tl.style.setProperty("--pos", (10 / SPAN).toFixed(4)); setI(4); }
  }

  /* Legal pages · the table of contents follows the reading, and a timecode counts down the reading time left. */
  var doc = $(".doc");
  if (doc) {
    var words = doc.textContent.trim().split(/\s+/).length;
    var total = (words / 180) * 60;
    var readTc = $(".read-tc"), readBar = $(".read-bar");
    var links = $$(".toc a"), secs = links.map(function (a) { return d.getElementById(a.getAttribute("href").slice(1)); });
    var sio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var i = secs.indexOf(e.target);
        links.forEach(function (a, j) { if (j === i) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current"); });
      });
    }, { rootMargin: "-30% 0px -60% 0px" });
    secs.forEach(function (s) { if (s) sio.observe(s); });
    var last = -1;
    U.frame.push(function (t, y, vh) {
      var r = doc.getBoundingClientRect();
      var p = clamp((vh * 0.5 - r.top) / r.height);
      if (Math.abs(p - last) < 0.001) return;
      last = p;
      readTc.textContent = U.tc(total * (1 - p));
      readBar.style.setProperty("--k", p.toFixed(4));
    });
  }

  /* 404 · the leader counts 5 to 1, its hand sweeping each second, then lands on the error. */
  var leader = $(".leader");
  if (leader && !reduced) {
    var n = $(".ld-n", leader), sweep = $(".ld-sweep", leader);
    var t0 = performance.now(), COUNT = 5;
    n.textContent = "5";
    (function tick(t) {
      var e = (t - t0) / 1000;
      if (e >= COUNT) { n.textContent = "404"; sweep.style.setProperty("--a", "360deg"); leader.classList.add("done"); return; }
      n.textContent = String(COUNT - Math.floor(e));
      sweep.style.setProperty("--a", ((e % 1) * 360).toFixed(1) + "deg");
      requestAnimationFrame(tick);
    })(t0);
  }
})();
