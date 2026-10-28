/* Sergi · the company rooms: the chronology wall, the raking light on the tablets, the letter board on the legal
   notices, and the visitor's ticket whose stub is torn off when the (demo) letter is sent. */
(function () {
  "use strict";
  var U = window.UZM, $ = U.$, $$ = U.$$, clamp = U.clamp;

  /* The chronology wall: the line fills, each year lights as it reaches the reading line, the large year rolls. */
  var ms = $("#ms");
  if (ms) {
    var items = $$("li", ms), roll = $(".ms-year .roll");
    if (U.reduced) { ms.style.setProperty("--tl", 1); items.forEach(function (li) { li.classList.add("lit"); }); }
    else U.loop.push(function (y, vh) {
      var r = ms.getBoundingClientRect();
      if (r.bottom < -vh || r.top > vh * 2) return;
      var line = vh * 0.6, cur = 0;
      ms.style.setProperty("--tl", clamp((line - r.top) / r.height).toFixed(3));
      items.forEach(function (li, i) { var lit = li.getBoundingClientRect().top < line; li.classList.toggle("lit", lit); if (lit) cur = i; });
      if (roll) roll.style.setProperty("--i", cur);
    });
  }

  /* The tablets: a raking light follows the pointer across the letters. */
  if (U.fine && !U.reduced) $$(".tablet").forEach(function (t) {
    t.addEventListener("pointermove", function (e) { var r = t.getBoundingClientRect(); t.style.setProperty("--lx", ((e.clientX - r.left) / r.width) * 100 + "%"); });
  });

  /* The letter board on the legal notices marks the section being read. */
  var board = $(".board");
  if (board) {
    var links = $$("a", board);
    var secs = links.map(function (a) { return document.querySelector(a.getAttribute("href")); });
    var last = -1;
    U.loop.push(function (y, vh) {
      var cur = 0;
      secs.forEach(function (s, i) { if (s && s.getBoundingClientRect().top < vh * 0.4) cur = i; });
      if (cur === last) return;
      last = cur;
      links.forEach(function (a, i) { a.classList.toggle("on", i === cur); if (i === cur) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current"); });
    });
  }

  /* The ticket: on sending, its stub is torn off. */
  var ticket = $(".ticket");
  if (ticket) ticket.addEventListener("uzm:sent", function () { ticket.classList.add("torn"); });
})();
