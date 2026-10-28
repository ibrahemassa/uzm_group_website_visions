/* Net · projects pages. Two small things site.js does not do: the photo strip (arrow buttons that page through it,
   and dragging it with a mouse; touch and trackpads scroll it natively), and a closer first view of the projects map
   on small screens (site.js reads data-zoom when the map is opened). */
(function () {
  "use strict";
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  Array.prototype.forEach.call(document.querySelectorAll("[data-map][data-zoom-sm]"), function (box) {
    if (innerWidth < 700) box.dataset.zoom = box.dataset.zoomSm;
  });

  Array.prototype.forEach.call(document.querySelectorAll("[data-strip]"), function (s) {
    var sec = s.closest("section");
    var nav = sec && sec.querySelector(".strip-nav");
    var prev = nav && nav.querySelector("[data-strip-prev]");
    var next = nav && nav.querySelector("[data-strip-next]");
    var step = function () {
      var li = s.querySelector("li");
      if (!li) return s.clientWidth * 0.8;
      var gap = parseFloat(getComputedStyle(li.parentNode).columnGap) || 0;
      return li.getBoundingClientRect().width + gap;
    };
    var update = function () {
      var max = s.scrollWidth - s.clientWidth - 2;
      prev.disabled = s.scrollLeft <= 2;
      next.disabled = s.scrollLeft >= max;
    };
    if (prev && next) {
      nav.hidden = false;
      prev.addEventListener("click", function () { s.scrollBy({ left: -step(), behavior: reduced ? "auto" : "smooth" }); });
      next.addEventListener("click", function () { s.scrollBy({ left: step(), behavior: reduced ? "auto" : "smooth" }); });
      s.addEventListener("scroll", update, { passive: true });
      addEventListener("resize", update);
      update();
    }

    // Mouse drag; a drag is never also a click (so it does not open the viewer)
    var down = false, moved = false, x0 = 0, l0 = 0;
    s.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      down = true; moved = false; x0 = e.clientX; l0 = s.scrollLeft;
    });
    addEventListener("pointermove", function (e) {
      if (!down) return;
      var dx = e.clientX - x0;
      if (!moved && Math.abs(dx) > 6) { moved = true; s.classList.add("dragging"); }
      if (moved) s.scrollLeft = l0 - dx;
    });
    addEventListener("pointerup", function () {
      if (!down) return;
      down = false;
      if (moved) s.classList.remove("dragging");
    });
    s.addEventListener("click", function (e) {
      if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
    }, true);
    s.addEventListener("dragstart", function (e) { e.preventDefault(); });
  });
})();
