import { CosmeticSchema, parseAll, type Cosmetic } from './schema';

/** Cosmetics are purely visual and NEVER touch stats (non-pay-to-win guarantee). */
const RAW: Cosmetic[] = [
  { id: 'livery.crimson', name: 'Crimson', kind: 'livery', rarity: 'common', value: 0xe74c3c },
  { id: 'livery.cyan', name: 'Cyan', kind: 'livery', rarity: 'common', value: 0x2bd9ff },
  { id: 'livery.lime', name: 'Lime', kind: 'livery', rarity: 'common', value: 0x4ee08a },
  { id: 'livery.violet', name: 'Violet', kind: 'livery', rarity: 'common', value: 0xb07bff },
  { id: 'livery.amber', name: 'Amber', kind: 'livery', rarity: 'common', value: 0xff9f1c },
  { id: 'livery.rose', name: 'Rose', kind: 'livery', rarity: 'common', value: 0xff5d8f },
  { id: 'livery.gold', name: 'Gold', kind: 'livery', rarity: 'rare', value: 0xf4d03f },
  { id: 'livery.sky', name: 'Sky', kind: 'livery', rarity: 'common', value: 0x5dade2 },

  // Trails: the glowing wake the kart leaves in a race. `value` is the additive tint (hex).
  { id: 'trail.ion', name: 'Ion', kind: 'trail', rarity: 'common', value: 0x2bd9ff },
  { id: 'trail.ember', name: 'Ember', kind: 'trail', rarity: 'common', value: 0xff6a3d },
  { id: 'trail.lime', name: 'Verdant', kind: 'trail', rarity: 'common', value: 0x7df06a },
  { id: 'trail.violet', name: 'Nebula', kind: 'trail', rarity: 'rare', value: 0xb07bff },
  { id: 'trail.gold', name: 'Aurum', kind: 'trail', rarity: 'rare', value: 0xffcf5c },
];

export const COSMETICS: Cosmetic[] = parseAll(CosmeticSchema, RAW, 'cosmetic');

export const LIVERIES: Cosmetic[] = COSMETICS.filter((c) => c.kind === 'livery');

export const TRAILS: Cosmetic[] = COSMETICS.filter((c) => c.kind === 'trail');

/** The wake every new profile starts with (matches the default cyan livery). */
export const DEFAULT_TRAIL_ID = 'trail.ion';

/** Resolve a trail cosmetic's tint (hex), falling back to the default if the id is unknown. */
export function trailHex(trailId: string | undefined): number {
  const t = TRAILS.find((c) => c.id === trailId) ?? TRAILS.find((c) => c.id === DEFAULT_TRAIL_ID);
  return (t?.value as number) ?? 0x2bd9ff;
}
