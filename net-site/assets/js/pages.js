/* Net · inner pages. Two small jobs. The legal texts' table of contents marks the section being read. And the
   contact page's map shows two offices, so it frames both pins rather than centring on one (site.js's maps do
   that); same rules as every map on the site: a picture and a button until asked, then MapLibre with OpenFreeMap's
   light tiles, nothing third-party before the click. With data-fly it arrives from the Istanbul overview, as the
   home's map does (not under reduced motion). */
(function () {
  "use strict";
  var lang = (document.documentElement.lang || "tr").slice(0, 2);
  var tr = function (a, b) { return lang === "tr" ? a : b; };
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── Table of contents: the heading nearest the top of the screen is the current one ── */
  var toc = document.querySelector(".toc");
  if (toc && "IntersectionObserver" in window) {
    var links = Array.prototype.slice.call(toc.querySelectorAll('a[href^="#"]'));
    var heads = links.map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); }).filter(Boolean);
    var mark = function (id) { links.forEach(function (a) { if (a.getAttribute("href") === "#" + id) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current"); }); };
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) mark(e.target.id); });
    }, { rootMargin: "-15% 0px -70% 0px" });
    heads.forEach(function (h) { io.observe(h); });
  }

  /* ── The two-office map ── */
  Array.prototype.forEach.call(document.querySelectorAll("[data-fitmap]"), function (box) {
    var btn = box.querySelector(".map-load");
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
        var pins = JSON.parse(box.dataset.fitmap);
        var lng = pins.map(function (p) { return p.at[0]; }), lat = pins.map(function (p) { return p.at[1]; });
        var el = document.createElement("div");
        el.className = "map-canvas";
        box.appendChild(el);
        var bounds = [[Math.min.apply(null, lng), Math.min.apply(null, lat)], [Math.max.apply(null, lng), Math.max.apply(null, lat)]];
        var pad = { top: 80, bottom: 48, left: 72, right: 72 };
        var fly = box.hasAttribute("data-fly") && !reduced;
        var map = new ml.Map(Object.assign({
          container: el, style: "https://tiles.openfreemap.org/styles/positron",
          cooperativeGestures: true, attributionControl: { compact: true },
        }, fly ? { center: [28.97, 41.04], zoom: 8.6 } : { bounds: bounds, fitBoundsOptions: { padding: pad, maxZoom: 14 } }));
        map.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
        pins.forEach(function (p) {
          var m = document.createElement("div"), s = document.createElement("span");
          m.className = "map-pin" + (p.main ? " main" : "");
          s.textContent = p.label;
          m.appendChild(s);
          new ml.Marker({ element: m, anchor: "bottom" }).setLngLat(p.at).addTo(map);
        });
        map.on("load", function () {
          box.classList.add("map-on");
          if (!fly) return;
          var cam = map.cameraForBounds(bounds, { padding: pad, maxZoom: 14 });
          if (cam) map.flyTo({ center: cam.center, zoom: cam.zoom, pitch: 40, bearing: 15, duration: 4600, curve: 1.3, essential: false });
        });
      }).catch(function () {
        btn.disabled = false;
        btn.textContent = tr("Harita açılamadı, yeniden deneyin", "The map did not load, try again");
      });
    });
  });
})();
