/* Staff tool: an "Adjust art" button on each big card opens an editor where the whole picture can be dragged, resized
   from its corners, or swapped for another image. Only settings are saved (coaches.art_fit and art_url), so image files
   are never cropped or overwritten, and "Use original" always brings back the starting picture. */
(function () {
  const MIN = 0.3, MAX = 4, DEFAULT = { x: 0, y: 0, z: 1 }, MAX_MB = 5;
  const clamp = z => Math.min(MAX, Math.max(MIN, z));
  const round = n => Math.round(n * 100) / 100;

  const css = document.createElement("style");
  css.textContent =
    ".art-adjust-btn{position:absolute;right:8px;bottom:8px;z-index:5;font:600 11px/1 var(--f-display);color:#f4f4f2;background:#0b0e13;border:1px solid #5a606b;border-radius:4px;padding:6px 8px;cursor:pointer}" +
    ".art-adjust-icon{right:84px}" +
    "#art-editor{width:min(720px,94vw);padding:0;border:1px solid #3a3f49;border-radius:10px;background:#0b0e13;color:#f4f4f2;font:500 14px/1.35 var(--f-display)}" +
    "#art-editor::backdrop{background:rgba(0,0,0,.72)}" +
    ".ae-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 16px}" +
    ".ae-head h2{margin:0;font:800 18px/1.2 var(--f-display)}" +
    ".ae-stage{position:relative;height:520px;overflow:hidden;background-color:#1a1a1d;background-image:linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px);background-size:24px 24px;cursor:move;touch-action:none;user-select:none}" +
    ".ae-stage:focus-visible{outline:2px solid #f2c94c;outline-offset:-2px}" +
    ".ae-img{position:absolute;max-width:none;pointer-events:none}" +
    ".ae-frame{position:absolute;box-shadow:0 0 0 2000px rgba(11,14,19,.68);outline:2px solid #d6403a;pointer-events:none}" +
    ".ae-box{position:absolute;outline:1px solid #f4f4f2;pointer-events:none}" +
    ".ae-h{position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;background:#f4f4f2;border:2px solid #0b0e13;border-radius:2px;touch-action:none}" +
    '.ae-h::after{content:"";position:absolute;inset:-8px}' +
    ".ae-empty{position:absolute;inset:0;display:grid;place-items:center;color:#f4f4f2;pointer-events:none}" +
    ".ae-foot{display:grid;gap:10px;padding:12px 16px}" +
    ".ae-foot p{margin:0;color:#b3b3b8;font-size:13px}" +
    ".ae-btns{display:flex;flex-wrap:wrap;gap:8px}" +
    ".ae-btns .ae-end{margin-left:auto}" +
    ".ae-btns button{font:600 13px/1 var(--f-display);color:#f4f4f2;background:#1d2129;border:1px solid #3a3f49;border-radius:5px;padding:10px 12px;cursor:pointer}" +
    ".ae-btns button:disabled{opacity:.45;cursor:default}" +
    ".ae-btns .ae-save{background:#d6403a;border-color:#d6403a}" +
    "@media (max-width:640px){.ae-stage{height:440px}.art-adjust-icon{right:8px;bottom:40px}}";
  document.head.appendChild(css);

  function open(card, head) {
    const id = card.dataset.coach, seed = PTG.coachSeed.find(x => x.id === id) || {}, coach = Object.assign({}, seed, card.__coach);
    const original = ((head ? PTG.artHead : PTG.art) || {})[id] || "";
    const fit = Object.assign({}, DEFAULT, head ? UI.headFit(id, coach) : UI.artFit(id, coach));
    const arWin = head ? 1 : card.offsetWidth / card.offsetHeight, anchorY = head ? 0.5 : 0.18;
    let src = head ? UI.headSrc(coach) : UI.artSrc(coach), file = null, urlChange = false, objectUrl = "";

    const d = document.createElement("dialog");
    d.id = "art-editor";
    d.setAttribute("aria-label", "Adjust art");
    d.innerHTML = '<div class="ae-head"><h2></h2><span data-size></span></div>' +
      '<div class="ae-stage" tabindex="0" aria-label="Picture position. Arrow keys move it, plus and minus resize it."><img class="ae-img" alt=""><div class="ae-frame"></div><div class="ae-box"></div>' +
      ["tl", "tr", "bl", "br"].map(k => '<div class="ae-h" data-h="' + k + '" style="cursor:' + (k === "tl" || k === "br" ? "nwse" : "nesw") + '-resize"></div>').join("") +
      '<div class="ae-empty">No picture yet. Choose one below.</div></div>' +
      '<div class="ae-foot"><p>Drag to move. Pull a corner to resize. The red box is what shows on the card. PNG, JPG or WebP, up to ' + MAX_MB + ' MB.</p>' +
      '<div class="ae-btns"><button type="button" data-change>Change image</button><button type="button" data-original>Use original</button><button type="button" data-reset>Reset position</button>' +
      '<button type="button" class="ae-end" data-cancel>Cancel</button><button type="button" class="ae-save" data-save>Save</button></div>' +
      '<input type="file" accept="image/png,image/jpeg,image/webp" hidden data-file aria-label="Choose an image"></div>';
    document.body.appendChild(d);
    const $ = s => d.querySelector(s), stage = $(".ae-stage"), pic = $(".ae-img");
    $("h2").textContent = (head ? "Adjust icon: " : "Adjust art: ") + (seed.name || id);
    const finish = () => { if (objectUrl) URL.revokeObjectURL(objectUrl); if (d.open) d.close(); d.remove(); };
    d.addEventListener("close", finish);
    d.showModal();

    // positions below are in "card space"; the view (k, ox, oy) zooms out so the whole picture and its corners stay on screen
    const H = 420, W = H * arWin, fx = 0, fy = 0, MARGIN = 28;
    let k = 1, ox = 0, oy = 0, refit = 0;
    let coverW = W, coverH = H;

    const rect = (f = fit) => {
      const ax = fx + W * (0.5 + f.x / 100), ay = fy + H * (anchorY + f.y / 100), w = f.z * coverW, h = f.z * coverH;
      return { l: ax - 0.5 * w, t: ay - anchorY * h, w, h };
    };
    const place = (l, t, z) => {   // puts the picture's top-left at (l, t) at size z
      fit.z = z;
      fit.x = (l + 0.5 * z * coverW - fx) / W * 100 - 50;
      fit.y = (t + anchorY * z * coverH - fy) / H * 100 - anchorY * 100;
    };
    function fitView() {
      const r = src ? rect() : { l: fx, t: fy, w: W, h: H };
      const x0 = Math.min(fx, r.l), y0 = Math.min(fy, r.t), x1 = Math.max(fx + W, r.l + r.w), y1 = Math.max(fy + H, r.t + r.h);
      // the window grows with the picture, up to the size of the screen
      const baseH = innerWidth <= 640 ? 440 : 520;
      d.style.width = Math.min(innerWidth * 0.96, Math.max(720, x1 - x0 + 2 * MARGIN)) + "px";
      const roomH = innerHeight - 210;   // leaves space for the title and buttons
      stage.style.height = Math.max(Math.min(baseH, roomH), Math.min(roomH, y1 - y0 + 2 * MARGIN)) + "px";
      const sw = stage.clientWidth, sh = stage.clientHeight;
      k = Math.min(1.1, (sw - 2 * MARGIN) / (x1 - x0), (sh - 2 * MARGIN) / (y1 - y0));
      ox = (sw - k * (x1 - x0)) / 2 - k * x0;
      oy = (sh - k * (y1 - y0)) / 2 - k * y0;
    }
    function draw() {
      const has = !!src, r = rect(), sx = ox + k * r.l, sy = oy + k * r.t, sw = k * r.w, sh = k * r.h;
      const box = { left: sx + "px", top: sy + "px", width: sw + "px", height: sh + "px" };
      Object.assign($(".ae-frame").style, { left: ox + k * fx + "px", top: oy + k * fy + "px", width: k * W + "px", height: k * H + "px" });
      pic.hidden = $(".ae-box").hidden = !has;
      $(".ae-empty").hidden = has;
      Object.assign(pic.style, box);
      Object.assign($(".ae-box").style, box);
      d.querySelectorAll(".ae-h").forEach(h => {
        h.hidden = !has;
        h.style.left = (h.dataset.h[1] === "l" ? sx : sx + sw) + "px";
        h.style.top = (h.dataset.h[0] === "t" ? sy : sy + sh) + "px";
      });
      $("[data-size]").textContent = has ? Math.round(fit.z * 100) + "%" : "";
      $("[data-reset]").disabled = !has;
      $("[data-original]").disabled = src === original;
      $("[data-save]").disabled = !has && !urlChange;
    }
    const fitAndDraw = () => { fitView(); draw(); };
    function show(next) {
      src = next;
      if (!src) { pic.removeAttribute("src"); fitAndDraw(); return; }
      pic.onload = () => {
        const ar = pic.naturalWidth / pic.naturalHeight;
        coverW = Math.max(W, H * ar);
        coverH = coverW / ar;
        fitAndDraw();
      };
      pic.src = src;
    }

    const point = e => { const b = stage.getBoundingClientRect(); return { x: (e.clientX - b.left - ox) / k, y: (e.clientY - b.top - oy) / k }; };
    const zoomAt = (p, z) => {
      z = clamp(z);
      const r = rect(), k = z / fit.z;
      place(p.x - (p.x - r.l) * k, p.y - (p.y - r.t) * k, z);
      draw();
    };

    stage.addEventListener("pointerdown", e => {
      if (e.button !== 0 || !src) return;
      e.preventDefault();
      stage.focus({ preventScroll: true });
      stage.setPointerCapture(e.pointerId);
      const handle = e.target.closest("[data-h]"), k = handle && handle.dataset.h, r0 = rect(), p0 = point(e);
      const fixedX = k && (k[1] === "l" ? r0.l + r0.w : r0.l), fixedY = k && (k[0] === "t" ? r0.t + r0.h : r0.t);
      const move = ev => {
        const p = point(ev);
        if (!k) place(r0.l + p.x - p0.x, r0.t + p.y - p0.y, fit.z);
        else {
          const z = clamp(Math.max(Math.abs(p.x - fixedX) / coverW, Math.abs(p.y - fixedY) / coverH));
          place(k[1] === "l" ? fixedX - z * coverW : fixedX, k[0] === "t" ? fixedY - z * coverH : fixedY, z);
        }
        draw();
      };
      const up = () => { stage.removeEventListener("pointermove", move); stage.removeEventListener("pointerup", up); stage.removeEventListener("pointercancel", up); fitAndDraw(); };
      stage.addEventListener("pointermove", move);
      stage.addEventListener("pointerup", up);
      stage.addEventListener("pointercancel", up);
    });
    stage.addEventListener("wheel", e => { if (!src) return; e.preventDefault(); zoomAt(point(e), fit.z * (1 - e.deltaY * 0.001)); clearTimeout(refit); refit = setTimeout(fitAndDraw, 250); }, { passive: false });
    stage.addEventListener("keydown", e => {
      if (!src) return;
      const step = e.shiftKey ? 5 : 1, center = { x: fx + W / 2, y: fy + H / 2 };
      const keys = { ArrowLeft: () => fit.x -= step, ArrowRight: () => fit.x += step, ArrowUp: () => fit.y -= step, ArrowDown: () => fit.y += step, "+": () => zoomAt(center, fit.z * 1.05), "=": () => zoomAt(center, fit.z * 1.05), "-": () => zoomAt(center, fit.z / 1.05) };
      if (!keys[e.key]) return;
      e.preventDefault();
      keys[e.key]();
      fitAndDraw();
    });

    $("[data-change]").addEventListener("click", () => $("[data-file]").click());
    $("[data-file]").addEventListener("change", e => {
      const f = e.target.files[0];
      e.target.value = "";
      if (!f) return;
      if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) return UI.toast("Choose a PNG, JPG or WebP image.", "bad");
      if (f.size > MAX_MB * 1024 * 1024) return UI.toast("That image is over " + MAX_MB + " MB. Choose a smaller one.", "bad");
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(f);
      file = f;
      urlChange = true;
      Object.assign(fit, DEFAULT);
      show(objectUrl);
    });
    $("[data-original]").addEventListener("click", () => { file = null; urlChange = true; Object.assign(fit, DEFAULT); show(original); });
    $("[data-reset]").addEventListener("click", () => { Object.assign(fit, DEFAULT); fitAndDraw(); });
    $("[data-cancel]").addEventListener("click", finish);
    $("[data-save]").addEventListener("click", e => UI.act(e.currentTarget, async () => {
      const saved = { x: round(fit.x), y: round(fit.y), z: round(fit.z) }, urlKey = head ? "head_url" : "art_url", local = (head ? "head:" : "") + id;
      const patch = { [head ? "head_fit" : "art_fit"]: saved };
      let finalSrc = src;
      if (file) { finalSrc = await API.uploadArt(id, file); patch[urlKey] = finalSrc; }
      else if (urlChange) patch[urlKey] = null;
      await API.updateCoach(id, patch);
      UI.artLocal[local] = saved;
      UI.artSrcLocal[local] = finalSrc;
      if (head) document.querySelectorAll('.mb-icon[data-head="' + id + '"]').forEach(a => { a.outerHTML = UI.headIcon(coach, seed.name || id); });
      else document.querySelectorAll('.b-art[data-coach="' + id + '"]').forEach(a => { a.innerHTML = UI.art(coach); });
      finish();
    }, "Art saved."));

    show(src);
    stage.focus({ preventScroll: true });
  }

  let coaches = [];
  function addButtons() {
    document.querySelectorAll(".badge .b-art[data-coach]").forEach(card => {
      if (card.querySelector(".art-adjust-btn")) return;
      card.__coach = coaches.find(c => c.id === card.dataset.coach);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "art-adjust-btn";
      b.textContent = "Adjust art";
      b.addEventListener("click", () => open(card));
      card.appendChild(b);
      if ((card.__coach || {}).kind === "assistant") {
        const i = document.createElement("button");
        i.type = "button";
        i.className = "art-adjust-btn art-adjust-icon";
        i.textContent = "Adjust icon";
        i.addEventListener("click", () => open(card, true));
        card.appendChild(i);
      }
    });
  }

  Promise.all([API.session(), API.coaches()]).then(([me, list]) => {
    if (!me || me.role !== "staff") return;
    coaches = list;
    addButtons();
    new MutationObserver(addButtons).observe(document.body, { childList: true, subtree: true });
  }).catch(() => {});
})();
