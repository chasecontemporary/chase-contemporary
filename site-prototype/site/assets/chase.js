
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

  var wi = document.querySelector('.work-img img'), lb = document.getElementById('lb');
  if (wi && lb) {
    wi.addEventListener('click', function(){ lb.classList.add('show'); document.body.style.overflow='hidden'; });
    var close = function(){ lb.classList.remove('show'); document.body.style.overflow=''; };
    lb.addEventListener('click', close);
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape') close(); });
  }
});
function vmode(m){ document.getElementById('iv').classList.toggle('hid', m===1);
  document.getElementById('sv').classList.toggle('show', m===1);
  document.getElementById('tb-i').classList.toggle('on', m===0);
  document.getElementById('tb-s').classList.toggle('on', m===1); }
function inq(btn){ document.getElementById('inq').classList.add('show'); if(btn) btn.style.display='none';
  setTimeout(function(){ var f=document.querySelector('#inq input'); if(f) f.focus(); }, 350); }
function sendInq(e){ e.preventDefault();
  document.getElementById('inq').classList.remove('show');
  document.getElementById('inq-done').classList.add('show'); }
function newsl(e){ e.preventDefault(); e.target.innerHTML =
  '<span style="font-size:8px;letter-spacing:.22em;">THANK YOU</span>'; }
