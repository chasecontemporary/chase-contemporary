// Listing readiness: what a work must have before it can be pushed to the site.
export function listingGaps(a) {
  const gaps = [];
  if (!a.image_url) gaps.push('image');
  if (!a.artist) gaps.push('artist');
  if (!a.title || a.title === 'Untitled') gaps.push('title');
  if (!a.medium) gaps.push('medium');
  if (!(a.dims_h_in > 0 && a.dims_w_in > 0)) gaps.push('dimensions');
  if (!(a.price_cents > 0 || a.internal_value_cents > 0)) gaps.push('price or internal estimate');
  return gaps;
}

// Minimum image resolution for the site (the gallery-walk sharpness rule, applied at the gate).
export const MIN_IMAGE_PX = 1200;

// Probe JPEG/PNG dimensions from the first bytes without downloading the whole file.
export async function probeImageWidth(url) {
  try {
    const res = await fetch(url, { headers: { Range: 'bytes=0-65535' } });
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47)          // PNG
      return buf.readUInt32BE(16);
    let i = 2;                                                           // JPEG: scan SOF markers
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc)
        return buf.readUInt16BE(i + 7);
      i += 2 + buf.readUInt16BE(i + 2);
    }
  } catch { /* unreachable image counts as unknown */ }
  return null;
}
