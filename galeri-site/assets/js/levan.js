/* Galeri · Levan Bahçeşehir: the tracing-paper aerial, the six standards, the site plan, the six homes at one scale,
   the plan plates with their floors, the amenity index, the 360° tours on a time axis. */
(function () {
  var U = window.UZM, $ = U.$, $$ = U.$$, clamp = U.clamp, A = U.assets;
  var fmt2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* ── II. Day and night: the night plate lies over the day like tracing paper; the edge follows the pointer
     (hover with a mouse, press with touch), sweeps once when first seen, and answers the arrow keys. ── */
  var tr = $(".tr"), knob = tr && $(".tr-knob", tr);
  if (tr) {
    var target = 50, cur = 50, ease = 0.2, raf = 0, touched = false, dragging = false;
    var write = function (x) {
      tr.style.setProperty("--x", x.toFixed(2));
      knob.setAttribute("aria-valuenow", Math.round(x));
      knob.setAttribute("aria-valuetext", "Gece görünümü yüzde " + Math.round(100 - x));
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
    var go = function (x, k) { target = clamp(x, 0, 100); ease = U.reduced ? 1 : k || 0.2; run(); };
    var fromPointer = function (e) { var r = tr.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * 100; };
    tr.addEventListener("pointerdown", function (e) { touched = true; dragging = true; tr.setPointerCapture(e.pointerId); go(fromPointer(e), 0.35); });
    tr.addEventListener("pointermove", function (e) {
      if (!dragging && e.pointerType !== "mouse") return;
      touched = true;
      go(fromPointer(e), dragging ? 0.35 : 0.14);
    });
    var up = function () { dragging = false; };
    tr.addEventListener("pointerup", up);
    tr.addEventListener("pointercancel", up);
    knob.addEventListener("keydown", function (e) {
      var k = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5, PageDown: -20, PageUp: 20 }[e.key];
      if (k === undefined && e.key !== "Home" && e.key !== "End") return;
      e.preventDefault(); touched = true;
      go(e.key === "Home" ? 0 : e.key === "End" ? 100 : target + k, 0.3);
    });
    if (!U.reduced) {
      var tio = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return;
        tio.disconnect();
        [[0, 82], [1200, 20], [2600, 50]].forEach(function (s) { setTimeout(function () { if (!touched) go(s[1], 0.045); }, s[0]); });
      }, { threshold: 0.6 });
      tio.observe(tr);
    }
  }

  /* ── III. The six standards: the item nearest the middle of the screen is lit; its plate rises in the stage ── */
  var items = $$(".why-item"), pics = $(".why-pics"), whyCap = $(".why-cap"), whyCur = $(".why-n .cur");
  var stageImgs = items.map(function (it, i) {
    var src = $("img", it), im = document.createElement("img");
    im.alt = ""; im.loading = "lazy"; im.decoding = "async";
    im.src = src.getAttribute("src"); im.style.objectPosition = src.style.objectPosition;
    if (i === 0) im.className = "on";
    pics.appendChild(im);
    return im;
  });
  var capOf = function (it) { var f = $("figcaption", it); return { n: $(".fig", f).textContent, t: f.textContent.replace($(".fig", f).textContent, "").trim() }; };
  var whyAt = -1;
  var whySet = function (i) {
    if (i === whyAt) return;
    whyAt = i;
    stageImgs.forEach(function (im, k) { im.classList.toggle("on", k === i); });
    items.forEach(function (it, k) { it.classList.toggle("on", k === i); });
    var c = capOf(items[i]);
    $(".fig", whyCap).textContent = c.n; $(".t", whyCap).textContent = c.t;
    whyCur.textContent = "0" + (i + 1);
  };
  whySet(0);
  var wide = matchMedia("(min-width: 901px)");
  U.onScroll.push(function (y, vh) {
    if (!wide.matches) return;
    var best = 0, bestD = Infinity;
    items.forEach(function (it, k) {
      var r = it.getBoundingClientRect();
      var d = Math.abs(r.top + r.height / 2 - vh / 2);
      if (d < bestD) { bestD = d; best = k; }
    });
    whySet(best);
  });

  /* ── IV. The site plan: while on screen it lights the three areas in turn, until the reader picks one ── */
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

  /* ── V. Six homes at one scale: each square's side is the square root of its area, in metres ── */
  var HOMES = [
    { id: "tip-2-1", name: "2+1 Daire", s: "2+1", net: 70.17, gross: 81.13 },
    { id: "tip-3-1", name: "3+1 Daire", s: "3+1", net: 123.43, gross: 141.21 },
    { id: "tip-4-1", name: "4+1 Daire", s: "4+1", net: 155.71, gross: 178.13 },
    { id: "tip-ikiz-villa", name: "4+1 İkiz Villa", s: "İkiz villa", net: 271.02, gross: 310.12, garden: 85.74 },
    { id: "tip-mustakil-villa", name: "5+1 Müstakil Villa", s: "Müstakil villa", net: 329.89, gross: 378.1 },
    { id: "tip-malikane", name: "6+1 Malikane", s: "Malikane", net: 268.35, gross: 301.8, garden: 1159.09 }
  ];
  var box = $(".scale-box"), mode = "gross", NS = "http://www.w3.org/2000/svg";
  var el = function (tag, attrs, parent) { var n = document.createElementNS(NS, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; };
  /* Each square's accessible name starts with what it shows, then says the rest. */
  var sqLabel = function (a, h, row) {
    var t = $("title", a) || el("title", {}, null);
    t.textContent = h.name + ": brüt " + fmt2.format(h.gross) + " m², net " + fmt2.format(h.net) + " m²" + (h.garden ? ", tahsisli bahçe " + fmt2.format(h.garden) + " m²" : "") + ". Planına gidin.";
    if (!t.parentNode) a.insertBefore(t, a.firstChild);
  };
  var drawScale = function () {
    if (!box) return;
    var W = box.clientWidth;
    if (!W) return;
    box.innerHTML = "";
    var row = W >= 640, gap = 4, label = row ? 46 : 0;
    var maxH = Math.sqrt(1159.09);
    var widthM = HOMES.reduce(function (a, h) { return a + Math.sqrt(h.gross) + (h.garden ? Math.sqrt(h.garden) : 0); }, 0) + gap * (HOMES.length - 1);
    var px, H;
    if (row) { px = W / widthM; H = maxH * px + label + 36; }
    else { px = (W - 120) / (Math.sqrt(301.8) + Math.sqrt(1159.09)); H = HOMES.reduce(function (a, h) { return a + Math.max(Math.sqrt(h.gross), h.garden ? Math.sqrt(h.garden) : 0) * px + 22; }, 0) + 40; }
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "group", "aria-label": "Altı konut tipinin alanları aynı ölçekte" });
    var base = row ? maxH * px : 0;
    /* A metre grid behind the drawing, every tenth line stronger. */
    var g = el("g", { "aria-hidden": "true" }, svg);
    var gh = row ? base : H - 40;
    for (var m = 0; m * px <= W; m++) {
      el("line", { x1: m * px, x2: m * px, y1: 0, y2: gh, class: m % 10 ? "grid-m" : "grid-10" }, g);
    }
    for (var n = 0; n * px <= gh; n++) {
      var yy = row ? base - n * px : n * px;
      el("line", { x1: 0, x2: W, y1: yy, y2: yy, class: n % 10 ? "grid-m" : "grid-10" }, g);
    }
    if (row) el("line", { x1: 0, x2: W, y1: base, y2: base, class: "base" }, g);
    var x = 0, y = 0;
    HOMES.forEach(function (h) {
      var s = Math.sqrt(h.gross) * px, gs = h.garden ? Math.sqrt(h.garden) * px : 0;
      var a = el("a", { href: "#" + h.id, class: "sq" }, svg);
      var top = row ? base - s : y, gx = x + s;
      var rowH = Math.max(s, gs);
      if (!row) top = y + rowH - s;
      if (gs) el("rect", { class: "g", x: gx, y: row ? base - gs : y + rowH - gs, width: gs, height: gs }, a);
      var r = el("rect", { class: "h", x: x, y: top, width: s, height: s }, a);
      r.style.setProperty("--k", mode === "net" ? Math.sqrt(h.net / h.gross).toFixed(4) : 1);
      var tx = row ? x : x + s + gs + 12, ty = row ? base + 20 : y + rowH / 2 - 2;
      var t1 = el("text", { x: tx, y: ty, class: "t1" }, a); t1.textContent = row ? h.s : h.name;
      var t2 = el("text", { x: tx, y: ty + 16, class: "t2" }, a); t2.textContent = fmt2.format(mode === "net" ? h.net : h.gross) + " m²";
      if (gs) {
        var gTop = row ? base - gs : y + rowH - gs, inside = gs > 130;
        var t3 = row || inside ? el("text", { x: inside ? gx + 6 : gx, y: inside ? gTop + 15 : gTop - 6, class: "tg" }, a) : el("text", { x: tx, y: ty + 32, class: "tg" }, a);
        t3.textContent = "bahçe " + fmt2.format(h.garden) + " m²";
      }
      sqLabel(a, h, row);
      a.addEventListener("click", function (e) { var t = document.getElementById(h.id); if (!t) return; e.preventDefault(); U.scrollTo(t, -(U.$("#hdr").offsetHeight + 20)); });
      if (row) x += s + gs + gap * px; else y += rowH + 22;
    });
    /* Scale bar: ten metres. */
    var bar = el("g", { class: "bar", "aria-hidden": "true", transform: "translate(" + (W - 10 * px - 2) + " " + (H - 14) + ")" }, svg);
    el("line", { x1: 0, x2: 10 * px, y1: 0, y2: 0 }, bar); el("line", { x1: 0, x2: 0, y1: -5, y2: 5 }, bar); el("line", { x1: 5 * px, x2: 5 * px, y1: -3, y2: 3 }, bar); el("line", { x1: 10 * px, x2: 10 * px, y1: -5, y2: 5 }, bar);
    var bt = el("text", { x: 0, y: -10 }, bar); bt.textContent = "0";
    var bt2 = el("text", { x: 10 * px, y: -10, "text-anchor": "end" }, bar); bt2.textContent = "10 m";
    box.appendChild(svg);
  };
  $$(".scale-seg button").forEach(function (b) {
    b.addEventListener("click", function () {
      mode = b.dataset.k;
      $$(".scale-seg button").forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
      $$(".sq", box).forEach(function (a, i) {
        var h = HOMES[i];
        $("rect.h", a).style.setProperty("--k", mode === "net" ? Math.sqrt(h.net / h.gross).toFixed(4) : 1);
        $(".t2", a).textContent = fmt2.format(mode === "net" ? h.net : h.gross) + " m²";
        sqLabel(a, h, box.clientWidth >= 640);
      });
    });
  });
  var lastW = 0;
  U.onLayout.push(function () { if (box && box.clientWidth !== lastW) { lastW = box.clientWidth; drawScale(); } });

  /* ── V. The plan plates: variants and floors switch in place; "Tam ekran" opens the sheet with its tabs ── */
  var sheet = function (key, w, h, label, cap) { return { src: A + "img/levan--plan--" + key + ".webp", w: w, h: h, label: label, cap: cap || label + " kat planı" }; };
  var floors = function (base, name) { return [sheet(base + "-zemin", 1600, 960, "Zemin kat"), sheet(base + "-1-kat", 1600, 960, "1. kat"), sheet(base + "-bodrum", 1600, 960, "Bodrum")]; };
  var UNITS = [
    { title: "2+1 Daire", sheets: [sheet("2-1-a", 1600, 918, "2+1 A"), sheet("2-1-b", 1600, 918, "2+1 B"), sheet("2-1-c", 1600, 918, "2+1 C")] },
    { title: "3+1 Daire", sheets: [sheet("3-1-a", 1600, 918, "3+1 A"), sheet("3-1-b", 1600, 918, "3+1 B"), sheet("3-1-c", 1600, 918, "3+1 C")] },
    { title: "4+1 Daire", sheets: [sheet("4-1", 1600, 918, "4+1")] },
    { title: "4+1 İkiz Villa", sheets: floors("ikiz") },
    { title: "5+1 Müstakil Villa", sheets: floors("mustakil") },
    { title: "6+1 Malikane", sheets: [sheet("malikane", 1600, 1194, "6+1")] }
  ];
  $$(".type").forEach(function (art) {
    var u = UNITS[+art.dataset.unit], at = 0;
    var img = $(".type-frame img", art), tc = $(".tc", art), tabs = $$(".type-tabs button", art), gos = $$(".sheet-go", art);
    var show = function (i) {
      if (i === at) return;
      at = i;
      var s = u.sheets[i];
      tabs.forEach(function (b, k) { b.setAttribute("aria-pressed", k === i); });
      gos.forEach(function (a) { if (+a.dataset.sheet === i) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); });
      tc.textContent = s.cap;
      var swap = function () { img.src = s.src; img.width = s.w; img.height = s.h; img.alt = u.title + ", " + s.cap; img.onload = function () { img.classList.remove("fade"); }; };
      if (U.reduced) { swap(); return; }
      img.classList.add("fade");
      setTimeout(swap, 200);
    };
    if (gos.length) gos[0].setAttribute("aria-current", "true");
    tabs.forEach(function (b) { b.addEventListener("click", function () { show(+b.dataset.sheet); }); });
    gos.forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        show(+a.dataset.sheet);
        var r = $(".type-frame", art).getBoundingClientRect();
        if (r.top < 60 || r.bottom > innerHeight) U.scrollTo($(".type-plate", art), -(innerHeight * 0.12));
      });
    });
    $(".type-full", art).addEventListener("click", function (e) { U.openPlan({ title: u.title, sheets: u.sheets, start: at }, e.currentTarget); });
  });
  /* The index beside the plates marks the type being read. */
  var tlinks = $$(".types-idx a"), tarts = tlinks.map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); }), tAt = -1;
  U.onScroll.push(function (y, vh) {
    var c = -1;
    tarts.forEach(function (s, i) { if (s.getBoundingClientRect().top < vh * 0.5) c = i; });
    if (c === tAt) return;
    tAt = c;
    tlinks.forEach(function (a, i) { a.classList.toggle("cur", i === c); if (i === c) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current"); });
  });

  /* ── VI. The amenity index points to its plates by number ── */
  $$(".amen-idx li[data-ref]").forEach(function (li) {
    var p = document.getElementById(li.dataset.ref);
    if (!p) return;
    var n = $(".fig", p).textContent.match(/\d+/)[0];
    $(".ref", li).textContent = "Lv. " + n;
    var a = $("a", li);
    var on = function () { p.classList.add("hl"); }, off = function () { p.classList.remove("hl"); };
    a.addEventListener("pointerenter", on); a.addEventListener("pointerleave", off);
    a.addEventListener("focus", on); a.addEventListener("blur", off);
  });

  /* ── VII. 360° tours: placed on a true time axis; Kuula loads only after "start" ── */
  var T0 = Date.UTC(2025, 11, 1), T1 = Date.UTC(2026, 6, 1);
  var pos = function (d) { return (d - T0) / (T1 - T0); };
  var months = $(".axis-months");
  if (months) {
    var MN = ["Ara", "Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem"];
    for (var i = 0; i < 7; i++) {
      var li = document.createElement("li");
      li.style.setProperty("--t", pos(Date.UTC(2025, 11 + i, 1)).toFixed(4));
      li.textContent = MN[i] + (i === 0 ? " 2025" : i === 1 ? " 2026" : "");
      months.appendChild(li);
    }
  }
  var dateBtns = $$(".tour-dates button");
  dateBtns.forEach(function (b) {
    var d = b.dataset.date.split("-");
    b.parentElement.style.setProperty("--t", pos(Date.UTC(+d[0], +d[1] - 1, +d[2])).toFixed(4));
  });
  var stage = $(".tour-stage"), when = $(".tour-when time"), sel = $(".tour-sel"), tab = $(".tour-tab");
  var url = function (id) { return "https://kuula.co/share/collection/" + id + "?logo=1&info=0&fs=1&vr=0&initload=1&autorotate=0.1&thumbs=1"; };
  var tourAt = dateBtns.length - 1;
  var label = function (b) { return $("time", b).textContent; };
  var load = function () {
    var b = dateBtns[tourAt], f = $("iframe", stage);
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
      sel.textContent = label(b);
      tab.href = url(b.dataset.id);
      if (stage.classList.contains("live")) load();
    });
  });

  U.layout();
})();
