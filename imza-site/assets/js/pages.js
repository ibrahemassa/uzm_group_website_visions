/* Company pages: the signature through the years (About), the envelope (Contact), the reading pen on the legal
   notices and the door on the 404. */
(function () {
  var U = window.UZM, $ = U.$, $$ = U.$$;

  /* Milestones: one pen line joins the years as they are read; each year lights as the pen reaches it, and the large
     year on the left rolls to it. */
  var ms = $("#ms");
  if (ms) {
    U.ink($(".ms-wrap"), { at: 0.6 });
    var items = $$("li", ms), roll = $(".ms-year .roll");
    if (U.reduced) {
      items.forEach(function (li) { li.classList.add("lit"); });
    } else {
      U.onScroll.push(function (y, vh) {
        var line = vh * 0.6, cur = 0;
        items.forEach(function (li, i) {
          var lit = li.getBoundingClientRect().top < line;
          li.classList.toggle("lit", lit);
          if (lit) cur = i;
        });
        if (roll) roll.style.setProperty("--i", cur);
      });
    }
  }

  /* Contact: the envelope opens once it has been in view for a moment, when its seal is pressed, or at once when
     anything in the letter takes focus. */
  var env = $(".letter-env");
  if (env) {
    var open = function () { if (!env.classList.contains("open")) { env.classList.add("open"); $(".env-seal", env).tabIndex = -1; } };
    if (!document.documentElement.classList.contains("motion")) open();
    $(".env-seal", env).addEventListener("click", function () { open(); var f = $("input", env); if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 900); });
    $(".letter", env).addEventListener("focusin", open);
    var t = 0;
    new IntersectionObserver(function (es) {
      clearTimeout(t);
      if (es[0].isIntersecting) t = setTimeout(open, 1400);
    }, { threshold: 0.2 }).observe(env);
  }

  /* Legal notices: the index marks the section being read, and a pen line in its margin measures the reading. */
  var toc = $(".legal .toc");
  if (toc) {
    var links = $$("a", toc), ol = $("ol", toc), doc = $(".doc");
    var secs = links.map(function (a) { return document.querySelector(a.getAttribute("href")); });
    U.onScroll.push(function (y, vh) {
      var cur = 0;
      secs.forEach(function (s, i) { if (s && s.getBoundingClientRect().top < vh * 0.4) cur = i; });
      links.forEach(function (a, i) { a.classList.toggle("on", i === cur); });
      var r = doc.getBoundingClientRect();
      ol.style.setProperty("--rp", U.clamp((vh * 0.4 - r.top) / Math.max(1, r.height - vh * 0.4), 0, 1).toFixed(3));
    });
  }

  /* 404: the door swings a little toward the pointer, as if someone had just left the room. */
  var door = $(".nf-door");
  if (door && U.fine && !U.reduced) {
    var leaf = $(".nf-leaf", door);
    addEventListener("pointermove", function (e) {
      var k = e.clientX / innerWidth;
      leaf.style.setProperty("--door", (-34 - k * 32).toFixed(1) + "deg");
    }, { passive: true });
  }

  U.relayout();
})();
