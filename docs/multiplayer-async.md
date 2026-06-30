# Reference: async snapshot racing

Decision: races resolve **asynchronously** against stored builds, Umamusume-style — not
live netcode. Research basis: deterministic-lockstep vs async ghost comparison
(yal.cc, mas-bandwidth.com, 2026). Live lockstep stalls on the slowest peer and demands
hard determinism across the wire; async has no latency coupling and scales infinitely.

## The model

1. A player finishes building/training a kart → its **build snapshot** (entrant: name,
   livery, `KartStats`, and the part loadout that produced them) is stored.
2. To race, the matchmaker returns **N opponent snapshots** near the player's rating,
   plus a **master seed**.
3. The client constructs a `RaceConfig` (track + entrants + seed) and runs the **full
   field** through `@grid/sim`. Everyone is simulated locally and deterministically.
4. Result + rating delta are reported. Later, the server **re-simulates** the same
   `RaceConfig` (same `@grid/sim` code) to verify the outcome → cheap anti-cheat.

Opponents are **reconstructed from stats**, not recorded position streams. This keeps
storage tiny and lets opponents react to the field (draft, block, overtake).

## Ghost replays (secondary feature)

Because the sim is deterministic, any past race is reproducible from `{config, seed}`.
A "ghost"/replay is just those bytes; the renderer replays by stepping the engine. We
also expose an optional `RaceRecorder` that captures per-tick frames for scrubbing.

## Vertical slice vs later phases

- **Now (slice)**: opponents come from built-in AI archetypes + locally saved past
  builds (localStorage). The `OpponentSource` interface is the seam.
- **Later (Phase 6)**: a backend implements `OpponentSource` (rating-based matchmaking),
  a snapshot store, accounts, and server-side re-sim verification.

Keep the snapshot format stable and versioned; it is the contract between client and
the future backend.
