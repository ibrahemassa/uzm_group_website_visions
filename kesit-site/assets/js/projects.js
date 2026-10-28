/* A-02 · Projects: the survey map. Pointing at a place (marker or list) lights it; choosing one brings the map to it
   and opens its card; "Genel görünüm" or Escape returns to the whole view. The drawn survey sheet below is the default
   and the fallback; projects-map.mjs swaps in the real map when it loads (UZM.mapView). The cursor's coordinates are
   read off whichever is showing. */
(function () {
  var U = window.UZM, $ = U.$, $$ = U.$$;
  var map = $(".map");
  if (!map) return;
  var world = $(".map-world", map), card = $(".map-card");
  var items = $$(".places li"), buttons = $$(".place");
  var xy = $(".xy-v", map);
  var sel = null;
  var pins = function () { return $$(".pin, .gpin", map); };

  /* Coordinates in the survey's notation: 41.1072° K · 28.6862° D */
  U.coord = function (lat, lng) { return lat.toFixed(4) + "° K · " + lng.toFixed(4) + "° D"; };
  /* The drawn sheet is a plate carrée of the area: the graticule fixes 5′ of longitude per 287.3 units, 5′ of
     latitude per 381.4 units (x 166.7 = 28°35′ D, y 267 = 41°10′ K). */
  var sheetCoord = function (e) {
    var r = world.getBoundingClientRect();
    var x = (e.clientX - r.left) / r.width * 1000, y = (e.clientY - r.top) / r.height * 1053;
    return { lng: 28 + 35 / 60 + (x - 166.7) / 287.3 * (5 / 60), lat: 41 + 10 / 60 - (y - 267) / 381.4 * (5 / 60) };
  };
  U.mapReadout = function (lat, lng) { xy.textContent = U.coord(lat, lng); };
  map.addEventListener("pointermove", function (e) {
    if (map.classList.contains("gl")) return;
    var c = sheetCoord(e);
    U.mapReadout(c.lat, c.lng);
  });

  var lit = function (id) {
    map.classList.toggle("hl", !!(id || sel));
    pins().forEach(function (p) { p.classList.toggle("on", p.dataset.id === id || p.dataset.id === sel); });
    items.forEach(function (li) { li.classList.toggle("on", li.dataset.id === id || li.dataset.id === sel); });
  };

  var fill = function (id) {
    var li = items.filter(function (x) { return x.dataset.id === id; })[0];
    var t = function (s) { var el = $(s, li); return el ? el.textContent : ""; };
    var dist = t(".place-d").trim();
    var ext = li.hasAttribute("data-ext");
    var approx = /Yaklaşık/i.test(t(".place-k"));
    card.innerHTML =
      '<p class="mono"></p><h3></h3><p></p>' +
      '<p class="mc-c"></p>' +
      '<div class="map-card-foot"><a class="ln"></a><button class="map-x" type="button">Genel görünüm</button></div>';
    $(".map-x", card).addEventListener("click", function () { select(null); });
    $(".mono", card).textContent = t(".place-n") + " · " + t(".place-k");
    $("h3", card).textContent = t(".place-nm");
    card.children[2].textContent = t(".place-nt");
    $(".mc-c", card).textContent = (approx ? "~ " : "") + U.coord(+li.dataset.lat, +li.dataset.lng) + (dist && dist !== "—" ? " · Levan'a kuş uçuşu " + dist.replace("~", "yaklaşık ") : " · halkaların merkezi");
    var a = $("a", card);
    a.href = li.dataset.href;
    a.innerHTML = li.dataset.go + ' <span aria-hidden="true">' + (ext ? "↗" : "→") + "</span>";
    if (ext) { a.target = "_blank"; a.rel = "noopener"; }
  };

  /* The drawn sheet: zoom so the marker comes forward; the card takes the corner farthest from it. */
  U.mapView = {
    focus: function (id) {
      var pin = $('.pin[data-id="' + id + '"]', map);
      var z = innerWidth < 760 ? 2 : 2.3;
      var px = parseFloat(pin.style.getPropertyValue("--x")) / 100, py = parseFloat(pin.style.getPropertyValue("--y")) / 100;
      var tx = U.clamp(0.5 - px * z, 1 - z, 0), ty = U.clamp(0.42 - py * z, 1 - z, 0);
      world.style.setProperty("--z", z); world.style.setProperty("--tx", tx.toFixed(4)); world.style.setProperty("--ty", ty.toFixed(4));
      map.classList.add("zoomed");
      var sx = px * z + tx, sy = py * z + ty;
      card.classList.toggle("top", sy > 0.5);
      card.classList.toggle("right", sx < 0.5);
    },
    reset: function () {
      world.style.setProperty("--z", 1); world.style.setProperty("--tx", 0); world.style.setProperty("--ty", 0);
      map.classList.remove("zoomed");
    }
  };

  var select = function (id, from) {
    if (sel === id) id = null;
    sel = id;
    buttons.forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.id === id)); });
    pins().forEach(function (p) { p.classList.toggle("sel", p.dataset.id === id); p.setAttribute("aria-pressed", String(p.dataset.id === id)); });
    if (id) {
      fill(id);
      card.classList.add("show");
      U.mapView.focus(id);
      if (from === "list") {
        var r = map.getBoundingClientRect();
        if (r.top < 0 || r.bottom > innerHeight) {
          if (window.__lenis) window.__lenis.scrollTo(map, { offset: -100, duration: 1.2 });
          else map.scrollIntoView({ behavior: U.reduced ? "auto" : "smooth", block: "center" });
        }
      }
    } else {
      card.classList.remove("show");
      U.mapView.reset();
    }
    lit(null);
  };
  U.mapSelect = select;

  U.mapBindPin = function (p) {
    p.setAttribute("aria-pressed", String(p.dataset.id === sel));
    p.addEventListener("pointerenter", function () { lit(p.dataset.id); });
    p.addEventListener("pointerleave", function () { lit(null); });
    p.addEventListener("focus", function () { lit(p.dataset.id); });
    p.addEventListener("blur", function () { lit(null); });
    p.addEventListener("click", function (e) { e.stopPropagation(); select(p.dataset.id, "pin"); });
  };
  $$(".pin", map).forEach(U.mapBindPin);
  items.forEach(function (li) {
    li.addEventListener("pointerenter", function () { lit(li.dataset.id); });
    li.addEventListener("pointerleave", function () { lit(null); });
  });
  buttons.forEach(function (b) {
    b.addEventListener("focus", function () { lit(b.dataset.id); });
    b.addEventListener("blur", function () { lit(null); });
    b.addEventListener("click", function () { select(b.dataset.id, "list"); });
  });
  map.parentElement.addEventListener("keydown", function (e) { if (e.key === "Escape" && sel) select(null); });
})();
