'use client';
// Branded select. submit -> auto-submits its form on change (GET filter forms only).
export default function Sel({ submit, className = '', ...props }) {
  return <select {...props} className={('sel ' + className).trim()}
    onChange={submit ? (e) => e.target.form?.requestSubmit() : props.onChange} />;
}
