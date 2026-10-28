/* Zirve · shared behaviour for every page. One requestAnimationFrame loop drives everything in order: Lenis, the
   page's DOM motion (Z.frame), then the WebGL stage (Z.late, registered by stage.mjs), so pictures drawn by WebGL
   never lag behind their boxes. Everything here works without WebGL; stage.mjs only adds light on top. */
(function () {
  "use strict";
  var doc = document.documentElement;
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var smooth = function (a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  var cubicOut = function (t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); };
  var pad = function (n) { return String(n).padStart(2, "0"); };
  var fmt = new Intl.NumberFormat("tr-TR");

  var Z = (window.Z = {
    reduced: reduced, motion: !reduced, fine: fine, $: $, $$: $$, clamp: clamp, lerp: lerp, smooth: smooth, cubicOut: cubicOut,
    root: document.body.dataset.root, assets: document.body.dataset.assets,
    frame: [], late: [], vw: innerWidth, vh: innerHeight, y: scrollY, vel: 0, mx: innerWidth / 2, my: innerHeight / 2, pointed: false,
    introAt: 0, lenis: null,
    small: function () { return innerWidth < 768; }
  });

  /* ── The one loop */
  var prev = performance.now(), lastY = scrollY;
  function loop(now) {
    var dt = Math.min(64, now - prev); prev = now;
    if (Z.lenis) Z.lenis.raf(now);
    Z.y = scrollY;
    Z.vel = lerp(Z.vel, clamp(Z.y - lastY, -90, 90), 0.2);
    lastY = Z.y;
    for (var i = 0; i < Z.frame.length; i++) Z.frame[i](now, dt);
    for (var j = 0; j < Z.late.length; j++) Z.late[j](now, dt);
    requestAnimationFrame(loop);
  }
  addEventListener("resize", function () { Z.vw = innerWidth; Z.vh = innerHeight; });

  /* ── Smooth scroll on desktop when Lenis is reachable; in-page anchors glide too. */
  if (!reduced && fine) {
    var ls = document.createElement("script");
    ls.src = "https://cdn.jsdelivr.net/npm/lenis@1.1.13/dist/lenis.min.js";
    ls.onload = function () {
      if (!window.Lenis) return;
      Z.lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
      if (locks > 0) Z.lenis.stop();
    };
    document.head.appendChild(ls);
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute("href");
    if (id.length < 2) return;
    var t = document.getElementById(decodeURIComponent(id.slice(1)));
    if (!t) return;
    e.preventDefault();
    if (Z.lenis) Z.lenis.scrollTo(t, { offset: -20, duration: 1.4 });
    else t.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
    if (t.tabIndex < 0 && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) t.setAttribute("tabindex", "-1");
    t.focus({ preventScroll: true });
    history.replaceState(null, "", id);
  });

  /* ── Text splitting: hero titles by character, headings by word, the manifesto by word. */
  function splitWords(el) {
    var i = 0;
    var walk = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.append(" "); return; }
            var w = document.createElement("span"), wi = document.createElement("span");
            w.className = "w"; wi.className = "wi"; wi.style.setProperty("--i", i++); wi.textContent = p;
            w.append(wi); frag.append(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && !n.classList.contains("pl")) walk(n);
      });
    };
    walk(el);
  }
  function splitChars(el, start) {
    var i = start || 0;
    var walk = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.append(" "); return; }
            var wd = document.createElement("span"); wd.className = "wd";
            for (var c of p) { var s = document.createElement("span"); s.className = "ch"; s.style.setProperty("--i", i++); s.textContent = c; wd.append(s); }
            frag.append(wd);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
    return i;
  }
  if (!reduced) {
    $$(".ph h1, .hero h1").forEach(function (h) {
      var lab = h.textContent.replace(/\s+/g, " ").trim();
      var lines = $$(".ln", h);
      var ci = 0;
      (lines.length ? lines : [h]).forEach(function (ln) { ci = splitChars(ln, ci) + 3; });
      h.setAttribute("aria-label", lab);
      $$(".wd", h).forEach(function (w) { w.setAttribute("aria-hidden", "true"); });
    });
    $$("[data-split]").forEach(function (el) { splitWords(el); el.classList.add("split"); });
    $$(".motion .cap h3").forEach(splitWords);
  }
  var maniWords = [];
  $$("[data-words]").forEach(function (el) {
    var walk = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.append(" "); return; }
            var s = document.createElement("span"); s.className = "sw"; s.textContent = p; maniWords.push({ s: s, el: el }); frag.append(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
  });

  /* ── Reveals and counters */
  var countUp = function (el) {
    if (reduced) return;
    var to = +el.dataset.count, t0 = performance.now(), D = 1800;
    (function tick(t) {
      var k = cubicOut((t - t0) / D);
      el.textContent = fmt.format(Math.round(to * k));
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  };
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      if (e.target.dataset.count) countUp(e.target);
      $$("[data-count]", e.target).forEach(countUp);
      e.target.dispatchEvent(new CustomEvent("z:in", { bubbles: true }));
      io.unobserve(e.target);
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -6% 0px" });
  Z.observe = function (el) { io.observe(el); };
  $$("[data-rv], [data-split], .fig, [data-inview]").forEach(function (el) { io.observe(el); });

  /* ── Heroes open once the page has painted, or, on a first visit to the home page, as the preloader lifts. */
  var hero = $(".ph, .hero, .ph-plain");
  var go = function () {
    if (Z.introAt) return;
    Z.introAt = performance.now();
    if (hero) hero.classList.add("go");
    document.dispatchEvent(new CustomEvent("z:go"));
  };
  var loader = $(".loader");
  if (loader && doc.classList.contains("intro")) runLoader(loader);
  else { if (loader) loader.remove(); requestAnimationFrame(function () { requestAnimationFrame(go); }); }

  /* Preloader: dust gathers into the UZM mark (Canvas 2D, so it never waits for the WebGL library), the light runs
     across it once, and the curtain lifts. Under two seconds; any click, key, wheel or touch skips it. */
  function runLoader(el) {
    try { sessionStorage.setItem("zirve-intro", "1"); } catch (e) {}
    document.body.appendChild(el); /* out of <main>'s stacking context, over the header and the pill */
    var cv = $("canvas", el), g = cv.getContext("2d"), num = $(".ld-num", el), line = $(".ld-line", el);
    var dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; g.scale(dpr, dpr);
    var pts = [], t0 = performance.now(), done = false, skip = false;
    var finish = function () {
      if (done) return; done = true;
      num.textContent = "100"; line.style.setProperty("--k", 1);
      el.classList.add("out");
      setTimeout(go, 200);
      setTimeout(function () { el.remove(); }, 1200);
      ["keydown", "wheel", "touchstart"].forEach(function (t) { removeEventListener(t, doSkip); });
    };
    var doSkip = function () { skip = true; finish(); };
    el.addEventListener("click", doSkip);
    ["keydown", "wheel", "touchstart"].forEach(function (t) { addEventListener(t, doSkip, { passive: true }); });
    var sym = document.getElementById("uzm-group");
    var vb = sym.getAttribute("viewBox").split(/\s+/).map(Number);
    var mw = Math.min(W * 0.62, 420), mh = mw * vb[3] / vb[2];
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb.join(" ") + '" width="' + Math.round(mw) + '" height="' + Math.round(mh) + '"><g color="#fff" fill="#fff">' + sym.innerHTML + "</g></svg>";
    var img = new Image();
    img.onload = function () {
      var oc = document.createElement("canvas"); oc.width = Math.round(mw); oc.height = Math.round(mh);
      var og = oc.getContext("2d"); og.drawImage(img, 0, 0, oc.width, oc.height);
      var d = og.getImageData(0, 0, oc.width, oc.height).data, step = W < 600 ? 3 : 3;
      var ox = (W - oc.width) / 2, oy = (H - oc.height) / 2 - H * 0.06;
      for (var y = 0; y < oc.height; y += step) for (var x = 0; x < oc.width; x += step) {
        if (d[(y * oc.width + x) * 4 + 3] > 120) {
          var a = Math.random() * Math.PI * 2, r = (0.35 + Math.random() * 0.75) * Math.max(W, H) * 0.6;
          pts.push({ tx: ox + x, ty: oy + y, sx: W / 2 + Math.cos(a) * r, sy: H / 2 + Math.sin(a) * r * 0.7, dl: Math.random() * 380, u: x / oc.width, s: 0.6 + Math.random() * 1.2 });
        }
      }
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    var chrome = function (u) {
      var stops = [[142, 146, 155], [233, 237, 242], [198, 191, 224], [242, 244, 247], [180, 193, 210], [142, 146, 155]];
      var f = clamp(u, 0, 0.999) * 5, i = Math.floor(f), k = f - i, A = stops[i], B = stops[i + 1];
      return [A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k];
    };
    (function tick(now) {
      if (done && skip) return;
      var t = now - t0;
      var k = clamp(t / 1500, 0, 1);
      num.textContent = String(Math.round(k * 100)).padStart(3, "0");
      line.style.setProperty("--k", k.toFixed(3));
      g.clearRect(0, 0, W, H);
      var sweep = (t - 1150) / 450;
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i], e = cubicOut((t - p.dl) / 1000);
        var x = lerp(p.sx, p.tx, e), y = lerp(p.sy, p.ty, e);
        var c = chrome((p.u * 0.8 + t * 0.00012) % 1);
        var lit = sweep > 0 && sweep < 1.3 ? Math.max(0, 1 - Math.abs(p.u - sweep) * 7) : 0;
        g.globalAlpha = 0.25 + 0.75 * e;
        g.fillStyle = "rgb(" + Math.round(c[0] + (255 - c[0]) * lit) + "," + Math.round(c[1] + (255 - c[1]) * lit) + "," + Math.round(c[2] + (255 - c[2]) * lit) + ")";
        var sz = lerp(p.s * 1.6, 1.7, e) + lit * 1.2;
        g.fillRect(x - sz / 2, y - sz / 2, sz, sz);
      }
      if (t > 1650) finish();
      if (!done || t < 2700) requestAnimationFrame(tick);
    })(t0);
  }

  /* ── Header: hides going down, returns going up, turns solid past the hero. The pill steps aside the same way. */
  var hdr = $("#hdr"), pres = $(".pres"), menu = $("#menu");
  var navHidden = false;
  Z.frame.push(function () {
    var y = Z.y, vh = Z.vh, v = Z.vel;
    var down = v > 1.2 && y > vh * 0.5, up = v < -1.2;
    var end = y + vh >= document.documentElement.scrollHeight - 80;
    if (down && !navHidden && !menu.classList.contains("open")) { hdr.classList.add("hide"); navHidden = true; pres && pres.classList.add("away"); }
    else if ((up || y < 40 || end) && navHidden) { hdr.classList.remove("hide"); navHidden = false; pres && pres.classList.remove("away"); }
    hdr.classList.toggle("solid", y > (hero ? hero.offsetHeight * 0.55 : 20));
  });
  hdr.addEventListener("focusin", function () { hdr.classList.remove("hide"); navHidden = false; });
  if (pres) pres.addEventListener("focusin", function () { pres.classList.remove("away"); });

  /* ── Scroll lock shared by the menu and the dialogs; Lenis pauses while anything is open. */
  var locks = 0;
  Z.lock = function () { if (locks++ === 0) { doc.style.overflow = "hidden"; if (Z.lenis) Z.lenis.stop(); } };
  Z.locked = function () { return locks > 0; };
  Z.unlock = function () { if (locks > 0 && --locks === 0) { doc.style.overflow = ""; if (Z.lenis) Z.lenis.start(); } };

  /* ── Menu overlay: everything behind it is inert, so Tab stays inside; Esc closes it. */
  var menuBtn = $(".menu-btn");
  var behind = [".skip", "#hdr", "main", ".ftr", ".pres"].map(function (s) { return $(s); }).filter(Boolean);
  var setMenu = function (open) {
    if (open === menu.classList.contains("open")) return;
    menu.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", open);
    behind.forEach(function (el) { el.inert = open; });
    if (open) { Z.lock(); void menu.offsetWidth; $("a", menu).focus(); } else { Z.unlock(); menuBtn.focus({ preventScroll: true }); }
  };
  menuBtn.addEventListener("click", function () { setMenu(true); });
  $(".menu-close").addEventListener("click", function () { setMenu(false); });
  addEventListener("keydown", function (e) { if (e.key === "Escape" && menu.classList.contains("open")) setMenu(false); });

  /* ── Dialogs: [data-open="id"] opens #id; [data-close] and a click on the backdrop close it. */
  var opener = null;
  Z.open = function (dlg, from) {
    if (typeof dlg === "string") dlg = document.getElementById(dlg);
    if (!dlg || dlg.open) return;
    if (menu.classList.contains("open")) setMenu(false);
    opener = from || document.activeElement;
    Z.lock();
    dlg.showModal();
  };
  $$("dialog.dlg").forEach(function (dlg) {
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
    $$("[data-close]", dlg).forEach(function (b) { b.addEventListener("click", function () { dlg.close(); }); });
    dlg.addEventListener("close", function () {
      Z.unlock();
      if (opener && opener.focus) opener.focus({ preventScroll: true });
      opener = null;
    });
  });
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-open]");
    if (!b) return;
    e.preventDefault();
    Z.open(b.dataset.open, b);
  });

  /* The film, full length, with controls. */
  var film = $("#film"), filmVid = film && $("video", film);
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-film-open]");
    if (!b || !film) return;
    if (!filmVid.getAttribute("src")) filmVid.src = Z.small() ? filmVid.dataset.srcSmall : filmVid.dataset.src;
    Z.open(film, b);
    try { filmVid.currentTime = 0; } catch (err) {}
    var p = filmVid.play(); if (p && p.catch) p.catch(function () {});
    $$("video[data-film]").forEach(function (v) { v.pause(); });
  });
  if (film) film.addEventListener("close", function () { filmVid.pause(); });

  /* ── Plans: the six home types as levan.com.tr publishes them. Flats show their variants, villas their floors. */
  var A = Z.assets;
  var sheet = function (key, h, label, net, gross) { return { src: A + "img/levan--plan--" + key + ".webp", w: 1600, h: h, label: label, net: net, gross: gross }; };
  var floors = function (base) { return [sheet(base + "-zemin", 960, "Zemin kat"), sheet(base + "-1-kat", 960, "1. kat"), sheet(base + "-bodrum", 960, "Bodrum")]; };
  Z.TYPES = [
    { name: "2+1 Daire", net: "64,83 – 70,17", gross: "73,83 – 81,13", sheets: [sheet("2-1-a", 918, "2+1 A", "64,83", "73,83"), sheet("2-1-b", 918, "2+1 B", "69,20", "78,86"), sheet("2-1-c", 918, "2+1 C", "70,17", "81,13")] },
    { name: "3+1 Daire", net: "113,07 – 123,43", gross: "127,93 – 141,21", sheets: [sheet("3-1-a", 918, "3+1 A", "118,41", "135,95"), sheet("3-1-b", 918, "3+1 B", "123,43", "141,21"), sheet("3-1-c", 918, "3+1 C", "113,07", "127,93")] },
    { name: "4+1 Daire", net: "155,71", gross: "178,13", sheets: [sheet("4-1", 918, "4+1", "155,71", "178,13")] },
    { name: "4+1 İkiz Villa", net: "271,02", gross: "310,12", garden: "85,74", sheets: floors("ikiz") },
    { name: "5+1 Müstakil Villa", net: "329,89", gross: "378,10", sheets: floors("mustakil") },
    { name: "6+1 Malikane", net: "268,35", gross: "301,80", garden: "1.159,09", sheets: [sheet("malikane", 1194, "6+1", "268,35", "301,80")] }
  ];
  var plan = $("#plan");
  if (plan) {
    var pImg = $(".plan-sheet img", plan), pSheet = $(".plan-sheet", plan), pTabs = $(".plan-tabs", plan), pName = $(".plan-name", plan), pAreas = $(".plan-areas", plan);
    var cur = null, at = 0;
    var area = function (dt, v) { return v ? "<div><dt>" + dt + "</dt><dd>" + v + " m²</dd></div>" : ""; };
    var show = function (i, focus) {
      var s = cur.sheets[i];
      at = i;
      pImg.width = s.w; pImg.height = s.h;
      pImg.alt = cur.name + (cur.sheets.length > 1 ? ", " + s.label : "") + " kat planı";
      pImg.src = s.src;
      pSheet.classList.remove("scan"); void pSheet.offsetWidth; pSheet.classList.add("scan");
      $$("button", pTabs).forEach(function (b, k) { b.setAttribute("aria-selected", k === i); b.tabIndex = k === i ? 0 : -1; if (k === i && focus) b.focus(); });
      var net = s.net || cur.net, gross = s.gross || cur.gross;
      pAreas.innerHTML = area(s.net ? "Net" : "Toplam net", net) + area(s.gross ? "Brüt" : "Toplam brüt", gross) + area("Tahsisli bahçe", cur.garden);
    };
    Z.openPlan = function (ti, si, from) {
      cur = Z.TYPES[ti];
      pName.textContent = cur.name;
      pTabs.innerHTML = "";
      if (cur.sheets.length > 1) cur.sheets.forEach(function (s, k) {
        var b = document.createElement("button");
        b.type = "button"; b.setAttribute("role", "tab"); b.setAttribute("aria-controls", "plan-panel"); b.textContent = s.label;
        b.addEventListener("click", function () { show(k); });
        pTabs.appendChild(b);
      });
      Z.open(plan, from);
      show(si || 0);
    };
    pTabs.addEventListener("keydown", function (e) {
      var n = cur ? cur.sheets.length : 0, d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (e.key === "Home") { e.preventDefault(); show(0, true); }
      else if (e.key === "End") { e.preventDefault(); show(n - 1, true); }
      else if (d) { e.preventDefault(); show((at + d + n) % n, true); }
    });
    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-plan-type]");
      if (!b || b.closest(".strip.dragged")) return;
      Z.openPlan(+b.dataset.planType, +(b.dataset.sheet || 0), b);
    });
  }

  /* ── Lightbox: links with data-lb="group" open their href; data-cap is the caption. */
  var lb = $("#lb");
  if (lb) {
    var lbImg = $("img", lb), lbCap = $(".lb-cap", lb), lbCount = $(".lb-count", lb), group = [], gi = 0;
    var lbShow = function (i) {
      gi = (i + group.length) % group.length;
      var a = group[gi];
      lbImg.src = a.getAttribute("href"); lbImg.alt = a.dataset.cap || "";
      lbCap.textContent = a.dataset.cap || "";
      lbCount.textContent = (gi + 1) + " / " + group.length;
      $(".lb-prev", lb).hidden = $(".lb-next", lb).hidden = group.length < 2;
    };
    document.addEventListener("click", function (e) {
      var a = e.target.closest("a[data-lb]");
      if (!a) return;
      e.preventDefault();
      group = $$('a[data-lb="' + a.dataset.lb + '"]');
      lbShow(group.indexOf(a));
      Z.open(lb, a);
    });
    $(".lb-prev", lb).addEventListener("click", function () { lbShow(gi - 1); });
    $(".lb-next", lb).addEventListener("click", function () { lbShow(gi + 1); });
    lb.addEventListener("keydown", function (e) { if (e.key === "ArrowLeft") lbShow(gi - 1); if (e.key === "ArrowRight") lbShow(gi + 1); });
    lb.addEventListener("click", function (e) { if (e.target.classList.contains("lb-fig")) lb.close(); });
  }

  /* ── Films that play by themselves (heroes, the construction film): load and play only near the screen, start
     where data-start says, and a button stops them for good. WebGL reads the same <video>. */
  $$("video[data-film]").forEach(function (v) {
    if (reduced || (navigator.connection && navigator.connection.saveData)) return;
    var host = v.closest("[data-film-host]") || v.parentElement;
    var start = +v.dataset.start || 0, loaded = false, userPaused = false;
    var load = function () {
      if (loaded) return; loaded = true;
      v.muted = true;
      v.src = Z.small() && v.dataset.filmSmall ? v.dataset.filmSmall : v.dataset.film;
      if (start) v.addEventListener("loadedmetadata", function () { try { v.currentTime = start; } catch (e) {} }, { once: true });
      v.addEventListener("playing", function () { v.parentElement.classList.add("playing"); });
    };
    var play = function () { load(); var p = v.play(); if (p && p.catch) p.catch(function () {}); };
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "film-toggle";
    btn.innerHTML = '<svg class="ft-ring" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="19.4" pathLength="1"/></svg><i aria-hidden="true"></i><span class="sr">Filmi durdur</span>';
    var setBtn = function () { btn.classList.toggle("paused", userPaused); btn.lastChild.textContent = btn.title = userPaused ? "Filmi oynat" : "Filmi durdur"; btn.setAttribute("aria-pressed", String(userPaused)); };
    setBtn();
    btn.addEventListener("click", function () { userPaused = !userPaused; userPaused ? v.pause() : play(); setBtn(); });
    v.addEventListener("timeupdate", function () { if (v.duration) btn.style.setProperty("--p", (v.currentTime / v.duration).toFixed(3)); });
    host.appendChild(btn);
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { if (!userPaused && !(film && film.open)) play(); } else if (loaded) v.pause(); });
    }, { rootMargin: "150px 0px" }).observe(host);
  });

  /* ── Demo forms: checked in the browser, never sent; the note says so. Each problem is written next to its field. */
  var problem = function (el) {
    if (el.type === "checkbox") return el.required && !el.checked ? "Devam etmek için aydınlatma metnini onaylayın." : "";
    if (el.required && !el.value.trim()) return el.tagName === "SELECT" ? "Lütfen bir konu seçin." : "Lütfen bu alanı doldurun.";
    if (el.validity && el.validity.typeMismatch && el.type === "email") return "Geçerli bir e-posta adresi yazın, örneğin ad@alanadi.com.";
    return el.checkValidity() ? "" : "Lütfen bu alanı kontrol edin.";
  };
  var seq = 0;
  var mark = function (el, msg) {
    var wrap = el.closest(".field, .check");
    if (!wrap) return;
    wrap.classList.toggle("bad", !!msg);
    if (!el.id) el.id = "f-" + (++seq);
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

  /* ── Pointer, cursor and magnetic buttons (fine pointers, motion allowed). */
  addEventListener("pointermove", function (e) { Z.mx = e.clientX; Z.my = e.clientY; Z.pointed = true; Z.moved = 1; }, { passive: true });
  if (fine && !reduced) {
    var cDot = document.createElement("div"), cRing = document.createElement("div");
    cDot.className = "cur cur-dot"; cRing.className = "cur cur-ring";
    cDot.setAttribute("aria-hidden", "true"); cRing.setAttribute("aria-hidden", "true");
    cRing.innerHTML = "<span></span>";
    document.body.append(cDot, cRing);
    var cLab = cRing.firstChild, rx = Z.mx, ry = Z.my;
    addEventListener("pointermove", function (e) { if (e.pointerType === "mouse") doc.classList.add("has-cur"); }, { passive: true });
    var LABELS = [["a[data-lb]", "Büyütün"], ["[data-strip]", "Sürükleyin"], [".pcard", "İnceleyin"], ["[data-cursor]", ""]];
    document.addEventListener("pointerover", function (e) {
      var t = e.target;
      var off = !!t.closest("input, select, textarea, dialog, .map-gl");
      cDot.classList.toggle("off", off); cRing.classList.toggle("off", off);
      var lab = "";
      for (var i = 0; i < LABELS.length && !lab; i++) { var m = t.closest(LABELS[i][0]); if (m) lab = m.dataset.cursor || LABELS[i][1]; }
      if (t.closest("button, a:not([data-lb]):not(.pcard)") && !t.closest("[data-strip]")) lab = "";
      cRing.classList.toggle("lab", !!lab);
      cRing.classList.toggle("hot", !lab && !!t.closest("a, button, summary, label, [role=tab]"));
      if (lab) cLab.textContent = lab;
    });
    addEventListener("pointerdown", function () { cRing.classList.add("down"); });
    addEventListener("pointerup", function () { cRing.classList.remove("down"); });
    document.addEventListener("mouseleave", function () { doc.classList.remove("has-cur"); });
    Z.frame.push(function () {
      rx = lerp(rx, Z.mx, 0.18); ry = lerp(ry, Z.my, 0.18);
      cDot.style.transform = "translate3d(" + Z.mx + "px," + Z.my + "px,0)";
      cRing.style.transform = "translate3d(" + rx.toFixed(1) + "px," + ry.toFixed(1) + "px,0)";
    });
    $$(".mag, .btn").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        el.style.translate = ((e.clientX - r.left - r.width / 2) * 0.2).toFixed(1) + "px " + ((e.clientY - r.top - r.height / 2) * 0.28).toFixed(1) + "px";
      });
      el.addEventListener("pointerleave", function () { el.style.translate = ""; });
    });
  }

  /* ── The curved gallery: drag and throw, wheel sideways, arrow keys, buttons; focus brings a card into view. */
  $$("[data-strip]").forEach(function (strip) {
    var track = $(".track", strip), cards = $$(".home", track);
    var wrap = strip.parentElement, ct = $(".ct", wrap), bar = $(".sbar i", wrap);
    var prevB = $("[data-prev]", wrap), nextB = $("[data-next]", wrap);
    var tx = 0, txT = 0, txPrev = 0, minX = 0, dragging = false, dx0 = 0, tx0 = 0, lastX = 0, lastT = 0, dragV = 0, travel = 0;
    strip._v = 0;
    var measure = function () { minX = Math.min(0, strip.clientWidth - track.scrollWidth); txT = clamp(txT, minX, 0); };
    var cardX = function (i) { return -(cards[i].offsetLeft - cards[0].offsetLeft); };
    var nearest = function () { var b = 0, d = Infinity; cards.forEach(function (c, i) { var k = Math.abs(cardX(i) - tx); if (k < d) { d = k; b = i; } }); return b; };
    var goCard = function (i) { txT = clamp(cardX(clamp(i, 0, cards.length - 1)), minX, 0); };
    strip.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      dragging = true; travel = 0; dx0 = lastX = e.clientX; tx0 = txT; lastT = performance.now(); dragV = 0;
      strip.classList.remove("dragged");
    });
    addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var now = performance.now(), raw = tx0 + (e.clientX - dx0);
      travel = Math.max(travel, Math.abs(e.clientX - dx0));
      if (travel > 6 && !strip.hasPointerCapture(e.pointerId)) { try { strip.setPointerCapture(e.pointerId); } catch (err) {} strip.classList.add("dragged"); }
      if (raw > 0) raw *= 0.3; else if (raw < minX) raw = minX + (raw - minX) * 0.3;
      txT = raw;
      dragV = lerp(dragV, ((e.clientX - lastX) / Math.max(1, now - lastT)) * 16, 0.6);
      lastX = e.clientX; lastT = now;
    }, { passive: true });
    var end = function () {
      if (!dragging) return; dragging = false;
      txT = clamp(txT + dragV * 16, minX, 0);
      setTimeout(function () { strip.classList.remove("dragged"); }, 0);
    };
    addEventListener("pointerup", end);
    addEventListener("pointercancel", end);
    strip.addEventListener("click", function (e) { if (travel > 6) { e.preventDefault(); e.stopPropagation(); } }, true);
    strip.addEventListener("wheel", function (e) { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { e.preventDefault(); txT = clamp(txT - e.deltaX, minX, 0); } }, { passive: false });
    strip.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); goCard(nearest() + 1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); goCard(nearest() - 1); }
    });
    strip.addEventListener("focusin", function (e) { var c = e.target.closest(".home"); if (c) { strip.scrollLeft = 0; goCard(cards.indexOf(c)); } });
    if (prevB) prevB.addEventListener("click", function () { goCard(nearest() - 1); });
    if (nextB) nextB.addEventListener("click", function () { goCard(nearest() + 1); });
    measure();
    addEventListener("resize", measure);
    addEventListener("load", measure);
    Z.frame.push(function () {
      txPrev = tx;
      tx = lerp(tx, txT, dragging ? 0.4 : reduced ? 1 : 0.08);
      if (Math.abs(tx - txT) < 0.05) tx = txT;
      strip._v = lerp(strip._v, tx - txPrev, 0.3);
      track.style.transform = "translate3d(" + tx.toFixed(2) + "px,0,0)";
      var ni = nearest();
      if (ct) ct.textContent = pad(ni + 1) + " / " + pad(cards.length);
      if (bar) bar.style.transform = "scaleX(" + (minX ? 0.17 + 0.83 * (tx / minX) : 1).toFixed(3) + ")";
      if (prevB) prevB.disabled = tx > -2;
      if (nextB) nextB.disabled = tx < minX + 2;
    });
  });

  /* ── The projector on the project pages: one large picture; thumbnails, arrows, keys and a swipe change it, and
     stage.mjs dissolves from the last picture to the new one (stage._s). The large picture opens the lightbox. */
  $$("[data-slides]").forEach(function (box) {
    var stage = $(".proj-stage", box), imgs = $$("img", stage), opens = $$(".proj-open", stage), thumbs = $$(".proj-thumbs button", box);
    var cap = $(".proj-cap", box), ct = $(".proj-ct", box), cur = 0, sx = null, swiped = false;
    stage._s = { a: 0, b: 0, t0: 0 };
    var go = function (i) {
      i = (i + imgs.length) % imgs.length;
      if (i === cur) return;
      stage._s = { a: cur, b: i, t0: performance.now() };
      cur = i;
      imgs.forEach(function (im, k) { im.classList.toggle("on", k === i); });
      opens.forEach(function (o, k) { o.hidden = k !== i; });
      thumbs.forEach(function (t, k) { t.setAttribute("aria-current", String(k === i)); });
      cap.textContent = imgs[i].dataset.cap || "";
      ct.textContent = pad(i + 1) + " / " + pad(imgs.length);
    };
    thumbs.forEach(function (t, k) { t.addEventListener("click", function () { go(k); }); });
    $("[data-prev]", box).addEventListener("click", function () { go(cur - 1); });
    $("[data-next]", box).addEventListener("click", function () { go(cur + 1); });
    box.addEventListener("keydown", function (e) {
      if (e.target.closest("input, textarea")) return;
      if (e.key === "ArrowRight") { e.preventDefault(); go(cur + 1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); go(cur - 1); }
    });
    stage.addEventListener("pointerdown", function (e) { sx = e.clientX; swiped = false; });
    stage.addEventListener("pointerup", function (e) { if (sx !== null && Math.abs(e.clientX - sx) > 40) { swiped = true; go(cur + (e.clientX < sx ? 1 : -1)); } sx = null; });
    stage.addEventListener("click", function (e) { if (swiped) { e.preventDefault(); e.stopPropagation(); swiped = false; } }, true);
  });

  /* ── Pinned sequences (the day, the six standards): which moment is on, and how far the dissolve has gone. */
  if (!reduced) $$("[data-seq]").forEach(function (sec) {
    var imgs = $$(".seq-imgs img", sec), caps = $$(".cap", sec), bars = $$(".dbar > div", sec), n = caps.length, on = -1;
    sec._seq = { i: 0, t: 0 };
    Z.frame.push(function () {
      var r = sec.getBoundingClientRect();
      if (r.bottom < -Z.vh || r.top > Z.vh * 2) return;
      var dp = clamp(-r.top / Math.max(1, r.height - Z.vh), 0, 1) * (n - 1);
      var di = Math.min(n - 2, Math.floor(dp));
      var dt = dp >= n - 1 ? 1 : smooth(0.42, 1, dp - di);
      sec._seq.i = di; sec._seq.t = dt;
      var act = dt > 0.5 ? di + 1 : di;
      if (act !== on) {
        on = act;
        caps.forEach(function (c, i) { c.classList.toggle("on", i === act); });
        imgs.forEach(function (im, i) { im.classList.toggle("on", i === act); });
        bars.forEach(function (b, i) { b.classList.toggle("on", i === act); });
      }
      bars.forEach(function (b, i) { b.firstElementChild.style.setProperty("--f", clamp(dp - i + 1, 0, 1).toFixed(3)); });
    });
  });

  /* ── Point-cloud sections: which step is on; stage.mjs reads sec._p for the particles. */
  if (!reduced) $$("[data-cloud]").forEach(function (sec) {
    var steps = $$(".cstep", sec), ticks = $$(".ticks i", sec), ctr = $(".ticks span", sec), cuts = (sec.dataset.cuts || "0.3,0.62").split(",").map(Number), on = -2;
    sec._p = -1;
    Z.frame.push(function () {
      var r = sec.getBoundingClientRect();
      var p = -r.top / Math.max(1, r.height - Z.vh);
      sec._p = p;
      if (r.bottom < -Z.vh || r.top > Z.vh * 2) return;
      var st = 0; cuts.forEach(function (c) { if (p >= c) st++; });
      if (st !== on) {
        on = st;
        sec.dataset.step = st;
        steps.forEach(function (s, i) { s.classList.toggle("on", i === st); });
        if (ctr) ctr.textContent = pad(st + 1) + " / " + pad(steps.length);
      }
      var edges = [0].concat(cuts, [1]);
      ticks.forEach(function (t, i) { t.style.setProperty("--f", clamp((p - edges[i]) / (edges[i + 1] - edges[i]), 0, 1).toFixed(3)); });
    });
  });

  /* ── Manifesto: words light up as they pass; columns drift at different speeds. */
  var maniGroups = [];
  maniWords.forEach(function (w) {
    var g = maniGroups.filter(function (x) { return x.el === w.el; })[0];
    if (!g) { g = { el: w.el, words: [] }; maniGroups.push(g); }
    g.words.push(w);
  });
  if (maniGroups.length && !reduced) Z.frame.push(function () {
    maniGroups.forEach(function (g) {
      var r = g.el.getBoundingClientRect();
      if (r.top > Z.vh || r.bottom < 0) return;
      var p = clamp((Z.vh * 0.85 - r.top) / (r.height + Z.vh * 0.3), 0, 1), n = g.words.length;
      g.words.forEach(function (w, k) {
        var o = (0.18 + 0.82 * clamp(p * n * 1.15 - k, 0, 1)).toFixed(3);
        if (w._o !== o) { w._o = o; w.s.style.opacity = o; }
      });
    });
  });
  var drifts = $$("[data-drift]");
  if (drifts.length && !reduced) Z.frame.push(function () {
    if (Z.small()) return;
    drifts.forEach(function (c) {
      var r = c.parentElement.getBoundingClientRect();
      if (r.top > Z.vh || r.bottom < 0) return;
      c.style.transform = "translate3d(0," + ((r.top + r.height / 2 - Z.vh / 2) * +c.dataset.drift).toFixed(1) + "px,0)";
    });
  });

  /* ── Page changes: remember where the click was (the next page's iris opens there) and let a project's picture
     carry its name across, so it flies into the project's hero. */
  document.addEventListener("click", function (e) {
    var a = e.target.closest("a[href]");
    if (!a || a.target || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    try { sessionStorage.setItem("zirve-vt", JSON.stringify({ x: Math.round((e.clientX / innerWidth) * 100), y: Math.round((e.clientY / innerHeight) * 100), t: Date.now() })); } catch (err) {}
    var vt = a.dataset.vt, pic = vt && ($(".gimg", a) || $('[data-vt-pic="' + vt + '"]'));
    if (pic) { $$(".vt-proj").forEach(function (o) { if (!o.closest(".ph")) { o.style.viewTransitionName = ""; o.classList.remove("vt-proj"); } }); pic.style.viewTransitionName = "p-" + vt; pic.classList.add("vt-proj"); }
  }, true);
  /* WebGL pictures are invisible <img>s with their copy on the canvas; show the <img>s for the snapshot. */
  addEventListener("pageswap", function (e) { if (e.viewTransition) $$(".gl-ready").forEach(function (el) { el.classList.remove("gl-ready"); }); });
  addEventListener("pageshow", function (e) { if (e.persisted) document.dispatchEvent(new CustomEvent("z:restore")); });

  requestAnimationFrame(loop);
})();
