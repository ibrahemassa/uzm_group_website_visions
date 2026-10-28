/* Sergi · Giriş holü: the hero film's timecode, and the walk: a first-person stroll in CSS 3D past twelve renders on
   glass easels in three rooms. The works are read from the flat hang in the page, which stays as the exhibition on
   phones, with reduced motion and without script. */
(function () {
  "use strict";
  var U = window.UZM, $ = U.$, $$ = U.$$, clamp = U.clamp, lerp = U.lerp, smooth = U.smooth;
  var pad = function (n) { return String(n).padStart(2, "0"); };

  /* ── Hero: the framed film opens the full film; the timecode follows the loop. */
  var heroWork = $("#hero-work"), tc = $("#tc");
  var heroVid = $("video", heroWork);
  heroWork.addEventListener("click", function (e) { if (e.target.closest(".film-toggle")) return; var b = $("[data-film-open]"); if (b) b.click(); });
  heroVid.addEventListener("timeupdate", function () { var s = Math.floor(heroVid.currentTime); tc.textContent = pad(Math.floor(s / 60)) + ":" + pad(s % 60); });

  /* ── II · The walk */
  var ROOMS = [
    { name: "Mimari", ord: "Birinci salon", wall: [222, 213, 199], ceil: [40, 35, 31], ink: "#3a2f27", fog: [30, 24, 21] },
    { name: "Bir gün", ord: "İkinci salon", wall: [82, 27, 36], ceil: [28, 9, 13], ink: "#eadfd2", fog: [22, 7, 10] },
    { name: "Akşam", ord: "Üçüncü salon", wall: [30, 46, 62], ceil: [12, 18, 25], ink: "#e3e9ee", fog: [9, 13, 19] },
  ];
  var VEST = { wall: [30, 20, 22], ceil: [14, 10, 11], ink: "#e9dfd3", fog: [12, 8, 9] };
  var EXIT = { wall: [16, 11, 12], ceil: [10, 7, 8] };
  var walk = $("#yuruyus"), stage = $("#stage"), world = $("#world");
  var wTop = $(".walk-top", walk), mmap = $("#mmap"), fog = $("#fog"), wEnd = $("#w-end"), hud = $("#hud"), wRoom = $("#w-room"), wHint = $("#w-hint");
  var WALK = [];
  $$(".flat-room", walk).forEach(function (room, r) {
    $$(".fw", room).forEach(function (f) {
      var img = $("img", f);
      WALK.push({ room: r, src: img.getAttribute("src"), r: +img.getAttribute("width") / +img.getAttribute("height"), t: $(".ti", f).textContent, d: $(".tx", f).textContent, no: $(".no", f).textContent.split(" · ")[0] });
    });
  });
  var rgb = function (c, a) { return "rgb(" + c[0] + " " + c[1] + " " + c[2] + " / " + (a === undefined ? 1 : a) + ")"; };
  var G = null;
  var can3d = function () { return !U.reduced && innerWidth >= 700 && innerHeight >= 480 && CSS.supports("transform-style", "preserve-3d"); };

  function buildWalk() {
    var W = stage.clientWidth, H = stage.clientHeight;
    var P = Math.round(H * 1.12);
    stage.style.perspective = P + "px";
    world.style.transformOrigin = "0 0 " + P + "px";
    var floorY = H * 0.47, ceilY = -H * 0.8, wallH = floorY - ceilY;
    var h0 = H * 0.33, maxW = W * 0.46, gapX = W * 0.05, spacing = P;
    var works = WALK.map(function (w, i) { var h = h0, ww = h * w.r; if (ww > maxW) { ww = maxW; h = ww / w.r; } return Object.assign({}, w, { i: i, w: ww, h: h, s: i % 2 ? 1 : -1 }); });
    var need = 0;
    works.forEach(function (w) { w.x = w.s * (w.w / 2 + gapX); need = Math.max(need, Math.abs(w.x) + w.w / 2 + gapX); });
    var hw = Math.max(W * 0.58, need + W * 0.05);
    var portals = [], spans = [];
    var z = P * 0.8;
    for (var r = 0; r < 3; r++) {
      portals.push(z);
      var zz = z + P;
      works.filter(function (w) { return w.room === r; }).forEach(function (w) { w.z = zz; zz += spacing; });
      var end = zz - spacing + P;
      spans.push([z, end]);
      z = end;
    }
    portals.push(z);
    var zEnd = z + P * 0.75;

    world.textContent = "";
    var segs = [], easels = [];
    var add = function (cls, css, html) { var el = document.createElement("div"); el.className = cls; el.style.cssText = css; if (html) el.innerHTML = html; world.appendChild(el); return el; };
    var surfaces = function (a, b, c) {
      var L = b - a + 1;
      [
        add("w-s", "width:" + L + "px;height:" + wallH + "px;background:" + rgb(c.wall) + ";transform:translate3d(" + -hw + "px," + ceilY + "px," + -a + "px) rotateY(90deg)"),
        add("w-s", "width:" + L + "px;height:" + wallH + "px;background:" + rgb(c.wall) + ";transform:translate3d(" + hw + "px," + ceilY + "px," + -b + "px) rotateY(-90deg)"),
        add("w-s", "width:" + hw * 2 + "px;height:" + L + "px;background:rgb(26 19 16 / .82);transform:translate3d(" + -hw + "px," + floorY + "px," + -a + "px) rotateX(-90deg)"),
        add("w-s", "width:" + hw * 2 + "px;height:" + L + "px;background:" + rgb(c.ceil) + ";transform:translate3d(" + -hw + "px," + ceilY + "px," + -a + "px) rotateX(-90deg)"),
      ].forEach(function (el) { segs.push({ el: el, a: a, b: b }); });
    };
    surfaces(-P * 0.3, portals[0], VEST);
    spans.forEach(function (s, r) { surfaces(s[0], s[1], ROOMS[r]); });
    surfaces(portals[3], portals[3] + P * 2.2, EXIT);
    segs.push({ el: add("w-s", "width:" + hw * 2 + "px;height:" + wallH + "px;background:" + rgb(EXIT.wall) + ";transform:translate3d(" + -hw + "px," + ceilY + "px," + -(portals[3] + P * 2.2) + "px)"), a: portals[3] + P * 2.2, b: portals[3] + P * 2.2 });
    spans.forEach(function (s) { [-1, 1].forEach(function (k) { segs.push({ el: add("w-track", "width:" + Math.max(2, W * 0.003) + "px;height:" + (s[1] - s[0]) + "px;transform:translate3d(" + k * hw * 0.42 + "px," + (ceilY + 1) + "px," + -s[0] + "px) rotateX(-90deg)"), a: s[0], b: s[1] }); }); });
    /* Doorways: the wall you face, the next room's name over the door; the last one opens on the Levan wing. */
    var doorW = Math.max(W * 0.46, 2 * gapX + 60), doorTop = -H * 0.36, fs = Math.max(13, H * 0.03);
    portals.forEach(function (zp, r) {
      var c = r === 0 ? VEST : ROOMS[r - 1];
      var label = r < 3 ? "<b>" + ROOMS[r].name + "</b><small>" + ROOMS[r].ord + "</small>" : "<b>Levan kanadı</b><small>Özel sergi · Sonraki oda</small>";
      var side = hw - doorW / 2;
      segs.push({ el: add("w-s", "width:" + side + "px;height:" + wallH + "px;background:" + rgb(c.wall) + ";transform:translate3d(" + -hw + "px," + ceilY + "px," + -zp + "px)"), a: zp, b: zp });
      segs.push({ el: add("w-s", "width:" + side + "px;height:" + wallH + "px;background:" + rgb(c.wall) + ";transform:translate3d(" + doorW / 2 + "px," + ceilY + "px," + -zp + "px)"), a: zp, b: zp });
      segs.push({ el: add("w-s w-lin", "width:" + doorW + "px;height:" + (doorTop - ceilY) + "px;background:" + rgb(c.wall) + ";color:" + c.ink + ";font-size:" + fs + "px;padding-top:" + (doorTop - ceilY) * 0.18 + "px;box-shadow:inset 0 -" + Math.max(3, H * 0.006) + "px 0 rgb(0 0 0 / .18);transform:translate3d(" + -doorW / 2 + "px," + ceilY + "px," + -zp + "px)", label), a: zp, b: zp });
    });
    /* The works on glass easels, each under its own spot, with a pool of light on the floor. */
    works.forEach(function (w) {
      var pg = w.h * 0.08, gw = w.w + pg * 2, fb = Math.max(3, w.h * 0.03);
      var frameTop = -H * 0.045 - ceilY - w.h / 2, baseH = H * 0.075, bw = Math.max(w.w * 0.3, w.h * 0.34);
      var glassTop = frameTop - w.h * 0.1, glassH = wallH - baseH * 0.55 - glassTop, coneW = w.w * 1.3;
      var el = add("easel", "width:" + gw + "px;height:" + wallH + "px;transform:translate3d(" + (w.x - gw / 2) + "px," + ceilY + "px," + -w.z + "px)",
        '<div class="e-cone" style="left:' + (gw / 2 - coneW / 2) + "px;top:0;width:" + coneW + "px;height:" + (frameTop + w.h * 0.55) + 'px"></div>' +
        '<div class="e-head" style="left:' + (gw / 2 - w.h * 0.03) + "px;top:0;width:" + w.h * 0.06 + "px;height:" + w.h * 0.09 + 'px"></div>' +
        '<div class="e-glass" style="left:0;top:' + glassTop + "px;width:" + gw + "px;height:" + glassH + 'px"></div>' +
        '<div class="e-fr" style="left:' + pg + "px;top:" + frameTop + "px;width:" + w.w + "px;height:" + w.h + 'px"><img src="' + w.src + '" alt="" style="left:' + fb + "px;top:" + fb + "px;width:" + (w.w - fb * 2) + "px;height:" + (w.h - fb * 2) + 'px" ' + (w.i < 4 ? "" : 'loading="lazy"') + ' decoding="async"></div>' +
        '<div class="e-base" style="left:' + (gw / 2 - bw / 2) + "px;top:" + (wallH - baseH) + "px;width:" + bw + "px;height:" + baseH + 'px"></div>');
      var pool = add("w-pool", "width:" + w.w * 1.7 + "px;height:" + P * 0.9 + "px;transform:translate3d(" + (w.x - w.w * 0.85) + "px," + (floorY - 1) + "px," + -(w.z - P * 0.5) + "px) rotateX(-90deg)");
      easels.push({ w: w, el: el, pool: pool });
    });
    var top = walk.getBoundingClientRect().top + window.scrollY;
    G = { W: W, H: H, P: P, hw: hw, works: works, easels: easels, segs: segs, portals: portals, spans: spans, zEnd: zEnd, top: top, height: walk.offsetHeight, yaw: 0, pitch: 0, look: { x: 0, y: 0 }, bob: 0, phase: 0, amp: 0, last: 0, hudI: -2, room: -2 };
    drawMap();
  }
  function drawMap() {
    var svg = $("#mm-svg"), a = G.portals[0], b = G.portals[3], X = function (z) { return 6 + ((z - a) / (b - a)) * 208; };
    var s = '<line x1="0" y1="20" x2="220" y2="20" stroke="currentColor" stroke-opacity=".2" />';
    G.spans.forEach(function (sp, r) { s += '<rect x="' + X(sp[0]) + '" y="12" width="' + (X(sp[1]) - X(sp[0])) + '" height="16" fill="' + rgb(ROOMS[r].wall, 0.9) + '" stroke="rgb(243 238 229 / .35)" stroke-width=".6" /><text x="' + (X(sp[0]) + X(sp[1])) / 2 + '" y="40" text-anchor="middle">' + ROOMS[r].name + "</text>"; });
    G.works.forEach(function (w) { s += '<line x1="' + X(w.z) + '" x2="' + X(w.z) + '" y1="' + (w.s < 0 ? 12 : 22) + '" y2="' + (w.s < 0 ? 18 : 28) + '" stroke="' + (w.room === 0 ? "#3a2f27" : "#f3eee5") + '" stroke-width="1.2" />'; });
    s += '<g id="mm-dot"><circle cx="0" cy="20" r="5" fill="none" stroke="#f3eee5" stroke-width=".8" opacity=".6" /><circle cx="0" cy="20" r="2.6" fill="#f3eee5" /></g>';
    svg.innerHTML = s;
    G.mapX = X;
    G.dot = $("#mm-dot", svg);
  }
  function hudShow(i) {
    if (i === G.hudI) return;
    var prev = G.hudI;
    G.hudI = i;
    if (i < 0) { hud.classList.add("off"); return; }
    var fill = function () {
      var w = G.works[i], l = $(".lab", hud);
      $(".no", l).textContent = w.no + " · " + ROOMS[w.room].name;
      $(".ti", l).textContent = w.t;
      $(".me", l).textContent = "Levan Bahçeşehir · Görselleştirme";
      $(".tx", l).textContent = w.d;
      $("#mm-count").textContent = pad(i + 1) + " / " + pad(G.works.length);
      hud.classList.remove("swap", "off");
    };
    if (prev < 0) fill(); else { hud.classList.add("swap"); setTimeout(function () { if (G && G.hudI === i) fill(); }, 260); }
  }
  function roomShow(r) {
    if (r === G.room) return;
    G.room = r;
    wRoom.classList.add("swap");
    setTimeout(function () { $("b", wRoom).textContent = r < 0 ? "Giriş holü" : r > 2 ? "Levan kanadı" : ROOMS[r].name; wRoom.classList.remove("swap"); }, 250);
  }
  function updateWalk(y, vh) {
    if (!G) return;
    var rel = y - G.top;
    if (rel < -vh * 1.2 || rel > G.height + vh * 0.2) return;
    var t = clamp(rel / (G.height - G.H)), cam = t * G.zEnd, P = G.P;
    var v = cam - G.last;
    G.last = cam;
    /* The head sways toward the nearest work, bobs a little while walking, and follows the mouse. */
    var sway = 0;
    for (var i = 0; i < G.easels.length; i++) { var e = G.easels[i], dd = e.w.z - cam; sway += e.w.s * Math.exp(-Math.pow((dd - P * 0.95) / (P * 0.65), 2)); }
    G.yaw = lerp(G.yaw, clamp(sway, -1, 1) * 7 + G.look.x * 3.2, 0.08);
    G.pitch = lerp(G.pitch, G.look.y * -1.8, 0.08);
    G.amp = lerp(G.amp, clamp(Math.abs(v) / 14), 0.08);
    G.phase += Math.abs(v) / (P * 0.5);
    G.bob = Math.sin(G.phase * Math.PI * 2) * G.amp * 2.6;
    world.style.transform = "rotateX(" + G.pitch.toFixed(3) + "deg) rotateY(" + G.yaw.toFixed(3) + "deg) translate3d(0," + G.bob.toFixed(2) + "px," + cam.toFixed(1) + "px)";
    /* Culling: anything behind the eye or deep in the fog is hidden. */
    for (var k = 0; k < G.segs.length; k++) { var s = G.segs[k], vis = s.b > cam - P * 0.98 && s.a < cam + P * 9; if (vis !== s.vis) { s.vis = vis; s.el.style.visibility = vis ? "" : "hidden"; } }
    var best = -1, bd = 1e9;
    for (var j = 0; j < G.easels.length; j++) {
      var ea = G.easels[j], d = ea.w.z - cam;
      var o = smooth(P * 8, P * 5.2, d) * smooth(-P * 0.985, -P * 0.93, d);
      var on = o > 0.005;
      if (on !== ea.vis) { ea.vis = on; ea.el.style.visibility = ea.pool.style.visibility = on ? "" : "hidden"; }
      if (on && Math.abs(o - (ea.o || 0)) > 0.004) { ea.o = o; ea.el.style.opacity = o.toFixed(3); ea.pool.style.opacity = o.toFixed(3); }
      if (d > -P * 0.25 && d < P * 2.6) { var kk = Math.abs(d - P * 0.7); if (kk < bd) { bd = kk; best = ea.w.i; } }
    }
    hudShow(cam > G.zEnd - P * 0.5 ? -1 : best);
    var look = cam + P * 1.6, r = -1;
    for (var q = 0; q < 4; q++) if (look >= G.portals[q]) r = q;
    var hereZ = cam + P * 0.4, rr = -1;
    for (var q2 = 0; q2 < 4; q2++) if (hereZ >= G.portals[q2]) rr = q2;
    roomShow(rr);
    var fc = r < 0 ? VEST.fog : r > 2 ? [12, 8, 9] : ROOMS[r].fog;
    fog.style.background = "radial-gradient(ellipse 30% 30% at 50% 44%, " + rgb(fc, 0.92) + ", " + rgb(fc, 0.35) + " 55%, " + rgb(fc, 0) + ")";
    if (G.dot) G.dot.setAttribute("transform", "translate(" + G.mapX(clamp(cam + P, G.portals[0], G.portals[3])).toFixed(1) + " 0)");
    wEnd.style.opacity = smooth(G.zEnd - P * 0.55, G.zEnd, cam).toFixed(3);
    wHint.style.opacity = String(1 - smooth(P * 0.05, P * 0.5, cam));
    var out = (1 - smooth(G.zEnd - P * 0.6, G.zEnd - P * 0.2, cam)).toFixed(3);
    wTop.style.opacity = mmap.style.opacity = out;
  }

  var mode = null;
  var setMode = function () {
    var three = can3d();
    if (three === mode) { if (three) { buildWalk(); } return; }
    mode = three;
    walk.classList.toggle("three", three);
    if (three) buildWalk(); else { G = null; world.textContent = ""; }
  };
  setMode();
  U.resize.push(setMode);
  addEventListener("load", function () { if (G) { G.top = walk.getBoundingClientRect().top + window.scrollY; G.height = walk.offsetHeight; } });
  new ResizeObserver(function () { if (G) { G.top = walk.getBoundingClientRect().top + window.scrollY; G.height = walk.offsetHeight; } }).observe(document.body);
  if (U.fine) addEventListener("pointermove", function (e) { if (!G) return; G.look.x = (e.clientX / innerWidth - 0.5) * 2; G.look.y = (e.clientY / innerHeight - 0.5) * 2; }, { passive: true });
  U.loop.push(updateWalk);
})();
