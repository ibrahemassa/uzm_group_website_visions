/* Maket · shared behaviour: header, menu, reveals, dialogs (visit, plan sheets, lightbox), demo forms.
   window.UZM exposes openPlan({ title, sheets: [{ src, w, h, label }], start }, opener) and the asset paths. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var body = document.body, doc = document.documentElement;
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var U = (window.UZM = window.UZM || {});
  U.root = body.dataset.root || "";
  U.assets = body.dataset.assets || "../assets/";
  U.reduced = reduced;

  /* ── Header: solid once the page moves; slips away while reading down, back on the way up ── */
  var hdr = $("#hdr"), pres = $(".pres"), lastY = scrollY, ticking = false;
  var onScroll = function () {
    ticking = false;
    var y = scrollY, down = y > lastY + 4, up = y < lastY - 4;
    if (hdr) {
      hdr.classList.toggle("solid", y > 24);
      if (down && y > 300) hdr.classList.add("away");
      else if (up || y < 300) hdr.classList.remove("away");
    }
    if (pres) {
      if (down && y > 300) pres.classList.add("hide");
      else if (up) pres.classList.remove("hide");
    }
    lastY = y;
  };
  addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  /* ── Menu: a dialog over the page; the page behind goes inert ── */
  var menu = $("#menu"), menuBtn = $(".hdr-menu"), lastFocus = null;
  var setMenu = function (open) {
    if (!menu) return;
    if (open) {
      lastFocus = document.activeElement;
      menu.hidden = false;
      requestAnimationFrame(function () { menu.classList.add("open"); });
      $$("body > :not(#menu):not(script):not(svg)").forEach(function (el) { el.inert = true; });
      menuBtn.setAttribute("aria-expanded", "true");
      ($(".menu-list a", menu) || menu).focus();
    } else {
      menu.classList.remove("open");
      $$("body > *").forEach(function (el) { el.inert = false; });
      menuBtn.setAttribute("aria-expanded", "false");
      setTimeout(function () { menu.hidden = true; }, reduced ? 0 : 350);
      if (lastFocus) lastFocus.focus();
    }
  };
  if (menuBtn) menuBtn.addEventListener("click", function () { setMenu(menu.hidden); });
  if (menu) {
    $(".menu-close", menu).addEventListener("click", function () { setMenu(false); });
    menu.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setMenu(false);
      if (e.key === "Tab") {
        var f = $$("a, button", menu), first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    $$("[data-open]", menu).forEach(function (b) { b.addEventListener("click", function () { setMenu(false); }); });
  }

  /* ── Reveals ── */
  var rs = $$("[data-r]");
  if ("IntersectionObserver" in window && !reduced) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    rs.forEach(function (el) { io.observe(el); });
  } else rs.forEach(function (el) { el.classList.add("in"); });

  /* ── Dialogs ── */
  var openDlg = function (d, from) {
    if (!d) return;
    d._from = from || document.activeElement;
    d.showModal();
  };
  $$("dialog.dlg").forEach(function (d) {
    d.addEventListener("click", function (e) { if (e.target === d || e.target.closest("[data-close]")) d.close(); });
    d.addEventListener("close", function () { if (d._from && d._from.focus) d._from.focus(); });
  });
  $$("[data-open]").forEach(function (b) {
    b.addEventListener("click", function () { openDlg($("#" + b.dataset.open), b); });
  });
  U.openDialog = openDlg;

  /* Plan sheets: several sheets get tabs (floors, or a flat type's variants) */
  var plan = $("#plan");
  U.openPlan = function (o, from) {
    if (!plan) return;
    var tabs = $(".plan-tabs", plan), img = $(".plan-sheet img", plan);
    $(".plan-title", plan).textContent = o.title;
    tabs.innerHTML = "";
    var show = function (i) {
      var s = o.sheets[i];
      img.src = s.src; img.width = s.w; img.height = s.h;
      img.alt = o.title + " kat planı, " + s.label;
      $$("button", tabs).forEach(function (b, j) { b.setAttribute("aria-selected", String(i === j)); b.tabIndex = i === j ? 0 : -1; });
    };
    tabs.hidden = o.sheets.length < 2;
    o.sheets.forEach(function (s, i) {
      var b = document.createElement("button");
      b.type = "button"; b.setAttribute("role", "tab"); b.textContent = s.label;
      b.addEventListener("click", function () { show(i); });
      b.addEventListener("keydown", function (e) {
        var k = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!k) return;
        var n = (i + k + o.sheets.length) % o.sheets.length;
        show(n); $$("button", tabs)[n].focus();
      });
      tabs.appendChild(b);
    });
    show(o.start || 0);
    openDlg(plan, from);
  };
  var sheet = function (key, w, h, label) { return { src: U.assets + "img/levan--plan--" + key + ".webp", w: w, h: h, label: label }; };
  var floors = function (base) { return [sheet(base + "-zemin", 1600, 960, "Zemin kat"), sheet(base + "-1-kat", 1600, 960, "1. kat"), sheet(base + "-bodrum", 1600, 960, "Bodrum")]; };
  U.TYPES = [
    { key: "2-1", kind: "daire", title: "2+1 Daire", net: "64,83 – 70,17", gross: "73,83 – 81,13", garden: null, blurb: "Yeni başlangıçlar için: ferah, kullanışlı ve bahçe yaşamına açık.", pic: "levan--ic--2-1-salon", sheets: [sheet("2-1-a", 1600, 918, "2+1 A"), sheet("2-1-b", 1600, 918, "2+1 B"), sheet("2-1-c", 1600, 918, "2+1 C")] },
    { key: "3-1", kind: "daire", title: "3+1 Daire", net: "113,07 – 123,43", gross: "127,93 – 141,21", garden: null, blurb: "Aile yaşamına göre kurgulanmış geniş salonlar ve ebeveyn banyosu.", pic: "levan--ic--3-1-salon", sheets: [sheet("3-1-a", 1600, 918, "3+1 A"), sheet("3-1-b", 1600, 918, "3+1 B"), sheet("3-1-c", 1600, 918, "3+1 C")] },
    { key: "4-1", kind: "daire", title: "4+1 Daire", net: "155,71", gross: "178,13", garden: null, blurb: "Kalabalık aileler için cömert metrekare, gün ışığı ve geniş balkonlar.", pic: "levan--avlu-aksam", sheets: [sheet("4-1", 1600, 918, "4+1")] },
    { key: "ikiz", kind: "ikiz", title: "4+1 İkiz Villa", net: "271,02", gross: "310,12", garden: "85,74", blurb: "Bodrum, zemin ve birinci kattan oluşan yaşam; özel bahçe.", pic: "levan--ikiz-villa", sheets: floors("ikiz") },
    { key: "villa", kind: "villa", title: "5+1 Müstakil Villa", net: "329,89", gross: "378,10", garden: null, blurb: "Kendi bahçesi ve kendi kapısıyla; gökyüzüyle arada engel yok.", pic: "levan--villa", sheets: floors("mustakil") },
    { key: "malikane", kind: "malikane", title: "6+1 Malikane", net: "268,35", gross: "301,80", garden: "1.159,09", blurb: "Levan'ın zirvesi: geniş tahsisli bahçesiyle.", pic: "levan--villa-aksam", sheets: [sheet("malikane", 1600, 1194, "6+1")] },
  ];
  $$("[data-plan-type]").forEach(function (b) {
    b.addEventListener("click", function () {
      var t = U.TYPES.filter(function (x) { return x.key === b.dataset.planType; })[0];
      if (t) U.openPlan({ title: t.title, sheets: t.sheets, start: +(b.dataset.sheet || 0) }, b);
    });
  });

  /* Lightbox: any [data-lb] picture opens; pictures sharing data-lb="group" page through together */
  var lb = $("#lb");
  if (lb) {
    var lbItems = [], lbAt = 0, lbImg = $(".lb-fig img", lb), lbCap = $(".lb-cap", lb), lbCount = $(".lb-count", lb);
    var lbShow = function (i) {
      lbAt = (i + lbItems.length) % lbItems.length;
      var el = lbItems[lbAt], im = el.tagName === "IMG" ? el : $("img", el);
      lbImg.src = el.dataset.full || im.currentSrc || im.src;
      lbImg.alt = im.alt;
      lbCap.textContent = el.dataset.cap || im.alt;
      lbCount.textContent = (lbAt + 1) + " / " + lbItems.length;
      $(".lb-prev", lb).hidden = $(".lb-next", lb).hidden = lbItems.length < 2;
    };
    $$("[data-lb]").forEach(function (el) {
      if (el.tagName !== "BUTTON" && el.tagName !== "A") { el.tabIndex = 0; el.setAttribute("role", "button"); }
      var go = function () {
        lbItems = $$('[data-lb="' + el.dataset.lb + '"]');
        lbShow(lbItems.indexOf(el));
        openDlg(lb, el);
      };
      el.addEventListener("click", go);
      el.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    });
    $(".lb-prev", lb).addEventListener("click", function () { lbShow(lbAt - 1); });
    $(".lb-next", lb).addEventListener("click", function () { lbShow(lbAt + 1); });
    lb.addEventListener("keydown", function (e) { if (e.key === "ArrowLeft") lbShow(lbAt - 1); if (e.key === "ArrowRight") lbShow(lbAt + 1); });
  }

  /* ── Demo forms: check, say what's missing next to the field, never send ── */
  $$("form[data-demo]").forEach(function (f) {
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var bad = null;
      $$(".err", f).forEach(function (x) { x.remove(); });
      $$("[required]", f).forEach(function (inp) {
        var ok = inp.type === "checkbox" ? inp.checked : inp.value.trim().length > (inp.type === "tel" ? 6 : 1);
        inp.setAttribute("aria-invalid", String(!ok));
        if (!ok) {
          var m = document.createElement("p");
          m.className = "err";
          m.id = inp.id ? inp.id + "-err" : "";
          m.textContent = inp.type === "checkbox" ? "Devam etmek için onaylayın." : inp.type === "tel" ? "Telefon numaranızı yazın." : inp.type === "email" ? "E-posta adresinizi yazın." : "Bu alanı doldurun.";
          (inp.closest(".field") || inp.closest(".check")).after(m);
          if (m.id) inp.setAttribute("aria-describedby", m.id);
          bad = bad || inp;
        } else inp.removeAttribute("aria-describedby");
      });
      if (bad) { bad.focus(); return; }
      var sent = $(".form-sent", f);
      if (sent) { sent.hidden = false; sent.focus && sent.setAttribute("tabindex", "-1"); sent.focus(); }
      f.reset();
    });
  });
})();
