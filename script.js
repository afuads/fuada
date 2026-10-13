/* =========================================================================
   script.js — vanilla JS only.
   1) Image gallery / lightbox (mouse, touch, keyboard, focus trap)
   2) Sticky header + reading progress
   3) Gentle reveal-on-scroll (respects prefers-reduced-motion)
   No frameworks, no libraries, no network requests.
   ========================================================================= */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------------
     1. KUVANÄKYMÄ (lightbox)
     --------------------------------------------------------------------- */
  var lightbox = document.getElementById('lightbox');
  var lbImage = document.getElementById('lightboxImage');
  var lbCaption = document.getElementById('lightboxCaption');
  var lbCounter = document.getElementById('lightboxCounter');
  var lbPrev = document.getElementById('lightboxPrev');
  var lbNext = document.getElementById('lightboxNext');

  var items = [];
  var current = 0;
  var lastFocused = null;
  var closeTimer = null;

  if (lightbox) {
    // kaikki sivun kuvapainikkeet yhteen sarjaan, riippumatta ryhmästä
    items = Array.prototype.slice.call(document.querySelectorAll('.gallery__item'));

    items.forEach(function (button, index) {
      button.addEventListener('click', function () {
        openLightbox(index);
      });
    });

    // close buttons (backdrop + ✕)
    Array.prototype.forEach.call(
      lightbox.querySelectorAll('[data-lightbox-close]'),
      function (el) {
        el.addEventListener('click', closeLightbox);
      }
    );

    lbPrev.addEventListener('click', function () { step(-1); });
    lbNext.addEventListener('click', function () { step(1); });

    document.addEventListener('keydown', function (event) {
      if (lightbox.hidden) return;

      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          closeLightbox();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          step(-1);
          break;
        case 'ArrowRight':
          event.preventDefault();
          step(1);
          break;
        case 'Home':
          event.preventDefault();
          show(0);
          break;
        case 'End':
          event.preventDefault();
          show(items.length - 1);
          break;
        case 'Tab':
          trapFocus(event);
          break;
      }
    });

    // basic swipe support
    var touchStartX = null;
    var touchStartY = null;

    lightbox.addEventListener('touchstart', function (event) {
      var t = event.changedTouches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
    }, { passive: true });

    lightbox.addEventListener('touchend', function (event) {
      if (touchStartX === null) return;
      var t = event.changedTouches[0];
      var dx = t.clientX - touchStartX;
      var dy = t.clientY - touchStartY;
      touchStartX = null;
      touchStartY = null;

      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) {
        step(dx < 0 ? 1 : -1);
      } else if (Math.abs(dy) > 70 && dy > 60) {
        closeLightbox();
      }
    }, { passive: true });
  }

  // keep the neighbouring images warm so arrow presses feel instant.
  // Declared at function scope on purpose: inside the block above it would be
  // block-scoped in strict mode and invisible to show().
  function preload(index) {
    var item = items[index];
    if (!item) return;
    var src = item.getAttribute('data-src');
    if (!src) return;
    var img = new Image();
    img.src = src;
  }

  function show(index) {
    if (!items.length) return;
    current = (index + items.length) % items.length;

    var item = items[current];
    var src = item.getAttribute('data-src') || '';
    var thumb = item.querySelector('img');
    var caption = item.getAttribute('data-caption') || (thumb ? thumb.alt : '');

    lbImage.src = src;
    lbImage.alt = thumb ? thumb.alt : caption;
    lbCaption.textContent = caption;
    lbCounter.textContent = (current + 1) + ' / ' + items.length;

    preload(current + 1);
    preload(current - 1);
  }

  function step(delta) {
    show(current + delta);
  }

  function openLightbox(index) {
    if (!lightbox) return;
    window.clearTimeout(closeTimer);
    lastFocused = document.activeElement;
    show(index);

    lightbox.hidden = false;
    // allow the browser a frame so the opacity transition actually runs
    window.requestAnimationFrame(function () {
      lightbox.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      lbNext.focus();
    });
  }

  function closeLightbox() {
    if (!lightbox || lightbox.hidden) return;

    lightbox.classList.remove('is-open');
    document.body.style.overflow = '';

    var finish = function () {
      lightbox.hidden = true;
      lbImage.removeAttribute('src');
      document.body.style.overflow = '';
      if (lastFocused && typeof lastFocused.focus === 'function') {
        lastFocused.focus();
      }
    };

    if (reduceMotion) {
      finish();
    } else {
      closeTimer = window.setTimeout(finish, 240);
    }
  }

  function trapFocus(event) {
    var focusables = lightbox.querySelectorAll('button');
    if (!focusables.length) return;

    var first = focusables[0];
    var last = focusables[focusables.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    } else if (!lightbox.contains(document.activeElement)) {
      event.preventDefault();
      first.focus();
    }
  }

  /* ---------------------------------------------------------------------
     2. LUKUEMISTEN PALKKI
     --------------------------------------------------------------------- */
  var progressBar = document.getElementById('progressBar');
  var ticking = false;

  function onScroll() {
    var y = window.pageYOffset || document.documentElement.scrollTop;

    revealInView();

    if (progressBar) {
      var doc = document.documentElement;
      var scrollable = doc.scrollHeight - doc.clientHeight;
      var pct = scrollable > 0 ? (y / scrollable) * 100 : 0;
      progressBar.style.width = pct.toFixed(2) + '%';
    }

    ticking = false;
  }

  function requestScrollUpdate() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(onScroll);
    }
  }

  /* ---------------------------------------------------------------------
     3. REVEAL ON SCROLL
     --------------------------------------------------------------------- */
  var reveals = document.querySelectorAll('.reveal');
  var pending = Array.prototype.slice.call(reveals);

  // reveal anything that has reached the top of the viewport; also catches
  // blocks skipped by a fast scroll or an anchor jump
  function revealInView() {
    if (!pending.length) return;

    var limit = window.innerHeight - 40;
    var still = [];

    pending.forEach(function (el) {
      if (el.getBoundingClientRect().top < limit) {
        el.classList.add('is-visible');
      } else {
        still.push(el);
      }
    });

    pending = still;
  }

  if (reduceMotion || !('IntersectionObserver' in window)) {
    pending.forEach(function (el) { el.classList.add('is-visible'); });
    pending = [];
  } else {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: '0px 0px -40px 0px',
      threshold: 0.01
    });

    pending.forEach(function (el) { observer.observe(el); });
  }

  revealInView();

  window.addEventListener('scroll', requestScrollUpdate, { passive: true });
  window.addEventListener('resize', requestScrollUpdate, { passive: true });
  onScroll();
})();
