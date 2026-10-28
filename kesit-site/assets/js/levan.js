/* A-01 · Levan Bahçeşehir: detail rail, section plane B–B, day/night scan, six standards, site plan, drafting table,
   construction time scale and 360° tours. */
(function () {
  var U = window.UZM, $ = U.$, $$ = U.$$, clamp = U.clamp, reduced = U.reduced;
  var A = U.assets;

  /* ── Detail rail: shown between the hero and the footer; the detail whose top has passed 40% of the screen is lit. ── */
  var rail = $(".dl-rail"), railLinks = $$("a", rail);
  var details = railLinks.map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); });
  var hero = $(".ph"), foot = $(".foot"), lastD = -1;
  U.onScroll.push(function (y, vh) {
    rail.classList.toggle("on", hero.getBoundingClientRect().bottom < vh * 0.3 && foot.getBoundingClientRect().top > vh * 0.6);
    var cur = -1;
    details.forEach(function (s, i) { if (s.getBoundingClientRect().top < vh * 0.4) cur = i; });
    if (cur !== lastD) {
      railLinks.forEach(function (a, i) { if (i === cur) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current"); });
      lastD = cur;
    }
  });

  /* ── Day and night: the divider is a scanner with a band of line drawing; pointer, touch and arrow keys move it. ── */
  (function () {
    var aerial = $(".aerial"), knob = $(".aerial-knob", aerial);
    var target = 50, cur = 50, ease = 0.2, raf = 0, touched = false, dragging = false;
    var write = function (x) {
      aerial.style.setProperty("--x", x.toFixed(2));
      knob.setAttribute("aria-valuenow", Math.round(x));
      knob.setAttribute("aria-valuetext", "Yüzde " + Math.round(x) + " gündüz");
    };
    var run = function () {
      cancelAnimationFrame(raf);
      (function step() {
        var d = target - cur;
        cur = Math.abs(d) < 0.05 ? target : cur + d * ease;
        write(cur);
        if (cur !== target) raf = requestAnimationFrame(step);
      })();
    };
    var go = function (x, k) { target = clamp(x, 0, 100); ease = reduced ? 1 : k || 0.2; run(); };
    var fromPointer = function (e) { var r = aerial.getBoundingClientRect(); return (e.clientX - r.left) / r.width * 100; };
    aerial.addEventListener("pointerdown", function (e) { touched = true; dragging = true; aerial.setPointerCapture(e.pointerId); go(fromPointer(e), 0.35); });
    aerial.addEventListener("pointermove", function (e) {
      if (!dragging && e.pointerType !== "mouse") return;
      touched = true;
      go(fromPointer(e), dragging ? 0.35 : 0.14);
    });
    var up = function () { dragging = false; };
    aerial.addEventListener("pointerup", up);
    aerial.addEventListener("pointercancel", up);
    knob.addEventListener("keydown", function (e) {
      var k = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5, PageDown: -20, PageUp: 20 }[e.key];
      if (k === undefined && e.key !== "Home" && e.key !== "End") return;
      e.preventDefault();
      touched = true;
      go(e.key === "Home" ? 0 : e.key === "End" ? 100 : target + k, 0.3);
    });
    if (!reduced) {
      var aio = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return;
        aio.disconnect();
        [[0, 82], [1300, 18], [2700, 50]].forEach(function (s) { setTimeout(function () { if (!touched) go(s[1], 0.04); }, s[0]); });
      }, { threshold: 0.6 });
      aio.observe(aerial);
    }
  })();

  /* ── Six standards: the item nearest the middle is lit; its picture is plotted into the frame. ── */
  (function () {
    var items = $$(".why-item"), pics = $$(".why-plot img"), plot = $(".why-plot"), n = $(".why-n"), cap = $(".why-cap");
    var cur = 0;
    var set = function (i) {
      if (i === cur) return;
      pics.forEach(function (p, k) { p.classList.toggle("was", k === cur); p.classList.toggle("on", k === i); p.classList.remove("go"); });
      items.forEach(function (it, k) { it.classList.toggle("on", k === i); });
      if (!reduced) { void plot.offsetWidth; pics[i].classList.add("go"); plot.classList.remove("go"); void plot.offsetWidth; plot.classList.add("go"); }
      n.textContent = "D-0" + (i + 1);
      cap.textContent = items[i].dataset.cap;
      cur = i;
    };
    var wide = matchMedia("(min-width: 64rem)");
    U.onScroll.push(function (y, vh) {
      if (!wide.matches) return;
      var best = 0, bestD = Infinity;
      items.forEach(function (it, k) {
        var r = it.getBoundingClientRect(), d = Math.abs(r.top + r.height / 2 - vh / 2);
        if (d < bestD) { bestD = d; best = k; }
      });
      set(best);
    });
  })();

  /* ── Site plan: photo or line drawing; a zone picked by pin, button or hover is hatched. ── */
  (function () {
    var vz = $(".vz"), map = $(".vz-map"), zs = $$(".vz-z"), pins = $$(".vz-pin"), zones = $$(".zone");
    var btns = zones.map(function (z) { return $("h3 button", z); });
    var pick = function (i) {
      map.classList.toggle("lit", i !== null);
      vz.classList.toggle("picked", i !== null);
      zs.forEach(function (z, k) { z.classList.toggle("on", k === i); });
      pins.forEach(function (p, k) { p.setAttribute("aria-pressed", String(k === i)); });
      btns.forEach(function (b, k) { b.setAttribute("aria-pressed", String(k === i)); });
      zones.forEach(function (z, k) { z.classList.toggle("on", k === i); });
    };
    var at = null;
    var toggle = function (i) { at = at === i ? null : i; pick(at); };
    pins.forEach(function (p, i) { p.addEventListener("click", function () { toggle(i); }); });
    btns.forEach(function (b, i) { b.addEventListener("click", function () { toggle(i); }); });
    zones.forEach(function (z, i) {
      z.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") pick(i); });
      z.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") pick(at); });
    });
    $$("[data-vz]").forEach(function (b) {
      b.addEventListener("click", function () {
        $$("[data-vz]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        map.dataset.mode = b.dataset.vz;
      });
    });
    new IntersectionObserver(function (es, o) { if (es[0].isIntersecting) { $(".vz-fig").classList.add("in"); o.disconnect(); } }, { threshold: 0.3 }).observe(map);
  })();

  /* ── Drafting table: six types, their plans or floors, plan or line view, a loupe, full size in the lightbox. ── */
  (function () {
    var sheet = function (key, w, h, label) { return { src: A + "img/levan--plan--" + key + ".webp", w: w, h: h, label: label }; };
    var floors = function (b) { return [sheet(b + "-zemin", 1600, 960, "Zemin kat"), sheet(b + "-1-kat", 1600, 960, "1. kat"), sheet(b + "-bodrum", 1600, 960, "Bodrum")]; };
    var T = [
      { n: "2+1 Daire", pic: ["levan--ic--2-1-salon", "2+1 dairede salon"], blurb: "Yeni başlangıçlar için: ferah, kullanışlı ve bahçe yaşamına açık.", s: [sheet("2-1-a", 1600, 918, "2+1 A"), sheet("2-1-b", 1600, 918, "2+1 B"), sheet("2-1-c", 1600, 918, "2+1 C")], a: [[64.83, 73.83], [69.2, 78.86], [70.17, 81.13]] },
      { n: "3+1 Daire", pic: ["levan--ic--3-1-salon", "3+1 dairede salon"], blurb: "Aile yaşamına göre kurgulanmış geniş salonlar ve ebeveyn banyosu.", s: [sheet("3-1-a", 1600, 918, "3+1 A"), sheet("3-1-b", 1600, 918, "3+1 B"), sheet("3-1-c", 1600, 918, "3+1 C")], a: [[118.41, 135.95], [123.43, 141.21], [113.07, 127.93]] },
      { n: "4+1 Daire", pic: ["levan--avlu-aksam", "Gün batımında bloklar arası avlu"], blurb: "Kalabalık aileler için cömert metrekare, gün ışığı ve geniş balkonlar.", s: [sheet("4-1", 1600, 918, "4+1")], a: [[155.71, 178.13]] },
      { n: "4+1 İkiz Villa", pic: ["levan--ikiz-villa-gece", "Gece aydınlatmasıyla ikiz villalar"], blurb: "Bodrum, zemin ve birinci kattan oluşan yaşam; özel bahçe.", s: floors("ikiz"), a: [[271.02, 310.12]], garden: 85.74, total: true },
      { n: "5+1 Müstakil Villa", pic: ["levan--villa-gece", "Gece bir müstakil villa"], blurb: "Kendi bahçesi ve kendi kapısıyla; gökyüzüyle arada engel yok.", s: floors("mustakil"), a: [[329.89, 378.1]], total: true },
      { n: "6+1 Malikane", pic: ["levan--gece-vaziyet", "Levan Bahçeşehir gece havadan"], blurb: "Levan'ın zirvesi: geniş tahsisli bahçesiyle.", s: [sheet("malikane", 1600, 1194, "6+1")], a: [[268.35, 301.8]], garden: 1159.09 }
    ];
    var f2 = function (v) { return U.fmt2.format(v) + " m²"; };
    var tabs = $$(".dt-types [role=tab]"), panel = $("#dt-sheet"), stage = $("#dtStage"), img = $("#dtImg"), floorsBox = $("#dtFloors");
    var full = $("#dtFull"), pic = $("#dtPic");
    var ti = 0, si = 0, mode = "photo";
    var loupe = U.loupe(stage, img, { zoom: 2.6 });
    var cache = {};
    var pre = function (src) { return cache[src] || (cache[src] = new Promise(function (res) { var im = new Image(); im.onload = im.onerror = function () { res(); }; im.src = src; })); };
    var token = 0;
    var render = function (animate) {
      var t = T[ti], s = t.s[si], a = t.a[t.total ? 0 : si] || t.a[0];
      var my = ++token;
      $$("button", floorsBox).forEach(function (b, k) { b.setAttribute("aria-pressed", String(k === si)); });
      $("#dtK").textContent = "K-0" + (ti + 1);
      $("#dtS").textContent = t.n + " · " + s.label;
      $("#tbN").textContent = t.n;
      $("#tbP").textContent = s.label;
      $("#tbNetK").textContent = t.total ? "Net · 3 kat toplamı" : "Net alan";
      $("#tbGrK").textContent = t.total ? "Brüt · 3 kat toplamı" : "Brüt alan";
      $("#tbNet").textContent = f2(a[0]);
      $("#tbGr").textContent = f2(a[1]);
      $("#tbGd").textContent = t.garden ? f2(t.garden) : "—";
      $("#dtBlurb").textContent = t.blurb;
      full.href = s.src;
      full.dataset.cap = t.n + " · " + s.label + " planı";
      pre(s.src).then(function () {
        if (my !== token) return;
        img.src = s.src; img.width = s.w; img.height = s.h;
        img.alt = t.n + ", " + s.label + (t.total ? " planı" : " kat planı");
        loupe.refresh();
        if (animate && !reduced) { stage.classList.remove("go"); void stage.offsetWidth; stage.classList.add("go"); }
      });
    };
    var setType = function (i, focus) {
      ti = i; si = 0;
      var t = T[i];
      tabs.forEach(function (b, k) { b.setAttribute("aria-selected", String(k === i)); b.tabIndex = k === i ? 0 : -1; });
      panel.setAttribute("aria-labelledby", tabs[i].id);
      if (focus) tabs[i].focus();
      floorsBox.innerHTML = "";
      floorsBox.setAttribute("aria-label", t.total ? "Katlar" : "Planlar");
      t.s.forEach(function (s, k) {
        var b = document.createElement("button");
        b.type = "button"; b.textContent = s.label; b.setAttribute("aria-pressed", String(k === 0));
        b.addEventListener("click", function () { si = k; render(true); });
        floorsBox.appendChild(b);
      });
      floorsBox.hidden = t.s.length < 2;
      pic.src = A + "img/" + t.pic[0] + ".webp"; pic.alt = t.pic[1];
      render(true);
      if (matchMedia("(max-width: 63.99rem)").matches) tabs[i].scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduced ? "auto" : "smooth" });
    };
    tabs.forEach(function (b, k) { b.addEventListener("click", function () { if (k !== ti) setType(k); }); });
    $(".dt-types").addEventListener("keydown", function (e) {
      var d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (d) { e.preventDefault(); setType((ti + d + T.length) % T.length, true); }
      if (e.key === "Home") { e.preventDefault(); setType(0, true); }
      if (e.key === "End") { e.preventDefault(); setType(T.length - 1, true); }
    });
    $$("[data-pm]").forEach(function (b) {
      b.addEventListener("click", function () {
        mode = b.dataset.pm;
        $$("[data-pm]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        img.classList.toggle("ink", mode === "ink");
        stage.classList.toggle("ink", mode === "ink");
        loupe.refresh();
      });
    });
    var lp = $("#dtLoupe");
    lp.addEventListener("click", function () {
      var on = lp.getAttribute("aria-pressed") !== "true";
      lp.setAttribute("aria-pressed", String(on));
      loupe.enable(on);
    });
    full.addEventListener("click", function (e) {
      e.preventDefault();
      var t = T[ti];
      var links = t.s.map(function (s) { var a = document.createElement("a"); a.href = s.src; a.setAttribute("href", s.src); a.dataset.cap = t.n + " · " + s.label + " planı"; a.dataset.n = "K-0" + (ti + 1); return a; });
      U.lightbox(links, si, full);
    });
    /* A link from another sheet (#k-04) opens that type. */
    var fromHash = function () { var m = /^#k-0([1-6])$/.exec(location.hash); if (m) setType(+m[1] - 1); };
    addEventListener("hashchange", fromHash);
    setType(0);
    fromHash();
  })();

  /* ── Construction: one time scale for the 360° tours and the diary; Kuula loads only after "start". ── */
  (function () {
    var stage = $(".tour-stage"), tourBtns = $$(".tl-tours button"), when = $(".tour-when time"), tab = $(".tour-tab"), n = $(".tour-n");
    var url = function (id) { return "https://kuula.co/share/collection/" + id + "?logo=1&info=0&fs=1&vr=0&initload=1&autorotate=0.1&thumbs=1"; };
    var MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    var long = function (iso) { var p = iso.split("-"); return +p[2] + " " + MONTHS[+p[1] - 1] + " " + p[0]; };
    var at = tourBtns.length - 1;
    var load = function () {
      var b = tourBtns[at], f = $("iframe", stage);
      if (!f) {
        f = document.createElement("iframe");
        f.setAttribute("allow", "fullscreen; xr-spatial-tracking; gyroscope; accelerometer");
        f.allowFullscreen = true;
        stage.appendChild(f);
      }
      f.title = "Levan Bahçeşehir şantiyesinin " + long(b.dataset.date) + " tarihli 360° turu";
      f.src = url(b.dataset.tour);
      stage.classList.add("live");
    };
    $(".tour-start").addEventListener("click", load);
    tourBtns.forEach(function (b, i) {
      b.addEventListener("click", function () {
        at = i;
        tourBtns.forEach(function (o, k) { o.setAttribute("aria-pressed", String(k === i)); });
        when.textContent = long(b.dataset.date); when.setAttribute("datetime", b.dataset.date);
        n.textContent = "0" + (i + 1) + " / 0" + tourBtns.length;
        tab.href = url(b.dataset.tour);
        if (stage.classList.contains("live")) load();
      });
    });

    var entries = $$(".entry"), dBtns = $$(".tl-diary button"), dn = $(".diary-n");
    var di = 5;
    var showEntry = function (i) {
      di = (i + 6) % 6;
      entries.forEach(function (e) { e.classList.toggle("on", +e.dataset.entry === di); });
      dBtns.forEach(function (b) { b.setAttribute("aria-pressed", String(+b.dataset.entry === di)); });
      dn.textContent = "Kayıt 0" + (di + 1) + " / 06";
    };
    dBtns.forEach(function (b) { b.addEventListener("click", function () { showEntry(+b.dataset.entry); }); });
    $(".diary-prev").addEventListener("click", function () { showEntry(di - 1); });
    $(".diary-next").addEventListener("click", function () { showEntry(di + 1); });
    showEntry(5);
  })();

  U.refresh();
})();
