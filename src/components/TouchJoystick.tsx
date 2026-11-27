import { useEffect, useRef } from 'react';
import type { PointerEvent } from 'react';

export function TouchJoystick({ onMove }: { onMove: (x: number, y: number) => void }) {
  const origin = useRef<{ id: number; x: number; y: number } | null>(null);
  const handler = useRef(onMove);
  handler.current = onMove;
  useEffect(() => () => handler.current(0, 0), []);

  const end = (event: PointerEvent<HTMLDivElement>) => {
    if (origin.current?.id !== event.pointerId) return;
    origin.current = null;
    onMove(0, 0);
  };

  return <div className="joystick" aria-hidden="true"
    onPointerDown={event => {
      if (origin.current) return;
      origin.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => {
      const anchor = origin.current;
      if (!anchor || event.pointerId !== anchor.id) return;
      const dx = event.clientX - anchor.x;
      const dy = event.clientY - anchor.y;
      const length = Math.hypot(dx, dy);
      const speed = Math.min(1, Math.max(0, (length - 4) / 24));
      const scale = length > 0 ? speed / length : 0;
      onMove(dx * scale, dy * scale);
    }}
    onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} />;
}
