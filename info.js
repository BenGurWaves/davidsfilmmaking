// info.js
// Scroll-synced left label behavior that mimics the "name moves with the text"
// - label rises into center, holds, then rises out as section ends,
// - reverse works when scrolling up.
// Important: use the data-title="" attribute on sections (empty means no label).

(function () {
  // DOM elements
  const labelEl = document.getElementById('leftLabel');
  const sections = Array.from(document.querySelectorAll('.page-section'));

  // Parameters — tweak if you want the label to hold longer/shorter
  // holdStart/holdEnd are the relative progress points inside a section [0..1]
  // where the label should be exactly centered and hold.
  const holdStart = 0.15; // when the label reaches center
  const holdEnd = 0.85;   // when the label should start to rise out
  const startOffsetVH = 35; // start below center in viewport-height units
  const endOffsetVH = -45;  // final above-center offset in vh units

  // helper: clamp
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // convert vh to px
  function vhToPx(vh) {
    return Math.round(window.innerHeight * (vh / 100));
  }

  // easing (smoothstep)
  function ease(t) {
    return t * t * (3 - 2 * t);
  }

  // main update function, called on scroll and resize
  function update() {
    const viewportCenter = window.scrollY + window.innerHeight / 2;

    // find the first section whose data-title is non-empty and whose vertical span contains the viewport center (by progress)
    let activeSection = null;
    let activeIndex = -1;
    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i];
      const title = sec.getAttribute('data-title') || '';
      if (!title) continue; // skip sections with no title (intro, end)
      const rectTop = sec.offsetTop;
      const rectHeight = sec.offsetHeight;
      const secStart = rectTop;
      const secEnd = rectTop + rectHeight;

      // compute progress of viewport center through this section (0..1)
      const progress = (viewportCenter - secStart) / rectHeight;
      if (progress >= -0.5 && progress <= 1.5) {
        // candidate; we'll choose the one with progress closest to middle (0.5)
        // simpler: choose the section where progress in [0..1], or if none, pick nearest
        if (progress >= 0 && progress <= 1) {
          activeSection = sec;
          activeIndex = i;
          break;
        } else {
          // keep as fallback if no section contains center exactly; prefer nearest later
          if (!activeSection) {
            activeSection = sec;
            activeIndex = i;
          }
        }
      }
    }

    if (!activeSection) {
      // nothing relevant — hide label
      labelEl.classList.remove('visible');
      return;
    }

    // show the label
    const titleText = activeSection.getAttribute('data-title') || '';
    if (!titleText) {
      labelEl.classList.remove('visible');
      return;
    }
    if (labelEl.textContent !== titleText) {
      labelEl.textContent = titleText;
    }
    labelEl.classList.add('visible');

    // compute precise progress for that active section
    const sTop = activeSection.offsetTop;
    const sHeight = activeSection.offsetHeight;
    let p = (viewportCenter - sTop) / sHeight; // p in ... might be <0 or >1
    p = clamp(p, -0.25, 1.25);

    // Map p to label translate Y in px according to the two-phase model:
    // - when p < holdStart: animate from startOffset -> 0 (center)
    // - holdStart <= p <= holdEnd: position = 0 (center)
    // - p > holdEnd: animate from 0 -> endOffset (exit above)
    const vh = window.innerHeight;
    const startPx = vhToPx(startOffsetVH);
    const endPx = vhToPx(endOffsetVH); // negative value

    let translateYpx = 0;

    if (p < holdStart) {
      let t = clamp(p / holdStart, 0, 1);
      t = ease(t);
      translateYpx = startPx + (0 - startPx) * t;
    } else if (p >= holdStart && p <= holdEnd) {
      translateYpx = 0;
    } else {
      // leaving phase
      let t = clamp((p - holdEnd) / (1 - holdEnd), 0, 1);
      t = ease(t);
      translateYpx = 0 + (endPx - 0) * t;
    }

    // Apply transform (negative because translateY positive moves label down).
    labelEl.style.transform = `translateY(${translateYpx}px)`;
  }

  // Resize handler to recalc properly
  function onResize() {
    update();
  }

  // Throttle for performance
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

  // initialize
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  // call once
  update();
})();
