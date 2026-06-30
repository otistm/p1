import { parseAll, PartSchema, SLOTS, type Part, type Slot } from './schema';

/**
 * The launch part catalog. Every part is a trade-off (no strictly-best part), so build
 * choices matter. See docs/kart-anatomy.md for the real-world mapping. Stat numbers are
 * deltas added on top of a bare-chassis baseline (30 per rating) by loadoutToStats.
 */
const RAW: Part[] = [
  // Chassis — turn-in precision vs forgiveness.
  { id: 'chassis.stock', name: 'Stock Frame', slot: 'chassis', rarity: 'common', stats: { power: 4, wit: 4 }, blurb: 'Balanced tubular steel. Honest and predictable.' },
  { id: 'chassis.stiff', name: 'Stiff Chromoly', slot: 'chassis', rarity: 'rare', stats: { wit: 8, power: 3, stamina: -2 }, blurb: 'Razor turn-in. Reads the line, punishes mistakes.' },
  { id: 'chassis.flex', name: 'Flex Frame', slot: 'chassis', rarity: 'rare', stats: { power: 6, guts: 3, speed: -2 }, blurb: 'Soaks up curbs and holds grip when it gets rough.' },

  // Engine — power band vs thirst.
  { id: 'engine.stock', name: 'Stock TaG', slot: 'engine', rarity: 'common', stats: { speed: 5, power: 4, stamina: -2 }, blurb: 'Reliable single-speed. Good everywhere.' },
  { id: 'engine.turbo', name: 'KZ Screamer', slot: 'engine', rarity: 'epic', stats: { speed: 10, power: 6, stamina: -5 }, blurb: 'Monstrous top end. Drinks stamina for breakfast.' },
  { id: 'engine.eco', name: 'Long-Stroke 4T', slot: 'engine', rarity: 'rare', stats: { speed: 4, stamina: 4, wit: 2 }, blurb: 'Smooth, frugal torque. Goes the distance.' },

  // Tires — grip vs wear.
  { id: 'tires.stock', name: 'All-Round Slicks', slot: 'tires', rarity: 'common', stats: { power: 4, wit: 2 }, blurb: 'Dependable grip, sensible wear.' },
  { id: 'tires.soft', name: 'Soft Compound', slot: 'tires', rarity: 'rare', stats: { power: 8, wit: 3, stamina: -4 }, blurb: 'Glued to the road — for a while.' },
  { id: 'tires.hard', name: 'Endurance Compound', slot: 'tires', rarity: 'rare', stats: { stamina: 8, guts: 3, power: -2 }, blurb: 'Tough as nails. Trades peak grip for the long game.' },

  // Brakes — corner entry.
  { id: 'brakes.stock', name: 'Stock Discs', slot: 'brakes', rarity: 'common', stats: { power: 3, guts: 2 }, blurb: 'Fine for most corners.' },
  { id: 'brakes.carbon', name: 'Carbon Discs', slot: 'brakes', rarity: 'epic', stats: { power: 7, wit: 3, guts: 2, stamina: -2 }, blurb: 'Brake impossibly late, carry impossible speed.' },

  // Gearing — accel vs top speed.
  { id: 'gearing.stock', name: 'Stock Sprocket', slot: 'gearing', rarity: 'common', stats: { speed: 3, power: 3 }, blurb: 'A sensible compromise ratio.' },
  { id: 'gearing.short', name: 'Short Ratio', slot: 'gearing', rarity: 'rare', stats: { power: 8, speed: -3 }, blurb: 'Rockets off the corners; runs out of legs on straights.' },
  { id: 'gearing.tall', name: 'Tall Ratio', slot: 'gearing', rarity: 'rare', stats: { speed: 9, power: -3 }, blurb: 'Sky-high top end; lazy out of slow corners.' },

  // Aero — downforce vs drag.
  { id: 'aero.stock', name: 'Stock Fairings', slot: 'aero', rarity: 'common', stats: { wit: 3, stamina: 2 }, blurb: 'Clean, unremarkable, effective.' },
  { id: 'aero.downforce', name: 'Downforce Kit', slot: 'aero', rarity: 'epic', stats: { wit: 8, power: 4, speed: -4 }, blurb: 'Planted through fast corners. Caps the top end.' },
  { id: 'aero.lowdrag', name: 'Low-Drag Shell', slot: 'aero', rarity: 'rare', stats: { speed: 7, wit: -2 }, blurb: 'Slippery on the straights; nervous in the twisty bits.' },

  // Ballast — weight strategy.
  { id: 'ballast.stock', name: 'Standard Ballast', slot: 'ballast', rarity: 'common', stats: { stamina: 3, guts: 3 }, blurb: 'Meets the class minimum, stable.' },
  { id: 'ballast.feather', name: 'Featherweight', slot: 'ballast', rarity: 'legendary', stats: { speed: 5, power: 4, wit: 3, stamina: -6 }, mass: -25, blurb: 'Barely there. Darts and dances — until the legs go.' },
  { id: 'ballast.heavy', name: 'Heavy Ballast', slot: 'ballast', rarity: 'rare', stats: { stamina: 6, guts: 6, speed: -3 }, mass: 25, blurb: 'Unshakeable. Bullies through traffic.' },
];

export const PARTS: Part[] = parseAll(PartSchema, RAW, 'part');

export const PARTS_BY_ID: Record<string, Part> = Object.fromEntries(PARTS.map((p) => [p.id, p]));

export const PARTS_BY_SLOT: Record<Slot, Part[]> = Object.fromEntries(
  SLOTS.map((s) => [s, PARTS.filter((p) => p.slot === s)]),
) as Record<Slot, Part[]>;

/** The free starter set every new player owns and the default equipped loadout. */
export const STARTER_LOADOUT: Record<Slot, string> = {
  chassis: 'chassis.stock',
  engine: 'engine.stock',
  tires: 'tires.stock',
  brakes: 'brakes.stock',
  gearing: 'gearing.stock',
  aero: 'aero.stock',
  ballast: 'ballast.stock',
};

export const STARTER_PART_IDS: string[] = [
  ...Object.values(STARTER_LOADOUT),
  'engine.eco',
  'tires.soft',
  'gearing.tall',
  'aero.lowdrag',
];
