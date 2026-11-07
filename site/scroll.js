/* Path to Glory · smooth scroll for in-page links (top bar, ticket, footer, "Request ›", mentor names).
   Cinematic feel: slow start, slow finish, 1.075 s.
   Time-based, so it runs the same speed at 60, 120 or 144 Hz and catches up after a dropped frame.
   Stops if the reader grabs the page (wheel, touch, keys), honours reduced motion, and lands
   below the sticky top bar (html's scroll-padding-top). */
(function () {
  "use strict";

  const DURATION = 1075;   // ms
  const ease = t => t < .5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;   // ease-in-out quint

  const reduced = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const offset = () => parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
  const maxY = () => document.documentElement.scrollHeight - innerHeight;

  let run = null;   // the scroll in progress
  function cancel() { if (run) { cancelAnimationFrame(run.raf); run = null; } }
  ["wheel", "touchstart", "keydown", "mousedown"].forEach(ev => addEventListener(ev, e => {
    if (run && !(ev === "mousedown" && e.target.closest && e.target.closest("a[href^='#']"))) cancel();
  }, { passive: true }));

  // scroll so `el` sits just under the top bar
  function to(el) {
    if (!el) return Promise.resolve();
    cancel();
    const from = scrollY;
    const target = Math.max(0, Math.min(maxY(), el.getBoundingClientRect().top + scrollY - offset()));
    if (reduced() || Math.abs(target - from) < 2) { scrollTo(0, target); return Promise.resolve(); }
    return new Promise(done => {
      const t0 = performance.now();
      run = { raf: 0 };
      const step = now => {
        if (!run) return done();
        const t = Math.min(1, (now - t0) / DURATION);
        scrollTo(0, from + (target - from) * ease(t));
        if (t < 1) run.raf = requestAnimationFrame(step);
        else { run = null; done(); }
      };
      run.raf = requestAnimationFrame(step);
    });
  }

  // every same-page link: #section or index.html#section while on index.html
  document.addEventListener("click", e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest("a[href*='#']");
    if (!a || a.target === "_blank") return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search || !url.hash || url.hash === "#") return;
    const el = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (!el) return;
    e.preventDefault();
    if (location.hash !== url.hash) history.pushState(null, "", url.hash);
    to(el).then(() => {
      // move keyboard focus to the section without jumping again
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
      el.focus({ preventScroll: true });
    });
  });

  window.PTGScroll = { to };
})();
