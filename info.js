/* info.js — full file
   Scroll-synced left label with two modes:
   - "linear": label maps linearly to progress through a section (no easing, no fade)
   - "hold": label rises into center, holds for a configurable range, then exits (Salomon-like)
   Works with sections marked as <section class="page-section" data-title="Title">.
   The left-label element expected: <div class="left-label"><span id="leftLabel"></span></div>
   If leftLabel is missing, falls back to legacy .info-nav behavior (if present).
*/

(function () {
  'use strict';

  /* --------------------------
     CONFIGURATION
     -------------------------- */
  // MODE: 'linear' or 'hold'
  const MODE = 'hold'; // change to 'linear' for strict linear mapping

  // linear mode parameters (used if MODE === 'linear')
  const LINEAR = {
    START_OFFSET_VH: 35,  // starting translateY in vh (below center)
    END_OFFSET_VH: -45    // ending translateY in vh (above center)
  };

  // hold mode parameters (used if MODE === 'hold')
  // label enters between entryStart..entryHoldStart, holds until entryHoldEnd..exitEnd
  const HOLD = {
    ENTRY_START: 0.08,    // progress where label starts to enter (0..1)
    HOLD_START: 0.25,     // progress where label reaches center and holds
    HOLD_END: 0.75,       // progress where label leaves the center
    EXIT_END: 0.92,       // progress where label is fully out above
    START_OFFSET_VH: 35,  // starting translateY in vh (below center)
    END_OFFSET_VH: -45    // final translateY in vh (above center)
  };

  // Performance / behavior
  const RAF_THROTTLE = true;   // use rAF throttling for scroll updates
  const DEBUG = false;         // set true to enable console debug logs

  /* --------------------------
     DOM references
     -------------------------- */
  const leftLabelEl = document.getElementById('leftLabel'); // preferred single element
  const legacyInfoNav = document.querySelector('.info-nav'); // fallback
  const pageSections = Array.from(document.querySelectorAll('.page-section'));

  if (pageSections.length === 0) {
    if (DEBUG) console.warn('info.js: No .page-section elements found — nothing to do.');
    return;
  }

  // If leftLabel not present, try to use legacy .info-nav spans as fallback.
  const usingLegacy = !leftLabelEl && !!legacyInfoNav;

  // Legacy spans cache (if used)
  let legacySpans = [];
  if (usingLegacy) {
    legacySpans = Array.from(legacyInfoNav.querySelectorAll('span'));
  }

  /* --------------------------
     Caching and state
     -------------------------- */
  let cache = []; // { el, top, height, center, title, index }
  let ticking = false;

  // Helper: clamp number
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // Helper: convert vh to px
  function vhToPx(vh) { return (window.innerHeight * vh) / 100; }

  // Build / rebuild cache of section geometry
  function rebuildCache() {
    cache = pageSections.map((sec, i) => {
      const rect = sec.getBoundingClientRect();
      const top = window.scrollY + rect.top;
      const height = Math.max(1, rect.height);
      const center = top + height / 2;
      const title = sec.getAttribute('data-title') || '';
      return { el: sec, top, height, center, title, index: i };
    });
    if (DEBUG) console.log('info.js: cache rebuilt', cache);
  }

  /* --------------------------
     Utility: set left label text and visibility
     -------------------------- */
  function showLabel(text) {
    if (usingLegacy) {
      // Toggle legacy spans active class
      legacySpans.forEach((s, idx) => {
        if (s.textContent.trim() === text.trim()) {
          s.classList.add('active');
        } else {
          s.classList.remove('active');
        }
      });
      return;
    }
    if (!leftLabelEl) return;
    if (leftLabelEl.textContent !== text) leftLabelEl.textContent = text;
    if (!leftLabelEl.classList.contains('visible')) leftLabelEl.classList.add('visible');
    leftLabelEl.style.opacity = '1'; // immediate show (no fade)
  }

  function hideLabel() {
    if (usingLegacy) {
      legacySpans.forEach(s => s.classList.remove('active'));
      return;
    }
    if (!leftLabelEl) return;
    leftLabelEl.classList.remove('visible');
    leftLabelEl.style.opacity = '0';
    leftLabelEl.style.transform = ''; // reset transform
  }

  /* --------------------------
     Core: compute label position and update
     -------------------------- */

  // Map progress p (0..1) to translateY px for linear mode
  function linearMapProgressToPx(p) {
    const startPx = vhToPx(LINEAR.START_OFFSET_VH);
    const endPx = vhToPx(LINEAR.END_OFFSET_VH);
    // Linear interpolation
    return startPx + (endPx - startPx) * p;
  }

  // Map progress p into px using hold profile
  function holdMapProgressToPx(p) {
    const startPx = vhToPx(HOLD.START_OFFSET_VH);
    const endPx = vhToPx(HOLD.END_OFFSET_VH);

    // Cases:
    // 1) p <= ENTRY_START: label is below (startPx)
    // 2) ENTRY_START < p < HOLD_START: interpolate startPx -> 0 (enter)
    // 3) HOLD_START <= p <= HOLD_END: hold at 0
    // 4) HOLD_END < p < EXIT_END: interpolate 0 -> endPx (exit)
    // 5) p >= EXIT_END: endPx
    if (p <= HOLD.ENTRY_START) return startPx;
    if (p < HOLD.HOLD_START) {
      const t = (p - HOLD.ENTRY_START) / (HOLD.HOLD_START - HOLD.ENTRY_START);
      return startPx + (0 - startPx) * t;
    }
    if (p <= HOLD.HOLD_END) {
      return 0;
    }
    if (p < HOLD.EXIT_END) {
      const t = (p - HOLD.HOLD_END) / (HOLD.EXIT_END - HOLD.HOLD_END);
      return 0 + (endPx - 0) * t;
    }
    return endPx;
  }

  // Main update function — called on scroll (throttled)
  function update() {
    const viewportCenter = window.scrollY + window.innerHeight / 2;

    // Choose the section that best matches the viewport center.
    // Priority: a section whose center is nearest to viewportCenter.
    let best = null;
    let bestDistance = Infinity;
    for (let i = 0; i < cache.length; i++) {
      const item = cache[i];
      const dist = Math.abs(item.center - viewportCenter);
      if (dist < bestDistance) {
        bestDistance = dist;
        best = item;
      }
    }

    if (!best || !best.title) {
      hideLabel();
      return;
    }

    // Compute progress p: how far viewportCenter is through the section
    // p = 0 when viewportCenter == section.top, p = 1 when viewportCenter == section.top + height
    let p = (viewportCenter - best.top) / best.height;
    // For modes, clamp or allow slightly outside range for smoother entrance/exit
    p = clamp(p, -0.25, 1.25);

    // Map p to translateY
    let translateYpx;
    if (MODE === 'linear') {
      // Map 0..1 to start->end linearly; clamp to 0..1
      const pLinear = clamp(p, 0, 1);
      translateYpx = linearMapProgressToPx(pLinear);
    } else {
      // HOLD mode: compute based on hold thresholds (we expect HOLD.* values in 0..1)
      translateYpx = holdMapProgressToPx(p);
    }

    // Ensure label text and make visible
    showLabel(best.title);

    // Apply transform directly (no easing) so movement matches scroll physically
    if (!usingLegacy && leftLabelEl) {
      leftLabelEl.style.transform = `translateY(${translateYpx}px)`;
    } else if (usingLegacy) {
      // For legacy spans, set transform on the active span if possible
      // (optional: legacy fallback won't be pixel-perfect)
      legacySpans.forEach((s) => {
        if (s.classList.contains('active')) {
          s.style.transform = `translateY(${translateYpx}px)`;
        } else {
          s.style.transform = '';
        }
      });
    }
  }

  /* --------------------------
     Event handlers + initialization
     -------------------------- */

  function onScroll() {
    if (!RAF_THROTTLE) {
      update();
      return;
    }
    if (!ticking) {
      window.requestAnimationFrame(() => {
        update();
        ticking = false;
      });
      ticking = true;
    }
  }

  function onResize() {
    rebuildCache();
    update();
  }

  // Build cache and initial state
  function init() {
    rebuildCache();
    // If there's a left label element, ensure it's hidden until update runs
    if (!usingLegacy && leftLabelEl) {
      leftLabelEl.style.opacity = '0';
      leftLabelEl.style.transform = `translateY(${vhToPx(LINEAR.START_OFFSET_VH)}px)`;
    }
    // Start listening
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    // initial update
    update();
    if (DEBUG) console.log('info.js: initialized (mode=', MODE, ')');
  }

  // Kick off
  init();

  /* --------------------------
     Public tuning helpers (for debug in console)
     Example usage: window.INFO_TUNE({MODE:'linear', START:40});
     -------------------------- */
  window.INFO_TUNE = function (opts = {}) {
    if (opts.MODE) {
      if (opts.MODE === 'linear' || opts.MODE === 'hold') {
        // eslint-disable-next-line no-console
        console.log('info.js: switching mode ->', opts.MODE);
        // NOTE: we don't reassign consts in real code; for quick debug allow mutation:
        // Use global variables in dev if needed. For now we'll just reload page recommendation.
      } else {
        // eslint-disable-next-line no-console
        console.warn('info.js: MODE must be "linear" or "hold"');
      }
    }
    if (opts.rebuild) {
      rebuildCache();
      update();
    }
  };

  // End IIFE
})();
