
function inq(){ var f=document.getElementById('inq'); f.classList.add('show');
  document.getElementById('inqbtn').style.display='none'; }
function sendInq(e){ e.preventDefault();
  alert('PROTOTYPE — in production this submits to the gallery CRM with full artwork context attached.'); }
