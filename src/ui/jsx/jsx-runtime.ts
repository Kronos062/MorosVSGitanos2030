import { jsx as _jsx, jsxs as _jsxs, Fragment } from 'react/jsx-runtime';
import { iconizeChildren } from '../iconize';

/**
 * Envoltorio del runtime de JSX: sustituye emojis por iconos pixel art en el texto de los elementos DOM.
 * No toca atributos, <option>, <textarea>, <title> ni <style>/<script> (no admiten elementos hijos).
 */
export type { JSX } from 'react/jsx-runtime';
export { Fragment };

const SKIP = new Set(['option', 'textarea', 'title', 'style', 'script', 'input', 'select']);

type Props = Record<string, unknown> | null | undefined;
function fix(type: unknown, props: Props): Props {
  if (typeof type !== 'string' || SKIP.has(type) || !props || props.children === undefined) return props;
  const next = iconizeChildren(props.children);
  return next === props.children ? props : { ...props, children: next };
}

export const jsx = ((type: unknown, props: Props, key?: unknown) => (_jsx as Function)(type, fix(type, props), key)) as typeof _jsx;
export const jsxs = ((type: unknown, props: Props, key?: unknown) => (_jsxs as Function)(type, fix(type, props), key)) as typeof _jsxs;
