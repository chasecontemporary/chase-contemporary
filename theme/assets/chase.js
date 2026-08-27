
window.addEventListener('pageshow', function (e) {
  if (e.persisted) document.body.classList.remove('leaving');
});
if ('CSSViewTransitionRule' in window) document.documentElement.style.setProperty('--pagein-skip', '1');
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

  /* full-journey trail: stable anonymous visitor id + page-view beacon.
     Anonymous until they inquire — then the whole trail stitches to their record. */
  var CC_VID = null;
  try {
    CC_VID = localStorage.getItem('cc_vid');
    if (!CC_VID || !/^v-[a-z0-9]{8,40}$/.test(CC_VID)) {
      CC_VID = 'v-' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
      localStorage.setItem('cc_vid', CC_VID);
    }
    if (navigator.sendBeacon) navigator.sendBeacon(
      'https://chase-engine.vercel.app/api/visit',
      JSON.stringify({ v: CC_VID, p: location.pathname,
        r: document.referrer || '', u: location.search || '' }));
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

  /* gallery view: A = structured auto-carousel, B = staggered swipe canvas */
  var fca = document.getElementById('fcanvas'), fct = document.getElementById('fc-track');
  if (fca && fct) {
    var gmode = 'a';
    var fitems = Array.prototype.slice.call(fct.children);
    fitems.sort(function(){ return Math.random() - 0.5; });
    fct.innerHTML = '';
    fct.classList.add('fc-row');
    fitems.forEach(function (it) { fct.appendChild(it); });
    var fBase = 0;
    Array.prototype.slice.call(fct.children).forEach(function (p) {
      var c = p.cloneNode(true); c.setAttribute('aria-hidden', 'true'); fct.appendChild(c);
    });
    fct.querySelectorAll('.card, .r').forEach(function (c) { c.classList.add('in'); });
    var rmq = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var fx = 0, fvx = 0, fdrift = (gmode === 'a' && !rmq) ? 0.4 : 0;
    var fdrag = false, flx = 0, fmoved = false;
    var fwrap = function () {
      if (!fBase) fBase = fct.scrollWidth / 2;
      if (fx >= fBase) fx -= fBase;
      if (fx < 0) fx += fBase;
    };
    var floop = function () {
      if (!fdrag) { fx += fdrift + fvx; fvx *= 0.93; if (Math.abs(fvx) < .02) fvx = 0; }
      fwrap();
      fct.style.transform = 'translateX(' + (-fx) + 'px)';
      requestAnimationFrame(floop);
    };
    requestAnimationFrame(floop);
    if (gmode === 'a') {
      fca.addEventListener('mouseenter', function(){ fdrift = 0; });
      fca.addEventListener('mouseleave', function(){ if (!rmq) fdrift = 0.4; });
    }
    fca.addEventListener('pointerdown', function (e) {
      fdrag = true; fmoved = false; flx = e.clientX; fca.classList.add('dragging');
    });
    window.addEventListener('pointermove', function (e) {
      if (!fdrag) return;
      var d = e.clientX - flx; flx = e.clientX;
      if (Math.abs(d) > 2) fmoved = true;
      fx -= d; fvx = -d * 0.55; fwrap();
      fct.style.transform = 'translateX(' + (-fx) + 'px)';
    });
    window.addEventListener('pointerup', function(){ fdrag = false; fca.classList.remove('dragging'); });
    fca.addEventListener('click', function (e) {
      if (fmoved) { e.preventDefault(); e.stopPropagation(); fmoved = false; }
    }, true);
    fca.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { e.preventDefault(); fx += e.deltaX; fwrap();
        fct.style.transform = 'translateX(' + (-fx) + 'px)'; }
    }, { passive: false });
    fct.querySelectorAll('img').forEach(function (im) {
      im.setAttribute('loading', 'eager');
      if (im.complete && im.naturalWidth) im.classList.add('ld');
      im.addEventListener('load', function(){ im.classList.add('ld'); fBase = fct.scrollWidth / 2; });
    });
  }

  /* ink-in text (any .inkfx element) */
  var inks = Array.prototype.slice.call(document.querySelectorAll('.inkfx, #inkp'));
  if (inks.length) {
    var rmInk = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    inks.forEach(function (el) {
      var words = el.textContent.trim().split(/\s+/);
      el.innerHTML = words.map(function (w) { return '<span class="w">' + w + '</span>'; }).join(' ');
      el._spans = el.querySelectorAll('.w');
      if (rmInk) el._spans.forEach(function (s) { s.classList.add('on'); });
    });
    if (!rmInk) {
      var inkTick = function () {
        var vh = window.innerHeight;
        inks.forEach(function (el) {
          var r = el.getBoundingClientRect();
          if (r.bottom < -100 || r.top > vh + 100) return;
          var p = (vh * 0.82 - r.top) / (r.height + vh * 0.25);
          p = Math.max(0, Math.min(1, p));
          var n = Math.max(Math.round(p * el._spans.length), el._floor || 0);
          for (var i = 0; i < el._spans.length; i++) el._spans[i].classList.toggle('on', i < n);
        });
      };
      window.addEventListener('scroll', function(){ requestAnimationFrame(inkTick); }, { passive: true });
      /* elements visible at load: timed cascade instead of instant */
      var vh0 = window.innerHeight;
      inks.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < vh0 * 0.85 && r.bottom > 0) {
          el._floor = 0;
          var t0 = null, dur = 1200 + el._spans.length * 6;
          var step = function (ts) {
            if (!t0) t0 = ts;
            var q = Math.min(1, (ts - t0) / dur);
            q = 1 - Math.pow(1 - q, 2.2);
            el._floor = Math.round(q * el._spans.length);
            inkTick();
            if (q < 1) requestAnimationFrame(step);
          };
          setTimeout(function(){ requestAnimationFrame(step); }, 350);
        }
      });
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
      if (im && cap && im.clientWidth) cap.style.width = Math.max(im.clientWidth, 210) + 'px';
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
    if (!('CSSViewTransitionRule' in window)) {
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
  }

  /* engine bridge: mirror inquiry submissions into the CRM backbone */
  var ENGINE = 'https://chase-engine.vercel.app/api/inquiry';
  document.querySelectorAll('form#inq, form#cf').forEach(function (f) {
    f.addEventListener('submit', function () {
      try {
        var payload = {};
        new FormData(f).forEach(function (v, k) {
          var m = k.match(/^contact\[(.+)\]$/);
          payload[m ? m[1] : k] = v;
        });
        if (CC_VID) payload.visitor_id = CC_VID;
        fetch(ENGINE, {
          method: 'POST', keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(function(){});
      } catch (e) {}
    });
  });

  /* branded dropdowns (delegated; supports dynamic lists) */
  document.addEventListener('click', function (e) {
    var opt = e.target.closest ? e.target.closest('.dd-list button') : null;
    if (opt) {
      e.stopPropagation();
      var dd = opt.closest('.dd');
      var hid = dd.querySelector('input[type=hidden]');
      var btn = dd.querySelector('.dd-btn');
      if (hid) hid.value = opt.getAttribute('data-v') || '';
      btn.textContent = opt.textContent;
      dd.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      if (hid) hid.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    var b = e.target.closest ? e.target.closest('.dd-btn') : null;
    if (b) {
      e.stopPropagation();
      var d = b.closest('.dd');
      document.querySelectorAll('.dd.open').forEach(function (o) { if (o !== d) o.classList.remove('open'); });
      d.classList.toggle('open');
      b.setAttribute('aria-expanded', d.classList.contains('open') ? 'true' : 'false');
      return;
    }
    document.querySelectorAll('.dd.open').forEach(function (o) { o.classList.remove('open'); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') document.querySelectorAll('.dd.open').forEach(function (o) { o.classList.remove('open'); });
  });

  /* multi-purpose contact routing */
  var cfp = document.getElementById('cf-purpose');
  if (cfp) {
    var worksData = {};
    try { worksData = JSON.parse(document.getElementById('cf-works').textContent); } catch (e) {}
    var acq = document.getElementById('cf-acq'), prs = document.getElementById('cf-press');
    var msg = document.getElementById('cf-m');
    var artistHid = document.getElementById('cf-artist'), workHid = document.getElementById('cf-work');
    var setMsg = function () {
      var p = cfp.value, a = artistHid.value, w = workHid.value;
      if (p === 'Acquiring a work') {
        msg.value = 'I am interested in ' + (w ? w : (a ? 'works by ' + a : 'acquiring a work')) +
          (w && a ? ' by ' + a : '') + '. Please send availability and payment options.';
      } else if (p === 'Press and media') {
        msg.value = 'Press inquiry: ';
      } else if (p === 'Trade partnership') {
        msg.value = 'I am purchasing on behalf of a client. ';
      } else if (p) { msg.value = ''; }
    };
    cfp.addEventListener('change', function () {
      var v = cfp.value;
      acq.classList.toggle('show', v === 'Acquiring a work');
      prs.classList.toggle('show', v === 'Press and media');
      var tr = document.getElementById('cf-trade');
      if (tr && v === 'Trade partnership') tr.checked = true;
      setMsg();
    });
    artistHid.addEventListener('change', function () {
      var list = document.querySelector('#dd-work .dd-list');
      var works = worksData[artistHid.value] || [];
      var htmls = ['<button type="button" data-v="">ANY WORK</button>'];
      works.forEach(function (w) {
        htmls.push('<button type="button" data-v="' + w.t.replace(/"/g, '&quot;') + '">' + w.t.toUpperCase() + '</button>');
      });
      list.innerHTML = htmls.join('');
      workHid.value = '';
      document.querySelector('#dd-work .dd-btn').textContent = 'ANY WORK';
      setMsg();
    });
    workHid.addEventListener('change', setMsg);
  }

  /* frictionless auto-enrichment */
  try {
    var setv = function (id, v) { var el = document.getElementById(id); if (el) el.value = v; };
    setv('cc-tz', (Intl.DateTimeFormat().resolvedOptions().timeZone) || '');
    setv('cc-loc', navigator.language || '');
    setv('cc-dev', window.matchMedia('(pointer: coarse)').matches ? 'mobile' : 'desktop');
  } catch (e) {}

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

function bioToggle(btn){
  var m = btn.previousElementSibling;
  var open = m.classList.toggle('open');
  btn.textContent = open ? 'READ LESS' : 'CONTINUE READING';
}
function exToggle(head){
  head.parentElement.classList.toggle('open');
}
