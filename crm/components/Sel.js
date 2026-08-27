'use client';
import BrandSelect from './BrandSelect';

// Filter select: branded trigger + branded menu, auto-submits its form on pick.
export default function Sel({ name, options = [], defaultValue = '', placeholder, submit = true, width }) {
  return <BrandSelect name={name} options={options} defaultValue={defaultValue}
    placeholder={placeholder} submit={submit} width={width}/>;
}
