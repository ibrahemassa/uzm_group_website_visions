/* Zirve · Levan Bahçeşehir: chapter index, the day/night border, the site-plan zones, the diary line, the 360° tours.
   (The plans open from site.js; the WebGL scenes come from stage.mjs.) */
(function () {
  "use strict";
  var Z = window.Z, $ = Z.$, $$ = Z.$$, clamp = Z.clamp;

  /* Chapter index: shown between the hero and the footer; the chapter whose top has passed 40% of the screen is lit. */
  var toc = $(".toc"), links = $$(".toc a"), hero = $(".ph"), ftr = $(".ftr"), last = -1;
  var chapters = links.map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); });
  Z.frame.push(function () {
    var vh = Z.vh;
    toc.classList.toggle("on", hero.getBoundingClientRect().bottom < vh * 0.35 && ftr.getBoundingClientRect().top > vh * 0.6);
    var cur = -1;
    chapters.forEach(function (s, i) { if (s.getBoundingClientRect().top < vh * 0.4) cur = i; });
    if (cur !== last) {
      links.forEach(function (a, i) { if (i === cur) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current"); });
      last = cur;
    }
  });

  /* Day and night: the border eases towards the pointer (hover with a mouse, press and drag on touch), sweeps once when
     the picture first comes into view, and answers the arrow keys. stage.mjs reads el._x for the liquid border. */
  var aerial = $(".aerial"), knob = $(".aerial-knob", aerial);
  var target = 50, cur = 50, ease = 0.2, raf = 0, touched = false, dragging = false;
  var text = function (x) { return x < 8 ? "Gündüz" : x > 92 ? "Gece" : x < 42 ? "Çoğu gündüz" : x > 58 ? "Çoğu gece" : "Yarısı gündüz, yarısı gece"; };
  var write = function (x) {
    aerial.style.setProperty("--x", x.toFixed(2)); aerial._x = x;
    knob.setAttribute("aria-valuenow", Math.round(x)); knob.setAttribute("aria-valuetext", text(x));
  };
  var run = function () {
    cancelAnimationFrame(raf);
    (function step() {
      var d = target - cur;
      cur = Math.abs(d) < 0.05 ? target : cur + d * ease;
      write(cur);
      if (cur !== target) raf = requestAnimationFrame(step);
    })();
  };
  var go = function (x, k) { target = clamp(x, 0, 100); ease = k || 0.2; run(); };
  var fromPointer = function (e) { var r = aerial.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * 100; };
  aerial.addEventListener("pointerdown", function (e) { touched = true; dragging = true; try { aerial.setPointerCapture(e.pointerId); } catch (err) {} go(fromPointer(e), 0.35); });
  aerial.addEventListener("pointermove", function (e) {
    if (!dragging && e.pointerType !== "mouse") return;
    touched = true;
    go(fromPointer(e), dragging ? 0.35 : 0.12);
  });
  var up = function () { dragging = false; };
  aerial.addEventListener("pointerup", up);
  aerial.addEventListener("pointercancel", up);
  knob.addEventListener("keydown", function (e) {
    var k = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5, PageDown: -20, PageUp: 20 }[e.key];
    if (k === undefined && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    touched = true;
    go(e.key === "Home" ? 0 : e.key === "End" ? 100 : target + k, 0.3);
  });
  write(50);
  if (!Z.reduced) {
    var aio = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      aio.disconnect();
      [[0, 82], [1300, 20], [2800, 50]].forEach(function (s) { setTimeout(function () { if (!touched) go(s[1], 0.04); }, s[0]); });
    }, { threshold: 0.6 });
    aio.observe(aerial);
  }

  /* The site plan: once the plan is on screen it lights the three zones in turn, until the visitor picks one. */
  var map = $(".vz-map"), holes = $$(".vz-hole", map), edges = $$(".vz-edge", map), pins = $$(".vz-pin", map);
  var zoneBtns = $$(".zone button");
  var DWELL = 3400, auto = !Z.reduced, timer = 0, active = null, seen = false;
  var set = function (i) {
    active = i;
    map.classList.toggle("lit", i !== null);
    holes.forEach(function (h, k) { h.classList.toggle("on", k === i); });
    edges.forEach(function (h, k) { h.classList.toggle("on", k === i); });
    pins.concat(zoneBtns).forEach(function (b) { b.setAttribute("aria-pressed", String(+b.dataset.zone === i)); });
  };
  var visible = function () { return !map.classList.contains("gl-ready") || map.classList.contains("resolved"); };
  var cycle = function () {
    clearInterval(timer);
    if (!auto) return;
    timer = setInterval(function () {
      if (!seen || !visible()) return;
      set(active === null ? 0 : (active + 1) % 3);
    }, DWELL);
  };
  var pick = function (i) { auto = false; clearInterval(timer); set(active === i ? null : i); };
  pins.concat(zoneBtns).forEach(function (b) { b.addEventListener("click", function () { pick(+b.dataset.zone); }); });
  new IntersectionObserver(function (es) { seen = es[0].isIntersecting; }, { threshold: 0.4 }).observe(map);
  cycle();

  /* The diary line fills as you read; each date lights as it passes the reading line. */
  var tl = $(".tl"), tlItems = $$(".tl-i", tl);
  Z.frame.push(function () {
    var r = tl.getBoundingClientRect(), line = Z.vh * 0.6;
    if (r.top > Z.vh || r.bottom < 0) return;
    tl.style.setProperty("--tl", clamp((line - r.top) / r.height, 0, 1).toFixed(3));
    tlItems.forEach(function (li) { var b = li.getBoundingClientRect(); li.classList.toggle("lit", b.top + b.height / 2 < line); });
  });

  /* 360° tours: Kuula loads only after "start"; the dates switch the tour, live or not. */
  var stage = $(".tour-stage"), dateBtns = $$(".tour-dates button"), when = $(".tour-when time"), tab = $(".tour-tab");
  var url = function (id) { return "https://kuula.co/share/collection/" + id + "?logo=1&info=0&fs=1&vr=0&initload=1&autorotate=0.1&thumbs=1"; };
  var at = 0;
  var label = function (b) { return b.querySelector("time").textContent; };
  var load = function () {
    var b = dateBtns[at], f = $("iframe", stage);
    if (!f) {
      f = document.createElement("iframe");
      f.setAttribute("allow", "fullscreen; xr-spatial-tracking; gyroscope; accelerometer");
      f.allowFullscreen = true;
      stage.appendChild(f);
    }
    f.title = "Levan Bahçeşehir şantiyesinin " + label(b) + " tarihli 360° turu";
    f.src = url(b.dataset.id);
    stage.classList.add("live");
  };
  $(".tour-start").addEventListener("click", load);
  dateBtns.forEach(function (b, i) {
    b.addEventListener("click", function () {
      at = i;
      dateBtns.forEach(function (o, k) { o.setAttribute("aria-pressed", String(k === i)); });
      when.textContent = label(b); when.setAttribute("datetime", b.dataset.date);
      tab.href = url(b.dataset.id);
      if (stage.classList.contains("live")) load();
    });
  });
})();
