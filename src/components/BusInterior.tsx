import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { spriteAtlas } from '../game/sprites/spriteAtlas';

export type BusPoint = { x: number; depth: number };
const ROWS = [.30, .52, .74];
const WIDTH = 320;
const HEIGHT = 180;

function project({ x, depth }: BusPoint) {
  return { x: 160 + x * 108, y: 22 + depth * 145 };
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
  rect('#111a23', 0, 0, WIDTH, HEIGHT);
  rect('#283039', 32, 0, 256, 180);
  for (let stripe = -1; stripe < 8; stripe++) {
    const y = stripe * 31 + tick % 31;
    rect('#cbb275', 39, y, 2, 13);
    rect('#cbb275', 279, y, 2, 13);
    rect('#35424b', 34, y + 8, 3, 4);
    rect('#35424b', 283, y + 8, 3, 4);
  }

  rect('#121e25', 46, 4, 228, 171);
  rect('#617775', 49, 7, 222, 165);
  rect('#404d59', 54, 34, 212, 130);
  rect('#4b5965', 119, 34, 82, 128);
  for (let y = 41; y < 164; y += 6) {
    for (let x = 56 + (y % 4); x < 265; x += 7) {
      rect((x + y) % 5 === 0 ? '#9f9775' : '#586774', x, y, 1, 1);
    }
  }
  rect('#90a5a1', 118, 37, 1, 122);
  rect('#90a5a1', 201, 37, 1, 122);

  for (const x of [49, 266]) {
    for (let y = 39; y <= 145; y += 19) {
      rect('#222d37', x, y, 5, 15);
      rect('#89bbc1', x + 1, y + 2, 3, 11);
      rect('#cee6da', x + 1, y + 3, 3, 2);
    }
  }

  rect('#d3caab', 52, 7, 216, 4);
  rect('#223a42', 57, 11, 206, 8);
  rect('#a5cacc', 59, 12, 202, 4);
  rect('#d3ebe1', 98, 13, 112, 2);
  rect('#314953', 63, 20, 155, 9);
  rect('#263942', 64, 28, 154, 3);
  rect('#8cc1a6', 132, 23, 18, 2);
  rect('#d4ad60', 153, 23, 6, 2);

  rect('#17262d', 100, 24, 10, 2);
  rect('#17262d', 98, 26, 2, 5);
  rect('#17262d', 110, 26, 2, 5);
  rect('#17262d', 100, 31, 10, 2);
  rect('#534b42', 96, 38, 19, 10);
  rect('#202732', 96, 34, 19, 9);
  rect('#343849', 100, 29, 11, 10);
  rect('#525263', 101, 29, 9, 2);
  rect('#7a6d5d', 96, 32, 3, 4);
  rect('#7a6d5d', 112, 32, 3, 4);

  rect('#253f46', 236, 18, 29, 32);
  rect('#839c99', 238, 21, 25, 25);
  rect('#a9c7c2', 240, 23, 9, 11);
  rect('#a9c7c2', 252, 23, 9, 11);
  rect('#344d55', 250, 20, 1, 27);
  rect('#d8b76c', 237, 47, 28, 2);

  for (const depth of ROWS) {
    const y = project({ x: 0, depth }).y;
    for (const x of [57, 207]) {
      rect('#303b46', x - 1, y - 8, 57, 20);
      rect('#2d4c58', x, y - 8, 55, 18);
      rect('#286477', x + 3, y - 6, 49, 13);
      rect('#458492', x + 4, y - 5, 47, 3);
      rect('#6fa0a5', x + 5, y - 5, 43, 1);
      rect('#1d4152', x + 3, y + 6, 49, 3);
      rect('#244d5e', x + 27, y - 6, 2, 13);
      rect('#c19a52', x === 57 ? x + 53 : x, y - 9, 3, 19);
    }
  }
  rect('#78918d', 53, 166, 214, 3);
  rect('#c3a570', 122, 163, 76, 1);
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
