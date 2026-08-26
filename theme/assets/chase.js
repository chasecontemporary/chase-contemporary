
window.addEventListener('pageshow', function (e) {
  if (e.persisted) document.body.classList.remove('leaving');
});
document.addEventListener('DOMContentLoaded', function () {
  /* header-hairline */
  var hd = document.querySelector('header');
  if (hd) { var hs = function(){ hd.classList.toggle('sc', window.scrollY > 4); };
    hs(); window.addEventListener('scroll', hs, { passive: true }); }
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

  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    document.querySelectorAll('.r').forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll('.r').forEach(function (el) { el.classList.add('in'); });
  }

  document.querySelectorAll('img.fx').forEach(function (im) { if (im.complete && im.naturalWidth) im.classList.add('ld'); });

  /* pinned viewing room */
  var vr = document.getElementById('vroom');
  if (vr && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var vs = vr.querySelectorAll('.vroom-slide');
    var vidx = vr.querySelectorAll('.vroom-idx span');
    var vcur = -1;
    var vtick = function () {
      var r = vr.getBoundingClientRect();
      var span = r.height - window.innerHeight;
      var p = Math.max(0, Math.min(0.9999, -r.top / span));
      var i = Math.floor(p * vs.length);
      if (i !== vcur) {
        vcur = i;
        vs.forEach(function (s, k) { s.classList.toggle('on', k === i); });
        vidx.forEach(function (s, k) { s.classList.toggle('on', k === i); });
      }
    };
    window.addEventListener('scroll', function(){ requestAnimationFrame(vtick); }, { passive: true });
    vs.forEach(function (s) { var im = s.querySelector('img'); if (im) { var w = new Image(); w.src = im.currentSrc || im.src; } });
    vtick();
  } else if (vr) {
    vr.querySelectorAll('.vroom-slide').forEach(function (s) { s.classList.add('on'); });
  }

  /* ink-in statement */
  var inkp = document.getElementById('inkp');
  if (inkp) {
    var words = inkp.textContent.trim().split(/\s+/);
    inkp.innerHTML = words.map(function (w) { return '<span class="w">' + w + '</span>'; }).join(' ');
    var spans = inkp.querySelectorAll('.w');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      spans.forEach(function (s) { s.classList.add('on'); });
    } else {
      var inkTick = function () {
        var r = inkp.getBoundingClientRect();
        var vh = window.innerHeight;
        var p = (vh * 0.82 - r.top) / (r.height + vh * 0.25);
        p = Math.max(0, Math.min(1, p));
        var n = Math.round(p * spans.length);
        spans.forEach(function (s, i) { s.classList.toggle('on', i < n); });
      };
      window.addEventListener('scroll', function(){ requestAnimationFrame(inkTick); }, { passive: true });
      inkTick();
    }
  }

  /* landing carousel */
  var hc = document.getElementById('hcar-track');
  if (hc) {
    var slides = hc.querySelectorAll('.hcar-slide');
    hc.querySelectorAll('img').forEach(function (im) {
      var w = new Image(); w.src = im.currentSrc || im.src;
      if (im.complete && im.naturalWidth) im.classList.add('ld');
    });
    var hpos = document.getElementById('hcar-pos');
    var hart = document.getElementById('hc-artist'), htit = document.getElementById('hc-title');
    var hcap = document.getElementById('hcar-cap');
    var sizeHcap = function () {
      var i = Math.round(hc.scrollLeft / hc.clientWidth);
      var s = slides[i]; if (!s) return;
      var im = s.querySelector('img');
      if (im && hcap && im.clientWidth) hcap.style.width = im.clientWidth + 'px';
    };
    var hupd = function () {
      var i = Math.round(hc.scrollLeft / hc.clientWidth);
      var s = slides[i]; if (!s) return;
      var a = s.querySelector('.hcar-work');
      if (hpos) hpos.textContent = ((i + 1) < 10 ? '0' : '') + (i + 1);
      if (a && hart) hart.textContent = a.getAttribute('data-artist') || '';
      if (a && htit) htit.textContent = a.getAttribute('data-title') || '';
      sizeHcap();
    };
    hc.addEventListener('scroll', function(){ requestAnimationFrame(hupd); }, { passive: true });
    window.addEventListener('load', sizeHcap);
    window.addEventListener('resize', function(){ setTimeout(sizeHcap, 120); }, { passive: true });
    var hby = function (d) { hc.scrollBy({ left: d * hc.clientWidth, behavior: 'smooth' }); };
    var zl = document.querySelector('.hcar-zone.l'), zr = document.querySelector('.hcar-zone.r');
    if (zl) zl.addEventListener('click', function(){ hby(-1); });
    if (zr) zr.addEventListener('click', function(){ hby(1); });
    hupd();
  }

  /* hero caption bound to artwork width */
  var hero = document.querySelector('.hero img'), hcap = document.querySelector('.hero-cap');
  if (hero && hcap) {
    var sizeHero = function () { if (hero.clientWidth) hcap.style.width = hero.clientWidth + 'px'; };
    sizeHero(); hero.addEventListener('load', sizeHero);
    window.addEventListener('resize', function(){ setTimeout(sizeHero, 100); }, { passive: true });
  }

  /* exhibition room */
  var exh = document.getElementById('exh');
  if (exh) {
    document.body.classList.add('exhpage');
    var slides = exh.querySelectorAll('.exh-slide');
    var pos = document.getElementById('exh-pos');
    var upd = function () {
      var i = Math.round(exh.scrollLeft / exh.clientWidth) + 1;
      if (pos) pos.textContent = (i < 10 ? '0' : '') + i;
    };
    exh.addEventListener('scroll', function(){ requestAnimationFrame(upd); }, { passive: true });
    exh.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        exh.scrollLeft += e.deltaY;
      }
    }, { passive: false });
    var by = function (dir) { exh.scrollBy({ left: dir * exh.clientWidth, behavior: 'smooth' }); };
    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') by(1);
      if (e.key === 'ArrowLeft') by(-1);
    });
    var al = document.querySelector('.exh-arrow.l'), ar = document.querySelector('.exh-arrow.r');
    if (al) al.addEventListener('click', function(){ by(-1); });
    if (ar) ar.addEventListener('click', function(){ by(1); });
    upd();
  }

  /* caption width = rendered artwork width (wall-label rule) */
  var sizeCaps = function () {
    document.querySelectorAll('.card').forEach(function (c) {
      var im = c.querySelector('.cim img'), cap = c.querySelector('.cap');
      if (im && cap && im.clientWidth) cap.style.width = im.clientWidth + 'px';
    });
  };
  sizeCaps();
  window.addEventListener('load', sizeCaps);
  setTimeout(sizeCaps, 600);
  document.querySelectorAll('.card .cim img').forEach(function (im) {
    im.addEventListener('load', sizeCaps);
  });
  var szT = null;
  window.addEventListener('resize', function () {
    clearTimeout(szT); szT = setTimeout(sizeCaps, 120);
  }, { passive: true });

  if (location.hash === '#inquire' && document.getElementById('drawer')) inq();
  if (document.getElementById('drawer')) {
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeInq(); });
  }

  var links = document.querySelectorAll('a[data-img]');
  if (links.length && window.matchMedia('(hover: hover)').matches) {
    var pv = document.createElement('div'); pv.id = 'apv';
    var pim = document.createElement('img'); pv.appendChild(pim); document.body.appendChild(pv);
    var px = 0, py = 0, cx = -1, cy = -1, raf = null;
    var place = function () {
      var w = pv.offsetWidth || 320, h = pv.offsetHeight || 240;
      var tx = Math.min(px + 36, window.innerWidth - w - 24);
      var ty = Math.min(Math.max(py - h / 2, 24), window.innerHeight - h - 24);
      if (cx < 0) { cx = tx; cy = ty; }
      cx += (tx - cx) * 0.22; cy += (ty - cy) * 0.22;
      pv.style.left = cx + 'px'; pv.style.top = cy + 'px';
      if (Math.abs(tx - cx) > .5 || Math.abs(ty - cy) > .5) raf = requestAnimationFrame(place);
      else raf = null;
    };
    var warm = function () { links.forEach(function (a) {
      var s = a.getAttribute('data-img'); if (s) { var i = new Image(); i.src = s; } }); };
    if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 3000 });
    else setTimeout(warm, 1500);
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

  var prefetched = {};
  var prefetch = function (href) {
    if (!href || prefetched[href] || /^(https?:|mailto:|tel:|#)/.test(href)) return;
    prefetched[href] = 1;
    var l = document.createElement('link'); l.rel = 'prefetch'; l.href = href;
    document.head.appendChild(l);
  };
  document.addEventListener('mouseover', function (e) {
    var a = e.target.closest ? e.target.closest('a[href]') : null;
    if (a) prefetch(a.getAttribute('href'));
  }, { passive: true });
  document.addEventListener('touchstart', function (e) {
    var a = e.target.closest ? e.target.closest('a[href]') : null;
    if (a) prefetch(a.getAttribute('href'));
  }, { passive: true });

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
  }

  var wi = document.querySelector('.work-img img'), lb = document.getElementById('lb');
  if (wi && lb) {
    wi.addEventListener('click', function(){
      if (!lb.querySelector('img')) {
        var src = wi.getAttribute('data-zoom') || wi.currentSrc || wi.src;
        var zi = document.createElement('img'); zi.src = src; zi.alt = wi.alt || '';
        lb.insertBefore(zi, lb.firstChild);
      }
      lb.classList.add('show'); document.body.style.overflow='hidden';
    });
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
function inqPre(kind){
  var t = document.getElementById('f-m');
  var title = (document.querySelector('input[name=artwork_title]')||{}).value || 'this work';
  var artist = (document.querySelector('input[name=artist]')||{}).value || '';
  var by = artist ? ' by ' + artist : '';
  if (t && kind === 'hold') t.value = 'I would like to place a 72-hour hold on ' + title + by + '. Please send the deposit link.';
  inq();
}
var _inqTrigger = null;
function inq(){
  _inqTrigger = document.activeElement;
  var d = document.getElementById('drawer');
  document.getElementById('scrim').classList.add('open');
  d.classList.add('open');
  d.setAttribute('aria-modal', 'true');
  var b = document.getElementById('inqbtn'); if (b) b.setAttribute('aria-expanded', 'true');
  document.body.style.overflow='hidden';
  setTimeout(function(){ var f=d.querySelector('input, textarea, button.dx'); if(f) f.focus(); }, 460);
  if (!d._trap) {
    d._trap = true;
    d.addEventListener('keydown', function(e){
      if (e.key !== 'Tab') return;
      var els = d.querySelectorAll('a[href], button:not([disabled]), input, select, textarea');
      if (!els.length) return;
      var first = els[0], last = els[els.length-1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    var form = d.querySelector('form');
    if (form) form.addEventListener('submit', function(){
      var sb = form.querySelector('button[type=submit]');
      if (sb) { sb.disabled = true; sb.textContent = 'SENDING…'; }
    });
  }
}
function closeInq(){ document.getElementById('scrim').classList.remove('open');
  var d = document.getElementById('drawer');
  d.classList.remove('open'); d.removeAttribute('aria-modal');
  var b = document.getElementById('inqbtn'); if (b) b.setAttribute('aria-expanded', 'false');
  document.body.style.overflow='';
  if (_inqTrigger && _inqTrigger.focus) _inqTrigger.focus();
}
function sendInq(e){ e.preventDefault();
  document.getElementById('inq').style.display='none';
  document.getElementById('inq-done').classList.add('show'); }
function newsl(e){ e.preventDefault(); e.target.innerHTML =
  '<span style="font-size:8px;letter-spacing:.22em;">THANK YOU</span>'; }
