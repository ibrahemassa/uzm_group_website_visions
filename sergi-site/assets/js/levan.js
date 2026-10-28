/* Sergi · II · Levan Bahçeşehir: the wing's floor plan, the gallery light (day to night), the six standards, the site
   plan's spotlight, the long wall of home types, the drawings vitrine with its loupe, the salon hang, the diary ruler
   and the 360° rotunda. */
(function () {
  "use strict";
  var U = window.UZM, $ = U.$, $$ = U.$$, clamp = U.clamp, easeOut = U.easeOut;

  /* ── The wing's floor plan: shown between the hero and the footer; the room you stand in is lit. */
  var wm = $(".wing-map"), wmLinks = $$("a", wm);
  var rooms = wmLinks.map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); });
  var hero = $(".lv-hero"), foot = $(".foot"), wmCur = -2;
  U.loop.push(function (y, vh) {
    if (!wm.offsetParent && getComputedStyle(wm).display === "none") return;
    var show = hero.getBoundingClientRect().bottom < vh * 0.3 && foot.getBoundingClientRect().top > vh * 0.6;
    wm.classList.toggle("on", show);
    var cur = -1;
    for (var i = 0; i < rooms.length; i++) if (rooms[i].getBoundingClientRect().top < vh * 0.45) cur = i;
    if (cur === wmCur) return;
    wmCur = cur;
    wmLinks.forEach(function (a, k) { if (k === cur) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current"); });
    wm.classList.toggle("light", cur >= 0 && rooms[cur].classList.contains("on-light"));
  });

  /* ── II.2 · The gallery light: a brass dimmer takes the aerial from day to night; it dims once by itself. */
  var dn = $(".dn-win"), dim = $("#dn-range"), touched = false;
  var setDn = function (v) {
    dn.style.setProperty("--v", (v / 100).toFixed(3));
    dim.value = Math.round(v);
    dim.setAttribute("aria-valuetext", v < 25 ? "Gündüz" : v > 75 ? "Gece" : "Alacakaranlık");
  };
  dim.addEventListener("input", function () { touched = true; setDn(+dim.value); });
  if (!U.reduced) {
    var dio = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      dio.disconnect();
      var t0 = performance.now(), D = 3200;
      setTimeout(function () {
        t0 = performance.now();
        (function tick(now) {
          if (touched) return;
          var k = clamp((now - t0) / D), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
          setDn(e * 100);
          if (k < 1) requestAnimationFrame(tick);
        })(t0);
      }, 600);
    }, { threshold: 0.55 });
    dio.observe(dn);
  }

  /* ── II.3 · The six standards: the wall text nearest the middle of the screen is lit; the frame changes. */
  var whyItems = $$(".why-item"), whyPics = $$(".why-pics img"), whyRoll = $(".why-roll"), whyCap = $(".why-cap"), whyCur = 0;
  var wide = matchMedia("(min-width: 56.01rem)");
  var whySet = function (i) {
    if (i === whyCur) return;
    whyPics.forEach(function (p, k) { p.classList.toggle("on", k === i); });
    whyItems.forEach(function (it, k) { it.classList.toggle("on", k === i); });
    whyRoll.style.setProperty("--i", i);
    whyCap.textContent = whyItems[i].dataset.cap;
    whyCur = i;
  };
  U.loop.push(function (y, vh) {
    if (!wide.matches) return;
    var r0 = whyItems[0].getBoundingClientRect(), rl = whyItems[whyItems.length - 1].getBoundingClientRect();
    if (rl.bottom < 0 || r0.top > vh) return;
    var best = 0, bd = Infinity;
    whyItems.forEach(function (it, k) { var r = it.getBoundingClientRect(), d = Math.abs(r.top + r.height / 2 - vh / 2); if (d < bd) { bd = d; best = k; } });
    whySet(best);
  });

  /* ── II.4 · The site plan: the light visits the three zones in turn until the visitor picks one. */
  var vz = $(".vz-map"), holes = $$(".vz-hole"), edges = $$(".vz-edge"), pins = $$(".vz-pin"), zones = $$(".zone");
  var zBtns = zones.map(function (z) { return $("h3 button", z); });
  var DWELL = 3600, auto = !U.reduced, seen = false, timer = 0, zAct = null;
  var zSet = function (i, running) {
    zAct = i;
    vz.classList.toggle("lit", i !== null);
    holes.forEach(function (h, k) { h.classList.toggle("on", k === i); });
    edges.forEach(function (h, k) { h.classList.toggle("on", k === i); });
    pins.forEach(function (p, k) { p.setAttribute("aria-pressed", String(k === i)); });
    zBtns.forEach(function (b, k) { b.setAttribute("aria-pressed", String(k === i)); });
    zones.forEach(function (z, k) {
      z.classList.toggle("dim", i !== null && k !== i);
      z.classList.remove("run", "on");
      if (k === i) { z.style.setProperty("--dwell", DWELL + "ms"); void z.offsetWidth; z.classList.add(running ? "run" : "on"); }
    });
  };
  var cycle = function () {
    clearInterval(timer);
    if (!auto || !seen) return;
    zSet(zAct === null ? 0 : zAct, true);
    timer = setInterval(function () { zSet(((zAct === null ? -1 : zAct) + 1) % 3, true); }, DWELL);
  };
  var pick = function (i) { auto = false; clearInterval(timer); zSet(zAct === i ? null : i, false); };
  pins.forEach(function (p, i) { p.addEventListener("click", function () { pick(i); }); });
  zBtns.forEach(function (b, i) { b.addEventListener("click", function () { pick(i); }); });
  if (auto) new IntersectionObserver(function (es) { seen = es[0].isIntersecting; if (seen) cycle(); else clearInterval(timer); }, { threshold: 0.4 }).observe(vz);

  /* ── II.5 · The long wall: scrolling walks you along it; the works turn toward you as you pass, each under its own
     spot. Phones and reduced motion get the plain hang. */
  var units = $("#konutlar"), gw = $("#gw"), track = $("#gw-track"), gwItems = $$(".gw-item", track);
  var gwProg = $(".gw-prog", gw), gwCt = $(".gw-ct b", gw);
  var GW = null, gwLast = -1;
  var setupGW = function () {
    var on = !U.reduced && innerWidth >= 900 && innerHeight >= 560;
    gw.classList.toggle("walk-on", on);
    track.style.transform = "";
    gwItems.forEach(function (it) { it.style.transform = ""; });
    if (!on) { GW = null; gw.style.removeProperty("--len"); return; }
    var dist = Math.max(1, track.scrollWidth - innerWidth);
    gw.style.setProperty("--len", dist + innerHeight + "px");
    GW = { dist: dist, centers: gwItems.map(function (it) { return it.offsetLeft + it.offsetWidth / 2; }) };
    GW.top = gw.getBoundingClientRect().top + window.scrollY;
    gwLast = -1;
  };
  var updateGW = function (y, vh) {
    if (!GW) return;
    var rel = y - GW.top;
    if (rel < -vh * 1.2 || rel > GW.dist + vh * 1.2) return;
    var p = clamp(rel / GW.dist);
    if (Math.abs(p - gwLast) < 0.0004) return;
    gwLast = p;
    var x = -p * GW.dist, vw = innerWidth, near = 0, nd = 1e9;
    track.style.transform = "translate3d(" + x.toFixed(1) + "px,0,0)";
    for (var i = 0; i < gwItems.length; i++) {
      var d = (GW.centers[i] + x - vw / 2) / (vw * 0.5), dc = clamp(d, -1.8, 1.8);
      gwItems[i].style.transform = "translate3d(0,0," + (-Math.abs(dc) * 240).toFixed(1) + "px) rotateY(" + (-dc * 24).toFixed(2) + "deg)";
      gwItems[i].style.setProperty("--lit", (0.15 + 0.85 * (1 - clamp(Math.abs(d)))).toFixed(3));
      if (Math.abs(d) < nd) { nd = Math.abs(d); near = i; }
    }
    gwProg.style.setProperty("--p", p.toFixed(4));
    gwCt.textContent = String(near + 1).padStart(2, "0");
  };
  setupGW();
  U.loop.push(updateGW);
  U.resize.push(setupGW);
  new ResizeObserver(function () { if (GW) GW.top = gw.getBoundingClientRect().top + window.scrollY; }).observe(document.body);
  /* Keyboard: a focused work is walked into view. */
  track.addEventListener("focusin", function (e) {
    if (!GW) return;
    var it = e.target.closest(".gw-item");
    var i = gwItems.indexOf(it);
    if (i < 0) return;
    var p = clamp((GW.centers[i] - innerWidth / 2) / GW.dist);
    var to = GW.top + p * GW.dist;
    if (U.lenis) U.lenis.scrollTo(to, { immediate: true }); else window.scrollTo(0, to);
  });
  $$("[data-plan-unit]").forEach(function (b) {
    b.addEventListener("click", function () {
      var els = $$('[data-inspect="units"][data-unit]', units);
      U.inspect(els.map(function (el) { return U.unitItem(+el.dataset.unit, el); }), +b.dataset.planUnit, { view: "plan", from: b });
    });
  });

  /* ── II.6 · The drawings vitrine: type tabs, floor or variant buttons, the catalogue card, a loupe. */
  var pv = $(".pv"), types = $$(".pv-types [role=tab]", pv), panels = $$(".pv-panel", pv), pt = 0;
  var card = { no: $("#pv-no"), ti: $("#pv-ti"), net: $("#pv-net"), gross: $("#pv-gross"), garden: $("#pv-garden"), tx: $("#pv-tx") };
  var typeName = function (i) { return types[i].lastChild.textContent.trim(); };
  var updCard = function () {
    var panel = panels[pt], sheet = $(".pv-sheet.on", panel), btn = $('.pv-sheets [aria-pressed="true"]', panel);
    card.no.textContent = "Kat. II.6." + (pt + 1) + " · Kat planı · Ölçeksiz";
    card.ti.textContent = typeName(pt) + (btn && btn.textContent !== typeName(pt).split(" ")[0] ? " · " + btn.textContent : "");
    card.net.textContent = sheet.dataset.net + " m²";
    card.gross.textContent = sheet.dataset.gross + " m²";
    card.garden.textContent = sheet.dataset.garden ? sheet.dataset.garden + " m²" : "—";
    card.tx.textContent = sheet.hasAttribute("data-total") ? "Alanlar üç katın toplamıdır. Levan Bahçeşehir'in yayımladığı kat planı." : "Levan Bahçeşehir'in yayımladığı kat planı.";
  };
  var showType = function (i, focus) {
    pt = i;
    types.forEach(function (b, k) { b.setAttribute("aria-selected", String(k === i)); b.tabIndex = k === i ? 0 : -1; });
    panels.forEach(function (p, k) { p.classList.toggle("on", k === i); });
    if (focus) types[i].focus();
    updCard();
  };
  types.forEach(function (b, i) {
    b.addEventListener("click", function () { showType(i); });
    b.addEventListener("keydown", function (e) {
      var k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (e.key === "Home") { e.preventDefault(); showType(0, true); }
      else if (e.key === "End") { e.preventDefault(); showType(types.length - 1, true); }
      else if (k) { e.preventDefault(); showType((i + k + types.length) % types.length, true); }
    });
  });
  panels.forEach(function (panel) {
    var bs = $$(".pv-sheets button", panel), sh = $$(".pv-sheet", panel);
    bs.forEach(function (b, s) {
      b.addEventListener("click", function () {
        bs.forEach(function (o, k) { o.setAttribute("aria-pressed", String(k === s)); });
        sh.forEach(function (o, k) { o.classList.toggle("on", k === s); });
        updCard();
      });
    });
  });
  showType(0);
  /* The loupe over the drawing: a mouse shows it by hovering, a finger by pressing (when switched on). */
  var lens = document.createElement("div");
  lens.className = "pv-lens"; lens.setAttribute("aria-hidden", "true");
  var lensBtn = $(".pv-loupe", pv), lensOn = U.fine, pressing = false;
  var setLens = function (on) {
    lensOn = on;
    lensBtn.setAttribute("aria-pressed", String(on));
    $$(".pv-sheet img", pv).forEach(function (im) { im.style.touchAction = on ? "none" : ""; });
    if (!on) lens.classList.remove("on");
  };
  setLens(lensOn);
  lensBtn.addEventListener("click", function () { setLens(!lensOn); });
  var moveLens = function (e, img) {
    var caseEl = img.closest(".pv-case");
    if (lens.parentElement !== caseEl) caseEl.appendChild(lens);
    var r = img.getBoundingClientRect(), c = caseEl.getBoundingClientRect();
    var x = e.clientX - r.left, y = e.clientY - r.top;
    if (x < 0 || y < 0 || x > r.width || y > r.height) { lens.classList.remove("on"); return; }
    var Z = 2.8, L = lens.offsetWidth || 192;
    lens.style.left = e.clientX - c.left + "px";
    lens.style.top = e.clientY - c.top + "px";
    lens.style.backgroundImage = 'url("' + img.currentSrc + '")';
    lens.style.backgroundSize = r.width * Z + "px " + r.height * Z + "px";
    lens.style.backgroundPosition = L / 2 - x * Z + "px " + (L / 2 - y * Z) + "px";
    lens.classList.add("on");
  };
  $$(".pv-sheet img", pv).forEach(function (img) {
    img.addEventListener("pointermove", function (e) { if (!lensOn) return; if (e.pointerType === "mouse" || pressing) moveLens(e, img); });
    img.addEventListener("pointerdown", function (e) { if (!lensOn || e.pointerType === "mouse") return; pressing = true; img.setPointerCapture(e.pointerId); moveLens(e, img); });
    var up = function () { pressing = false; lens.classList.remove("on"); };
    img.addEventListener("pointerup", up);
    img.addEventListener("pointercancel", up);
    img.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") lens.classList.remove("on"); });
  });

  /* ── II.7 · The salon hang: it assembles as you arrive; a work under the pointer or focus is lit. */
  var salon = $("#salon");
  var sItems = $$(".s-it", salon).map(function (el, i) {
    var a = (i * 2.399963) % (Math.PI * 2);
    return { el: el, dx: Math.cos(a) * (90 + (i % 4) * 40), dy: Math.sin(a) * 70 + 90, rot: ((i * 53) % 13) - 6, d: (i % 6) * 0.07 + Math.floor(i / 6) * 0.05 };
  });
  var salonP = -1;
  U.loop.push(function (y, vh) {
    if (U.reduced) return;
    var r = salon.getBoundingClientRect();
    if (r.bottom < -200 || r.top > vh + 200) return;
    var p = clamp((vh - r.top) / (vh * 0.8));
    if (Math.abs(p - salonP) < 0.0005) return;
    salonP = p;
    for (var i = 0; i < sItems.length; i++) {
      var s = sItems[i], q = easeOut(clamp((p - s.d) / 0.55)), k = 1 - q;
      s.el.style.transform = k > 0.001 ? "translate3d(" + (s.dx * k).toFixed(1) + "px," + (s.dy * k).toFixed(1) + "px,0) rotate(" + (s.rot * k).toFixed(2) + "deg) scale(" + (0.88 + 0.12 * q).toFixed(3) + ")" : "none";
      s.el.style.opacity = q.toFixed(3);
    }
  });
  var lightOn = function (el, on) {
    el.classList.toggle("on", on);
    salon.classList.toggle("hov", on);
    if (!on) return;
    var r = el.getBoundingClientRect();
    el.classList.toggle("flip", r.left + 272 > innerWidth - 8);
  };
  $$(".s-it.im", salon).forEach(function (el) {
    var b = $("button", el);
    el.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") lightOn(el, true); });
    el.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") lightOn(el, false); });
    b.addEventListener("focus", function () { lightOn(el, true); });
    b.addEventListener("blur", function () { lightOn(el, false); });
  });

  /* ── II.8 · The diary: each card is tied to its date on a ruler (June to September 2026); the ruler fills as you
     read along the table. */
  var desk = $(".desk"), cards = $$(".desk-cards .ix", desk), lead = $(".desk-ruler .leads", desk), months = $(".ruler-months", desk), bar = $(".ruler-bar", desk), fill = $(".ruler-fill", desk);
  var D0 = Date.UTC(2026, 5, 1), D1 = Date.UTC(2026, 9, 1);
  var frac = function (iso) { var p = iso.split("-"); return (Date.UTC(+p[0], +p[1] - 1, +p[2]) - D0) / (D1 - D0); };
  [["Haziran", "2026-06-16"], ["Temmuz", "2026-07-16"], ["Ağustos", "2026-08-16"], ["Eylül", "2026-09-15"]].forEach(function (m) {
    var s = document.createElement("span"); s.textContent = m[0]; s.style.left = (frac(m[1]) * 100).toFixed(2) + "%"; months.appendChild(s);
  });
  var lastF = frac(cards[cards.length - 1].dataset.date);
  cards.forEach(function (c) { var dot = document.createElement("i"); dot.className = "ruler-dot"; dot.style.left = (frac(c.dataset.date) * 100).toFixed(2) + "%"; bar.appendChild(dot); });
  var drawLeads = function () {
    var dr = desk.querySelector(".desk-cards").getBoundingClientRect();
    if (!dr.width) return;
    lead.innerHTML = cards.map(function (c) {
      var r = c.getBoundingClientRect(), x0 = ((r.left + r.width / 2 - dr.left) / dr.width) * 1000, x1 = frac(c.dataset.date) * 1000;
      return '<path d="M' + x0.toFixed(1) + " 0 C " + x0.toFixed(1) + " 60, " + x1.toFixed(1) + " 60, " + x1.toFixed(1) + ' 120"/>';
    }).join("");
  };
  drawLeads();
  U.resize.push(drawLeads);
  addEventListener("load", drawLeads);
  if (U.reduced) fill.style.setProperty("--p", lastF.toFixed(3));
  else U.loop.push(function (y, vh) {
    var r = desk.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh) return;
    fill.style.setProperty("--p", (clamp((vh * 0.9 - r.top) / (r.height * 0.9)) * lastF).toFixed(4));
  });

  /* ── II.8 · The rotunda: Kuula loads only after "start"; the dates switch the tour, live or not. */
  var stage = $(".rot-stage"), dates = $$(".rot-dates button"), when = $(".rot-when time"), tab = $(".rot-tab");
  var url = function (id) { return "https://kuula.co/share/collection/" + id + "?logo=1&info=0&fs=1&vr=0&initload=1&autorotate=0.1&thumbs=1"; };
  var tourAt = 0;
  var label = function (b) { return $("time", b).textContent; };
  var load = function () {
    var b = dates[tourAt], f = $("iframe", stage);
    if (!f) {
      f = document.createElement("iframe");
      f.setAttribute("allow", "fullscreen; xr-spatial-tracking; gyroscope; accelerometer");
      f.allowFullscreen = true;
      $(".rot-in", stage).appendChild(f);
    }
    f.title = "Levan Bahçeşehir şantiyesinin " + label(b) + " tarihli 360° turu";
    f.src = url(b.dataset.id);
    stage.classList.add("live");
  };
  $(".rot-start").addEventListener("click", load);
  dates.forEach(function (b, i) {
    b.addEventListener("click", function () {
      tourAt = i;
      dates.forEach(function (o, k) { o.setAttribute("aria-pressed", String(k === i)); });
      when.textContent = label(b); when.setAttribute("datetime", b.dataset.date);
      tab.href = url(b.dataset.id);
      if (stage.classList.contains("live")) load();
    });
  });
})();
