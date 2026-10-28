/* Zirve · projects index: the map. Pointing at a place (pin or list) lights it; choosing one brings the map to it and opens
   its card; the card's "Genel görünüm" or Escape returns to the whole view. The drawn sheet below is the default view
   and the fallback; projects-map.mjs swaps in the real map when it loads (Z.mapView). */
(function () {
  var U = window.Z, $ = U.$, $$ = U.$$;
  var map = $(".map");
  if (!map) return;
  var world = $(".map-world", map), card = $(".map-card");
  var items = $$(".places li"), buttons = $$(".place");
  var sel = null;
  var pins = function () { return $$(".pin, .gpin", map); };

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
    card.innerHTML =
      '<p class="tag"></p><h3 class="h4"></h3><p></p>' +
      (dist && dist !== "—" ? '<p class="meta">Levan\'a kuş uçuşu ' + dist.replace("~", "yaklaşık ") + "</p>" : '<p class="meta">Halkaların merkezi</p>') +
      '<div class="map-card-foot"><a class="link"></a><button class="map-x" type="button">Genel görünüm</button></div>';
    $(".map-x", card).addEventListener("click", function () { select(null); });
    $(".tag", card).textContent = t(".place-t .tag");
    $(".h4", card).textContent = t(".place-nm");
    card.children[2].textContent = t(".place-nt");
    var a = $("a", card);
    a.href = li.dataset.href;
    a.innerHTML = li.dataset.go + ' <span aria-hidden="true">' + (ext ? "↗" : "→") + "</span>";
    if (ext) { a.target = "_blank"; a.rel = "noopener"; }
  };

  /* The drawn sheet: zoom the sheet so the pin comes forward; the card takes the corner farthest from it. */
  var sheet = {
    focus: function (id) {
      var pin = $('.pin[data-id="' + id + '"]', map);
      var z = innerWidth < 760 ? 2 : 2.3;
      var px = parseFloat(pin.style.getPropertyValue("--x")) / 100;
      var py = parseFloat(pin.style.getPropertyValue("--y")) / 100;
      var tx = U.clamp(0.5 - px * z, 1 - z, 0), ty = U.clamp(0.42 - py * z, 1 - z, 0);
      world.style.setProperty("--z", z);
      world.style.setProperty("--tx", tx.toFixed(4));
      world.style.setProperty("--ty", ty.toFixed(4));
      map.classList.add("zoomed");
      var sx = px * z + tx, sy = py * z + ty;
      card.classList.toggle("top", sy > 0.5);
      card.classList.toggle("right", sx < 0.5);
    },
    reset: function () {
      world.style.setProperty("--z", 1);
      world.style.setProperty("--tx", 0);
      world.style.setProperty("--ty", 0);
      map.classList.remove("zoomed");
    }
  };
  U.mapView = sheet;

  var select = function (id, from) {
    if (sel === id) id = null;
    sel = id;
    buttons.forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.id === id); });
    pins().forEach(function (p) { p.classList.toggle("sel", p.dataset.id === id); p.setAttribute("aria-pressed", p.dataset.id === id); });
    if (id) {
      fill(id);
      card.classList.add("show");
      U.mapView.focus(id);
      if (from === "list") {
        var r = map.getBoundingClientRect();
        if (r.top < 0 || r.bottom > innerHeight) {
          if (U.lenis) U.lenis.scrollTo(map, { offset: -100, duration: 1.2 });
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
  U.mapLight = lit;

  /* Wiring shared by both views' pins; the real map's pins call U.mapBindPin as it creates them. */
  U.mapBindPin = function (p) {
    p.setAttribute("aria-pressed", p.dataset.id === sel);
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
