import type { PetDef } from '../../content/pets';

// Original silhouettes shared by the game and the inventory. Periods are transparent.
// k outline, d shadow, a body, l light, w eyes, b brass.
const PIXELS: Record<string, string> = {
  pet_coin_sprite:   '...kkkk... ..kbbbbk.. .kblllbbk. .kbalbabk. kbbbbbabbk .kbbbwbbk. ..kbbbbk.. ...kddk... ..dk..kd..',
  pet_medic_bot:     '..kkkkkk.. .kwwwwwwk. .kwddwdwk. kkwdldwwkk kawlllwwak kkwdldwwkk .kwwwwwwk. ..kakkak.. ..k....k..',
  pet_scout_eye:     '...kkk.... ..klllkk.. .kalwwlak. kawwdbwwak kawwdbwwak .kalwwlak. ..kaaaak.. ...kddk... ....kk....',
  pet_turret_drone:  '...kk..... ...kakkk.. ..kaaadak. ..kaddkk.. kkklaalakk kadkaakdak kkkddddkkk ..kakkak.. .kd....dk.',
  pet_lucky_cat:     '.kk....kk. .kak..kak. .kaakkalk. .kalaaalk. .kawaaawk. .kaadbaak. ..kaaaak.. .kaaaaaakk .kdkkdkddk',
  pet_savant_owl:    '.kk....kk. .klkkkkak. .klwwwwak. .kawdwdak. kkaabwakk kadlllladk kadadadadk .kkaaaakk. ..kbkkbk..',
  pet_frost_wisp:    '.....k.... ....kak... ...kalak.. .kklllak.. klllllwwk. .klwwlaak. ..kalaak.. ...kak.... ....k.....',
  pet_guardian_shell:'...kkkk... .kklaaakk. klalaadaak klladaadaak kaldaadaak kadddddaak .kkkkkkkk. .kd.kk.dk. ..k....k..',
  pet_toxic_slug:    '......k.k. .....kakwk ..kkkkalak .klaldalaak .kladdalaaak klaladddaak .kkkkkkkkk. ...kak.....',
  pet_ember_dragon:  '..kk..kk... ..kbkkaak.. kkkalawakk. kdaaaladabk .kddaaadkk. ..kaaaak... .kadaaadkk. ..kdkadkk.. ...k..k....',
  pet_battle_drone:  '..k....k.. .kak..kak. kkakkkkakk kdalwwladk kdadkkdadk kkalwwlakk .kkaddakk. ..kkddkk.. .ka....ak.',
  pet_golden_hoarder:'..k....k.. .kbkkkkbk. .kbwlwbbk. kbbbaabbbk kbbaddabbk .kkbbbbbkk kbbblbbbdk kbbbbbdddk .kkkkkkkk.',
  pet_storm_djinn:   '....kk..... ...klak.... ..klalak... .klalwwak.. kllaabawakk .klaaaaakk. ..kadddk... ...kddk.... .kkadk.....',
  pet_phoenix_chick: '......k.... .k...klk... .kl.kllak.. .klllaawk.. kllaaaabbkk .kllaaabkk. ..klaaak... ...kbbk.... ..kb..bk...',
  pet_quantum_core:  '...kkkk... .kklaadkk. klaakadaak kllkwwkddk kaakwakddk kddakddalk .kkddadkk. ...kkkk...',
};

type PetBitmap = { canvas: HTMLCanvasElement; url?: string };
const atlas = new Map<string, PetBitmap>();

function petBitmap(pet: PetDef): PetBitmap | null {
  const cached = atlas.get(pet.id);
  if (cached) return cached;
  const rows = PIXELS[pet.id]?.split(' ');
  if (!rows) return null;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(...rows.map(row => row.length));
  canvas.height = rows.length;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const palette: Record<string, string> = {
    k: '#202331', d: '#455267', a: pet.color, l: '#c7d2d7', w: '#fff2cc', b: '#c59453',
  };
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  const sprite = { canvas };
  atlas.set(pet.id, sprite);
  return sprite;
}

export function petSpriteUrl(pet: PetDef) {
  const sprite = petBitmap(pet);
  if (!sprite) return undefined;
  return sprite.url ??= sprite.canvas.toDataURL();
}

export function drawPetSprite(ctx: CanvasRenderingContext2D, pet: PetDef, x: number, y: number, time: number) {
  const sprite = petBitmap(pet)?.canvas;
  if (!sprite) return;
  const scale = Math.max(2, Math.round(pet.stats.size / 5));
  const left = Math.round(x - sprite.width * scale / 2);
  const top = Math.round(y - sprite.height * scale / 2 + Math.sin(time * 5) * 2);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite, left, top, sprite.width * scale, sprite.height * scale);
  ctx.restore();
}
