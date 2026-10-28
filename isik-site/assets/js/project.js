/* Işık · a completed project: light on the pool water (Viktorya Park) and a glass loupe over the aerial (Ağaçelebi). */
(function () {
  var U = window.UZM, $ = U.$, R = U.reduced;

  /* ── Caustics: the light pools where the pointer is; the drift stops when the pool is off screen. */
  var pool = $(".pool"), ca = pool && $(".caustics", pool);
  if (ca) {
    new IntersectionObserver(function (es) { ca.classList.toggle("paused", !es[0].isIntersecting); }).observe(pool);
    if (U.fine && !R) pool.addEventListener("pointermove", function (e) {
      var r = pool.getBoundingClientRect();
      ca.style.setProperty("--cx", ((e.clientX - r.left) / r.width * 100).toFixed(1) + "%");
      ca.style.setProperty("--cy", ((e.clientY - r.top) / r.height * 100).toFixed(1) + "%");
    });
  }

  /* ── Loupe: a magnified copy of the picture under a round glass, following the pointer, a tap, or the arrows. */
  var stage = $("#loupe");
  if (stage) {
    var img = $("img", stage), lens = $(".loupe", stage), Z = 2.6, pos = { x: 0.5, y: 0.5 }, raf = 0;
    lens.style.backgroundImage = "url(" + JSON.stringify(img.currentSrc || img.src) + ")";
    var draw = function () {
      raf = 0;
      var W = stage.clientWidth, H = stage.clientHeight, iw = img.naturalWidth || 1600, ih = img.naturalHeight || 900;
      var s = Math.max(W / iw, H / ih), dw = iw * s, dh = ih * s, ox = (W - dw) / 2, oy = (H - dh) / 2;
      var d = lens.offsetWidth, x = pos.x * W, y = pos.y * H;
      lens.style.setProperty("--lx", x + "px"); lens.style.setProperty("--ly", y + "px");
      lens.style.backgroundSize = dw * Z + "px " + dh * Z + "px";
      lens.style.backgroundPosition = (d / 2 - (x - ox) * Z) + "px " + (d / 2 - (y - oy) * Z) + "px";
    };
    var move = function (x, y) { pos.x = U.clamp(x); pos.y = U.clamp(y); stage.classList.add("on"); if (!raf) raf = requestAnimationFrame(draw); };
    var fromEvent = function (e) { var r = stage.getBoundingClientRect(); move((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); };
    stage.addEventListener("pointermove", function (e) { if (e.pointerType === "mouse") fromEvent(e); });
    stage.addEventListener("pointerdown", fromEvent);
    stage.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") stage.classList.remove("on"); });
    stage.addEventListener("focus", function () { move(pos.x, pos.y); });
    stage.addEventListener("blur", function () { stage.classList.remove("on"); });
    stage.addEventListener("keydown", function (e) {
      var k = { ArrowLeft: [-0.04, 0], ArrowRight: [0.04, 0], ArrowUp: [0, -0.06], ArrowDown: [0, 0.06] }[e.key];
      if (!k) { if (e.key === "Escape") stage.classList.remove("on"); return; }
      e.preventDefault(); move(pos.x + k[0], pos.y + k[1]);
    });
    addEventListener("resize", function () { if (stage.classList.contains("on")) draw(); });
  }
})();
