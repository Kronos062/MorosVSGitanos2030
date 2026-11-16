import { spriteAtlas } from '../game/sprites/spriteAtlas';

/**
 * Retrato o icono pixel art de un personaje. No renderiza nada si el manifiesto
 * de sprites no lo declara, de modo que las tarjetas conservan su aspecto actual.
 */
export function CharacterPortrait({ id, variant = 'portrait' }: { id: string; variant?: 'portrait' | 'icon' }) {
  const url = variant === 'icon' ? spriteAtlas.getIconUrl(id) : spriteAtlas.getPortraitUrl(id);
  if (!url) return null;
  return <img className={`pixel-${variant}`} src={url} alt="" draggable={false} />;
}
