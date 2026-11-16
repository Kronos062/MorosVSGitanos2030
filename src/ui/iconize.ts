import { jsx } from 'react/jsx-runtime';
import type { ReactNode } from 'react';
import { ICON_BITMAPS, ICON_PALETTE } from './iconData';
import { EMOJI_TO_ICON } from './iconMap';

/**
 * Sustituye emojis conocidos por iconos pixel art de 16×16.
 * Cada icono es una imagen SVG (rectángulos de píxel, crispEdges) que se pinta como fondo
 * del <span class="px-ico">; con tamaños enteros (16, 32) los píxeles quedan nítidos.
 */

const uriCache = new Map<string, string>();
function iconUri(name: string): string | null {
  const hit = uriCache.get(name);
  if (hit) return hit;
  const rows = ICON_BITMAPS[name];
  if (!rows) return null;
  let rects = '';
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.') { x++; continue; }
      let x2 = x;
      while (x2 + 1 < row.length && row[x2 + 1] === ch) x2++;
      rects += `<rect x='${x}' y='${y}' width='${x2 - x + 1}' height='1' fill='${ICON_PALETTE[ch]}'/>`;
      x = x2 + 1;
    }
  });
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'>${rects}</svg>`;
  const uri = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  uriCache.set(name, uri);
  return uri;
}

const EMOJI_RE = new RegExp(
  `(${Object.keys(EMOJI_TO_ICON).map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\ufe0f?`,
  'gu',
);

const textCache = new Map<string, ReactNode[] | null>();

/** Devuelve la lista de nodos (texto + iconos) o null si el texto no contiene emojis mapeados. */
export function iconizeText(text: string): ReactNode[] | null {
  const cached = textCache.get(text);
  if (cached !== undefined) return cached;
  EMOJI_RE.lastIndex = 0;
  let last = 0;
  let m: RegExpExecArray | null;
  let out: ReactNode[] | null = null;
  while ((m = EMOJI_RE.exec(text))) {
    const name = EMOJI_TO_ICON[m[1]];
    const uri = name ? iconUri(name) : null;
    if (!uri) continue;
    out ??= [];
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(jsx('span', { className: `px-ico px-ico-${name}`, style: { backgroundImage: uri }, 'aria-hidden': true }, `ico${m.index}`));
    last = m.index + m[0].length;
  }
  if (out && last < text.length) out.push(text.slice(last));
  if (textCache.size > 2000) textCache.clear();
  textCache.set(text, out);
  return out;
}

export function iconizeChildren(children: unknown): unknown {
  if (typeof children === 'string') return iconizeText(children) ?? children;
  if (Array.isArray(children)) {
    let changed = false;
    const mapped = children.map((c) => {
      if (typeof c === 'string') {
        const r = iconizeText(c);
        if (r) { changed = true; return r; }
      }
      return c;
    });
    return changed ? mapped : children;
  }
  return children;
}
