/* Galeri · company pages: the chronology, the register's ex-libris, the reply card's stamp, the appendices' index,
   and the 404's missing plate. */
(function () {
  var U = window.UZM, $ = U.$, $$ = U.$$, A = U.assets, R = U.root;

  /* Chronology: the rule fills, each year lights as it reaches the reading line, and the large year rolls to it. */
  var ms = $("#ms");
  if (ms) {
    var items = $$("li", ms), roll = $(".ms-year .roll");
    if (U.reduced) {
      ms.style.setProperty("--tl", 1);
      items.forEach(function (li) { li.classList.add("lit"); });
    } else {
      U.onScroll.push(function (y, vh) {
        var line = vh * 0.6, r = ms.getBoundingClientRect(), cur = 0;
        if (r.bottom < -vh || r.top > vh * 2) return;
        ms.style.setProperty("--tl", U.clamp((line - r.top) / r.height, 0, 1).toFixed(3));
        items.forEach(function (li, i) {
          var lit = li.getBoundingClientRect().top < line;
          li.classList.toggle("lit", lit);
          if (lit) cur = i;
        });
        if (roll) roll.style.setProperty("--i", cur);
      });
    }
  }

  /* The register: reading a company's line sets its ex-libris on the card beside the list. */
  var wrap = $(".reg-wrap");
  if (wrap) {
    var card = $(".ex-card", wrap), exImg = $(".ex-logo img", card), exN = $(".ex-n", card), regs = $$(".reg li", wrap), regAt = 0, t = 0;
    var show = function (i) {
      regs.forEach(function (li, k) { li.classList.toggle("on", k === i); });
      if (i === regAt) return;
      regAt = i;
      clearTimeout(t);
      card.classList.add("swap");
      t = setTimeout(function () {
        exImg.src = regs[i].dataset.logo;
        exN.textContent = $(".rn", regs[i]).textContent;
        card.classList.remove("swap");
      }, U.reduced ? 0 : 220);
    };
    regs.forEach(function (li, i) {
      li.addEventListener("pointerenter", function () { wrap.classList.add("hov"); show(i); });
      li.addEventListener("focusin", function () { wrap.classList.add("hov"); show(i); });
    });
    $(".reg", wrap).addEventListener("pointerleave", function () { wrap.classList.remove("hov"); });
    if (matchMedia("(min-width: 901px)").matches) U.onScroll.push(function (y, vh) {
      if (wrap.classList.contains("hov")) return;
      var c = 0;
      regs.forEach(function (li, i) { if (li.getBoundingClientRect().top < vh * 0.45) c = i; });
      show(c);
    });
  }

  /* The reply card: once the demo form has been checked, the card is stamped as a preview that was not sent. */
  var reply = $(".reply");
  if (reply) reply.addEventListener("uzm:sent", function () { reply.classList.add("sent"); });

  /* Appendices: the index marks the section being read. */
  var toc = $(".legal-toc");
  if (toc) {
    var links = $$("a", toc), secs = links.map(function (a) { return document.querySelector(a.getAttribute("href")); });
    U.onScroll.push(function (y, vh) {
      var cur = 0;
      secs.forEach(function (s, i) { if (s && s.getBoundingClientRect().top < vh * 0.4) cur = i; });
      links.forEach(function (a, i) { a.classList.toggle("on", i === cur); if (i === cur) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current"); });
    });
  }

  /* 404: the plate is missing; draw one from the book instead. */
  var draw = $(".nf-draw");
  if (draw) {
    var PLATES = [
      { src: "film--levan-dusk", cap: "Levan Bahçeşehir, akşam · Görselleştirme", ch: "Bölüm I'de", href: "projeler/levan-bahcesehir/index.html" },
      { src: "levan--peyzaj", cap: "Gölet ve yürüyüş yolları · Görselleştirme", ch: "Bölüm I'de", href: "projeler/levan-bahcesehir/index.html#galeri" },
      { src: "levan--ikiz-villa", cap: "Bahçeli ikiz villalar · Görselleştirme", ch: "Bölüm I'de", href: "projeler/levan-bahcesehir/index.html#konutlar" },
      { src: "levan--tesis--golf", cap: "Golf sahası, yalnızca sakinlere · Görselleştirme", ch: "Bölüm I'de", href: "projeler/levan-bahcesehir/index.html#olanaklar" },
      { src: "viktorya--havuz-2", cap: "Viktorya Park Villaları, havuz başı · Fotoğraf", ch: "Bölüm III'te", href: "projeler/viktorya-park/index.html" },
      { src: "agacelebi--kapak", cap: "Ağaçelebi Sarayları, kemerli pencereler · Fotoğraf", ch: "Bölüm IV'te", href: "projeler/agacelebi-saraylari/index.html" },
      { src: "saha--vinc", cap: "Şantiyede vinç · Fotoğraf", ch: "Bölüm I'de", href: "projeler/levan-bahcesehir/index.html#insaat" },
      { src: "saha--ofis-havadan-dikey", cap: "Levan satış ofisi, havadan · Fotoğraf", ch: "Bölüm VII'de", href: "iletisim/index.html" }
    ];
    var img = $(".nf-frame img"), ghost = $(".nf-ghost"), capT = $(".nf-t"), last = -1;
    draw.addEventListener("click", function () {
      var i;
      do { i = Math.floor(Math.random() * PLATES.length); } while (i === last && PLATES.length > 1);
      last = i;
      var p = PLATES[i];
      img.hidden = false; ghost.hidden = true;
      img.classList.remove("drop"); void img.offsetWidth;
      img.src = A + "img/" + p.src + ".webp";
      img.alt = p.cap;
      if (!U.reduced) img.classList.add("drop");
      capT.innerHTML = "";
      capT.appendChild(document.createTextNode(p.cap + " · "));
      var a = document.createElement("a"); a.href = R + p.href; a.textContent = p.ch + " görün →";
      capT.appendChild(a);
      draw.firstChild.textContent = "Başka bir levha çekin ";
    });
  }

  U.refresh();
})();
