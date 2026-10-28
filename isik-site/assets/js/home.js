/* Işık · home: the hero plate lifting off the film, glass plates at depth over Levan, the deck of homes fanning
   out, the bento's shared light, a day that passes in one window (and takes the page's hour with it), the diary rail. */
(function () {
  var U = window.UZM, $ = U.$, $$ = U.$$, clamp = U.clamp, lerp = U.lerp, smooth = U.smooth, R = U.reduced;
  var easeOut = function (k) { return 1 - Math.pow(1 - k, 3); };
  var pinned = document.documentElement.classList.contains("js") && !R;

  /* ── Hero: the plate rises and clears as the film scrolls away */
  var heroMedia = $("#heroMedia"), heroPlate = $("#heroPlate");
  U.onFrame.push(function (y, vh, moved) {
    if (!moved || R || y > vh * 1.3) return;
    var p = y / vh;
    heroMedia.style.transform = "translateY(" + (p * 18).toFixed(1) + "%) scale(" + (1 + p * 0.06).toFixed(3) + ")";
    heroPlate.style.transform = "translateY(" + (p * -70).toFixed(1) + "px)";
    heroPlate.style.opacity = String(clamp(1 - p * 1.4));
  });

  /* ── Levan in depth: each plate sits at its own depth and drifts at its own pace */
  var depth = $("#depth"), dPic = $(".depth-pic img", depth), dCards = $$(".dcard", depth), deep = matchMedia("(min-width: 56.01rem)");
  var D = { top: 0, h: 0 };
  U.onMeasure.push(function () { D.top = U.abs(depth); D.h = depth.offsetHeight; });
  U.onFrame.push(function (y, vh, moved) {
    if (!moved || R) return;
    var r = D.top - y; if (r > vh || r + D.h < 0) return;
    var p = (r + D.h / 2 - vh / 2) / vh;
    dPic.style.transform = "translate3d(0," + (p * 40 - 20).toFixed(1) + "px,0)";
    if (!deep.matches) return;
    dCards.forEach(function (c) { var z = parseFloat(c.style.getPropertyValue("--z")); c.style.translate = "0 " + (p * -110 * z).toFixed(1) + "px"; });
  });

  /* ── Konut data (areas as published on levan.com.tr) */
  var HOMES = [
    { name: "2+1 Daire", blurb: "Yeni başlangıçlar için: ferah, kullanışlı ve bahçe yaşamına açık.", net: "64,83–<wbr>70,17", gross: "73,83–<wbr>81,13" },
    { name: "3+1 Daire", blurb: "Aile yaşamına göre kurgulanmış geniş salonlar ve ebeveyn banyosu.", net: "113,07–<wbr>123,43", gross: "127,93–<wbr>141,21" },
    { name: "4+1 Daire", blurb: "Kalabalık aileler için cömert metrekare, gün ışığı ve geniş balkonlar.", net: "155,71", gross: "178,13" },
    { name: "4+1 İkiz Villa", blurb: "Bodrum, zemin ve birinci kattan oluşan yaşam; özel bahçe.", net: "271,02", gross: "310,12", garden: "85,74" },
    { name: "5+1 Müstakil Villa", blurb: "Kendi bahçesi ve kendi kapısıyla; gökyüzüyle arada engel yok.", net: "329,89", gross: "378,10" },
    { name: "6+1 Malikane", blurb: "Levan'ın zirvesi: geniş tahsisli bahçesiyle.", net: "268,35", gross: "301,80", garden: "1.159,09" }
  ];
  var m2 = function (v) { return v + " <small>m²</small>"; };
  var homes = $("#konutlar"), rig = $("#rig"), rigWrap = $("#rigWrap"), cards = $$(".hcard", rig), N = cards.length;
  var hiMain = $("#hiMain"), hiSpecs = $("#hiSpecs"), pagerBtns = $$("#pager button");
  var L = { homesTop: 0, homesH: 0, cw: 0, ch: 0, rigX: 0, rigY: 0, gunTop: 0, gunH: 0 };
  var progress = function (top, h, y) { return clamp((y - top) / Math.max(1, h - U.vh)); };
  var active = -1, tilt = { x: 0, y: 0, tx: 0, ty: 0 }, ptr = null;
  function setActive(i) {
    if (i === active) return;
    var first = active < 0; active = i; var h = HOMES[i];
    var fill = function () {
      $("#hiIdx").textContent = String(i + 1).padStart(2, "0");
      $("#hiName").textContent = h.name; $("#hiBlurb").textContent = h.blurb;
      $("#hiNet").innerHTML = m2(h.net); $("#hiGross").innerHTML = m2(h.gross); $("#hiGarden").innerHTML = h.garden ? m2(h.garden) : "—";
      hiMain.removeAttribute("data-swap"); hiSpecs.removeAttribute("data-swap");
    };
    pagerBtns.forEach(function (b, j) { b.setAttribute("aria-pressed", j === i); });
    if (first || R) return fill();
    hiMain.setAttribute("data-swap", ""); hiSpecs.setAttribute("data-swap", "");
    setTimeout(fill, 180);
  }
  var DECK = [[0, 0, 0], [-2.5, 6, -26], [2, -7, -52], [-1.5, 10, -78], [3, -9, -104], [-1, 4, -130]];
  var FAN = 0.16, FLOW0 = 0.2, FLOW1 = 0.94;
  function homesFrame(y) {
    var p = progress(L.homesTop, L.homesH, y);
    var a = easeOut(clamp(p / FAN));
    var f = clamp((p - FLOW0) / (FLOW1 - FLOW0)) * (N - 1);
    setActive(Math.round(f));
    var W = L.cw, S1 = W * 0.7, S2 = W * 0.34;
    tilt.x = lerp(tilt.x, tilt.tx, 0.12); tilt.y = lerp(tilt.y, tilt.ty, 0.12);
    rig.style.transform = "rotateX(" + tilt.y.toFixed(2) + "deg) rotateY(" + tilt.x.toFixed(2) + "deg)";
    cards.forEach(function (c, i) {
      var d = i - f, ad = Math.abs(d), sd = Math.sign(d);
      var fx = sd * (ad < 1 ? ad * S1 : S1 + (ad - 1) * S2), fry = -clamp(d, -1, 1) * 38;
      var fz = -Math.min(ad, 1) * 150 - Math.max(ad - 1, 0) * 60, fo = clamp(3.4 - ad);
      var dk = DECK[i];
      var X = lerp(0, fx, a), Y = lerp(dk[1], 0, a), Z = lerp(dk[2], fz, a), RY = lerp(0, fry, a), RZ = lerp(dk[0], 0, a), O = lerp(1, fo, a);
      c.style.transform = "translate3d(" + X.toFixed(1) + "px," + Y.toFixed(1) + "px," + Z.toFixed(1) + "px) rotateY(" + RY.toFixed(2) + "deg) rotateZ(" + RZ.toFixed(2) + "deg)";
      c.style.opacity = O.toFixed(3);
      c.style.visibility = O < 0.02 ? "hidden" : "";
      c.style.zIndex = String(100 - Math.round((a * ad + (1 - a) * i) * 10));
      c.tabIndex = i === active ? 0 : -1;
      c.style.setProperty("--sx", (50 - RY * 2.2).toFixed(1) + "%");
      if (ptr) {
        c.style.setProperty("--gx", (50 + ((ptr.x - (L.rigX + X)) / W) * 100).toFixed(1) + "%");
        c.style.setProperty("--gy", (50 + ((ptr.y - L.rigY) / L.ch) * 100).toFixed(1) + "%");
        c.style.setProperty("--go", ad < 0.5 ? "0.9" : "0.45");
      } else {
        c.style.setProperty("--gx", (50 - RY).toFixed(1) + "%"); c.style.setProperty("--gy", "0%"); c.style.setProperty("--go", "0.55");
      }
    });
  }
  if (pinned && U.fine) {
    rigWrap.addEventListener("pointermove", function (e) {
      var r = rigWrap.getBoundingClientRect();
      ptr = { x: e.clientX, y: e.clientY - r.top };
      tilt.tx = ((e.clientX - r.left) / r.width - 0.5) * 8; tilt.ty = -((e.clientY - r.top) / r.height - 0.5) * 6;
      U.dirty();
    });
    rigWrap.addEventListener("pointerleave", function () { ptr = null; tilt.tx = 0; tilt.ty = 0; U.dirty(); });
  }
  var goHome = function (i) { U.scrollTo(L.homesTop + (FLOW0 + (i / (N - 1)) * (FLOW1 - FLOW0)) * (L.homesH - U.vh) + 2); };
  pagerBtns.forEach(function (b) { b.addEventListener("click", function () { goHome(+b.dataset.go); }); });
  cards.forEach(function (c, i) {
    c.addEventListener("click", function () { if (!pinned || i === active) U.openPlan(i, 0, c); else goHome(i); });
    c.addEventListener("focus", function () { if (pinned && i !== active) goHome(i); });
  });
  $("#planOpen").addEventListener("click", function (e) { U.openPlan(Math.max(0, active), 0, e.currentTarget); });
  rig.addEventListener("keydown", function (e) {
    if (!pinned) return;
    var k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!k) return;
    e.preventDefault();
    var n = clamp(active + k, 0, N - 1);
    goHome(n); cards[n].focus({ preventScroll: true });
  });

  /* ── Bir gün: pictures dissolve, a sun (then a moon) crosses the arc, and the page's hour runs with the beats */
  var gunTrack = $("#gunTrack"), beats = $$("#win .beat"), wins = beats.map(function (b) { return $("img", b); }), caps = beats.map(function (b) { return $(".cap-g", b); });
  var bars = $$("#beats i"), orb = $("#orb"), arcFill = $("#arcFill"), sunLabel = $("#sunLabel"), sunIdx = $("#sunIdx");
  var PERIOD = ["Sabah", "Öğleden önce", "Öğleden sonra", "Akşamüstü", "Gün batımı", "Gece"];
  var BEAT_H = [14.5, 15.4, 16.6, 17.6, 18.4, 22.5];
  var AT = [450, 600, 840, 1020, 1170, 1320], RISE = 360, SET = 1230;
  var beatPos = function (y) { return progress(L.gunTop, L.gunH, y) * (BEAT_H.length - 1); };
  if (pinned) gunTrack._hour = function (y) {
    var b = beatPos(y), i = Math.min(BEAT_H.length - 2, Math.floor(b));
    return lerp(BEAT_H[i], BEAT_H[i + 1], smooth(0.3, 0.7, b - i));
  };
  else gunTrack.removeAttribute("data-hour");
  var beatShown = -1;
  function gunFrame(y) {
    var b = beatPos(y), F = 0.36;
    wins.forEach(function (im, i) {
      var o = i === 0 ? 1 : clamp((b - (i - 0.5) + F / 2) / F);
      var s = 1.07 - 0.07 * clamp(1 - Math.abs(b - i) * 0.8);
      beats[i].style.opacity = o.toFixed(3);
      im.style.transform = "scale(" + s.toFixed(4) + ")";
    });
    caps.forEach(function (c, i) {
      var o = clamp(1 - (Math.abs(b - i) - 0.28) / 0.18);
      c.style.opacity = o.toFixed(3);
      c.style.transform = "translateY(" + ((i - b) * 28).toFixed(1) + "px)";
      c.style.visibility = o > 0 ? "visible" : "hidden";
    });
    bars.forEach(function (el, i) { el.style.setProperty("--f", clamp(b - i + 1).toFixed(3)); });
    var n = Math.min(AT.length - 2, Math.floor(b)), m = lerp(AT[n], AT[n + 1], clamp(b - n));
    var night = m > SET, k = night ? clamp((m - SET) / 570) : clamp((m - RISE) / (SET - RISE));
    var P = [[6, 50], [80, -18], [154, 50]], q = function (j) { return Math.pow(1 - k, 2) * P[0][j] + 2 * (1 - k) * k * P[1][j] + k * k * P[2][j]; };
    orb.style.left = (q(0) / 160) * 100 + "%"; orb.style.top = (q(1) / 52) * 100 + "%";
    orb.classList.toggle("moon", night);
    arcFill.style.strokeDashoffset = String(1 - k);
    var idx = Math.round(b);
    if (idx !== beatShown) { beatShown = idx; sunLabel.textContent = PERIOD[idx]; sunIdx.textContent = (idx + 1) + " / 6"; }
  }

  /* ── Wire into the shared loop */
  U.onMeasure.push(function () {
    L.homesTop = U.abs(homes); L.homesH = homes.offsetHeight;
    L.gunTop = U.abs(gunTrack); L.gunH = gunTrack.offsetHeight;
    L.cw = rig.offsetWidth; L.ch = rig.offsetHeight;
    var wr = rigWrap.getBoundingClientRect(); L.rigX = wr.left + wr.width / 2; L.rigY = wr.height / 2;
  });
  if (pinned) U.onFrame.push(function (y, vh, moved) {
    var tilting = Math.abs(tilt.x - tilt.tx) > 0.01 || Math.abs(tilt.y - tilt.ty) > 0.01;
    if (!moved && !tilting) return;
    if (y > L.homesTop - vh && y < L.homesTop + L.homesH) homesFrame(y);
    if (y > L.gunTop - vh && y < L.gunTop + L.gunH) gunFrame(y);
  });
  U.measure();
  if (pinned) { homesFrame(scrollY); gunFrame(scrollY); }
})();
