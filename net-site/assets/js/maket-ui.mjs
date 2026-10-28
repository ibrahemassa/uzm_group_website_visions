/* Maket · the parts of the model's interface that every page shares: what to call a home, the inspector card for a
   home picked up off the model, a close view of it, and the pointer (drag to turn, hover to lift a little, click to
   pick up). */
import * as THREE from "three";

export const KIND = {
  daire: { one: "Daire bloğu", many: "Daire blokları", type: "Daire" },
  ikiz: { one: "4+1 İkiz villa", many: "İkiz villalar", type: "Villa" },
  villa: { one: "5+1 Müstakil villa", many: "Müstakil villalar", type: "Villa" },
  malikane: { one: "6+1 Malikane", many: "Malikâneler", type: "Malikane" },
};

/** What a model node is called on screen: a block by its letter, a plot by its kind (plot numbers stay internal) */
export const nameOf = (n) => (n.kind === "daire" ? n.name.replace("block_", "") + " bloğu" : KIND[n.kind].one);

/** The home of a kind nearest the middle of that kind (the one the type buttons pick up) */
export function representative(m, kind) {
  const list = m.ofKind(kind), c = m.boxOf(kind).getCenter(new THREE.Vector3());
  return list.reduce((best, x) => (x.center.distanceTo(c) < best.center.distanceTo(c) ? x : best), list[0]);
}

/** A close view of one home from the side the camera already looks from */
export function closeView(n, { az = -2.2, phone = false, shift = 0.02 } = {}) {
  const size = Math.max(n.size.x, n.size.z, n.size.y);
  const lifted = Math.max(14, n.size.y * 1.15);
  return {
    az, el: n.kind === "daire" ? 0.42 : 0.5, fov: 26,
    dist: Math.max(150, size * (n.kind === "daire" ? 4.6 : 7.5)) * (phone ? 1.5 : 1),
    target: new THREE.Vector3(n.center.x, n.box.min.y + n.size.y * 0.5 + lifted * 0.6, n.center.z),
    shift: phone ? 0 : shift, lift: phone ? 0.26 : 0,
  };
}

/** Fill the inspector card for a picked-up home. U = window.UZM (types, plan sheets, dialogs). */
export function fillInspector(el, n, U) {
  const T = U.TYPES || [];
  const where = el.querySelector(".ins-where"), title = el.querySelector(".ins-title"), body = el.querySelector(".ins-body");
  if (n.kind === "daire") {
    where.textContent = "Maketten seçtiniz · Daire bloğu";
    title.textContent = nameOf(n);
    const flats = T.filter((x) => x.kind === "daire");
    body.innerHTML = `<p>Bloklarda 2+1, 3+1 ve 4+1 daireler; peyzajlı iç avlular ve bahçe kullanımlı zemin katlar.</p>
      <ul class="ins-types">${flats.map((x) => `<li><div><b>${x.title}</b><span>Net ${x.net} m² · Brüt ${x.gross} m²</span></div><button class="btn btn-line btn-sm" type="button" data-plan-of="${x.key}">Plan<span class="sr">: ${x.title}</span></button></li>`).join("")}</ul>`;
  } else {
    const x = T.find((y) => y.kind === n.kind);
    where.textContent = "Maketten seçtiniz · " + KIND[n.kind].type;
    title.textContent = x.title;
    body.innerHTML = `<div class="ins-pic"><img src="${U.assets}img/${x.pic}.webp" alt="${x.title}, görselleştirme" loading="lazy"></div>
      <p>${x.blurb}</p>
      <dl class="areas"><div><dt>Net</dt><dd class="num">${x.net} <small>m²</small></dd></div><div><dt>Brüt</dt><dd class="num">${x.gross} <small>m²</small></dd></div>${x.garden ? `<div><dt>Bahçe</dt><dd class="num">${x.garden} <small>m²</small></dd></div>` : ""}</dl>
      <div class="btns"><button class="btn btn-ink btn-sm" type="button" data-plan-of="${x.key}">Kat ${x.sheets.length > 1 ? "planları" : "planı"}</button><button class="btn btn-line btn-sm" type="button" data-open-visit>Randevu alın</button></div>`;
  }
  body.querySelectorAll("[data-plan-of]").forEach((bt) => bt.addEventListener("click", () => {
    const x = T.find((y) => y.key === bt.dataset.planOf);
    U.openPlan({ title: x.title, sheets: x.sheets }, bt);
  }));
  body.querySelector("[data-open-visit]")?.addEventListener("click", (e) => U.openDialog(document.getElementById("visit"), e.currentTarget));
}

/**
 * Pointer on the model's canvas. Drags turn it (horizontal on touch, so vertical swipes still scroll the page);
 * a still click or tap picks; a mouse hovering resolves the home under it once per frame.
 *   attachPointer(m, canvas, { onDrag(dx, dy), onPick(node|null, e), onHover(node|null, x, y), dragY })
 */
export function attachPointer(m, canvas, h) {
  const fine = matchMedia("(pointer: fine)").matches;
  let down = null, moved = 0, last = null, hoverQ = null, dragging = false;
  canvas.addEventListener("pointerdown", (e) => {
    down = { x: e.clientX, y: e.clientY, id: e.pointerId, type: e.pointerType };
    moved = 0; last = { x: e.clientX, y: e.clientY };
    h.onDown?.();
  });
  addEventListener("pointermove", (e) => {
    if (down && e.pointerId === down.id) {
      moved = Math.max(moved, Math.hypot(e.clientX - down.x, e.clientY - down.y));
      const horiz = Math.abs(e.clientX - down.x) > Math.abs(e.clientY - down.y);
      if (moved > 5 && (down.type === "mouse" || horiz || h.dragY)) {
        if (!dragging) { dragging = true; h.onDragStart?.(); try { canvas.setPointerCapture(down.id); } catch (_) {} }
        h.onDrag?.(e.clientX - last.x, e.clientY - last.y);
        last = { x: e.clientX, y: e.clientY };
      }
      return;
    }
    if (e.pointerType !== "mouse" || !fine) return;
    if (e.target !== canvas) { if (m.hovered) { m.setHover(null); h.onHover?.(null); } return; }
    hoverQ = { x: e.clientX, y: e.clientY };
  });
  const end = (e) => {
    if (!down || e.pointerId !== down.id) return;
    const was = dragging;
    dragging = false;
    if (was) h.onDragEnd?.();
    else if (moved < 6) h.onPick?.(m.pick(e.clientX, e.clientY), e);
    down = null;
  };
  addEventListener("pointerup", end);
  addEventListener("pointercancel", end);
  // each pick reads a pixel back from the GPU, so hover is resolved at most about twelve times a second
  let lastPick = 0;
  const loop = (now) => {
    requestAnimationFrame(loop);
    if (!hoverQ || dragging || now - lastPick < 80) return;
    lastPick = now;
    const q = hoverQ; hoverQ = null;
    const n = m.pick(q.x, q.y);
    m.setHover(n);
    h.onHover?.(n, q.x, q.y);
  };
  requestAnimationFrame(loop);
  return { get dragging() { return dragging; } };
}
