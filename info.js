// info.js
// Scroll-synced left label for the information page.
// - Label rises from below to center, holds while the section is centered,
//   then rises out in sync as the section finishes.
// - Reverses smoothly when scrolling up.
// - Sections are expected to be marked with <section class="page-section" data-title="...">

(function () {
  // CONFIG — tweak these to change timing/feel
  const HOLD_START = 0.18;   // when section progress reaches this (0..1) label is centered
  const HOLD_END = 0.82;     // when section progress passes this label starts to exit
  const START_OFFSET_VH = 35; // label starts this many VH below center
  const END_OFFSET_VH = -45;  // label ends this many VH above center
  const PROGRESS_CLAMP_MIN = -0.25;
  const PROGRESS_CLAMP_MAX = 1.25;

  // Elements
  const labelEl = document.getElementById('leftLabel'); // must exist in HTML
  const sections = Array.from(document.querySelectorAll('.page-section'));

  if (!labelEl || sections.length === 0) {
    // nothing to do
    return;
  }

  // Helpers
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (t) => t * t * (3 - 2 * t); // smoothstep
  const vhToPx = (vh) => (window.innerHeight * vh) / 100;

  // Performance: caching sizes per section (recomputed on resize)
  let cache = [];

  function rebuildCache() {
    cache = sections.map((sec) => {
      const rect = sec.getBoundingClientRect();
      const top = window.scrollY + rect.top;
      const height = Math.max(1, rect.height);
      const title = sec.getAttribute('data-title') || '';
      return { el: sec, top, height, title };
    });
  }

  // Update label text visibility & position based on scroll
  function update() {
    const viewportCenterY = window.scrollY + window.innerHeight / 2;

    // Find the best candidate section:
    // Prefer a section whose progress p is within [0,1]; otherwise pick the closest by progress to 0.5
    let chosen = null;
    let chosenIndex = -1;
    let bestDistance = Infinity;

    for (let i = 0; i < cache.length; i++) {
      const { top, height } = cache[i];
      const pRaw = (viewportCenterY - top) / height;
      const p = clamp(pRaw, PROGRESS_CLAMP_MIN, PROGRESS_CLAMP_MAX);

      if (p >= 0 && p <= 1) {
        // good candidate, pick this immediately (closest to exact)
        chosen = cache[i];
        chosenIndex = i;
        break;
      } else {
        // keep nearest to 0.5 as fallback
        const dist = Math.abs(p - 0.5);
        if (dist < bestDistance) {
          bestDistance = dist;
          chosen = cache[i];
          chosenIndex = i;
        }
      }
    }

    if (!chosen || !chosen.title) {
      // hide label if no valid section or title
      labelEl.classList.remove('visible');
      // reset transform so it's not left floating oddly
      labelEl.style.transform = '';
      return;
    }

    // Ensure label shows the chosen title
    if (labelEl.textContent !== chosen.title) {
      labelEl.textContent = chosen.title;
    }
    labelEl.classList.add('visible');

    // Compute progress p for chosen section
    const sTop = chosen.top;
    const sHeight = chosen.height;
    let p = (viewportCenterY - sTop) / sHeight;
    p = clamp(p, PROGRESS_CLAMP_MIN, PROGRESS_CLAMP_MAX);

    // Map p to translateY in px
    const startPx = vhToPx(START_OFFSET_VH); // positive: below center
    const endPx = vhToPx(END_OFFSET_VH);     // negative: above center

    let translateYpx = 0;

    if (p < HOLD_START) {
      // approaching the center: animate from startPx -> 0
      let t = clamp(p / HOLD_START, 0, 1);
      t = ease(t);
      translateYpx = startPx + (0 - startPx) * t;
    } else if (p >= HOLD_START && p <= HOLD_END) {
      // hold in center
      translateYpx = 0;
    } else {
      // leaving phase: animate from 0 -> endPx
      let t = clamp((p - HOLD_END) / (1 - HOLD_END), 0, 1);
      t = ease(t);
      translateYpx = 0 + (endPx - 0) * t;
    }

    // Apply transform (we set translateY in px)
    // Use translateY only; label centering is handled by CSS top:50% translateY(-50%) base
    labelEl.style.transform = `translateY(${translateYpx}px)`;
  }

  // Throttle updates with rAF
  let ticking = false;
  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        update();
        ticking = false;
      });
      ticking = true;
    }
  }

  // Rebuild cache on resize (and update immediately)
  function onResize() {
    rebuildCache();
    update();
  }

  // Initialization
  function init() {
    rebuildCache();
    update();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
  }

  // Start
  init();
})();
