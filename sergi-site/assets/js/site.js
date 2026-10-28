/* Sergi · shared behaviour for every room. One rAF loop drives Lenis, the room plaque, the cursor, the invitation tilt
   and whatever the page scripts add to UZM.loop; everything else waits for IntersectionObserver. Page scripts
   (assets/js/<page>.js) run after this one and use window.UZM. */
(function () {
  "use strict";
  var d = document.documentElement, body = document.body;
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b === undefined ? 1 : b, Math.max(a || 0, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var smooth = function (a, b, v) { var t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
  var fmt = new Intl.NumberFormat("tr-TR");
  var A = body.dataset.assets;

  var U = (window.UZM = { reduced: reduced, fine: fine, $: $, $$: $$, clamp: clamp, lerp: lerp, smooth: smooth, easeOut: easeOut, fmt: fmt, root: body.dataset.root, assets: A, loop: [], resize: [] });
  if (fine && !reduced) d.classList.add("fine");

  /* ── Smooth scroll (desktop, fine pointers): Lenis, paused behind every overlay. */
  var lenis = !reduced && fine && window.Lenis ? new window.Lenis({ lerp: 0.09, smoothWheel: true }) : null;
  U.lenis = lenis;
  U.scrollY = function () { return lenis ? lenis.animatedScroll : window.scrollY; };
  U.goTo = function (el, off) {
    if (lenis) lenis.scrollTo(el, { offset: off === undefined ? -70 : off, duration: 1.6 });
    else el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || a.classList.contains("skip")) return;
    var id = a.getAttribute("href");
    if (id.length < 2) return;
    var t = document.getElementById(decodeURIComponent(id.slice(1)));
    if (!t) return;
    e.preventDefault();
    if (guide.open) closeGuide(true);
    U.goTo(t);
  });

  /* ── Scroll lock, shared by the guide and the dialogs. */
  var locks = 0;
  U.lock = function () { if (locks++ === 0) { d.classList.add("modal-open"); if (lenis) lenis.stop(); } };
  U.unlock = function () { if (locks > 0 && --locks === 0) { d.classList.remove("modal-open"); if (lenis) lenis.start(); } };

  /* ── Lights on: the spots of the page hero warm up once the first frame has painted. */
  requestAnimationFrame(function () { setTimeout(function () { d.classList.add("lights"); }, 60); });

  /* ── Rooms: the header's tone follows the wall under it; the plaque names the room you stand in. */
  var nav = $("#nav"), where = $("#where");
  var roomEls = $$("main [data-room], footer[data-room]");
  var rooms = [], curKey = null;
  var measure = function () {
    var sy = window.scrollY;
    rooms = roomEls.map(function (el) {
      var r = el.getBoundingClientRect();
      return { top: r.top + sy, bottom: r.bottom + sy, n: el.dataset.room, name: (innerWidth < 600 && el.dataset.short) || el.dataset.name, tone: el.classList.contains("on-light") || el.classList.contains("room-plaster") ? "light" : "dark" };
    });
  };
  var pageTone = body.dataset.wall === "plaster" ? "light" : "dark";
  var setRoom = function (y) {
    var p = y + 44;
    var r = null;
    for (var i = rooms.length - 1; i >= 0; i--) if (p >= rooms[i].top && p < rooms[i].bottom) { r = rooms[i]; break; }
    nav.dataset.tone = r ? r.tone : y < 40 ? pageTone : "dark";
    nav.classList.toggle("solid", y > 60);
    var n = r && r.n ? r.n : body.dataset.room, name = r && r.name ? r.name : body.dataset.name;
    var key = n + "|" + name;
    if (key === curKey) return;
    var first = curKey === null;
    curKey = key;
    var apply = function () { $(".n span", where).textContent = n; $(".t", where).textContent = name; where.classList.remove("swap"); };
    if (first || reduced) apply(); else { where.classList.add("swap"); setTimeout(apply, 260); }
  };

  /* ── The visitor guide: the museum floor plan is the menu. */
  var guide = $("#guide"), guideFrom = null;
  var here = $("#g-here");
  var placeHere = function () {
    var room = $('.g-plan .rm[data-here="' + body.dataset.here + '"] rect', guide);
    if (!room || !here) return;
    var x = +room.getAttribute("x") + +room.getAttribute("width") / 2, y = +room.getAttribute("y") + +room.getAttribute("height") - 18;
    here.setAttribute("transform", "translate(" + x + " " + y + ")");
    here.style.display = "";
  };
  placeHere();
  var openGuide = function (from) {
    if (guide.open) return;
    guideFrom = from || document.activeElement;
    guide.showModal();
    U.lock();
    requestAnimationFrame(function () { guide.classList.add("on"); });
  };
  var closeGuide = function (now) {
    if (!guide.open) return;
    guide.classList.remove("on");
    if (now || reduced) guide.close(); else setTimeout(function () { if (!guide.classList.contains("on")) guide.close(); }, 360);
  };
  guide.addEventListener("close", function () { guide.classList.remove("on"); U.unlock(); if (guideFrom && guideFrom.focus) guideFrom.focus({ preventScroll: true }); guideFrom = null; });
  guide.addEventListener("cancel", function (e) { e.preventDefault(); closeGuide(); });
  guide.addEventListener("click", function (e) { if (e.target === guide) closeGuide(); });
  $$("[data-close]", guide).forEach(function (b) { b.addEventListener("click", function () { closeGuide(); }); });
  $$("[data-guide]").forEach(function (b) { b.addEventListener("click", function () { openGuide(b); }); });
  /* Pointing at a room on the plan lights its line in the list, and the other way round. */
  $$(".g-list a[data-here]", guide).forEach(function (a) {
    var rm = $('.g-plan .rm[data-here="' + a.dataset.here + '"]', guide);
    if (!rm) return;
    var on = function (v) { rm.classList.toggle("hov", v); a.classList.toggle("hov", v); };
    a.addEventListener("pointerenter", function () { on(true); });
    a.addEventListener("pointerleave", function () { on(false); });
    a.addEventListener("focus", function () { on(true); });
    a.addEventListener("blur", function () { on(false); });
    rm.addEventListener("pointerenter", function () { on(true); });
    rm.addEventListener("pointerleave", function () { on(false); });
  });

  /* ── Reveals, lit rooms, count-ups */
  var countUp = function (el) {
    if (reduced) return;
    var to = +el.dataset.count, plain = el.hasAttribute("data-plain");
    var from = plain ? to - 12 : 0, t0 = performance.now();
    var step = function (now) { var k = easeOut(clamp((now - t0) / 1700)); var v = Math.round(lerp(from, to, k)); el.textContent = plain ? String(v) : fmt.format(v); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      $$("[data-count]", e.target).forEach(countUp);
      if (e.target.dataset.count) countUp(e.target);
      e.target.dispatchEvent(new CustomEvent("uzm:in", { bubbles: true }));
      io.unobserve(e.target);
    });
  }, { threshold: 0.1, rootMargin: "0px 0px -6% 0px" });
  U.observe = function (el) { io.observe(el); };
  $$("[data-rv]").forEach(function (el) { io.observe(el); });
  var lio = new IntersectionObserver(function (es) { es.forEach(function (e) { e.target.classList.toggle("lit", e.isIntersecting); }); }, { threshold: 0.12 });
  $$(".room, .lit-able").forEach(function (el) { lio.observe(el); });

  /* ── Films: a film loads and plays only while it is near the screen; a button stops it for good (WCAG 2.2.2). */
  $$("video[data-film]").forEach(function (v) {
    if (reduced || (navigator.connection && navigator.connection.saveData)) return;
    var host = v.closest(".fr") || v.parentElement;
    var start = +v.dataset.start || 0, loaded = false, userPaused = false;
    var load = function () {
      if (loaded) return;
      loaded = true;
      v.src = matchMedia("(max-width: 699px)").matches && v.dataset.filmTall ? v.dataset.filmTall : v.dataset.film;
      v.muted = true;
      if (start) v.addEventListener("loadedmetadata", function () { try { if (v.currentTime < start - 0.1) v.currentTime = start; } catch (e) {} }, { once: true });
      var reveal = function () { if (v.currentTime > Math.max(0.15, start)) { host.classList.add("playing"); v.removeEventListener("timeupdate", reveal); } };
      v.addEventListener("timeupdate", reveal);
    };
    var play = function () { load(); var p = v.play(); if (p && p.catch) p.catch(function () {}); };
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "film-toggle";
    btn.innerHTML = '<i aria-hidden="true"></i><span class="sr">Filmi durdurun</span>';
    btn.setAttribute("aria-pressed", "false");
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      userPaused = !userPaused;
      if (userPaused) v.pause(); else play();
      btn.classList.toggle("paused", userPaused);
      btn.setAttribute("aria-pressed", String(userPaused));
      btn.lastChild.textContent = userPaused ? "Filmi oynatın" : "Filmi durdurun";
    });
    host.appendChild(btn);
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { if (!userPaused && !d.classList.contains("modal-open")) play(); } else if (loaded) v.pause(); });
    }, { rootMargin: "120px 0px" }).observe(host);
    U.pauseFilms = function () { $$("video[data-film]").forEach(function (x) { x.pause(); }); };
  });

  /* ── Dialogs: [data-open="id"] opens #id; [data-close] and a click on the backdrop close it. */
  var opener = null;
  U.open = function (dlg, from) {
    if (typeof dlg === "string") dlg = document.getElementById(dlg);
    if (!dlg || dlg.open) return;
    if (guide.open) closeGuide(true);
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
    var b = e.target.closest && e.target.closest("[data-open]");
    if (!b) return;
    e.preventDefault();
    U.open(b.dataset.open, b);
  });

  /* The film dialog: the full film with sound and controls. */
  var film = $("#film"), filmVid = $("#film-vid");
  $$("[data-film-open]").forEach(function (b) {
    b.addEventListener("click", function () {
      if (!filmVid.getAttribute("src")) filmVid.src = A + "video/levan-film-1920.mp4";
      U.pauseFilms && U.pauseFilms();
      U.open(film, b);
      var p = filmVid.play(); if (p && p.catch) p.catch(function () {});
    });
  });
  film.addEventListener("close", function () { filmVid.pause(); });

  /* ── Inspection: a framed work lifts off the wall (FLIP), its label card arrives; a loupe for the detail;
     plan sheets with floor tabs where the work has them. UZM.inspect(items, index, sourceFrame). */
  var ins = $("#inspect"), insFrame = $("#ins-frame"), insIn = $("#ins-in"), insImg = $("#ins-img"), insWork = $(".ins-work", ins);
  var sheetsBox = $(".ins-sheets", ins), seg = $(".seg", ins), loupe = $("#loupe"), loupeBtn = $("#loupe-btn");
  var set = [], at = 0, fromFr = null, busy = false, view = "render", sheetAt = 0, insOpener = null;
  var loupeOn = fine;
  var cur = function () { return set[at]; };
  var shown = function () { var it = cur(); return view === "plan" && it.plans ? it.plans[sheetAt] : it; };
  var paint = function () {
    var it = cur(), s = shown(), plan = view === "plan" && !!it.plans;
    insWork.classList.toggle("plan", plan);
    insWork.style.setProperty("--r", (s.w / s.h).toFixed(4));
    insImg.src = s.src;
    insImg.alt = plan ? it.title + ", " + (s.label ? s.label + " " : "") + "kat planı" : it.alt || it.title;
    $("#ins-tag").textContent = plan ? "Kat planı · Ölçeksiz" : it.tag || "Görselleştirme";
    $("#ins-no").textContent = it.no || "";
    $("#ins-title").textContent = it.title;
    $("#ins-me").textContent = plan ? (s.label ? s.label + " · " : "") + "Levan Bahçeşehir'in yayımladığı plan" : it.me || "";
    $("#ins-tx").textContent = it.tx || "";
    var specs = (plan && s.specs) || it.specs || [];
    $("#ins-dl").innerHTML = specs.map(function (p) { return "<div><dt>" + p[0] + "</dt><dd>" + p[1] + "</dd></div>"; }).join("");
    $("#ins-pc").textContent = (plan && s.pc) || it.pc || "";
    seg.hidden = !it.plans;
    $$("button", seg).forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.v === view)); });
    sheetsBox.hidden = !(plan && it.plans.length > 1);
    sheetsBox.innerHTML = plan && it.plans.length > 1 ? it.plans.map(function (p, k) { return '<button type="button" aria-pressed="' + (k === sheetAt) + '" data-k="' + k + '">' + p.label + "</button>"; }).join("") : "";
    $("#ins-ct").textContent = set.length > 1 ? (at + 1) + " / " + set.length : "";
    $("#ins-prev").hidden = $("#ins-next").hidden = set.length < 2;
    loupe.style.backgroundImage = 'url("' + s.src + '")';
  };
  sheetsBox.addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; sheetAt = +b.dataset.k; swap(paint); });
  $$("button", seg).forEach(function (b) { b.addEventListener("click", function () { if (view === b.dataset.v) return; view = b.dataset.v; sheetAt = 0; swap(paint); }); });
  var swap = function (fn) {
    if (reduced) { fn(); return; }
    ins.classList.add("ins-swap");
    setTimeout(function () { fn(); requestAnimationFrame(function () { ins.classList.remove("ins-swap"); }); }, 200);
  };
  var flip = function (a, toEl, reverse) {
    var b = toEl.getBoundingClientRect();
    if (!b.width || !a.width) return Promise.resolve();
    var s = a.width / b.width, dx = a.left - b.left, dy = a.top + a.height / 2 - (b.top + (b.height * s) / 2);
    var k = [{ transform: "translate(" + dx + "px, " + dy + "px) scale(" + s + ")" }, { transform: "none" }];
    return toEl.animate(reverse ? k.reverse() : k, { duration: reverse ? 560 : 780, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "both" }).finished;
  };
  var hideSrc = function (on) { set.forEach(function (it) { if (it.el) it.el.style.visibility = ""; }); if (on && cur().el) cur().el.style.visibility = "hidden"; };
  U.inspect = function (items, i, opts) {
    if (busy || ins.open) return;
    opts = opts || {};
    busy = true; set = items; at = i; view = opts.view || "render"; sheetAt = opts.sheet || 0;
    insOpener = opts.from || document.activeElement;
    paint();
    if (guide.open) closeGuide(true);
    ins.showModal();
    U.lock();
    setLoupe(loupeOn);
    var srcEl = cur().el;
    var go = function () { ins.classList.add("on"); busy = false; };
    if (!reduced && srcEl && srcEl.offsetParent) {
      var a = srcEl.getBoundingClientRect();
      hideSrc(true);
      requestAnimationFrame(function () { ins.classList.add("on"); });
      flip(a, insFrame, false).catch(function () {}).then(function () { busy = false; });
    } else go();
  };
  var closeIns = function () {
    if (busy || !ins.open) return;
    busy = true;
    var srcEl = cur().el;
    ins.classList.remove("on");
    loupe.classList.remove("on");
    var done = function () {
      ins.close();
      insFrame.getAnimations().forEach(function (an) { an.cancel(); });
      hideSrc(false);
      U.unlock();
      if (insOpener && insOpener.focus) insOpener.focus({ preventScroll: true });
      busy = false;
    };
    if (!reduced && srcEl && srcEl.offsetParent) {
      var a = srcEl.getBoundingClientRect();
      var inView = a.bottom > 0 && a.top < innerHeight;
      if (inView) { flip(a, insFrame, true).catch(function () {}).then(done); return; }
    }
    setTimeout(done, reduced ? 0 : 300);
  };
  var step = function (dv) {
    if (busy || set.length < 2) return;
    swap(function () { at = (at + dv + set.length) % set.length; sheetAt = 0; if (!cur().plans) view = "render"; paint(); hideSrc(true); });
  };
  $("#ins-prev").addEventListener("click", function () { step(-1); });
  $("#ins-next").addEventListener("click", function () { step(1); });
  $$("[data-close]", ins).forEach(function (b) { b.addEventListener("click", closeIns); });
  ins.addEventListener("cancel", function (e) { e.preventDefault(); closeIns(); });
  ins.addEventListener("keydown", function (e) {
    if (e.target.closest && e.target.closest(".ins-sheets, .seg")) return;
    if (e.key === "ArrowRight") step(1);
    if (e.key === "ArrowLeft") step(-1);
  });
  ins.addEventListener("click", function (e) { if (e.target.classList.contains("ins-wrap") || e.target.classList.contains("ins-bg") || e.target.classList.contains("ins-work")) closeIns(); });

  /* The loupe: shows the work at 2.6× (drawings at 3×) under a brass ring; mouse by hovering, touch by pressing. */
  var setLoupe = function (on) {
    loupeOn = on;
    loupeBtn.setAttribute("aria-pressed", String(on));
    insIn.style.touchAction = on ? "none" : "pan-y";
    if (!on) loupe.classList.remove("on");
  };
  loupeBtn.addEventListener("click", function () { setLoupe(!loupeOn); });
  var pressing = false;
  var moveLoupe = function (e) {
    var r = insIn.getBoundingClientRect(), w = insWork.getBoundingClientRect();
    var x = e.clientX - r.left, y = e.clientY - r.top;
    if (x < 0 || y < 0 || x > r.width || y > r.height) { loupe.classList.remove("on"); return; }
    var Z = insWork.classList.contains("plan") ? 3 : 2.6, L = loupe.offsetWidth;
    loupe.style.left = (e.clientX - w.left) + "px";
    loupe.style.top = (e.clientY - w.top) + "px";
    loupe.style.backgroundSize = (r.width * Z) + "px " + (r.height * Z) + "px";
    loupe.style.backgroundPosition = (L / 2 - x * Z) + "px " + (L / 2 - y * Z) + "px";
    loupe.classList.add("on");
  };
  insIn.addEventListener("pointermove", function (e) { if (!loupeOn) return; if (e.pointerType === "mouse" || pressing) moveLoupe(e); });
  insIn.addEventListener("pointerdown", function (e) { if (!loupeOn || e.pointerType === "mouse") return; pressing = true; insIn.setPointerCapture(e.pointerId); moveLoupe(e); });
  var lift = function () { pressing = false; loupe.classList.remove("on"); };
  insIn.addEventListener("pointerup", lift);
  insIn.addEventListener("pointercancel", lift);
  insIn.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") loupe.classList.remove("on"); });

  /* Markup form: any element with data-inspect="group" holding a framed img; items come from the group, in order. */
  var itemFrom = function (el) {
    var img = $("img", el);
    return {
      src: el.dataset.src || img.getAttribute("src"), w: +(img.getAttribute("width") || img.naturalWidth || 16), h: +(img.getAttribute("height") || img.naturalHeight || 10),
      alt: img.getAttribute("alt"), no: el.dataset.no, title: el.dataset.title || img.getAttribute("alt"), me: el.dataset.me, tx: el.dataset.tx,
      tag: el.dataset.tag, el: $(".fr", el) || el,
    };
  };
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-inspect]");
    if (!t) return;
    e.preventDefault();
    var g = t.dataset.inspect;
    if (g === "units") { var els = $$('[data-inspect="units"][data-unit]', t.closest("section") || document); U.inspect(els.map(function (el) { return U.unitItem(+el.dataset.unit, el); }), els.indexOf(t), { from: t }); return; }
    var group = $$('[data-inspect="' + g + '"]');
    U.inspect(group.map(itemFrom), group.indexOf(t), { from: t });
  });

  /* ── Levan's six home types, with every published plan (areas as levan.com.tr publishes them). */
  var P = function (k, w, h, label, net, gross, garden, pc) {
    var specs = [["Net alan", net + " m²"], ["Brüt alan", gross + " m²"]];
    if (garden !== undefined) specs.push(["Bahçe", garden ? garden + " m²" : "—"]);
    return { src: A + "img/levan--plan--" + k + ".webp", w: w, h: h, label: label, specs: specs, pc: pc };
  };
  var villa = function (k, net, gross, garden) {
    var pc = "Alanlar üç katın toplamıdır.";
    return [P(k + "-zemin", 1600, 960, "Zemin kat", net, gross, garden, pc), P(k + "-1-kat", 1600, 960, "1. kat", net, gross, garden, pc), P(k + "-bodrum", 1600, 960, "Bodrum", net, gross, garden, pc)];
  };
  U.UNITS = [
    { t: "2+1 Daire", kind: "Daire", img: "levan--ic--2-1-salon", w: 1600, h: 900, alt: "2+1 dairede salon", bl: "Yeni başlangıçlar için: ferah, kullanışlı ve bahçe yaşamına açık.", net: "64,83–70,17", gross: "73,83–81,13",
      plans: [P("2-1-a", 1600, 918, "2+1 A", "64,83", "73,83"), P("2-1-b", 1600, 918, "2+1 B", "69,20", "78,86"), P("2-1-c", 1600, 918, "2+1 C", "70,17", "81,13")] },
    { t: "3+1 Daire", kind: "Daire", img: "levan--ic--3-1-salon", w: 1600, h: 900, alt: "3+1 dairede salon", bl: "Aile yaşamına göre kurgulanmış geniş salonlar ve ebeveyn banyosu.", net: "113,07–123,43", gross: "127,93–141,21",
      plans: [P("3-1-a", 1600, 918, "3+1 A", "118,41", "135,95"), P("3-1-b", 1600, 918, "3+1 B", "123,43", "141,21"), P("3-1-c", 1600, 918, "3+1 C", "113,07", "127,93")] },
    { t: "4+1 Daire", kind: "Daire", img: "levan--avlu-aksam", w: 1200, h: 675, alt: "Gün batımında bloklar arasındaki avlu", bl: "Kalabalık aileler için cömert metrekare, gün ışığı ve geniş balkonlar.", net: "155,71", gross: "178,13",
      plans: [P("4-1", 1600, 918, "4+1", "155,71", "178,13")] },
    { t: "4+1 İkiz Villa", kind: "Villa", img: "levan--ikiz-villa-gece", w: 1600, h: 1231, alt: "Gece aydınlatmasıyla ikiz villalar", bl: "Bodrum, zemin ve birinci kattan oluşan yaşam; özel bahçe.", net: "271,02", gross: "310,12", garden: "85,74",
      plans: villa("ikiz", "271,02", "310,12", "85,74") },
    { t: "5+1 Müstakil Villa", kind: "Villa", img: "levan--villa-gece", w: 1200, h: 923, alt: "Gece bir müstakil villa", bl: "Kendi bahçesi ve kendi kapısıyla; gökyüzüyle arada engel yok.", net: "329,89", gross: "378,10",
      plans: villa("mustakil", "329,89", "378,10") },
    { t: "6+1 Malikane", kind: "Malikane", img: "levan--vaziyet-gunduz", w: 1600, h: 1200, alt: "Levan Bahçeşehir'in havadan görünümü", bl: "Levan'ın zirvesi: geniş tahsisli bahçesiyle.", net: "268,35", gross: "301,80", garden: "1.159,09",
      plans: [P("malikane", 1600, 1194, "6+1", "268,35", "301,80", "1.159,09")] },
  ];
  U.unitItem = function (i, el) {
    var u = U.UNITS[i];
    var specs = [["Net alan", u.net + " m²"], ["Brüt alan", u.gross + " m²"], ["Bahçe", u.garden ? u.garden + " m²" : "—"]];
    return { src: A + "img/" + u.img + ".webp", w: u.w, h: u.h, alt: u.alt, no: (el && el.dataset.no) || "Kat. II.5." + (i + 1), title: u.t, me: "Levan Bahçeşehir · " + u.kind + " · Görselleştirme", tx: u.bl, specs: specs, plans: u.plans, el: el ? $(".fr", el) || el : null, tag: "Görselleştirme" };
  };

  /* ── Demo forms: checked in the browser, never sent; the note says so. */
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
    if (!el.id) el.id = "f-" + ++seq;
    var id = el.id + "-err", err = document.getElementById(id);
    if (msg) {
      if (!err) { err = document.createElement("span"); err.className = "err"; err.id = id; if (wrap.classList.contains("check")) wrap.after(err); else wrap.appendChild(err); }
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
      fields.forEach(function (el) { var m = problem(el); mark(el, m); if (m && !first) first = el; });
      if (first) { first.focus(); return; }
      var note = $(".form-sent", f);
      f.dispatchEvent(new CustomEvent("uzm:sent", { bubbles: true }));
      $$(".field, .check, button[type=submit]", f).forEach(function (el) { el.hidden = true; });
      if (note) { note.hidden = false; note.setAttribute("tabindex", "-1"); note.focus(); }
    });
  });

  /* ── The audio guide: a keypad opens the numbered stop. */
  $$(".ag").forEach(function (ag) {
    var stops = $$(".qa details", ag), keys = $$(".keys button", ag), scr = $(".scr", ag);
    var show = function (i) {
      var dt = stops[i];
      if (!dt) return;
      keys.forEach(function (k, j) { k.setAttribute("aria-pressed", String(j === i)); });
      if (scr) { $("b", scr).textContent = $(".st b", dt).textContent; $("span", scr).textContent = $(".q", dt).textContent; }
      dt.open = true;
      dt.classList.remove("ping"); void dt.offsetWidth; dt.classList.add("ping");
      var r = dt.getBoundingClientRect();
      if (r.top < 80 || r.bottom > innerHeight) U.goTo(dt, -innerHeight * 0.3);
    };
    keys.forEach(function (k, i) { k.addEventListener("click", function () { show(i); }); });
    stops.forEach(function (dt, i) { dt.addEventListener("toggle", function () { if (dt.open && scr) { keys.forEach(function (k, j) { k.setAttribute("aria-pressed", String(j === i)); }); $("b", scr).textContent = $(".st b", dt).textContent; $("span", scr).textContent = $(".q", dt).textContent; } }); });
  });

  /* ── Vitrines: the glare on the glass follows the pointer. */
  if (fine && !reduced) $$(".vitrine").forEach(function (v) {
    v.addEventListener("pointermove", function (e) { var r = v.getBoundingClientRect(); v.style.setProperty("--gx", ((e.clientX - r.left) / r.width) * 100 + "%"); });
  });

  /* ── The invitation card tilts toward the pointer and its sheen follows. */
  var tilts = [];
  if (fine && !reduced) $$("[data-tilt]").forEach(function (card) {
    var t = { el: card, x: 0, y: 0, tx: 0, ty: 0, sx: 40, tsx: 40 };
    var host = card.closest("section") || card.parentElement;
    host.addEventListener("pointermove", function (e) { var r = card.getBoundingClientRect(); var nx = clamp((e.clientX - r.left) / r.width, -0.4, 1.4) - 0.5, ny = clamp((e.clientY - r.top) / r.height, -0.4, 1.4) - 0.5; t.ty = nx * 9; t.tx = -ny * 7; t.tsx = 20 + (nx + 0.5) * 60; });
    host.addEventListener("pointerleave", function () { t.tx = t.ty = 0; t.tsx = 40; });
    tilts.push(t);
  });

  /* ── Cursor ring: names what a click does over [data-cursor]. */
  var curEl = null, cx = -100, cy = -100, ctx = -100, cty = -100, hasPtr = false;
  if (fine && !reduced) {
    curEl = document.createElement("div");
    curEl.className = "cur"; curEl.setAttribute("aria-hidden", "true"); curEl.innerHTML = "<span></span>";
    body.appendChild(curEl);
    var readCur = function (t) { var c = t && t.closest && t.closest("[data-cursor]"); curEl.classList.toggle("big", !!c); if (c) curEl.firstChild.textContent = c.dataset.cursor; };
    addEventListener("pointermove", function (e) { if (e.pointerType !== "mouse") return; ctx = e.clientX; cty = e.clientY; if (!hasPtr) { cx = ctx; cy = cty; } hasPtr = true; curEl.classList.remove("hide"); readCur(e.target); }, { passive: true });
    document.addEventListener("pointerleave", function () { curEl.classList.add("hide"); });
  }

  /* ── The presenter pill steps aside while scrolling down; back on the way up, near the top and at the end. */
  var pres = $(".pres"), lastY = window.scrollY;
  var presTick = function (y, vh) {
    var dy = y - lastY;
    if (Math.abs(dy) < 6) return;
    var end = y + vh >= document.documentElement.scrollHeight - 80;
    pres.classList.toggle("away", dy > 0 && y > vh * 0.5 && !end);
    lastY = y;
  };

  /* ── Parallax inside a frame or niche: [data-par="speed"] images drift a little as they pass. */
  var pars = reduced ? [] : $$("[data-par]");
  if (pars.length) U.loop.push(function (y, vh) {
    for (var i = 0; i < pars.length; i++) {
      var r = pars[i].parentElement.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) continue;
      var p = (r.top + r.height / 2 - vh / 2) / vh;
      pars[i].style.setProperty("--py", (p * -100 * +pars[i].dataset.par).toFixed(1) + "px");
    }
  });

  /* ── Resize */
  var rz;
  addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(function () { measure(); curKey = null; U.resize.forEach(function (fn) { fn(); }); }, 160); });
  addEventListener("load", function () { measure(); curKey = null; });
  new ResizeObserver(function () { measure(); }).observe(body);

  /* ── One loop */
  var frame = 0;
  var loop = function (now) {
    if (lenis) lenis.raf(now);
    var y = U.scrollY(), vh = innerHeight;
    for (var i = 0; i < U.loop.length; i++) U.loop[i](y, vh, now);
    if (frame++ % 4 === 0) { setRoom(window.scrollY); if (pres) presTick(window.scrollY, vh); }
    if (curEl) {
      cx = lerp(cx, ctx, 0.22); cy = lerp(cy, cty, 0.22);
      curEl.style.transform = "translate3d(" + cx.toFixed(1) + "px," + cy.toFixed(1) + "px,0)";
      if (frame % 8 === 0 && hasPtr) readCur(document.elementFromPoint(ctx, cty));
    }
    for (var k = 0; k < tilts.length; k++) {
      var t = tilts[k];
      if (Math.abs(t.tx - t.x) + Math.abs(t.ty - t.y) + Math.abs(t.tsx - t.sx) < 0.01) continue;
      t.x = lerp(t.x, t.tx, 0.08); t.y = lerp(t.y, t.ty, 0.08); t.sx = lerp(t.sx, t.tsx, 0.08);
      t.el.style.setProperty("--rx", t.x.toFixed(2) + "deg"); t.el.style.setProperty("--ry", t.y.toFixed(2) + "deg"); t.el.style.setProperty("--sx", t.sx.toFixed(1) + "%");
    }
    requestAnimationFrame(loop);
  };
  measure();
  setRoom(window.scrollY);
  addEventListener("scroll", function () { setRoom(window.scrollY); }, { passive: true });
  requestAnimationFrame(loop);
})();
