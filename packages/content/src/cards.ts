import { CardSchema, parseAll, type Card } from './schema';

/**
 * Draft cards. At the start of a season (and at round milestones) the player is offered
 * a seeded choice of cards from their collection; the chosen card's mods are added to
 * the kart's ratings for the run. Power comes from synergy and trade-offs, not flat
 * walls (see docs/economy-cards.md).
 */
const RAW: Card[] = [
  { id: 'card.sticky', name: 'Sticky Compound', rarity: 'rare', theme: 'power', mods: { power: 6, stamina: -3 }, special: 'More bite, faster wear.', flavor: 'The mechanic grins: "It will not last. But oh, while it does."' },
  { id: 'card.longhaul', name: 'Long-Haul Tune', rarity: 'epic', theme: 'stamina', mods: { stamina: 8, wit: 2 }, special: 'Built for the full distance.', flavor: 'Pace is a promise you keep to yourself.' },
  { id: 'card.feather', name: 'Featherweight Tune', rarity: 'legendary', theme: 'speed', mods: { speed: 5, power: 4, stamina: -3 }, special: 'Every gram, gone.', flavor: 'Lightness is a kind of speed.' },
  { id: 'card.latebrake', name: 'Late-Brake Master', rarity: 'epic', theme: 'wit', mods: { power: 5, wit: 4 }, special: 'Trust the brakes.', flavor: 'Brake when they pray. Turn when they brake.' },
  { id: 'card.nitromap', name: 'Aggressive Map', rarity: 'rare', theme: 'speed', mods: { speed: 7, stamina: -2 }, special: 'All gas.', flavor: 'There is a pedal. It goes down.' },
  { id: 'card.racecraft', name: 'Racecraft', rarity: 'rare', theme: 'wit', mods: { wit: 8 }, special: 'Reads the room.', flavor: 'The line was always there. You just had to see it.' },
  { id: 'card.ironwill', name: 'Iron Will', rarity: 'epic', theme: 'guts', mods: { guts: 8, stamina: 3 }, special: 'Never lift.', flavor: 'When the legs are gone, the heart keeps time.' },
  { id: 'card.balanced', name: 'Balanced Setup', rarity: 'common', theme: 'wit', mods: { speed: 2, stamina: 2, power: 2, guts: 2, wit: 2 }, special: 'No weaknesses.', flavor: 'Boring wins championships.' },
  { id: 'card.slingshot', name: 'Slipstream Slingshot', rarity: 'epic', theme: 'speed', mods: { speed: 6, power: 3, wit: -1 }, special: 'Tow and go.', flavor: 'Let them break the air. Then take it.' },
  { id: 'card.gritseat', name: 'Grit & Bracing', rarity: 'rare', theme: 'guts', mods: { guts: 6, power: 2 }, special: 'Hold the line.', flavor: 'Contact is just another corner.' },
];

export const CARDS: Card[] = parseAll(CardSchema, RAW, 'card');

export const CARDS_BY_ID: Record<string, Card> = Object.fromEntries(CARDS.map((c) => [c.id, c]));

/** The starter card pool every player begins with (the rest are unlocked over time). */
export const STARTER_CARD_IDS: string[] = [
  'card.balanced',
  'card.racecraft',
  'card.nitromap',
  'card.sticky',
  'card.gritseat',
  'card.longhaul',
];
