// Craft theme script (v3.0). Progressive enhancement only: every word and link works without it.
// Scroll progress line, header colour on scroll, phone menu, day/evening toggle, rise-into-view,
// v3: before/after slider, process draw, count-up. Writes no text except a counting number's own value.
(function () {
  var doc = document.documentElement;
  var calm = !window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canIO = 'IntersectionObserver' in window;
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

  // Before/after: the handle is a slider (arrow keys, Page Up/Down, Home/End) and the photo follows a
  // pointer drag (mouse, pen or touch; vertical swipes still scroll the page). No JS = side by side.
  Array.prototype.forEach.call(document.querySelectorAll('[data-ba]'), function (box) {
    var handle = box.querySelector('.ba-handle');
    if (!handle) return;
    var pos = 50, drag = false;
    function set(p) {
      pos = Math.max(0, Math.min(100, Math.round(p)));
      box.style.setProperty('--pos', pos + '%');
      handle.setAttribute('aria-valuenow', String(pos));
      handle.setAttribute('aria-valuetext', pos + '%');
    }
    function at(e) { var r = box.getBoundingClientRect(); if (r.width) set((e.clientX - r.left) / r.width * 100); }
    handle.hidden = false;
    box.classList.add('is-live');
    set(50);
    handle.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 10 : 2;
      var to = { ArrowLeft: pos - step, ArrowDown: pos - step, ArrowRight: pos + step, ArrowUp: pos + step, PageDown: pos - 10, PageUp: pos + 10, Home: 0, End: 100 }[e.key];
      if (to !== undefined) { e.preventDefault(); set(to); }
    });
    box.addEventListener('pointerdown', function (e) {
      if (e.button > 0) return;
      drag = true;
      if (box.setPointerCapture) box.setPointerCapture(e.pointerId);
      at(e);
      handle.focus({ preventScroll: true });
    });
    box.addEventListener('pointermove', function (e) { if (drag) at(e); });
    box.addEventListener('pointerup', function () { drag = false; });
    box.addEventListener('pointercancel', function () { drag = false; });
  });

  if (calm || !canIO) return; // everything below is motion; reduced motion keeps the final state already in the HTML

  // Process draw: the line is measured with getTotalLength() and drawn with stroke-dashoffset as the steps
  // scroll through the screen; each step's marker fills when the line reaches it.
  Array.prototype.forEach.call(document.querySelectorAll('[data-draw]'), function (list) {
    var wrap = list.parentNode, svg = wrap.querySelector('.rail'), path = svg && svg.querySelector('.rail-line'), base = svg && svg.querySelector('.rail-base');
    if (!path || !path.getTotalLength) return;
    var dots = list.querySelectorAll('.dot'), items = list.querySelectorAll('li');
    var top = 0, height = 1, len = 0, stops = [], done = false, on = false;
    function measure() {
      var w = wrap.getBoundingClientRect();
      var c = Array.prototype.map.call(dots, function (d) { var b = d.getBoundingClientRect(); return b.top + b.height / 2 - w.top; });
      if (!c.length) return;
      top = c[0]; height = Math.max(1, c[c.length - 1] - c[0]);
      svg.style.top = top + 'px'; svg.style.bottom = 'auto'; svg.style.height = height + 'px';
      svg.setAttribute('viewBox', '0 0 4 ' + height);
      path.setAttribute('d', 'M2 0V' + height); base.setAttribute('d', 'M2 0V' + height);
      len = path.getTotalLength();
      path.style.strokeDasharray = len + ' ' + len;
      stops = c.map(function (y) { return (y - top) / height; });
    }
    function draw() {
      var w = wrap.getBoundingClientRect();
      var p = Math.max(0, Math.min(1, (window.innerHeight * 0.72 - (w.top + top)) / height));
      if (window.innerHeight + (window.scrollY || doc.scrollTop) >= doc.scrollHeight - 2 && w.top < window.innerHeight) p = 1; // page end reached
      path.style.strokeDashoffset = String(len * (1 - p));
      Array.prototype.forEach.call(items, function (li, i) { li.classList.toggle('reached', p >= stops[i] - 0.001); });
      if (p >= 1) { done = true; window.removeEventListener('scroll', tick); }
    }
    var queued = false;
    function tick() { if (!queued) { queued = true; window.requestAnimationFrame(function () { queued = false; if (!done) draw(); }); } }
    measure();
    list.classList.add('draw-on');
    draw();
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting && !on && !done) { on = true; window.addEventListener('scroll', tick, { passive: true }); tick(); }
        else if (!e.isIntersecting && on) { on = false; window.removeEventListener('scroll', tick); }
      });
    }).observe(list);
    window.addEventListener('resize', function () { measure(); if (done) path.style.strokeDashoffset = '0'; else draw(); }, { passive: true });
  });

  // Count-up: only numbers written in client.json (data-count); the final figure is already in the HTML.
  var counters = document.querySelectorAll('[data-count]');
  if (counters.length) {
    var fmt = window.Intl ? new Intl.NumberFormat('en-GB') : { format: String };
    var cio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        cio.unobserve(e.target);
        var el = e.target, to = parseInt(el.getAttribute('data-count'), 10), t0 = null, dur = 1800;
        if (!(to > 0)) return;
        el.style.display = 'inline-block'; el.style.minWidth = el.getBoundingClientRect().width + 'px'; el.style.textAlign = 'right'; // no layout shift while counting
        function step(t) {
          if (t0 === null) t0 = t;
          var k = Math.min(1, (t - t0) / dur), eased = k === 1 ? 1 : 1 - Math.pow(2, -10 * k); // ease-out-expo
          el.textContent = fmt.format(Math.round(to * eased));
          if (k < 1) window.requestAnimationFrame(step); else el.textContent = fmt.format(to);
        }
        window.requestAnimationFrame(step);
      });
    }, { threshold: 0.6 });
    Array.prototype.forEach.call(counters, function (el) { cio.observe(el); });
  }

  // Rise into view (skipped when reduced motion is asked for, and for anything already on screen).
  {
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
