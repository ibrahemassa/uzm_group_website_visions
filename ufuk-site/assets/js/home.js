/* Ufuk · home: the statement lights up, the scrubbed film, the film strip of homes, the opening window, the minutes. */
(function () {
  "use strict";
  var U = window.UZM, $ = U.$, $$ = U.$$, clamp = U.clamp, ease = U.ease, reduced = U.reduced;

  /* Sahne 02 · the statement, word by word */
  var words = $("#words"), biz = $(".biz");
  var W = words.textContent.trim().split(/\s+/);
  words.innerHTML = W.map(function (w) { return '<span class="w">' + w + "</span>"; }).join(" ");
  var wordEls = $$(".w", words), lit = -1;

  /* Sahne 03 · the scrubbed film */
  U.scrub($("#levan"));

  /* Sahne 04 · the film strip picks the scene on the stage */
  var stage = $("#typeStage"), panels = $$(".tp", stage), pick = $(".pick"), tabs = $$('[role="tab"]', pick);
  pick.hidden = false;
  var cur = 0;
  var choose = function (i, focus) {
    tabs.forEach(function (t, k) { t.setAttribute("aria-selected", String(k === i)); t.tabIndex = k === i ? 0 : -1; });
    if (i !== cur) {
      panels[cur].classList.remove("on", "cut");
      panels[i].classList.add("on");
      if (!reduced) { void panels[i].offsetWidth; panels[i].classList.add("cut"); }
      cur = i;
    }
    if (focus) tabs[i].focus();
  };
  panels.forEach(function (p, i) { p.setAttribute("role", "tabpanel"); tabs[i].id = "tpt-" + (i + 1); p.setAttribute("aria-labelledby", tabs[i].id + " " + p.getAttribute("aria-labelledby")); });
  tabs.forEach(function (t, i) { t.addEventListener("click", function () { choose(i); }); });
  U.tabKeys($(".pick-in", pick), function (i) { choose(i); });
  choose(0);

  /* Sahne 05 · the window and the marquee */
  var expand = $("#expand");
  var rows = $$(".marq-row").map(function (row) {
    var inner = $(".marq-in", row), dup = inner.cloneNode(true);
    dup.classList.add("dup");
    row.appendChild(dup);
    return { row: row, inner: inner, dir: +(row.dataset.dir || 1), off: 0, w: 0 };
  });
  var measure = function () { rows.forEach(function (r) { r.w = r.inner.getBoundingClientRect().width; }); };
  measure();
  addEventListener("resize", measure);
  if (document.fonts) document.fonts.ready.then(measure);
  var marq = $("#marq"), lastY = scrollY, vel = 0;

  /* Sahne 06 · the minutes */
  var tmap = $("#tmap"), draw = U.timeMap(tmap);

  U.frame.push(function (t, y) {
    var dy = y - lastY; lastY = y; vel = vel * 0.86 + dy * 0.14;
    if (reduced) return;
    if (U.near(biz, 0)) {
      var n = Math.round(clamp(U.prog(biz) * 1.3) * wordEls.length);
      if (n !== lit) { wordEls.forEach(function (w, i) { w.classList.toggle("lit", i < n); }); lit = n; }
    }
    if (U.near(expand, 0)) {
      var p = U.prog(expand);
      expand.style.setProperty("--o", ease(clamp(p / 0.66)).toFixed(4));
      expand.style.setProperty("--t", clamp((p - 0.68) / 0.2).toFixed(4));
    }
    if (U.near(marq, 0)) rows.forEach(function (r) {
      if (!r.w) return;
      r.off = (r.off + (0.45 + Math.min(14, Math.abs(vel)) * 0.35) * r.dir + r.w) % r.w;
      r.row.style.transform = "translate3d(" + (-r.off).toFixed(1) + "px,0,0)";
    });
    if (U.near(tmap, 0)) draw(clamp((U.view(tmap) - 0.18) / 0.45));
  });
  if (reduced) wordEls.forEach(function (w) { w.classList.add("lit"); });
})();
