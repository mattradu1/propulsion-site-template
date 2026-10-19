// Day/evening toggle. Progressive enhancement: without JS the day view and all text still show.
document.querySelectorAll('[data-toggle]').forEach(function (fig) {
  var btn = fig.querySelector('button.toggle');
  var day = fig.querySelector('.view-day');
  var eve = fig.querySelector('.view-evening');
  if (!btn || !day || !eve) return;
  btn.hidden = false;
  btn.addEventListener('click', function () {
    var on = btn.getAttribute('aria-pressed') !== 'true';
    btn.setAttribute('aria-pressed', String(on));
    eve.hidden = !on;
    day.hidden = on;
  });
});
