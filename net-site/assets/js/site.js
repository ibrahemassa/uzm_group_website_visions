/* Net · the site's only script (no framework, no libraries on load). Header state, the phone menu, dialogs (visit,
   floor plans, image viewer), enquiry forms (checked here; in production they post to /api/contact, in this preview
   they say they did not send), the cookie notice, fade-ins, the hero film, and maps that load only when asked for.
   Everything works without it except the dialogs, which fall back to their links (tel:, WhatsApp, the plan files). */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var doc = document.documentElement, body = document.body;
  var lang = (doc.lang || "tr").slice(0, 2);
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var tr = function (a, b) { return lang === "tr" ? a : b; };

  /* ── Header: over the home film it is clear until the page moves ── */
  var onScroll = function () { body.classList.toggle("scrolled", scrollY > 24); };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ── Dialogs ── */
  var opener = null;
  var open = function (d, from) {
    if (!d || d.open) return;
    opener = from || document.activeElement;
    d.showModal();
  };
  $$("dialog").forEach(function (d) {
    d.addEventListener("click", function (e) {
      if (e.target === d || e.target.closest("[data-close]")) d.close();
    });
    d.addEventListener("close", function () {
      var m = $(".hdr-menu");
      if (d.id === "menu" && m) m.setAttribute("aria-expanded", "false");
      if (opener && opener.focus) opener.focus();
    });
  });
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-open]");
    if (!b) return;
    e.preventDefault();
    var menu = $("#menu");
    if (menu && menu.open) menu.close();
    open($("#" + b.dataset.open), b);
  });
  var menuBtn = $(".hdr-menu");
  if (menuBtn) menuBtn.addEventListener("click", function () { menuBtn.setAttribute("aria-expanded", "true"); open($("#menu"), menuBtn); });

  /* ── Floor plans: [data-plan="3-1"] (optionally data-plan-i) opens the plan dialog with a tab per plan / floor ── */
  var plan = $("#plan"), units = null;
  try { units = JSON.parse($("#units-data").textContent); } catch (e) { units = null; }
  var showPlan = function (id, start, from) {
    var u = units && units.units[id];
    if (!u || !plan) return false;
    var L = units.labels, tabs = $(".plan-tabs", plan), img = $(".plan-sheet img", plan), dl = $(".plan-areas", plan);
    // one tab per drawing: the variants of a flat (A, B, C) or the floors of a villa
    var items = [];
    u.plans.forEach(function (p) {
      p.sheets.forEach(function (s) { items.push({ p: p, s: s, label: s.floor ? s.floor : p.name }); });
    });
    $(".plan-title", plan).textContent = u.title;
    tabs.innerHTML = "";
    tabs.hidden = items.length < 2;
    var show = function (i) {
      var it = items[i];
      img.src = it.s.src; img.width = it.s.w; img.height = it.s.h;
      img.alt = u.title + ", " + it.label + " " + L.plan;
      dl.innerHTML = "<div><dt>" + L.net + "</dt><dd>" + it.p.net + " " + L.unit + "</dd></div><div><dt>" + L.gross + "</dt><dd>" + it.p.gross + " " + L.unit + "</dd></div>" +
        (it.p.garden ? "<div><dt>" + L.garden + "</dt><dd>" + it.p.garden + " " + L.unit + "</dd></div>" : "");
      $$("button", tabs).forEach(function (b, j) { b.setAttribute("aria-selected", String(i === j)); b.tabIndex = i === j ? 0 : -1; });
    };
    items.forEach(function (it, i) {
      var b = document.createElement("button");
      b.type = "button"; b.setAttribute("role", "tab"); b.textContent = it.label;
      b.addEventListener("click", function () { show(i); });
      b.addEventListener("keydown", function (e) {
        var k = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!k) return;
        var n = (i + k + items.length) % items.length;
        show(n); $$("button", tabs)[n].focus();
      });
      tabs.appendChild(b);
    });
    show(Math.min(start || 0, items.length - 1));
    open(plan, from);
    return true;
  };
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-plan]");
    if (b && showPlan(b.dataset.plan, +(b.dataset.planI || 0), b)) e.preventDefault();
  });

  /* ── Image viewer: [data-lb="group"] links to the large file; the group pages through ── */
  var lb = $("#lb");
  if (lb) {
    var items = [], at = 0, lbImg = $(".lb-fig img", lb);
    var lbShow = function (i) {
      at = (i + items.length) % items.length;
      var a = items[at], im = $("img", a);
      lbImg.src = a.getAttribute("href");
      lbImg.alt = im ? im.alt : "";
      $(".lb-cap", lb).textContent = a.dataset.cap || (im ? im.alt : "");
      $(".lb-count", lb).textContent = at + 1 + " / " + items.length;
      $(".lb-prev", lb).hidden = $(".lb-next", lb).hidden = items.length < 2;
    };
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a[data-lb]");
      if (!a) return;
      e.preventDefault();
      items = $$('a[data-lb="' + a.dataset.lb + '"]');
      lbShow(items.indexOf(a));
      open(lb, a);
    });
    $(".lb-prev", lb).addEventListener("click", function () { lbShow(at - 1); });
    $(".lb-next", lb).addEventListener("click", function () { lbShow(at + 1); });
    lb.addEventListener("keydown", function (e) { if (e.key === "ArrowLeft") lbShow(at - 1); if (e.key === "ArrowRight") lbShow(at + 1); });
  }

  /* ── Forms: say what is missing next to the field; this preview never sends ── */
  $$("form[data-demo]").forEach(function (f) {
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var bad = null;
      $$(".err", f).forEach(function (x) { x.remove(); });
      $$("[required]", f).forEach(function (inp) {
        var v = inp.value.trim();
        var ok = inp.type === "checkbox" ? inp.checked : inp.type === "tel" ? v.replace(/\D/g, "").length >= 7 : v.length >= (+inp.getAttribute("minlength") || 1);
        if (ok && inp.type === "email" && v) ok = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
        inp.setAttribute("aria-invalid", String(!ok));
        if (ok) { inp.removeAttribute("aria-describedby"); return; }
        var m = document.createElement("p");
        m.className = "err";
        m.id = inp.id + "-err";
        m.textContent = inp.type === "checkbox" ? tr("Devam etmek için onaylayın.", "Please confirm to continue.")
          : inp.type === "tel" ? tr("Telefon numaranızı yazın.", "Please enter your phone number.")
          : inp.tagName === "TEXTAREA" ? tr("Birkaç kelimeyle yazın (en az 10 karakter).", "Please write a few words (10 characters or more).")
          : tr("Bu alanı doldurun.", "Please fill in this field.");
        (inp.closest(".field") || inp.closest(".check")).after(m);
        inp.setAttribute("aria-describedby", m.id);
        bad = bad || inp;
      });
      if (bad) { bad.focus(); return; }
      var sent = $(".form-sent", f);
      sent.hidden = false;
      sent.focus();
      f.reset();
    });
  });

  /* ── Cookie notice: once, until acknowledged ── */
  var notice = $(".notice");
  var seen = false;
  try { seen = localStorage.getItem("net-notice") === "1"; } catch (e) { seen = false; }
  if (notice && !seen) {
    notice.hidden = false;
    $("[data-notice-ok]", notice).addEventListener("click", function () {
      notice.hidden = true;
      try { localStorage.setItem("net-notice", "1"); } catch (e) { /* private mode: it simply shows again */ }
    });
  }

  /* ── Fade-ins ── */
  var rs = $$("[data-r]");
  if ("IntersectionObserver" in window && !reduced) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -6% 0px" });
    rs.forEach(function (el) { io.observe(el); });
  } else rs.forEach(function (el) { el.classList.add("in"); });

  /* ── Films: muted, looped, small file on small screens; never autoplay for reduced motion or data saver ── */
  $$("[data-film]").forEach(function (box) {
    var v = $("video", box), btn = $(".film-btn", box);
    if (!v) return;
    var save = navigator.connection && navigator.connection.saveData;
    var src = innerWidth < 900 ? v.dataset.small : v.dataset.large;
    var setBtn = function (playing) {
      if (!btn) return;
      btn.setAttribute("aria-pressed", String(!playing));
      $(".film-play", btn).hidden = playing;
      $(".film-pause", btn).hidden = !playing;
      $(".sr", btn).textContent = playing ? tr("Filmi durdurun", "Pause the film") : tr("Filmi oynatın", "Play the film");
    };
    var start = function () {
      if (!v.src) v.src = src;
      var p = v.play();
      if (p && p.catch) p.catch(function () { setBtn(false); });
      setBtn(true);
    };
    if (btn) {
      btn.hidden = false;
      btn.addEventListener("click", function () { if (v.paused) start(); else { v.pause(); setBtn(false); } });
    }
    if (!reduced && !save) start(); else setBtn(false);
    // a film nobody is looking at should not keep the processor busy
    var userPaused = false;
    if (btn) btn.addEventListener("click", function () { userPaused = v.paused; });
    if ("IntersectionObserver" in window) new IntersectionObserver(function (es) {
      var vis = es[0].isIntersecting;
      if (!vis && !v.paused) v.pause();
      else if (vis && v.paused && v.src && !userPaused && !reduced && !save) v.play().catch(function () {});
    }, { threshold: 0.15 }).observe(box);
  });

  /* ── Maps: a picture and a button until asked; then MapLibre with OpenFreeMap's light tiles ── */
  $$("[data-map]").forEach(function (box) {
    var btn = $(".map-load", box);
    if (!btn) return;
    btn.addEventListener("click", function () {
      btn.disabled = true;
      btn.textContent = tr("Harita yükleniyor…", "Loading the map…");
      var base = new URL(box.dataset.vendor.replace(/\/?$/, "/"), location.href).href;
      var css = document.createElement("link");
      css.rel = "stylesheet"; css.href = base + "maplibre-gl.css";
      document.head.appendChild(css);
      import(base + "maplibre-gl.mjs").then(function (ml) {
        ml.setWorkerUrl(base + "maplibre-gl-worker.mjs");
        var el = document.createElement("div");
        el.className = "map-canvas";
        box.appendChild(el);
        var pins = JSON.parse(box.dataset.map);
        // data-fly: start over the whole city and fly down to the first pin, buildings rising as it gets close
        var fly = box.hasAttribute("data-fly") && !reduced;
        var map = new ml.Map({
          container: el, style: "https://tiles.openfreemap.org/styles/positron",
          center: fly ? [28.97, 41.04] : pins[0].at, zoom: fly ? 8.6 : +(box.dataset.zoom || 12), pitch: 0,
          cooperativeGestures: true, attributionControl: { compact: true },
        });
        map.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
        pins.forEach(function (p) {
          var m = document.createElement("div");
          m.className = "map-pin" + (p.main ? " main" : "");
          m.innerHTML = "<span>" + p.label + "</span>";
          new ml.Marker({ element: m, anchor: "bottom" }).setLngLat(p.at).addTo(map);
        });
        map.on("load", function () {
          var first = (map.getStyle().layers.find(function (l) { return l.type === "symbol"; }) || {}).id;
          map.addLayer({ id: "net-3d", source: "openmaptiles", "source-layer": "building", type: "fill-extrusion", minzoom: 13,
            paint: { "fill-extrusion-color": "#e3ded5", "fill-extrusion-opacity": 0.9,
              "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 13, 0, 14.5, ["coalesce", ["get", "render_height"], 8]],
              "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0] } }, first);
          box.classList.add("map-on");
          if (fly) map.flyTo({ center: pins[0].at, zoom: +(box.dataset.zoom || 12) + 0.8, pitch: 55, bearing: 25, duration: 5200, essential: false, curve: 1.3 });
        });
      }).catch(function () {
        btn.disabled = false;
        btn.textContent = tr("Harita açılamadı, yeniden deneyin", "The map did not load, try again");
      });
    });
  });
})();
