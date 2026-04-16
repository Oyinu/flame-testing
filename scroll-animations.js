

(function () {


  document.querySelectorAll('.mv-title, .sec-title, .sec-sub').forEach(el => {
    el.classList.add('reveal', 'from-up');
  });

  document.querySelectorAll('.divider').forEach(el => {
  });

  document.querySelectorAll('.mission, .vision').forEach(el => {
    el.classList.add('reveal', 'from-left');
  });

  document.querySelectorAll('.mv-image, .mv-image2').forEach(el => {
    el.classList.add('reveal', 'from-up');
  });

  const chart = document.querySelector('.tokenomics-chart');
  if (chart) chart.classList.add('reveal', 'from-up');

  const tokCards = document.querySelector('.tok-cards');
  if (tokCards) tokCards.classList.add('reveal-stagger');

  const stkGrid = document.querySelector('.stk-grid');
  if (stkGrid) stkGrid.classList.add('reveal-stagger');

  const rmTimeline = document.querySelector('.rm-timeline');
  if (rmTimeline) rmTimeline.classList.add('reveal-stagger');

  const faqList = document.querySelector('.faq-list');
  if (faqList) faqList.classList.add('reveal-stagger');

  const footerInner = document.querySelector('.footer-inner');
  if (footerInner) footerInner.classList.add('reveal', 'from-up');


  document.querySelectorAll('.tok-bar-fill').forEach(el => {
    const inlineWidth = el.style.width;
    if (inlineWidth) {
      el.style.setProperty('--bar-target', inlineWidth);
    }
  });


  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      entry.target.classList.toggle('visible', entry.isIntersecting);
    });
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px'
  });

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



  // .reveal elements
  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  // .reveal-stagger containers
  document.querySelectorAll('.reveal-stagger').forEach(el => revealObserver.observe(el));

  // tok-bar-fills
  document.querySelectorAll('.tok-bar-fill').forEach(el => barObserver.observe(el));

  // dividers
  document.querySelectorAll('.divider').forEach(el => barObserver.observe(el));



  if (faqList) {
    const faqMutObs = new MutationObserver(() => {

      revealObserver.observe(faqList);
    });
    faqMutObs.observe(faqList, { childList: true });
  }

})();