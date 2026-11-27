import { spriteAtlas } from '../game/sprites/spriteAtlas';

/**
 * Sprite pixel art de una pieza de equipo (set + ranura) con marco del color de rareza.
 * Si el manifiesto no declara el sprite, muestra `fallback` (el emoji original) para no perder información.
 */
export function EquipIcon({
  setId, slot, frame, fallback, size = 32,
}: { setId?: string; slot: string; frame?: string; fallback?: string; size?: number }) {
  const url = spriteAtlas.getObjectUrl(`equip_${setId ?? 'generic'}_${slot}`) ?? spriteAtlas.getObjectUrl(`equip_generic_${slot}`);
  if (!url) return <>{fallback ?? null}</>;
  return (
    <span className="equip-tile" style={frame ? { borderColor: frame } : undefined}>
      <img className="equip-sprite" src={url} width={size} height={size} alt="" draggable={false} />
    </span>
  );
}
