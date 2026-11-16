import assert from 'node:assert/strict';
import { DEFAULT_STORED_DIRS, dirFromVector, resolveDirection } from '../../src/game/sprites/direction';
import type { Dir8 } from '../../src/game/sprites/types';

// Ángulo → dirección lógica (canvas: y hacia abajo)
const cases: [number, number, Dir8][] = [
  [1, 0, 'right'], [1, 1, 'down_right'], [0, 1, 'down'], [-1, 1, 'down_left'],
  [-1, 0, 'left'], [-1, -1, 'up_left'], [0, -1, 'up'], [1, -1, 'up_right'],
];
for (const [x, y, d] of cases) assert.equal(dirFromVector(x, y), d, `vector ${x},${y}`);
assert.equal(dirFromVector(0, 0, 'up'), 'up', 'vector nulo conserva la dirección previa');

// Con las 5 direcciones base, las 3 restantes se espejan
const five = [...DEFAULT_STORED_DIRS];
assert.deepEqual(resolveDirection('left', five), { dir: 'right', flip: true });
assert.deepEqual(resolveDirection('up_left', five), { dir: 'up_right', flip: true });
assert.deepEqual(resolveDirection('down_left', five), { dir: 'down_right', flip: true });
for (const d of five) assert.deepEqual(resolveDirection(d, five), { dir: d, flip: false });

// Personaje asimétrico (mirror=false) con 8 direcciones: nunca se espeja
const eight: Dir8[] = ['up', 'up_right', 'right', 'down_right', 'down', 'down_left', 'left', 'up_left'];
for (const d of eight) assert.deepEqual(resolveDirection(d, eight, false), { dir: d, flip: false });

// Sin espejado y faltando direcciones: la más cercana, sin invertir
assert.deepEqual(resolveDirection('left', five, false).flip, false);
assert.equal(resolveDirection('left', ['up', 'down'], false).flip, false);

// Solo una dirección disponible: siempre devuelve algo válido
assert.equal(resolveDirection('up_left', ['down'], true).dir, 'down');
console.log('direction.test.ts: OK');
