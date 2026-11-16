/**
 * Emoji → icono pixel art (claves de iconData.ts).
 * Los emojis que no aparecen aquí (flechas, ⌨, 🔴, 🔵…) se dejan tal cual.
 * Varios emojis comparten icono: se prefiere un set pequeño y coherente a 126 dibujos sueltos.
 */
const GROUPS: Record<string, string> = {
  sword: '⚔🗡🔪',
  shield: '🛡',
  coin: '🪙💰',
  heart: '❤🖤💪',
  bolt: '⚡🌩🎸',
  flame: '🔥🕯🧯',
  skull: '☠💀',
  boot: '👟👢🥾🦵🦿👣🏃',
  target: '🎯',
  drop: '🩸🌡',
  syringe: '💉',
  spark: '✨💫💃',
  star: '🌟⭐',
  wind: '💨🪶🪽🌪',
  robot: '🤖🦾',
  vest: '🦺🎽',
  helmet: '🪖⛑🎩',
  pants: '👖🩳',
  check: '✓✅',
  cross: '✗🚫',
  box: '📦🎒🎲',
  warn: '⚠☢☣',
  vortex: '🌀🔀🔄♾🔮🕳',
  city: '🏙🏚🏛🏰🌅🌊🌋🌌',
  boom: '💥💢',
  bomb: '💣🧨',
  lock: '🔒',
  clock: '⏱',
  potion: '🧪🧫⚗⚕💊🩹',
  bow: '🏹',
  gun: '🔫',
  monster: '🐉👹👿🧛',
  snow: '❄🧊🌨',
  trophy: '🏆🎖',
  speaker: '🔊🔉',
  clip: '📋📏',
  gear: '⚙',
  ghost: '🥷🦇',
  pet: '🐈🐌🐍🦉',
  eye: '👁🔭🔬',
  wrench: '🔧🔩🔨🪢',
  chip: '💻🔋🔌',
  phone: '📱',
  ring: '💍📿',
};

export const EMOJI_TO_ICON: Record<string, string> = {};
for (const [icon, chars] of Object.entries(GROUPS)) {
  for (const ch of Array.from(chars)) EMOJI_TO_ICON[ch] = icon;
}
