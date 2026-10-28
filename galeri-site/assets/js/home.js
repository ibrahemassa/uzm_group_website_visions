/* Galeri · home: the passe-partout that opens to full bleed, the film, the catalogue, the night aerial, the contents spread. */
(function () {
  var U = window.UZM, $ = U.$, $$ = U.$$, clamp = U.clamp, lerp = U.lerp, A = U.assets;
  var still = U.reduced;
  var fmt2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* ── Hero: the frame opens over the first screen of scrolling; the statement arrives once it is full-bleed ── */
  var stage = $("#heroStage"), copy = $("#heroCopy"), statement = $("#heroStatement"), cap = $(".hero-cap");
  var statementBtn = $("[data-film-open]", statement);
  var geo = { T: 86, X: 64, B: 300, vh: innerHeight };
  U.onLayout.push(function () {
    var vw = innerWidth, vh = innerHeight, mobile = vw < 720;
    geo = { T: $("#hdr").offsetHeight + (mobile ? 6 : 14), X: mobile ? 14 : Math.max(20, Math.min(64, vw * 0.042)), B: copy.offsetHeight + (mobile ? 2 : 8), vh: vh };
  });
  U.onScroll.push(function (y, vh) {
    if (y > vh * 2.2) return;
    if (still) {
      stage.style.setProperty("--ct", geo.T + "px"); stage.style.setProperty("--cx", geo.X + "px"); stage.style.setProperty("--cb", geo.B + "px");
      return;
    }
    var p = clamp(y / (vh * 0.85), 0, 1);
    var e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    stage.style.setProperty("--ct", lerp(geo.T, 0, e).toFixed(1) + "px");
    stage.style.setProperty("--cx", lerp(geo.X, 0, e).toFixed(1) + "px");
    stage.style.setProperty("--cb", lerp(geo.B, 0, e).toFixed(1) + "px");
    stage.style.setProperty("--zs", (1.06 - 0.06 * e).toFixed(4));
    stage.style.setProperty("--shade", e.toFixed(3));
    copy.style.setProperty("--co", (1 - clamp(p * 2.2, 0, 1)).toFixed(3));
    copy.style.setProperty("--cy", (-p * 60).toFixed(1) + "px");
    copy.style.visibility = p > 0.5 ? "hidden" : "";
    var s = clamp((y - vh * 0.75) / (vh * 0.3), 0, 1);
    statement.style.setProperty("--so", s.toFixed(3));
    statement.style.setProperty("--sy", ((1 - s) * 24).toFixed(1) + "px");
    var live = s > 0.6;
    statement.classList.toggle("live", live);
    statementBtn.tabIndex = live ? 0 : -1;
    statement.setAttribute("aria-hidden", live ? "false" : "true");
    cap.style.opacity = (1 - clamp(p * 3, 0, 1)).toFixed(3);
  });
  if (still) statement.hidden = true;

  /* ── The film, whole, with sound and controls ── */
  var dlg = $("#film"), fv = $("video", dlg);
  $$("[data-film-open]").forEach(function (b) {
    b.addEventListener("click", function () {
      if (!fv.getAttribute("src")) fv.src = A + "video/levan-film-1920.mp4";
      U.open(dlg, b);
      try { fv.currentTime = 0; } catch (e) {}
      var p = fv.play(); if (p && p.catch) p.catch(function () {});
    });
  });
  dlg.addEventListener("close", function () { fv.pause(); });

  /* ── 03 · the catalogue ── */
  var TYPES = [
    { name: "2+1 Daire", net: [64.83, 70.17], gross: [73.83, 81.13], plan: "levan--plan--2-1-a", planCap: "2+1 A planı · üç varyant", photo: "levan--ic--2-1-salon", photoAlt: "2+1 dairede salon", blurb: "Yeni başlangıçlar için: ferah, kullanışlı ve bahçe yaşamına açık." },
    { name: "3+1 Daire", net: [113.07, 123.43], gross: [127.93, 141.21], plan: "levan--plan--3-1-a", planCap: "3+1 A planı · üç varyant", photo: "levan--ic--3-1-salon", photoAlt: "3+1 dairede salon", blurb: "Aile yaşamına göre kurgulanmış geniş salonlar ve ebeveyn banyosu." },
    { name: "4+1 Daire", net: [155.71], gross: [178.13], plan: "levan--plan--4-1", planCap: "4+1 daire planı", photo: "levan--avlu-aksam", photoAlt: "Gün batımında bloklar arası avlu", blurb: "Kalabalık aileler için cömert metrekare, gün ışığı ve geniş balkonlar." },
    { name: "4+1 İkiz Villa", net: [271.02], gross: [310.12], garden: 85.74, plan: "levan--plan--ikiz-zemin", planCap: "İkiz villa · zemin kat planı", photo: "levan--ikiz-villa-gece", photoAlt: "Gece aydınlatmasıyla ikiz villalar", blurb: "Bodrum, zemin ve birinci kattan oluşan yaşam; özel bahçe." },
    { name: "5+1 Müstakil Villa", net: [329.89], gross: [378.1], plan: "levan--plan--mustakil-zemin", planCap: "Müstakil villa · zemin kat planı", photo: "levan--villa-gece", photoAlt: "Gece bir müstakil villa", blurb: "Kendi bahçesi ve kendi kapısıyla; gökyüzüyle arada engel yok." },
    { name: "6+1 Malikane", net: [268.35], gross: [301.8], garden: 1159.09, plan: "levan--plan--malikane", planCap: "Malikane planı", photo: "levan--gece-vaziyet", photoAlt: "Levan Bahçeşehir gece havadan", blurb: "Levan'ın zirvesi: geniş tahsisli bahçesiyle." }
  ];
  var index = $("#index"), frame = $("#frame"), tabs = $$("button", index), sheet = $("#sheet");
  var first = $("img.plan", frame);
  first.dataset.i = 0;
  TYPES.forEach(function (t, i) {
    if (i > 0) {
      var p = document.createElement("img");
      p.className = "plan"; p.src = A + "img/" + t.plan + ".webp"; p.alt = t.name + ": " + t.planCap; p.loading = "lazy"; p.decoding = "async"; p.dataset.i = i;
      frame.insertBefore(p, $(".stamp", frame));
    }
    var f = document.createElement("img");
    f.className = "photo"; f.src = A + "img/" + t.photo + ".webp"; f.alt = t.photoAlt + " (görselleştirme)"; f.loading = "lazy"; f.decoding = "async"; f.dataset.i = i;
    frame.insertBefore(f, $(".stamp", frame));
  });
  var cur = 0, view = "plan";
  var els = { net: $("#fNet"), gross: $("#fGross"), garden: $("#fGarden") };
  var shown = { net: TYPES[0].net, gross: TYPES[0].gross, garden: null };
  var setFig = function (key, vals) {
    var el = els[key];
    if (!vals) { el.innerHTML = "—"; shown[key] = null; return; }
    var from = shown[key] && shown[key].length === vals.length ? shown[key] : vals.map(function () { return 0; });
    shown[key] = vals;
    var paint = function (k) { el.innerHTML = vals.map(function (v, j) { return fmt2.format(lerp(from[j], v, k)); }).join("–") + "<small>m²</small>"; };
    if (still) return paint(1);
    var t0 = performance.now();
    (function tick(t) { var k = clamp((t - t0) / 700, 0, 1); paint(1 - Math.pow(1 - k, 3)); if (k < 1) requestAnimationFrame(tick); })(t0);
  };
  var paintFrame = function () {
    $$("img", frame).forEach(function (img) { img.classList.toggle("on", +img.dataset.i === cur && img.classList.contains(view)); });
    var t = TYPES[cur];
    $(".sc-t", sheet).textContent = view === "plan" ? t.planCap : t.name + " · Görselleştirme";
    $("#stamp").textContent = view === "plan" ? "Kat planı · levan.com.tr" : "Görselleştirme";
  };
  var select = function (i) {
    if (i === cur) return;
    cur = i;
    tabs.forEach(function (b, j) { b.setAttribute("aria-selected", j === i); b.tabIndex = j === i ? 0 : -1; });
    var t = TYPES[i];
    setFig("net", t.net); setFig("gross", t.gross); setFig("garden", t.garden ? [t.garden] : null);
    $("#blurb").textContent = t.blurb;
    sheet.setAttribute("aria-labelledby", "tab" + i);
    paintFrame();
  };
  tabs.forEach(function (b, i) {
    b.addEventListener("click", function () { select(i); });
    b.addEventListener("keydown", function (e) {
      var k = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (e.key === "Home" || e.key === "End") k = 0;
      if (k === undefined) return;
      e.preventDefault();
      var j = e.key === "Home" ? 0 : e.key === "End" ? TYPES.length - 1 : (cur + k + TYPES.length) % TYPES.length;
      select(j); tabs[j].focus();
      if (innerWidth < 900) tabs[j].scrollIntoView({ inline: "nearest", block: "nearest" });
    });
  });
  $$(".seg button", sheet).forEach(function (b) {
    b.addEventListener("click", function () {
      view = b.dataset.view;
      $$(".seg button", sheet).forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
      paintFrame();
    });
  });

  /* ── 05 · the night aerial settles as the chapter passes ── */
  var par = $("[data-par]");
  if (par) U.onScroll.push(function (y, vh) {
    var r = par.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh) return;
    par.style.setProperty("--p", still ? 1 : clamp((vh - r.top) / (vh + r.height), 0, 1).toFixed(4));
  });

  /* ── The contents spread: each chapter shows its frontispiece ── */
  var bf = $(".book-front"), bfImg = bf && $("img", bf), bfFig = bf && $(".fig", bf), bfT = bf && $(".bf-t", bf), bfTimer = 0;
  $$(".book-toc a").forEach(function (a) {
    var show = function () {
      if (!a.dataset.front || bfImg.getAttribute("src") === a.dataset.front) return;
      clearTimeout(bfTimer);
      bf.classList.add("swap");
      bfTimer = setTimeout(function () {
        bfImg.src = a.dataset.front;
        bfFig.textContent = a.querySelector(".toc-n").textContent === "Giriş" ? "Giriş" : "Bölüm " + a.querySelector(".toc-n").textContent;
        bfT.textContent = a.querySelector(".toc-t").textContent + " · " + a.querySelector(".toc-p").textContent;
        var done = function () { bf.classList.remove("swap"); };
        if (bfImg.complete) requestAnimationFrame(done); else bfImg.onload = done;
      }, still ? 0 : 200);
    };
    a.addEventListener("pointerenter", show);
    a.addEventListener("focus", show);
  });

  U.layout();
})();
