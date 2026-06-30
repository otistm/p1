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
];

export const COSMETICS: Cosmetic[] = parseAll(CosmeticSchema, RAW, 'cosmetic');

export const LIVERIES: Cosmetic[] = COSMETICS.filter((c) => c.kind === 'livery');
