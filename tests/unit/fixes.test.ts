import assert from 'node:assert/strict';

// localStorage simulado (en memoria) para ejecutar en Node
const store = new Map<string, string>();
let quotaFull = false;
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { if (quotaFull) throw new Error('QuotaExceededError'); store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
};
import { runRandom } from '../../src/game/random';
import { EnemyDirector, EncounterMemory } from '../../src/game/enemyDirector';
import { EventDirector, EVENT_DEFS } from '../../src/game/eventDirector';
import { CHESTS, getChest } from '../../src/content/chests';
import { pickSkillChoices, skillWeight, SKILLS } from '../../src/content/skills';
import { importSaveFromJson, loadSave, setBinding, writeSave, recordKills, discoverWeapon } from '../../src/game/persistence';

// 1) Semilla: el número mostrado y el mismo número escrito como texto dan la misma partida
runRandom.setSeed(123456789);
const a = [runRandom.next('map'), runRandom.next('loot')];
runRandom.setSeed('123456789');
const b = [runRandom.next('map'), runRandom.next('loot')];
assert.deepEqual(a, b, 'semilla numérica = semilla escrita');
runRandom.setSeed('hola');
const c1 = runRandom.next('map');
runRandom.setSeed('hola');
assert.equal(runRandom.next('map'), c1, 'semilla de texto determinista');

// 2) Director de enemigos: los contadores "recientes" decaen con el tiempo real
{
  const d = new EnemyDirector();
  for (let i = 0; i < 12; i++) d.onKill();
  d.onDamageTaken(60);
  d.onNearDeath();
  const before = d.getTelemetrySnapshot();
  assert.ok(before.recentKills >= 12 && before.recentDamageTaken >= 60 && before.nearDeathCount >= 1);
  for (let t = 0; t < 60 * 60; t++) d.tick(1 / 60); // 60 s
  const after = d.getTelemetrySnapshot();
  assert.equal(after.recentKills, 0, 'recentKills decae');
  assert.equal(after.recentDamageTaken, 0, 'recentDamageTaken decae');
  assert.equal(after.nearDeathCount, 0, 'nearDeathCount decae');
}

// 3) Memoria anti-repetición: pesos entre 0 y 1; lo más reciente pesa menos que lo antiguo
{
  const m = new EncounterMemory();
  for (let i = 0; i < 30; i++) m.rememberEnemy(i % 2 ? 'a' : 'b');
  m.rememberEnemy('a');
  assert.ok(m.enemyWeight('a') <= 1 && m.enemyWeight('b') <= 1);
  assert.ok(m.enemyWeight('a') < m.enemyWeight('b'), 'el último visto pesa menos');
  assert.equal(m.enemyWeight('nunca'), 1);
}

// 4) Cofres: los alias del manifiesto resuelven al cofre real y todos los cofres de eventos existen
assert.equal(getChest('chest_legendary').id, 'chest_boss');
assert.equal(getChest('chest_rare').id, 'chest_armory');
assert.equal(getChest('chest_common').id, 'chest_street');
assert.ok(CHESTS.every((ch) => ch.weaponChance > 0 && ch.weaponChance <= 1));
assert.ok(getChest('chest_street').weaponChance < 1, 'el cofre de calle no siempre da arma');

// 5) Eventos: cancelar una elección devuelve los contadores
{
  const ed = new EventDirector();
  let seed = 7;
  const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const id = ed.pickEvent(3, rng);
  assert.ok(id && EVENT_DEFS.some((e) => e.id === id));
  ed.cancelEvent(id!);
  // Tras cancelar, el mismo evento puede volver a salir hasta su límite por mapa
  let got = 0;
  for (let i = 0; i < 40; i++) {
    const x = ed.pickEvent(3, rng);
    if (x === id) got++;
    if (x) ed.cancelEvent(x);
  }
  assert.ok(got > 0, 'los eventos cancelados no consumen límites');
}

// 6) Persistencia
assert.equal(importSaveFromJson('{}'), null, '{} no es una partida');
assert.equal(importSaveFromJson('123'), null, 'un número no es una partida');
assert.equal(importSaveFromJson('no json'), null);
const imp = importSaveFromJson(JSON.stringify({ faction: 'bando_moros', gold: -5, volume: 9, highScores: 'x', bestiary: { a: 'z', b: 3 } }));
assert.ok(imp);
assert.equal(imp!.gold, 0);
assert.equal(imp!.volume, 1);
assert.deepEqual(imp!.highScores, []);
assert.deepEqual(imp!.bestiary, { b: 3 });
quotaFull = true;
const origWarn = console.warn; console.warn = () => {};
assert.doesNotThrow(() => writeSave(loadSave()), 'writeSave no lanza con la cuota llena');
assert.equal(writeSave(loadSave()), false);
console.warn = origWarn; quotaFull = false;
assert.equal(writeSave(loadSave()), true);
const base = loadSave();
const swapped = setBinding(base, 'dash', base.bindings.interact);
assert.equal(swapped.bindings.dash, base.bindings.interact);
assert.equal(swapped.bindings.interact, base.bindings.dash, 'se intercambian las teclas duplicadas');
assert.equal(new Set(Object.values(swapped.bindings)).size, Object.values(swapped.bindings).length, 'sin teclas repetidas');
assert.equal(recordKills(base, { x: 2 }).bestiary.x, 2);
assert.equal(discoverWeapon(base, 'pulse_pistol'), base, 'arma ya descubierta: mismo objeto (sin escritura)');

// 7) Semillas por mapa: reseed vuelve al mismo estado aunque se hayan consumido números antes
{
  runRandom.setSeed(42); runRandom.reseed('map', 'layout:1:2');
  const clean = [runRandom.next('map'), runRandom.next('map')];
  runRandom.setSeed(42); for (let i = 0; i < 17; i++) runRandom.next('map'); runRandom.reseed('map', 'layout:1:2');
  assert.deepEqual([runRandom.next('map'), runRandom.next('map')], clean, 'el mapa no depende de lo consumido antes');
  runRandom.reseed('map', 'layout:1:3');
  assert.notEqual(runRandom.next('map'), clean[0], 'otro mapa, otro resultado');
}

// 8) Habilidades: ponderadas por rareza, sin repetir las únicas, más raras al avanzar
{
  runRandom.setSeed(5);
  const count = (mapNumber: number, acquiredIds: string[] = []) => {
    const c: Record<string, number> = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
    for (let i = 0; i < 3000; i++) for (const sk of pickSkillChoices(3, { weaponTags: ['kinetic'], equippedSetIds: [], mapNumber, acquiredIds })) c[sk.rarity]++;
    return c;
  };
  const early = count(1), late = count(10);
  const perSkill = (c: Record<string, number>, r: string) => c[r] / SKILLS.filter((x) => x.rarity === r).length;
  assert.ok(perSkill(early, 'common') > perSkill(early, 'legendary') * 8, 'al inicio las legendarias salen mucho menos que las comunes');
  assert.ok(late.legendary > early.legendary * 1.5 && late.epic > early.epic, 'más raras al avanzar de mapa');
  const legendary = SKILLS.find((x) => x.rarity === 'legendary')!;
  assert.equal(skillWeight(legendary, { weaponTags: [], equippedSetIds: [], acquiredIds: [legendary.id] }), 0, 'una legendaria ya adquirida no se vuelve a ofrecer');
  const common = SKILLS.find((x) => x.rarity === 'common')!;
  const w0 = skillWeight(common, { weaponTags: [], equippedSetIds: [] });
  assert.equal(skillWeight(common, { weaponTags: [], equippedSetIds: [], acquiredIds: [common.id] }), w0 / 2, 'las comunes acumulables pesan la mitad por copia');
  for (let i = 0; i < 200; i++) {
    const ch = pickSkillChoices(3, { weaponTags: [], equippedSetIds: [], mapNumber: 5 });
    assert.equal(new Set(ch.map((x) => x.id)).size, ch.length, 'sin duplicados en una oferta');
    assert.equal(ch.length, 3);
  }
  // Si casi todo está adquirido, aún se ofrecen 3 opciones
  const ownedUnique = SKILLS.filter((x) => x.rarity !== 'common' && x.rarity !== 'uncommon').map((x) => x.id);
  assert.equal(pickSkillChoices(3, { weaponTags: [], equippedSetIds: [], acquiredIds: ownedUnique }).length, 3);
}

console.log('fixes.test.ts: OK');
