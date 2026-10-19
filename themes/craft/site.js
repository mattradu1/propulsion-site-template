// Craft theme script (v2.0). Progressive enhancement only: every word and link works without it.
// Scroll progress line, header colour on scroll, phone menu, day/evening toggle, rise-into-view.
(function () {
  var doc = document.documentElement;
  var header = document.querySelector('.site-header');
  var bar = document.querySelector('.progress');
  var ticking = false;
  function onScroll() {
    ticking = false;
    var max = doc.scrollHeight - doc.clientHeight;
    var y = window.scrollY || doc.scrollTop;
    if (bar) bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max) : 0) + ')';
    if (header) header.classList.toggle('is-scrolled', y > 60);
  }
  function req() { if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); } }
  window.addEventListener('scroll', req, { passive: true });
  window.addEventListener('resize', req, { passive: true });
  onScroll();

  // Phone menu. Without JS the "Menu" link jumps to the footer links instead.
  var burger = document.querySelector('.burger');
  var nav = document.getElementById('primary-nav');
  var close = nav && nav.querySelector('.nav-close');
  if (burger && nav && close) {
    burger.setAttribute('role', 'button');
    burger.setAttribute('aria-controls', 'primary-nav');
    burger.setAttribute('aria-expanded', 'false');
    close.hidden = false;
    var open = function () {
      nav.classList.add('is-open');
      burger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      close.focus();
    };
    var shut = function (refocus) {
      nav.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      if (refocus) burger.focus();
    };
    burger.addEventListener('click', function (e) { e.preventDefault(); open(); });
    burger.addEventListener('keydown', function (e) { if (e.key === ' ') { e.preventDefault(); open(); } });
    close.addEventListener('click', function () { shut(true); });
    nav.addEventListener('click', function (e) { if (e.target.tagName === 'A') shut(false); });
    document.addEventListener('keydown', function (e) {
      if (!nav.classList.contains('is-open')) return;
      if (e.key === 'Escape') shut(true);
      if (e.key === 'Tab') { // keep focus inside the open menu
        var f = nav.querySelectorAll('a,button'); var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  // Day / evening: one toggle per work section switches every pair in it.
  Array.prototype.forEach.call(document.querySelectorAll('.work[data-mode]'), function (sec) {
    var group = sec.querySelector('.lighting');
    if (!group) return;
    group.hidden = false;
    var btns = group.querySelectorAll('button');
    Array.prototype.forEach.call(btns, function (b) {
      b.addEventListener('click', function () {
        var mode = b.getAttribute('data-mode');
        sec.setAttribute('data-mode', mode);
        Array.prototype.forEach.call(btns, function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        Array.prototype.forEach.call(sec.querySelectorAll('.pair'), function (p) {
          var day = p.querySelector('.day'), eve = p.querySelector('.eve');
          if (!eve) return;
          eve.setAttribute('aria-hidden', String(mode !== 'evening'));
          day.setAttribute('aria-hidden', String(mode === 'evening'));
        });
      });
    });
  });

  // Rise into view (skipped when reduced motion is asked for, and for anything already on screen).
  if (window.matchMedia && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
    var items = document.querySelectorAll('.rise');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    Array.prototype.forEach.call(items, function (el) {
      if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('in');
      else io.observe(el);
    });
    doc.classList.add('motion');
  }
})();
