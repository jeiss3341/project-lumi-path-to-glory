/* Preview only: the picker for plastic-site.html */
(function () {
  if (!("plasticPreview" in document.documentElement.dataset)) return;   // never on the live addresses
  const styles = [["none", "No plastic"], ["a", "1. Clear sleeve"], ["b", "2. Laminated"], ["c", "3. Hard holder"], ["d", "4. Worn vinyl"]];
  const box = document.createElement("div");
  box.id = "plastic-pick";
  box.innerHTML = "<b>Plastic preview</b>" + styles.map(s => '<button type="button" data-s="' + s[0] + '">' + s[1] + "</button>").join("");
  document.body.appendChild(box);
  function paint() {
    const now = document.documentElement.dataset.plastic || "none";
    box.querySelectorAll("button[data-s]").forEach(b => b.setAttribute("aria-pressed", b.dataset.s === now));
  }
  box.addEventListener("click", e => {
    const b = e.target.closest("button[data-s]");
    if (!b) return;
    if (b.dataset.s === "none") delete document.documentElement.dataset.plastic;
    else document.documentElement.dataset.plastic = b.dataset.s;
    try { localStorage.setItem("ptg-plastic", b.dataset.s); } catch (err) {}
    paint();
  });
  paint();

  /* The swing-in needs the card on its own graphics layer, which softens it. Once it has landed, the card is drawn
     normally so it's as sharp as the Faculty card. */
  const settle = () => { document.documentElement.dataset.plasticSettled = ""; };
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return settle();
  const holder = document.getElementById("hero-badge");
  if (!holder) return;
  let moving = false;
  const watch = new MutationObserver(() => {
    if (holder.style.transform) moving = true;
    else if (moving) { watch.disconnect(); settle(); }
  });
  watch.observe(holder, { attributes: true, attributeFilter: ["style"] });
})();
