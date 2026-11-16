import { jsxDEV as _jsxDEV, Fragment } from 'react/jsx-dev-runtime';
import { iconizeChildren } from '../iconize';

export type { JSX } from 'react/jsx-dev-runtime';
export { Fragment };

const SKIP = new Set(['option', 'textarea', 'title', 'style', 'script', 'input', 'select']);

type Props = Record<string, unknown> | null | undefined;
export const jsxDEV = ((type: unknown, props: Props, ...rest: unknown[]) => {
  let p = props;
  if (typeof type === 'string' && !SKIP.has(type) && p && p.children !== undefined) {
    const next = iconizeChildren(p.children);
    if (next !== p.children) p = { ...p, children: next };
  }
  return (_jsxDEV as Function)(type, p, ...rest);
}) as typeof _jsxDEV;
