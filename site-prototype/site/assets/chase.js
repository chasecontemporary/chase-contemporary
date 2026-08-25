
document.addEventListener('DOMContentLoaded', function () {
  try {
    var j = JSON.parse(sessionStorage.getItem('cc_journey') || '[]');
    j.push(location.pathname); if (j.length > 40) j = j.slice(-40);
    sessionStorage.setItem('cc_journey', JSON.stringify(j));
    if (!sessionStorage.getItem('cc_t0')) sessionStorage.setItem('cc_t0', Date.now());
    var set = function (id, v) { var el = document.getElementById(id); if (el) el.value = v; };
    set('cc-journey', j.join(' > '));
    set('cc-ref', document.referrer || 'direct');
    set('cc-utm', location.search || '');
    var t = Date.now();
    setInterval(function () { set('cc-secs', Math.round((Date.now() - t) / 1000)); }, 2000);
  } catch (e) {}
  var h = document.querySelector('header');
  var onS = function(){ h.classList.toggle('sc', window.scrollY > 8); };
  onS(); window.addEventListener('scroll', onS, {passive: true});

  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    document.querySelectorAll('.r').forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll('.r').forEach(function (el) { el.classList.add('in'); });
  }

  document.querySelectorAll('img.fx').forEach(function (im) { if (im.complete && im.naturalWidth) im.classList.add('ld'); });

  var links = document.querySelectorAll('a[data-img]');
  if (links.length && window.matchMedia('(hover: hover)').matches) {
    var pv = document.createElement('div'); pv.id = 'apv';
    var pim = document.createElement('img'); pv.appendChild(pim); document.body.appendChild(pv);
    var px = 0, py = 0, raf = null;
    var place = function () {
      raf = null;
      var w = pv.offsetWidth || 320, h = pv.offsetHeight || 240;
      var x = Math.min(px + 36, window.innerWidth - w - 24);
      var y = Math.min(Math.max(py - h / 2, 24), window.innerHeight - h - 24);
      pv.style.left = x + 'px'; pv.style.top = y + 'px';
    };
    links.forEach(function (a) {
      a.addEventListener('mouseenter', function () {
        var src = a.getAttribute('data-img'); if (!src) return;
        pim.src = src; pv.classList.add('show');
      });
      a.addEventListener('mouseleave', function () { pv.classList.remove('show'); });
      a.addEventListener('mousemove', function (e) {
        px = e.clientX; py = e.clientY;
        if (!raf) raf = requestAnimationFrame(place);
      });
    });
  }

  var rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!rm) {
    document.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a[href]') : null;
      if (!a || a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var href = a.getAttribute('href');
      if (!href || href.indexOf('#') === 0 || /^(https?:|mailto:|tel:)/.test(href)) return;
      e.preventDefault();
      document.body.classList.add('leaving');
      setTimeout(function () { location.href = href; }, 170);
    });
    var hero = document.querySelector('.hero img');
    if (hero) {
      var hraf = null;
      window.addEventListener('scroll', function () {
        if (hraf) return;
        hraf = requestAnimationFrame(function () {
          hraf = null;
          hero.style.transform = 'scale(1.06) translateY(' + (window.scrollY * 0.08) + 'px)';
        });
      }, { passive: true });
    }
  }

  var wi = document.querySelector('.work-img img'), lb = document.getElementById('lb');
  if (wi && lb) {
    wi.addEventListener('click', function(){ lb.classList.add('show'); document.body.style.overflow='hidden'; });
    var close = function(){ lb.classList.remove('show'); lb.classList.remove('zoomed'); document.body.style.overflow=''; };
    var x = document.createElement('div'); x.className='x'; x.textContent='CLOSE'; lb.appendChild(x);
    x.addEventListener('click', function(e){ e.stopPropagation(); close(); });
    lb.addEventListener('click', function(e){
      var im = lb.querySelector('img');
      if (!im || e.target !== im) { close(); return; }
      if (!lb.classList.contains('zoomed')) {
        var r = im.getBoundingClientRect();
        im.style.transformOrigin = ((e.clientX-r.left)/r.width*100)+'% '+((e.clientY-r.top)/r.height*100)+'%';
        lb.classList.add('zoomed');
      } else { lb.classList.remove('zoomed'); }
    });
    lb.addEventListener('mousemove', function(e){
      if (!lb.classList.contains('zoomed')) return;
      var im = lb.querySelector('img'); if (!im) return;
      im.style.transformOrigin = (e.clientX/lb.clientWidth*100)+'% '+(e.clientY/lb.clientHeight*100)+'%';
    });
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape') close(); });
  }
});
function inq(btn){ document.getElementById('inq').classList.add('show'); if(btn) btn.style.display='none';
  setTimeout(function(){ var f=document.querySelector('#inq input'); if(f) f.focus(); }, 350); }
function sendInq(e){ e.preventDefault();
  document.getElementById('inq').classList.remove('show');
  document.getElementById('inq-done').classList.add('show'); }
function newsl(e){ e.preventDefault(); e.target.innerHTML =
  '<span style="font-size:8px;letter-spacing:.22em;">THANK YOU</span>'; }
