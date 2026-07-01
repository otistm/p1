# Reference: the Umamusume meta-loop (inspiration)

Source: research of Umamusume: Pretty Derby's Career mode (gamerant, umamusu.wiki,
lootbar, gamer.org, dtgre — 2025/2026). We borrow the *structure*, not the IP.

## Their loop (what works)

- A **self-contained career run**: pick a trainee, two legacy "inheritances", and a
  deck of **6 support cards** before the run.
- ~**70 turns** across three years. Each turn: **train / rest / go out (mood) /
  see infirmary / race**.
- **Support cards are the single most impactful variable.** They decide which training
  produces bonus gains, which skills unlock, and which events fire. A strong deck +
  mid trainee beats a weak deck + top trainee.
- **Friendship/bond** training (rainbow) multiplies gains — a reason to repeat-train
  with the same supports.
- **Mood/energy** gate training output; training while spent risks a bad/injured run.
- Five stats: **Speed** (top velocity, always king), **Stamina** (prevents late
  collapse), **Power** (accel + cornering + overtakes), **Guts** (final sprint, drain
  resistance), **Wit** (skill activation, positioning, restores energy when trained).
- Race needs depend on distance; **running styles** (Front Runner, Pace Chaser, Late
  Surger, End Closer) bias preferred stats and lane behavior.
- PvP ("Team Trials") is **asynchronous** — you race against other players' saved teams.

## How P1 adapts it

- Trainee → **your kart**. Support cards → **tuning cards** that improve/customize the build.
- "Deck before run" → a **shop economy**: a persistent collection topped up from an in-shop offer.
- 70 turns/3 years → a tighter **season of training turns** across escalating cups.
- The five stats map **1:1** to our kart ratings (see `sim-physics.md`), so training is
  legible: you can *see* a stat change how the kart drives.
- Async PvP → our **snapshot racing** (see `multiplayer-async.md`).
- Running styles → future **driver profiles** (front-runner vs closer) layered on the AI.
