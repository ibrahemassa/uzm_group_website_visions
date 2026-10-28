/* Home: the signature stroke, the procession of six homes, the amenities preview, the sun's arc, the chronograph and
   the diary scrubber. */
(function () {
  var U = window.UZM, $ = U.$, $$ = U.$$, clamp = U.clamp;
  var A = U.assets, motion = document.documentElement.classList.contains("motion");

  /* ── The signature: one stroke from the house's seal down to the invitation's seal, which it presses ── */
  var seal = $("#invite-seal");
  // Phones skip the stroke: their single column leaves it no margin to run in without crossing the text.
  if (seal && matchMedia("(min-width: 761px)").matches) {
    seal.dataset.ink = "c,0.04";
    document.body.classList.add("inked");
    U.ink($("#icerik"), { at: 0.62, onEnd: function () { seal.classList.add("pressed"); } });
    if (U.reduced) seal.classList.add("pressed");
  }

  /* ── III. The collection. Areas as levan.com.tr publishes them; the villas' plans come as three floors. ── */
  var sheet = function (key, w, h, label) { return { src: A + "img/levan--plan--" + key + ".webp", w: w, h: h, label: label }; };
  var flat = function (keys) { return keys.map(function (k) { return sheet(k[0], 1600, 918, k[1]); }); };
  var floors = function (base) { return [sheet(base + "-zemin", 1600, 960, "Zemin kat"), sheet(base + "-1-kat", 1600, 960, "1. kat"), sheet(base + "-bodrum", 1600, 960, "Bodrum")]; };
  var TYPES = [
    { kind: "Daire", name: "2+1 Daire", blurb: "Yeni başlangıçlar için: ferah, kullanışlı ve bahçe yaşamına açık.", net: "64,83 – 70,17", gross: "73,83 – 81,13", garden: null, sheets: flat([["2-1-a", "2+1 A"], ["2-1-b", "2+1 B"], ["2-1-c", "2+1 C"]]) },
    { kind: "Daire", name: "3+1 Daire", blurb: "Aile yaşamına göre kurgulanmış geniş salonlar ve ebeveyn banyosu.", net: "113,07 – 123,43", gross: "127,93 – 141,21", garden: null, sheets: flat([["3-1-a", "3+1 A"], ["3-1-b", "3+1 B"], ["3-1-c", "3+1 C"]]) },
    { kind: "Daire", name: "4+1 Daire", blurb: "Kalabalık aileler için cömert metrekare, gün ışığı ve geniş balkonlar.", net: "155,71", gross: "178,13", garden: null, sheets: flat([["4-1", "4+1"]]) },
    { kind: "Villa", name: "4+1 İkiz Villa", blurb: "Bodrum, zemin ve birinci kattan oluşan yaşam; özel bahçe.", net: "271,02", gross: "310,12", garden: "85,74", sheets: floors("ikiz") },
    { kind: "Villa", name: "5+1 Müstakil Villa", blurb: "Kendi bahçesi ve kendi kapısıyla; gökyüzüyle arada engel yok.", net: "329,89", gross: "378,10", garden: null, sheets: floors("mustakil") },
    { kind: "Malikane", name: "6+1 Malikane", blurb: "Levan'ın zirvesi: geniş tahsisli bahçesiyle.", net: "268,35", gross: "301,80", garden: "1.159,09", sheets: [sheet("malikane", 1600, 1194, "6+1")] }
  ];
  var coll = $(".coll"), run = $(".coll-run"), stage = $(".coll-stage"), cas = $$(".ca");
  var tabs = $$(".col-tabs [role=tab]"), tabsBox = $(".col-tabs");
  var rollSpans = $$(".col-num .roll span"), kindEl = $(".col-kind"), nameEl = $(".col-name"), blurbEl = $(".col-blurb");
  var netEl = $(".sp-net"), grossEl = $(".sp-gross"), gardenEl = $(".sp-garden");
  var cur = -1;

  /* Areas count from the last type's figures to the new ones ("64,83 – 70,17": each end on its own). */
  var nf2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var parse = function (s) { return s ? s.split(" – ").map(function (x) { return parseFloat(x.replace(/\./g, "").replace(",", ".")); }) : null; };
  var counters = new Map();
  var setArea = function (el, from, to) {
    var stop = counters.get(el); if (stop) stop();
    if (!to) { el.innerHTML = "—"; return; }
    var a = parse(from), b = parse(to), out = function (v) { return v.map(function (n) { return nf2.format(n); }).join(" – ") + "<small>m²</small>"; };
    if (U.reduced || !a) { el.innerHTML = to + "<small>m²</small>"; return; }
    var t0 = performance.now(), D = 900, live = true;
    counters.set(el, function () { live = false; });
    (function tick(t) {
      if (!live) return;
      var k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3);
      el.innerHTML = k < 1 ? out(b.map(function (n, i) { var s = a[Math.min(i, a.length - 1)]; return s + (n - s) * e; })) : to + "<small>m²</small>";
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  };
  var show = function (i, focusTab) {
    i = clamp(i, 0, TYPES.length - 1);
    if (i === cur) return;
    var t = TYPES[i], prev = cur >= 0 ? TYPES[cur] : null;
    cas.forEach(function (c, k) { c.classList.toggle("on", k === i); });
    tabs.forEach(function (b, k) { b.setAttribute("aria-selected", k === i); b.tabIndex = k === i ? 0 : -1; });
    if (focusTab) tabs[i].focus({ preventScroll: true });
    tabsBox.style.setProperty("--ti", i);
    rollSpans.forEach(function (s) { s.style.setProperty("--i", i); });
    kindEl.textContent = t.kind; nameEl.innerHTML = t.name.replace("+", '<span class="pl">+</span>'); blurbEl.textContent = t.blurb;
    setArea(netEl, prev && prev.net, t.net); setArea(grossEl, prev && prev.gross, t.gross); setArea(gardenEl, prev && prev.garden, t.garden);
    $(".col-prev").disabled = i === 0; $(".col-next").disabled = i === TYPES.length - 1;
    var on = tabs[i];
    if (tabsBox.scrollWidth > tabsBox.clientWidth + 2) tabsBox.scrollTo({ left: on.offsetLeft - 24, behavior: U.reduced ? "auto" : "smooth" });
    cur = i;
  };

  /* Two ways to travel. Pinned (wide screen, motion): the page holds still and scrolling walks you along the doorways.
     Otherwise: a rail of arches you swipe, the one in the middle being the one described. */
  var pinMQ = matchMedia("(min-width: 901px) and (min-height: 620px)");
  var pinned = false, runTop = 0, runH = 0, cw = 0, lastF = -1;
  var setMode = function () {
    var p = motion && pinMQ.matches;
    if (p === pinned && coll.dataset.mode) return;
    pinned = p; coll.dataset.mode = p ? "pin" : "rail";
    coll.classList.toggle("pinned", p);
    cas.forEach(function (c) { c.style.transform = c.style.opacity = c.style.zIndex = c.style.visibility = ""; });
    lastF = -1;
  };
  var place = function (f) {
    cas.forEach(function (c, i) {
      var d = i - f, x, s, a;
      if (d < 0) { x = d * cw * 0.12; s = 1 - d * 0.3; a = clamp(1 + d * 2.4, 0, 1); }
      else { x = d * cw * 0.84; s = Math.max(0.55, 1 - d * 0.13); a = clamp(1 - d * 0.26, 0, 1); }
      c.style.transform = "translate3d(" + x.toFixed(1) + "px,0,0) scale(" + s.toFixed(4) + ")";
      c.style.opacity = a.toFixed(3);
      c.style.zIndex = 20 - i;
      c.style.visibility = a < 0.01 ? "hidden" : "";
    });
  };
  U.onLayout.push(function () {
    setMode();
    var r = run.getBoundingClientRect();
    runTop = r.top + scrollY; runH = run.offsetHeight; cw = cas[0].offsetWidth;
    lastF = -1;
  });
  U.onScroll.push(function (y, vh) {
    if (!pinned) return;
    var span = runH - vh;
    var g = clamp((y - runTop) / Math.max(1, span), 0, 1) * (TYPES.length - 1);
    /* Each doorway holds still for a moment before the next steps forward. */
    var fl = Math.min(Math.floor(g), TYPES.length - 2), fr = g - fl;
    var f = fl + U.ease(clamp((fr - 0.35) / 0.65, 0, 1));
    if (Math.abs(f - lastF) < 0.002) return;
    lastF = f;
    place(f);
    show(Math.round(f));
  });
  var railSync = function () {
    if (pinned) return;
    var mid = stage.scrollLeft + stage.clientWidth / 2, best = 0, bd = Infinity;
    cas.forEach(function (c, i) { var d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid); if (d < bd) { bd = d; best = i; } });
    show(best);
  };
  var railTick = false;
  stage.addEventListener("scroll", function () { if (!railTick) { railTick = true; requestAnimationFrame(function () { railTick = false; railSync(); }); } }, { passive: true });
  var go = function (i, focusTab) {
    i = clamp(i, 0, TYPES.length - 1);
    if (pinned) {
      U.scrollTo(runTop + (i / (TYPES.length - 1)) * (runH - innerHeight) + 1);
      show(i, focusTab);
    } else {
      var c = cas[i];
      stage.scrollTo({ left: c.offsetLeft - (stage.clientWidth - c.offsetWidth) / 2, behavior: U.reduced ? "auto" : "smooth" });
      show(i, focusTab);
    }
  };
  tabs.forEach(function (b, k) {
    b.addEventListener("click", function () { go(k); });
    b.addEventListener("keydown", function (e) {
      var to = { ArrowRight: cur + 1, ArrowLeft: cur - 1, Home: 0, End: TYPES.length - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      go(to, true);
    });
  });
  $(".col-prev").addEventListener("click", function () { go(cur - 1); });
  $(".col-next").addEventListener("click", function () { go(cur + 1); });
  $(".col-plan").addEventListener("click", function (e) { U.openPlan({ title: TYPES[cur].name, sheets: TYPES[cur].sheets }, e.currentTarget); });
  cas.forEach(function (c, i) { c.addEventListener("click", function () { if (i !== cur) go(i); }); });
  /* Drag the rail with a mouse. */
  if (U.fine) {
    var down = false, sx = 0, sl = 0, moved = false;
    stage.addEventListener("pointerdown", function (e) { if (pinned || e.pointerType !== "mouse") return; down = true; moved = false; sx = e.clientX; sl = stage.scrollLeft; stage.style.scrollSnapType = "none"; });
    addEventListener("pointermove", function (e) { if (!down) return; var dx = e.clientX - sx; if (Math.abs(dx) > 4) moved = true; stage.scrollLeft = sl - dx; });
    addEventListener("pointerup", function () { if (!down) return; down = false; stage.style.scrollSnapType = ""; if (moved) go(cur); });
    stage.addEventListener("click", function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    stage.addEventListener("dragstart", function (e) { e.preventDefault(); });
  }
  setMode();
  show(0);

  /* ── IV. The sun crosses the day's arc as the section is read; the moment nearest it is lit ── */
  var day = $(".day"), arcP = $(".da-lit"), arcSvg = $(".day-arc"), sun = $(".sun"), dayFigs = $$(".day-f");
  var dayTop = 0, dayH = 0, arcBox = null, figX = [], arcLen = arcP.getTotalLength(), lastT = -1, dayOn = false;
  U.onLayout.push(function () {
    var r = day.getBoundingClientRect();
    dayTop = r.top + scrollY; dayH = day.offsetHeight;
    dayOn = getComputedStyle(sun).display !== "none";
    var ar = arcSvg.getBoundingClientRect();
    arcBox = { x: ar.left - r.left, y: ar.top - r.top, w: ar.width, h: ar.height };
    figX = dayFigs.map(function (f) { return f.offsetLeft + f.offsetWidth / 2; });
    lastT = -1;
  });
  U.onScroll.push(function (y, vh) {
    if (!dayOn) return;
    var start = dayTop - vh * 0.75, end = dayTop + dayH - vh * 0.45;
    var t = U.reduced ? 0.5 : clamp((y - start) / Math.max(1, end - start), 0, 1);
    if (Math.abs(t - lastT) < 0.001) return;
    lastT = t;
    var p = arcP.getPointAtLength(t * arcLen);
    var x = arcBox.x + (p.x / 1000) * arcBox.w, yy = arcBox.y + (p.y / 500) * arcBox.h;
    sun.style.setProperty("--sx", x.toFixed(1) + "px"); sun.style.setProperty("--sy", yy.toFixed(1) + "px");
    day.style.setProperty("--t", t.toFixed(4));
    var lit = 0, bd = Infinity;
    figX.forEach(function (fx, i) { var d = Math.abs(fx - x); if (d < bd) { bd = d; lit = i; } });
    day.classList.toggle("running", t > 0 && t < 1);
    dayFigs.forEach(function (f, i) { f.classList.toggle("lit", i === lit); });
  });

  /* ── IV. Amenities: the picture comes to the cursor ── */
  var list = $(".amen-list"), prev = $(".amen-preview"), prevArch = $(".amen-preview .arch");
  if (U.fine) {
    var imgs = {};
    var px = -400, py = -400, tx = px, ty = py, running = false, active = null;
    var loop = function () {
      px += (tx - px) * 0.14; py += (ty - py) * 0.14;
      prev.style.setProperty("--x", (px - 115).toFixed(1) + "px");
      prev.style.setProperty("--y", (py - 330).toFixed(1) + "px");
      if (active || Math.abs(tx - px) > 0.5) requestAnimationFrame(loop); else running = false;
    };
    var start = function () { if (!running) { running = true; requestAnimationFrame(loop); } };
    $$("span", list).forEach(function (sp) {
      sp.addEventListener("pointerenter", function (e) {
        list.classList.add("hovering");
        $$("span", list).forEach(function (o) { o.classList.toggle("cur", o === sp); });
        var key = sp.dataset.img;
        if (!key) { prev.classList.remove("on"); active = null; return; }
        if (!imgs[key]) {
          var im = new Image();
          im.src = A + "img/" + key + ".webp"; im.alt = ""; im.decoding = "async";
          prevArch.appendChild(im); imgs[key] = im;
        }
        Object.keys(imgs).forEach(function (k) { imgs[k].classList.toggle("on", k === key); });
        if (!active) { px = tx = e.clientX; py = ty = e.clientY; }
        active = key;
        prev.classList.add("on");
        start();
      });
    });
    list.addEventListener("pointermove", function (e) { tx = e.clientX; ty = e.clientY; start(); });
    list.addEventListener("pointerleave", function () { list.classList.remove("hovering"); prev.classList.remove("on"); active = null; });
  }

  /* ── V. The chronograph: turn the hand to the minutes you have; each ring fills toward its place and lights when
     the place is within reach. A focusable range input carries the same value for the keyboard and screen readers. ── */
  var dial = $("#dial"), dialBox = $(".loc-dial"), dialIn = $(".dial-in");
  var ticks = dial.querySelector(".ticks"), NS = U.NS;
  for (var i = 0; i < 60; i++) {
    if (i % 15 === 0) continue;
    var ang = (i / 60) * Math.PI * 2, q = i % 5 === 0, r1 = q ? 186 : 190, r2 = 198;
    var l = document.createElementNS(NS, "line");
    l.setAttribute("x1", (220 + Math.sin(ang) * r1).toFixed(2)); l.setAttribute("y1", (220 - Math.cos(ang) * r1).toFixed(2));
    l.setAttribute("x2", (220 + Math.sin(ang) * r2).toFixed(2)); l.setAttribute("y2", (220 - Math.cos(ang) * r2).toFixed(2));
    l.setAttribute("class", q ? "tick q" : "tick");
    ticks.appendChild(l);
  }
  var DEST = [{ m: 15, r: 168, n: "5. Levent" }, { m: 20, r: 146, n: "İstanbul Havalimanı" }, { m: 15, r: 124, n: "İSTOÇ" }];
  var arcs = $$(".arc", dial), goals = $$(".goal", dial), hand = $(".hand", dial), rdN = $(".rd-n", dial), rdL = $(".rd-l", dial);
  var destBtns = $$(".dests button");
  goals.forEach(function (g, k) {
    var a = DEST[k].m * 6 * Math.PI / 180;
    g.setAttribute("transform", "translate(" + (220 + Math.sin(a) * DEST[k].r).toFixed(1) + " " + (220 - Math.cos(a) * DEST[k].r).toFixed(1) + ")");
  });
  var mins = 0;
  var listNames = function (ns) { return ns.length < 2 ? ns.join("") : ns.slice(0, -1).join(", ") + " ve " + ns[ns.length - 1]; };
  var setMin = function (m) {
    mins = clamp(m, 0, 30);
    hand.style.setProperty("--deg", (mins * 6).toFixed(2) + "deg");
    var names = [];
    DEST.forEach(function (d, k) {
      var reach = mins >= d.m - 0.01;
      arcs[k].style.strokeDashoffset = (60 - Math.min(mins, d.m)).toFixed(2);
      arcs[k].classList.toggle("reach", reach);
      goals[k].classList.toggle("reach", reach);
      destBtns[k].classList.toggle("reach", reach);
      if (reach) names.push(d.n);
    });
    var n = Math.round(mins);
    rdN.textContent = n;
    rdL.textContent = n >= 20 ? "+ İSTANBUL HAVALİMANI" : n >= 15 ? "5. LEVENT · İSTOÇ" : "YOLDA";
    dialIn.value = n;
    dialIn.setAttribute("aria-valuetext", n + " dakika: " + (names.length ? listNames(names) : "henüz bir varış noktası yok"));
  };
  var sweepRaf = 0;
  var sweepTo = function (to, from) {
    cancelAnimationFrame(sweepRaf);
    if (U.reduced) { setMin(to); return; }
    var a = from === undefined ? mins : from, t0 = performance.now(), D = 500 + Math.abs(to - a) * 45;
    (function tick(t) {
      var k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3);
      setMin(a + (to - a) * e);
      if (k < 1) sweepRaf = requestAnimationFrame(tick);
    })(t0);
  };
  var press = function (k) { destBtns.forEach(function (b, j) { b.setAttribute("aria-pressed", j === k); }); };
  destBtns.forEach(function (b, k) { b.addEventListener("click", function () { press(k); sweepTo(DEST[k].m); }); });
  dialIn.addEventListener("input", function () { cancelAnimationFrame(sweepRaf); press(-1); setMin(+dialIn.value); });
  var fromPointer = function (e) {
    var r = dial.getBoundingClientRect();
    var dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    var deg = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
    var m = deg / 6;
    if (m > 30) m = m > 45 ? 0 : 30;
    return m;
  };
  var dragging = false;
  dialBox.addEventListener("pointerdown", function (e) {
    dragging = true; dialBox.classList.add("dragging"); dialBox.setPointerCapture(e.pointerId);
    cancelAnimationFrame(sweepRaf); press(-1); setMin(fromPointer(e));
  });
  dialBox.addEventListener("pointermove", function (e) { if (dragging) setMin(fromPointer(e)); });
  var endDrag = function () { if (!dragging) return; dragging = false; dialBox.classList.remove("dragging"); sweepTo(Math.round(mins)); };
  dialBox.addEventListener("pointerup", endDrag);
  dialBox.addEventListener("pointercancel", endDrag);
  setMin(15);
  if (!U.reduced) {
    setMin(0);
    var dio = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      dio.disconnect();
      setTimeout(function () { if (mins === 0) { press(0); sweepTo(15, 0); } }, 300);
    }, { threshold: 0.5 });
    dio.observe(dialBox);
  }

  /* ── VI. The diary: drag through the dates; each photograph develops at its date ── */
  var diary = $(".diary"), entries = $$(".entry", diary), scrub = $(".scrub", diary);
  var D0 = Date.parse("2026-06-18"), DAY = 864e5, SPAN = 84;
  var days = entries.map(function (e) { return Math.round((Date.parse(e.dataset.date) - D0) / DAY); });
  var track = $(".scrub-track", diary), tickBox = $(".scrub-ticks", diary), sIn = $(".scrub-in", diary), sOf = $(".scrub-of", diary);
  var dPrev = $(".diary-prev", diary), dNext = $(".diary-next", diary);
  diary.classList.add("scrub-on");
  scrub.hidden = false;
  var tickEls = days.map(function (d) {
    var s = document.createElement("span");
    s.style.left = (d / SPAN * 100) + "%";
    tickBox.appendChild(s);
    return s;
  });
  sIn.max = entries.length - 1;
  var at = -1, touched = false;
  var showEntry = function (i) {
    if (i === at) return;
    entries.forEach(function (e, k) {
      var on = k === i;
      e.classList.toggle("cur", on);
      e.inert = !on;
    });
    tickEls.forEach(function (t, k) { t.classList.toggle("past", k <= i); });
    var e = entries[i];
    sIn.value = i;
    sIn.setAttribute("aria-valuetext", $("time", e).textContent + ": " + $("h3", e).textContent);
    sOf.textContent = (i + 1) + " / " + entries.length;
    dPrev.disabled = i === 0; dNext.disabled = i === entries.length - 1;
    at = i;
  };
  var setDay = function (v) {
    v = clamp(v, 0, SPAN);
    diary.style.setProperty("--v", (v / SPAN).toFixed(4));
    var i = 0;
    days.forEach(function (d, k) { if (d <= v + 0.01) i = k; });
    showEntry(i);
  };
  var goEntry = function (i) { touched = true; i = clamp(i, 0, entries.length - 1); setDay(days[i]); };
  sIn.addEventListener("input", function () { goEntry(+sIn.value); });
  dPrev.addEventListener("click", function () { goEntry(at - 1); });
  dNext.addEventListener("click", function () { goEntry(at + 1); });
  var dayAt = function (e) { var r = track.getBoundingClientRect(); return (e.clientX - r.left) / r.width * SPAN; };
  var sDown = false;
  track.addEventListener("pointerdown", function (e) { sDown = true; touched = true; track.setPointerCapture(e.pointerId); setDay(dayAt(e)); });
  track.addEventListener("pointermove", function (e) { if (sDown) setDay(dayAt(e)); });
  var sUp = function () { if (!sDown) return; sDown = false; setDay(days[at]); };
  track.addEventListener("pointerup", sUp);
  track.addEventListener("pointercancel", sUp);
  setDay(SPAN);
  /* On first sight, a short time-lapse from the first dig to the latest post (until the visitor takes over). */
  if (!U.reduced) {
    var lio = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      lio.disconnect();
      if (touched) return;
      setDay(0);
      var t0 = performance.now(), D = 5200;
      (function tick(t) {
        if (touched) return;
        var k = Math.min(1, (t - t0) / D);
        setDay(SPAN * U.ease(k));
        if (k < 1) requestAnimationFrame(tick);
      })(t0);
    }, { threshold: 0.45 });
    lio.observe(diary);
  }

  U.relayout();
})();
