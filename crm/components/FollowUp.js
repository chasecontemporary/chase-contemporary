'use client';

// One-click follow-up: opens a stage-appropriate email draft in the rep's mail client
// and advances the chase stage. Draft only. Nothing sends itself.
const NEXT = { issued: 'sent', sent: 'fu1', fu1: 'fu2', fu2: 'fu3', fu3: 'fu3' };
const LABEL = { issued: 'Draft invoice email', sent: 'Draft follow-up 1', fu1: 'Draft follow-up 2', fu2: 'Draft follow-up 3', fu3: 'Draft another follow-up' };

function body(stage, { name, num, balance, pdf, docs }) {
  const first = name ? name.split(' ')[0] : 'there';
  const links = [pdf ? 'Invoice: ' + pdf : null, ...docs.map(d => d.label + ': ' + d.url)].filter(Boolean).join('\n');
  const sign = '\n\nWarm regards,\nChase Contemporary\ninfo@chasecontemporary.com';
  if (stage === 'issued') return `Dear ${first},\n\nThank you again. Please find your invoice below, with everything needed for the acquisition.\n\n${links}\n\nThe balance of ${balance} can be settled by wire, referenced to Invoice No. ${num}. We are happy to assist with anything at all.${sign}`;
  if (stage === 'sent') return `Dear ${first},\n\nJust making sure the invoice reached you well. The details are linked below for convenience.\n\n${links}\n\nIf any questions have come up about the work or delivery, we would love to help.${sign}`;
  if (stage === 'fu1') return `Dear ${first},\n\nFollowing up on Invoice No. ${num}. The remaining balance is ${balance}, and wire details are on the invoice linked below.\n\n${links}\n\nOnce payment is received, the certificate of authenticity is prepared and the work ships to you.${sign}`;
  return `Dear ${first},\n\nChecking in once more on Invoice No. ${num}, with a balance of ${balance}. We want to make sure nothing is standing in the way on our side.\n\n${links}\n\nA quick call is easy to arrange if that is simpler.${sign}`;
}

export default function FollowUp({ id, stage, email, name, num, balance, pdf, docs = [] }) {
  const s = stage || 'issued';
  const go = async (e) => {
    e.preventDefault(); e.stopPropagation();
    const subject = `Invoice No. ${num} — Chase Contemporary`.replace(' — ', ' - ');
    const mail = 'mailto:' + (email || '') + '?subject=' + encodeURIComponent(subject)
      + '&body=' + encodeURIComponent(body(s, { name, num, balance, pdf, docs }));
    window.open(mail, '_self');
    const fd = new FormData();
    fd.set('action', 'invoice_ar'); fd.set('id', id); fd.set('ar_status', NEXT[s]); fd.set('back', 'json');
    await fetch('/api/act', { method: 'POST', body: fd });
    setTimeout(() => window.location.reload(), 600);
  };
  return <button onClick={go} className="btn mini quiet">{LABEL[s]}</button>;
}
