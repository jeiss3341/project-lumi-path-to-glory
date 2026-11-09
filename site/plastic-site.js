/* The plastic sleeve on the lanyard card: draws the card sharply once it has swung in. */
(function () {
  const root = document.documentElement;
  /* The swing-in needs the card on its own graphics layer, which softens it. Once it has landed, the card is drawn
     normally so it's as sharp as the Faculty card. */
  const settle = () => { root.dataset.plasticSettled = ""; };
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
