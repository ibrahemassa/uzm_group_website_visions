/* Ufuk: shared behaviour for every page. Page scripts (assets/js/<page>.js) run after this one and use window.UZM. */
(function () {
  "use strict";
  var d = document, doc = d.documentElement;
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  var $ = function (s, r) { return (r || d).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b === undefined ? 1 : b, Math.max(a || 0, v)); };
  var ease = function (t) { return 1 - Math.pow(1 - t, 3); };
  var pad = function (n) { return String(n).padStart(2, "0"); };
  var nf = {};
  var fmt = function (v, dec) { dec = dec || 0; return (nf[dec] = nf[dec] || new Intl.NumberFormat("tr-TR", { minimumFractionDigits: dec, maximumFractionDigits: dec })).format(v); };
  /* Timecode, film style: hh:mm:ss:ff at 25 frames a second. */
  var tc = function (t) { t = Math.max(0, t || 0); var f = Math.floor((t % 1) * 25), s = Math.floor(t); return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor(s / 60) % 60) + ":" + pad(s % 60) + ":" + pad(f); };
  /* Progress through a tall (pinned) element: 0 when its top meets the top of the screen, 1 when its bottom meets the bottom. */
  var prog = function (el) { var r = el.getBoundingClientRect(), run = r.height - innerHeight; return run > 0 ? clamp(-r.top / run) : (r.top <= 0 ? 1 : 0); };
  /* Progress of an element across the screen: 0 as it enters at the bottom, 1 as it leaves at the top. */
  var view = function (el) { var r = el.getBoundingClientRect(); return clamp((innerHeight - r.top) / (innerHeight + r.height)); };
  var near = function (el, m) { var r = el.getBoundingClientRect(); m = m === undefined ? 0.25 : m; return r.bottom > -innerHeight * m && r.top < innerHeight * (1 + m); };

  var U = (window.UZM = { reduced: reduced, fine: fine, $: $, $$: $$, clamp: clamp, ease: ease, pad: pad, fmt: fmt, tc: tc, prog: prog, view: view, near: near, frame: [], root: d.body.dataset.root, assets: d.body.dataset.assets });

  /* ── Scroll lock, shared by the menu and the dialogs; Lenis and running films pause while anything is open. ── */
  var locks = 0;
  U.onLock = [];
  U.lock = function () { if (locks++ === 0) { doc.style.overflow = "hidden"; if (U.lenis) U.lenis.stop(); U.onLock.forEach(function (f) { f(true); }); } };
  U.unlock = function () { if (locks > 0 && --locks === 0) { doc.style.overflow = ""; if (U.lenis) U.lenis.start(); U.onLock.forEach(function (f) { f(false); }); } };
  U.locked = function () { return locks > 0; };

  /* ── Reveals: masked lines rise, pictures wipe in, blocks fade up. ── */
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.1 });
  var hero = $(".ttl");
  $$("[data-reveal]").forEach(function (el) { if (!hero || !hero.contains(el)) io.observe(el); });
  U.observe = function (el) { io.observe(el); };

  /* The title card: on a first visit of the home page the opening card holds the letterbox closed, then lifts. */
  var openHero = function () { if (hero) $$("[data-reveal]", hero).forEach(function (el) { el.classList.add("in"); }); };
  var opening = $(".opening");
  if (opening && doc.classList.contains("tc-on")) {
    try { sessionStorage.setItem("ufuk-open", "1"); } catch (e) {}
    var lifted = false;
    var lift = function (fast) {
      if (lifted) return;
      lifted = true;
      opening.classList.add("lift");
      doc.classList.remove("tc-hold");
      setTimeout(openHero, fast ? 120 : 250);
      setTimeout(function () { doc.classList.remove("tc-on"); opening.remove(); }, 800);
      ["pointerdown", "keydown", "wheel", "touchstart"].forEach(function (t) { removeEventListener(t, skip); });
    };
    var skip = function () { lift(true); };
    ["pointerdown", "keydown", "wheel", "touchstart"].forEach(function (t) { addEventListener(t, skip, { passive: true }); });
    setTimeout(function () { lift(false); }, 2500);
  } else {
    doc.classList.remove("tc-on", "tc-hold");
    if (opening) opening.remove();
    requestAnimationFrame(function () { requestAnimationFrame(openHero); });
  }

  /* ── Counters count up once, the first time their block is well in view. ── */
  var countUp = function (el) {
    if (el.dataset.done) return;
    el.dataset.done = "1";
    var v = +el.dataset.v, dec = +(el.dataset.d || 0);
    if (reduced) { el.textContent = fmt(v, dec); return; }
    var t0 = performance.now(), D = 1700;
    (function step(t) { var k = clamp((t - t0) / D); el.textContent = fmt(v * (1 - Math.pow(1 - k, 4)), dec); if (k < 1) requestAnimationFrame(step); })(t0);
  };
  if (!reduced) $$(".cnt").forEach(function (el) { el.textContent = fmt(0, +(el.dataset.d || 0)); });
  var cio = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { $$(".cnt", e.target).forEach(countUp); cio.unobserve(e.target); } });
  }, { threshold: 0.4 });
  $$("[data-counts]").forEach(function (el) { cio.observe(el); });

  /* ── The reel: this page's scenes, counted on the right edge; pointing at it opens the scene index. ── */
  var scenes = $$("[data-scene]");
  var reelCur = null, reelFill = null, reelName = null, reelLinks = [], curScene = null;
  if (scenes.length > 2) {
    var reel = d.createElement("nav");
    reel.className = "reel";
    reel.setAttribute("aria-label", "Bu sayfanın sahneleri");
    var items = scenes.map(function (s, i) {
      if (!s.id) s.id = "sahne-" + pad(i + 1);
      return '<li><a href="#' + s.id + '"><b>' + pad(i + 1) + "</b>" + s.dataset.scene + "</a></li>";
    }).join("");
    reel.innerHTML = '<div class="reel-n" aria-hidden="true"><span class="reel-cur"><span>01</span></span><span class="reel-line"><i></i></span><span class="reel-tot">' + pad(scenes.length) + '</span><span class="reel-name">' + scenes[0].dataset.scene + "</span></div><ol>" + items + "</ol>";
    d.body.appendChild(reel);
    reelCur = $(".reel-cur span", reel); reelFill = $(".reel-line", reel); reelName = $(".reel-name", reel); reelLinks = $$("ol a", reel);
    var setScene = function (s) {
      if (s === curScene) return;
      curScene = s;
      var i = scenes.indexOf(s);
      reelLinks.forEach(function (a, k) { if (k === i) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current"); });
      if (reduced) { reelCur.textContent = pad(i + 1); reelName.textContent = s.dataset.scene; return; }
      reelCur.style.transform = "translateY(-110%)";
      setTimeout(function () {
        reelCur.textContent = pad(i + 1); reelName.textContent = s.dataset.scene;
        reelCur.style.transition = "none"; reelCur.style.transform = "translateY(110%)";
        requestAnimationFrame(function () { reelCur.style.transition = ""; reelCur.style.transform = ""; });
      }, 200);
    };
    var sio = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) setScene(e.target); }); }, { rootMargin: "-50% 0px -50% 0px" });
    scenes.forEach(function (s) { sio.observe(s); });
  }

  /* ── Films that simply play (heroes, the method film): the still stays until the film runs; a film loads after the
     page and plays only while it is on screen; a round button stops it (WCAG 2.2.2). ── */
  var films = [];
  var toggle = function (host, onClick) {
    var b = d.createElement("button");
    b.type = "button"; b.className = "vtg";
    b.innerHTML = '<i aria-hidden="true"></i><span class="sr-only">Filmi durdur</span>';
    b.addEventListener("click", onClick);
    host.appendChild(b);
    b.set = function (paused) { b.classList.toggle("paused", paused); b.lastChild.textContent = paused ? "Filmi oynat" : "Filmi durdur"; b.title = b.lastChild.textContent; };
    b.set(false);
    return b;
  };
  U.toggle = toggle;
  $$("video[data-film]").forEach(function (v) {
    if (reduced || (navigator.connection && navigator.connection.saveData)) return;
    var host = v.closest("section, .ttl, figure") || v.parentElement;
    var f = { v: v, loaded: false, userPaused: false, seen: false };
    var load = function () {
      if (f.loaded) return;
      f.loaded = true;
      var tall = matchMedia("(max-aspect-ratio: 4/5)").matches;
      v.src = tall && v.dataset.filmTall ? v.dataset.filmTall : v.dataset.film;
      v.muted = true;
      v.addEventListener("playing", function () { v.classList.add("playing"); });
    };
    f.play = function () { if (f.userPaused || U.locked() || !f.seen) return; load(); var p = v.play(); if (p && p.catch) p.catch(function () {}); };
    var btn = toggle(host, function () { f.userPaused = !f.userPaused; btn.set(f.userPaused); if (f.userPaused) v.pause(); else f.play(); });
    new IntersectionObserver(function (es) { f.seen = es[0].isIntersecting; if (f.seen) f.play(); else v.pause(); }, { threshold: 0.12 }).observe(host);
    films.push(f);
  });
  /* Load the films only after the page itself has arrived. */
  var afterLoad = function (fn) { if (d.readyState === "complete") setTimeout(fn, 300); else addEventListener("load", function () { setTimeout(fn, 300); }); };
  afterLoad(function () { films.forEach(function (f) { f.play(); }); });
  U.onLock.push(function (on) { films.forEach(function (f) { if (on) f.v.pause(); else f.play(); }); });

  /* ── The scrubbed film: scroll drives the playhead (mouse and trackpad); on touch screens the film plays while its
     scene is on screen; with reduced motion only the still and the captions remain. ── */
  U.scrub = function (sec) {
    var v = $("video", sec), caps = $$(".cap", sec), tcEl = $(".scrub-tc", sec), track = $(".track", sec);
    if (!v) return;
    var tall = matchMedia("(max-aspect-ratio: 4/5)").matches;
    var mode = reduced ? "still" : fine && !tall ? "scrub" : "loop";
    var src = tall && v.dataset.srcTall ? v.dataset.srcTall : v.dataset.src;
    var dur = +v.dataset.dur || 13, cur = 0, ready = false, loaded = false, capIdx = -2, inView = false, userPaused = false;
    if (mode === "still") { caps.forEach(function (c) { c.classList.add("active"); }); return; }
    var load = function () {
      if (loaded) return;
      loaded = true;
      v.preload = "auto";
      v.addEventListener("loadedmetadata", function () { dur = v.duration || dur; });
      v.addEventListener("loadeddata", function () { ready = true; v.classList.add("ready"); if (mode === "loop" && inView && !userPaused && !U.locked()) v.play().catch(function () {}); });
      if (mode === "scrub") {
        /* The whole film is fetched first, so every frame can be reached at once (also from servers without byte ranges). */
        fetch(src).then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); }).then(function (b) { v.src = URL.createObjectURL(b); }).catch(function () {});
      } else { v.loop = true; v.src = src; }
    };
    new IntersectionObserver(function (es) { if (es[0].isIntersecting) load(); }, { rootMargin: "100% 0px" }).observe(sec);
    if (mode === "loop") {
      var btn = toggle($(".scrub-pin", sec), function () { userPaused = !userPaused; btn.set(userPaused); if (userPaused) v.pause(); else if (ready) v.play().catch(function () {}); });
      new IntersectionObserver(function (es) { inView = es[0].isIntersecting; if (inView && ready && !userPaused && !U.locked()) v.play().catch(function () {}); else v.pause(); }, { threshold: 0.1 }).observe(sec);
      U.onLock.push(function (on) { if (on) v.pause(); else if (inView && ready && !userPaused) v.play().catch(function () {}); });
    }
    U.frame.push(function () {
      if (!near(sec, 0)) return;
      var p = prog(sec);
      var i = -1;
      caps.forEach(function (c, k) { if (p >= +c.dataset.from && p < +c.dataset.to) i = k; });
      if (i !== capIdx) { caps.forEach(function (c, k) { c.classList.toggle("active", k === i); }); capIdx = i; }
      var t;
      if (mode === "scrub") {
        var tgt = p * (dur - 0.05);
        cur += (tgt - cur) * 0.16;
        if (Math.abs(tgt - cur) < 0.002) cur = tgt;
        if (ready && !v.seeking && Math.abs(v.currentTime - cur) > 0.03) v.currentTime = cur;
        t = cur;
      } else t = v.currentTime || 0;
      if (track) track.style.setProperty("--k", (mode === "scrub" ? cur / dur : p).toFixed(4));
      if (tcEl) tcEl.textContent = tc(t);
    });
  };

  /* ── Header: hides on the way down, returns on the way up, turns solid past the title card. ── */
  var hdr = $("#hdr"), progEl = $(".prog"), pres = $(".pres");
  var lastY = scrollY, presY = scrollY;
  var heroFull = $(".ttl-full, .ttl-short");
  var tcHero = $(".ttl [data-tc]"), heroVid = $(".ttl video"), t0 = performance.now();
  var menu = $("#menu");
  /* Wide pictures drift a little against the scroll inside their frames. */
  var drifts = $$(".drift, .finale-bg > img");

  var frame = function (t) {
    if (U.lenis) U.lenis.raf(t);
    var y = scrollY, vh = innerHeight, dy = y - lastY;
    if (Math.abs(dy) > 0.5 && !menu.classList.contains("open")) {
      hdr.toggleAttribute("data-hide", dy > 0 && y > vh * 0.6);
      doc.classList.toggle("hdr-in", !hdr.hasAttribute("data-hide") && y > vh * 0.6);
      lastY = y;
    }
    hdr.classList.toggle("solid", y > (hero ? hero.offsetHeight - 80 : 10));
    var max = doc.scrollHeight - vh;
    progEl.style.setProperty("--prog", max > 0 ? (y / max).toFixed(4) : 0);
    if (pres && Math.abs(y - presY) > 8) { pres.classList.toggle("away", y > presY && y > vh * 0.5 && y < max - 80); presY = y; }
    if (curScene && reelFill) reelFill.style.setProperty("--sp", prog(curScene).toFixed(3));
    if (heroFull && !reduced && y < vh * 1.3) heroFull.style.setProperty("--p", clamp(y / heroFull.offsetHeight).toFixed(4));
    if (tcHero && y < vh) tcHero.textContent = tc(heroVid && heroVid.classList.contains("playing") ? heroVid.currentTime : (performance.now() - t0) / 1000);
    if (!reduced) for (var j = 0; j < drifts.length; j++) { var dr = drifts[j]; if (near(dr.parentElement, 0)) dr.style.transform = "translate3d(0," + ((view(dr.parentElement) - 0.5) * -10).toFixed(2) + "%,0)"; }
    for (var i = 0; i < U.frame.length; i++) U.frame[i](t, y, vh);
    requestAnimationFrame(frame);
  };

  /* ── Menu: a scene-selection screen; pointing at an entry shows that page's still. ── */
  var menuBtn = $(".menu-btn"), menuX = $(".menu-x", menu), stillImg = $(".menu-frame img", menu), stillN = $(".menu-still b", menu), stillCap = $(".menu-cap", menu);
  var menuLinks = $$(".menu-list a", menu);
  var behind = [".skip", "#hdr", "main", ".credits", ".pres", ".reel"].map(function (s) { return $(s); }).filter(Boolean);
  var showStill = function (a) {
    menuLinks.forEach(function (x) { x.classList.toggle("on", x === a); });
    if (stillImg.dataset.src === a.dataset.still) return;
    stillImg.dataset.src = a.dataset.still;
    stillImg.classList.add("swap");
    var pre = new Image();
    pre.onload = pre.onerror = function () { stillImg.src = a.dataset.still; requestAnimationFrame(function () { stillImg.classList.remove("swap"); }); };
    pre.src = a.dataset.still;
    stillN.textContent = $(".mn", a).textContent; stillCap.textContent = $(".mt", a).textContent;
  };
  menuLinks.forEach(function (a) { a.addEventListener("pointerenter", function () { showStill(a); }); a.addEventListener("focus", function () { showStill(a); }); });
  var setMenu = function (open) {
    if (open === menu.classList.contains("open")) return;
    menu.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    behind.forEach(function (el) { el.inert = open; });
    if (open) { U.lock(); showStill($(".menu-list a[aria-current]", menu) || menuLinks[0]); setTimeout(function () { menuX.focus(); }, 60); }
    else { U.unlock(); (menuBtn.offsetParent ? menuBtn : $(".logo")).focus({ preventScroll: true }); }
  };
  menuBtn.addEventListener("click", function () { setMenu(true); });
  menuX.addEventListener("click", function () { setMenu(false); });
  menuLinks.forEach(function (a) { a.addEventListener("click", function () { if (a.getAttribute("aria-current")) setMenu(false); }); });
  addEventListener("keydown", function (e) { if (e.key === "Escape" && menu.classList.contains("open")) setMenu(false); });
  /* Tab stays inside the open menu. */
  menu.addEventListener("keydown", function (e) {
    if (e.key !== "Tab") return;
    var f = $$("a, button", menu).filter(function (x) { return x.offsetParent; });
    if (!f.length) return;
    if (e.shiftKey && d.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && d.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });

  /* ── Dialogs: [data-open="id"] opens #id; [data-close] and a click on the backdrop close it; focus goes back. ── */
  var opener = null;
  U.open = function (dlg, from) {
    if (typeof dlg === "string") dlg = d.getElementById(dlg);
    if (!dlg || dlg.open) return;
    if (menu.classList.contains("open")) setMenu(false);
    opener = from || d.activeElement;
    U.lock();
    dlg.showModal();
    dlg.dispatchEvent(new CustomEvent("uzm:open"));
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
  d.addEventListener("click", function (e) {
    var b = e.target.closest("[data-open]");
    if (!b) return;
    e.preventDefault();
    U.open(b.dataset.open, b);
  });

  /* The film, in full and with sound controls. */
  var film = $("#film"), filmVid = film && $("video", film);
  if (film) {
    film.addEventListener("uzm:open", function () {
      if (!filmVid.src) { var tall = matchMedia("(max-aspect-ratio: 4/5)").matches; filmVid.src = tall ? filmVid.dataset.srcTall : filmVid.dataset.src; if (tall) filmVid.poster = U.assets + "img/film--levan-hero-tall.webp"; }
      var p = filmVid.play(); if (p && p.catch) p.catch(function () {});
    });
    film.addEventListener("close", function () { filmVid.pause(); });
  }

  /* Tab lists (plan sheets, type selectors): arrows move along, Home and End jump. */
  U.tabKeys = function (list, pick) {
    list.addEventListener("keydown", function (e) {
      var tabs = $$('[role="tab"]', list), i = tabs.indexOf(d.activeElement);
      if (i < 0) return;
      var k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      var n = k ? (i + k + tabs.length) % tabs.length : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : -1;
      if (n < 0) return;
      e.preventDefault();
      tabs[n].focus();
      pick(n);
    });
  };

  /* ── Plan sheets: U.openPlan({ title, sheets: [{ src, w, h, label }], start }); several sheets get tabs. ── */
  var A = U.assets;
  var sheet = function (key, w, h, label) { return { src: A + "img/levan--plan--" + key + ".webp", w: w, h: h, label: label }; };
  var floors = function (base) { return [sheet(base + "-zemin", 1600, 960, "Zemin kat"), sheet(base + "-1-kat", 1600, 960, "1. kat"), sheet(base + "-bodrum", 1600, 960, "Bodrum")]; };
  U.UNITS = [
    { title: "2+1 Daire", sheets: [sheet("2-1-a", 1600, 918, "2+1 A"), sheet("2-1-b", 1600, 918, "2+1 B"), sheet("2-1-c", 1600, 918, "2+1 C")] },
    { title: "3+1 Daire", sheets: [sheet("3-1-a", 1600, 918, "3+1 A"), sheet("3-1-b", 1600, 918, "3+1 B"), sheet("3-1-c", 1600, 918, "3+1 C")] },
    { title: "4+1 Daire", sheets: [sheet("4-1", 1600, 918, "4+1")] },
    { title: "4+1 İkiz Villa", sheets: floors("ikiz") },
    { title: "5+1 Müstakil Villa", sheets: floors("mustakil") },
    { title: "6+1 Malikane", sheets: [sheet("malikane", 1600, 1194, "6+1")] }
  ];
  var plan = $("#plan"), planImg = $("#plan .plan-sheet img"), planTabs = $("#plan .plan-tabs"), planTitle = $("#plan-title");
  var planSet = null;
  var showSheet = function (i) {
    var s = planSet.sheets[i];
    planImg.src = s.src; planImg.width = s.w; planImg.height = s.h;
    planImg.alt = planSet.title + (s.label ? ", " + s.label : "") + " kat planı";
    $$("button", planTabs).forEach(function (b, k) { b.setAttribute("aria-selected", String(k === i)); b.tabIndex = k === i ? 0 : -1; });
  };
  U.openPlan = function (o, from) {
    planSet = o;
    planTitle.textContent = o.title + " · Kat planı";
    planTabs.innerHTML = "";
    planTabs.hidden = o.sheets.length < 2;
    o.sheets.forEach(function (s, i) {
      var b = d.createElement("button");
      b.type = "button"; b.setAttribute("role", "tab"); b.setAttribute("aria-controls", "plan-sheet"); b.textContent = s.label;
      b.addEventListener("click", function () { showSheet(i); });
      planTabs.appendChild(b);
    });
    showSheet(o.start || 0);
    U.open(plan, from);
  };
  U.tabKeys(planTabs, showSheet);
  d.addEventListener("click", function (e) {
    var b = e.target.closest("[data-unit]");
    if (!b) return;
    var u = U.UNITS[+b.dataset.unit];
    U.openPlan({ title: u.title, sheets: u.sheets, start: +(b.dataset.sheet || 0) }, b);
  });

  /* ── Lightbox: links with data-lb="group" open their href; data-cap is the caption. ── */
  var lb = $("#lb"), lbImg = $("#lb img"), lbCap = $("#lb .lb-cap"), lbCount = $("#lb .lb-count");
  var group = [], at = 0;
  var lbShow = function (i) {
    at = (i + group.length) % group.length;
    var a = group[at];
    lbImg.src = a.getAttribute("href");
    lbImg.alt = a.dataset.alt || a.dataset.cap || "";
    lbCap.textContent = a.dataset.cap || "";
    lbCount.textContent = "Kare " + pad(at + 1) + " / " + pad(group.length);
    var one = group.length < 2;
    $(".lb-nav", lb).hidden = one;
  };
  d.addEventListener("click", function (e) {
    var a = e.target.closest("a[data-lb]");
    if (!a || e.defaultPrevented) return;
    e.preventDefault();
    group = $$('a[data-lb="' + a.dataset.lb + '"]');
    lbShow(group.indexOf(a));
    U.open(lb, a);
  });
  $(".lb-prev", lb).addEventListener("click", function () { lbShow(at - 1); });
  $(".lb-next", lb).addEventListener("click", function () { lbShow(at + 1); });
  lb.addEventListener("keydown", function (e) { if (e.key === "ArrowLeft") lbShow(at - 1); if (e.key === "ArrowRight") lbShow(at + 1); });
  lb.addEventListener("click", function (e) { if (e.target.classList.contains("lb-fig")) lb.close(); });

  /* ── Demo forms: checked in the browser, never sent; the note says so. The slate claps when a form is "sent". ── */
  var today = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
  $$(".slate-date").forEach(function (el) { el.textContent = today; });
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
    var id = el.id + "-err", err = d.getElementById(id);
    if (msg) {
      if (!err) { err = d.createElement("span"); err.className = "err"; err.id = id; if (wrap.classList.contains("check")) wrap.after(err); else wrap.appendChild(err); }
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
    fields.forEach(function (el) { el.addEventListener(el.type === "checkbox" || el.tagName === "SELECT" ? "change" : "input", function () { if (el.getAttribute("aria-invalid")) mark(el, problem(el)); }); });
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var first = null;
      fields.forEach(function (el) { var msg = problem(el); mark(el, msg); if (msg && !first) first = el; });
      if (first) { first.focus(); return; }
      var slate = $(".slate", f);
      if (slate) slate.classList.add("clap");
      var note = $(".form-sent", f);
      setTimeout(function () {
        $$(".field, .check, button[type=submit]", f).forEach(function (el) { el.hidden = true; });
        if (note) { note.hidden = false; note.setAttribute("tabindex", "-1"); note.focus(); }
      }, slate && !reduced ? 650 : 0);
    });
  });

  /* ── Rails (film strips): drag with a mouse, arrow buttons step frame by frame, the track shows the position. ── */
  $$(".rail").forEach(function (rail) {
    var ctl = rail.parentElement.querySelector(".rail-ctl");
    var prev = ctl && $(".rail-prev", ctl), next = ctl && $(".rail-next", ctl), track = ctl && $(".track", ctl);
    var update = function () {
      var max = rail.scrollWidth - rail.clientWidth;
      if (track) track.style.setProperty("--k", max > 0 ? (rail.scrollLeft / max).toFixed(3) : 1);
      if (prev) prev.disabled = rail.scrollLeft < 4;
      if (next) next.disabled = rail.scrollLeft > max - 4;
    };
    var step = function (dir) {
      var f = rail.firstElementChild;
      var w = f ? f.getBoundingClientRect().width + parseFloat(getComputedStyle(rail).columnGap || 12) : rail.clientWidth * 0.8;
      rail.scrollBy({ left: dir * w, behavior: reduced ? "auto" : "smooth" });
    };
    if (prev) prev.addEventListener("click", function () { step(-1); });
    if (next) next.addEventListener("click", function () { step(1); });
    rail.addEventListener("scroll", update, { passive: true });
    addEventListener("resize", update);
    update();
    /* Mouse drag; a drag does not count as a click on the frame under the pointer. */
    var down = false, moved = false, sx = 0, sl = 0;
    rail.addEventListener("pointerdown", function (e) { if (e.pointerType !== "mouse" || e.button) return; down = true; moved = false; sx = e.clientX; sl = rail.scrollLeft; });
    addEventListener("pointermove", function (e) {
      if (!down) return;
      var dx = e.clientX - sx;
      if (!moved && Math.abs(dx) > 6) { moved = true; rail.classList.add("drag"); }
      if (moved) rail.scrollLeft = sl - dx;
    });
    addEventListener("pointerup", function () { if (!down) return; down = false; if (moved) { rail.classList.remove("drag"); var snap = rail.scrollLeft; rail.scrollLeft = snap; } });
    rail.addEventListener("click", function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    rail.addEventListener("dragstart", function (e) { e.preventDefault(); });
  });

  /* ── The time map: minutes from Levan, drawn as routes for the screen's shape. U.timeMap(el) returns draw(p). ── */
  var DESTS = [
    { min: 20, name: "İstanbul Havalimanı", note: "Kuzey Marmara bağlantısı" },
    { min: 15, name: "5. Levent", note: "Sazlıdere Köprüsü ile" },
    { min: 15, name: "İSTOÇ", note: "Ticaret aksına yakın" }
  ];
  U.timeMap = function (map) {
    var svg = $("svg", map), routes = [], last = 0, ns = "http://www.w3.org/2000/svg";
    var mk = function (tag, attrs) { var n = d.createElementNS(ns, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); return n; };
    var build = function () {
      var tall = map.clientWidth < 560;
      var V = tall ? { w: 360, h: 470, hub: [26, 34], nodes: [[86, 150], [86, 290], [86, 430]], lab: 108 } : { w: 720, h: 470, hub: [70, 235], nodes: [[400, 70], [400, 235], [400, 400]], lab: 428 };
      svg.setAttribute("viewBox", "0 0 " + V.w + " " + V.h);
      $$(".dest, .hub-label", map).forEach(function (n) { n.remove(); });
      $$("g", svg).forEach(function (g) { g.remove(); });
      var g = mk("g", {}), hx = V.hub[0], hy = V.hub[1];
      routes = V.nodes.map(function (pt, i) {
        var x = pt[0], y = pt[1];
        var dd = tall ? "M" + hx + " " + hy + " C " + hx + " " + (y - 50) + ", " + (hx + 10) + " " + y + ", " + x + " " + y : "M" + hx + " " + hy + " C " + (hx + 150) + " " + hy + ", " + (x - 190) + " " + y + ", " + x + " " + y;
        var p = mk("path", { d: dd, "class": "route" });
        var dot = mk("circle", { r: 3.5, "class": "dot" });
        g.append(mk("path", { d: dd, "class": "route-bg" }), p, mk("circle", { cx: x, cy: y, r: 5, "class": "node" }), dot);
        var lab = d.createElement("div");
        lab.className = "dest";
        lab.style.left = (V.lab / V.w) * 100 + "%";
        lab.style.top = (y / V.h) * 100 + "%";
        lab.innerHTML = '<span class="min num"><span class="m">' + DESTS[i].min + "</span><small>dk</small></span><strong>" + DESTS[i].name + "</strong><span>" + DESTS[i].note + "</span>";
        map.appendChild(lab);
        return { p: p, dot: dot, lab: lab, m: $(".m", lab), min: DESTS[i].min, len: 0 };
      });
      g.append(mk("circle", { cx: hx, cy: hy, r: 14, "class": "ring" }), mk("circle", { cx: hx, cy: hy, r: 14, "class": "ring r2" }), mk("circle", { cx: hx, cy: hy, r: 6, "class": "hub" }));
      svg.appendChild(g);
      var hl = d.createElement("span");
      hl.className = "hub-label";
      hl.textContent = "Levan Bahçeşehir";
      hl.style.left = tall ? ((hx + 18) / V.w) * 100 + "%" : ((hx - 22) / V.w) * 100 + "%";
      hl.style.top = tall ? "calc(" + (hy / V.h) * 100 + "% - 0.5em)" : (hy + 22) / V.h * 100 + "%";
      map.appendChild(hl);
      routes.forEach(function (r) { r.len = r.p.getTotalLength(); r.p.style.strokeDasharray = r.len; });
      draw(reduced ? 1 : last);
    };
    var draw = function (p) {
      last = p;
      routes.forEach(function (r, i) {
        var k = reduced ? 1 : ease(clamp((p - i * 0.14) / 0.5));
        r.p.style.strokeDashoffset = r.len * (1 - k);
        var pt = r.p.getPointAtLength(r.len * k);
        r.dot.setAttribute("cx", pt.x); r.dot.setAttribute("cy", pt.y);
        r.dot.style.opacity = k > 0 && k < 1 ? 1 : 0;
        r.m.textContent = Math.round(r.min * k);
        r.lab.classList.toggle("on", k > 0.98);
      });
    };
    build();
    var w = map.clientWidth;
    new ResizeObserver(function () { if (Math.abs(map.clientWidth - w) > 40) { w = map.clientWidth; build(); } }).observe(map);
    return draw;
  };

  /* ── Short films: a project card's frame plays its trailer (a few stills, a running timecode) while pointed at or
     focused; on touch screens, while the card sits in the middle of the screen. ── */
  $$(".sf").forEach(function (sf) {
    var shots = $$(".sf-shot", sf), tcEl = $(".sf-tc", sf), bar = $(".sf-bar", sf);
    if (shots.length < 2 || reduced) return;
    var timer = 0, raf = 0, i = 0, t0 = 0, SHOT = 2.4;
    var start = function () {
      if (sf.classList.contains("play")) return;
      shots.forEach(function (s) { if (!s.getAttribute("src") && s.dataset.src) s.src = s.dataset.src; });
      sf.classList.add("play");
      t0 = performance.now();
      (function tick(t) {
        var e = Math.max(0, (t - t0) / 1000);
        if (tcEl) tcEl.textContent = tc(e);
        if (bar) bar.style.setProperty("--k", ((e % (SHOT * shots.length)) / (SHOT * shots.length)).toFixed(3));
        raf = requestAnimationFrame(tick);
      })(t0);
      timer = setInterval(function () { shots[i].classList.remove("on"); i = (i + 1) % shots.length; shots[i].classList.add("on"); }, SHOT * 1000);
    };
    var stop = function () {
      if (!sf.classList.contains("play")) return;
      clearInterval(timer); cancelAnimationFrame(raf);
      sf.classList.remove("play");
      shots[i].classList.remove("on"); i = 0; shots[0].classList.add("on");
    };
    sf.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") start(); });
    sf.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") stop(); });
    sf.addEventListener("focus", start);
    sf.addEventListener("blur", stop);
    if (!fine) new IntersectionObserver(function (es) { if (es[0].isIntersecting) start(); else stop(); }, { rootMargin: "-30% 0px -30% 0px" }).observe(sf);
  });

  /* ── Smooth scrolling for mouse and trackpad (Lenis); touch and reduced motion keep native scrolling. ── */
  var glide = function (target) {
    if (U.lenis) U.lenis.scrollTo(target, { duration: 1.5 });
    else target.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
  };
  d.addEventListener("click", function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a || a.classList.contains("skip")) return;
    var id = a.getAttribute("href");
    var t = id.length > 1 && d.getElementById(decodeURIComponent(id.slice(1)));
    if (!t) return;
    e.preventDefault();
    glide(t);
    history.replaceState(null, "", id);
  });
  /* A link to another page stops any glide in progress before the page changes. */
  addEventListener("pagehide", function () { if (U.lenis) U.lenis.stop(); });
  if (!reduced && fine) {
    var ls = d.createElement("script");
    ls.src = "https://cdn.jsdelivr.net/npm/lenis@1.1.13/dist/lenis.min.js";
    ls.onload = function () {
      if (!window.Lenis) return;
      U.lenis = new window.Lenis({ lerp: 0.1, wheelMultiplier: 1 });
      if (locks > 0) U.lenis.stop();
    };
    d.body.appendChild(ls);
  }

  requestAnimationFrame(frame);
})();
