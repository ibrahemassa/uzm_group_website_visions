/* Işık · smaller pages: the sunrise of milestones (about), the prism (group), the real hour (contact), the reading
   light (legal notices) and the pool of light in the dark (404). */
(function () {
  var U = window.UZM, $ = U.$, $$ = U.$$, clamp = U.clamp, R = U.reduced;
  var two = function (n) { return (n < 10 ? "0" : "") + n; };

  /* ── About: the milestone nearest the middle of the screen raises the sun to its year. */
  var ms = $$(".ms-item"), dawn = $(".dawn");
  if (ms.length && dawn) {
    var sun = $(".dawn-sun", dawn), year = $(".dawn-year", dawn), hour = $(".dawn-hour", dawn), C = [], cur = -1;
    var put = function (i) {
      var it = ms[i], k = +it.dataset.sun, th = Math.PI * (1 - k);
      sun.style.setProperty("--sx", ((200 + 180 * Math.cos(th)) / 400 * 100).toFixed(2) + "%");
      sun.style.setProperty("--sy", ((200 - 180 * Math.sin(th)) / 210 * 100).toFixed(2) + "%");
      dawn.style.setProperty("--s", k);
      year.textContent = $("time", it).textContent;
      hour.textContent = two(+it.dataset.hour) + ".00";
      ms.forEach(function (m, j) { m.classList.toggle("on", j === i); });
    };
    U.onMeasure.push(function () { C = ms.map(function (m) { return U.abs(m) + m.offsetHeight / 2; }); if (cur > -1) put(cur); });
    U.onFrame.push(function (y, vh, moved) {
      if (!moved) return;
      var best = 0, bd = Infinity;
      C.forEach(function (c, k) { var d = Math.abs(c - (y + vh / 2)); if (d < bd) { bd = d; best = k; } });
      if (best !== cur) { cur = best; put(best); }
    });
  }

  /* ── Group: the rays draw in once; pointing at a company brightens its ray. */
  var prism = $("#prism");
  if (prism) {
    new IntersectionObserver(function (es, o) { if (es[0].isIntersecting) { prism.classList.add("in"); o.disconnect(); } }, { threshold: 0.3 }).observe(prism);
    var rays = $$(".ray", prism);
    $$(".co[data-co]").forEach(function (co) {
      var ray = rays[+co.dataset.co];
      var on = function (v) { return function () { ray.classList.toggle("hot", v); co.classList.toggle("hot", v); }; };
      co.addEventListener("pointerenter", on(true)); co.addEventListener("pointerleave", on(false));
      co.addEventListener("focusin", on(true)); co.addEventListener("focusout", on(false));
    });
  }

  /* ── Contact: the real hour in İstanbul, as a sun or a moon on its arc. */
  var now = $(".now");
  if (now) {
    var t = $(".now-time", now), orb = $(".now-orb", now);
    var tick = function () {
      var h = ISIK.now(), m = Math.floor(h * 60) % 1440;
      t.textContent = two(Math.floor(m / 60)) + "." + two(m % 60);
      var day = h >= 6 && h < 20, k = day ? (h - 6) / 14 : ((h + 24 - 20) % 24) / 10;
      var x = 10 + 200 * k, y = (1 - k) * (1 - k) * 74 + 2 * (1 - k) * k * -26 + k * k * 74;
      orb.style.setProperty("--ox", (x / 220 * 100).toFixed(2) + "%");
      orb.style.setProperty("--oy", (y / 80 * 100).toFixed(2) + "%");
      orb.classList.toggle("moon", !day);
    };
    tick(); setInterval(tick, 30000);
  }

  /* ── Legal: the section being read is lit; a beam in the contents fills as you read. */
  var toc = $(".toc");
  if (toc && $(".doc")) {
    var tl = $$("a", toc), secs = tl.map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); }), beam = $(".toc-beam i", toc);
    var S = [], docTop = 0, docEnd = 0, last = -2;
    U.onMeasure.push(function () { S = secs.map(U.abs); var d = $(".doc"); docTop = U.abs(d); docEnd = docTop + d.offsetHeight; });
    U.onFrame.push(function (y, vh, moved) {
      if (!moved) return;
      var mid = y + vh * 0.4, c = -1;
      S.forEach(function (top, i) { if (top <= mid) c = i; });
      beam.style.setProperty("--p", clamp((y + vh * 0.6 - docTop) / (docEnd - docTop)).toFixed(3));
      if (c === last) return;
      last = c;
      tl.forEach(function (a, i) { if (i === c) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current"); });
      secs.forEach(function (s, i) { s.classList.toggle("lit", i === c); });
    });
  }

  /* ── 404: the light follows the pointer; on touch screens it drifts on its own. */
  var nf = $(".nf");
  if (nf) {
    var set = function (x, y) { nf.style.setProperty("--fx", x.toFixed(1) + "%"); nf.style.setProperty("--fy", y.toFixed(1) + "%"); };
    if (U.fine) {
      var tx = 62, ty = 45, cx = tx, cy = ty, raf = 0;
      var step = function () { cx += (tx - cx) * 0.12; cy += (ty - cy) * 0.12; set(cx, cy); raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.05 ? requestAnimationFrame(step) : 0; };
      addEventListener("pointermove", function (e) { tx = e.clientX / innerWidth * 100; ty = e.clientY / innerHeight * 100; if (R) { cx = tx; cy = ty; set(tx, ty); return; } if (!raf) raf = requestAnimationFrame(step); });
    } else if (!R) {
      var t0 = performance.now();
      (function wander(t) { var s = (t - t0) / 1000; set(50 + 28 * Math.sin(s * 0.31), 46 + 18 * Math.sin(s * 0.47 + 1)); requestAnimationFrame(wander); })(t0);
    }
    $$("a", nf).forEach(function (a) { a.addEventListener("focus", function () { var r = a.getBoundingClientRect(); set((r.left + r.width / 2) / innerWidth * 100, (r.top + r.height / 2) / innerHeight * 100); }); });
  }
})();
