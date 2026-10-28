/* Galeri · completed-project chapters: the tissue guard that lifts off a plate, and the gatefold that opens. */
(function () {
  var U = window.UZM, $ = U.$, $$ = U.$$, clamp = U.clamp;

  /* The tissue guard: as the plate reaches the reader, the sheet over it lifts from its top edge. The button lifts or
     lays it down for good; with reduced motion it starts lifted and only the button moves it. */
  $$(".tissue-plate").forEach(function (fig) {
    var tissue = $(".tissue", fig), btn = $(".tissue-btn", fig), pic = $(".tissue-pic", fig);
    var manual = null;
    var hideT = 0;
    var set = function (v, later) {
      clearTimeout(hideT);
      tissue.style.setProperty("--lift", v.toFixed(3));
      if (v <= 0.995) tissue.style.visibility = "";
      else if (later && !U.reduced) hideT = setTimeout(function () { tissue.style.visibility = "hidden"; }, 1250);
      else tissue.style.visibility = "hidden";
    };
    var label = function (lifted) { btn.textContent = lifted ? "Pelürü indirin" : "Pelürü kaldırın"; btn.setAttribute("aria-pressed", lifted); };
    btn.addEventListener("click", function () {
      var lifted = manual === null ? +getComputedStyle(tissue).getPropertyValue("--lift") > 0.5 : manual;
      manual = !lifted;
      fig.classList.add("lifted");
      set(manual ? 1 : 0, true);
      label(manual);
    });
    if (U.reduced) { manual = true; set(1); label(true); return; }
    U.onScroll.push(function (y, vh) {
      if (manual !== null) return;
      var r = pic.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      var p = clamp((vh * 0.72 - r.top) / (vh * 0.5), 0, 1);
      var e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      set(e);
      label(e > 0.5);
    });
  });

  /* The gatefold: the side plates swing open from behind the middle one as the fold scrolls into place. */
  $$(".gate").forEach(function (gate) {
    var narrow = matchMedia("(max-width: 760px)");
    if (U.reduced) { gate.style.setProperty("--fold", 0); return; }
    U.onScroll.push(function (y, vh) {
      if (narrow.matches) return;
      var r = gate.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      var p = clamp((vh * 0.92 - r.top) / (vh * 0.55), 0, 1);
      var e = 1 - Math.pow(1 - p, 3);
      gate.style.setProperty("--fold", ((1 - e) * 0.95).toFixed(4));
    });
  });

  U.refresh();
})();
