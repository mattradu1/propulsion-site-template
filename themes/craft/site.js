// Craft theme script (v4.0). Progressive enhancement only: every word and link works without it.
// Scroll progress line, header colour on scroll, phone menu, day/evening toggle,
// v3: before/after slider, process draw, count-up.
// v4: spring-settled before/after, phone action bar, enquiry form messages and success. Rise-into-view moved to
// CSS (scroll-driven) and page changes to CSS View Transitions, so neither needs a line of script.
// Writes no text except a counting number's own value: every message it shows is already in the HTML.
// v4: //@if … //@endif blocks ship only to clients that use that component (see build.mjs).
(function () {
  var doc = document.documentElement;
  var calm = !window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canIO = 'IntersectionObserver' in window;
  var header = document.querySelector('.site-header');
  var bar = document.querySelector('.progress');
  var ticking = false;
  var barUpdate = null;
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
      if (barUpdate) barUpdate();
      burger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      close.focus();
    };
    var shut = function (refocus) {
      nav.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      if (barUpdate) barUpdate();
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

  //@if ba
  // Before/after: the handle is a slider (arrow keys, Page Up/Down, Home/End: instant, never animated) and the
  // photo follows the pointer. v4 feel (Apple fluid-interface rules): grab the handle and it tracks the finger 1:1
  // from where it was grabbed; press anywhere else and the photo springs there on release (or chases a drag with a
  // fast spring); let go mid-drag and it carries the finger's speed into a critically damped settle. Every spring
  // starts from the value on screen, so a new press interrupts it cleanly. Vertical swipes still scroll the page.
  Array.prototype.forEach.call(document.querySelectorAll('[data-ba]'), function (box) {
    var handle = box.querySelector('.ba-handle');
    if (!handle) return;
    var pos = 50, shown = -1, drag = null, raf = 0, t0 = 0, sp = { to: 50, v: 0, k: 0, c: 0 };
    var clamp = function (p) { return Math.max(0, Math.min(100, p)); };
    function paint(p) {
      pos = clamp(p);
      box.style.setProperty('--pos', (Math.round(pos * 100) / 100) + '%');
      var v = Math.round(pos);
      if (v !== shown) { shown = v; handle.setAttribute('aria-valuenow', String(v)); handle.setAttribute('aria-valuetext', v + '%'); }
    }
    var touched = false;
    function stop() { if (raf) window.cancelAnimationFrame(raf); raf = 0; sp.v = 0; sp.done = null; }
    function set(p) { stop(); paint(p); }
    function step(t) {
      var dt = t0 ? Math.min(0.032, (t - t0) / 1000) : 1 / 60;
      t0 = t;
      for (var i = 0; i < 4; i++) { var a = -sp.k * (pos - sp.to) - sp.c * sp.v; sp.v += a * dt / 4; pos += sp.v * dt / 4; }
      if (pos <= 0 || pos >= 100) sp.v = 0;
      paint(pos);
      if (Math.abs(pos - sp.to) < 0.05 && Math.abs(sp.v) < 1) { raf = 0; paint(sp.to); var cb = sp.done; sp.done = null; if (cb) cb(); return; }
      raf = window.requestAnimationFrame(step);
    }
    // response = seconds to reach the target (not a duration); damping 1 = no overshoot.
    function springTo(to, velocity, damping, response) {
      sp.to = clamp(to);
      if (velocity != null) sp.v = velocity;
      sp.k = Math.pow(2 * Math.PI / response, 2); sp.c = 4 * Math.PI * damping / response;
      if (calm) { set(sp.to); return; }
      if (!raf) { t0 = 0; raf = window.requestAnimationFrame(step); }
    }
    handle.hidden = false;
    box.classList.add('is-live');
    set(50);
    // Signature moment (only when the before/after is this client's one moving section): the first time it is
    // properly on screen, the photo glides once to show the "before" side and back, so the visitor sees it moves.
    // Never repeats, never after the visitor has touched it, never under reduced motion.
    if (!calm && canIO && box.closest('.sig')) {
      var sio = new IntersectionObserver(function (es) {
        if (!es[es.length - 1].isIntersecting) return;
        sio.disconnect();
        if (touched) return;
        springTo(32, null, 1, 0.7);
        sp.done = function () { if (!touched) springTo(50, null, 1, 0.6); };
      }, { threshold: 0.6 });
      sio.observe(box);
    }
    handle.addEventListener('keydown', function (e) {
      touched = true;
      var step = e.shiftKey ? 10 : 2;
      var to = { ArrowLeft: pos - step, ArrowDown: pos - step, ArrowRight: pos + step, ArrowUp: pos + step, PageDown: pos - 10, PageUp: pos + 10, Home: 0, End: 100 }[e.key];
      if (to !== undefined) { e.preventDefault(); set(Math.round(to)); }
    });
    var at = function (e, d) { d = d || drag; return (e.clientX - d.left) / d.w * 100; };
    box.addEventListener('pointerdown', function (e) {
      touched = true;
      if (e.button > 0 || drag) return; // one finger at a time: a second touch never makes the photo jump
      var r = box.getBoundingClientRect();
      if (!r.width) return;
      var onHandle = e.target === handle || handle.contains(e.target);
      drag = { id: e.pointerId, left: r.left, w: r.width, x0: e.clientX, moved: false, onHandle: onHandle, hist: [] };
      drag.grab = onHandle ? pos - at(e) : 0; // respect where the handle was grabbed
      if (onHandle) stop();
      if (box.setPointerCapture) box.setPointerCapture(e.pointerId);
      box.classList.add('is-pressed');
      handle.focus({ preventScroll: true });
    });
    box.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.moved && Math.abs(e.clientX - drag.x0) < 4) return; // small hysteresis before committing
      drag.moved = true;
      var p = clamp(at(e) + drag.grab);
      if (drag.onHandle) paint(p); else springTo(p, null, 1, 0.16);
      drag.hist.push([e.timeStamp, p]);
      if (drag.hist.length > 6) drag.hist.shift();
    });
    function end(e, cancelled) {
      if (!drag || e.pointerId !== drag.id) return;
      var d = drag;
      drag = null;
      box.classList.remove('is-pressed');
      if (cancelled) return; // the page scrolled instead: leave the photo where it is
      if (!d.moved) return;
      var h = d.hist.filter(function (x) { return e.timeStamp - x[0] < 100; }), v = 0;
      if (h.length > 1) { var dt = (h[h.length - 1][0] - h[0][0]) / 1000; if (dt > 0) v = (h[h.length - 1][1] - h[0][1]) / dt; }
      var from = d.onHandle ? pos : sp.to;
      var throwTo = from + Math.max(-12, Math.min(12, (v / 1000) * 0.99 / (1 - 0.99))); // project the momentum
      springTo(throwTo, d.onHandle ? v : null, 1, 0.38);
    }
    box.addEventListener('pointerup', function (e) {
      // A tap off the handle commits on release (so a vertical scroll that starts there never moves the photo).
      if (drag && e.pointerId === drag.id && !drag.moved && !drag.onHandle) { var p = drag; drag = null; box.classList.remove('is-pressed'); springTo(at.call(null, e, p), null, 1, 0.32); return; }
      end(e, false);
    });
    box.addEventListener('pointercancel', function (e) { end(e, true); });
  });

  //@endif
  //@if actionbar
  // v4 phone action bar (Call · WhatsApp · Enquire). Shown once the hero (or page head) has scrolled away, hidden
  // again whenever the enquiry form, the closing band or the footer is on screen or about to be, and while the
  // phone menu is open. Hidden = transformed off screen and inert, so it is never tabbed to or read out.
  var abar = document.querySelector('[data-actionbar]');
  if (abar && canIO) {
    var heroEl = document.querySelector('main > :first-child'); // the hero, page head, or a page's opening section
    var zones = document.querySelectorAll('#enquire, .cta-band, .site-footer');
    var heroIn = !!heroEl, near = [];
    abar.hidden = false;
    abar.inert = true;
    barUpdate = function () {
      var show = !heroIn && near.indexOf(true) < 0 && !(nav && nav.classList.contains('is-open'));
      abar.classList.toggle('is-shown', show);
      abar.inert = !show;
    };
    if (heroEl) new IntersectionObserver(function (es) { heroIn = es[es.length - 1].isIntersecting; barUpdate(); }).observe(heroEl);
    var zio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { near[Array.prototype.indexOf.call(zones, e.target)] = e.isIntersecting; });
      barUpdate();
    }, { rootMargin: '0px 0px 96px 0px' });
    Array.prototype.forEach.call(zones, function (z, i) { near[i] = false; zio.observe(z); });
    barUpdate();
  }

  //@endif
  //@if form
  // v4 enquiry form. The browser's own validation stays for visitors without JS; with JS the approved messages
  // already in the HTML are shown under their field (after the visitor has typed there, or on send), focus goes
  // to the first problem, and nothing moves. Inline success only where the form processor is confirmed for it
  // (data-inline); if the script's post is refused for any reason the browser posts the form the normal way.
  Array.prototype.forEach.call(document.querySelectorAll('form[data-enquiry]'), function (form) {
    var q = function (s) { return form.querySelector(s); };
    var phoneEl = q('#f-phone'), emailEl = q('#f-email'), consentEl = q('#f-consent');
    var rules = [
      [q('#f-name'), function (v) { return v.trim() ? null : 'f-name-err'; }],
      [phoneEl, function (v) { return !v.trim() || v.replace(/\D/g, '').length >= 10 ? null : 'f-phone-err'; }],
      [emailEl, function (v) { return !v.trim() ? 'f-email-err' : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? null : 'f-email-bad'; }],
      [consentEl, function () { return consentEl.checked ? null : 'f-consent-err'; }],
    ].filter(function (r) { return r[0]; });
    form.noValidate = true;
    function check(r) {
      var el = r[0], id = r[1](el.value), field = el.closest('.field');
      Array.prototype.forEach.call(field.querySelectorAll('.err'), function (p) { p.hidden = p.id !== id; });
      field.classList.toggle('is-invalid', !!id);
      if (id) { el.setAttribute('aria-invalid', 'true'); el.setAttribute('aria-describedby', id); }
      else { el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby'); }
      return !id;
    }
    rules.forEach(function (r) {
      var el = r[0];
      el.addEventListener('blur', function () { if (el.type !== 'checkbox' && el.value.trim()) check(r); });
      el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', function () { if (el.closest('.field').classList.contains('is-invalid')) check(r); });
    });
    var stack = form.parentNode, sent = stack.querySelector('.sent');
    form.addEventListener('submit', function (e) {
      var bad = rules.filter(function (r) { return !check(r); });
      if (bad.length) { e.preventDefault(); bad[0][0].focus(); return; }
      if (!sent || !form.hasAttribute('data-inline') || !window.fetch || !window.FormData) return; // normal post
      e.preventDefault();
      if (form.classList.contains('is-sending')) return; // no double send
      form.classList.add('is-sending');
      // The extra header makes the browser ask the processor first (CORS preflight): if it is not set up for this,
      // nothing is sent and the form posts normally instead, so an enquiry is never lost or sent twice.
      window.fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json', 'X-Requested-With': 'fetch' }, mode: 'cors', credentials: 'omit' })
        .then(function (r) {
          if (!r.ok) throw new Error(String(r.status));
          stack.classList.add('is-sent');
          form.inert = true;
          sent.hidden = false;
          var hh = sent.querySelector('h3');
          if (hh) hh.focus({ preventScroll: true });
          sent.scrollIntoView({ block: 'nearest' });
        })
        .catch(function () { form.classList.remove('is-sending'); HTMLFormElement.prototype.submit.call(form); });
    });
  });

  //@endif
  if (calm || !canIO) return; // everything below is motion; reduced motion keeps the final state already in the HTML

  //@if draw
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
    wrap.classList.add('is-drawing');
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

  //@endif
  //@if count
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

  //@endif
})();
