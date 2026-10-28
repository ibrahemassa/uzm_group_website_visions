/* İmza: shared behaviour for every page. Page scripts (assets/js/<page>.js) run after this one and use window.UZM. */
(function () {
  var doc = document.documentElement;
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (n, a, b) { return Math.min(b, Math.max(a, n)); };
  var fmt = new Intl.NumberFormat("tr-TR");
  var NS = "http://www.w3.org/2000/svg";

  var UZM = (window.UZM = { reduced: reduced, fine: fine, $: $, $$: $$, clamp: clamp, fmt: fmt, NS: NS, onScroll: [], onLayout: [], root: document.body.dataset.root, assets: document.body.dataset.assets });
  UZM.ease = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

  /* Scroll lock, shared by the menu and the dialogs; Lenis is paused while anything is open. */
  var locks = 0;
  UZM.lock = function () { if (locks++ === 0) { doc.style.overflow = "hidden"; if (window.__lenis) window.__lenis.stop(); } };
  UZM.unlock = function () { if (locks > 0 && --locks === 0) { doc.style.overflow = ""; if (window.__lenis) window.__lenis.start(); } };
  UZM.scrollTo = function (y) {
    if (window.__lenis) window.__lenis.scrollTo(y, { duration: 1.2 });
    else scrollTo({ top: y, behavior: reduced ? "auto" : "smooth" });
  };

  /* The page hero's doorway rises once the page has painted, or, on a first visit to the home page, as the opening
     ceremony lifts (the curtain is shown by an inline script in the page head, see home.css). */
  var hero = $(".ph");
  var openHero = function () { if (hero) hero.classList.add("is-open"); };
  var curtain = doc.classList.contains("curtain-on") && $(".curtain");
  if (curtain) {
    try { sessionStorage.setItem("uzm-curtain", "1"); } catch (e) {}
    var lifted = false;
    var lift = function (fast) {
      if (lifted) return;
      lifted = true;
      if (fast) curtain.classList.add("skip");
      setTimeout(openHero, fast ? 150 : 0);
      setTimeout(function () { curtain.remove(); }, fast ? 650 : 1100);
      ["pointerdown", "keydown", "wheel", "touchstart"].forEach(function (t) { removeEventListener(t, skip); });
    };
    var skip = function () { lift(true); };
    ["pointerdown", "keydown", "wheel", "touchstart"].forEach(function (t) { addEventListener(t, skip, { passive: true }); });
    setTimeout(function () { lift(false); }, 1500);
  } else if (hero) {
    requestAnimationFrame(function () { requestAnimationFrame(openHero); });
  }

  /* Films: the still covers each until it plays, then dissolves away. A film loads and plays only while its section is
     near the screen, and a disc stops it for good (WCAG 2.2.2). */
  var LABEL = { play: "Filmi oynat", pause: "Filmi durdur" };
  $$("video[data-film]").forEach(function (v) {
    var still = v.parentElement.querySelector("img");
    if (reduced || (navigator.connection && navigator.connection.saveData)) return;
    var host = v.closest(".ph-pin, section") || v.parentElement;
    var start = +v.dataset.start || 0;
    var loaded = false, userPaused = false;
    var load = function () {
      if (loaded) return;
      loaded = true;
      var tall = matchMedia("(max-aspect-ratio: 4/5)").matches;
      v.src = tall && v.dataset.filmTall ? v.dataset.filmTall : v.dataset.film;
      if (start) v.addEventListener("loadedmetadata", function () { try { if (v.currentTime < start - 0.1) v.currentTime = start; } catch (e) {} }, { once: true });
      var reveal = function () { if (v.currentTime >= start - 0.05 && v.currentTime > 0) { if (still) still.classList.add("gone"); v.removeEventListener("timeupdate", reveal); } };
      v.addEventListener("timeupdate", reveal);
      v.muted = true;
    };
    var play = function () { load(); var p = v.play(); if (p && p.catch) p.catch(function () {}); };
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "film-toggle"; btn.setAttribute("aria-pressed", "false");
    btn.innerHTML = '<svg class="ft-ring" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="19.4" pathLength="1"/></svg><i aria-hidden="true"></i><span class="sr">' + LABEL.pause + "</span>";
    v.addEventListener("timeupdate", function () { if (v.duration) btn.style.setProperty("--p", (v.currentTime / v.duration).toFixed(3)); });
    btn.title = LABEL.pause;
    var setBtn = function () {
      btn.setAttribute("aria-pressed", userPaused);
      btn.classList.toggle("paused", userPaused);
      btn.title = btn.lastChild.textContent = userPaused ? LABEL.play : LABEL.pause;
    };
    btn.addEventListener("click", function () { userPaused = !userPaused; userPaused ? v.pause() : play(); setBtn(); });
    host.appendChild(btn);
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { if (!userPaused) play(); } else if (loaded) v.pause(); });
    }, { rootMargin: "200px 0px" }).observe(host);
  });

  /* Reveal on scroll and count-ups. Elements with data-r get .in once; page scripts can listen for "uzm:in". */
  var countUp = function (el) {
    var to = +el.dataset.count;
    if (reduced) return;
    var dec = (el.dataset.count.split(".")[1] || "").length;
    var nf = dec ? new Intl.NumberFormat("tr-TR", { minimumFractionDigits: dec, maximumFractionDigits: dec }) : fmt;
    var t0 = performance.now(), D = +el.dataset.dur || 2200;
    (function tick(t) {
      var k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 4);
      el.textContent = nf.format(dec ? to * e : Math.round(to * e));
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  };
  UZM.countUp = countUp;
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
  UZM.observe = function (el) { io.observe(el); };
  $$("[data-r]:not([data-r=mask]):not([data-r=write]):not([data-r=arch]), [data-inview]").forEach(function (el) { io.observe(el); });
  /* Clip reveals (mask, arch, write) start fully clipped, which Chromium's IntersectionObserver counts as out of view;
     these are revealed from their boxes on scroll instead. */
  var masks = $$("[data-r=mask], [data-r=write], [data-r=arch]");
  var revealMasks = function (vh) {
    if (!masks.length) return;
    masks = masks.filter(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < vh * 0.92 && r.bottom > 0) { el.classList.add("in"); el.dispatchEvent(new CustomEvent("uzm:in", { bubbles: true })); return false; }
      return true;
    });
  };
  /* Sections that draw a line once seen (the invitation's arch, the footer's flourish). */
  var seenIO = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("seen"); seenIO.unobserve(e.target); } });
  }, { threshold: 0.2 });
  $$(".invite, .ftr, [data-seen]").forEach(function (el) { seenIO.observe(el); });

  /* Layout cache: page scripts register measurements in UZM.onLayout; they run on load, resize and when the page's
     height changes, never inside the scroll handler (no layout reads per frame). */
  var layoutQueued = false;
  var relayout = function () {
    layoutQueued = false;
    UZM.onLayout.forEach(function (fn) { fn(); });
    onScroll();
  };
  UZM.relayout = function () { if (!layoutQueued) { layoutQueued = true; requestAnimationFrame(relayout); } };
  if (window.ResizeObserver) new ResizeObserver(UZM.relayout).observe(document.body);

  /* Passages: walking through an arch cut into a dark wall, into the next picture. */
  var passages = $$(".passage").map(function (s) { return { el: s, pin: $(".passage-pin", s), top: 0, h: 0, last: -1 }; });
  UZM.onLayout.push(function () {
    passages.forEach(function (p) { var r = p.el.getBoundingClientRect(); p.top = r.top + scrollY; p.h = p.el.offsetHeight; });
  });

  /* Scroll-driven: the doorway opening, the seals turning, pictures drifting in their frames, the header turning
     solid. One rAF-throttled handler; page scripts add to UZM.onScroll. */
  var hdr = $("#hdr");
  var seals = $$(".seal-ring");
  var pars = $$(".par");
  var drifts = $$(".drift");
  var motion = doc.classList.contains("motion");
  var heroH = 0, lastE = -1;
  UZM.onLayout.push(function () { heroH = hero ? hero.offsetHeight : 0; });
  var ticking = false;
  var onScroll = function () {
    ticking = false;
    var y = scrollY, vh = innerHeight;
    revealMasks(vh);
    if (hero) {
      var range = heroH - vh;
      var p = range > 40 ? clamp(y / range, 0, 1) : 0;
      var e = UZM.ease(clamp((p - 0.03) / 0.85, 0, 1));
      if (Math.abs(e - lastE) > 0.0005) { hero.style.setProperty("--e", e.toFixed(4)); lastE = e; }
      hdr.classList.toggle("solid", e > 0.45 || y > heroH - vh * 0.45);
    } else {
      hdr.classList.toggle("solid", y > 10);
    }
    var max = doc.scrollHeight - vh;
    hdr.style.setProperty("--prog", max > 0 ? clamp(y / max, 0, 1).toFixed(4) : 0);
    if (motion) {
      passages.forEach(function (p) {
        var t = clamp((y - p.top) / Math.max(1, p.h - vh), 0, 1);
        if (Math.abs(t - p.last) > 0.0005) { p.pin.style.setProperty("--t", t.toFixed(4)); p.last = t; }
      });
      seals.forEach(function (el) { el.style.setProperty("--rot", (y * 0.05).toFixed(2) + "deg"); });
      pars.forEach(function (img) {
        var r = img.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        var q = (r.top + r.height / 2 - vh / 2) / vh;
        img.style.transform = "translate3d(0," + (q * -100 * (+img.dataset.speed || 0.08) * 4).toFixed(1) + "px,0)";
      });
      drifts.forEach(function (img) {
        var r = img.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        var q = (r.top + r.height / 2 - vh / 2) / vh;
        img.style.transform = "translate3d(0," + (q * -60).toFixed(1) + "px,0) scale(" + (1.06 - clamp(1 - Math.abs(q), 0, 1) * 0.04).toFixed(4) + ")";
      });
    }
    UZM.onScroll.forEach(function (fn) { fn(y, vh); });
  };
  UZM.refresh = onScroll;

  /* The presenter pill steps aside while scrolling down and comes back on the way up, near the top and at the end. */
  var pres = $(".pres"), lastY = scrollY;
  if (pres) UZM.onScroll.push(function (y, vh) {
    var dy = y - lastY;
    if (Math.abs(dy) < 6) return;
    var end = y + vh >= doc.scrollHeight - 80;
    pres.classList.toggle("away", dy > 0 && y > vh * 0.5 && !end);
    lastY = y;
  });
  addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener("resize", UZM.relayout);
  addEventListener("load", UZM.relayout);
  UZM.onLayout.forEach(function (fn) { fn(); });
  onScroll();

  /* ── The signature: a single champagne pen stroke written down a page as it is read ──
     Anchors are elements carrying data-ink="x[,y[,loop]]": x is a fraction of the host's width ("c": the element's
     centre), y a fraction of the element's height ("c": its middle), loop a radius in px for a cursive loop (negative
     loops to the left); data-ink-m gives the phone version. Between anchors the pen travels on vertical tangents, so
     the stroke reads as one continuous hand. The pen's tip follows a reading line (opt.at of the screen height);
     scroll between two anchors maps linearly to the stroke between them, so loops draw smoothly too. */
  UZM.ink = function (host, opt) {
    opt = opt || {};
    if (!host || !host.querySelector("[data-ink]")) return null;
    var mk = function (tag, cls) { var el = document.createElementNS(NS, tag); if (cls) el.setAttribute("class", cls); return el; };
    var svg = mk("svg", "ink" + (opt.cls ? " " + opt.cls : ""));
    svg.setAttribute("aria-hidden", "true"); svg.setAttribute("focusable", "false");
    var glow = mk("path", "ink-glow"), line = mk("path", "ink-line"), probe = mk("path");
    var halo = mk("circle", "ink-halo"), nib = mk("circle", "ink-nib");
    halo.setAttribute("r", 13); nib.setAttribute("r", 2.6);
    probe.setAttribute("visibility", "hidden");
    svg.appendChild(probe); svg.appendChild(glow); svg.appendChild(line); svg.appendChild(halo); svg.appendChild(nib);
    host.insertBefore(svg, host.firstChild);
    var marks = [], total = 0, top0 = 0, lastL = -1, ended = false, K = 0.5523, SH = -0.32;
    var f = function (n) { return n.toFixed(1); };
    var build = function () {
      var hr = host.getBoundingClientRect();
      top0 = hr.top + scrollY;
      var W = host.clientWidth, H = host.scrollHeight, narrow = W < 760;
      svg.setAttribute("width", W); svg.setAttribute("height", H); svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      var pts = $$("[data-ink]", host).map(function (el) {
        var s = ((narrow && el.dataset.inkM) || el.dataset.ink).split(",");
        var r = el.getBoundingClientRect();
        var x = s[0] === "c" ? r.left + r.width / 2 - hr.left : parseFloat(s[0]) * W;
        var y = r.top - hr.top + (s[1] === "c" ? r.height / 2 : (parseFloat(s[1]) || 0) * r.height);
        return { x: x, y: y, loop: s[2] ? parseFloat(s[2]) : 0 };
      }).sort(function (a, b) { return a.y - b.y; });
      if (pts.length < 2) return;
      var d = "M" + f(pts[0].x) + " " + f(pts[0].y);
      marks = [{ y: pts[0].y, L: 0 }];
      for (var i = 0; i < pts.length; i++) {
        var P = pts[i];
        if (i > 0) {
          var Q = pts[i - 1], k = (P.y - Q.y) * 0.5;
          d += "C" + f(Q.x) + " " + f(Q.y + k) + " " + f(P.x) + " " + f(P.y - k) + " " + f(P.x) + " " + f(P.y);
          probe.setAttribute("d", d);
          marks.push({ y: P.y, L: probe.getTotalLength() });
        }
        if (P.loop) {
          var sg = P.loop > 0 ? 1 : -1, rx = Math.abs(P.loop), ry = rx * 1.35, cx = P.x + sg * rx, cy = P.y;
          var q = function (x, y) { return f(x + (y - cy) * SH) + " " + f(y); };
          d += "C" + q(cx - sg * rx, cy + K * ry) + " " + q(cx - sg * K * rx, cy + ry) + " " + q(cx, cy + ry) +
               "C" + q(cx + sg * K * rx, cy + ry) + " " + q(cx + sg * rx, cy + K * ry) + " " + q(cx + sg * rx, cy) +
               "C" + q(cx + sg * rx, cy - K * ry) + " " + q(cx + sg * K * rx, cy - ry) + " " + q(cx, cy - ry) +
               "C" + q(cx - sg * K * rx, cy - ry) + " " + q(cx - sg * rx, cy - K * ry) + " " + q(cx - sg * rx, cy);
        }
      }
      line.setAttribute("d", d); glow.setAttribute("d", d);
      probe.setAttribute("d", d);
      total = probe.getTotalLength();
      marks.push({ y: pts[pts.length - 1].y + 1, L: total });
      [line, glow].forEach(function (p) { p.style.strokeDasharray = total + " " + (total + 10); });
      lastL = -1;
      if (reduced) { [line, glow].forEach(function (p) { p.style.strokeDashoffset = 0; }); halo.style.display = nib.style.display = "none"; }
    };
    var update = function (y, vh) {
      if (!total || reduced) return;
      var t = y + vh * (opt.at || 0.62) - top0, L = 0;
      if (t >= marks[marks.length - 1].y) L = total;
      else if (t > marks[0].y) {
        for (var i = 1; i < marks.length; i++) {
          if (t <= marks[i].y) { var a = marks[i - 1], b = marks[i]; L = a.L + (b.L - a.L) * (t - a.y) / Math.max(1, b.y - a.y); break; }
        }
      }
      if (Math.abs(L - lastL) < 0.4) return;
      lastL = L;
      var off = (total - L).toFixed(1);
      line.style.strokeDashoffset = off; glow.style.strokeDashoffset = off;
      var show = L > 1 && L < total - 1;
      nib.style.opacity = halo.style.opacity = show ? 1 : 0;
      if (show) {
        var p = line.getPointAtLength(L);
        nib.setAttribute("cx", f(p.x)); nib.setAttribute("cy", f(p.y));
        halo.setAttribute("cx", f(p.x)); halo.setAttribute("cy", f(p.y));
      }
      if (!ended && L >= total - 1) { ended = true; if (opt.onEnd) opt.onEnd(); }
    };
    UZM.onLayout.push(build);
    UZM.onScroll.push(update);
    build();
    update(scrollY, innerHeight);
    return { build: build };
  };

  /* Page to page: a card's arch is named for the transition so it opens into the next page's doorway (the new page
     names its doorway in the head script). Only a card on screen takes part. */
  addEventListener("pageswap", function (e) {
    if (!e.viewTransition || !e.activation || !e.activation.entry) return;
    var to = e.activation.entry.url, vh = innerHeight;
    $$("[data-morph]").some(function (m) {
      var a = m.closest("a[href]");
      var href = m.dataset.morphHref ? new URL(m.dataset.morphHref, location.href).href : a && a.href;
      if (href !== to) return false;
      var r = m.getBoundingClientRect();
      if (!r.width || r.bottom < 0 || r.top > vh) return false;
      m.style.viewTransitionName = "hero";
      e.viewTransition.finished.then(function () { m.style.viewTransitionName = ""; }, function () { m.style.viewTransitionName = ""; });
      return true;
    });
  });
  addEventListener("pageshow", function () { $$("[data-morph]").forEach(function (m) { m.style.viewTransitionName = ""; }); });

  /* Spotlight on dark sections; the lantern over the invitation. */
  if (fine && !reduced) {
    $$(".spot, .invite").forEach(function (sec) {
      sec.addEventListener("pointermove", function (e) {
        var r = sec.getBoundingClientRect();
        sec.style.setProperty("--mx", (e.clientX - r.left) + "px");
        sec.style.setProperty("--my", (e.clientY - r.top) + "px");
        sec.style.setProperty("--spot", 1);
      });
      sec.addEventListener("pointerleave", function () { sec.style.setProperty("--spot", 0); });
    });
  }

  /* Cursor ring: follows the pointer with a little lag, swells over links and buttons, and over pictures names what
     a click does. Fine pointers only; the system cursor stays visible. */
  if (fine && !reduced) {
    var ring = document.createElement("div");
    ring.className = "cursor"; ring.setAttribute("aria-hidden", "true");
    ring.innerHTML = "<span></span>";
    document.body.appendChild(ring);
    var ringText = ring.firstChild;
    var LABELS = [["a[data-lb]", "Büyütün"], [".pcard", "İnceleyin"], [".lantern", "Fener"], [".coll-stage", "Kaydırın"], [".dial", "Çevirin"], ["[data-cursor]", ""]];
    var cx = -100, cy = -100, rx = cx, ry = cy, moving = false;
    var follow = function () {
      rx += (cx - rx) * 0.2; ry += (cy - ry) * 0.2;
      ring.style.setProperty("--x", rx.toFixed(1) + "px"); ring.style.setProperty("--y", ry.toFixed(1) + "px");
      if (Math.abs(cx - rx) + Math.abs(cy - ry) > 0.3) requestAnimationFrame(follow); else moving = false;
    };
    var hasPointer = false;
    var read = function (t) {
      if (!t || !t.closest) return;
      var label = "";
      for (var i = 0; i < LABELS.length && !label; i++) { var m = t.closest(LABELS[i][0]); if (m) label = LABELS[i][1] || m.dataset.cursor; }
      var typing = t.closest("input:not([type=range]), textarea, select, dialog");
      ring.classList.toggle("on", !typing);
      ring.classList.toggle("label", !!label);
      ring.classList.toggle("link", !label && !!t.closest("a, button, summary, label, [role=tab]"));
      if (label) ringText.textContent = label;
    };
    addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse") return;
      cx = e.clientX; cy = e.clientY;
      if (!ring.classList.contains("on")) { rx = cx; ry = cy; }
      hasPointer = true;
      read(e.target);
      if (!moving) { moving = true; requestAnimationFrame(follow); }
    }, { passive: true });
    UZM.onScroll.push(function () { if (hasPointer) read(document.elementFromPoint(cx, cy)); });
    document.addEventListener("mouseleave", function () { ring.classList.remove("on"); hasPointer = false; });

    /* Buttons lean a few pixels toward the pointer and settle back when it leaves. */
    $$(".btn").forEach(function (b) {
      b.addEventListener("pointermove", function (e) {
        var r = b.getBoundingClientRect();
        var dx = (e.clientX - r.left - r.width / 2) / (r.width / 2), dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
        b.style.translate = (dx * 5).toFixed(1) + "px " + (dy * 4).toFixed(1) + "px";
      });
      b.addEventListener("pointerleave", function () { b.style.translate = ""; });
    });
  }

  /* Menu overlay: opens like a doorway. While it is open everything behind it is inert. */
  var menu = $("#menu"), menuBtn = $(".hdr-menu");
  var behind = [".skip", "#hdr", "main", ".ftr", ".pres"].map(function (s) { return $(s); }).filter(Boolean);
  var setMenu = function (open) {
    if (open === menu.classList.contains("open")) return;
    menu.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", open);
    behind.forEach(function (el) { el.inert = open; });
    open ? UZM.lock() : UZM.unlock();
    if (open) $("a", menu).focus({ preventScroll: true }); else menuBtn.focus({ preventScroll: true });
  };
  menuBtn.addEventListener("click", function () { setMenu(true); });
  $(".menu-close").addEventListener("click", function () { setMenu(false); });
  $$("a", menu).forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
  addEventListener("keydown", function (e) { if (e.key === "Escape" && menu.classList.contains("open")) setMenu(false); });

  /* Dialogs: [data-open="id"] opens #id; [data-close] and a click on the backdrop close it. */
  var opener = null;
  UZM.open = function (dlg, from) {
    if (typeof dlg === "string") dlg = document.getElementById(dlg);
    if (!dlg || dlg.open) return;
    if (menu.classList.contains("open")) setMenu(false);
    opener = from || document.activeElement;
    UZM.lock();
    dlg.showModal();
  };
  $$("dialog.dlg").forEach(function (dlg) {
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
    $$("[data-close]", dlg).forEach(function (b) { b.addEventListener("click", function () { dlg.close(); }); });
    dlg.addEventListener("close", function () {
      UZM.unlock();
      if (opener && opener.focus) opener.focus({ preventScroll: true });
      opener = null;
    });
  });
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-open]");
    if (!b) return;
    e.preventDefault();
    UZM.open(b.dataset.open, b);
  });

  /* Plan sheets. UZM.openPlan({ title, sheets: [{ src, w, h, label }] }); several sheets get floor tabs. */
  var plan = $("#plan"), planImg = $("#plan .plan-sheet img"), planTabs = $("#plan .plan-tabs"), planTitle = $("#plan-title");
  var showSheet = function (sheets, i, title) {
    var s = sheets[i];
    planImg.src = s.src; planImg.width = s.w; planImg.height = s.h;
    planImg.alt = title + (s.label ? ", " + s.label : "") + " kat planı";
    $$("button", planTabs).forEach(function (b, k) { b.setAttribute("aria-selected", k === i); b.tabIndex = k === i ? 0 : -1; });
  };
  UZM.openPlan = function (o, from) {
    planTitle.textContent = o.title + " · Kat planı";
    planTabs.innerHTML = "";
    if (o.sheets.length > 1) {
      o.sheets.forEach(function (s, i) {
        var b = document.createElement("button");
        b.type = "button"; b.setAttribute("role", "tab"); b.textContent = s.label;
        b.addEventListener("click", function () { showSheet(o.sheets, i, o.title); });
        planTabs.appendChild(b);
      });
    }
    showSheet(o.sheets, o.start || 0, o.title);
    UZM.open(plan, from);
  };
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-plan]");
    if (!b) return;
    UZM.openPlan({ title: b.dataset.plan, sheets: JSON.parse(b.dataset.sheets) }, b);
  });

  /* Lightbox: links with data-lb="group" open their href; data-cap is the caption. */
  var lb = $("#lb"), lbImg = $("#lb img"), lbCap = $("#lb .lb-cap"), lbCount = $("#lb .lb-count");
  var group = [], at = 0;
  var lbShow = function (i) {
    at = (i + group.length) % group.length;
    var a = group[at];
    lbImg.src = a.getAttribute("href");
    lbImg.alt = a.dataset.cap || "";
    lbCap.textContent = a.dataset.cap || "";
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
  lb.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft") lbShow(at - 1);
    if (e.key === "ArrowRight") lbShow(at + 1);
  });
  lb.addEventListener("click", function (e) { if (e.target === lb || e.target.classList.contains("lb-fig")) lb.close(); });

  /* Demo forms: checked in the browser, never sent; the note says so. Each problem is written next to its field. */
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
        wrap.classList.contains("check") ? wrap.after(err) : wrap.appendChild(err);
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
      $$(".field, .check, button[type=submit]", f).forEach(function (el) { el.hidden = true; });
      if (note) { note.hidden = false; note.setAttribute("tabindex", "-1"); note.focus(); }
      f.dispatchEvent(new CustomEvent("uzm:sent", { bubbles: true }));
    });
  });

  /* Inertial scrolling on desktop, when Lenis is reachable; in-page anchors glide too. */
  var lenisScript = document.createElement("script");
  lenisScript.src = "https://cdn.jsdelivr.net/npm/lenis@1.1.13/dist/lenis.min.js";
  lenisScript.onload = function () {
    if (reduced || !fine || !window.Lenis) return;
    var lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
    window.__lenis = lenis;
    if (locks > 0) lenis.stop();
    (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(performance.now());
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener("click", function (e) {
        var id = a.getAttribute("href");
        if (id.length < 2) return;
        var target = $(id);
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: -60, duration: 1.6 });
      });
    });
  };
  document.body.appendChild(lenisScript);
})();
