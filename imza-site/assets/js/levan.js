/* Levan Bahçeşehir page: chapter index, day/night aerial, the six standards, site plan zones, plan sheets, 360° tours. */
(function () {
  var U = window.UZM, $ = U.$, $$ = U.$$, clamp = U.clamp;
  var A = U.assets;

  /* Chapter index: shown between the hero and the footer; the chapter whose top has passed 40% of the screen is lit. */
  var toc = $(".toc"), tocLinks = $$(".toc a");
  var chapters = tocLinks.map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); });
  var hero = $(".ph"), footer = $(".ftr");
  var lastToc = -1;
  U.onScroll.push(function (y, vh) {
    var show = hero.getBoundingClientRect().bottom < vh * 0.35 && footer.getBoundingClientRect().top > vh * 0.6;
    toc.classList.toggle("on", show);
    var cur = -1;
    chapters.forEach(function (s, i) { if (s.getBoundingClientRect().top < vh * 0.4) cur = i; });
    if (cur !== lastToc) {
      tocLinks.forEach(function (a, i) { if (i === cur) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current"); });
      lastToc = cur;
    }
  });

  /* II. The lantern: night over the project; a warm pool of light shows the same view by day. The pointer carries
     it (easing behind), a finger drags its knob, the arrow keys move it, and the knob lights the whole scene. On first
     sight it drifts once across the picture, as if someone were walking with it, until the visitor takes it. */
  var ln = $(".lantern"), knob = $(".ln-knob", ln);
  var W = 1, H = 1, R = 200, lx = 0.5, ly = 0.52, tx = lx, ty = ly, raf = 0, touched = false, full = false, lnDrag = false;
  var paint = function () {
    ln.style.setProperty("--lx", (lx * W).toFixed(1) + "px");
    ln.style.setProperty("--ly", (ly * H).toFixed(1) + "px");
  };
  var follow = function () {
    cancelAnimationFrame(raf);
    (function step() {
      var k = U.reduced ? 1 : 0.16;
      lx += (tx - lx) * k; ly += (ty - ly) * k;
      paint();
      if (Math.abs(tx - lx) + Math.abs(ty - ly) > 0.0008) raf = requestAnimationFrame(step); else { lx = tx; ly = ty; paint(); }
    })();
  };
  var aim = function (x, y) { tx = clamp(x, 0.03, 0.97); ty = clamp(y, 0.04, 0.96); follow(); };
  var take = function () { if (!touched) { touched = true; ln.classList.add("touched"); } };
  var setR = function () { ln.style.setProperty("--lr", (full ? Math.hypot(W, H) * 1.15 : R).toFixed(0) + "px"); };
  U.onLayout.push(function () { W = ln.clientWidth || 1; H = ln.clientHeight || 1; R = clamp(W * 0.17, 105, 250); setR(); paint(); });
  var rel = function (e) { var r = ln.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
  ln.addEventListener("pointermove", function (e) {
    if (e.pointerType === "mouse" || lnDrag) { take(); var p = rel(e); aim(p[0], p[1]); }
  });
  knob.addEventListener("pointerdown", function (e) { if (e.pointerType === "mouse") return; lnDrag = true; take(); knob.setPointerCapture(e.pointerId); });
  knob.addEventListener("pointermove", function (e) { if (lnDrag) { var p = rel(e); aim(p[0], p[1]); } });
  var lnUp = function () { lnDrag = false; };
  knob.addEventListener("pointerup", lnUp); knob.addEventListener("pointercancel", lnUp);
  knob.addEventListener("click", function () {
    full = !full; take();
    knob.setAttribute("aria-pressed", full);
    knob.firstChild.textContent = full ? "Sahneyi yeniden geceye çevirin" : "Sahnenin tamamını gündüz gösterin";
    ln.classList.toggle("full", full);
    setR();
  });
  knob.addEventListener("keydown", function (e) {
    var d = { ArrowLeft: [-0.05, 0], ArrowRight: [0.05, 0], ArrowUp: [0, -0.07], ArrowDown: [0, 0.07] }[e.key];
    if (!d) return;
    e.preventDefault(); take(); aim(tx + d[0], ty + d[1]);
  });
  if (!U.reduced) {
    var drift = 0;
    var lio = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) { cancelAnimationFrame(drift); return; }
      if (touched) return;
      var t0 = performance.now();
      cancelAnimationFrame(drift);
      (function walk(t) {
        if (touched) return;
        var k = (t - t0) / 1000;
        if (k > 9) { aim(0.5, 0.55); return; }
        tx = 0.5 + Math.sin(k * 0.7) * 0.32; ty = 0.55 + Math.sin(k * 1.3 + 0.6) * 0.16;
        lx += (tx - lx) * 0.06; ly += (ty - ly) * 0.06; paint();
        drift = requestAnimationFrame(walk);
      })(t0);
    }, { threshold: 0.55 });
    lio.observe(ln);
  }

  /* V. Each home's picture can turn into its plan: the published plan, redrawn as a champagne line, writes itself
     over the darkened picture (pointing at it, or with its button). */
  $$(".unit-pic").forEach(function (f) {
    var b = $(".unit-draw", f), on = false;
    var set = function () { f.classList.toggle("drawn", on || f.classList.contains("hover")); };
    b.addEventListener("click", function () { on = !on; b.setAttribute("aria-pressed", on); set(); });
    if (U.fine) {
      f.addEventListener("pointerenter", function () { f.classList.add("hover"); set(); });
      f.addEventListener("pointerleave", function () { f.classList.remove("hover"); set(); });
    }
  });

  /* III. The six standards: the item nearest the middle of the screen is lit and its picture rises into the arch. */
  var whyItems = $$(".why-item"), whyPics = $$(".why-pics img"), whyRoll = $(".why-roll"), whyCap = $(".why-cap");
  var whyCur = 0;
  var whySet = function (i) {
    if (i === whyCur) return;
    whyPics.forEach(function (p, k) { p.classList.toggle("was", k === whyCur); p.classList.toggle("on", k === i); });
    whyItems.forEach(function (it, k) { it.classList.toggle("on", k === i); });
    whyRoll.style.setProperty("--i", i);
    whyCap.textContent = whyItems[i].dataset.cap;
    whyCur = i;
  };
  var wide = matchMedia("(min-width: 901px)");
  U.onScroll.push(function (y, vh) {
    if (!wide.matches) return;
    var best = 0, bestD = Infinity;
    whyItems.forEach(function (it, k) {
      var r = it.getBoundingClientRect();
      var d = Math.abs(r.top + r.height / 2 - vh / 2);
      if (d < bestD) { bestD = d; best = k; }
    });
    whySet(best);
  });

  /* IV. The site plan: while on screen it lights the three zones in turn, until the visitor picks one. */
  var map = $(".vz-map"), holes = $$(".vz-hole"), edges = $$(".vz-edge"), pins = $$(".vz-pin"), zones = $$(".zone");
  var zoneBtns = zones.map(function (z) { return $("h3 button", z); });
  var DWELL = 3600, auto = !U.reduced, seen = false, timer = 0, zActive = null;
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
      if (k === i) {
        z.style.setProperty("--dwell", DWELL + "ms");
        void z.offsetWidth;
        z.classList.add(running ? "run" : "on");
      }
    });
  };
  var cycle = function () {
    clearInterval(timer);
    if (!auto || !seen) return;
    zSet(zActive === null ? 0 : zActive, true);
    timer = setInterval(function () { zSet(((zActive === null ? -1 : zActive) + 1) % 3, true); }, DWELL);
  };
  var pick = function (i) { auto = false; clearInterval(timer); zSet(i, false); };
  pins.forEach(function (p, i) {
    p.addEventListener("click", function () { pick(i); });
    p.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") pick(i); });
  });
  zones.forEach(function (z, i) {
    zoneBtns[i].addEventListener("click", function () { pick(i); });
    z.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") pick(i); });
  });
  if (auto) {
    new IntersectionObserver(function (es) {
      seen = es[0].isIntersecting;
      if (seen) cycle(); else clearInterval(timer);
    }, { threshold: 0.4 }).observe(map);
  }

  /* V. Plan sheets: the flats' variants share one sheet with tabs; the villas show their three floors. */
  var sheet = function (key, w, h, label) { return { src: A + "img/levan--plan--" + key + ".webp", w: w, h: h, label: label }; };
  var floors = function (base) { return [sheet(base + "-zemin", 1600, 960, "Zemin kat"), sheet(base + "-1-kat", 1600, 960, "1. kat"), sheet(base + "-bodrum", 1600, 960, "Bodrum")]; };
  var UNITS = [
    { title: "2+1 Daire", sheets: [sheet("2-1-a", 1600, 918, "2+1 A"), sheet("2-1-b", 1600, 918, "2+1 B"), sheet("2-1-c", 1600, 918, "2+1 C")] },
    { title: "3+1 Daire", sheets: [sheet("3-1-a", 1600, 918, "3+1 A"), sheet("3-1-b", 1600, 918, "3+1 B"), sheet("3-1-c", 1600, 918, "3+1 C")] },
    { title: "4+1 Daire", sheets: [sheet("4-1", 1600, 918, "4+1")] },
    { title: "4+1 İkiz Villa", sheets: floors("ikiz") },
    { title: "5+1 Müstakil Villa", sheets: floors("mustakil") },
    { title: "6+1 Malikane", sheets: [sheet("malikane", 1600, 1194, "6+1")] }
  ];
  $$(".unit-open").forEach(function (b) {
    b.addEventListener("click", function () {
      var u = UNITS[+b.dataset.unit];
      U.openPlan({ title: u.title, sheets: u.sheets, start: +b.dataset.sheet }, b);
    });
  });

  /* VII. 360° tours: Kuula loads only after "start"; the dates switch the tour, live or not. */
  var stage = $(".tour-stage"), dateBtns = $$(".tour-dates button"), when = $(".tour-when time"), tab = $(".tour-tab");
  var url = function (id) { return "https://kuula.co/share/collection/" + id + "?logo=1&info=0&fs=1&vr=0&initload=1&autorotate=0.1&thumbs=1"; };
  var tourAt = 0;
  var label = function (b) { return b.querySelector("time").textContent; };
  var load = function () {
    var b = dateBtns[tourAt];
    var f = $("iframe", stage);
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
      tourAt = i;
      dateBtns.forEach(function (o, k) { o.setAttribute("aria-pressed", k === i); });
      when.textContent = label(b); when.setAttribute("datetime", b.dataset.date);
      tab.href = url(b.dataset.id);
      if (stage.classList.contains("live")) load();
    });
  });

  U.relayout();
})();
