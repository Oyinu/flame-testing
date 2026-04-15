/* ── SCROLL ANIMATIONS ──────────────────────────────────────────
   Drop this file in and add a script tag at the bottom of <body>
   BEFORE the closing </body> tag:
   <script src="./scroll-animations.js"></script>
   ─────────────────────────────────────────────────────────────── */

(function () {

  // ── 1. Tag elements with reveal classes ──────────────────────

  // Section titles & subtitles → fade up
  document.querySelectorAll('.mv-title, .sec-title, .sec-sub').forEach(el => {
    el.classList.add('reveal', 'from-up');
  });

  // Dividers → draw in (handled by bar-animate class)
  document.querySelectorAll('.divider').forEach(el => {
    // already styled via CSS, just need the observer
  });

  // Mission & Vision cards → slide in from left
  document.querySelectorAll('.mission, .vision').forEach(el => {
    el.classList.add('reveal', 'from-left');
  });

  // Scroll image → slide in from right
  document.querySelectorAll('.mv-image, .mv-image2').forEach(el => {
    el.classList.add('reveal', 'from-up');
  });

  // Tokenomics chart → scale in from right
  const chart = document.querySelector('.tokenomics-chart');
  if (chart) chart.classList.add('reveal', 'from-up');

  // Tok-cards container → stagger
  const tokCards = document.querySelector('.tok-cards');
  if (tokCards) tokCards.classList.add('reveal-stagger');

  // Staking cards → stagger
  const stkGrid = document.querySelector('.stk-grid');
  if (stkGrid) stkGrid.classList.add('reveal-stagger');

  // Roadmap items → stagger
  const rmTimeline = document.querySelector('.rm-timeline');
  if (rmTimeline) rmTimeline.classList.add('reveal-stagger');

  // FAQ list → stagger (items added dynamically, so we observe the container)
  const faqList = document.querySelector('.faq-list');
  if (faqList) faqList.classList.add('reveal-stagger');

  // Footer inner → fade up
  const footerInner = document.querySelector('.footer-inner');
  if (footerInner) footerInner.classList.add('reveal', 'from-up');


  // ── 2. Store bar target widths before CSS zeroes them ─────────
  // Run this before the CSS transition kicks in
  document.querySelectorAll('.tok-bar-fill').forEach(el => {
    const inlineWidth = el.style.width;
    if (inlineWidth) {
      el.style.setProperty('--bar-target', inlineWidth);
    }
  });


  // ── 3. IntersectionObserver ───────────────────────────────────
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      // add 'visible' when entering, remove when leaving — replays every scroll
      entry.target.classList.toggle('visible', entry.isIntersecting);
    });
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px'
  });

  // Bar & divider observer — reset on leave so they re-animate on scroll back
  const barObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('bar-animate');
      } else {
        entry.target.classList.remove('bar-animate');
      }
    });
  }, {
    threshold: 0.2,
    rootMargin: '0px 0px -20px 0px'
  });


  // ── 4. Observe all tagged elements ───────────────────────────

  // .reveal elements
  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  // .reveal-stagger containers
  document.querySelectorAll('.reveal-stagger').forEach(el => revealObserver.observe(el));

  // tok-bar-fills
  document.querySelectorAll('.tok-bar-fill').forEach(el => barObserver.observe(el));

  // dividers
  document.querySelectorAll('.divider').forEach(el => barObserver.observe(el));


  // ── 5. FAQ is dynamically rendered — re-observe after DOM settles ──
  // MutationObserver watches faq-list for new children
  if (faqList) {
    const faqMutObs = new MutationObserver(() => {
      // faq-list children are already covered by reveal-stagger,
      // but re-trigger the observer in case they appeared after page load
      revealObserver.observe(faqList);
    });
    faqMutObs.observe(faqList, { childList: true });
  }

})();