/* Ufuk · Levan Bahçeşehir: the scrubbed day, the minutes, day and night, six standards, the site plan, the light
   tables, the 360° projector. */
(function () {
  "use strict";
  var U = window.UZM, $ = U.$, $$ = U.$$, clamp = U.clamp, reduced = U.reduced, d = document;

  /* Sahne 02 · the day, scrubbed; a little sun travels the day clock with it */
  var day = $("#bir-gun"), clock = $(".dc-bar", day);
  U.scrub(day);
  U.frame.push(function () { if (U.near(day, 0)) clock.style.setProperty("--k", U.prog(day).toFixed(4)); });

  /* Sahne 03 · minutes */
  var tmap = $("#tmap"), draw = U.timeMap(tmap);
  U.frame.push(function () { if (U.near(tmap, 0)) draw(clamp((U.view(tmap) - 0.15) / 0.45)); });

  /* Day and night: the splice eases towards the pointer (a mouse moves it by hovering, touch while pressed), sweeps
     once when first seen, and answers the arrow keys. */
  var sp = $(".splice"), knob = $(".splice-knob", sp);
  var target = 50, cur = 50, k = 0.2, raf = 0, touched = false, dragging = false;
  var write = function (x) {
    sp.style.setProperty("--x", x.toFixed(2));
    knob.setAttribute("aria-valuenow", Math.round(x));
    knob.setAttribute("aria-valuetext", x < 8 ? "Gece görünümü" : x > 92 ? "Gündüz görünümü" : "Solda gündüz, sağda gece");
  };
  var run = function () {
    cancelAnimationFrame(raf);
    (function step() {
      var dd = target - cur;
      cur = Math.abs(dd) < 0.05 ? target : cur + dd * k;
      write(cur);
      if (cur !== target) raf = requestAnimationFrame(step);
    })();
  };
  var go = function (x, kk) { target = clamp(x, 0, 100); k = kk || 0.2; if (reduced) { cur = target; write(cur); } else run(); };
  var at = function (e) { var r = sp.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * 100; };
  sp.addEventListener("pointerdown", function (e) { touched = true; dragging = true; sp.setPointerCapture(e.pointerId); go(at(e), 0.35); });
  sp.addEventListener("pointermove", function (e) { if (!dragging && e.pointerType !== "mouse") return; touched = true; go(at(e), dragging ? 0.35 : 0.14); });
  sp.addEventListener("pointerup", function () { dragging = false; });
  sp.addEventListener("pointercancel", function () { dragging = false; });
  knob.addEventListener("keydown", function (e) {
    var s = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5, PageDown: -20, PageUp: 20 }[e.key];
    if (s === undefined && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    touched = true;
    go(e.key === "Home" ? 0 : e.key === "End" ? 100 : target + s, 0.3);
  });
  if (!reduced) {
    var sio = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      sio.disconnect();
      [[0, 82], [1100, 18], [2500, 50]].forEach(function (s) { setTimeout(function () { if (!touched) go(s[1], 0.045); }, s[0]); });
    }, { threshold: 0.6 });
    sio.observe(sp);
  }

  /* Sahne 04 · the item nearest the middle of the screen is lit, and its picture cuts into the frame. */
  var whyItems = $$(".why-item"), whyImgs = $$(".why-frame img"), whyN = $(".why-n"), whyCap = $(".why-cap"), whyCur = 0;
  var wide = matchMedia("(min-width: 901px)");
  var whySet = function (i) {
    if (i === whyCur) return;
    whyImgs.forEach(function (p, j) { p.classList.toggle("was", j === whyCur); p.classList.toggle("on", j === i); });
    whyItems.forEach(function (it, j) { it.classList.toggle("on", j === i); });
    whyN.textContent = U.pad(i + 1);
    whyCap.textContent = whyItems[i].dataset.cap;
    whyCur = i;
  };
  var why = $(".why");
  U.frame.push(function (t, y, vh) {
    if (!wide.matches || !U.near(why, 0)) return;
    var best = 0, bestD = Infinity;
    whyItems.forEach(function (it, j) { var r = it.getBoundingClientRect(), dd = Math.abs(r.top + r.height / 2 - vh / 2); if (dd < bestD) { bestD = dd; best = j; } });
    whySet(best);
  });

  /* Sahne 05 · the site plan lights its three zones in turn while on screen, until the visitor picks one. */
  var map = $(".vz-map"), holes = $$(".vz-hole"), edges = $$(".vz-edge"), pins = $$(".vz-pin"), zones = $$(".zone");
  var zBtns = zones.map(function (z) { return $("h3 button", z); });
  var DWELL = 3600, auto = !reduced, seen = false, timer = 0, zA = null;
  var zSet = function (i, running) {
    zA = i;
    map.classList.toggle("lit", i !== null);
    holes.forEach(function (h, j) { h.classList.toggle("on", j === i); });
    edges.forEach(function (h, j) { h.classList.toggle("on", j === i); });
    pins.forEach(function (p, j) { p.setAttribute("aria-pressed", String(j === i)); });
    zBtns.forEach(function (b, j) { b.setAttribute("aria-pressed", String(j === i)); });
    zones.forEach(function (z, j) {
      z.classList.toggle("dim", i !== null && j !== i);
      z.classList.remove("run", "on");
      if (j === i) { z.style.setProperty("--dwell", DWELL + "ms"); void z.offsetWidth; z.classList.add(running ? "run" : "on"); }
    });
  };
  var cycle = function () {
    clearInterval(timer);
    if (!auto || !seen) return;
    zSet(zA === null ? 0 : zA, true);
    timer = setInterval(function () { zSet(((zA === null ? -1 : zA) + 1) % 3, true); }, DWELL);
  };
  var pickZone = function (i) { auto = false; clearInterval(timer); zSet(i, false); };
  pins.forEach(function (p, i) { p.addEventListener("click", function () { pickZone(i); }); p.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") pickZone(i); }); });
  zones.forEach(function (z, i) { zBtns[i].addEventListener("click", function () { pickZone(i); }); z.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") pickZone(i); }); });
  if (auto) new IntersectionObserver(function (es) { seen = es[0].isIntersecting; if (seen) cycle(); else clearInterval(timer); }, { threshold: 0.4 }).observe(map);

  /* Sahne 06 · light tables: each type's sheets get tabs (plans or floors); the sheet opens full screen. */
  $$(".unit").forEach(function (unit) {
    var lt = $(".lt", unit), sheets = $$(".lt-sheet", lt), ui = +unit.dataset.unitI, name = $("h3", unit).textContent.trim();
    var head = d.createElement("div");
    head.className = "lt-head";
    var tabs = null, cur = 0;
    if (sheets.length > 1) {
      tabs = d.createElement("div");
      tabs.className = "tabs-row";
      tabs.setAttribute("role", "tablist");
      tabs.setAttribute("aria-label", name + " planları");
      sheets.forEach(function (s, i) {
        s.id = unit.id + "-p" + (i + 1);
        s.setAttribute("role", "tabpanel");
        var b = d.createElement("button");
        b.type = "button"; b.setAttribute("role", "tab"); b.id = s.id + "-t"; b.setAttribute("aria-controls", s.id); b.textContent = s.dataset.label;
        s.setAttribute("aria-labelledby", b.id);
        b.addEventListener("click", function () { show(i); });
        tabs.appendChild(b);
      });
      head.appendChild(tabs);
      U.tabKeys(tabs, function (i) { show(i); });
    } else {
      var l = d.createElement("span");
      l.className = "label"; l.style.color = "rgb(10 10 10 / 0.66)"; l.textContent = sheets[0].dataset.label;
      head.appendChild(l);
    }
    var zoom = d.createElement("button");
    zoom.type = "button"; zoom.className = "lt-zoom";
    zoom.innerHTML = 'Büyütün <span aria-hidden="true">⤢</span><span class="sr-only">: ' + name + " kat planı</span>";
    head.appendChild(zoom);
    lt.insertBefore(head, lt.firstChild);
    var show = function (i) {
      cur = i;
      sheets.forEach(function (s, j) { s.classList.toggle("on", j === i); });
      if (tabs) $$("button", tabs).forEach(function (b, j) { b.setAttribute("aria-selected", String(j === i)); b.tabIndex = j === i ? 0 : -1; });
    };
    var open = function (e) { var u = U.UNITS[ui]; U.openPlan({ title: u.title, sheets: u.sheets, start: cur }, e.currentTarget); };
    zoom.addEventListener("click", open);
    sheets.forEach(function (s) { $("img", s).addEventListener("click", function () { zoom.click(); }); });
    show(0);
  });

  /* The film strip over the types marks the one on screen; it slides down when the header comes back. */
  var units = $$(".unit"), navLinks = $$(".unit-nav a"), navCur = -1;
  var uio = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      var i = units.indexOf(e.target);
      if (i === navCur) return;
      navCur = i;
      navLinks.forEach(function (a, j) { if (j === i) { a.setAttribute("aria-current", "true"); a.scrollIntoView({ block: "nearest", inline: "nearest" }); } else a.removeAttribute("aria-current"); });
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  units.forEach(function (u) { uio.observe(u); });

  /* Sahne 08 · 360° tours: Kuula loads only after "start"; the dates switch the tour, live or not. */
  var stage = $(".tour-stage"), dateBtns = $$(".tour-dates button"), when = $(".tour-when time"), tab = $(".tour-tab"), ttc = $(".tour-tc");
  var url = function (id) { return "https://kuula.co/share/collection/" + id + "?logo=1&info=0&fs=1&vr=0&initload=1&autorotate=0.1&thumbs=1"; };
  var tourAt = 0;
  var label = function (b) { return $("time", b).textContent; };
  var load = function () {
    var b = dateBtns[tourAt], f = $("iframe", stage);
    if (!f) {
      f = d.createElement("iframe");
      f.setAttribute("allow", "fullscreen; xr-spatial-tracking; gyroscope; accelerometer");
      f.allowFullscreen = true;
      stage.appendChild(f);
    }
    f.title = "Levan Bahçeşehir şantiyesinin " + label(b) + " tarihli 360° turu";
    f.src = url(b.dataset.id);
    stage.classList.add("live");
    f.focus();
  };
  $(".tour-start").addEventListener("click", load);
  dateBtns.forEach(function (b, i) {
    b.addEventListener("click", function () {
      tourAt = i;
      dateBtns.forEach(function (o, j) { o.setAttribute("aria-pressed", String(j === i)); });
      when.textContent = label(b); when.setAttribute("datetime", b.dataset.date);
      ttc.textContent = "Tur " + $("b", b).textContent + " / 05";
      tab.href = url(b.dataset.id);
      if (stage.classList.contains("live")) load();
    });
  });
})();
