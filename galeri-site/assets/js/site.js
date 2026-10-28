/* Galeri: shared behaviour for every page. Page scripts (assets/js/<page>.js) run after this one and use window.UZM.
   The site is a monograph: plates are registered here once, and the running head, the folio, the contents page and the
   plate rail all read from that register. */
(function () {
  var doc = document.documentElement, body = document.body;
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (n, a, b) { return Math.min(b, Math.max(a, n)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var fmt = new Intl.NumberFormat("tr-TR");

  var U = (window.UZM = {
    reduced: reduced, fine: fine, $: $, $$: $$, clamp: clamp, lerp: lerp, fmt: fmt,
    onScroll: [], onLayout: [], root: body.dataset.root, assets: body.dataset.assets
  });

  /* Scroll lock, shared by the contents page and the dialogs; Lenis pauses while anything is open. */
  var locks = 0;
  U.lock = function () { if (locks++ === 0) { doc.style.overflow = "hidden"; if (window.__lenis) window.__lenis.stop(); } };
  U.unlock = function () { if (locks > 0 && --locks === 0) { doc.style.overflow = ""; if (window.__lenis) window.__lenis.start(); } };
  U.scrollTo = function (el, offset) {
    if (window.__lenis) return window.__lenis.scrollTo(el, { offset: offset == null ? -(innerHeight * 0.12) : offset, duration: 1.4 });
    var y = el.getBoundingClientRect().top + scrollY + (offset == null ? -(innerHeight * 0.12) : offset);
    scrollTo({ top: y, behavior: reduced ? "auto" : "smooth" });
  };

  /* ── The plate register ─────────────────────────────────────────────────── */
  var plates = $$("[data-plate]").map(function (el) {
    var f = $(".fig", el), cap = $("figcaption", el) || $(".cap", el), img = $("img", el);
    var n = f ? (f.textContent.match(/\d+/) || [""])[0] : "";
    var t = cap ? cap.textContent.replace(f ? f.textContent : "", "").replace(/\s+/g, " ").trim() : "";
    if (!el.id && n) el.id = "levha-" + n;
    return { el: el, n: n, t: t, img: img };
  }).filter(function (p) { return p.n; });
  U.plates = plates;
  var srcOf = function (img) { return img ? img.currentSrc || img.getAttribute("src") || "" : ""; };

  /* Which plates are on screen: kept by an observer, so the scroll handler only measures those. */
  var visible = new Set();
  if (plates.length) {
    var pio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) visible.add(e.target); else visible.delete(e.target); });
      if (U.refresh) requestAnimationFrame(U.refresh);
    });
    plates.forEach(function (p) { pio.observe(p.el); });
  }
  var byEl = new Map(plates.map(function (p) { return [p.el, p]; }));
  var currentPlate = function (vh) {
    var best = null, bestD = Infinity;
    visible.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.bottom < vh * 0.12 || r.top > vh * 0.88) return;
      var d = Math.abs(r.top + r.height / 2 - vh / 2);
      if (d < bestD) { bestD = d; best = byEl.get(el); }
    });
    return best;
  };

  /* ── Header: masthead at the top; the running head while reading ──────── */
  var hdr = $("#hdr"), runS = $(".run-s", hdr), folio = $(".hdr-folio", hdr);
  var heads = $$("[data-head]");
  var lastY = scrollY, reading = false, lastHead = null, lastFolio = null;
  var setReading = function (on) { if (on !== reading) { reading = on; hdr.classList.toggle("reading", on); } };
  hdr.addEventListener("focusin", function () { setReading(false); });
  U.onScroll.push(function (y, vh) {
    hdr.classList.toggle("scrolled", y > 8);
    var max = doc.scrollHeight - vh;
    hdr.style.setProperty("--prog", max > 0 ? clamp(y / max, 0, 1).toFixed(4) : 0);
    var dy = y - lastY;
    if (y < vh * 0.4) setReading(false);
    else if (dy > 6 && !hdr.contains(document.activeElement)) setReading(true);
    else if (dy < -10) setReading(false);
    if (Math.abs(dy) > 2) lastY = y;
    var h = null;
    for (var i = 0; i < heads.length; i++) { if (heads[i].getBoundingClientRect().top < vh * 0.4) h = heads[i]; }
    if (h !== lastHead) { lastHead = h; runS.textContent = h ? h.dataset.head : ""; }
    var p = currentPlate(vh);
    var f = p ? "Levha " + p.n : "";
    if (f !== lastFolio && (p || y < vh * 0.3)) { lastFolio = f; folio.textContent = f; markRail(p); }
  });

  /* ── İçindekiler: the contents page ─────────────────────────────────── */
  var panel = $("#icindekiler"), tocBtn = $(".hdr-toc", hdr);
  var behind = [".skip", "#hdr", "main", ".ftr", ".pres"].map(function (s) { return $(s); }).filter(Boolean);
  var front = $(".toc-front", panel), frontImg = $(".toc-front img", panel), frontFig = $(".toc-front .fig", panel), frontT = $(".toc-front-t", panel);
  var tocLinks = $$(".toc-list a", panel);
  var curLink = $(".toc-list a[aria-current]", panel);
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  tocBtn.setAttribute("role", "button");
  var showFront = function (a) {
    if (!a || !a.dataset.front) return;
    var src = a.dataset.front;
    frontFig.textContent = a.querySelector(".toc-p").textContent;
    frontT.textContent = a.querySelector(".toc-t").textContent;
    if (frontImg.getAttribute("src") === src) return;
    if (!frontImg.getAttribute("src") || reduced) { frontImg.src = src; return; }
    front.classList.add("swap");
    setTimeout(function () { frontImg.src = src; frontImg.onload = function () { front.classList.remove("swap"); }; }, 220);
  };
  tocLinks.forEach(function (a) {
    a.addEventListener("pointerenter", function () { showFront(a); });
    a.addEventListener("focus", function () { showFront(a); });
  });
  /* This chapter's plates, as a little contact sheet; built the first time the contents page opens. */
  var sheetBuilt = false;
  var buildSheet = function () {
    if (sheetBuilt || !plates.length) return;
    sheetBuilt = true;
    var ol = $(".toc-sheet", panel);
    plates.forEach(function (p) {
      var li = document.createElement("li");
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", "Levha " + p.n + (p.t ? ": " + p.t : ""));
      var s = document.createElement("span"); s.textContent = p.n;
      var src = srcOf(p.img);
      if (src) { var im = document.createElement("img"); im.alt = ""; im.loading = "lazy"; im.decoding = "async"; im.src = src; b.appendChild(im); }
      else b.classList.add("txt");
      b.appendChild(s);
      b.addEventListener("click", function () { setToc(false, true); goPlate(p); });
      li.appendChild(b); ol.appendChild(li);
    });
    $(".toc-plates", panel).hidden = false;
  };
  var tocOpen = false;
  var setToc = function (open, keepFocus) {
    if (open === tocOpen) return;
    tocOpen = open;
    panel.classList.toggle("open", open);
    tocBtn.setAttribute("aria-expanded", open);
    behind.forEach(function (el) { el.inert = open; });
    if (open) {
      buildSheet();
      showFront(curLink || tocLinks[0]);
      U.lock();
      setTimeout(function () { $("[data-toc-close]", panel).focus(); }, 30);
    } else {
      U.unlock();
      if (!keepFocus) tocBtn.focus({ preventScroll: true });
    }
  };
  tocBtn.addEventListener("click", function (e) { e.preventDefault(); setToc(true); });
  tocBtn.addEventListener("keydown", function (e) { if (e.key === " ") { e.preventDefault(); setToc(true); } });
  $("[data-toc-close]", panel).addEventListener("click", function (e) { e.preventDefault(); setToc(false); });
  tocLinks.forEach(function (a) { a.addEventListener("click", function () { if (a.hasAttribute("aria-current")) setToc(false); }); });
  addEventListener("keydown", function (e) { if (e.key === "Escape" && tocOpen) setToc(false); });
  /* Without JS the contents page opens with :target; with JS, a stray #icindekiler in the address opens it properly. */
  if (location.hash === "#icindekiler") { history.replaceState(null, "", location.pathname + location.search); setTimeout(function () { setToc(true); }, 60); }

  var goPlate = function (p) {
    U.scrollTo(p.el);
    p.el.setAttribute("tabindex", "-1");
    setTimeout(function () { p.el.focus({ preventScroll: true }); }, reduced ? 0 : 900);
  };

  /* ── The plate rail: a tick for each plate at its place in the chapter ─── */
  var rail = null, railBtns = [], railTip, railView, ftr = $(".ftr");
  function markRail(p) { railBtns.forEach(function (b) { b.classList.toggle("cur", !!p && b._p === p); }); }
  if (plates.length > 2) {
    rail = document.createElement("div");
    rail.className = "rail"; rail.setAttribute("aria-hidden", "true");
    rail.innerHTML = '<div class="rail-view"></div><div class="rail-tip"><img alt=""><p></p></div>';
    railView = $(".rail-view", rail); railTip = $(".rail-tip", rail);
    plates.forEach(function (p) {
      var b = document.createElement("button");
      b.type = "button"; b.tabIndex = -1; b._p = p;
      b.addEventListener("pointerenter", function () {
        var im = $("img", railTip), src = srcOf(p.img);
        im.hidden = !src;
        if (src) im.src = src;
        $("p", railTip).innerHTML = "<b>Levha " + p.n + "</b>";
        $("p", railTip).appendChild(document.createTextNode(p.t));
        railTip.style.top = clamp(parseFloat(b.style.top) / 100 * rail.clientHeight - 60, 0, rail.clientHeight - 170) + "px";
        railTip.classList.add("on");
      });
      b.addEventListener("pointerleave", function () { railTip.classList.remove("on"); });
      b.addEventListener("click", function () { goPlate(p); });
      rail.appendChild(b); railBtns.push(b);
    });
    body.appendChild(rail);
    U.onLayout.push(function () {
      var H = doc.scrollHeight;
      railBtns.forEach(function (b) {
        var r = b._p.el.getBoundingClientRect();
        b.style.top = ((r.top + scrollY + r.height / 2) / H * 100).toFixed(2) + "%";
      });
    });
    U.onScroll.push(function (y, vh) {
      var H = doc.scrollHeight;
      rail.classList.toggle("on", y > vh * 0.6 && !tocOpen && (!ftr || ftr.getBoundingClientRect().top > vh * 0.7));
      railView.style.setProperty("--v0", (y / H).toFixed(4));
      railView.style.setProperty("--v1", ((y + vh) / H).toFixed(4));
    });
  }

  /* ── Reveals and count-ups ──────────────────────────────────────────── */
  var countUp = function (el) {
    var to = +el.dataset.count;
    if (reduced || el._counted) return;
    el._counted = true;
    var dec = (el.dataset.count.split(".")[1] || "").length;
    var nf = dec ? new Intl.NumberFormat("tr-TR", { minimumFractionDigits: dec, maximumFractionDigits: dec }) : fmt;
    var t0 = performance.now(), D = +el.dataset.dur || 1700;
    (function tick(t) {
      var k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 4);
      el.textContent = nf.format(dec ? to * e : Math.round(to * e));
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
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
  U.observe = function (el) { io.observe(el); };
  $$("[data-r], .curtain, .rule-draw, [data-count], [data-inview]").forEach(function (el) { io.observe(el); });

  /* ── Paragraphs read into ink: each word darkens as the eye reaches it ── */
  var inks = $$("[data-ink]").map(function (p) {
    var wrap = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(part));
            else { var s = document.createElement("span"); s.className = "w"; s.textContent = part; frag.appendChild(s); }
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) wrap(n);
      });
    };
    wrap(p);
    var words = $$(".w", p);
    if (reduced) words.forEach(function (w) { w.classList.add("lit"); });
    return { p: p, words: words, lit: reduced ? words.length : 0 };
  });
  if (!reduced && inks.length) U.onScroll.push(function (y, vh) {
    inks.forEach(function (o) {
      var r = o.p.getBoundingClientRect();
      if (r.bottom < -vh || r.top > vh * 2) return;
      var k = clamp((vh * 0.84 - r.top) / (r.height + vh * 0.3), 0, 1);
      var lit = Math.round(k * o.words.length);
      if (lit === o.lit) return;
      o.words.forEach(function (w, i) { w.classList.toggle("lit", i < lit); });
      o.lit = lit;
    });
  });

  /* ── Horizontal runs of plates, ridden by the vertical scroll ─────────── */
  var runs = $$(".hs").map(function (hs) { return { hs: hs, track: $(".track", hs), stage: $(".hs-stage", hs), run: 0, flat: true, imgs: $$(".panel .pic img", hs) }; });
  U.onLayout.unshift(function () {
    runs.forEach(function (o) {
      o.flat = reduced || innerWidth < 900;
      o.hs.classList.toggle("flat", o.flat);
      if (o.flat) { o.stage.tabIndex = 0; o.stage.setAttribute("role", "region"); o.stage.setAttribute("aria-label", "Yana kayan görseller"); }
      else { o.stage.removeAttribute("tabindex"); o.stage.removeAttribute("role"); o.stage.removeAttribute("aria-label"); }
      if (o.flat) { o.hs.style.height = ""; o.track.style.removeProperty("--tx"); return; }
      o.run = Math.max(0, o.track.scrollWidth - innerWidth);
      o.hs.style.height = innerHeight + o.run + "px";
    });
  });
  U.onScroll.push(function (y, vh) {
    runs.forEach(function (o) {
      if (o.flat) return;
      var r = o.hs.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      var k = o.run ? clamp(-r.top / o.run, 0, 1) : 0;
      o.track.style.setProperty("--tx", (-k * o.run).toFixed(1) + "px");
      o.stage.style.setProperty("--hp", k.toFixed(4));
      o.imgs.forEach(function (img) {
        var b = img.parentElement.getBoundingClientRect();
        if (b.right < 0 || b.left > innerWidth) return;
        var c = (b.left + b.width / 2 - innerWidth / 2) / innerWidth;
        img.style.setProperty("--px", (-c * 40).toFixed(1) + "px");
      });
    });
  });

  /* ── Films: the still covers each until it plays; plays only near the screen; a button stops it for good ── */
  $$("video[data-film]").forEach(function (v) {
    var host = v.closest("[data-film-host]") || v.parentElement;
    var still = $(".poster-still", host);
    if (reduced || (navigator.connection && navigator.connection.saveData)) return;
    var loaded = false, userPaused = false, start = +v.dataset.start || 0;
    var load = function () {
      if (loaded) return;
      loaded = true;
      var tall = matchMedia("(max-aspect-ratio: 4/5)").matches;
      v.src = tall && v.dataset.filmTall ? v.dataset.filmTall : v.dataset.film;
      if (start) v.addEventListener("loadedmetadata", function () { try { if (v.currentTime < start - 0.1) v.currentTime = start; } catch (e) {} }, { once: true });
      v.addEventListener("timeupdate", function reveal() { if (v.currentTime > Math.max(0.05, start - 0.05)) { if (still) still.classList.add("gone"); v.removeEventListener("timeupdate", reveal); } });
      v.muted = true;
    };
    var play = function () { load(); var p = v.play(); if (p && p.catch) p.catch(function () {}); };
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "film-toggle";
    btn.innerHTML = '<i aria-hidden="true"></i><span class="sr">Filmi durdurun</span>';
    btn.setAttribute("aria-pressed", "false");
    btn.addEventListener("click", function () {
      userPaused = !userPaused;
      if (userPaused) v.pause(); else play();
      btn.classList.toggle("paused", userPaused);
      btn.setAttribute("aria-pressed", userPaused);
      btn.lastChild.textContent = userPaused ? "Filmi oynatın" : "Filmi durdurun";
    });
    host.appendChild(btn);
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { if (!userPaused) play(); } else if (loaded) v.pause(); });
    }, { rootMargin: "120px 0px" }).observe(host);
  });

  /* ── Dialogs ─────────────────────────────────────────────────────────── */
  var opener = null;
  U.open = function (dlg, from) {
    if (typeof dlg === "string") dlg = document.getElementById(dlg);
    if (!dlg || dlg.open) return;
    if (tocOpen) setToc(false, true);
    opener = from || document.activeElement;
    U.lock();
    dlg.showModal();
  };
  $$("dialog.dlg").forEach(function (dlg) {
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
    $$("[data-close]", dlg).forEach(function (b) { b.addEventListener("click", function () { dlg.close(); }); });
    dlg.addEventListener("close", function () {
      U.unlock();
      if (opener && opener.focus) opener.focus({ preventScroll: true });
      opener = null;
    });
  });
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-open]");
    if (!b) return;
    e.preventDefault();
    U.open(b.dataset.open, b);
  });

  /* ── The loupe: a lens that magnifies a plan or a plate under the pointer ── */
  var drawn = function (img) {
    var r = img.getBoundingClientRect(), nw = img.naturalWidth, nh = img.naturalHeight;
    if (!nw || !nh) return r;
    var fit = getComputedStyle(img).objectFit;
    var s = fit === "cover" ? Math.max(r.width / nw, r.height / nh) : fit === "contain" ? Math.min(r.width / nw, r.height / nh) : r.width / nw;
    var w = nw * s, h = nh * s;
    return { left: r.left + (r.width - w) / 2, top: r.top + (r.height - h) / 2, width: w, height: h };
  };
  U.loupe = function (box) {
    if (box._loupe) return;
    var Z = parseFloat(box.dataset.loupe) || 2.5;
    var lens = document.createElement("div");
    lens.className = "loupe"; lens.setAttribute("aria-hidden", "true");
    box.appendChild(lens);
    var touchBtn = null, lensOn = false;
    if (!fine) {
      touchBtn = document.createElement("button");
      touchBtn.type = "button"; touchBtn.className = "loupe-btn"; touchBtn.setAttribute("aria-pressed", "false");
      touchBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M11 11l4 4" stroke="currentColor" stroke-width="1.3"/></svg>Büyüteç';
      touchBtn.addEventListener("click", function () {
        lensOn = !lensOn;
        touchBtn.setAttribute("aria-pressed", lensOn);
        box.classList.toggle("lens-on", lensOn);
        if (!lensOn) lens.classList.remove("on");
      });
      box.appendChild(touchBtn);
    } else {
      var tag = document.createElement("span");
      tag.className = "loupe-tag"; tag.setAttribute("aria-hidden", "true");
      tag.textContent = "Büyüteç ×" + String(Z).replace(".", ",");
      box.appendChild(tag);
    }
    var raf = 0, ev = null;
    var paint = function () {
      raf = 0;
      var img = $("img.on", box) || $("img", box);
      if (!img || !ev) return;
      var d = drawn(img), c = box.getBoundingClientRect();
      var px = ev.clientX - d.left, py = ev.clientY - d.top;
      if (px < 0 || py < 0 || px > d.width || py > d.height) { lens.classList.remove("on"); return; }
      var L = Math.round(clamp(Math.min(c.width, c.height) * 0.36, 120, 230));
      var src = srcOf(img);
      if (lens._src !== src) { lens._src = src; lens.style.backgroundImage = 'url("' + src + '")'; }
      lens.style.setProperty("--ls", L + "px");
      var lift = ev.pointerType === "touch" ? L * 0.75 : 0;
      lens.style.setProperty("--lx", (ev.clientX - c.left - L / 2).toFixed(1) + "px");
      lens.style.setProperty("--ly", (ev.clientY - c.top - L / 2 - lift).toFixed(1) + "px");
      lens.style.backgroundSize = (d.width * Z).toFixed(1) + "px " + (d.height * Z).toFixed(1) + "px";
      lens.style.backgroundPosition = (-(px * Z - L / 2)).toFixed(1) + "px " + (-(py * Z - L / 2 + 0)).toFixed(1) + "px";
      lens.classList.add("on");
    };
    var move = function (e) {
      if (e.pointerType !== "mouse" && !lensOn) return;
      if (e.pointerType === "mouse" && !fine) return;
      ev = e;
      if (!raf) raf = requestAnimationFrame(paint);
    };
    box.addEventListener("pointermove", move);
    box.addEventListener("pointerdown", move);
    box.addEventListener("pointerleave", function () { lens.classList.remove("on"); });
    box.addEventListener("pointerup", function (e) { if (e.pointerType !== "mouse") lens.classList.remove("on"); });
    box._loupe = true;
  };
  $$("[data-loupe]").forEach(U.loupe);

  /* ── Plan sheets: UZM.openPlan({ title, sheets: [{ src, w, h, label }], start }) ── */
  var plan = $("#plan"), planImg = $("#plan .plan-sheet img"), planTabs = $("#plan .plan-tabs"), planTitle = $("#plan-title");
  var showSheet = function (o, i) {
    var s = o.sheets[i];
    planImg.src = s.src; planImg.width = s.w; planImg.height = s.h;
    planImg.alt = o.title + (s.label ? ", " + s.label : "") + " kat planı";
    $$("button", planTabs).forEach(function (b, k) { b.setAttribute("aria-pressed", k === i); });
  };
  U.openPlan = function (o, from) {
    planTitle.textContent = o.title + " · Kat planı";
    planTabs.innerHTML = "";
    planTabs.hidden = o.sheets.length < 2;
    o.sheets.forEach(function (s, i) {
      var b = document.createElement("button");
      b.type = "button"; b.textContent = s.label;
      b.addEventListener("click", function () { showSheet(o, i); });
      planTabs.appendChild(b);
    });
    showSheet(o, o.start || 0);
    U.open(plan, from);
  };
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-plan]");
    if (!b) return;
    e.preventDefault();
    U.openPlan({ title: b.dataset.plan, sheets: JSON.parse(b.dataset.sheets), start: +b.dataset.start || 0 }, b);
  });

  /* ── The contact sheet: links with data-lb="group" open their plate; data-cap is the caption ── */
  var lb = $("#lb"), lbImg = $(".lb-frame img", lb), lbCap = $(".lb-cap", lb), lbCount = $(".lb-count", lb);
  var lbStrip = $(".lb-strip", lb), lbFilm = $(".lb-film", lb), lbMode = $(".lb-mode", lb), lbTitle = $(".lb-title", lb);
  var group = [], at = 0;
  var MARK = '<svg class="mark" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" vector-effect="non-scaling-stroke" d="M6 9 C30 4 68 6 95 5 C97 33 95 66 96 93 C68 97 34 95 5 96 C3 70 5 38 3 12 C4 7 9 5 14 4"/></svg>';
  var numOf = function (a) { var f = a.closest("[data-plate]"); f = f && $(".fig", f); return f ? (f.textContent.match(/\d+/) || [""])[0] : ""; };
  var lbShow = function (i) {
    at = (i + group.length) % group.length;
    var a = group[at], n = numOf(a), cap = a.dataset.cap || "";
    var go = function () {
      lbImg.src = a.getAttribute("href");
      lbImg.alt = cap;
      lbImg.onload = function () { lbImg.classList.remove("fade"); };
      if (lbImg.complete) lbImg.classList.remove("fade");
    };
    if (lbImg.getAttribute("src") && !reduced) { lbImg.classList.add("fade"); setTimeout(go, 180); } else go();
    lbCap.innerHTML = "";
    if (n) { var f = document.createElement("span"); f.className = "fig"; f.textContent = "Levha " + n; lbCap.appendChild(f); }
    lbCap.appendChild(document.createTextNode(cap));
    lbCount.textContent = (at + 1) + " / " + group.length;
    $$("button", lbStrip).forEach(function (b, k) {
      var old = $("svg.mark", b);
      if (k === at) { b.setAttribute("aria-current", "true"); if (!old) b.insertAdjacentHTML("beforeend", MARK); }
      else { b.removeAttribute("aria-current"); if (old) old.remove(); }
    });
    var cur = $$("li", lbStrip)[at];
    if (cur && !lb.classList.contains("sheet")) lbFilm.scrollTo({ left: cur.offsetLeft - lbFilm.clientWidth / 2 + cur.offsetWidth / 2, behavior: reduced ? "auto" : "smooth" });
    var one = group.length < 2;
    $(".lb-prev", lb).hidden = one; $(".lb-next", lb).hidden = one; lbFilm.hidden = one; lbMode.hidden = one;
  };
  var setSheet = function (on) { lb.classList.toggle("sheet", on); lbMode.setAttribute("aria-pressed", on); };
  document.addEventListener("click", function (e) {
    var a = e.target.closest("a[data-lb]");
    if (!a) return;
    e.preventDefault();
    group = $$('a[data-lb="' + a.dataset.lb + '"]');
    lbTitle.textContent = "Temas baskısı · " + (a.dataset.lbTitle || group[0].dataset.lbTitle || "Levhalar");
    lbStrip.innerHTML = "";
    group.forEach(function (g, k) {
      var li = document.createElement("li"), b = document.createElement("button");
      b.type = "button";
      var n = numOf(g);
      b.setAttribute("aria-label", (n ? "Levha " + n + ": " : "") + (g.dataset.cap || ""));
      var im = document.createElement("img"); im.alt = ""; im.loading = "lazy"; im.src = srcOf($("img", g)) || g.getAttribute("href");
      var fn = document.createElement("span"); fn.className = "fn"; fn.setAttribute("aria-hidden", "true"); fn.textContent = "▸ " + (n || k + 1) + "A";
      b.append(im, fn);
      b.addEventListener("click", function () { setSheet(false); lbShow(k); });
      li.appendChild(b); lbStrip.appendChild(li);
    });
    setSheet(false);
    lbImg.removeAttribute("src");
    lbShow(group.indexOf(a));
    U.open(lb, a);
  });
  $(".lb-prev", lb).addEventListener("click", function () { lbShow(at - 1); });
  $(".lb-next", lb).addEventListener("click", function () { lbShow(at + 1); });
  lbMode.addEventListener("click", function () { setSheet(!lb.classList.contains("sheet")); });
  lb.addEventListener("keydown", function (e) {
    if (e.target.closest("input, select, textarea")) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); lbShow(at - 1); }
    if (e.key === "ArrowRight") { e.preventDefault(); lbShow(at + 1); }
  });
  var swiped = false;
  lb.addEventListener("click", function (e) { if (swiped) { swiped = false; return; } if (e.target.classList.contains("lb-frame") || e.target.classList.contains("lb-fig")) lb.close(); });
  /* A swipe across the plate turns to the next or previous one. */
  var sx = null;
  $(".lb-fig", lb).addEventListener("pointerdown", function (e) { if (e.pointerType !== "mouse") sx = e.clientX; });
  $(".lb-fig", lb).addEventListener("pointerup", function (e) {
    if (sx === null) return;
    var dx = e.clientX - sx; sx = null;
    if (Math.abs(dx) > 48 && group.length > 1) { swiped = true; setTimeout(function () { swiped = false; }, 400); lbShow(at + (dx < 0 ? 1 : -1)); }
  });

  /* ── The construction diary: a strip of negatives ─────────────────────── */
  $$(".diary").forEach(function (d) {
    var railEl = $(".diary-rail", d), bar = $(".diary-bar", d), prev = $(".diary-prev", d), next = $(".diary-next", d);
    if (!railEl) return;
    var upd = function () {
      var max = railEl.scrollWidth - railEl.clientWidth;
      if (bar) { bar.style.setProperty("--w", (railEl.clientWidth / railEl.scrollWidth).toFixed(3)); bar.style.setProperty("--a", (railEl.scrollLeft / railEl.scrollWidth).toFixed(3)); }
      if (prev) prev.disabled = railEl.scrollLeft < 4;
      if (next) next.disabled = railEl.scrollLeft > max - 4;
    };
    var step = function (k) { var e = $(".entry", railEl); railEl.scrollBy({ left: k * (e ? e.offsetWidth + 24 : 300), behavior: reduced ? "auto" : "smooth" }); };
    if (prev) prev.addEventListener("click", function () { step(-1); });
    if (next) next.addEventListener("click", function () { step(1); });
    railEl.addEventListener("scroll", upd, { passive: true });
    U.onLayout.push(upd);
  });

  /* ── Demo forms: checked in the browser, never sent; the note says so ── */
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
      if (!err) {
        err = document.createElement("span"); err.className = "err"; err.id = id;
        if (wrap.classList.contains("check")) wrap.after(err); else wrap.appendChild(err);
      }
      err.textContent = msg;
      el.setAttribute("aria-invalid", "true");
      el.setAttribute("aria-describedby", id);
    } else {
      if (err) err.remove();
      el.removeAttribute("aria-invalid");
      el.removeAttribute("aria-describedby");
    }
  };
  $$("form[data-demo]").forEach(function (f) {
    var fields = $$("input, select, textarea", f);
    fields.forEach(function (el) {
      el.addEventListener(el.type === "checkbox" || el.tagName === "SELECT" ? "change" : "input", function () {
        if (el.getAttribute("aria-invalid")) mark(el, problem(el));
      });
    });
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var first = null;
      fields.forEach(function (el) { var msg = problem(el); mark(el, msg); if (msg && !first) first = el; });
      if (first) { first.focus(); return; }
      var note = $(".form-sent", f);
      $$(".field, .check, button[type=submit], .err", f).forEach(function (el) { el.hidden = true; });
      f.classList.add("sent");
      if (note) { note.hidden = false; note.setAttribute("tabindex", "-1"); note.focus(); }
      f.dispatchEvent(new CustomEvent("uzm:sent", { bubbles: true }));
    });
  });

  /* ── The colophon's grid: twelve columns and the baseline, on request ── */
  var gridBtn = $(".grid-btn");
  if (gridBtn) gridBtn.addEventListener("click", function () {
    var on = doc.classList.toggle("show-grid");
    gridBtn.setAttribute("aria-pressed", on);
    gridBtn.textContent = on ? "Izgarayı gizleyin" : "Izgarayı gösterin";
  });

  /* ── The presenter pill steps aside while reading down, and comes back on the way up and at the end ── */
  var pres = $(".pres"), pY = scrollY;
  if (pres) U.onScroll.push(function (y, vh) {
    var dy = y - pY;
    if (Math.abs(dy) < 6) return;
    var end = y + vh >= doc.scrollHeight - 80;
    pres.classList.toggle("away", dy > 0 && y > vh * 0.5 && !end);
    pY = y;
  });

  /* ── Page to page: the leaf turns. A plate may carry over into the next chapter's opening spread. ── */
  document.addEventListener("click", function (e) {
    var a = e.target.closest("a[data-morph]");
    if (a) U._morphFrom = a;
  }, true);
  addEventListener("pageswap", function (e) {
    var vt = e.viewTransition;
    if (!vt) return;
    try {
      var act = e.activation;
      if (act && act.navigationType === "traverse" && act.from && act.entry && act.entry.index < act.from.index) { vt.types.add("back"); return; }
      var a = U._morphFrom;
      if (a && act && act.entry && act.entry.url && a.href && act.entry.url.split("#")[0] === a.href.split("#")[0]) {
        var img = $("[data-morph-src]", a) || $("img", a);
        if (img) { img.style.viewTransitionName = "plate-" + a.dataset.morph; img.style.setProperty("view-transition-class", "plate-morph"); }
        sessionStorage.setItem("vt-morph", a.dataset.morph);
      } else sessionStorage.removeItem("vt-morph");
    } catch (x) {}
  });
  addEventListener("pageshow", function () {
    $$("[style*='view-transition-name']").forEach(function (el) { if (!el.matches("[data-morph-target]")) el.style.viewTransitionName = ""; });
  });

  /* ── The scroll loop: one rAF-throttled handler ───────────────────────── */
  var ticking = false;
  var onScroll = function () {
    ticking = false;
    var y = scrollY, vh = innerHeight;
    for (var i = 0; i < U.onScroll.length; i++) U.onScroll[i](y, vh);
  };
  var layout = function () { U.onLayout.forEach(function (fn) { fn(); }); onScroll(); };
  U.refresh = onScroll;
  U.layout = layout;
  addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  var rT = 0;
  addEventListener("resize", function () { clearTimeout(rT); rT = setTimeout(layout, 120); });
  addEventListener("load", layout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  setTimeout(layout, 0);

  /* ── Weighted scrolling on desktop pointers ───────────────────────────── */
  if (!reduced && fine) {
    var ls = document.createElement("script");
    ls.src = "https://cdn.jsdelivr.net/npm/lenis@1.1.13/dist/lenis.min.js";
    ls.onload = function () {
      if (!window.Lenis) return;
      var lenis = new window.Lenis({ lerp: 0.1, wheelMultiplier: 0.95, smoothWheel: true });
      window.__lenis = lenis;
      if (locks > 0) lenis.stop();
      (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(performance.now());
      $$('a[href^="#"]').forEach(function (a) {
        var id = a.getAttribute("href");
        if (id.length < 2 || id === "#icindekiler" || id === "#kapat") return;
        a.addEventListener("click", function (e) {
          var t = document.getElementById(decodeURIComponent(id.slice(1)));
          if (!t) return;
          e.preventDefault();
          lenis.scrollTo(t, { offset: -(innerHeight * 0.1), duration: 1.5 });
        });
      });
    };
    body.appendChild(ls);
  }
})();
