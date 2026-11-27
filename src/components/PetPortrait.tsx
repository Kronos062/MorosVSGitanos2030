import type { PetDef } from '../content/pets';
import { petSpriteUrl } from '../game/sprites/petSprites';

export function PetPortrait({ pet }: { pet: PetDef }) {
  const src = petSpriteUrl(pet);
  return src && <img className="pet-sprite" src={src} alt="" draggable={false} />;
}
