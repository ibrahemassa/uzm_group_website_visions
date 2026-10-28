/* A-00 · Cover sheet: the film dialog, the lens, Section A–A, the area scale, the sun study, the legend, revisions. */
(function () {
  var U = window.UZM, $ = U.$, $$ = U.$$, clamp = U.clamp, reduced = U.reduced, fine = U.fine;
  var SVGNS = "http://www.w3.org/2000/svg";
  var el = function (tag, attrs, parent) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };

  /* Film dialog */
  var film = $("#film"), filmVid = $("#filmVid");
  $("#filmOpen").addEventListener("click", function (e) {
    if (!filmVid.src) filmVid.src = U.assets + "video/levan-film-1920.mp4";
    U.open(film, e.currentTarget);
    try { filmVid.currentTime = 0; } catch (x) {}
    var p = filmVid.play(); if (p && p.catch) p.catch(function () {});
  });
  film.addEventListener("close", function () { filmVid.pause(); });

  /* 04 · Section A–A: the drawing advances with the step in the middle of the screen. */
  (function () {
    var svg = $("#ksSvg"), groups = $$("g[data-s]", svg), steps = $$(".ks-step"), cap = $("#ksCap");
    var active = -1;
    var set = function (n) {
      if (n === active) return;
      active = n;
      groups.forEach(function (g) { var s = +g.dataset.s; g.classList.toggle("on", s <= n); g.classList.toggle("cur", s === n && n > 0); });
      steps.forEach(function (s) { s.classList.toggle("cur", +s.dataset.s === n); });
      var st = steps.filter(function (s) { return +s.dataset.s === n; })[0];
      if (st) cap.textContent = st.dataset.cap;
    };
    if (reduced) { set(7); steps.forEach(function (s) { s.classList.add("cur"); }); return; }
    new IntersectionObserver(function (es) { if (es[0].isIntersecting && active < 0) set(0); }, { threshold: 0.15 }).observe(svg);
    var line = matchMedia("(max-width: 63.99rem)").matches ? "-64% 0px -34% 0px" : "-48% 0px -48% 0px";
    var so = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) set(+e.target.dataset.s); }); }, { rootMargin: line });
    steps.forEach(function (s) { so.observe(s); });
  })();

  /* 05 · Area scale. Every square's area equals the type's published net area (1 m = S px); the flats' range is the
     solid (smallest plan) and dashed (largest plan) square; a garden appears beside its home, hatched. */
  (function () {
    var T = [
      { n: "2+1 Daire", net: [64.83, 70.17], gross: [73.83, 81.13], garden: 0, sheets: "3 plan · A, B, C", blurb: "Yeni başlangıçlar için: ferah, kullanışlı ve bahçe yaşamına açık." },
      { n: "3+1 Daire", net: [113.07, 123.43], gross: [127.93, 141.21], garden: 0, sheets: "3 plan · A, B, C", blurb: "Aile yaşamına göre kurgulanmış geniş salonlar ve ebeveyn banyosu." },
      { n: "4+1 Daire", net: [155.71], gross: [178.13], garden: 0, sheets: "1 plan", blurb: "Kalabalık aileler için cömert metrekare, gün ışığı ve geniş balkonlar." },
      { n: "4+1 İkiz Villa", net: [271.02], gross: [310.12], garden: 85.74, sheets: "3 kat · bodrum, zemin, 1. kat", blurb: "Bodrum, zemin ve birinci kattan oluşan yaşam; özel bahçe." },
      { n: "5+1 Müstakil Villa", net: [329.89], gross: [378.1], garden: 0, sheets: "3 kat · bodrum, zemin, 1. kat", blurb: "Kendi bahçesi ve kendi kapısıyla; gökyüzüyle arada engel yok." },
      { n: "6+1 Malikane", net: [268.35], gross: [301.8], garden: 1159.09, sheets: "1 plan", blurb: "Levan'ın zirvesi: geniş tahsisli bahçesiyle." }
    ];
    var svg = $(".as-svg"); if (!svg) return;
    var S = 11, X0 = 60, Y0 = 420;
    var m2 = function (a) { return a.map(function (v) { return U.fmt2.format(v); }).join("–") + " m²"; };
    var side = function (a) { return Math.sqrt(a) * S; };
    var gGrid = $(".as-grid", svg), gGarden = $(".as-garden", svg), gGh = $(".as-ghosts", svg), gCur = $(".as-cur", svg), gScale = $(".as-scale", svg);
    /* 1 m grid, bolder every 5 m */
    for (var i = 0; i <= 52; i++) el("line", { x1: X0 + i * S, y1: Y0, x2: X0 + i * S, y2: Y0 - 36 * S, "class": i % 5 ? "" : "mj" }, gGrid);
    for (var j = 0; j <= 36; j++) el("line", { x1: X0, y1: Y0 - j * S, x2: X0 + 52 * S, y2: Y0 - j * S, "class": j % 5 ? "" : "mj" }, gGrid);
    /* scale bar: 0 · 5 · 10 m */
    el("path", { d: "M" + X0 + " " + (Y0 + 18) + "h" + 10 * S + "M" + X0 + " " + (Y0 + 13) + "v10M" + (X0 + 5 * S) + " " + (Y0 + 15) + "v6M" + (X0 + 10 * S) + " " + (Y0 + 13) + "v10" }, gScale);
    [[0, "0"], [5, "5"], [10, "10 m"]].forEach(function (t) { var tx = el("text", { x: X0 + t[0] * S, y: Y0 + 36, "text-anchor": "middle", "class": "t-s" }, gScale); tx.textContent = t[1]; });
    var note = el("text", { x: X0 + 12 * S, y: Y0 + 22, "class": "t-s" }, gScale); note.textContent = "EŞ ALANLI KARELER · TEK ÖLÇEK";
    /* ghosts: every type's smallest net square, nested at the origin */
    var dy = [12, 12, 12, 12, 12, 27];
    var ghosts = T.map(function (t, k) {
      var s = side(t.net[0]);
      var g = el("g", { "class": "as-gh" }, gGh);
      el("rect", { x: X0, y: Y0 - s, width: s, height: s }, g);
      var tx = el("text", { x: X0 + s - 5, y: Y0 - s + dy[k], "text-anchor": "end" }, g); tx.textContent = "K-0" + (k + 1);
      return g;
    });
    var rMax = el("rect", { "class": "max" }, gCur), rMin = el("rect", { "class": "min" }, gCur);
    var lab = el("g", {}, gCur), labBg = el("rect", { fill: "#0c1622" }, lab), lab1 = el("text", { "class": "k" }, lab), lab2 = el("text", { "class": "t-s" }, lab);
    var gRect = el("rect", {}, gGarden), gText = el("text", { "class": "t-s" }, gGarden);
    var setRect = function (r, x, y, w, h) {
      r.setAttribute("x", x); r.setAttribute("y", y); r.setAttribute("width", w); r.setAttribute("height", h);
    };
    var draw = function (r) {
      if (reduced) return;
      var len = Math.round((+r.getAttribute("width") + +r.getAttribute("height")) * 2);
      r.style.setProperty("--len", len); r.style.strokeDasharray = r.classList.contains("max") ? "" : len;
      r.classList.remove("as-draw"); void r.getBoundingClientRect(); r.classList.add("as-draw");
    };
    var tabs = $$(".as-tabs [role=tab]"), panel = $("#as-panel");
    var cur = -1;
    var show = function (i, focus) {
      if (i === cur) return;
      cur = i;
      var t = T[i], s0 = side(t.net[0]), s1 = side(t.net[t.net.length - 1]);
      tabs.forEach(function (b, k) { b.setAttribute("aria-selected", String(k === i)); b.tabIndex = k === i ? 0 : -1; });
      panel.setAttribute("aria-labelledby", tabs[i].id);
      if (focus) tabs[i].focus();
      ghosts.forEach(function (g, k) { g.style.opacity = k === i ? 0 : 1; });
      setRect(rMin, X0, Y0 - s0, s0, s0);
      if (t.net.length > 1) { setRect(rMax, X0, Y0 - s1, s1, s1); rMax.style.display = ""; } else rMax.style.display = "none";
      draw(rMin);
      /* label above the square */
      var ly = Y0 - s1 - 30;
      lab1.setAttribute("x", X0 + 6); lab1.setAttribute("y", ly + 12); lab1.textContent = "K-0" + (i + 1) + " · " + t.n.toUpperCase();
      lab2.setAttribute("x", X0 + 6); lab2.setAttribute("y", ly + 25); lab2.textContent = "NET " + m2(t.net);
      var bw = Math.max(lab1.getComputedTextLength(), lab2.getComputedTextLength()) + 12;
      setRect(labBg, X0, ly, bw, 31);
      if (t.garden) {
        var gs = side(t.garden), gx = X0 + s1 + 8;
        setRect(gRect, gx, Y0 - gs, gs, gs);
        gText.setAttribute("x", gx + 6); gText.setAttribute("y", Y0 - gs - 8); gText.textContent = "TAHSİSLİ BAHÇE " + U.fmt2.format(t.garden) + " m²";
        gGarden.style.display = "";
      } else gGarden.style.display = "none";
      $(".as-t").textContent = t.n;
      $(".as-net").textContent = m2(t.net);
      $(".as-gross").textContent = m2(t.gross);
      $(".as-garden-v").textContent = t.garden ? U.fmt2.format(t.garden) + " m²" : "—";
      $(".as-sheets").textContent = t.sheets;
      $(".as-blurb").textContent = t.blurb;
      $(".as-link").href = U.root + "projeler/levan-bahcesehir/index.html#k-0" + (i + 1);
      if (matchMedia("(max-width: 63.99rem)").matches) tabs[i].scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduced ? "auto" : "smooth" });
    };
    tabs.forEach(function (b, k) { b.addEventListener("click", function () { show(k); }); });
    $(".as-tabs").addEventListener("keydown", function (e) {
      var d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (d) { e.preventDefault(); show((cur + d + T.length) % T.length, true); }
      if (e.key === "Home") { e.preventDefault(); show(0, true); }
      if (e.key === "End") { e.preventDefault(); show(T.length - 1, true); }
    });
    show(0);
  })();

  /* 06 · Sun study: the moments of the day sit on a time axis (06–21); the sun walks the arc between them. */
  (function () {
    var sun = $("#sun"); if (!sun) return;
    var svg = $(".sun-svg", sun), ticks = $(".sun-ticks", svg), leads = $(".sun-leads", svg), dot = $(".sun-dot", svg);
    var X = function (t) { return 60 + (t - 6) * 72; };
    var Y = function (t) { var u = (X(t) - 60) / 1080; return 230 - 760 * u * (1 - u); };
    for (var h = 6; h <= 21; h++) {
      el("line", { x1: X(h), y1: 230, x2: X(h), y2: h % 3 ? 236 : 240 }, ticks);
      if (h % 3 === 0) { var tx = el("text", { x: X(h), y: 258, "text-anchor": "middle" }, ticks); tx.textContent = (h < 10 ? "0" : "") + h + ".00"; }
    }
    var items = $$(".sun-row li", sun);
    var marks = items.map(function (li) {
      var t = +li.dataset.t, g = el("g", {}, leads);
      el("line", { x1: X(t), y1: Y(t) + 8, x2: X(t), y2: 230 }, g);
      el("circle", { cx: X(t), cy: Y(t), r: 5 }, g);
      var tx = el("text", { x: X(t), y: Y(t) - 16, "text-anchor": "middle" }, g); tx.textContent = $("b", li).textContent;
      return g;
    });
    var st = 6, raf = 0, auto = null, at = -1;
    var put = function (t) { st = t; dot.setAttribute("transform", "translate(" + X(t).toFixed(1) + " " + Y(t).toFixed(1) + ")"); };
    put(6);
    var go = function (i) {
      at = i;
      items.forEach(function (li, k) { li.classList.toggle("on", k === i); });
      marks.forEach(function (g, k) { g.classList.toggle("on", k === i); });
      var to = +items[i].dataset.t, from = st, t0 = performance.now(), D = reduced ? 0 : 900 + Math.abs(to - from) * 90;
      cancelAnimationFrame(raf);
      (function step(now) {
        var k = D ? Math.min(1, (now - t0) / D) : 1, e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        put(from + (to - from) * e);
        if (k < 1) raf = requestAnimationFrame(step);
      })(t0);
    };
    var cycle = function () { clearInterval(auto); if (reduced) { go(0); return; } go((at + 1) % items.length); auto = setInterval(function () { go((at + 1) % items.length); }, 3600); };
    var seen = false;
    new IntersectionObserver(function (es) {
      seen = es[0].isIntersecting;
      if (seen) cycle(); else clearInterval(auto);
    }, { threshold: 0.35 }).observe(sun);
    items.forEach(function (li, k) {
      li.addEventListener("pointerenter", function () { clearInterval(auto); go(k); });
      li.addEventListener("pointerleave", function () { if (seen && !reduced) auto = setInterval(function () { go((at + 1) % items.length); }, 3600); });
    });
  })();

  /* 06 · Legend: hovering an amenity that has a picture floats it beside the pointer. */
  (function () {
    var pv = $(".lg-pv"), inner = $(".lg-pv-in");
    if (!pv || !fine) return;
    $$(".legend li[data-img]").forEach(function (li) {
      li.addEventListener("pointerenter", function () { inner.style.backgroundImage = "url(" + U.assets + "img/" + li.dataset.img + ".webp)"; pv.classList.add("on"); });
      li.addEventListener("pointermove", function (e) { pv.style.setProperty("--x", e.clientX + 24 + "px"); pv.style.setProperty("--y", e.clientY - 120 + "px"); });
      li.addEventListener("pointerleave", function () { pv.classList.remove("on"); });
    });
    addEventListener("scroll", function () { pv.classList.remove("on"); }, { passive: true });
  })();

  /* 08 · Revisions: hovering a row shows its photograph beside the table. */
  (function () {
    var rev = $(".rev"), pv = $(".rev-pv");
    if (!rev || !fine) return;
    $$(".rev-i", rev).forEach(function (li) {
      var img = $(".rev-ph img", li);
      li.addEventListener("pointerenter", function () {
        pv.style.backgroundImage = "url(" + img.getAttribute("src") + ")";
        var y = li.offsetTop + li.offsetHeight / 2 - pv.offsetHeight / 2;
        pv.style.setProperty("--y", clamp(y, 0, rev.offsetHeight - pv.offsetHeight) + "px");
        pv.classList.add("on");
      });
    });
    rev.addEventListener("pointerleave", function () { pv.classList.remove("on"); });
  })();
})();
