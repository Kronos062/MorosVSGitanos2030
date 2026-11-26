import { useEffect, useState } from 'react';
import { spriteAtlas } from '../game/sprites/spriteAtlas';

/**
 * Retrato o icono pixel art de un personaje. No renderiza nada si el manifiesto
 * de sprites no lo declara, de modo que las tarjetas conservan su aspecto actual.
 */
export function CharacterPortrait({ id, variant = 'portrait' }: { id: string; variant?: 'portrait' | 'icon' | 'idle' }) {
  const [atlasLoaded, setAtlasLoaded] = useState(false);
  const idle = variant === 'idle' ? spriteAtlas.getPortraitIdle(id) : null;
  const url = idle?.url ?? (variant === 'portrait' ? spriteAtlas.getPortraitUrl(id) : spriteAtlas.getIconUrl(id));
  useEffect(() => {
    if (atlasLoaded || (variant !== 'idle' && url)) return;
    let mounted = true;
    void spriteAtlas.load().then(() => { if (mounted) setAtlasLoaded(true); });
    return () => { mounted = false; };
  }, [url, variant, atlasLoaded]);
  if (idle) {
    return (
      <span className="pixel-idle" aria-hidden="true" data-animated={idle.frames > 1}
        style={{
          backgroundImage: `url("${idle.url}")`,
          backgroundSize: `${100 * idle.frames}% 100%`,
          animationDuration: `${idle.frames / idle.fps}s`,
          animationTimingFunction: idle.frames > 1 ? `steps(${idle.frames}, jump-none)` : undefined,
        }}
      />
    );
  }
  if (!url) return null;
  return <img className={variant === 'portrait' ? 'pixel-portrait' : 'pixel-icon'} src={url} alt="" draggable={false} />;
}
