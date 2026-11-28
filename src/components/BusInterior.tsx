import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { spriteAtlas } from '../game/sprites/spriteAtlas';

export type BusPoint = { x: number; depth: number };
const ROWS = [.30, .52, .74];
const WIDTH = 320;
const HEIGHT = 180;

function project({ x, depth }: BusPoint) {
  return { x: 281 - depth * 247, y: 81 + x * 42 };
}

export function busPlacement(point: BusPoint): CSSProperties {
  const pixel = project(point);
  return { left: `${pixel.x / WIDTH * 100}%`, top: `${pixel.y / HEIGHT * 100}%` };
}

export function busWalkable({ x, depth }: BusPoint) {
  return Math.abs(x) <= .93 && depth >= .12 && depth <= .96 &&
    (Math.abs(x) <= .38 || ROWS.every(row => Math.abs(depth - row) > .064));
}

function paintBus(ctx: CanvasRenderingContext2D, tick: number) {
  const rect = (color: string, x: number, y: number, width: number, height: number) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), width, height);
  };
  rect('#354337', 0, 0, WIDTH, HEIGHT);
  rect('#4c5755', 0, 38, WIDTH, 142);
  rect('#262e35', 0, 48, WIDTH, 119);
  rect('#a59a6e', 0, 53, WIDTH, 2);
  rect('#92886a', 0, 159, WIDTH, 2);
  for (let stripe = -1; stripe < 10; stripe++) {
    const x = stripe * 38 - tick % 38;
    rect('#cbb275', x, 148, 21, 2);
    rect('#35464c', x + 13, 141, 4, 1);
    rect('#68756b', x + 21, 34, 6, 1);
  }

  // El bus se mantiene fijo. La carretera pasa por debajo de las ruedas.
  rect('#202b31', 25, 40, 268, 103);
  rect('#2d3c43', 21, 48, 278, 85);
  rect('#5a756f', 26, 40, 262, 87);
  rect('#a8afa0', 31, 38, 251, 6);
  rect('#3d555a', 31, 44, 254, 79);
  rect('#455865', 38, 48, 245, 71);
  rect('#53626d', 38, 68, 245, 26);
  for (let x = 39; x < 280; x += 6) {
    for (let y = 51; y < 119; y += 5) {
      rect((x + y) % 3 === 0 ? '#76807c' : '#60717a', x, y, 1, 1);
    }
  }
  rect('#aaa489', 39, 67, 244, 1);
  rect('#aaa489', 39, 94, 244, 1);
  for (let x = 42; x < 274; x += 27) {
    rect('#21343e', x, 43, 23, 6);
    rect('#8fbdc2', x + 1, 44, 21, 3);
    rect('#d1e3dc', x + 1, 44, 7, 1);
  }

  for (const depth of ROWS) {
    const { x } = project({ x: 0, depth });
    for (const y of [51, 99]) {
      rect('#233844', x - 12, y - 1, 25, 20);
      rect('#24576a', x - 10, y, 21, 17);
      rect('#387486', x - 8, y + 2, 16, 12);
      rect('#68a2a5', x - 7, y + 2, 12, 1);
      rect('#193a4a', x + 7, y + 1, 3, 15);
      rect('#bb964e', x - 10, y + (y === 51 ? 15 : 1), 3, 3);
    }
  }

  rect('#25373e', 265, 44, 20, 52);
  rect('#90bebf', 281, 46, 5, 37);
  rect('#becfbc', 283, 48, 2, 10);
  rect('#6f9188', 263, 49, 4, 21);
  rect('#647889', 232, 49, 14, 20);
  rect('#242732', 234, 53, 14, 13);
  rect('#3f2c58', 237, 54, 12, 11);
  rect('#352a2c', 245, 55, 7, 9);
  rect('#ae785b', 249, 57, 3, 5);
  rect('#202a31', 254, 54, 8, 10);
  rect('#9aa69b', 256, 55, 3, 8);
  rect('#d2bf72', 264, 61, 2, 3);

  rect('#1e313b', 230, 101, 23, 27);
  rect('#7e9791', 232, 103, 19, 20);
  rect('#bacdc2', 233, 104, 17, 6);
  rect('#3c535a', 240, 103, 1, 22);
  rect('#d4b77b', 231, 123, 21, 2);

  rect('#688681', 30, 121, 198, 6);
  rect('#688681', 254, 121, 38, 6);
  rect('#9daba2', 31, 121, 195, 2);
  rect('#a84d49', 23, 102, 5, 9);
  rect('#c9d2aa', 291, 100, 6, 8);
  for (const x of [63, 259]) {
    rect('#181f26', x - 14, 123, 28, 15);
    rect('#14191f', x - 11, 127, 22, 15);
    rect('#353f45', x - 7, 130, 14, 10);
    rect('#718087', x - 4, 132, 8, 6);
    rect('#273137', x - 2, 133, 4, 4);
    rect('#aeb5a5', x - 1 + (tick % 6 >= 3 ? 3 : 0), 132, 2, 2);
  }
}

export function BusInterior() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    paintBus(ctx, 0);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let tick = 0;
    const timer = window.setInterval(() => {
      if (!motion.matches) paintBus(ctx, tick += 3);
    }, 90);
    return () => window.clearInterval(timer);
  }, []);

  return <canvas className="bus-architecture" ref={canvasRef} width={WIDTH} height={HEIGHT} aria-hidden="true" />;
}

export function BusActor({ id, point, face }: { id: string; point: BusPoint; face: BusPoint }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pose = useRef({ point, face });
  pose.current = { point, face };
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const actor = {};
    let frame = 0;
    const paint = (time: number) => {
      ctx.clearRect(0, 0, 80, 80);
      const { point: current, face: direction } = pose.current;
      spriteAtlas.drawCharacter(ctx, id, actor, 40, 57, {
        now: time / 1000, hp: 1, faceX: direction.x, faceY: direction.depth,
        trackX: current.x * 320, trackY: current.depth * 320,
      });
      frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [id]);
  return <canvas className="bus-actor" ref={canvasRef} width={80} height={80} aria-hidden="true" />;
}
