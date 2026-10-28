/* Net · Levan Bahçeşehir page. Three small things on top of site.js: the "on this page" bar (marks where you are,
   lands sections below itself), one tab per home type (without this script every type simply shows, one under the
   other), and the 360° tours, which load from Kuula only once a visitor starts one. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var lang = (document.documentElement.lang || "tr").slice(0, 2);
  var tr = function (a, b) { return lang === "tr" ? a : b; };
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── Hero film: it starts at the frame the poster shows (#t= on the file); reveal it only once it is there ── */
  var hv = $(".lh-media video");
  if (hv) {
    var from = parseFloat((hv.dataset.large.split("#t=")[1]) || "0") - 0.5;
    var reveal = function () {
      if (hv.currentTime < from) return;
      hv.parentNode.classList.add("vid-on");
      hv.removeEventListener("timeupdate", reveal);
    };
    hv.addEventListener("timeupdate", reveal);
  }

  /* ── Home types: tabs ── */
  var list = $(".tt-list");
  var tabs = list ? $$('[role="tab"]', list) : [];
  var panels = tabs.map(function (b) { return document.getElementById(b.getAttribute("aria-controls")); });
  var select = function (i, focus) {
    tabs.forEach(function (b, j) {
      var on = i === j;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
      panels[j].hidden = !on;
    });
    if (focus) tabs[i].focus();
  };
  var panelIndex = function (id) {
    for (var i = 0; i < panels.length; i++) if (panels[i] && panels[i].id === id) return i;
    return -1;
  };
  if (tabs.length) {
    list.hidden = false;
    var start = panelIndex(location.hash.slice(1));
    select(start < 0 ? 0 : start);
    tabs.forEach(function (b, i) {
      b.addEventListener("click", function () { select(i); });
      b.addEventListener("keydown", function (e) {
        var n = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : null;
        if (n === null) return;
        e.preventDefault();
        select((n + tabs.length) % tabs.length, true);
      });
    });
  }

  /* ── In-page links: land below the header and this page's bar (also when smooth scrolling is on) ── */
  var hdr = $(".hdr"), bar = $(".lnav");
  var offset = function () { return (hdr ? hdr.offsetHeight : 72) + (bar ? bar.offsetHeight : 0) + 12; };
  var go = function (el, hash) {
    var lenis = window.NET && window.NET.lenis;
    if (lenis) lenis.scrollTo(el, { offset: -offset() });
    else {
      var y = el.getBoundingClientRect().top + scrollY - offset();
      scrollTo({ top: y, behavior: reduced ? "auto" : "smooth" });
    }
    history.replaceState(null, "", hash);
  };
  var main = $("main");
  if (main) main.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || a.hasAttribute("data-lb") || a.hasAttribute("data-plan")) return;
    var hash = a.getAttribute("href");
    var el = hash.length > 1 && document.getElementById(decodeURIComponent(hash.slice(1)));
    if (!el) return;
    e.preventDefault();
    var i = panelIndex(el.id);
    if (i >= 0 && tabs.length) {
      select(i);
      el = $(".tt-list") || el; // show the tabs above the chosen type
    }
    go(el, hash);
    // move focus with the view, so keyboard users continue from there
    var target = i >= 0 && tabs.length ? tabs[i] : el;
    if (target !== tabs[i] && !target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  });
  // arriving with #tip-… in the address: the tab is chosen above; put it under the bar
  if (panelIndex(location.hash.slice(1)) >= 0) addEventListener("load", function () { setTimeout(function () { go(list, location.hash); }, 60); });

  /* ── The bar marks the section you are in, and keeps that link in view on narrow screens ── */
  if (bar) {
    var links = $$('a[href^="#"]', bar);
    var secs = links.map(function (a) { return document.getElementById(a.hash.slice(1)); });
    var strip = $(".lnav-list", bar), last = -2, ticking = false;
    var mark = function () {
      ticking = false;
      var line = offset() + innerHeight * 0.18, cur = -1;
      secs.forEach(function (s, i) { if (s && s.getBoundingClientRect().top <= line) cur = i; });
      if (cur === last) return;
      last = cur;
      links.forEach(function (a, i) { if (i === cur) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current"); });
      if (cur >= 0 && strip.scrollWidth > strip.clientWidth) {
        var a = links[cur];
        var left = a.offsetLeft - (strip.clientWidth - a.offsetWidth) / 2;
        strip.scrollTo({ left: Math.max(0, left), behavior: reduced ? "auto" : "smooth" });
      }
    };
    addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(mark); } }, { passive: true });
    addEventListener("resize", function () { last = -2; mark(); });
    mark();
  }

  /* ── 360° tours: the dates are links to Kuula; here they load the chosen tour into the stage instead ── */
  var tour = $(".tour");
  if (tour) {
    var stage = $(".tour-stage", tour), startBtn = $(".tour-start", tour), dates = $$("[data-tour]", tour);
    var tab = $(".tour-tab a", tour), when = $(".tour-when time", tour), at = 0, frame = null;
    var label = function (i) { return dates[i].querySelector("time").textContent; };
    var load = function () {
      if (!frame) {
        frame = document.createElement("iframe");
        frame.setAttribute("allow", "fullscreen; xr-spatial-tracking; gyroscope; accelerometer");
        frame.setAttribute("allowfullscreen", "");
        stage.appendChild(frame);
        stage.classList.add("tour-on");
      }
      frame.title = tr("Levan Bahçeşehir şantiyesinin " + label(at) + " tarihli 360° turu", "360° tour of the Levan Bahçeşehir site, " + label(at));
      frame.src = dates[at].href;
    };
    var pick = function (i) {
      at = i;
      dates.forEach(function (a, j) { a.setAttribute("aria-current", String(i === j)); });
      if (tab) tab.href = dates[i].href;
      if (when) { when.textContent = label(i); when.setAttribute("datetime", dates[i].querySelector("time").getAttribute("datetime")); }
    };
    dates.forEach(function (a, i) {
      // in this page they play here, so they no longer open a new tab
      a.removeAttribute("target");
      var nt = $(".nt", a);
      if (nt) nt.remove();
      a.addEventListener("click", function (e) { e.preventDefault(); pick(i); load(); });
    });
    if (startBtn) { startBtn.hidden = false; startBtn.addEventListener("click", load); }
  }
})();
