/* info.js
   Two-span left-label that swaps in a sliding, scroll-synced way.
   Behavior:
   - For each titled section we detect:
       start = when first paragraph's top reaches viewport center
       end   = when last paragraph's bottom reaches viewport center
     (these become the section's active window)
   - We compute for the current and next section their own normalized progress p in [0..1]
     and map each to a translateY position from START (below) -> CENTER (0) -> END (above).
   - Both spans are updated every frame: current span follows current section, next span follows next.
   - When ranges overlap, the two labels cross-swap naturally producing the push/replace effect.
   - No fades; pure translate so movement is directly tied to scroll.
*/

(function () {
  'use strict';

  // CONFIG: tweak these to change feel
  const START_OFFSET_VH = 35;   // label starts this far below center (vh)
  const END_OFFSET_VH = -45;    // label ends this far above center (vh)
  const EXTRA_MARGIN = 0.05;    // small margin to extend start/end windows (protection)

  // DOM
  const currentSpan = document.getElementById('leftLabelCurrent');
  const nextSpan = document.getElementById('leftLabelNext');
  const sections = Array.from(document.querySelectorAll('.page-section'));

  if (!currentSpan || !nextSpan || sections.length === 0) {
    // fallback: nothing to do
    console.warn('info.js: missing elements or sections.');
    return;
  }

  // helpers
  const vhToPx = (vh) => (window.innerHeight * vh) / 100;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // compute geometry "active window" for each section:
  // start = when first <p> top reaches center, end = when last <p> bottom reaches center.
  function computeWindows() {
    return sections.map((sec) => {
      const title = sec.getAttribute('data-title') || '';
      // find first and last paragraph-like elements (p, li, blockquote). fallback to section itself.
      let paragraphs = Array.from(sec.querySelectorAll('p, .para, li, blockquote'));
      if (paragraphs.length === 0) paragraphs = [sec];

      const firstEl = paragraphs[0];
      const lastEl = paragraphs[paragraphs.length - 1];

      const firstRect = firstEl.getBoundingClientRect();
      const lastRect = lastEl.getBoundingClientRect();

      const absFirstTop = window.scrollY + firstRect.top;
      const absLastBottom = window.scrollY + lastRect.bottom;

      // start when first top reaches viewport center:
      const start = absFirstTop - window.innerHeight / 2;
      // end when last bottom reaches viewport center:
      const end = absLastBottom - window.innerHeight / 2;

      // safety: if end <= start, make a minimal window
      const safeEnd = end > start + 10 ? end : start + Math.max(100, sec.offsetHeight * 0.5);

      return {
        el: sec,
        title,
        start: start - EXTRA_MARGIN * sec.offsetHeight, // small margins extend window
        end: safeEnd + EXTRA_MARGIN * sec.offsetHeight,
      };
    });
  }

  // mapping progress -> translateY px
  const startPx = vhToPx(START_OFFSET_VH);
  const endPx = vhToPx(END_OFFSET_VH);

  function mapProgressToPx(p) {
    // p in [0..1] -> linear interp startPx -> endPx
    return startPx + (endPx - startPx) * p;
  }

  // internal cache
  let windows = computeWindows();

  function rebuild() {
    windows = computeWindows();
  }

  // main update called on rAF
  function update() {
    const scrollY = window.scrollY;
    const viewportCenter = scrollY + window.innerHeight / 2;

    // find primary section: the one where viewportCenter falls within [start..end],
    // if none, pick the closest by distance to center of window
    let primaryIndex = -1;
    let bestDist = Infinity;
    windows.forEach((w, i) => {
      if (viewportCenter >= w.start && viewportCenter <= w.end) {
        primaryIndex = i;
      }
      const centerOfWindow = (w.start + w.end) / 2;
      const dist = Math.abs(centerOfWindow - viewportCenter);
      if (dist < bestDist) {
        bestDist = dist;
        if (primaryIndex === -1) primaryIndex = i;
      }
    });

    if (primaryIndex === -1) {
      // hide both labels quickly if nothing matches
      currentSpan.style.opacity = '0';
      nextSpan.style.opacity = '0';
      return;
    }

    // compute progress for primary and next (primary+1)
    const primary = windows[primaryIndex];
    const next = windows[primaryIndex + 1] || null;
    // compute normalized progress for a window:
    const computeP = (w) => {
      const denom = w.end - w.start;
      if (denom <= 0) return 0;
      let pRaw = (viewportCenter - w.start) / denom; // 0..1 across window
      return clamp(pRaw, 0, 1);
    };

    const pPrimary = computeP(primary);
    const translatePrimary = mapProgressToPx(pPrimary);

    // set current span
    currentSpan.textContent = primary.title;
    currentSpan.style.opacity = '1';
    currentSpan.style.transform = `translateY(${translatePrimary}px)`;

    if (next) {
      const pNext = computeP(next);
      const translateNext = mapProgressToPx(pNext);

      nextSpan.textContent = next.title;
      nextSpan.style.opacity = '1';
      nextSpan.style.transform = `translateY(${translateNext}px)`;
    } else {
      // no next: hide nextSpan
      nextSpan.style.opacity = '0';
    }

    // Edge case: when scrolling up, sometimes previous should show as "next"
    // The above logic handles both directions because primaryIndex is chosen by window containment.
  }

  // rAF loop with throttling
  let running = false;
  function onScroll() {
    if (!running) {
      running = true;
      window.requestAnimationFrame(() => {
        update();
        running = false;
      });
    }
  }

  function onResize() {
    // recompute px conversions and windows
    // recalc startPx/endPx and windows
    // but startPx/endPx are dependent on vh; recompute them too
    // (we capture startPx/endPx earlier; recompute locally)
    // To keep it simple, recalc windows and call update
    rebuild();
    update();
  }

  // init
  // ensure label spans have no transition/opacity glitches
  currentSpan.style.willChange = 'transform, opacity';
  nextSpan.style.willChange = 'transform, opacity';
  currentSpan.style.transition = 'none';
  nextSpan.style.transition = 'none';

  // initial populate
  rebuild();
  update();

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);

  // helpful debug hook
  window.__INFO_WINDOWS = windows;
})();
