/* Işık · projects: the place list and the map's glass card. Pointing at a place lights it; choosing one brings the
   map to it and opens its card. The drawn sheet is the fallback view; projects-map.mjs swaps in the live map
   (UZM.mapView) and its day/night light (UZM.mapLightSet). */
(function () {
  var U = window.UZM, $ = U.$, $$ = U.$$;
  var map = $("#map");
  if (!map) return;
  var card = $(".map-card", map), items = $$(".places li"), buttons = $$(".place"), sel = null;
  var pins = function () { return $$(".spin, .gpin", map); };

  var lit = function (id) {
    pins().forEach(function (p) { p.classList.toggle("on", p.dataset.id === id || p.dataset.id === sel); });
    items.forEach(function (li) { li.classList.toggle("on", li.dataset.id === id || li.dataset.id === sel); });
  };
  var fill = function (id) {
    var li = items.filter(function (x) { return x.dataset.id === id; })[0];
    var t = function (s) { var el = $(s, li); return el ? el.textContent : ""; };
    var dist = t(".place-d").trim(), ext = li.hasAttribute("data-ext");
    card.innerHTML = '<p class="eyebrow"></p><h3 class="h4"></h3><p class="mc-note"></p><p class="fine mc-d"></p><div class="mc-foot"><a class="link"></a><button class="mc-x" type="button">Genel görünüm</button></div>';
    $(".eyebrow", card).textContent = t(".place-k");
    $(".h4", card).textContent = t(".place-nm");
    $(".mc-note", card).textContent = t(".place-nt");
    $(".mc-d", card).textContent = dist && dist !== "—" ? "Levan'a kuş uçuşu " + dist.replace("~", "yaklaşık ") : "Halkaların merkezi";
    var a = $("a", card);
    a.href = li.dataset.href;
    a.innerHTML = li.dataset.go + ' <span aria-hidden="true">' + (ext ? "↗" : "→") + "</span>" + (ext ? '<span class="sr"> (yeni sekmede açılır)</span>' : "");
    if (ext) { a.target = "_blank"; a.rel = "noopener"; }
    $(".mc-x", card).addEventListener("click", function () { select(null); });
  };
  /* The drawn sheet: no camera, just light on the chosen pin. */
  U.mapView = { focus: function () {}, reset: function () {} };

  var select = function (id, from) {
    if (sel === id) id = null;
    sel = id;
    buttons.forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.id === id); });
    pins().forEach(function (p) { p.classList.toggle("sel", p.dataset.id === id); if (p.tagName === "BUTTON") p.setAttribute("aria-pressed", p.dataset.id === id); });
    if (id) {
      fill(id); card.classList.add("show"); U.mapView.focus(id);
      if (from === "list") { var r = map.getBoundingClientRect(); if (r.top < 0 || r.bottom > innerHeight) U.scrollTo(scrollY + r.top - 100); }
    } else { card.classList.remove("show"); U.mapView.reset(); }
    lit(null);
  };
  U.mapSelect = select;
  U.mapBindPin = function (p) {
    p.setAttribute("aria-pressed", p.dataset.id === sel);
    p.addEventListener("pointerenter", function () { lit(p.dataset.id); });
    p.addEventListener("pointerleave", function () { lit(null); });
    p.addEventListener("focus", function () { lit(p.dataset.id); });
    p.addEventListener("blur", function () { lit(null); });
    p.addEventListener("click", function (e) { e.stopPropagation(); select(p.dataset.id, "pin"); });
  };
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

  /* Day or night on the map: the toggle, remembered by the live map when it arrives. */
  var lightBtns = $$(".map-light button");
  U.mapLightMode = "day";
  lightBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      U.mapLightMode = b.dataset.light;
      lightBtns.forEach(function (o) { o.setAttribute("aria-pressed", o === b); });
      map.classList.toggle("is-night", U.mapLightMode === "night");
      if (U.mapLightSet) U.mapLightSet(U.mapLightMode);
    });
  });
})();
