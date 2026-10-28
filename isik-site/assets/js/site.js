/* Işık: shared behaviour for every page. Page scripts (assets/js/<page>.js) run after this one and use window.UZM.
   One rAF loop drives the light model (the page's hour follows the scroll), the glass chrome over pictures, drifting
   pictures and every page hook in UZM.onFrame. */
(function () {
  var doc = document.documentElement;
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  var chromium = !!(navigator.userAgentData && navigator.userAgentData.brands.some(function (b) { return /Chromium|Google Chrome|Microsoft Edge/.test(b.brand); }));
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (n, a, b) { return Math.min(b == null ? 1 : b, Math.max(a == null ? 0 : a, n)); };
  var lerp = function (a, b, k) { return a + (b - a) * k; };
  var smooth = function (a, b, x) { var k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
  var fmt = new Intl.NumberFormat("tr-TR");
  if (reduced) doc.classList.add("rm");

  var UZM = (window.UZM = {
    reduced: reduced, fine: fine, chromium: chromium, $: $, $$: $$, clamp: clamp, lerp: lerp, smooth: smooth, fmt: fmt,
    onFrame: [], onMeasure: [], root: document.body.dataset.root, assets: document.body.dataset.assets, vh: innerHeight
  });
  UZM.abs = function (el) { return el.getBoundingClientRect().top + scrollY; };

  /* ── Scroll lock, shared by the menu and the dialogs; Lenis pauses while anything is open. */
  var locks = 0;
  UZM.lock = function () { if (locks++ === 0) { doc.style.overflow = "hidden"; if (window.__lenis) window.__lenis.stop(); } };
  UZM.unlock = function () { if (locks > 0 && --locks === 0) { doc.style.overflow = ""; if (window.__lenis) window.__lenis.start(); } };
  UZM.scrollTo = function (y) {
    if (window.__lenis) window.__lenis.scrollTo(y, { duration: 1.4 });
    else scrollTo({ top: y, behavior: reduced ? "auto" : "smooth" });
  };

  /* ── Liquid glass: a displacement map per plate bends the backdrop at the rim like a thick lens (Chromium only).
     Refraction is expensive, so only plates on screen refract, at most a few at a time; the rest stay frosted. */
  var defs = $("#lgDefs"), NS = "http://www.w3.org/2000/svg";
  var LG = {
    bar: { bevel: 18, scale: 38, blur: 2, ca: false, always: true },
    menu: { bevel: 26, scale: 46, blur: 6, ca: false },
    hero: { bevel: 34, scale: 70, blur: 7, ca: true },
    plate: { bevel: 30, scale: 56, blur: 7, ca: true },
    invite: { bevel: 34, scale: 70, blur: 8, ca: true },
    drive: { bevel: 30, scale: 60, blur: 9, ca: true },
    visit: { bevel: 30, scale: 40, blur: 10, ca: false },
    plan: { bevel: 30, scale: 40, blur: 10, ca: false },
    map: { bevel: 26, scale: 48, blur: 6, ca: true },
    prism: { bevel: 22, scale: 44, blur: 3, ca: true }
  };
  var MAX_LIVE = fine ? 3 : 1;
  function lgMap(W, H, R, B) {
    var c = document.createElement("canvas"); c.width = W; c.height = H;
    var g = c.getContext("2d"), d = g.createImageData(W, H), a = d.data, hw = W / 2, hh = H / 2;
    for (var j = 0; j < H; j++) for (var i = 0; i < W; i++) {
      var px = i + 0.5 - hw, py = j + 0.5 - hh;
      var qx = Math.abs(px) - (hw - R), qy = Math.abs(py) - (hh - R);
      var dist = -(Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - R);
      var dx = 0, dy = 0;
      if (dist >= 0 && dist < B) {
        var nx, ny;
        if (qx > 0 && qy > 0) { var l = Math.hypot(qx, qy) || 1; nx = qx / l; ny = qy / l; } else if (qx > qy) { nx = 1; ny = 0; } else { nx = 0; ny = 1; }
        nx *= Math.sign(px) || 1; ny *= Math.sign(py) || 1;
        var k = 1 - dist / B, m = 1 - Math.sqrt(1 - k * k);
        dx = -nx * m; dy = -ny * m;
      }
      var o = (j * W + i) * 4; a[o] = 128 + dx * 127; a[o + 1] = 128 + dy * 127; a[o + 2] = 128; a[o + 3] = 255;
    }
    g.putImageData(d, 0, 0); return c.toDataURL();
  }
  var lgSeq = 0, plates = [];
  function liquid(el) {
    var cfg = LG[el.dataset.lg] || LG.plate, id = "lg-" + (++lgSeq);
    var f = document.createElementNS(NS, "filter");
    f.setAttribute("id", id); f.setAttribute("x", "0"); f.setAttribute("y", "0"); f.setAttribute("width", "100%"); f.setAttribute("height", "100%"); f.setAttribute("color-interpolation-filters", "sRGB");
    var ch = function (n) { return '<feColorMatrix in="d' + n + '" type="matrix" values="' + (n === "r" ? "1 0 0 0 0" : "0 0 0 0 0") + " " + (n === "g" ? "0 1 0 0 0" : "0 0 0 0 0") + " " + (n === "b" ? "0 0 1 0 0" : "0 0 0 0 0") + ' 0 0 0 1 0" result="c' + n + '"/>'; };
    f.innerHTML = '<feGaussianBlur in="SourceGraphic" stdDeviation="' + cfg.blur + '" result="bl"/><feImage result="map" x="0" y="0" preserveAspectRatio="none"/>' +
      (cfg.ca
        ? '<feDisplacementMap in="bl" in2="map" scale="' + cfg.scale + '" xChannelSelector="R" yChannelSelector="G" result="dr"/><feDisplacementMap in="bl" in2="map" scale="' + cfg.scale * 1.08 + '" xChannelSelector="R" yChannelSelector="G" result="dg"/><feDisplacementMap in="bl" in2="map" scale="' + cfg.scale * 1.16 + '" xChannelSelector="R" yChannelSelector="G" result="db"/>' + ch("r") + ch("g") + ch("b") + '<feBlend in="cr" in2="cg" mode="screen" result="rg"/><feBlend in="rg" in2="cb" mode="screen"/>'
        : '<feDisplacementMap in="bl" in2="map" scale="' + cfg.scale + '" xChannelSelector="R" yChannelSelector="G"/>');
    defs.appendChild(f);
    var img = f.querySelector("feImage"), last = "", p = { el: el, cfg: cfg, on: false, seen: false, built: false };
    p.build = function () {
      var W = Math.round(el.offsetWidth), H = Math.round(el.offsetHeight);
      if (!W || !H || W * H > 2600000) return false;
      if (W + "x" + H === last) return true;
      last = W + "x" + H;
      var R = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, H / 2, W / 2);
      img.setAttribute("width", W); img.setAttribute("height", H);
      img.setAttribute("href", lgMap(W, H, R, Math.min(cfg.bevel, H / 2.2)));
      return true;
    };
    p.set = function (on) {
      if (on && !p.build()) on = false;
      if (on === p.on) return;
      p.on = on;
      el.style.backdropFilter = on ? "url(#" + id + ") saturate(1.5) brightness(1.04)" : "";
      el.classList.toggle("lg-on", on);
    };
    var tm; new ResizeObserver(function () { clearTimeout(tm); tm = setTimeout(function () { if (p.on) p.build(); }, 140); }).observe(el);
    plates.push(p);
    return p;
  }
  var lgIO = chromium && !reduced && "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { var p = plates.filter(function (x) { return x.el === e.target; })[0]; if (p) p.seen = e.isIntersecting; });
    schedulePlates();
  }, { rootMargin: "80px 0px" }) : null;
  var plateTimer = 0;
  function schedulePlates() { clearTimeout(plateTimer); plateTimer = setTimeout(updatePlates, 60); }
  function updatePlates() {
    var live = 0;
    plates.forEach(function (p) {
      var want = p.cfg.always || p.forced || (p.seen && live < MAX_LIVE);
      if (want && !p.cfg.always && !p.forced) live++;
      p.set(!!want && !p.paused);
    });
  }
  UZM.liquid = function (el, force) {
    if (!lgIO) return null;
    var p = el._lg || (el._lg = liquid(el));
    if (force !== undefined) { p.forced = force; schedulePlates(); }
    else lgIO.observe(el);
    return p;
  };
  if (lgIO) $$("[data-lg]").forEach(function (el) {
    if (el.closest("dialog") || el.id === "menu") { el._lg = liquid(el); return; }
    UZM.liquid(el);
  });

  /* ── The light model. Elements with data-hour hold the page at that hour while they fill the middle of the
     screen; between them, and from the top (data-h0) to the end (data-h1), the hour runs on with the scroll. An
     element can also bring its own clock (el._hour = function (y) { return hour; }). The dusk band where neither
     dark nor light ink would read is crossed quickly and never rested in. */
  var H0 = doc.dataset.h0, H1 = doc.dataset.h1;
  var live = H0 === "now";
  var h0 = live ? ISIK.lit(ISIK.now()) : +H0 || 8, h1 = live ? h0 : +H1 || h0;
  var anchors = $$("[data-hour]").map(function (el) { return { el: el, top: 0, bottom: 0 }; });
  var medias = [], drifts = [];
  var docH = 0;
  var dusk = function (h) {
    if (h <= 18.4 || h >= 19.6) return h;
    var k = (h - 18.4) / 1.2, s = k < 0.5 ? 0.5 * Math.pow(2 * k, 4) : 1 - 0.5 * Math.pow(2 - 2 * k, 4);
    return 18.4 + 1.2 * s;
  };
  var hourAt = function (a, y) { return a.el._hour ? a.el._hour(y) : +a.el.dataset.hour; };
  function targetHour(y) {
    if (live) return h0;
    var vh = UZM.vh, mid = y + vh * 0.5;
    var pts = [[vh * 0.5, h0]];
    anchors.forEach(function (a) { var h = hourAt(a, y); if (h === h) pts.push([a.top, h], [a.bottom, h]); });
    pts.push([Math.max(docH - vh * 0.5, vh * 0.5 + 1), h1]);
    if (mid <= pts[0][0]) return pts[0][1];
    for (var i = 0; i < pts.length - 1; i++) {
      var p = pts[i], q = pts[i + 1];
      if (mid <= q[0]) { var k = q[0] > p[0] ? (mid - p[0]) / (q[0] - p[0]) : 1; return dusk(lerp(p[1], q[1], smooth(0, 1, k))); }
    }
    return pts[pts.length - 1][1];
  }
  var clockT = $(".clock-t"), clockShown = "";
  var two = function (n) { return (n < 10 ? "0" : "") + n; };
  var clockText = function (h) { var m = Math.round(h * 60) % 1440; return two(Math.floor(m / 60)) + "." + two(m % 60); };
  var hCur = -1, hShown = -1;
  UZM.hour = function () { return hCur; };
  function paintHour(h, real) {
    ISIK.paint(h);
    var t = clockText(real != null ? real : h);
    if (clockT && t !== clockShown) { clockShown = t; clockT.textContent = t; }
  }
  if (live) {
    var tickNow = function () { var r = ISIK.now(); h0 = h1 = ISIK.lit(r); paintHour(h0, r); hCur = hShown = h0; };
    tickNow(); setInterval(tickNow, 30000);
  }

  /* ── Measure once (and on resize), never per frame. */
  function measure() {
    UZM.vh = innerHeight;
    docH = doc.scrollHeight;
    anchors.forEach(function (a) { a.top = UZM.abs(a.el); a.bottom = a.top + a.el.offsetHeight; });
    medias = $$("[data-media], .ph, .invite").map(function (el) { var t = UZM.abs(el); return { el: el, top: t, bottom: t + el.offsetHeight, pill: el.dataset.media === "pill" }; });
    UZM.onMeasure.forEach(function (fn) { fn(); });
    dirty = true;
  }
  UZM.measure = measure;

  /* ── Chrome: bar and pill read as clear smoked glass over pictures, tinted glass over the page. */
  var bar = $("#bar"), pres = $(".pres");
  var overMedia = function (docY, pill) { return medias.some(function (m) { return (pill || !m.pill) && docY >= m.top && docY <= m.bottom; }); };
  var lastY = scrollY, presAway = false;
  function chromeFrame(y, vh) {
    if (bar) bar.classList.toggle("on-media", overMedia(y + 42, false));
    if (pres) {
      pres.classList.toggle("on-media", overMedia(y + vh - 36, true));
      var dy = y - lastY;
      if (Math.abs(dy) > 6) {
        var end = y + vh >= docH - 120;
        var away = dy > 0 && y > vh * 0.5 && !end;
        if (away !== presAway) { presAway = away; pres.classList.toggle("away", away); }
        lastY = y;
      }
    }
  }

  /* ── Pictures drifting in their frames */
  function driftFrame(y, vh) {
    if (reduced) return;
    drifts.forEach(function (d) {
      var r = d.el.parentElement.getBoundingClientRect();
      if (r.bottom < -50 || r.top > vh + 50) return;
      var p = (r.top + r.height / 2 - vh / 2) / vh;
      d.el.style.transform = "translate3d(0," + (p * -50).toFixed(1) + "px,0)";
    });
  }

  /* ── One loop */
  var dirty = true, lastFrameY = -1, tPrev = performance.now();
  function frame(now) {
    var y = scrollY, vh = UZM.vh, dt = Math.min(64, now - tPrev); tPrev = now;
    var moved = y !== lastFrameY || dirty; lastFrameY = y; dirty = false;
    if (!live) {
      var th = targetHour(y);
      if (hCur < 0) hCur = th;
      hCur = reduced ? th : lerp(hCur, th, 1 - Math.exp(-dt / 160));
      if (Math.abs(hCur - hShown) > 0.004) { hShown = hCur; paintHour(hCur); }
    }
    if (moved) { chromeFrame(y, vh); driftFrame(y, vh); }
    for (var i = 0; i < UZM.onFrame.length; i++) UZM.onFrame[i](y, vh, moved, dt);
    requestAnimationFrame(frame);
  }
  UZM.dirty = function () { dirty = true; };

  /* ── Reveal on scroll and count-ups */
  var countUp = function (el) {
    var to = +el.dataset.count, plain = el.hasAttribute("data-plain");
    if (reduced) return;
    var from = plain ? to - 12 : 0, t0 = performance.now(), D = 1800;
    (function tick(t) {
      var k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 4), v = Math.round(from + (to - from) * e);
      el.textContent = plain ? String(v) : fmt.format(v);
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  };
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      if (e.target.dataset.count) countUp(e.target);
      $$("[data-count]", e.target).forEach(countUp);
      e.target.dispatchEvent(new CustomEvent("uzm:in", { bubbles: true }));
      io.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  UZM.observe = function (el) { io.observe(el); };
  $$("[data-r], [data-inview]").forEach(function (el) { io.observe(el); });

  /* ── Tilt and specular: plates lean a few degrees toward the pointer and a highlight follows it. */
  UZM.tilt = function (el) {
    if (!fine || reduced || el._tilt) return;
    el._tilt = true;
    var max = el.dataset.tilt === "soft" ? 1.6 : el.dataset.tilt === "strong" ? 9 : 5;
    var spec = document.createElement("span"); spec.className = "spec"; spec.setAttribute("aria-hidden", "true");
    el.appendChild(spec);
    var raf = 0, ev = null;
    var apply = function () {
      raf = 0;
      var r = el.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
      el.style.transform = "perspective(1100px) rotateX(" + ((0.5 - y) * max).toFixed(2) + "deg) rotateY(" + ((x - 0.5) * max).toFixed(2) + "deg)";
      el.style.setProperty("--mx", (x * 100).toFixed(1) + "%"); el.style.setProperty("--my", (y * 100).toFixed(1) + "%");
    };
    el.addEventListener("pointermove", function (e) { if (e.pointerType !== "mouse") return; ev = e; el.classList.add("tilting"); el.style.setProperty("--so", "1"); if (!raf) raf = requestAnimationFrame(apply); });
    el.addEventListener("pointerleave", function () { el.classList.remove("tilting"); el.style.transform = ""; el.style.setProperty("--so", "0"); });
  };
  $$("[data-tilt]").forEach(UZM.tilt);

  /* ── Menu sheet */
  var menu = $("#menu"), menuBtn = $(".menu-btn");
  var behind = [".skip", "#hdr", "main", ".ftr", ".pres"].map(function (s) { return $(s); }).filter(Boolean);
  var setMenu = function (open) {
    if (!menu || open === menu.classList.contains("open")) return;
    menu.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", open);
    behind.forEach(function (el) { el.inert = open; });
    open ? UZM.lock() : UZM.unlock();
    if (menu._lg) { menu._lg.forced = open; schedulePlates(); }
    if (open) setTimeout(function () { $("a", menu).focus(); }, 30); else menuBtn.focus({ preventScroll: true });
  };
  UZM.closeMenu = function () { setMenu(false); };
  if (menu && menuBtn) {
    menuBtn.addEventListener("click", function () { setMenu(true); });
    $(".menu-close", menu).addEventListener("click", function () { setMenu(false); });
    $$("a", menu).forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
    addEventListener("keydown", function (e) { if (e.key === "Escape" && menu.classList.contains("open")) setMenu(false); });
    menu.addEventListener("keydown", function (e) {
      if (e.key !== "Tab") return;
      var f = $$("a, button", menu), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* ── Dialogs: [data-open="id"] opens #id; [data-close] and a click on the backdrop close it. */
  var openers = new WeakMap();
  UZM.open = function (dlg, from) {
    if (typeof dlg === "string") dlg = document.getElementById(dlg);
    if (!dlg || dlg.open) return;
    if (menu && menu.classList.contains("open")) setMenu(false);
    openers.set(dlg, from || document.activeElement);
    UZM.lock();
    dlg.showModal();
    var plate = $("[data-lg]", dlg);
    if (plate && plate._lg) requestAnimationFrame(function () { plate._lg.forced = true; schedulePlates(); });
    dlg.dispatchEvent(new CustomEvent("uzm:open"));
  };
  $$("dialog.dlg").forEach(function (dlg) {
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
    $$("[data-close]", dlg).forEach(function (b) { b.addEventListener("click", function () { dlg.close(); }); });
    dlg.addEventListener("close", function () {
      UZM.unlock();
      var plate = $("[data-lg]", dlg);
      if (plate && plate._lg) { plate._lg.forced = false; schedulePlates(); }
      var o = openers.get(dlg);
      if (o && o.focus) o.focus({ preventScroll: true });
    });
  });
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-open]");
    if (!b) return;
    e.preventDefault();
    UZM.open(b.dataset.open, b);
  });

  /* ── Film dialog */
  var film = $("#film"), filmVid = film && $("video", film);
  if (film) {
    film.addEventListener("uzm:open", function () {
      if (!filmVid.src) filmVid.src = filmVid.dataset.src;
      filmVid.currentTime = 0;
      var p = filmVid.play(); if (p && p.catch) p.catch(function () {});
      $$("video[data-film]").forEach(function (v) { v.pause(); });
    });
    film.addEventListener("close", function () { filmVid.pause(); });
  }

  /* ── The plan light-table. Every Levan plan lives here; UZM.openPlan(type, sheet) opens one with its tabs. */
  var A = UZM.assets;
  var sheet = function (key, w, h, label, net, gross, garden) { return { src: A + "img/levan--plan--" + key + ".webp", w: w, h: h, label: label, net: net, gross: gross, garden: garden }; };
  var floors = function (base, net, gross, garden) { return [sheet(base + "-zemin", 1600, 960, "Zemin kat", net, gross, garden), sheet(base + "-1-kat", 1600, 960, "1. kat", net, gross, garden), sheet(base + "-bodrum", 1600, 960, "Bodrum", net, gross, garden)]; };
  UZM.PLANS = [
    { title: "2+1 Daire", sheets: [sheet("2-1-a", 1600, 918, "2+1 A", "64,83", "73,83"), sheet("2-1-b", 1600, 918, "2+1 B", "69,20", "78,86"), sheet("2-1-c", 1600, 918, "2+1 C", "70,17", "81,13")] },
    { title: "3+1 Daire", sheets: [sheet("3-1-a", 1600, 918, "3+1 A", "118,41", "135,95"), sheet("3-1-b", 1600, 918, "3+1 B", "123,43", "141,21"), sheet("3-1-c", 1600, 918, "3+1 C", "113,07", "127,93")] },
    { title: "4+1 Daire", sheets: [sheet("4-1", 1600, 918, "4+1", "155,71", "178,13")] },
    { title: "4+1 İkiz Villa", sheets: floors("ikiz", "271,02", "310,12", "85,74"), whole: true },
    { title: "5+1 Müstakil Villa", sheets: floors("mustakil", "329,89", "378,10"), whole: true },
    { title: "6+1 Malikane", sheets: [sheet("malikane", 1600, 1194, "6+1", "268,35", "301,80", "1.159,09")] }
  ];
  /* Tabs that follow the arrow keys (shared by the light-table here and the Levan page). */
  UZM.tabs = function (list, onSelect) {
    list.addEventListener("keydown", function (e) {
      var tabs = $$("[role=tab]", list), i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      var k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      var n = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : k ? (i + k + tabs.length) % tabs.length : -1;
      if (n < 0) return;
      e.preventDefault(); tabs[n].focus(); onSelect(n);
    });
  };
  var plan = $("#plan");
  if (plan) {
    var lt = $(".lt", plan), ltImg = $("img", lt), ltTabs = $(".plan-tabs", plan), ltTitle = $("#plan-title"), ltSpecs = $(".plan-specs", plan);
    var curPlan = null;
    var m2 = function (v) { return v + " m²"; };
    var show = function (i, first) {
      var u = curPlan, s = u.sheets[i];
      var put = function () {
        ltImg.src = s.src; ltImg.width = s.w; ltImg.height = s.h;
        ltImg.alt = u.title + (s.label && u.sheets.length > 1 ? ", " + s.label : "") + " kat planı";
        ltImg.classList.remove("swap");
      };
      $$("[role=tab]", ltTabs).forEach(function (b, k) { b.setAttribute("aria-selected", k === i); b.tabIndex = k === i ? 0 : -1; if (k === i) lt.setAttribute("aria-labelledby", b.id); });
      if (u.sheets.length < 2) lt.setAttribute("aria-labelledby", "plan-title");
      ltSpecs.innerHTML = "<div><dt>Net alan" + (u.whole ? " · üç kat" : "") + "</dt><dd>" + m2(s.net) + "</dd></div><div><dt>Brüt alan</dt><dd>" + m2(s.gross) + "</dd></div>" + (s.garden ? "<div><dt>Bahçe</dt><dd>" + m2(s.garden) + "</dd></div>" : "");
      if (first || reduced) return put();
      ltImg.classList.add("swap");
      setTimeout(put, 220);
    };
    UZM.openPlan = function (type, start, from) {
      curPlan = UZM.PLANS[type];
      ltTitle.textContent = curPlan.title;
      ltTabs.innerHTML = "";
      if (curPlan.sheets.length > 1) curPlan.sheets.forEach(function (s, i) {
        var b = document.createElement("button");
        b.type = "button"; b.setAttribute("role", "tab"); b.id = "plan-tab-" + i; b.textContent = s.label;
        b.addEventListener("click", function () { show(i); });
        ltTabs.appendChild(b);
      });
      show(start || 0, true);
      UZM.open(plan, from);
    };
    UZM.tabs(ltTabs, function (i) { show(i); });
    if (fine && !reduced) lt.addEventListener("pointermove", function (e) {
      var r = lt.getBoundingClientRect();
      lt.style.setProperty("--lx", ((e.clientX - r.left) / r.width * 100).toFixed(1) + "%");
      lt.style.setProperty("--ly", ((e.clientY - r.top) / r.height * 100).toFixed(1) + "%");
    });
    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-plan-type]");
      if (!b) return;
      e.preventDefault();
      UZM.openPlan(+b.dataset.planType, +b.dataset.sheet || 0, b);
    });
  }

  /* ── Lightbox: links with data-lb="group" open their href; data-cap is the caption. */
  var lb = $("#lb");
  if (lb) {
    var lbImg = $("img", lb), lbCap = $(".lb-cap", lb), lbCount = $(".lb-count", lb), group = [], at = 0;
    var lbShow = function (i) {
      at = (i + group.length) % group.length;
      var a = group[at];
      lbImg.src = a.getAttribute("href");
      lbImg.alt = a.dataset.cap || (a.querySelector("img") ? a.querySelector("img").alt : "");
      lbCap.textContent = a.dataset.cap || lbImg.alt;
      lbCount.textContent = (at + 1) + " / " + group.length;
      var one = group.length < 2;
      $(".lb-prev", lb).hidden = one; $(".lb-next", lb).hidden = one;
    };
    document.addEventListener("click", function (e) {
      var a = e.target.closest("a[data-lb]");
      if (!a) return;
      e.preventDefault();
      group = $$('a[data-lb="' + a.dataset.lb + '"]');
      lbShow(group.indexOf(a));
      UZM.open(lb, a);
    });
    $(".lb-prev", lb).addEventListener("click", function () { lbShow(at - 1); });
    $(".lb-next", lb).addEventListener("click", function () { lbShow(at + 1); });
    lb.addEventListener("keydown", function (e) { if (e.key === "ArrowLeft") lbShow(at - 1); if (e.key === "ArrowRight") lbShow(at + 1); });
    lb.addEventListener("click", function (e) { if (e.target.classList.contains("lb-fig")) lb.close(); });
  }

  /* ── Demo forms: checked in the browser, never sent; the note says so. */
  var problem = function (el) {
    if (el.type === "checkbox") return el.required && !el.checked ? "Devam etmek için aydınlatma metnini onaylayın." : "";
    if (el.required && !el.value.trim()) return el.tagName === "SELECT" ? "Lütfen bir konu seçin." : "Lütfen bu alanı doldurun.";
    if (el.validity && el.validity.typeMismatch && el.type === "email") return "Geçerli bir e-posta adresi yazın, örneğin ad@alanadi.com.";
    return el.checkValidity() ? "" : "Lütfen bu alanı kontrol edin.";
  };
  var fieldSeq = 0;
  var mark = function (el, msg) {
    var wrap = el.closest(".field, .check");
    if (!wrap) return;
    wrap.classList.toggle("bad", !!msg);
    if (!el.id) el.id = "f-" + (++fieldSeq);
    var id = el.id + "-err", err = document.getElementById(id);
    if (msg) {
      if (!err) { err = document.createElement("span"); err.className = "err"; err.id = id; wrap.classList.contains("check") ? wrap.after(err) : wrap.appendChild(err); }
      err.textContent = msg;
      el.setAttribute("aria-invalid", "true"); el.setAttribute("aria-describedby", id);
    } else {
      if (err) err.remove();
      el.removeAttribute("aria-invalid"); el.removeAttribute("aria-describedby");
    }
  };
  $$("form[data-demo]").forEach(function (f) {
    var fields = $$("input, select, textarea", f);
    fields.forEach(function (el) {
      el.addEventListener(el.type === "checkbox" || el.tagName === "SELECT" ? "change" : "input", function () { if (el.getAttribute("aria-invalid")) mark(el, problem(el)); });
    });
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var first = null;
      fields.forEach(function (el) { var msg = problem(el); mark(el, msg); if (msg && !first) first = el; });
      if (first) { first.focus(); return; }
      var note = $(".form-sent", f);
      $$(".field, .check, button[type=submit]", f).forEach(function (el) { el.hidden = true; });
      if (note) { note.hidden = false; note.setAttribute("tabindex", "-1"); note.focus(); }
    });
  });

  /* ── Films: the still covers each until it plays; plays only near the screen; a button stops it for good. */
  $$("video[data-film]").forEach(function (v) {
    if (reduced || (navigator.connection && navigator.connection.saveData)) return;
    var host = v.closest(".ph, section") || v.parentElement, wrap = v.parentElement;
    var start = +v.dataset.start || 0, loaded = false, userPaused = false;
    var load = function () {
      if (loaded) return;
      loaded = true;
      var tall = matchMedia("(max-aspect-ratio: 4/5)").matches;
      v.src = tall && v.dataset.filmTall ? v.dataset.filmTall : v.dataset.film;
      v.muted = true;
      if (start) v.addEventListener("loadedmetadata", function () { try { if (v.currentTime < start - 0.1) v.currentTime = start; } catch (e) {} }, { once: true });
      var reveal = function () { if (v.currentTime > 0 && v.currentTime >= start - 0.05) { wrap.classList.add("playing"); v.removeEventListener("timeupdate", reveal); } };
      v.addEventListener("timeupdate", reveal);
    };
    var play = function () { load(); var p = v.play(); if (p && p.catch) p.catch(function () {}); };
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "film-toggle"; btn.setAttribute("aria-pressed", "false");
    btn.innerHTML = '<i aria-hidden="true"></i><span class="sr">Filmi durdur</span>';
    btn.addEventListener("click", function () {
      userPaused = !userPaused; userPaused ? v.pause() : play();
      btn.setAttribute("aria-pressed", userPaused); btn.classList.toggle("paused", userPaused);
      btn.lastChild.textContent = userPaused ? "Filmi oynat" : "Filmi durdur";
    });
    host.appendChild(btn);
    new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { if (!userPaused && !(film && film.open)) play(); } else if (loaded) v.pause(); }); }, { rootMargin: "100px 0px" }).observe(host);
  });

  /* ── Inertial scrolling on desktop when Lenis is reachable; in-page anchors glide too. */
  if (!reduced && fine) {
    var ls = document.createElement("script");
    ls.src = "https://cdn.jsdelivr.net/npm/lenis@1.1.13/dist/lenis.min.js";
    ls.onload = function () {
      if (!window.Lenis) return;
      var lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
      window.__lenis = lenis;
      if (locks > 0) lenis.stop();
      (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(performance.now());
    };
    document.body.appendChild(ls);
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute("href").length < 2) return;
    var t = document.getElementById(decodeURIComponent(a.getAttribute("href").slice(1)));
    if (!t) return;
    e.preventDefault();
    if (window.__lenis) window.__lenis.scrollTo(t, { offset: -80, duration: 1.5 });
    else t.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
    if (!t.hasAttribute("tabindex")) t.setAttribute("tabindex", "-1");
    t.focus({ preventScroll: true });
  });

  /* ── A light leak across the page change (with cross-document view transitions). */
  addEventListener("pagereveal", function (e) {
    if (!e.viewTransition || reduced) return;
    var leak = document.createElement("div"); leak.className = "leak"; leak.setAttribute("aria-hidden", "true");
    document.body.appendChild(leak);
    doc.classList.add("vt-leak");
    setTimeout(function () { doc.classList.remove("vt-leak"); leak.remove(); }, 1300);
  });

  /* ── Bento: one light source, shared by every tile */
  $$(".bento").forEach(function (bento) {
    if (!fine || reduced) return;
    var tiles = $$(".tile", bento);
    bento.addEventListener("pointermove", function (e) {
      var b = bento.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
      tiles.forEach(function (t) { t.style.setProperty("--lx", (x - t.offsetLeft) + "px"); t.style.setProperty("--ly", (y - t.offsetTop) + "px"); });
    });
    bento.addEventListener("pointerenter", function () { bento.style.setProperty("--lo", "1"); });
    bento.addEventListener("pointerleave", function () { bento.style.setProperty("--lo", "0"); });
  });

  /* ── Rails (the construction diary): arrows step one card, a bar fills as it scrolls */
  $$(".rail").forEach(function (rail) {
    var bar = rail.id && $('.rail-bar i', rail.parentElement);
    var step = function () { var l = rail.firstElementChild; return (l ? l.offsetWidth : 300) + 16; };
    $$('[data-rail][aria-controls="' + rail.id + '"]').forEach(function (b) { b.addEventListener("click", function () { rail.scrollBy({ left: +b.dataset.rail * step(), behavior: reduced ? "auto" : "smooth" }); }); });
    var p = function () { if (!bar) return; var max = rail.scrollWidth - rail.clientWidth; bar.style.setProperty("--p", max > 0 ? (0.15 + 0.85 * rail.scrollLeft / max).toFixed(3) : 1); };
    rail.addEventListener("scroll", p, { passive: true }); p();
  });

  /* ── Start */
  drifts = $$("[data-drift]").map(function (el) { return { el: el }; });
  measure();
  addEventListener("resize", function () { measure(); schedulePlates(); });
  addEventListener("load", measure);
  if (document.fonts) document.fonts.ready.then(measure);
  var rto; new ResizeObserver(function () { clearTimeout(rto); rto = setTimeout(measure, 100); }).observe(document.body);
  schedulePlates();
  requestAnimationFrame(frame);
})();
