
document.addEventListener('DOMContentLoaded', function () {
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
