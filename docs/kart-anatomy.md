# Reference: kart anatomy → gameplay attributes

How a real racing kart is built, and how each subsystem maps to our stats. This is the
design backbone for "build a kart from scratch." Parts are data (`@grid/content`); a
loadout of parts rolls up into the five ratings the sim consumes.

## Real kart subsystems (and their racing trade-offs)

- **Chassis / frame** — tubular steel (e.g. chromoly). Stiffer = sharper turn-in but
  less forgiving; flex = grip in low-traction. Wheelbase/width tune stability vs agility.
- **Engine** — 2-stroke (TaG/KZ) vs 4-stroke; displacement (e.g. 100–250cc) sets power
  band. More power = top speed + acceleration, at higher consumption/heat.
- **Tires** — compound (soft/medium/hard) and slick/wet. Soft = more grip, faster wear;
  hard = durability, less peak grip.
- **Brakes** — disc brakes (front/rear or rear-only). Bigger/better = later braking,
  more corner entry speed; adds weight.
- **Gearing / sprocket** — final drive ratio. Short gearing = acceleration off corners;
  tall gearing = higher top speed on straights.
- **Aerodynamics** — fairings/nassau panel/floor. Downforce = corner grip & stability at
  speed; drag penalty caps top speed.
- **Weight & ballast** — lighter = better accel/agility; ballast adds stability and meets
  class minimums. Mass drives collision impulses.
- **Steering / seat / ergonomics** — geometry and driver position affect responsiveness
  and consistency (our "racecraft").

## Mapping to the five ratings

| Subsystem      | speed | stamina | power | guts | wit | Notes |
| -------------- | :---: | :-----: | :---: | :--: | :-: | ----- |
| Engine         |  ++   |    -    |  ++   |      |     | power band; thirstier |
| Tires (soft)   |   +   |    -    |  ++   |      |  +  | grip up, wear down |
| Tires (hard)   |       |   ++    |       |  +   |     | durability |
| Chassis stiff  |       |         |   +   |      | ++  | turn-in / line precision |
| Brakes         |       |         |  ++   |  +   |  +  | later braking |
| Gearing short  |   -   |         |  ++   |      |     | accel over top speed |
| Gearing tall   |  ++   |         |   -   |      |     | top speed over accel |
| Aero downforce |   -   |    +    |   +   |      | ++  | corner grip; drag |
| Light weight   |   +   |    -    |   +   |      |  +  | agility; less endurance |
| Ballast/seat   |       |   ++    |       |  ++  |     | stability/consistency |

`+`/`++` raise a rating, `-` lowers it. Numbers live in `@grid/content` part data so
balancing is a data change. Cosmetics (livery, decals, wheels) are purely visual.

## Design intent

Every part is a **meaningful trade-off** (no strictly-best part). Rarity raises ceilings
and adds special modifiers (e.g. "fade-resistant compound": +guts, slower wear), not flat
power, to keep the economy non-pay-to-win (see `economy-cards.md`).
