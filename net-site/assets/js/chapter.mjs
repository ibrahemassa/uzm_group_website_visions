/* Net · the home types chapter ([data-chapter] on the home). A tall section with a sticky stage: the live model of
   Levan fills the screen, the scroll chooses the step (overview, apartment blocks, semi-detached, detached, manors),
   the camera flies to frame that kind of home while it lights up, and the day moves from late morning to night as
   the reader goes down. The panel beside it holds the plans and areas. It plays only on a capable desktop with
   motion allowed; otherwise the section is a plain list of the same five cards with pictures (CSS: .ch-flat). */
const sec = document.querySelector("[data-chapter]");
if (sec) init();

async function init() {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wide = matchMedia("(min-width: 64rem)").matches;
  const conn = navigator.connection || {};
  const gl = (() => { try { return !!document.createElement("canvas").getContext("webgl2"); } catch (_) { return false; } })();
  const capable = wide && gl && !reduced && !conn.saveData && (navigator.deviceMemory || 8) >= 4;
  if (!capable) { sec.classList.add("ch-flat"); return; }
  sec.classList.add("ch-live");

  const steps = [...sec.querySelectorAll(".ch-step")], dots = [...sec.querySelectorAll(".ch-dots li")];
  const host = sec.querySelector(".ch-host");
  const N = steps.length;
  let cur = -1;
  let m = null, THREE = null, goal = null, view = null, base = null, studio = null;
  const show = (i) => {
    if (i === cur) return;
    cur = i;
    steps.forEach((s, j) => s.classList.toggle("on", j === i));
    dots.forEach((d, j) => d.classList.toggle("on", j === i));
    if (m) aim(i);
  };

  // scroll progress through the section → step
  const progress = () => {
    const r = sec.getBoundingClientRect();
    return Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
  };
  let p = 0;
  const onScroll = () => {
    p = progress();
    show(Math.min(N - 1, Math.floor(p * N * 0.999)));
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ── The model: loads once the chapter is near ── */
  const near = new IntersectionObserver(async (es) => {
    if (!es[0].isIntersecting) return;
    near.disconnect();
    try {
      THREE = await import("three");
      const { Maket, HOME_TARGET } = await import("./maket.mjs");
      m = await Maket.create(host, { url: new URL(sec.dataset.model, location.href).href });
      studio = new THREE.Color("#0b0b0c");
      base = { az: -2.3, el: 0.58, dist: 1120, fov: 26, target: HOME_TARGET.clone(), shift: 0.17, lift: 0.04 };
      goal = { ...base, target: base.target.clone() };
      view = { ...base, target: base.target.clone() };
      sec.classList.add("ch-ready");
      aim(Math.max(0, cur));
      new IntersectionObserver((x) => m.setVisible(x[0].isIntersecting)).observe(sec);
      requestAnimationFrame(loop);
    } catch (e) {
      console.warn("Net chapter: model unavailable", e);
      sec.classList.remove("ch-live");
      sec.classList.add("ch-flat");
    }
  }, { rootMargin: "120% 0px" });
  near.observe(sec);

  // each step frames its kind of home from a slightly different side, so the flight between them turns round the site
  function aim(i) {
    const kind = sec.querySelectorAll(".ch-step")[i].dataset.kind || null;
    m.setCategory(kind);
    const az = -2.3 + i * 0.42;
    goal = kind ? m.frame(kind, { az, el: 0.55, pad: 1.25, shift: 0.18, lift: 0.04 }) : { ...base, az, target: base.target.clone() };
  }

  let last = performance.now(), grown = 0, lastHour = -1;
  const wrap = (a) => ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!m.visible || document.hidden) return;
    // the homes rise from their foundations as the chapter begins, the day turns to night by its end
    grown = Math.max(grown, Math.min(1, p / 0.12 + 0.15));
    m.setGrow(grown);
    // relight only when the hour really moves: each change redraws the shadows
    const hour = 11 + Math.pow(p, 1.4) * 10.5;
    if (Math.abs(hour - lastHour) > 0.04) {
      m.setTime(hour, true);
      // the model stands in a dark studio rather than the paper-coloured room of the Maket concept
      m.scene.background = studio.clone().lerp(m.sky.bg, Math.max(0, m.sky.night - 0.3));
      lastHour = hour;
    }
    const k = 1 - Math.exp(-dt * 3.2);
    view.az += wrap(goal.az - view.az) * k;
    view.el += (goal.el - view.el) * k;
    view.dist += (goal.dist - view.dist) * k;
    view.shift += (goal.shift - view.shift) * k;
    view.lift += ((goal.lift || 0) - view.lift) * k;
    view.fov = goal.fov || 26;
    view.target.lerp(goal.target, k);
    m.setView(view);
  }
}
