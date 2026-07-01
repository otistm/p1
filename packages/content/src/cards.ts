import { CardSchema, parseAll, type Card } from './schema';

/**
 * The unified card database (see docs/training-tuning-cards.md). Two kinds share one
 * schema and one registry:
 *  - `training` — permanent, always in hand; playing one spends energy and grows a rating.
 *  - `tuning` — bought in the shop, dragged onto the kart to stage for the next race, and
 *    consumed (removed from the collection) once that race resolves. Power comes from
 *    synergy and trade-offs, not flat walls (see docs/economy-cards.md).
 */
const RAW: Card[] = [
  // --- Training cards. Always available; energy is the only gate (see season.ts). ---
  { id: 'train.speed', kind: 'training', icon: '🏁', name: 'Speed Sprints', mainStat: 'speed', mainAmt: 11, splashStat: 'power', splashAmt: 3, energyCost: 30, flavor: 'Full throttle, every lap, until the legs argue back.' },
  { id: 'train.power', kind: 'training', icon: '💪', name: 'Power Drills', mainStat: 'power', mainAmt: 11, splashStat: 'guts', splashAmt: 3, energyCost: 30, flavor: 'Short, brutal reps. The kart learns to bite.' },
  { id: 'train.corner', kind: 'training', icon: '🌀', name: 'Slalom Lab', mainStat: 'wit', mainAmt: 11, splashStat: 'speed', splashAmt: 3, energyCost: 28, flavor: 'Cones, then fewer cones, then none — just the line.' },
  { id: 'train.endure', kind: 'training', icon: '🫀', name: 'Endurance Laps', mainStat: 'stamina', mainAmt: 11, splashStat: 'guts', splashAmt: 3, energyCost: 32, flavor: 'The tenth lap teaches what the first nine cannot.' },
  { id: 'train.grit', kind: 'training', icon: '🔥', name: 'Grit Session', mainStat: 'guts', mainAmt: 11, splashStat: 'stamina', splashAmt: 3, energyCost: 30, flavor: 'Nobody enjoys this one. That is the point.' },
  { id: 'train.rest', kind: 'training', icon: '😴', name: 'Rest & Tune', mainStat: null, mainAmt: 0, restoreEnergy: 48, energyCost: 0, flavor: 'The mechanic works. The driver sleeps. Both matter.' },

  // --- Tuning cards: flat modifiers. ---
  { id: 'card.sticky', kind: 'tuning', name: 'Sticky Compound', rarity: 'rare', theme: 'power', mods: { power: 6, stamina: -3 }, special: 'More bite, faster wear.', flavor: 'The mechanic grins: "It will not last. But oh, while it does."' },
  { id: 'card.longhaul', kind: 'tuning', name: 'Long-Haul Tune', rarity: 'epic', theme: 'stamina', mods: { stamina: 8, wit: 2 }, special: 'Built for the full distance.', flavor: 'Pace is a promise you keep to yourself.' },
  { id: 'card.feather', kind: 'tuning', name: 'Featherweight Tune', rarity: 'legendary', theme: 'speed', mods: { speed: 5, power: 4, stamina: -3 }, special: 'Every gram, gone.', flavor: 'Lightness is a kind of speed.' },
  { id: 'card.latebrake', kind: 'tuning', name: 'Late-Brake Master', rarity: 'epic', theme: 'wit', mods: { power: 5, wit: 4 }, special: 'Trust the brakes.', flavor: 'Brake when they pray. Turn when they brake.' },
  { id: 'card.nitromap', kind: 'tuning', name: 'Aggressive Map', rarity: 'rare', theme: 'speed', mods: { speed: 7, stamina: -2 }, special: 'All gas.', flavor: 'There is a pedal. It goes down.' },
  { id: 'card.racecraft', kind: 'tuning', name: 'Racecraft', rarity: 'rare', theme: 'wit', mods: { wit: 8 }, special: 'Reads the room.', flavor: 'The line was always there. You just had to see it.' },
  { id: 'card.ironwill', kind: 'tuning', name: 'Iron Will', rarity: 'epic', theme: 'guts', mods: { guts: 8, stamina: 3 }, special: 'Never lift.', flavor: 'When the legs are gone, the heart keeps time.' },
  { id: 'card.balanced', kind: 'tuning', name: 'Balanced Setup', rarity: 'common', theme: 'wit', mods: { speed: 2, stamina: 2, power: 2, guts: 2, wit: 2 }, special: 'No weaknesses.', flavor: 'Boring wins championships.' },
  { id: 'card.slingshot', kind: 'tuning', name: 'Slipstream Slingshot', rarity: 'epic', theme: 'speed', mods: { speed: 6, power: 3, wit: -1 }, special: 'Tow and go.', flavor: 'Let them break the air. Then take it.' },
  { id: 'card.gritseat', kind: 'tuning', name: 'Grit & Bracing', rarity: 'rare', theme: 'guts', mods: { guts: 6, power: 2 }, special: 'Hold the line.', flavor: 'Contact is just another corner.' },

  // --- Tuning cards: conditional (triggered). Mods stay modest; power comes from the situation. ---
  { id: 'card.siphon', kind: 'tuning', name: 'Slingshot Siphon', rarity: 'epic', theme: 'speed', mods: { speed: 3 },
    archetype: 'Draft', trigger: 'Tucked in a rival\u2019s draft on a straight for 1.5s',
    effectText: '+15% acceleration out of the tow.',
    effect: { kind: 'slingshotSiphon', params: { accelPct: 15, minDraftSeconds: 1.5 } },
    flavor: 'Patience on the straight, then theft.' },
  { id: 'card.cornerpocket', kind: 'tuning', name: 'Corner Pocket', rarity: 'rare', theme: 'wit', mods: { wit: 3 },
    archetype: 'Cornering', trigger: 'A rival holds the apex ahead of you',
    effectText: 'Switch to the outer line with +15% exit traction.',
    effect: { kind: 'cornerPocket', params: { exitGripPct: 15, outerMeters: 3 } },
    flavor: 'Let them have the inside. Take the lap.' },
  { id: 'card.claustro', kind: 'tuning', name: 'Claustrophobia', rarity: 'rare', theme: 'power', mods: { power: 3, wit: -2 },
    archetype: 'Traffic', trigger: '3+ karts crowd your proximity bubble',
    effectText: 'Panic-jump to open space, +10% speed, \u221215% steering bite.',
    effect: { kind: 'claustrophobia', params: { speedPct: 10, driftPenaltyPct: 15, bubbleCount: 3 } },
    flavor: 'Walls close in. So you make a door.' },
  { id: 'card.paintscraper', kind: 'tuning', name: 'Paint-Scraper', rarity: 'epic', theme: 'guts', mods: { guts: 3, power: 2 },
    archetype: 'Traffic', trigger: 'A rival is alongside you mid-corner',
    effectText: 'Lean in with +25% shove, pushing them wide.',
    effect: { kind: 'paintScraper', params: { impactPct: 25, leanMeters: 1 } },
    flavor: 'The paint was already scratched.' },
  { id: 'card.cleanair', kind: 'tuning', name: 'Clean-Air Supercharger', rarity: 'legendary', theme: 'speed', mods: { speed: 4, guts: -2 },
    archetype: 'Leader', trigger: 'Leading the race with clear air ahead',
    effectText: '+8% top speed, \u22125% cornering stability.',
    effect: { kind: 'cleanAirSupercharger', params: { topPct: 8, stabilityPct: 5 } },
    flavor: 'Out front, the air is yours alone.' },
  { id: 'card.desperation', kind: 'tuning', name: 'Desperation Draft', rarity: 'rare', theme: 'guts', mods: { guts: 4 },
    archetype: 'Underdog', trigger: '4th or lower on the final lap',
    effectText: 'Triple draft range and +12% tow top speed.',
    effect: { kind: 'desperationDraft', params: { topPct: 12, rangeMult: 3 } },
    flavor: 'Nothing to lose is its own kind of fast.' },
  { id: 'card.vanguard', kind: 'tuning', name: 'Vanguard Shield', rarity: 'epic', theme: 'guts', mods: { guts: 3, wit: 1 },
    archetype: 'Leader', trigger: 'Top-3 while being drafted from behind',
    effectText: 'Defensive centre line, +20% blocking width.',
    effect: { kind: 'vanguardShield', params: { boxPct: 20, centerPull: 0.6 } },
    flavor: 'You shall not pass \u2014 not here, anyway.' },

  // --- Phase 2 (scaffolded). These validate and render, but their effects are INERT until
  // the supporting sim subsystems (engine heat, tyre wear, drift/KERS, rubber line, hazards)
  // ship. Kept out of LIVE_CARD_IDS so they don't appear in the shop yet. ---
  { id: 'card.redline', kind: 'tuning', name: 'Redline Gambler', rarity: 'legendary', theme: 'power', mods: { power: 4, stamina: -2 },
    archetype: 'Engine', trigger: 'Engine heat reaches 90%',
    effectText: 'Overrev for +20% speed (3s), then a 2s cooling coast.',
    effect: { kind: 'redlineGambler', params: { heatThreshold: 90, boostPct: 20, boostSec: 3, coolSec: 2, coolPct: 30 } },
    flavor: 'The needle in the red is just the engine saying yes.' },
  { id: 'card.driftchain', kind: 'tuning', name: 'Drift-Chain Reaction', rarity: 'epic', theme: 'wit', mods: { wit: 4 },
    archetype: 'Drift', trigger: 'Three perfect drifts in a row',
    effectText: 'Fill KERS, then burst on the next straight.',
    effect: { kind: 'driftChainReaction', params: { chain: 3, burstPct: 18 } },
    flavor: 'Slide, slide, slide \u2014 then fly.' },
  { id: 'card.conserve', kind: 'tuning', name: 'Conservationist', rarity: 'rare', theme: 'stamina', mods: { stamina: 5 },
    archetype: 'Tyres', trigger: 'Tyre wear climbs above 60%',
    effectText: '\u22125% top speed, +15% cornering safety.',
    effect: { kind: 'conservationist', params: { wearThreshold: 60, topPct: 5, gripPct: 15 } },
    flavor: 'Win the long game by not losing the short one.' },
  { id: 'card.groovelock', kind: 'tuning', name: 'Groove-Lock', rarity: 'rare', theme: 'wit', mods: { wit: 3 },
    archetype: 'Surface', trigger: 'Running on the rubbered-in racing line',
    effectText: '+8% cornering grip on the groove.',
    effect: { kind: 'grooveLock', params: { gripPct: 8 } },
    flavor: 'Follow the black gold.' },
  { id: 'card.gutterhook', kind: 'tuning', name: 'Gutter Hook', rarity: 'epic', theme: 'guts', mods: { guts: 3, wit: 1 },
    archetype: 'Surface', trigger: 'Hooked on a hairpin\u2019s inner kerb',
    effectText: 'Pivot +15% faster with no slide.',
    effect: { kind: 'gutterHook', params: { pivotPct: 15 } },
    flavor: 'The gutter is a guide rail if you trust it.' },
  { id: 'card.debrisdodger', kind: 'tuning', name: 'Debris Dodger', rarity: 'rare', theme: 'wit', mods: { wit: 3, guts: 1 },
    archetype: 'Hazard', trigger: 'A hazard appears within 10m ahead',
    effectText: 'Seeded dodge: usually a micro-swerve, sometimes a safe brake.',
    effect: { kind: 'debrisDodger', params: { range: 10, swerveChance: 80 } },
    flavor: 'Eyes up. The track keeps secrets.' },
];

export const CARDS: Card[] = parseAll(CardSchema, RAW, 'card');

export const CARDS_BY_ID: Record<string, Card> = Object.fromEntries(CARDS.map((c) => [c.id, c]));

/** The permanent training deck — always in every player's hand. */
export const TRAINING_CARDS: Card[] = CARDS.filter((c) => c.kind === 'training');

/** The buyable/consumable tuning deck (both live and Phase-2 scaffolded). */
export const TUNING_CARDS: Card[] = CARDS.filter((c) => c.kind === 'tuning');

/**
 * A representative owned-tuning-card set — a flat all-rounder plus two cheap tunes and one
 * conditional card, sized to `MAX_OWNED_TUNING` (4, see economy.ts). Players start with an
 * **empty** tuning collection and buy every copy in the shop (see
 * docs/training-tuning-cards.md); this set exists only as a fixture for tooling/tests that
 * need a plausible "already own 4 cards" scenario (e.g. `tools/diag/season.ts`).
 */
export const SAMPLE_TUNING_CARD_IDS: string[] = [
  'card.balanced',
  'card.racecraft',
  'card.nitromap',
  'card.cornerpocket',
];
