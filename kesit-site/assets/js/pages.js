/* Company sheets: the year scale (A-05), the survey's points (A-07) and the specification index (Y-01 / Y-02). */
(function () {
  var U = window.UZM, $ = U.$, $$ = U.$$, clamp = U.clamp;

  /* A-05 · Milestones: the year scale fills to the reading line; each year lights as the line passes it. */
  var ys = $("#ys");
  if (ys) {
    var items = $$(".ys-list li", ys);
    if (U.reduced) {
      ys.style.setProperty("--tl", 1);
      items.forEach(function (li) { li.classList.add("lit"); });
    } else {
      U.onScroll.push(function (y, vh) {
        var r = ys.getBoundingClientRect();
        if (r.bottom < -vh || r.top > vh * 2) return;
        var p = clamp((vh * 0.75 - r.top) / (r.height * 0.9), 0, 1);
        ys.style.setProperty("--tl", p.toFixed(3));
        items.forEach(function (li) { li.classList.toggle("lit", +li.style.getPropertyValue("--y") / 10 <= p + 0.001); });
      });
      U.refresh();
    }
  }

  /* A-07 · Offices: pointing at an office lights its point on the survey, and the reverse. */
  var sv = $(".sv-svg");
  if (sv) {
    var pts = $$(".sv-pt", sv);
    $$(".office[data-o]").forEach(function (o) {
      var pt = pts.filter(function (p) { return p.dataset.o === o.dataset.o; })[0];
      if (!pt) return;
      o.addEventListener("pointerenter", function () { pt.classList.add("on"); });
      o.addEventListener("pointerleave", function () { pt.classList.remove("on"); });
      o.addEventListener("focusin", function () { pt.classList.add("on"); });
      o.addEventListener("focusout", function () { pt.classList.remove("on"); });
    });
  }

  /* Y-01 / Y-02 · The index marks the clause being read; the scale bar under it measures how far. */
  var toc = $(".ltoc");
  if (toc) {
    var links = $$("a", toc), doc = $(".doc"), bar = $(".ltoc-bar", toc);
    var secs = links.map(function (a) { return document.querySelector(a.getAttribute("href")); });
    U.onScroll.push(function (y, vh) {
      var cur = 0;
      secs.forEach(function (s, i) { if (s && s.getBoundingClientRect().top < vh * 0.4) cur = i; });
      links.forEach(function (a, i) { a.classList.toggle("on", i === cur); });
      var r = doc.getBoundingClientRect();
      bar.style.setProperty("--rp", clamp((vh * 0.5 - r.top) / r.height, 0, 1).toFixed(3));
    });
    U.refresh();
  }
})();
