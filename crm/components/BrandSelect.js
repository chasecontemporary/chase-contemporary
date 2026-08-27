'use client';
import { useEffect, useRef, useState } from 'react';

// THE dropdown. Branded trigger AND branded menu (native select menus are OS-drawn and
// off-brand, so we draw our own). Menu is fixed-positioned so it never clips inside
// summaries, tables, or overflow containers. Works in server forms via a hidden input.
//
// Props: name (form field) · options [[value, label]] · defaultValue · value (controlled)
// onValue(v) · submit (auto-submit owning form on pick) · placeholder
// pill (compact colored-pill trigger) · pillColor(v) => css color · width
export default function BrandSelect({ name, options = [], defaultValue = '', value, onValue,
  submit = false, placeholder, pill = false, pillColor, width }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(value !== undefined ? value : defaultValue);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const inputRef = useRef(null);
  const menuRef = useRef(null);
  useEffect(() => { if (value !== undefined) setVal(value); }, [value]);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const key = (e) => e.key === 'Escape' && setOpen(false);
    const scroll = (e) => { if (!menuRef.current || !menuRef.current.contains(e.target)) setOpen(false); };
    window.addEventListener('click', close);
    window.addEventListener('keydown', key);
    window.addEventListener('scroll', scroll, true);
    return () => { window.removeEventListener('click', close);
      window.removeEventListener('keydown', key); window.removeEventListener('scroll', scroll, true); };
  }, [open]);
  const toggle = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const menuW = Math.max(r.width, 170);
      setPos({ top: r.bottom + 6, left: Math.min(r.left, window.innerWidth - menuW - 12), width: menuW });
    }
    setOpen(o => !o);
  };
  const pick = (e, v) => {
    e.preventDefault(); e.stopPropagation();
    setVal(v); setOpen(false); onValue?.(v);
    if (submit) setTimeout(() => inputRef.current?.form?.requestSubmit(), 0);
  };
  const current = options.find(o => String(o[0]) === String(val));
  const label = current ? current[1] : (placeholder || 'Choose…');
  const trigStyle = pill
    ? { appearance:'none', border:0, borderRadius:99, height:24, padding:'0 9px 0 11px',
        background: (pillColor ? pillColor(val) : '#8e8e93'), color:'#fff', fontFamily:'inherit',
        fontSize:10.5, fontWeight:700, letterSpacing:'.04em', textTransform:'uppercase',
        cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6, whiteSpace:'nowrap' }
    : { appearance:'none', background:'#fff', border:'1px solid #e8e8ed', borderRadius:10,
        height:36, padding:'0 12px', fontFamily:'inherit', fontSize:12.5, color: current ? '#1d1d1f' : '#86868b',
        cursor:'pointer', display:'inline-flex', alignItems:'center', gap:8, whiteSpace:'nowrap',
        width: width || 'auto', justifyContent:'space-between' };
  const chev = <svg width="9" height="6" viewBox="0 0 10 6" style={{flex:'0 0 auto'}}>
    <path d="M1 1l4 4 4-4" fill="none" stroke={pill ? '#fff' : '#6e6e73'} strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round"/></svg>;
  return <>
    {name && <input ref={inputRef} type="hidden" name={name} value={val}/>}
    <button type="button" ref={btnRef} onClick={toggle} style={trigStyle}>
      <span style={{overflow:'hidden', textOverflow:'ellipsis'}}>{label}</span>{chev}
    </button>
    {open && pos && <div ref={menuRef} onClick={(e) => e.stopPropagation()} style={{position:'fixed', top:pos.top, left:pos.left,
      minWidth:pos.width, zIndex:90, background:'#fff', border:'1px solid #ececf0', borderRadius:12,
      boxShadow:'0 12px 40px rgba(0,0,0,.14)', padding:6, maxHeight:320, overflowY:'auto'}}>
      {options.map(([v, l]) => {
        const active = String(v) === String(val);
        return <button key={v} type="button" onClick={(e) => pick(e, v)}
          style={{display:'flex', width:'100%', alignItems:'center', gap:8, textAlign:'left',
            padding:'8px 10px', border:0, borderRadius:8, cursor:'pointer', fontFamily:'inherit',
            fontSize:13, fontWeight: active ? 650 : 450, color:'#1d1d1f',
            background: active ? '#f0f0f2' : 'transparent'}}
          onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f7'}
          onMouseLeave={(e) => e.currentTarget.style.background = active ? '#f0f0f2' : 'transparent'}>
          <span style={{width:14, color:'#0071e3', fontWeight:700}}>{active ? '✓' : ''}</span>{l}
        </button>; })}
    </div>}
  </>;
}
