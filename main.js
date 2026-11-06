/**
 * Intelligence Designed To Evolve — Main Script
 */

document.addEventListener('DOMContentLoaded', () => {
  // -------------------------------------------------------------------------
  // 1. Mobile Menu Interactions
  // -------------------------------------------------------------------------
  const burgerBtn = document.querySelector('.burger-btn');
  const overlay = document.querySelector('.mobile-overlay');
  const menu = document.querySelector('.mobile-menu');
  const navLinks = document.querySelectorAll('.nav-link, .mobile-nav-link');

  function openMenu() {
    if (!burgerBtn || !overlay || !menu) return;
    burgerBtn.setAttribute('aria-expanded', 'true');
    overlay.removeAttribute('hidden');
    menu.removeAttribute('hidden');
    document.body.classList.add('menu-open');
  }

  function closeMenu() {
    if (!burgerBtn || !overlay || !menu) return;
    burgerBtn.setAttribute('aria-expanded', 'false');
    overlay.setAttribute('hidden', '');
    menu.setAttribute('hidden', '');
    document.body.classList.remove('menu-open');
  }

  if (burgerBtn) {
    burgerBtn.addEventListener('click', () => {
      const isExpanded = burgerBtn.getAttribute('aria-expanded') === 'true';
      if (isExpanded) {
        closeMenu();
      } else {
        openMenu();
      }
    });
  }

  if (overlay) {
    overlay.addEventListener('click', closeMenu);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMenu();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 720) {
      closeMenu();
    }
  });

  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      closeMenu();
      navLinks.forEach((l) => l.classList.remove('active'));
      const href = link.getAttribute('href');
      if (href) {
        document.querySelectorAll(`[href="${href}"]`).forEach((l) => l.classList.add('active'));
      }
    });
  });

  // -------------------------------------------------------------------------
  // 2. Count-Up Stats with easeOutCubic
  // -------------------------------------------------------------------------
  const statElements = document.querySelectorAll('.stat-value');
  let animated = false;

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function runCountUp() {
    if (animated) return;
    animated = true;

    statElements.forEach((el, i) => {
      const target = parseFloat(el.getAttribute('data-target'));
      const suffix = el.getAttribute('data-suffix') || '';
      const decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
      const duration = 1500 + i * 80;
      const startOffset = 480 + i * 90;

      setTimeout(() => {
        const startTime = performance.now();

        function step(currentTime) {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = easeOutCubic(progress);
          const currentVal = target * eased;

          el.textContent = currentVal.toFixed(decimals) + suffix;

          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            el.textContent = target.toFixed(decimals) + suffix;
          }
        }

        requestAnimationFrame(step);
      }, startOffset);
    });
  }

  const statsFooter = document.querySelector('.stats-footer');
  if ('IntersectionObserver' in window && statsFooter) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            runCountUp();
            observer.disconnect();
          }
        });
      },
      { threshold: 0.25 }
    );
    observer.observe(statsFooter);
  } else {
    runCountUp();
  }
});
