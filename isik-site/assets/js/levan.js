/* Işık · Levan Bahçeşehir: the day rail, the sun-path of drive times, day and night split by a glass prism, the six
   standards, the site plan lit from below, the fanned deck and its light-table, the 360° tours. */
(function () {
  var U = window.UZM, $ = U.$, $$ = U.$$, clamp = U.clamp, R = U.reduced;

  /* ── Day rail: shown between the hero and the footer; the current chapter is lit and the sun slides to it. */
  var rail = $(".dayrail"), links = $$("a", rail);
  var chapters = links.map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); });
  var hero = $(".ph"), footer = $(".ftr"), C = { tops: [], heroB: 0, footT: 0 }, lastC = -2;
  U.onMeasure.push(function () { C.tops = chapters.map(U.abs); C.heroB = U.abs(hero) + hero.offsetHeight; C.footT = U.abs(footer); });
  U.onFrame.push(function (y, vh, moved) {
    if (!moved) return;
    rail.classList.toggle("on", y + vh * 0.35 > C.heroB && y + vh * 0.6 < C.footT);
    var mid = y + vh * 0.4, cur = -1;
    C.tops.forEach(function (t, i) { if (t <= mid) cur = i; });
    if (cur === lastC) return;
    lastC = cur;
    links.forEach(function (a, i) { if (i === cur) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current"); });
  });

  /* ── Sun-path: the drive as a sun crossing the sky; 0 at Levan on the left, 30 minutes on the right. */
  var arcbox = $(".arcbox"), arcSun = $("#arcSun"), arcRun = $("#arcRun"), ticks = $(".arc-ticks", arcbox);
  var NS = "http://www.w3.org/2000/svg", CX = 400, CY = 280, RX = 360, RY = 250, MAX = 30;
  var at = function (m, out) { var th = Math.PI * (1 - m / MAX), o = out || 0; return [CX + (RX + o) * Math.cos(th), CY - (RY + o) * Math.sin(th)]; };
  for (var m = 0; m <= MAX; m += 5) {
    var g = document.createElementNS(NS, "g"), a1 = at(m, -10), a2 = at(m, 10), t = at(m, 30);
    g.innerHTML = '<line x1="' + a1[0] + '" y1="' + a1[1] + '" x2="' + a2[0] + '" y2="' + a2[1] + '"/>' + (m > 0 && m < MAX ? '<text x="' + t[0] + '" y="' + (t[1] + 4) + '">' + m + "</text>" : "");
    g.dataset.m = m;
    ticks.appendChild(g);
  }
  var dests = $$(".dests button", arcbox), arcMin = $("#arcMin"), arcName = $("#arcName"), arcNote = $("#arcNote");
  var mNow = 0, raf = 0;
  var place = function (mm) {
    var p = at(mm);
    arcSun.style.setProperty("--sx", (p[0] / 800 * 100).toFixed(2) + "%");
    arcSun.style.setProperty("--sy", (p[1] / 300 * 100).toFixed(2) + "%");
    arcRun.style.setProperty("--off", (1 - mm / MAX).toFixed(4));
  };
  var travel = function (to) {
    cancelAnimationFrame(raf);
    $$("g", ticks).forEach(function (g) { g.classList.toggle("hit", +g.dataset.m === to); });
    if (R) { mNow = to; place(to); arcMin.textContent = to; return; }
    var from = 0, t0 = performance.now(), D = 1500;
    (function step(t) {
      var k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3);
      mNow = from + (to - from) * e; place(mNow);
      arcMin.textContent = Math.round(mNow);
      if (k < 1) raf = requestAnimationFrame(step);
    })(t0);
  };
  var choose = function (b) {
    dests.forEach(function (o) { o.setAttribute("aria-pressed", o === b); });
    arcName.textContent = $("b", b).textContent; arcNote.textContent = b.dataset.note;
    travel(+b.dataset.min);
  };
  dests.forEach(function (b) { b.addEventListener("click", function () { choose(b); }); });
  place(0);
  var arcIO = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { arcIO.disconnect(); choose(dests[0]); } }, { threshold: 0.5 });
  arcIO.observe(arcbox);

  /* ── Day and night: until the visitor takes the divider, night sweeps across as the picture scrolls by. */
  var dn = $("#dnView"), knob = $(".dn-knob", dn), tagD = $(".dn-tag-d", dn), tagN = $(".dn-tag-n", dn);
  var x = 50, target = 50, touched = R, dragging = false, dnRaf = 0, DN = { top: 0, h: 0 };
  var write = function (v) {
    dn.style.setProperty("--x", v.toFixed(2));
    var r = Math.round(v);
    knob.setAttribute("aria-valuenow", r);
    knob.setAttribute("aria-valuetext", r >= 98 ? "Tümü gündüz" : r <= 2 ? "Tümü gece" : "Yüzde " + r + " gündüz, yüzde " + (100 - r) + " gece");
    tagD.style.opacity = v < 12 ? 0 : 1; tagN.style.opacity = v > 88 ? 0 : 1;
  };
  var ease = function () {
    cancelAnimationFrame(dnRaf);
    (function step() { var d = target - x; x = Math.abs(d) < 0.05 ? target : x + d * 0.22; write(x); if (x !== target) dnRaf = requestAnimationFrame(step); })();
  };
  var go = function (v) { target = clamp(v, 0, 100); ease(); };
  var fromPointer = function (e) { var r = dn.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * 100; };
  dn.addEventListener("pointerdown", function (e) { touched = true; dragging = true; dn.setPointerCapture(e.pointerId); go(fromPointer(e)); });
  dn.addEventListener("pointermove", function (e) { if (dragging) go(fromPointer(e)); });
  ["pointerup", "pointercancel"].forEach(function (t) { dn.addEventListener(t, function () { dragging = false; }); });
  knob.addEventListener("keydown", function (e) {
    var k = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5, PageDown: -20, PageUp: 20 }[e.key];
    if (k === undefined && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault(); touched = true;
    go(e.key === "Home" ? 0 : e.key === "End" ? 100 : target + k);
  });
  write(50);
  U.onMeasure.push(function () { DN.top = U.abs(dn); DN.h = dn.offsetHeight; });
  U.onFrame.push(function (y, vh, moved) {
    if (!moved || touched) return;
    var p = clamp((y + vh - DN.top) / (vh + DN.h));
    if (p <= 0 || p >= 1) return;
    go(100 - clamp((p - 0.25) / 0.5) * 100);
  });

  /* ── Why Levan: the item nearest the middle of the screen lights the window. */
  var whyItems = $$(".why-item"), whyImgs = $$(".why-win > img"), whyN = $(".why-n"), whyCap = $(".why-cap"), whyCur = 0;
  var wide = matchMedia("(min-width: 56.01rem)");
  var W = [];
  U.onMeasure.push(function () { W = whyItems.map(function (it) { return U.abs(it) + it.offsetHeight / 2; }); });
  U.onFrame.push(function (y, vh, moved) {
    if (!moved || !wide.matches) return;
    var best = 0, bd = Infinity;
    W.forEach(function (c, k) { var d = Math.abs(c - (y + vh / 2)); if (d < bd) { bd = d; best = k; } });
    if (best === whyCur) return;
    whyCur = best;
    whyImgs.forEach(function (im, k) { im.classList.toggle("on", k === best); });
    whyItems.forEach(function (it, k) { it.classList.toggle("on", k === best); });
    whyN.textContent = "0" + (best + 1);
    whyCap.textContent = whyItems[best].dataset.cap;
  });

  /* ── Site plan: while on screen the three areas light up in turn, until the visitor picks one. */
  var map = $(".vz-map"), holes = $$(".vz-hole"), edges = $$(".vz-edge"), pins = $$(".vz-pin"), zones = $$(".zone");
  var zoneBtns = zones.map(function (z) { return $("h3 button", z); });
  var DWELL = 3600, auto = !R, seen = false, timer = 0, zActive = null;
  var zSet = function (i, running) {
    zActive = i;
    map.classList.toggle("lit", i !== null);
    holes.forEach(function (h, k) { h.classList.toggle("on", k === i); });
    edges.forEach(function (h, k) { h.classList.toggle("on", k === i); });
    pins.forEach(function (p, k) { p.setAttribute("aria-pressed", k === i); });
    zoneBtns.forEach(function (b, k) { b.setAttribute("aria-pressed", k === i); });
    zones.forEach(function (z, k) {
      z.classList.toggle("dim", i !== null && k !== i);
      z.classList.remove("run", "on");
      if (k === i) { z.style.setProperty("--dwell", DWELL + "ms"); void z.offsetWidth; z.classList.add(running ? "run" : "on"); }
    });
  };
  var cycle = function () {
    clearInterval(timer);
    if (!auto || !seen) return;
    zSet(zActive === null ? 0 : zActive, true);
    timer = setInterval(function () { zSet(((zActive === null ? -1 : zActive) + 1) % 3, true); }, DWELL);
  };
  var pick = function (i) { auto = false; clearInterval(timer); zSet(zActive === i ? null : i, false); };
  pins.forEach(function (p, i) { p.addEventListener("click", function () { pick(i); }); });
  zoneBtns.forEach(function (b, i) { b.addEventListener("click", function () { pick(i); }); });
  if (auto) new IntersectionObserver(function (es) { seen = es[0].isIntersecting; if (seen) cycle(); else clearInterval(timer); }, { threshold: 0.4 }).observe(map);

  /* ── Home types: the deck spreads when it comes into view; a card chosen lifts out and its type lies on the
     light-table below. Without script the cards are plain links to six open panels. */
  var fan = $("#fan"), fcards = $$(".fcard", fan), types = $$(".type");
  fan.setAttribute("role", "tablist"); fan.setAttribute("aria-label", "Konut tipleri");
  fcards.forEach(function (c, i) {
    c.setAttribute("role", "tab"); c.id = "ft-" + i; c.setAttribute("aria-controls", types[i].id);
    types[i].setAttribute("role", "tabpanel"); types[i].setAttribute("aria-labelledby", c.id);
  });
  var typeAt = -1;
  var selectType = function (i, focus, scroll) {
    if (i === typeAt) return;
    var first = typeAt < 0; typeAt = i;
    fcards.forEach(function (c, k) { c.setAttribute("aria-selected", k === i); c.tabIndex = k === i ? 0 : -1; });
    types.forEach(function (t, k) { t.hidden = k !== i; t.classList.remove("enter"); });
    if (!first && !R) { void types[i].offsetWidth; types[i].classList.add("enter"); }
    if (focus) fcards[i].focus({ preventScroll: true });
    if (scroll) { var r = types[i].getBoundingClientRect(); if (r.top > innerHeight * 0.8) U.scrollTo(scrollY + r.top - innerHeight * 0.35); }
    U.measure();
  };
  fcards.forEach(function (c, i) {
    c.addEventListener("click", function (e) { e.preventDefault(); selectType(i, false, true); });
    c.addEventListener("keydown", function (e) { if (e.key === " ") { e.preventDefault(); selectType(i, false, true); } });
  });
  U.tabs(fan, function (i) { selectType(i, true); });
  var fromHash = function () { var k = types.map(function (t) { return "#" + t.id; }).indexOf(location.hash); return k; };
  selectType(Math.max(0, fromHash()));
  addEventListener("hashchange", function () { var k = fromHash(); if (k > -1) selectType(k); });
  if (R) fan.classList.add("spread");
  else new IntersectionObserver(function (es, o) { if (es[0].isIntersecting) { fan.classList.add("spread"); o.disconnect(); } }, { threshold: 0.35 }).observe(fan);
  if (U.fine && !R) fcards.forEach(function (c) {
    c.addEventListener("pointermove", function (e) { var r = c.getBoundingClientRect(); c.style.setProperty("--gx", ((e.clientX - r.left) / r.width * 100).toFixed(1) + "%"); c.style.setProperty("--gy", ((e.clientY - r.top) / r.height * 100).toFixed(1) + "%"); c.style.setProperty("--go", "0.95"); });
    c.addEventListener("pointerleave", function () { c.style.setProperty("--go", "0.5"); });
  });

  /* Sheets on each light-table: the tabs (and the rows of the area table) swap the drawing. */
  types.forEach(function (t, ti) {
    var tabs = $(".sheet-tabs", t), tabLinks = $$("a", tabs), lt = $(".lt", t), img = $(".lt img", t), zoom = $(".lt-zoom", t), rows = $$("tr[data-sheet]", t);
    var plan = U.PLANS[+t.dataset.type];
    tabs.setAttribute("role", "tablist");
    lt.setAttribute("role", "tabpanel");
    var cur = 0;
    var show = function (i, focus) {
      tabLinks.forEach(function (a, k) { a.setAttribute("aria-selected", k === i); a.tabIndex = k === i ? 0 : -1; a.removeAttribute("aria-current"); });
      rows.forEach(function (r) { r.classList.toggle("on", +r.dataset.sheet === i); });
      lt.setAttribute("aria-labelledby", tabLinks[i].id);
      zoom.dataset.sheet = i;
      if (focus) tabLinks[i].focus();
      if (i === cur && img.dataset.ready) return;
      cur = i; img.dataset.ready = 1;
      var s = plan.sheets[i], put = function () { img.src = s.src; img.width = s.w; img.height = s.h; img.alt = plan.title + (plan.sheets.length > 1 ? ", " + s.label : "") + " kat planı"; img.classList.remove("swap"); };
      if (R || img.src.indexOf(s.src.split("/").pop()) > -1) return put();
      img.classList.add("swap"); setTimeout(put, 200);
    };
    tabLinks.forEach(function (a, i) {
      a.setAttribute("role", "tab"); a.id = "st-" + ti + "-" + i;
      a.addEventListener("click", function (e) { e.preventDefault(); show(i); });
      a.addEventListener("keydown", function (e) { if (e.key === " ") { e.preventDefault(); show(i); } });
    });
    U.tabs(tabs, function (i) { show(i, true); });
    rows.forEach(function (r) {
      r.addEventListener("click", function () { show(+r.dataset.sheet); });
      if (U.fine) r.addEventListener("pointerenter", function () { show(+r.dataset.sheet); });
    });
    if (U.fine && !R) lt.addEventListener("pointermove", function (e) {
      var b = lt.getBoundingClientRect();
      lt.style.setProperty("--lx", ((e.clientX - b.left) / b.width * 100).toFixed(1) + "%");
      lt.style.setProperty("--ly", ((e.clientY - b.top) / b.height * 100).toFixed(1) + "%");
    });
    show(0);
  });

  /* ── 360° tours: Kuula loads only after "start"; the dates switch the tour, live or not. */
  var stage = $(".tour-stage"), dateBtns = $$(".tour-dates button"), when = $(".tour-when time"), tab = $(".tour-tab");
  var url = function (id) { return "https://kuula.co/share/collection/" + id + "?logo=1&info=0&fs=1&vr=0&initload=1&autorotate=0.1&thumbs=1"; };
  var tourAt = 0, label = function (b) { return $("time", b).textContent; };
  var load = function () {
    var b = dateBtns[tourAt], f = $("iframe", stage);
    if (!f) { f = document.createElement("iframe"); f.setAttribute("allow", "fullscreen; xr-spatial-tracking; gyroscope; accelerometer"); f.allowFullscreen = true; stage.appendChild(f); }
    f.title = "Levan Bahçeşehir şantiyesinin " + label(b) + " tarihli 360° turu";
    f.src = url(b.dataset.id);
    stage.classList.add("live");
    f.focus();
  };
  $(".tour-start").addEventListener("click", load);
  dateBtns.forEach(function (b, i) {
    b.addEventListener("click", function () {
      tourAt = i;
      dateBtns.forEach(function (o, k) { o.setAttribute("aria-pressed", k === i); });
      when.textContent = label(b); when.setAttribute("datetime", b.dataset.date);
      tab.href = url(b.dataset.id);
      if (stage.classList.contains("live")) load();
    });
  });

  U.measure();
})();
