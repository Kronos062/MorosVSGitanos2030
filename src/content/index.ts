/**
 * content/index.ts — agregación modular de contenido (TDD §3.3).
 *
 * Importa los archivos JSON modulares (characters/*.json, weapons/*.json, etc.)
 * y los agrupa en ContentBundle listos para ser consumidos por el ContentLoader.
 */

import type { ContentBundle } from '@/engine/content/ContentRepository';

// Characters
import tariq from './characters/tariq.json';
import ziryab from './characters/ziryab.json';
import benghazi from './characters/benghazi.json';
import sombra from './characters/sombra.json';
import alhambra from './characters/alhambra.json';
import bailaorFuria from './characters/bailaor_furia.json';
import rayo from './characters/rayo.json';
import bronce from './characters/bronce.json';
import hechiceraLola from './characters/hechicera_lola.json';
import patriarca from './characters/patriarca.json';

// Weapons
import weaponsList from './weapons.json';
import enemiesList from './enemies.json';
import bossesList from './bosses.json';
import roomsList from './rooms.json';
import biomesList from './biomes.json';
import relicsList from './relics.json';
import petsList from './pets.json';
import skillsList from './skills.json';
import eventsList from './events.json';
import affixesList from './affixes.json';
import mutationsList from './mutations.json';
import chestsList from './chests.json';
import aiProfilesList from './ai-profiles.json';
import synergiesList from './synergies.json';
import resonancesList from './resonances.json';
import legaciesList from './legacies.json';

export const modularCharacters = [
  tariq, ziryab, benghazi, sombra, alhambra,
  bailaorFuria, rayo, bronce, hechiceraLola, patriarca,
];

export { weaponsList };

export const allContentBundles: ContentBundle[] = [
  { type: 'characters', items: modularCharacters as never[] },
  { type: 'weapons', items: weaponsList as never[] },
  { type: 'enemies', items: enemiesList as never[] },
  { type: 'bosses', items: bossesList as never[] },
  { type: 'rooms', items: roomsList as never[] },
  { type: 'biomes', items: biomesList as never[] },
  { type: 'relics', items: relicsList as never[] },
  { type: 'pets', items: petsList as never[] },
  { type: 'skills', items: skillsList as never[] },
  { type: 'events', items: eventsList as never[] },
  { type: 'affixes', items: affixesList as never[] },
  { type: 'mutations', items: mutationsList as never[] },
  { type: 'chests', items: chestsList as never[] },
  { type: 'ai-profiles', items: aiProfilesList as never[] },
  { type: 'synergies', items: synergiesList as never[] },
  { type: 'resonances', items: resonancesList as never[] },
  { type: 'legacies', items: legaciesList as never[] },
];
