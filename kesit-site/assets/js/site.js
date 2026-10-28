/* Kesit: shared behaviour for every sheet. Page scripts (assets/js/<page>.js) run after this one and use window.UZM. */
(function () {
  var doc = document.documentElement;
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (n, a, b) { return Math.min(b, Math.max(a, n)); };
  var fmt = new Intl.NumberFormat("tr-TR");
  var fmt2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  var UZM = (window.UZM = { reduced: reduced, fine: fine, $: $, $$: $$, clamp: clamp, fmt: fmt, fmt2: fmt2, onScroll: [], root: document.body.dataset.root, assets: document.body.dataset.assets });

  /* Scroll lock, shared by the sheet index and the dialogs; Lenis pauses while anything is open. */
  var locks = 0;
  UZM.lock = function () { if (locks++ === 0) { doc.style.overflow = "hidden"; if (window.__lenis) window.__lenis.stop(); } };
  UZM.unlock = function () { if (locks > 0 && --locks === 0) { doc.style.overflow = ""; if (window.__lenis) window.__lenis.start(); } };

  /* ── Header: solid once the page moves, a progress rule with a tick per detail, the current detail in the header ── */
  var hdr = $("#hdr"), prog = $(".prog", hdr);
  var hasHero = !!$(".hero, .ph");
  var where = $(".where", hdr), whereD = $(".where-d", hdr), whereT = $(".where-t", hdr);
  var sheetName = whereT ? whereT.textContent : "";
  var details = $$("[data-detail]");
  var placeTicks = function () {
    $$("b", prog).forEach(function (b) { b.remove(); });
    var total = doc.scrollHeight - innerHeight;
    if (total <= 0) return;
    details.forEach(function (s) {
      var b = document.createElement("b");
      b.style.left = Math.min(100, (s.getBoundingClientRect().top + scrollY) / total * 100) + "%";
      prog.appendChild(b);
    });
  };
  var curDetail = null;
  var setDetail = function (s) {
    if (curDetail === s || !where) return;
    curDetail = s;
    where.setAttribute("data-swap", "");
    setTimeout(function () {
      whereD.textContent = s ? " / " + s.dataset.detail : "";
      whereT.textContent = s ? s.dataset.name : sheetName;
      where.removeAttribute("data-swap");
    }, 220);
  };
  if (details.length) {
    var dio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) setDetail(e.target); });
    }, { rootMargin: "-45% 0px -54% 0px" });
    details.forEach(function (s) { dio.observe(s); });
  }
  addEventListener("load", placeTicks);
  addEventListener("resize", placeTicks);

  /* ── Reveal on scroll and count-ups. Elements get .in once; page scripts can listen for "k:in". ── */
  var countUp = function (el) {
    var to = +el.dataset.count;
    if (reduced || el.hasAttribute("data-plain")) return;
    var dec = (el.dataset.count.split(".")[1] || "").length;
    var nf = dec ? new Intl.NumberFormat("tr-TR", { minimumFractionDigits: dec, maximumFractionDigits: dec }) : fmt;
    var t0 = performance.now(), D = +el.dataset.dur || 1800;
    (function tick(t) {
      var k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 4);
      el.textContent = nf.format(dec ? to * e : Math.round(to * e));
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  };
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target;
      el.classList.add("in");
      if (el.dataset.count) countUp(el);
      $$("[data-count]", el).forEach(countUp);
      el.dispatchEvent(new CustomEvent("k:in", { bubbles: true }));
      io.unobserve(el);
    });
  }, { rootMargin: "0px 0px -10% 0px", threshold: 0.05 });
  UZM.observe = function (el) { io.observe(el); };
  $$("[data-r], .rule, .spec, [data-io]").forEach(function (el) { io.observe(el); });

  /* ── Hero films: the still covers each until it plays; plays only while on screen; a button stops it for good. ── */
  $$("video[data-film]").forEach(function (v) {
    var frame = v.closest(".frame") || v.parentElement;
    var btn = $(".film-tg", frame);
    if (reduced || (navigator.connection && navigator.connection.saveData)) { if (btn) btn.hidden = true; frame.classList.add("still"); return; }
    var start = +v.dataset.start || 0, loaded = false, userPaused = false;
    var load = function () {
      if (loaded) return;
      loaded = true;
      v.src = matchMedia("(max-width: 48rem)").matches && v.dataset.filmSm ? v.dataset.filmSm : v.dataset.film;
      if (start) v.addEventListener("loadedmetadata", function () { try { if (v.currentTime < start - 0.1) v.currentTime = start; } catch (e) {} }, { once: true });
      v.addEventListener("playing", function () { setTimeout(function () { frame.classList.add("playing"); }, 400); }, { once: true });
      v.muted = true;
    };
    var play = function () { load(); var p = v.play(); if (p && p.catch) p.catch(function () {}); };
    if (btn) {
      var lab = $("span", btn);
      v.addEventListener("timeupdate", function () { if (v.duration) btn.style.setProperty("--p", (v.currentTime / v.duration).toFixed(3)); });
      btn.addEventListener("click", function () {
        userPaused = !userPaused;
        userPaused ? v.pause() : play();
        btn.setAttribute("aria-pressed", String(userPaused));
        lab.textContent = userPaused ? "Filmi oynat" : "Filmi durdur";
      });
    }
    var seen = false, wait = 0;
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        seen = e.isIntersecting;
        clearTimeout(wait);
        if (seen) { if (!userPaused) wait = setTimeout(function () { if (seen) play(); }, loaded ? 0 : 700); }
        else if (loaded) v.pause();
      });
    }, { rootMargin: "100px 0px" }).observe(frame);
    UZM.pauseFilms = function () { v.pause(); };
  });

  /* ── The CAD crosshair: a readout of the cursor on the sheet. ── */
  if (fine) {
    $$(".frame").forEach(function (frame) {
      var cross = $(".cross", frame);
      if (!cross) return;
      var h = $(".h", cross), vv = $(".v", cross), lab = $("span", cross);
      frame.addEventListener("pointermove", function (e) {
        var r = frame.getBoundingClientRect();
        var x = Math.round(e.clientX - r.left), y = Math.round(e.clientY - r.top);
        h.style.transform = "translateY(" + y + "px)"; vv.style.transform = "translateX(" + x + "px)";
        lab.style.transform = "translate(" + (x + 10) + "px," + (y + 10) + "px)";
        lab.textContent = "X " + String(x).padStart(4, "0") + " · Y " + String(y).padStart(4, "0");
      });
    });
  }

  /* ── Lens: a circle of line drawing over the photograph (or the photograph over the drawing); it drifts on its own
     until the visitor takes it. Markup decides which layer is the drawing. ── */
  $$(".lens-fig").forEach(function (fig) {
    var lens = $(".lens", fig), lensIn = $(".lens-in", fig), ring = $(".lens-ring", fig), ticks = $(".ring-ticks", ring);
    var wrap = fig.closest("section") || document;
    for (var i = 0; i < 72; i++) {
      var a = i / 72 * Math.PI * 2, r1 = 99, r2 = i % 6 === 0 ? 92 : 95.5;
      var ln = document.createElementNS("http://www.w3.org/2000/svg", "line"); ln.setAttribute("x1", 100 + Math.cos(a) * r1); ln.setAttribute("y1", 100 + Math.sin(a) * r1); ln.setAttribute("x2", 100 + Math.cos(a) * r2); ln.setAttribute("y2", 100 + Math.sin(a) * r2); ticks.appendChild(ln);
    }
    var W = 0, H = 0, D = 0;
    var size = function () {
      var r = fig.getBoundingClientRect();
      W = r.width; H = r.height; D = Math.round(Math.max(176, Math.min(W * 0.26, 300)));
      fig.style.setProperty("--ld", D + "px");
      lensIn.style.width = W + "px"; lensIn.style.height = H + "px";
    };
    size(); addEventListener("resize", size);
    var pos = { x: 0.5, y: 0.42 }, tgt = { x: 0.5, y: 0.42 };
    var user = false, idleAt = 0, running = false;
    var place = function () {
      var x = pos.x * W - D / 2, y = pos.y * H - D / 2;
      lens.style.transform = ring.style.transform = "translate3d(" + x + "px," + y + "px,0)";
      lensIn.style.transform = "translate3d(" + -x + "px," + -y + "px,0)";
    };
    var tick = function (t) {
      if (!user && t > idleAt) { tgt.x = 0.5 + 0.27 * Math.sin(t * 0.00031); tgt.y = 0.42 + 0.17 * Math.sin(t * 0.00047 + 1.2); }
      var k = user ? 0.16 : 0.035;
      pos.x += (tgt.x - pos.x) * k; pos.y += (tgt.y - pos.y) * k;
      place();
      if (running) requestAnimationFrame(tick);
    };
    new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { size(); place(); fig.classList.add("ready"); if (!reduced && !running) { running = true; requestAnimationFrame(tick); } }
      else running = false;
    }).observe(fig);
    var move = function (e) {
      var r = fig.getBoundingClientRect();
      tgt.x = clamp((e.clientX - r.left) / r.width, 0, 1); tgt.y = clamp((e.clientY - r.top) / r.height, 0, 1);
      user = true;
      if (reduced) { pos.x = tgt.x; pos.y = tgt.y; place(); }
    };
    fig.addEventListener("pointermove", function (e) { if (e.pointerType === "mouse" || e.buttons) move(e); });
    fig.addEventListener("pointerdown", move);
    var leave = function () { user = false; idleAt = performance.now() + 1800; };
    fig.addEventListener("pointerleave", leave);
    fig.addEventListener("pointercancel", leave);
    fig.addEventListener("pointerup", function (e) { if (e.pointerType !== "mouse") leave(); });
    $$("[data-lens]", wrap).forEach(function (b) {
      b.addEventListener("click", function () {
        $$("[data-lens]", wrap).forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        fig.classList.toggle("full", b.dataset.lens === "full");
      });
    });
    var hint = $(".lens-hint", wrap);
    if (!fine && hint && hint.dataset.touch) hint.textContent = hint.dataset.touch;
  });


  /* ── Section planes: each .cut band moves its plane with the scroll. ── */
  $$(".cut").forEach(function (cut) {
    if (reduced) { cut.style.setProperty("--p", 0.5); return; }
    UZM.onScroll.push(function (y, vh) {
      var r = cut.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      var p = clamp(-r.top / Math.max(1, r.height - vh), 0, 1);
      cut.style.setProperty("--p", (0.06 + p * 0.88).toFixed(4));
    });
  });

  /* ── Scroll: header state, progress, hero parallax, the presenter pill; one rAF-throttled handler. ── */
  var heroMedia = $$(".hero .frame > video, .hero .frame .poster, .ph .frame > video, .ph .frame > picture img, .ph .frame > img.bg");
  var heroCopy = $(".hero .hero-copy, .ph .hero-copy");
  var pres = $(".pres"), lastY = scrollY, ticking = false;
  var onScroll = function () {
    ticking = false;
    var y = scrollY, vh = innerHeight, max = doc.scrollHeight - vh;
    hdr.toggleAttribute("data-solid", y > 40 || !hasHero);
    prog.style.setProperty("--p", max > 0 ? clamp(y / max, 0, 1).toFixed(4) : 0);
    if (!reduced && y < vh * 1.2) {
      var p = y / vh;
      heroMedia.forEach(function (m) { m.style.transform = "translateY(" + (p * 8).toFixed(2) + "%)"; });
      if (heroCopy) { heroCopy.style.transform = "translateY(" + (p * -60).toFixed(1) + "px)"; heroCopy.style.opacity = String(Math.max(0, 1 - p * 1.6)); }
    }
    if (pres) {
      var dy = y - lastY;
      if (Math.abs(dy) > 6) {
        var end = y + vh >= doc.scrollHeight - 80;
        pres.classList.toggle("away", dy > 0 && y > vh * 0.5 && !end);
        lastY = y;
      }
    }
    for (var i = 0; i < UZM.onScroll.length; i++) UZM.onScroll[i](y, vh);
  };
  UZM.refresh = onScroll;
  addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();

  /* ── Sheet index (menu): the rest of the page goes inert while it is open; rows preview their sheet as a line drawing. ── */
  var menu = $("#menu"), menuBtn = $(".menu-btn");
  var behind = [".skip", "#hdr", "main", ".foot", ".pres"].map(function (s) { return $(s); }).filter(Boolean);
  var pvImg = $(".idx-plot img", menu), pvPlot = $(".idx-plot", menu), pvN = $(".idx-pv-n", menu);
  var pvAt = null;
  var preview = function (a) {
    if (!a || !a.dataset.pv || pvAt === a.dataset.pv) return;
    pvAt = a.dataset.pv;
    pvImg.classList.remove("on");
    var src = UZM.assets + "img/" + a.dataset.pv + ".webp";
    var im = new Image();
    im.onload = function () {
      if (pvAt !== a.dataset.pv) return;
      pvImg.src = src; pvImg.classList.add("on");
      pvN.textContent = $(".idx-n", a).textContent + " · " + $(".idx-t", a).textContent;
      if (!reduced) { pvPlot.classList.remove("go"); void pvPlot.offsetWidth; pvPlot.classList.add("go"); }
    };
    im.src = src;
  };
  var setMenu = function (open) {
    if (open === menu.hasAttribute("data-open")) return;
    menu.toggleAttribute("data-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    behind.forEach(function (el) { el.inert = open; });
    open ? UZM.lock() : UZM.unlock();
    if (open) {
      var cur = $("a[aria-current]", menu) || $(".idx a", menu);
      preview(cur.dataset.pv ? cur : $(".idx a", menu));
      setTimeout(function () { cur.focus(); }, 50);
    } else menuBtn.focus({ preventScroll: true });
  };
  menuBtn.addEventListener("click", function () { setMenu(true); });
  $(".menu-close", menu).addEventListener("click", function () { setMenu(false); });
  $$(".idx a", menu).forEach(function (a) {
    a.addEventListener("pointerenter", function () { preview(a); });
    a.addEventListener("focus", function () { preview(a); });
  });
  $$("a, [data-open]", menu).forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
  addEventListener("keydown", function (e) { if (e.key === "Escape" && menu.hasAttribute("data-open")) setMenu(false); });

  /* ── Dialogs: [data-open="id"] opens #id; [data-close] and the backdrop close it; focus returns to the opener. ── */
  var opener = null;
  UZM.open = function (dlg, from) {
    if (typeof dlg === "string") dlg = document.getElementById(dlg);
    if (!dlg || dlg.open) return;
    if (menu.hasAttribute("data-open")) setMenu(false);
    opener = from && menu.contains(from) ? menuBtn : from || document.activeElement;
    UZM.lock();
    dlg.showModal();
  };
  $$("dialog.dlg").forEach(function (dlg) {
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
    $$("[data-close]", dlg).forEach(function (b) { b.addEventListener("click", function () { dlg.close(); }); });
    dlg.addEventListener("close", function () {
      UZM.unlock();
      if (opener && opener.focus) opener.focus({ preventScroll: true });
      opener = null;
    });
  });
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-open]");
    if (!b) return;
    e.preventDefault();
    UZM.open(b.dataset.open, b);
  });

  /* ── Lightbox: links with data-lb="group" open their href; data-cap is the caption. ── */
  var lb = $("#lb"), lbImg = $("img", lb), lbCap = $(".lb-cap", lb), lbCount = $(".lb-count", lb);
  var group = [], at = 0;
  var lbShow = function (i) {
    at = (i + group.length) % group.length;
    var a = group[at];
    lbImg.src = a.getAttribute("href");
    lbImg.alt = a.dataset.cap || (a.querySelector("img") ? a.querySelector("img").alt : "");
    lbCap.textContent = a.dataset.cap || "";
    lbCount.textContent = (a.dataset.n || String(at + 1).padStart(2, "0")) + " · " + (at + 1) + " / " + group.length;
    var one = group.length < 2;
    $(".lb-prev", lb).hidden = one; $(".lb-next", lb).hidden = one;
  };
  UZM.lightbox = function (links, i, from) { group = links; lbShow(i); UZM.open(lb, from); };
  document.addEventListener("click", function (e) {
    var a = e.target.closest("a[data-lb]");
    if (!a) return;
    e.preventDefault();
    UZM.lightbox($$('a[data-lb="' + a.dataset.lb + '"]'), $$('a[data-lb="' + a.dataset.lb + '"]').indexOf(a), a);
  });
  $(".lb-prev", lb).addEventListener("click", function () { lbShow(at - 1); });
  $(".lb-next", lb).addEventListener("click", function () { lbShow(at + 1); });
  lb.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft") lbShow(at - 1);
    if (e.key === "ArrowRight") lbShow(at + 1);
  });
  lb.addEventListener("click", function (e) { if (e.target === lb || e.target.classList.contains("lb-fig")) lb.close(); });

  /* ── Loupe: a magnifier with a graduated ring over a plan or a picture. Mouse: hover; touch: press and drag;
     keyboard: focus the plan and use the arrow keys. UZM.loupe(host, img, { zoom, label }) ── */
  var RING = (function () {
    var s = '<svg viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="99" fill="none" stroke="currentColor" stroke-width="1.2"/>';
    for (var i = 0; i < 72; i++) {
      var a = i / 72 * Math.PI * 2, r1 = 99, r2 = i % 6 === 0 ? 91 : 95;
      s += '<line x1="' + (100 + Math.cos(a) * r1).toFixed(2) + '" y1="' + (100 + Math.sin(a) * r1).toFixed(2) + '" x2="' + (100 + Math.cos(a) * r2).toFixed(2) + '" y2="' + (100 + Math.sin(a) * r2).toFixed(2) + '" stroke="currentColor" stroke-width="0.8"/>';
    }
    return s + '<path d="M100 86v28M86 100h28" stroke="currentColor" stroke-width="0.8"/></svg>';
  })();
  UZM.loupe = function (host, img, o) {
    o = o || {};
    var zoom = o.zoom || 2.5;
    host.classList.add("loupe-host");
    host.setAttribute("data-loupe-on", "");
    var lp = document.createElement("div");
    lp.className = "loupe";
    lp.setAttribute("aria-hidden", "true");
    var big = document.createElement("img");
    big.alt = "";
    lp.appendChild(big);
    lp.insertAdjacentHTML("beforeend", RING + '<span class="loupe-lab">' + (o.label || "Büyüteç ×" + String(zoom).replace(".", ",")) + "</span>");
    host.appendChild(lp);
    var W = 0, H = 0, D = 0, box = null, x = 0.5, y = 0.5, on = true;
    /* The picture is drawn with object-fit: contain; the loupe reads the drawn box, not the element box. */
    var measure = function () {
      var r = host.getBoundingClientRect(), ir = img.getBoundingClientRect();
      W = r.width; H = r.height;
      D = Math.round(clamp(Math.min(W, H) * 0.42, 120, 240));
      lp.style.setProperty("--ld", D + "px");
      var nw = img.naturalWidth || 16, nh = img.naturalHeight || 9;
      var cs = getComputedStyle(img), pl = parseFloat(cs.paddingLeft) || 0, pt = parseFloat(cs.paddingTop) || 0;
      var cw = ir.width - pl * 2, ch = ir.height - pt * 2, k = Math.min(cw / nw, ch / nh);
      box = { left: ir.left - r.left + pl + (cw - nw * k) / 2, top: ir.top - r.top + pt + (ch - nh * k) / 2, w: nw * k, h: nh * k };
      big.style.width = box.w * zoom + "px"; big.style.height = box.h * zoom + "px";
    };
    var place = function () {
      if (!box) measure();
      var px = x * W, py = y * H;
      lp.style.transform = "translate3d(" + (px - D / 2) + "px," + (py - D / 2) + "px,0)";
      var ix = (px - box.left) * zoom, iy = (py - box.top) * zoom;
      big.style.transform = "translate3d(" + (D / 2 - ix) + "px," + (D / 2 - iy) + "px,0)";
    };
    var setSrc = function () { big.src = img.currentSrc || img.src; big.className = img.classList.contains("ink") ? "ink" : ""; box = null; };
    var from = function (e) { var r = host.getBoundingClientRect(); x = clamp((e.clientX - r.left) / r.width, 0, 1); y = clamp((e.clientY - r.top) / r.height, 0, 1); };
    host.addEventListener("pointerenter", function (e) { if (!on || e.pointerType !== "mouse") return; measure(); setSrc(); host.classList.add("looking"); });
    host.addEventListener("pointermove", function (e) { if (!on) return; if (e.pointerType !== "mouse" && !e.buttons) return; from(e); if (!host.classList.contains("looking")) { measure(); setSrc(); host.classList.add("looking"); } place(); });
    host.addEventListener("pointerdown", function (e) { if (!on || e.pointerType === "mouse") return; measure(); setSrc(); from(e); host.classList.add("looking"); place(); });
    var off = function () { host.classList.remove("looking"); };
    host.addEventListener("pointerleave", off);
    host.addEventListener("pointerup", function (e) { if (e.pointerType !== "mouse") setTimeout(off, 900); });
    host.addEventListener("pointercancel", off);
    host.addEventListener("focus", function () { if (!on) return; measure(); setSrc(); host.classList.add("looking"); place(); });
    host.addEventListener("blur", off);
    host.addEventListener("keydown", function (e) {
      var d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!d || !on) return;
      e.preventDefault();
      x = clamp(x + d[0] * 0.04, 0, 1); y = clamp(y + d[1] * 0.06, 0, 1);
      host.classList.add("looking"); place();
    });
    addEventListener("resize", function () { box = null; });
    img.addEventListener("load", function () { box = null; setSrc(); if (host.classList.contains("looking")) place(); });
    return {
      refresh: function () { box = null; setSrc(); },
      enable: function (v) { on = v; host.toggleAttribute("data-loupe-on", v); if (!v) off(); }
    };
  };

  /* ── Demo forms: checked in the browser, never sent; the note says so. Problems are written next to their fields. ── */
  var problem = function (el) {
    if (el.type === "checkbox") return el.required && !el.checked ? "Devam etmek için aydınlatma metnini onaylayın." : "";
    if (el.required && !el.value.trim()) return el.tagName === "SELECT" ? "Lütfen bir konu seçin." : "Lütfen bu alanı doldurun.";
    if (el.validity && el.validity.typeMismatch && el.type === "email") return "Geçerli bir e-posta adresi yazın, örneğin ad@alanadi.com.";
    return el.checkValidity() ? "" : "Lütfen bu alanı kontrol edin.";
  };
  var fieldSeq = 0;
  var mark = function (el, msg) {
    var wrap = el.closest(".field, .check");
    if (!wrap) return;
    wrap.classList.toggle("bad", !!msg);
    if (!el.id) el.id = "f-" + (++fieldSeq);
    var id = el.id + "-err", err = document.getElementById(id);
    if (msg) {
      if (!err) {
        err = document.createElement("span"); err.className = "err"; err.id = id;
        wrap.classList.contains("check") ? wrap.after(err) : wrap.appendChild(err);
      }
      err.textContent = msg;
      el.setAttribute("aria-invalid", "true");
      el.setAttribute("aria-describedby", id);
    } else {
      if (err) err.remove();
      el.removeAttribute("aria-invalid");
      el.removeAttribute("aria-describedby");
    }
  };
  $$("form[data-demo]").forEach(function (f) {
    var fields = $$("input, select, textarea", f);
    fields.forEach(function (el) {
      el.addEventListener(el.type === "checkbox" || el.tagName === "SELECT" ? "change" : "input", function () {
        if (el.getAttribute("aria-invalid")) mark(el, problem(el));
      });
    });
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var first = null;
      fields.forEach(function (el) { var msg = problem(el); mark(el, msg); if (msg && !first) first = el; });
      if (first) { first.focus(); return; }
      var note = $(".form-sent", f);
      $$(".field, .check, button[type=submit]", f).forEach(function (el) { el.hidden = true; });
      if (note) { note.hidden = false; note.setAttribute("tabindex", "-1"); note.focus(); }
    });
  });

  /* ── Inertial scrolling on desktop when Lenis is reachable; in-page anchors glide too. ── */
  if (!reduced && fine) {
    var ls = document.createElement("script");
    ls.src = "https://cdn.jsdelivr.net/npm/lenis@1.1.13/dist/lenis.min.js";
    ls.onload = function () {
      if (!window.Lenis) return;
      var lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
      window.__lenis = lenis;
      if (locks > 0) lenis.stop();
      (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(performance.now());
      document.addEventListener("click", function (e) {
        var a = e.target.closest('a[href^="#"]');
        if (!a) return;
        var id = a.getAttribute("href");
        if (id.length < 2) return;
        var target = document.getElementById(decodeURIComponent(id.slice(1)));
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: -80, duration: 1.4 });
        history.replaceState(null, "", id);
      });
    };
    document.body.appendChild(ls);
  }
})();
